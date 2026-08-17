from __future__ import annotations

import math
import re
from typing import Any, Literal
from urllib.parse import parse_qs, urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

from .comment_format import format_comments_for_llm
from .comments import Comment, CommentsError, fetch_top_comments
from .gemini import NO_TOPIC, classify_video, generate_community, generate_deck
from .link_preview import LinkPreviewError, fetch_preview
from .transcript_format import format_snippets_for_llm

app = FastAPI(title="Youtube Summaries Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TranscriptRequest(BaseModel):
    url: str = Field(..., description="Full YouTube URL or bare 11-char video id")
    languages: list[str] | None = Field(
        default=None,
        description="Preferred language codes, e.g. ['de', 'en']. Defaults to ['en'].",
    )


class TranscriptSnippet(BaseModel):
    text: str
    start: float
    duration: float


class VideoComment(BaseModel):
    text: str
    likes: int
    replies: int
    heart: bool
    author: str
    published: str


class TimelineBlockItem(BaseModel):
    marker: str
    text: str


class BlockLink(BaseModel):
    title: str
    url: str
    publisher: str | None = None


class ClaimBlock(BaseModel):
    type: Literal["claim"]
    eyebrow: str | None = None
    title: str
    body: str
    caveat: str | None = None
    source_start: int | None = None
    links: list[BlockLink] | None = None


class ListBlock(BaseModel):
    type: Literal["list"]
    eyebrow: str | None = None
    title: str
    caveat: str | None = None
    source_start: int | None = None
    links: list[BlockLink] | None = None
    items: list[str] = Field(..., min_length=2, max_length=5)


class MetricBlock(BaseModel):
    type: Literal["metric"]
    eyebrow: str | None = None
    value: str
    label: str
    body: str | None = None
    caveat: str | None = None
    source_start: int | None = None
    links: list[BlockLink] | None = None


class QuoteBlock(BaseModel):
    type: Literal["quote"]
    eyebrow: str | None = None
    text: str
    attribution: str
    caveat: str | None = None
    source_start: int | None = None
    links: list[BlockLink] | None = None


class TimelineBlock(BaseModel):
    type: Literal["timeline"]
    eyebrow: str | None = None
    title: str
    caveat: str | None = None
    source_start: int | None = None
    links: list[BlockLink] | None = None
    items: list[TimelineBlockItem] = Field(..., min_length=3, max_length=6)


DeckBlock = ClaimBlock | ListBlock | MetricBlock | QuoteBlock | TimelineBlock


class CommunityNote(BaseModel):
    text: str
    quote: str | None = None


class Community(BaseModel):
    """What the comment section adds, when it adds anything.

    Deliberately not a block type: the block union stays at five variants and
    this renders as one section after them.
    """

    sentiment: Literal["supportive", "mixed", "critical"]
    summary: str
    notes: list[CommunityNote] = Field(default_factory=list, max_length=4)


class Deck(BaseModel):
    title: str
    tldr: str
    blocks: list[DeckBlock] = Field(..., min_length=1, max_length=7)
    community: Community | None = None

_BLOCK_VARIANT_BY_TYPE = {
    "claim": "ClaimBlock",
    "list": "ListBlock",
    "metric": "MetricBlock",
    "quote": "QuoteBlock",
    "timeline": "TimelineBlock",
}
_MAX_REPORTED_ERRORS = 8


def _deck_validation_error(payload: dict[str, Any]) -> str | None:
    """Validate a raw deck dict, returning a compact error report or None.

    Pydantic reports a failing block against every union member, so a single
    mistake yields ~15 errors. Keep only the ones for the variant the block
    actually declared.
    """
    try:
        Deck.model_validate(payload)
    except ValidationError as exc:
        blocks = payload.get("blocks")
        lines: list[str] = []
        for err in exc.errors():
            loc = err["loc"]
            if (
                len(loc) >= 3
                and loc[0] == "blocks"
                and isinstance(loc[1], int)
                and isinstance(loc[2], str)
                and loc[2].endswith("Block")
                and isinstance(blocks, list)
                and 0 <= loc[1] < len(blocks)
                and isinstance(blocks[loc[1]], dict)
            ):
                expected = _BLOCK_VARIANT_BY_TYPE.get(blocks[loc[1]].get("type"))
                if expected is not None and loc[2] != expected:
                    continue
            line = f"{'.'.join(str(part) for part in loc)}: {err['msg']}"
            if line not in lines:
                lines.append(line)
        if not lines:
            lines = [str(exc)]
        report = "\n".join(lines[:_MAX_REPORTED_ERRORS])
        if len(lines) > _MAX_REPORTED_ERRORS:
            report += f"\n(+{len(lines) - _MAX_REPORTED_ERRORS} more)"
        return report
    return None


_MIN_VERIFIABLE_QUOTE_CHARS = 12
_WS_RE = re.compile(r"\s+")


def _normalized(text: str) -> str:
    return _WS_RE.sub(" ", text).strip().casefold()


def _drop_unverifiable_quotes(deck: Deck, comments: list[Comment]) -> None:
    """Delete any community quote that is not verbatim in the fetched comments.

    Enforced by deletion rather than by a validation error on purpose. The reader
    is protected either way and `note.text` already carries the point, whereas
    routing this through `_deck_validation_error` would spend one of only two
    repair rounds - or fail an otherwise good deck with a 502 - over a decoration.

    Matched against the comment texts rather than the formatted lines, which is
    stricter: a quote that swallowed a "[c07 likes=...]" prefix is not a quote.
    """
    if deck.community is None:
        return
    corpus = _normalized("\n".join(c.text for c in comments))
    for index, note in enumerate(deck.community.notes):
        quote = note.quote
        if not quote or len(quote.strip()) < _MIN_VERIFIABLE_QUOTE_CHARS:
            continue
        if _normalized(quote) not in corpus:
            print(f"dropped unverifiable community quote {index}: {quote[:80]!r}")
            note.quote = None


class VocabularyTag(BaseModel):
    name: str
    count: int = 0


class Vocabulary(BaseModel):
    """The library's controlled vocabulary, sent by the client on every call.

    `tags` must be sorted most-used first - the ordering is what biases the model
    toward reusing what already exists instead of minting near-duplicates.
    """

    topics: list[str] = Field(default_factory=list)
    tags: list[VocabularyTag] = Field(default_factory=list)


class TagSuggestion(BaseModel):
    name: str
    confidence: float


class Classification(BaseModel):
    topic: str | None = None
    topic_confidence: float = 0.0
    tags: list[TagSuggestion] = Field(default_factory=list)
    new_tags: list[TagSuggestion] = Field(default_factory=list)


def normalize_tag(name: str) -> str:
    """Collapsed identity key. Mirrors `norm` in the Pocketbase `tags` collection
    and `normalizeTag()` in the frontend - keep all three in sync."""
    return re.sub(r"[\s_-]+", "", name.strip().lower())


def _clamp(value: float) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def _reconcile(raw: dict, vocab: Vocabulary) -> Classification:
    """Force the model's output back onto the real vocabulary.

    The topic enum is enforced by the response schema, but free-form tags leak
    out-of-vocabulary names anyway, so every returned tag is matched by norm
    against the tag table: a hit becomes the canonical existing tag, a miss is
    demoted to a proposal that needs an explicit click.
    """
    canonical = {normalize_tag(t.name): t.name for t in vocab.tags}
    topic_by_norm = {normalize_tag(t): t for t in vocab.topics}

    topic_raw = str(raw.get("topic") or "").strip()
    topic = None if topic_raw in ("", NO_TOPIC) else topic_by_norm.get(normalize_tag(topic_raw))

    existing: dict[str, TagSuggestion] = {}
    proposed: dict[str, TagSuggestion] = {}

    def absorb(items: object) -> None:
        if not isinstance(items, list):
            return
        for item in items:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            norm = normalize_tag(name)
            if not norm or norm in topic_by_norm:
                continue  # never shadow a Topic with a same-named tag
            conf = _clamp(item.get("confidence", 0))
            if norm in canonical:
                existing.setdefault(norm, TagSuggestion(name=canonical[norm], confidence=conf))
            else:
                proposed.setdefault(norm, TagSuggestion(name=name.lower(), confidence=conf))

    absorb(raw.get("tags"))
    absorb(raw.get("new_tags"))

    by_conf = lambda s: -s.confidence  # noqa: E731
    return Classification(
        topic=topic,
        topic_confidence=_clamp(raw.get("topic_confidence", 0)) if topic else 0.0,
        tags=sorted(existing.values(), key=by_conf),
        new_tags=sorted(proposed.values(), key=by_conf),
    )


class ClassifyRequest(BaseModel):
    title: str = ""
    tldr: str = ""
    body: str = Field(default="", description="Deck text or transcript excerpt to classify from")
    vocabulary: Vocabulary = Field(default_factory=Vocabulary)


def _block_text(block: "DeckBlock") -> str:
    """One block flattened to a line of prose.

    Reads only named content fields, which is what keeps `caveat` out of every
    caller by construction - see `_deck_body`. Do not turn this into a generic
    dump of the block.
    """
    if block.type == "claim":
        return f"{block.title}. {block.body}"
    if block.type == "list":
        return f"{block.title}. " + " ".join(block.items)
    if block.type == "metric":
        return f"{block.value} {block.label}. {block.body or ''}"
    if block.type == "quote":
        return f'"{block.text}" - {block.attribution}'
    return f"{block.title}. " + " ".join(i.text for i in block.items)


def _deck_body(deck: "Deck") -> str:
    """Classify from the deck rather than the transcript: it is already the
    distilled subject matter, and it is ~100x cheaper to send.

    Community text and block caveats are deliberately excluded. They originate in
    public comments, and `new_tags` reaches the tag table on one click - a
    redundant tag splits the vocabulary permanently, so the librarian is never fed
    attacker-controlled text.
    """
    return "\n".join(_block_text(block) for block in deck.blocks)


def _deck_for_rerun(deck: "Deck") -> str:
    """A rejected deck, flattened for the deck prompt on a re-run.

    Goes through `_block_text` like every other reader of a deck, so the
    community section and block caveats - which originate in public comments -
    never re-enter the generation prompt. Comment text stays on the one narrow
    path it is allowed on.
    """
    return f"{deck.title}\n{deck.tldr}\n" + _deck_body(deck)


def _deck_listing(deck: "Deck") -> str:
    """The deck as numbered lines, so a caveat can name the block it qualifies."""
    return "\n".join(f"[b{i:02d}] {_block_text(b)}" for i, b in enumerate(deck.blocks, start=1))


def _classify(req: ClassifyRequest) -> Classification:
    raw = classify_video(
        title=req.title,
        tldr=req.tldr,
        body=req.body,
        topics=req.vocabulary.topics,
        tags=[(t.name, t.count) for t in req.vocabulary.tags],
    )
    return _reconcile(raw, req.vocabulary)


class TranscriptResponse(BaseModel):
    video_id: str
    language: str
    language_code: str
    is_generated: bool
    language_fallback: bool = False
    snippets: list[TranscriptSnippet]


_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def extract_video_id(value: str) -> str:
    value = value.strip()
    if _VIDEO_ID_RE.match(value):
        return value

    parsed = urlparse(value)
    if parsed.hostname in {"youtu.be"}:
        vid = parsed.path.lstrip("/")
        if _VIDEO_ID_RE.match(vid):
            return vid
    if parsed.hostname and "youtube.com" in parsed.hostname:
        if parsed.path == "/watch":
            vid = parse_qs(parsed.query).get("v", [""])[0]
            if _VIDEO_ID_RE.match(vid):
                return vid
        for prefix in ("/embed/", "/shorts/", "/v/"):
            if parsed.path.startswith(prefix):
                vid = parsed.path[len(prefix):].split("/")[0]
                if _VIDEO_ID_RE.match(vid):
                    return vid

    raise HTTPException(status_code=400, detail=f"Could not extract video id from: {value!r}")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


class LinkPreviewResponse(BaseModel):
    url: str
    site: str
    title: str | None = None
    description: str | None = None
    image: str | None = None


@app.get("/link-preview", response_model=LinkPreviewResponse)
def link_preview(url: str) -> LinkPreviewResponse:
    try:
        preview = fetch_preview(url)
    except LinkPreviewError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return LinkPreviewResponse(
        url=preview.url,
        site=preview.site,
        title=preview.title,
        description=preview.description,
        image=preview.image,
    )


def _fetch_transcript(video_id: str, languages: list[str]) -> tuple[Any, bool]:
    """Fetch a transcript in one of `languages`, else fall back to whatever the
    video actually has. Returns (fetched, used_fallback).

    Many videos carry no English track at all; failing there was the main cause
    of add-video errors. Prefer a human-made track over an auto-generated one.
    """
    api = YouTubeTranscriptApi()
    try:
        try:
            return api.fetch(video_id, languages=languages), False
        except NoTranscriptFound:
            available = list(api.list(video_id))
            if not available:
                raise
            chosen = next((t for t in available if not t.is_generated), available[0])
            return chosen.fetch(), True
    except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Transcript fetch failed: {exc}") from exc


@app.post("/transcript", response_model=TranscriptResponse)
def get_transcript(req: TranscriptRequest) -> TranscriptResponse:
    video_id = extract_video_id(req.url)
    languages = req.languages or ["en"]

    fetched, used_fallback = _fetch_transcript(video_id, languages)

    return TranscriptResponse(
        video_id=fetched.video_id,
        language=fetched.language,
        language_code=fetched.language_code,
        is_generated=fetched.is_generated,
        language_fallback=used_fallback,
        snippets=[
            TranscriptSnippet(text=s.text, start=s.start, duration=s.duration)
            for s in fetched.snippets
        ],
    )


class SlidesRequest(BaseModel):
    url: str = Field(..., description="Full YouTube URL or bare 11-char video id")
    languages: list[str] | None = Field(
        default=None,
        description="Preferred transcript language codes. Defaults to ['en'].",
    )
    channel: str | None = Field(default=None, description="Channel name, or 'one-shot' if user import")
    title: str | None = Field(default=None, description="Original video title (if known)")
    instructions: str | None = Field(
        default=None,
        max_length=1000,
        description="Short custom directive appended to the deck prompt, e.g. 'name every card mentioned'",
    )
    previous_deck: Deck | None = Field(
        default=None,
        description="A deck of this video the reader rejected. Sent on a re-run so "
                    "the new deck goes somewhere else instead of repeating it.",
    )
    vocabulary: Vocabulary | None = Field(
        default=None,
        description="Existing topics and tags. Omit to skip auto-classification.",
    )


class SlidesResponse(BaseModel):
    video_id: str
    deck: Deck
    duration_seconds: int
    language: str
    language_code: str
    is_generated: bool
    language_fallback: bool = False
    transcript: list[TranscriptSnippet]
    classification: Classification | None = None


def _video_comment(comment: Comment) -> VideoComment:
    return VideoComment(
        text=comment.text,
        likes=comment.likes,
        replies=comment.replies,
        heart=comment.heart,
        author=comment.author,
        published=comment.published,
    )


class CommentsResponse(BaseModel):
    video_id: str
    count: int
    comments: list[VideoComment]


class CommunityRequest(BaseModel):
    url: str = Field(..., description="Full YouTube URL or bare 11-char video id")
    deck: Deck = Field(..., description="The already-generated deck to read the comments against")


class CommunityResponse(BaseModel):
    video_id: str
    deck: Deck
    comments: list[VideoComment]


_MAX_CAVEATS = 2


def _apply_community(deck: Deck, result: dict[str, Any], comments: list[Comment]) -> None:
    """Fold a community result into the deck it was generated for.

    Merging here rather than in the browser keeps the one fiddly step - mapping a
    caveat's block number onto a block - in tested Python, and means the frontend
    only has to store what it gets back.
    """
    deck.community = None
    for block in deck.blocks:
        block.caveat = None

    raw_community = result.get("community")
    if isinstance(raw_community, dict):
        deck.community = Community.model_validate(raw_community)
        _drop_unverifiable_quotes(deck, comments)

    raw_caveats = result.get("caveats")
    if not isinstance(raw_caveats, list):
        return
    applied = 0
    for entry in raw_caveats:
        if applied >= _MAX_CAVEATS or not isinstance(entry, dict):
            continue
        text = entry.get("text")
        number = entry.get("block")
        if not isinstance(text, str) or not text.strip() or not isinstance(number, int):
            continue
        # The model is told to number from the listing it was given; an index it
        # invented has nothing to attach to, so drop it rather than guess.
        if not 1 <= number <= len(deck.blocks):
            print(f"dropped caveat for out-of-range block {number}")
            continue
        deck.blocks[number - 1].caveat = text.strip()
        applied += 1


@app.post("/community", response_model=CommunityResponse)
def post_community(req: CommunityRequest) -> CommunityResponse:
    """Read a video's comments against an existing deck, on demand.

    Deliberately not part of /slides. The scrape reads YouTube's internals and
    adds seconds to a request, while most comment sections have nothing worth
    reporting - so this is paid for only when the reader asks for it, and unlike
    the rest of the pipeline it fails loudly, because someone is waiting on it.
    """
    video_id = extract_video_id(req.url)

    try:
        comments = fetch_top_comments(video_id)
    except CommentsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Comment fetch failed: {exc}") from exc

    deck = req.deck
    if not comments:
        # Not an error: the comment section was disabled, empty, or too thin to
        # be worth a model call. Answer with an unchanged deck.
        _apply_community(deck, {}, comments)
        return CommunityResponse(video_id=video_id, deck=deck, comments=[])

    try:
        result = generate_community(
            title=deck.title,
            tldr=deck.tldr,
            deck_text=_deck_listing(deck),
            comments_text=format_comments_for_llm(comments),
        )
        _apply_community(deck, result, comments)
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail=f"Community read failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Community read failed: {exc}") from exc

    return CommunityResponse(
        video_id=video_id,
        deck=deck,
        comments=[_video_comment(c) for c in comments],
    )


