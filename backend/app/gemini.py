from __future__ import annotations

import json
import os
import re
from typing import Any

from google import genai
from google.genai import types

from .prompts import SLIDES_SYSTEM_PROMPT

_MODEL_NAME = "gemini-2.5-flash"


def _build_user_input(channel: str, title: str, duration: str, transcript: str) -> str:
    return (
        f"CHANNEL:    {channel or 'one-shot'}\n"
        f"TITLE:      {title or 'Unknown title'}\n"
        f"DURATION:   {duration or '00:00:00'}\n"
        f"TRANSCRIPT:\n{transcript}"
    )


def _strip_code_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n?", "", t)
        t = re.sub(r"\n?```\s*$", "", t)
    return t.strip()


def generate_slides(
    transcript_text: str,
    *,
    channel: str = "",
    title: str = "",
    duration: str = "",
) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    user_input = _build_user_input(channel, title, duration, transcript_text)

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=_MODEL_NAME,
        contents=user_input,
        config=types.GenerateContentConfig(
            system_instruction=SLIDES_SYSTEM_PROMPT,
            response_mime_type="application/json",
        ),
    )
    raw = _strip_code_fence(response.text or "")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Gemini did not return valid JSON: {exc}\nRaw: {raw[:500]}") from exc

    if not isinstance(data, dict):
        raise RuntimeError(f"Gemini returned non-object JSON: {type(data).__name__}")
    return data
