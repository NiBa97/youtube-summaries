from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

from app.main import app

client = TestClient(app)


def _fake_fetched(language="English", language_code="en", is_generated=False):
    snippets = [
        SimpleNamespace(text="hello world", start=0.0, duration=2.0),
        SimpleNamespace(text="second line", start=2.5, duration=3.0),
    ]
    return SimpleNamespace(
        video_id="dQw4w9WgXcQ",
        language=language,
        language_code=language_code,
        is_generated=is_generated,
        snippets=snippets,
    )


def _no_transcript_found():
    return NoTranscriptFound("dQw4w9WgXcQ", ["en"], [])


def _fake_track(language, language_code, is_generated):
    fetched = _fake_fetched(language, language_code, is_generated)
    return SimpleNamespace(
        language=language,
        language_code=language_code,
        is_generated=is_generated,
        fetch=lambda: fetched,
    )


_DECK = {
    "title": "Title",
    "tldr": "Short summary",
    "blocks": [{"type": "claim", "title": "t", "body": "b"}],
}


@patch("app.main.generate_deck")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_endpoint_happy(mock_api_cls, mock_gen):
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_gen.return_value = {
        "title": "Title",
        "tldr": "Short summary",
        "blocks": [
            {
                "type": "claim",
                "eyebrow": "Argument",
                "title": "hello world matters",
                "body": "The transcript starts with a simple claim and then expands it.",
            }
        ],
    }

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 200, r.text

    body = r.json()
    assert body["video_id"] == "dQw4w9WgXcQ"
    assert body["deck"]["title"] == "Title"
    assert body["deck"]["blocks"][0]["type"] == "claim"
    assert body["deck"]["blocks"][0]["title"] == "hello world matters"
    assert body["duration_seconds"] == 6
    assert len(body["transcript"]) == 2
    assert body["transcript"][0]["text"] == "hello world"

    # Gemini received metadata plus [seconds] text formatted lines
    args, kwargs = mock_gen.call_args
    assert args == ()
    assert kwargs["channel"] == "one-shot"
    assert kwargs["title"] == "YouTube dQw4w9WgXcQ"
    assert kwargs["duration"] == "0:06"
    transcript_text = kwargs["transcript_text"]
    assert transcript_text.startswith("[0] hello world")
    assert "[2] second line" in transcript_text


@patch("app.main.generate_deck")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_endpoint_passes_custom_instructions(mock_api_cls, mock_gen):
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_gen.return_value = {
        "title": "Title",
        "tldr": "Short summary",
        "blocks": [{"type": "claim", "title": "t", "body": "b"}],
    }

    r = client.post(
        "/slides",
        json={"url": "dQw4w9WgXcQ", "instructions": "Name every card mentioned"},
    )
    assert r.status_code == 200, r.text
    assert mock_gen.call_args.kwargs["instructions"] == "Name every card mentioned"


@patch("app.main.generate_deck")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_endpoint_instructions_default_none(mock_api_cls, mock_gen):
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_gen.return_value = {
        "title": "Title",
        "tldr": "Short summary",
        "blocks": [{"type": "claim", "title": "t", "body": "b"}],
    }

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 200, r.text
    assert mock_gen.call_args.kwargs["instructions"] is None


def test_slides_endpoint_bad_url():
    r = client.post("/slides", json={"url": "not-a-url"})
    assert r.status_code == 400


@patch("app.main.YouTubeTranscriptApi")
def test_slides_endpoint_transcript_fetch_failure(mock_api_cls):
    mock_api_cls.return_value.fetch.side_effect = RuntimeError("network down")

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 502


@patch("app.main.generate_deck")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_endpoint_gemini_failure(mock_api_cls, mock_gen):
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_gen.side_effect = RuntimeError("gemini exploded")

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 502


@patch("app.main.generate_deck")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_reports_no_fallback_for_requested_language(mock_api_cls, mock_gen):
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_gen.return_value = _DECK

    body = client.post("/slides", json={"url": "dQw4w9WgXcQ"}).json()
    assert body["language_code"] == "en"
    assert body["language_fallback"] is False


@patch("app.main.generate_deck")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_falls_back_to_only_available_language(mock_api_cls, mock_gen):
    api = mock_api_cls.return_value
    api.fetch.side_effect = _no_transcript_found()
    api.list.return_value = [_fake_track("German (auto-generated)", "de", True)]
    mock_gen.return_value = _DECK

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 200, r.text

    body = r.json()
    assert body["language_code"] == "de"
    assert body["language_fallback"] is True
    assert body["is_generated"] is True
    assert len(body["transcript"]) == 2
    # Gemini is told which language it is reading, so it can translate.
    assert mock_gen.call_args.kwargs["transcript_language"] == "German (auto-generated)"


@patch("app.main.generate_deck")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_fallback_prefers_manual_over_generated(mock_api_cls, mock_gen):
    api = mock_api_cls.return_value
    api.fetch.side_effect = _no_transcript_found()
    api.list.return_value = [
        _fake_track("Spanish (auto-generated)", "es", True),
        _fake_track("French", "fr", False),
    ]
    mock_gen.return_value = _DECK

    body = client.post("/slides", json={"url": "dQw4w9WgXcQ"}).json()
    assert body["language_code"] == "fr"
    assert body["is_generated"] is False
    assert body["language_fallback"] is True


@patch("app.main.YouTubeTranscriptApi")
def test_slides_no_transcripts_at_all_is_404(mock_api_cls):
    api = mock_api_cls.return_value
    api.fetch.side_effect = _no_transcript_found()
    api.list.return_value = []

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 404


@patch("app.main.YouTubeTranscriptApi")
def test_slides_transcripts_disabled_is_404(mock_api_cls):
    mock_api_cls.return_value.fetch.side_effect = TranscriptsDisabled("dQw4w9WgXcQ")

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 404


@patch("app.main.YouTubeTranscriptApi")
def test_transcript_endpoint_falls_back(mock_api_cls):
    api = mock_api_cls.return_value
    api.fetch.side_effect = _no_transcript_found()
    api.list.return_value = [_fake_track("German (auto-generated)", "de", True)]

    body = client.post("/transcript", json={"url": "dQw4w9WgXcQ"}).json()
    assert body["language_code"] == "de"
    assert body["language_fallback"] is True
