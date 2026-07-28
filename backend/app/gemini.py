from __future__ import annotations

import json
import os
import re
from collections.abc import Callable
from typing import Any

from google import genai
from google.genai import types

from .prompts import CLASSIFY_SYSTEM_PROMPT, DECK_SYSTEM_PROMPT, VOCABULARY_SYSTEM_PROMPT

_MODEL_NAME = "gemini-2.5-flash"

# One generation plus this many correction rounds before giving up.
_MAX_REPAIR_ATTEMPTS = 2
_MAX_ECHOED_ATTEMPT_CHARS = 8000

NO_TOPIC = "__none__"

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
    transcript_language: str | None = None,
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

    language_line = ""
    if transcript_language and transcript_language.strip():
        language_line = f"LANGUAGE:     {transcript_language.strip()}\n"

    user_input = (
        f"CHANNEL:      {channel}\n"
        f"TITLE:        {title}\n"
        f"DURATION:     {duration}\n"
        f"{language_line}"
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
def propose_vocabulary(*, corpus: str) -> dict[str, Any]:
    """One-off: look at the whole library and propose the shelving for it.

    Deliberately not exposed over HTTP - it runs from a script whose output you
    read and edit before anything reaches the database.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=_MODEL_NAME,
        contents=corpus,
        config=types.GenerateContentConfig(
            system_instruction=VOCABULARY_SYSTEM_PROMPT,
            response_mime_type="application/json",
        ),
    )
    raw = _strip_fences(response.text or "")
    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Gemini did not return valid JSON: {exc}; raw={raw[:500]!r}") from exc
    if not isinstance(result, dict):
        raise RuntimeError(f"Gemini returned non-object JSON: {type(result).__name__}")
    return result


def _tag_array_schema() -> types.Schema:
    return types.Schema(
        type=types.Type.ARRAY,
        items=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "name": types.Schema(type=types.Type.STRING),
                "confidence": types.Schema(type=types.Type.NUMBER),
            },
            required=["name", "confidence"],
        ),
    )


def _classify_schema(topics: list[str]) -> types.Schema:
    """Topic is an enum, so the model cannot invent a shelf. Tags are free-form
    and must be intersected against the tag table by the caller."""
    properties: dict[str, types.Schema] = {
        "tags": _tag_array_schema(),
        "new_tags": _tag_array_schema(),
    }
    required = ["tags", "new_tags"]
    if topics:
        properties["topic"] = types.Schema(type=types.Type.STRING, enum=[*topics, NO_TOPIC])
        properties["topic_confidence"] = types.Schema(type=types.Type.NUMBER)
        required = ["topic", "topic_confidence", *required]
    return types.Schema(type=types.Type.OBJECT, properties=properties, required=required)


def classify_video(
    *,
    title: str,
    tldr: str,
    body: str,
    topics: list[str],
    tags: list[tuple[str, int]],
) -> dict[str, Any]:
    """Classify one video against the existing vocabulary.

    `tags` is (name, usage count) sorted most-used first by the caller; the order
    is load-bearing - it is what biases the model toward reuse.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    topic_list = "\n".join(f"  - {t}" for t in topics) if topics else "  (none defined yet)"
    tag_list = "  " + "  ".join(f"{n}x{c}" for n, c in tags) if tags else "  (none defined yet)"

    user_input = (
        f"TOPICS:\n{topic_list}\n\n"
        f"EXISTING TAGS (sorted by usage, most-used first):\n{tag_list}\n\n"
        f"---\n"
        f"TITLE: {title}\n"
        f"TLDR:  {tldr}\n"
        f"CONTENT:\n{body}\n"
    )

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=_MODEL_NAME,
        contents=user_input,
        config=types.GenerateContentConfig(
            system_instruction=CLASSIFY_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=_classify_schema(topics),
        ),
    )
    raw = _strip_fences(response.text or "")
    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Gemini did not return valid JSON: {exc}; raw={raw[:500]!r}") from exc
    if not isinstance(result, dict):
        raise RuntimeError(f"Gemini returned non-object JSON: {type(result).__name__}")
    return result
