from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

from fastapi import FastAPI, HTTPException
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
        description="Preferred language codes, e.g. ['de', 'en']. Defaults to ['en'].",
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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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


class SlidesResponse(BaseModel):
    video_id: str
    slides_html: str
    transcript: list[TranscriptSnippet]


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
    try:
        slides_html = generate_slides(transcript_text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Slides generation failed: {exc}") from exc

    return SlidesResponse(
        video_id=fetched.video_id,
        slides_html=slides_html,
        transcript=[
            TranscriptSnippet(text=s.text, start=s.start, duration=s.duration)
            for s in fetched.snippets
        ],
    )
