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

from .gemini import generate_deck
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
    source_start: int | None = None
    links: list[BlockLink] | None = None


class ListBlock(BaseModel):
    type: Literal["list"]
    eyebrow: str | None = None
    title: str
    source_start: int | None = None
    links: list[BlockLink] | None = None
    items: list[str] = Field(..., min_length=2, max_length=5)


class MetricBlock(BaseModel):
    type: Literal["metric"]
    eyebrow: str | None = None
    value: str
    label: str
    body: str | None = None
    source_start: int | None = None
    links: list[BlockLink] | None = None


class QuoteBlock(BaseModel):
    type: Literal["quote"]
    eyebrow: str | None = None
    text: str
    attribution: str
    source_start: int | None = None
    links: list[BlockLink] | None = None


class TimelineBlock(BaseModel):
    type: Literal["timeline"]
    eyebrow: str | None = None
    title: str
    source_start: int | None = None
    links: list[BlockLink] | None = None
    items: list[TimelineBlockItem] = Field(..., min_length=3, max_length=6)


DeckBlock = ClaimBlock | ListBlock | MetricBlock | QuoteBlock | TimelineBlock


class Deck(BaseModel):
    title: str
    tldr: str
    blocks: list[DeckBlock] = Field(..., min_length=1, max_length=7)

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


class TranscriptResponse(BaseModel):
    video_id: str
    language: str
    language_code: str
    is_generated: bool
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


@app.post("/transcript", response_model=TranscriptResponse)
def get_transcript(req: TranscriptRequest) -> TranscriptResponse:
    video_id = extract_video_id(req.url)
    languages = req.languages or ["en"]

    api = YouTubeTranscriptApi()
    try:
        fetched = api.fetch(video_id, languages=languages)
    except (TranscriptsDisabled, NoTranscriptFound) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except VideoUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Transcript fetch failed: {exc}") from exc

    return TranscriptResponse(
        video_id=fetched.video_id,
        language=fetched.language,
        language_code=fetched.language_code,
        is_generated=fetched.is_generated,
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


class SlidesResponse(BaseModel):
    video_id: str
    deck: Deck
    duration_seconds: int
    transcript: list[TranscriptSnippet]


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

    api = YouTubeTranscriptApi()
    try:
        fetched = api.fetch(video_id, languages=languages)
    except (TranscriptsDisabled, NoTranscriptFound) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except VideoUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Transcript fetch failed: {exc}") from exc

    transcript_text = format_snippets_for_llm(fetched.snippets)
    duration_s = _duration_seconds(fetched.snippets)
    try:
        raw_deck = generate_deck(
            channel=req.channel or "one-shot",
            title=req.title or f"YouTube {video_id}",
            duration=_fmt_duration(duration_s),
            transcript_text=transcript_text,
            instructions=req.instructions,
            validate=_deck_validation_error,
        )
        deck = Deck.model_validate(raw_deck)
    except ValidationError as exc:
        detail = _deck_validation_error(raw_deck) or str(exc)
        raise HTTPException(status_code=502, detail=f"Deck generation failed: {detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Deck generation failed: {exc}") from exc

    return SlidesResponse(
        video_id=fetched.video_id,
        deck=deck,
        duration_seconds=duration_s,
        transcript=[
            TranscriptSnippet(text=s.text, start=s.start, duration=s.duration)
            for s in fetched.snippets
        ],
    )