@app.get("/comments", response_model=CommentsResponse)
def get_comments(url: str) -> CommentsResponse:
    """Diagnostic sibling of the silent comment fetch inside /slides.

    The scraper reads YouTube's internals, so it will eventually break, and
    /slides swallows that by design. This is where you find out - so unlike
    /slides it fails loudly.
    """
    video_id = extract_video_id(url)
    try:
        comments = fetch_top_comments(video_id)
    except CommentsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return CommentsResponse(
        video_id=video_id,
        count=len(comments),
        comments=[_video_comment(c) for c in comments],
    )


def _fmt_duration(seconds: float) -> str:
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    if h > 0:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m}:{sec:02d}"


def _duration_seconds(snippets) -> int:
    if not snippets:
        return 0
    return math.ceil(max(s.start + s.duration for s in snippets))

@app.post("/slides", response_model=SlidesResponse)
def post_slides(req: SlidesRequest) -> SlidesResponse:
    video_id = extract_video_id(req.url)
    languages = req.languages or ["en"]

    fetched, used_fallback = _fetch_transcript(video_id, languages)

    transcript_text = format_snippets_for_llm(fetched.snippets)
    duration_s = _duration_seconds(fetched.snippets)

    try:
        raw_deck = generate_deck(
            channel=req.channel or "one-shot",
            title=req.title or f"YouTube {video_id}",
            duration=_fmt_duration(duration_s),
            transcript_text=transcript_text,
            transcript_language=fetched.language,
            instructions=req.instructions,
            previous_deck=_deck_for_rerun(req.previous_deck) if req.previous_deck else None,
            validate=_deck_validation_error,
        )
        deck = Deck.model_validate(raw_deck)
    except ValidationError as exc:
        detail = _deck_validation_error(raw_deck) or str(exc)
        raise HTTPException(status_code=502, detail=f"Deck generation failed: {detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Deck generation failed: {exc}") from exc

    classification: Classification | None = None
    if req.vocabulary is not None:
        # A failed classification must not cost the user their deck - they can
        # always tag by hand.
        try:
            classification = _classify(ClassifyRequest(
                title=deck.title,
                tldr=deck.tldr,
                body=_deck_body(deck),
                vocabulary=req.vocabulary,
            ))
        except Exception as exc:  # noqa: BLE001
            print(f"classification failed for {video_id}: {exc}")

    return SlidesResponse(
        video_id=fetched.video_id,
        deck=deck,
        duration_seconds=duration_s,
        language=fetched.language,
        language_code=fetched.language_code,
        is_generated=fetched.is_generated,
        language_fallback=used_fallback,
        transcript=[
            TranscriptSnippet(text=s.text, start=s.start, duration=s.duration)
            for s in fetched.snippets
        ],
        classification=classification,
    )


@app.post("/classify", response_model=Classification)
def post_classify(req: ClassifyRequest) -> Classification:
    """Standalone classification, used by the backfill script and by re-tagging
    an already-imported video."""
    try:
        return _classify(req)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Classification failed: {exc}") from exc
