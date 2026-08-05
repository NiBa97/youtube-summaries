"""Top-level YouTube comments, for the deck's community section.

There is no YouTube Data API key in this project, so this scrapes YouTube's
internal innertube endpoints through `youtube-comment-downloader`. That means the
module will break when YouTube changes its internals - a design property, not a
bug. `/slides` swallows the failure and `GET /comments` is where you find out.

Two things are deliberately owned here rather than left to the library:

  * wall clock - the library sets no timeout at all on its first request
    (`downloader.py:51`, `:57`) and retries AJAX failures 5 times with a 20s
    sleep between them (`:30-45`), which together would pin a FastAPI
    threadpool worker for minutes.
  * trust - comment text is arbitrary text from the public internet on its way
    into a system-prompted LLM call whose output renders clickable links.
"""

from __future__ import annotations

import functools
import inspect
import re
import time
from dataclasses import dataclass
from itertools import islice

from youtube_comment_downloader import SORT_BY_POPULAR, YoutubeCommentDownloader

_TIMEOUT_SECONDS = 6.0  # per HTTP call, same budget as link_preview
_TOTAL_BUDGET_SECONDS = 12.0  # whole fetch, checked before every HTTP call
_MAX_RAW_COMMENTS = 60  # generator items pulled before we stop asking
_MAX_COMMENTS = 40  # kept after filtering
_MIN_COMMENTS = 5  # below this the block is not worth sending at all
_MIN_COMMENT_CHARS = 25
_MAX_COMMENT_CHARS = 400
_MAX_TOTAL_CHARS = 12_000
_MIN_LETTER_RATIO = 0.5


class CommentsError(Exception):
    """Raised when a video's comments cannot be fetched."""


@dataclass(frozen=True)
class Comment:
    text: str
    likes: int
    replies: int
    heart: bool
    author: str  # kept for the stored record; never sent to the model
    published: str  # YouTube's display string, e.g. "2 years ago"


# Control characters, minus \n and \t: newlines have to survive this pass so the
# line-anchored label strip below can still see line starts.
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
_URL_RE = re.compile(r"(?i)\b(?:https?://|www\.)\S+")
# Bare domains too: "buy at kryptocoin.example" carries no scheme, so the pattern
# above misses it and the model could still turn it into an inline link. Matched
# against an explicit TLD list rather than `\w+\.\w+` so ordinary prose survives
# ("e.g.", "Node.js", "1.5x"). A mangled legitimate domain costs nothing here -
# comments are never rendered verbatim except in a quote, and a broken quote is
# dropped rather than shown.
_BARE_DOMAIN_RE = re.compile(
    r"(?i)\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+"
    r"(?:com|net|org|io|co|xyz|top|shop|site|online|live|app|dev|me|ru|cn|de|uk|info|biz|link|click|to|ly|gg|tv|example)"
    r"(?:/\S*)?"
)
_FENCE_RE = re.compile(r"(?i)untrusted")
_LABEL_RE = re.compile(
    r"(?im)^\s*(?:channel|title|duration|language|instructions|transcript|comments|begin|end)\s*:"
)
_WHITESPACE_RE = re.compile(r"\s+")

_VOTES_RE = re.compile(r"^([\d.,]+)\s*([KMB]?)", re.IGNORECASE)
_VOTE_MULTIPLIER = {"": 1, "k": 1_000, "m": 1_000_000, "b": 1_000_000_000}


def _parse_votes(value: str) -> int:
    """YouTube renders like counts for humans ("1.2K"). Models compare integers
    reliably and display strings badly, so parse here and let a miss be 0."""
    match = _VOTES_RE.match(str(value).strip())
    if not match:
        return 0
    number, suffix = match.groups()
    multiplier = _VOTE_MULTIPLIER[suffix.lower()]
    try:
        if multiplier == 1:
            # An unsuffixed count is thousands-grouped, never decimal: "1,234".
            return int(number.replace(",", "").replace(".", ""))
        return int(float(number.replace(",", ".")) * multiplier)
    except ValueError:
        return 0


def _as_int(value: object) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0


