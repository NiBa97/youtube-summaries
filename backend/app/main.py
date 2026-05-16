from __future__ import annotations

import re
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

load_dotenv()
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

from .gemini import generate_slides
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
        description="Preferred language codes, e.g. ['de', 'en']. Defaults to ['en', 'de'].",
    )


class TranscriptSnippet(BaseModel):
    text: str
    start: float
    duration: float


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


def _fetch_oembed(video_id: str) -> dict[str, str]:
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(url)
            r.raise_for_status()
            data = r.json()
            return {
                "title": str(data.get("title") or ""),
                "author": str(data.get("author_name") or ""),
            }
    except Exception:
        return {"title": "", "author": ""}


def _seconds_to_hms(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/transcript", response_model=TranscriptResponse)
def get_transcript(req: TranscriptRequest) -> TranscriptResponse:
    video_id = extract_video_id(req.url)
    languages = req.languages or ["en", "de"]

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
        description="Preferred transcript language codes. Defaults to ['en', 'de'].",
    )
    title: str | None = Field(default=None, description="Override title fed to LLM")
    channel: str | None = Field(default=None, description="Override channel fed to LLM")


class StatModel(BaseModel):
    value: str
    caption: str


class QuoteModel(BaseModel):
    text: str
    attrib: str


class TimelineItem(BaseModel):
    year: str
    label: str


class SummaryModel(BaseModel):
    keypoints: list[str]
    stat: StatModel | None = None
    quote: QuoteModel | None = None
    timeline: list[TimelineItem] | None = None


class SlidesResponse(BaseModel):
    video_id: str
    title: str
    tldr: str
    channel: str
    duration: int
    summary: SummaryModel
    transcript: list[TranscriptSnippet]


def _coerce_summary(raw: dict[str, Any]) -> SummaryModel:
    s = raw.get("summary") or {}
    keypoints = s.get("keypoints") or []
    if not isinstance(keypoints, list) or not keypoints:
        raise HTTPException(status_code=502, detail="LLM returned no keypoints")

    stat_raw = s.get("stat")
    quote_raw = s.get("quote")
    tl_raw = s.get("timeline")

    return SummaryModel(
        keypoints=[str(x) for x in keypoints],
        stat=StatModel(**stat_raw) if isinstance(stat_raw, dict) else None,
        quote=QuoteModel(**quote_raw) if isinstance(quote_raw, dict) else None,
        timeline=[TimelineItem(**x) for x in tl_raw] if isinstance(tl_raw, list) and tl_raw else None,
    )


@app.post("/slides", response_model=SlidesResponse)
def post_slides(req: SlidesRequest) -> SlidesResponse:
    video_id = extract_video_id(req.url)
    languages = req.languages or ["en", "de"]

    api = YouTubeTranscriptApi()
    try:
        fetched = api.fetch(video_id, languages=languages)
    except (TranscriptsDisabled, NoTranscriptFound) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except VideoUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Transcript fetch failed: {exc}") from exc

    meta = _fetch_oembed(video_id)
    title_in = req.title or meta["title"]
    channel_in = req.channel or meta["author"]

    duration_sec = 0
    if fetched.snippets:
        last = fetched.snippets[-1]
        duration_sec = int(last.start + last.duration)

    transcript_text = format_snippets_for_llm(fetched.snippets)
    try:
        raw = generate_slides(
            transcript_text,
            channel=channel_in,
            title=title_in,
            duration=_seconds_to_hms(duration_sec),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Slides generation failed: {exc}") from exc

    summary = _coerce_summary(raw)

    return SlidesResponse(
        video_id=fetched.video_id,
        title=str(raw.get("title") or title_in or "Untitled"),
        tldr=str(raw.get("tldr") or ""),
        channel=channel_in,
        duration=duration_sec,
        summary=summary,
        transcript=[
            TranscriptSnippet(text=s.text, start=s.start, duration=s.duration)
            for s in fetched.snippets
        ],
    )
