from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app import link_preview as lp
from app.main import app

client = TestClient(app)

HTML = """
<html><head>
<title>Fallback title</title>
<meta property="og:title" content="Pantlaza, Sun-Favored">
<meta property="og:description" content="Legendary Creature &mdash; Dinosaur.   Discover 5.">
<meta property="og:image" content="/card.png">
<meta property="og:site_name" content="Scryfall">
</head><body>ignored</body></html>
"""


def test_parse_preview_prefers_open_graph():
    preview = lp.parse_preview(HTML, url="https://scryfall.com/card/lci/237")
    assert preview.title == "Pantlaza, Sun-Favored"
    assert preview.description.startswith("Legendary Creature")
    assert "   " not in preview.description
    assert preview.image == "https://scryfall.com/card.png"
    assert preview.site == "Scryfall"


def test_parse_preview_falls_back_to_title_tag_and_host():
    preview = lp.parse_preview("<html><head><title> Some page </title></head></html>", url="https://www.example.org/a")
    assert preview.title == "Some page"
    assert preview.site == "example.org"
    assert preview.description is None


@pytest.mark.parametrize(
    "url",
    ["file:///etc/passwd", "ftp://example.com/x", "https://", "http://localhost:8090/pb"],
)
def test_non_public_urls_are_rejected(url):
    with pytest.raises(lp.LinkPreviewError):
        lp._assert_public_url(url)


def test_private_address_is_rejected():
    with patch("app.link_preview.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("192.168.0.5", 443))]):
        with pytest.raises(lp.LinkPreviewError, match="non-public address"):
            lp._assert_public_url("https://internal.example.com/")


def test_endpoint_returns_preview():
    lp._cache.clear()
    with patch("app.main.fetch_preview", return_value=lp.LinkPreview(
        url="https://scryfall.com/card/lci/237",
        site="Scryfall",
        title="Pantlaza, Sun-Favored",
        description="Discover 5.",
        image=None,
    )):
        r = client.get("/link-preview", params={"url": "https://scryfall.com/card/lci/237"})
    assert r.status_code == 200, r.text
    assert r.json()["title"] == "Pantlaza, Sun-Favored"
    assert r.json()["image"] is None


def test_endpoint_reports_fetch_failure():
    with patch("app.main.fetch_preview", side_effect=lp.LinkPreviewError("Refusing to fetch non-public address")):
        r = client.get("/link-preview", params={"url": "http://10.0.0.1/"})
    assert r.status_code == 502
    assert "non-public" in r.json()["detail"]


def test_cache_returns_stored_preview_without_refetching():
    lp._cache.clear()
    stored = lp.LinkPreview(url="https://example.com/", site="example.com", title="Cached")
    lp._cache_put("https://example.com/", stored)
    with patch("app.link_preview.httpx.Client", side_effect=AssertionError("should not fetch")):
        assert lp.fetch_preview("https://example.com/") is stored