def _sanitize(text: str) -> str:
    """Flatten one comment to a single trusted-shape line.

    Stripping URLs here is the one real security win available: the deck emits
    inline markdown links and a `links` array that render as anchors, and a
    prompt rule alone cannot stop a laundered comment URL. The model cannot
    launder a URL it never saw. Comment links are spam by default anyway.
    """
    text = _CONTROL_RE.sub(" ", text)
    text = _URL_RE.sub("", text)
    text = _BARE_DOMAIN_RE.sub("", text)
    text = _LABEL_RE.sub("", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    if len(text) > _MAX_COMMENT_CHARS:
        text = text[: _MAX_COMMENT_CHARS - 1].rstrip() + "…"
    return text


def _is_worth_sending(text: str) -> bool:
    if len(text) < _MIN_COMMENT_CHARS:
        return False
    if _FENCE_RE.search(text):
        return False
    letters = sum(1 for char in text if char.isalpha())
    return letters >= len(text) * _MIN_LETTER_RATIO


def _clamp_session(session, deadline: float) -> None:
    """The library's first request carries no timeout at all, so a hung socket
    would pin a FastAPI threadpool worker indefinitely. Bound every call it
    makes, and refuse outright once the budget is gone.

    `Session.get` and `Session.post` both route through `Session.request`, so
    shadowing that one method covers every call site including the untimed one.
    """
    bound = session.request

    def guarded(*args, **kwargs):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise CommentsError("comment fetch budget exhausted")
        kwargs["timeout"] = min(_TIMEOUT_SECONDS, remaining)
        return bound(*args, **kwargs)

    session.request = guarded


def _clamp_retries(downloader) -> None:
    """The library retries AJAX failures 5x with a 20s sleep between them. Cut it
    to a single attempt: a bonus signal is not worth two minutes of a deck
    request.

    Checking the signature is the point - if a release re-signs the method we
    skip the patch instead of silently setting a dead attribute and falling back
    to the 400s worst case.
    """
    method = getattr(type(downloader), "ajax_request", None)
    if method is None:
        return
    params = inspect.signature(method).parameters
    if "retries" in params and "sleep" in params:
        downloader.ajax_request = functools.partial(method, downloader, retries=1, sleep=0)


def fetch_top_comments(video_id: str, *, limit: int = _MAX_COMMENTS) -> list[Comment]:
    """Most-liked top-level comments, sanitised and bounded.

    Sorted by popularity rather than recency: community sentiment is what the
    community upvoted, corrections tend to surface in the top few, and popular
    order is roughly stable across re-fetches, which is what makes a stored
    comment list worth storing.

    Raises CommentsError. Returns [] when the video has too few usable comments
    to be worth sending - callers must treat [] and a failure identically.
    """
    deadline = time.monotonic() + _TOTAL_BUDGET_SECONDS

    downloader = YoutubeCommentDownloader()
    _clamp_session(downloader.session, deadline)
    _clamp_retries(downloader)

    kept: list[Comment] = []
    total_chars = 0
    try:
        # `language="en"` so like counts arrive as "1.2K" rather than "1,2 Tsd.".
        stream = downloader.get_comments(video_id, sort_by=SORT_BY_POPULAR, language="en")
        # islice rather than a counter: it bounds how far the generator is ever
        # advanced, and each advance is a potential network round trip.
        for raw in islice(stream, _MAX_RAW_COMMENTS):
            if time.monotonic() >= deadline:
                break
            # Replies are interleaved with their parents and are conversational
            # ("^this", "lol"). Skipping them is mandatory, not cosmetic: one busy
            # thread would otherwise consume the whole budget. The parent's reply
            # count already carries the "this is contested" signal.
            if raw.get("reply"):
                continue
            text = _sanitize(str(raw.get("text") or ""))
            if not _is_worth_sending(text):
                continue
            if total_chars + len(text) > _MAX_TOTAL_CHARS:
                break
            total_chars += len(text)
            kept.append(
                Comment(
                    text=text,
                    likes=_parse_votes(raw.get("votes", "")),
                    replies=_as_int(raw.get("replies")),
                    heart=bool(raw.get("heart")),
                    author=str(raw.get("author") or ""),
                    published=str(raw.get("time") or ""),
                )
            )
            if len(kept) >= limit:
                break
    except Exception as exc:  # noqa: BLE001
        # A partial page is still signal; the caller wanted sentiment, not a
        # complete comment section. With nothing collected there is no signal.
        if not kept:
            raise CommentsError(f"Comment fetch failed: {exc}") from exc

    if len(kept) < _MIN_COMMENTS:
        # Collapses "worthless comment section" into "no comment section", so the
        # deck prompt has exactly one absence path to handle.
        print(f"comments for {video_id}: only {len(kept)} usable, sending none")
        return []
    return kept
