from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _fake_fetched():
    snippets = [
        SimpleNamespace(text="hello world", start=0.0, duration=2.0),
        SimpleNamespace(text="second line", start=2.5, duration=3.0),
    ]
    return SimpleNamespace(
        video_id="dQw4w9WgXcQ",
        language="English",
        language_code="en",
        is_generated=False,
        snippets=snippets,
    )


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
