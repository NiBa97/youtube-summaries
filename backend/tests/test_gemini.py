from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.gemini import generate_deck
from app.main import _deck_validation_error

VALID_DECK = {
    "title": "Title",
    "tldr": "Short summary",
    "blocks": [{"type": "claim", "title": "t", "body": "b"}],
}


class _FakeClient:
    """Returns each queued response text in turn, recording the prompts."""

    def __init__(self, texts):
        self._texts = list(texts)
        self.prompts: list[str] = []
        self.models = SimpleNamespace(generate_content=self._generate)

    def _generate(self, *, model, contents, config):
        self.prompts.append(contents)
        return SimpleNamespace(text=self._texts.pop(0))


def _run(texts, **kwargs):
    fake = _FakeClient(texts)
    with patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}), \
            patch("app.gemini.genai.Client", return_value=fake):
        return fake, generate_deck(
            channel="one-shot",
            title="T",
            duration="0:06",
            transcript_text="[0] hello",
            **kwargs,
        )


def test_instructions_included_in_prompt():
    fake, deck = _run([json.dumps(VALID_DECK)], instructions="Name every card")
    assert deck == VALID_DECK
    assert "INSTRUCTIONS: Name every card" in fake.prompts[0]


def test_instructions_omitted_when_blank():
    fake, _ = _run([json.dumps(VALID_DECK)], instructions="   ")
    assert "INSTRUCTIONS:" not in fake.prompts[0]


def test_invalid_deck_is_repaired_on_retry():
    too_many_items = {
        "title": "Title",
        "tldr": "Short summary",
        "blocks": [{"type": "list", "title": "Cards", "items": [f"card {i}" for i in range(6)]}],
    }
    fake, deck = _run([json.dumps(too_many_items), json.dumps(VALID_DECK)],
                      validate=_deck_validation_error)

    assert deck == VALID_DECK
    assert len(fake.prompts) == 2
    assert "PREVIOUS ATTEMPT (REJECTED)" in fake.prompts[1]
    assert "at most 5 items" in fake.prompts[1]


def test_gives_up_after_repair_attempts():
    bad = json.dumps({"title": "T", "tldr": "S", "blocks": []})
    with pytest.raises(RuntimeError, match="still invalid after 2 correction rounds"):
        _run([bad, bad, bad], validate=_deck_validation_error)


def test_malformed_json_is_repaired():
    fake, deck = _run(["not json at all", json.dumps(VALID_DECK)], validate=_deck_validation_error)
    assert deck == VALID_DECK
    assert "not valid JSON" in fake.prompts[1]


def test_validation_error_report_drops_other_union_variants():
    payload = {
        "title": "Title",
        "tldr": "Short summary",
        "blocks": [{"type": "list", "title": "Cards", "items": [f"card {i}" for i in range(6)]}],
    }
    report = _deck_validation_error(payload)
    assert report is not None
    assert report.count("\n") == 0
    assert report == "blocks.0.ListBlock.items: List should have at most 5 items after validation, not 6"


def test_valid_deck_reports_no_error():
    assert _deck_validation_error(VALID_DECK) is None
