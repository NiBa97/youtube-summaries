from __future__ import annotations

import os

from google import genai
from google.genai import types

from .prompts import SLIDES_SYSTEM_PROMPT

_MODEL_NAME = "gemini-2.5-flash"


def generate_slides(transcript_text: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=_MODEL_NAME,
        contents=transcript_text,
        config=types.GenerateContentConfig(system_instruction=SLIDES_SYSTEM_PROMPT),
    )
    return response.text
