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


def _fake_slides_json():
    return {
        "title": "Test Title",
        "tldr": "One-line thesis.",
        "summary": {
            "keypoints": [
                "First point worth knowing.",
                "Second point worth knowing.",
                "Third point worth knowing.",
            ],
            "stat": {"value": "42%", "caption": "share of something striking"},
            "quote": None,
            "timeline": None,
        },
    }


@patch("app.main._fetch_oembed")
@patch("app.main.generate_slides")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_endpoint_happy(mock_api_cls, mock_gen, mock_oembed):
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_gen.return_value = _fake_slides_json()
    mock_oembed.return_value = {"title": "YT Title", "author": "Channel X"}

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 200, r.text

    body = r.json()
    assert body["video_id"] == "dQw4w9WgXcQ"
    assert body["title"] == "Test Title"
    assert body["tldr"] == "One-line thesis."
    assert body["channel"] == "Channel X"
    assert body["duration"] == 5  # 2.5 + 3.0
    assert body["summary"]["keypoints"][0] == "First point worth knowing."
    assert body["summary"]["stat"]["value"] == "42%"
    assert body["summary"]["quote"] is None
    assert body["summary"]["timeline"] is None
    assert len(body["transcript"]) == 2
    assert body["transcript"][0]["text"] == "hello world"

    args, kwargs = mock_gen.call_args
    transcript_text = args[0]
    assert transcript_text.startswith("[0] hello world")
    assert "[2] second line" in transcript_text
    assert kwargs["title"] == "YT Title"
    assert kwargs["channel"] == "Channel X"


def test_slides_endpoint_bad_url():
    r = client.post("/slides", json={"url": "not-a-url"})
    assert r.status_code == 400


@patch("app.main.YouTubeTranscriptApi")
def test_slides_endpoint_transcript_fetch_failure(mock_api_cls):
    mock_api_cls.return_value.fetch.side_effect = RuntimeError("network down")

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 502


@patch("app.main._fetch_oembed")
@patch("app.main.generate_slides")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_endpoint_gemini_failure(mock_api_cls, mock_gen, mock_oembed):
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_oembed.return_value = {"title": "", "author": ""}
    mock_gen.side_effect = RuntimeError("gemini exploded")

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 502


@patch("app.main._fetch_oembed")
@patch("app.main.generate_slides")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_endpoint_missing_keypoints(mock_api_cls, mock_gen, mock_oembed):
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_oembed.return_value = {"title": "", "author": ""}
    mock_gen.return_value = {"title": "t", "tldr": "x", "summary": {"keypoints": []}}

    r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 502
