from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

from app.comments import Comment, CommentsError
from app.comments import Comment, CommentsError
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
    assert mock_gen.call_args.kwargs["previous_deck"] is None


@patch("app.main.generate_deck")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_endpoint_passes_previous_deck_flattened(mock_api_cls, mock_gen):
    """A re-run sends the rejected deck so the model can go somewhere else.

    Comment-derived text (`community`, block `caveat`) must not ride along: it
    would put untrusted input back on the generation path.
    """
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_gen.return_value = {
        "title": "Title",
        "tldr": "Short summary",
        "blocks": [{"type": "claim", "title": "t", "body": "b"}],
    }

    r = client.post(
        "/slides",
        json={
            "url": "dQw4w9WgXcQ",
            "instructions": "Name every card mentioned",
            "previous_deck": {
                "title": "Old title",
                "tldr": "Old tldr",
                "blocks": [{
                    "type": "claim",
                    "title": "old claim",
                    "body": "old body",
                    "caveat": "Commenters mention kryptocoin",
                }],
                "community": {
                    "sentiment": "critical",
                    "summary": "Commenters discuss kryptocoin instead",
                    "notes": [],
                },
            },
        },
    )
    assert r.status_code == 200, r.text
    previous = mock_gen.call_args.kwargs["previous_deck"]
    assert "Old title" in previous
    assert "old claim" in previous
    assert "old body" in previous
    assert "kryptocoin" not in previous


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


def _comment(text, likes=10, replies=0, heart=False):
    return Comment(text=text, likes=likes, replies=replies, heart=heart,
                   author="someone", published="2 years ago")


_COMMENTS = [_comment(f"a substantive comment number {i}", likes=100 - i) for i in range(5)]

_STORED_DECK = {
    "title": "Title",
    "tldr": "Short summary",
    "blocks": [
        {"type": "claim", "title": "first", "body": "body one"},
        {"type": "claim", "title": "second", "body": "body two"},
    ],
}


@patch("app.main.generate_deck")
@patch("app.main.YouTubeTranscriptApi")
def test_slides_never_fetches_comments(mock_api_cls, mock_gen):
    """The scrape is on demand only - /slides must not pay for it."""
    mock_api_cls.return_value.fetch.return_value = _fake_fetched()
    mock_gen.return_value = _DECK

    with patch("app.main.fetch_top_comments") as mock_comments:
        r = client.post("/slides", json={"url": "dQw4w9WgXcQ"})
        assert r.status_code == 200, r.text
        mock_comments.assert_not_called()

    assert "comments_text" not in mock_gen.call_args.kwargs
    assert r.json()["deck"]["community"] is None
    assert "comments" not in r.json()


# --- POST /community --------------------------------------------------------


@patch("app.main.generate_community")
@patch("app.main.fetch_top_comments")
def test_community_endpoint_merges_into_the_deck(mock_comments, mock_gen):
    mock_comments.return_value = _COMMENTS
    mock_gen.return_value = {
        "community": {
            "sentiment": "mixed",
            "summary": "Commenters accept the framing but dispute the number.",
            "notes": [{"text": "Several commenters dispute it",
                       "quote": "a substantive comment number 2"}],
        },
        "caveats": [{"block": 2, "text": "Commenters note the figure is from 2019."}],
    }

    r = client.post("/community", json={"url": "dQw4w9WgXcQ", "deck": _STORED_DECK})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["video_id"] == "dQw4w9WgXcQ"

    deck = body["deck"]
    assert deck["community"]["sentiment"] == "mixed"
    assert deck["community"]["notes"][0]["quote"] == "a substantive comment number 2"
    assert deck["blocks"][1]["caveat"] == "Commenters note the figure is from 2019."
    assert deck["blocks"][0]["caveat"] is None
    # the deck itself is untouched apart from the two comment-sourced fields
    assert deck["title"] == "Title"
    assert deck["blocks"][0]["body"] == "body one"
    assert len(body["comments"]) == 5


@patch("app.main.generate_community")
@patch("app.main.fetch_top_comments")
def test_community_endpoint_sends_the_deck_not_the_transcript(mock_comments, mock_gen):
    mock_comments.return_value = _COMMENTS
    mock_gen.return_value = {"community": None, "caveats": []}

    r = client.post("/community", json={"url": "dQw4w9WgXcQ", "deck": _STORED_DECK})
    assert r.status_code == 200, r.text

    kwargs = mock_gen.call_args.kwargs
    assert kwargs["deck_text"].startswith("[b01] first. body one")
    assert "[b02] second. body two" in kwargs["deck_text"]
    assert "[c01 likes=100]" in kwargs["comments_text"]
    assert "someone" not in kwargs["comments_text"], "author names must never reach the model"


@patch("app.main.generate_community")
@patch("app.main.fetch_top_comments")
def test_community_endpoint_with_no_usable_comments_skips_the_model(mock_comments, mock_gen):
    """A thin comment section is a normal answer, not an error - and not worth a
    model call."""
    mock_comments.return_value = []

    r = client.post("/community", json={"url": "dQw4w9WgXcQ", "deck": _STORED_DECK})
    assert r.status_code == 200, r.text
    mock_gen.assert_not_called()
    body = r.json()
    assert body["deck"]["community"] is None
    assert body["comments"] == []


@patch("app.main.fetch_top_comments")
def test_community_endpoint_fails_loudly_on_a_broken_scraper(mock_comments):
    """The inverse of the /slides contract: someone clicked a button and is
    waiting, so a dead scraper must be visible rather than silently empty."""
    mock_comments.side_effect = CommentsError("Comment fetch failed: boom")
    r = client.post("/community", json={"url": "dQw4w9WgXcQ", "deck": _STORED_DECK})
    assert r.status_code == 502
    assert "boom" in r.json()["detail"]


@patch("app.main.generate_community")
@patch("app.main.fetch_top_comments")
def test_community_endpoint_fails_loudly_on_a_bad_model_answer(mock_comments, mock_gen):
    mock_comments.return_value = _COMMENTS
    mock_gen.return_value = {"community": {"sentiment": "angry", "summary": "s", "notes": []}}
    r = client.post("/community", json={"url": "dQw4w9WgXcQ", "deck": _STORED_DECK})
    assert r.status_code == 502
    assert "Community read failed" in r.json()["detail"]


def test_community_endpoint_bad_url():
    r = client.post("/community", json={"url": "not-a-url", "deck": _STORED_DECK})
    assert r.status_code == 400


# --- GET /comments (diagnostic) --------------------------------------------


@patch("app.main.fetch_top_comments")
def test_comments_endpoint(mock_comments):
    mock_comments.return_value = _COMMENTS
    r = client.get("/comments", params={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["count"] == 5
    assert body["comments"][0]["likes"] == 100
    assert body["comments"][0]["author"] == "someone", "authors are stored, just not sent"


@patch("app.main.fetch_top_comments")
def test_comments_endpoint_fails_loudly(mock_comments):
    mock_comments.side_effect = CommentsError("Comment fetch failed: boom")
    r = client.get("/comments", params={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 502
