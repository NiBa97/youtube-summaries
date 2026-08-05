from __future__ import annotations

import re
from typing import Iterable, Protocol

_WHITESPACE_RE = re.compile(r"\s+")


class _HasCommentFields(Protocol):
    text: str
    likes: int
    replies: int
    heart: bool


def format_comments_for_llm(comments: Iterable[_HasCommentFields]) -> str:
    """One comment per line, most-liked first.

    One line each is a structural defence, not a style choice: no comment can
    introduce a line that starts at column 0, so nothing inside the block can
    impersonate a prompt label or a fence. Whitespace is collapsed here and not
    only in the scraper's sanitiser, because that invariant has to hold for
    comments read back from storage too. Author names are deliberately absent -
    they are attacker-controlled, add nothing to the deck, and the deck must not
    name private individuals.

    Metadata is spelled `key=value` rather than as sigils so the model cannot
    misread it as content, and carries no emoji: the deck prompt bans emoji in
    output and should not see any in input either.
    """
    lines: list[str] = []
    for index, comment in enumerate(comments, start=1):
        meta = [f"c{index:02d}", f"likes={comment.likes}"]
        if comment.replies:
            meta.append(f"replies={comment.replies}")
        if comment.heart:
            meta.append("creator-hearted")
        text = _WHITESPACE_RE.sub(" ", comment.text).strip()
        lines.append(f"[{' '.join(meta)}] {text}")
    return "\n".join(lines)
