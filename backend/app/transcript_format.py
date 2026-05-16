from __future__ import annotations

from typing import Iterable, Protocol


class _HasTextStart(Protocol):
    text: str
    start: float


def format_snippets_for_llm(snippets: Iterable[_HasTextStart]) -> str:
    return "\n".join(f"[{int(s.start)}] {s.text}" for s in snippets)
