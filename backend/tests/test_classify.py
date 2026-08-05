from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import Deck, Vocabulary, VocabularyTag, _deck_body, _reconcile, app, normalize_tag

client = TestClient(app)

VOCAB = Vocabulary(
    topics=["AI", "Money"],
    tags=[VocabularyTag(name="llm", count=14), VocabularyTag(name="investing", count=7)],
)


def test_normalize_collapses_separators_and_case():
    assert normalize_tag("Machine Learning") == normalize_tag("machine-learning") == "machinelearning"
    assert normalize_tag("  API_Design ") == "apidesign"


def test_reconcile_canonicalizes_existing_tags():
    result = _reconcile(
        {"topic": "ai", "topic_confidence": 0.9, "tags": [{"name": "LLM", "confidence": 0.8}], "new_tags": []},
        VOCAB,
    )
    assert result.topic == "AI"  # matched by norm, returned with the vocabulary's casing
    assert [t.name for t in result.tags] == ["llm"]


def test_reconcile_demotes_out_of_vocabulary_tags_to_proposals():
    """The prompt says "existing tags only", but ~10% leak through anyway, so
    anything that is not in the tag table is forced into new_tags."""
    result = _reconcile(
        {"topic": "AI", "topic_confidence": 1, "tags": [{"name": "quantization", "confidence": 0.9}], "new_tags": []},
        VOCAB,
    )
    assert [t.name for t in result.tags] == []
    assert [t.name for t in result.new_tags] == ["quantization"]


def test_reconcile_promotes_new_tag_that_is_really_an_existing_one():
    result = _reconcile(
        {"topic": "AI", "topic_confidence": 1, "tags": [], "new_tags": [{"name": "L-L-M", "confidence": 0.6}]},
        VOCAB,
    )
    assert [t.name for t in result.tags] == ["llm"]
    assert result.new_tags == []


def test_reconcile_rejects_unknown_and_sentinel_topics():
    for topic in ("__none__", "Woodworking", ""):
        result = _reconcile({"topic": topic, "topic_confidence": 0.9, "tags": [], "new_tags": []}, VOCAB)
        assert result.topic is None
        assert result.topic_confidence == 0.0


def test_reconcile_never_shadows_a_topic_with_a_tag():
    result = _reconcile(
        {"topic": "AI", "topic_confidence": 1, "tags": [], "new_tags": [{"name": "ai", "confidence": 0.9}]},
        VOCAB,
    )
    assert result.tags == [] and result.new_tags == []


def test_reconcile_clamps_and_sorts_by_confidence():
    result = _reconcile(
        {
            "topic": "AI",
            "topic_confidence": 5,
            "tags": [{"name": "llm", "confidence": 0.3}, {"name": "investing", "confidence": "nonsense"}],
            "new_tags": [],
        },
        VOCAB,
    )
    assert result.topic_confidence == 1.0
    assert [t.name for t in result.tags] == ["llm", "investing"]
    assert result.tags[1].confidence == 0.0


def _fake_fetched():
    return SimpleNamespace(
        video_id="dQw4w9WgXcQ",
        language="English",
        language_code="en",
        is_generated=False,
        snippets=[SimpleNamespace(text="hello world", start=0.0, duration=2.0)],
    )


_DECK = {
    "title": "Title",
    "tldr": "Short summary",
    "blocks": [{"type": "claim", "title": "hello world matters", "body": "A claim, expanded."}],
}


@patch("app.main.generate_deck")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_skips_classification_without_vocabulary(mock_api_cls, mock_gen):
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_gen.return_value = _DECK

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 200
    assert r.json()["classification"] is None


@patch("app.main.classify_video")
@patch("app.main.generate_deck")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_classifies_from_the_deck(mock_api_cls, mock_gen, mock_classify):
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_gen.return_value = _DECK
    mock_classify.return_value = {
        "topic": "AI",
        "topic_confidence": 0.9,
        "tags": [{"name": "llm", "confidence": 0.95}],
        "new_tags": [],
    }

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ", "vocabulary": VOCAB.model_dump()})
    assert r.status_code == 200
    body = r.json()
    assert body["classification"]["topic"] == "AI"
    assert body["classification"]["tags"][0]["name"] == "llm"

    kwargs = mock_classify.call_args.kwargs
    assert kwargs["topics"] == ["AI", "Money"]
    assert kwargs["tags"] == [("llm", 14), ("investing", 7)]
    assert "hello world matters" in kwargs["body"]  # deck text, not the transcript


@patch("app.main.classify_video")
@patch("app.main.generate_deck")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_survives_a_failing_classifier(mock_api_cls, mock_gen, mock_classify):
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_gen.return_value = _DECK
    mock_classify.side_effect = RuntimeError("gemini exploded")

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ", "vocabulary": VOCAB.model_dump()})
    assert r.status_code == 200, "a failed classification must not cost the user their deck"
    assert r.json()["classification"] is None


@patch("app.main.classify_video")
def test_classify_endpoint(mock_classify):
    mock_classify.return_value = {
        "topic": "Money",
        "topic_confidence": 0.7,
        "tags": [],
        "new_tags": [{"name": "bonds", "confidence": 0.6}],
    }
    r = client.post("/classify", json={"title": "T", "tldr": "S", "body": "B", "vocabulary": VOCAB.model_dump()})
    assert r.status_code == 200
    assert r.json()["topic"] == "Money"
    assert r.json()["new_tags"][0]["name"] == "bonds"


@patch("app.main.classify_video")
def test_classify_endpoint_failure(mock_classify):
    mock_classify.side_effect = RuntimeError("no api key")
    r = client.post("/classify", json={"title": "T", "tldr": "S", "body": "B"})
    assert r.status_code == 502


def test_deck_body_excludes_community_and_caveats():
    """Deliberate: comment text is public and `new_tags` reaches the tag table on
    one click, so the librarian is never fed attacker-controlled text."""
    deck = Deck.model_validate({
        "title": "Title",
        "tldr": "Short summary",
        "blocks": [{
            "type": "claim",
            "title": "the claim",
            "body": "the body",
            "caveat": "Commenters mention kryptocoin heavily",
        }],
        "community": {
            "sentiment": "critical",
            "summary": "Commenters discuss kryptocoin instead",
            "notes": [{"text": "kryptocoin came up repeatedly", "quote": None}],
        },
    })

    body = _deck_body(deck)
    assert "the claim" in body
    assert "the body" in body
    assert "kryptocoin" not in body
