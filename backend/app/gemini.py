from __future__ import annotations

import json
import os
import re
from typing import Any

from google import genai
from google.genai import types

from .prompts import DECK_SYSTEM_PROMPT

_MODEL_NAME = "gemini-2.5-flash"

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def _strip_fences(text: str) -> str:
    s = text.strip()
    if s.startswith("```"):
        s = _FENCE_RE.sub("", s).strip()
    return s


def generate_deck(*, channel: str, title: str, duration: str, transcript_text: str) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    user_input = (
        f"CHANNEL:    {channel}\n"
        f"TITLE:      {title}\n"
        f"DURATION:   {duration}\n"
        f"TRANSCRIPT:\n{transcript_text}\n"
    )

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=_MODEL_NAME,
        contents=user_input,
        config=types.GenerateContentConfig(
            system_instruction=DECK_SYSTEM_PROMPT,
            response_mime_type="application/json",
        ),
    )
    raw = _strip_fences(response.text or "")
    try:
        deck = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Gemini did not return valid JSON: {exc}; raw={raw[:500]!r}") from exc
    if not isinstance(deck, dict):
        raise RuntimeError(f"Gemini returned non-object JSON: {type(deck).__name__}")
    return deck
