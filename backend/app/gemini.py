from __future__ import annotations

import json
import os
import re
from collections.abc import Callable
from typing import Any

from google import genai
from google.genai import types

from .prompts import DECK_SYSTEM_PROMPT

_MODEL_NAME = "gemini-2.5-flash"

# One generation plus this many correction rounds before giving up.
_MAX_REPAIR_ATTEMPTS = 2
_MAX_ECHOED_ATTEMPT_CHARS = 8000

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def _strip_fences(text: str) -> str:
    s = text.strip()
    if s.startswith("```"):
        s = _FENCE_RE.sub("", s).strip()
    return s


def _repair_prompt(user_input: str, previous: str, errors: str) -> str:
    return (
        f"{user_input}\n"
        "# PREVIOUS ATTEMPT (REJECTED)\n"
        f"{previous[:_MAX_ECHOED_ATTEMPT_CHARS]}\n\n"
        "# VALIDATION ERRORS\n"
        f"{errors}\n\n"
        "Return a corrected JSON object that fixes every error listed above and "
        "still obeys the system prompt, including the block count and length "
        "budgets. Keep the content that was already valid. Output JSON only.\n"
    )


def generate_deck(
    *,
    channel: str,
    title: str,
    duration: str,
    transcript_text: str,
    instructions: str | None = None,
    validate: Callable[[dict[str, Any]], str | None] | None = None,
) -> dict[str, Any]:
    """Generate a deck. If `validate` returns an error string, re-prompt the
    model with those errors and let it correct itself."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    instruction_line = ""
    if instructions and instructions.strip():
        instruction_line = f"INSTRUCTIONS: {instructions.strip()}\n"

    user_input = (
        f"CHANNEL:      {channel}\n"
        f"TITLE:        {title}\n"
        f"DURATION:     {duration}\n"
        f"{instruction_line}"
        f"TRANSCRIPT:\n{transcript_text}\n"
    )

    client = genai.Client(api_key=api_key)
    config = types.GenerateContentConfig(
        system_instruction=DECK_SYSTEM_PROMPT,
        response_mime_type="application/json",
    )

    contents = user_input
    last_error = ""
    for attempt in range(_MAX_REPAIR_ATTEMPTS + 1):
        response = client.models.generate_content(
            model=_MODEL_NAME,
            contents=contents,
            config=config,
        )
        raw = _strip_fences(response.text or "")

        try:
            deck = json.loads(raw)
        except json.JSONDecodeError as exc:
            last_error = f"Output was not valid JSON: {exc}"
        else:
            if not isinstance(deck, dict):
                last_error = f"Top level must be a JSON object, got {type(deck).__name__}"
            else:
                error = validate(deck) if validate is not None else None
                if error is None:
                    return deck
                last_error = error

        if attempt < _MAX_REPAIR_ATTEMPTS:
            contents = _repair_prompt(user_input, raw, last_error)

    raise RuntimeError(
        f"Gemini output still invalid after {_MAX_REPAIR_ATTEMPTS} correction rounds: {last_error}"
    )
