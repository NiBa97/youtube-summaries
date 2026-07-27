"""Server-side link unfurling for hover previews.

The browser cannot read cross-origin pages, so the frontend asks the backend
for a page's title/description/image. Fetching a user-supplied URL server-side
is an SSRF vector, so every hop is resolved and checked against private address
space before a request goes out.
"""

from __future__ import annotations

import html
import ipaddress
import re
import socket
import time
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx

_TIMEOUT_SECONDS = 6.0
_MAX_REDIRECTS = 3
_MAX_HTML_BYTES = 512 * 1024
_CACHE_TTL_SECONDS = 24 * 60 * 60
_CACHE_MAX_ENTRIES = 500

_USER_AGENT = (
    "Mozilla/5.0 (compatible; ReelNotesLinkPreview/0.1; +https://github.com/NiBa97/youtube-summaries)"
)


class LinkPreviewError(Exception):
    """Raised when a URL cannot be previewed."""


@dataclass(frozen=True)
class LinkPreview:
    url: str
    site: str
    title: str | None = None
    description: str | None = None
    image: str | None = None


_cache: dict[str, tuple[float, LinkPreview]] = {}


def _cache_get(url: str) -> LinkPreview | None:
    hit = _cache.get(url)
    if hit is None:
        return None
    stored_at, preview = hit
    if time.monotonic() - stored_at > _CACHE_TTL_SECONDS:
        _cache.pop(url, None)
        return None
    return preview


def _cache_put(url: str, preview: LinkPreview) -> None:
    if len(_cache) >= _CACHE_MAX_ENTRIES:
        oldest = min(_cache, key=lambda key: _cache[key][0])
        _cache.pop(oldest, None)
    _cache[url] = (time.monotonic(), preview)


def _assert_public_url(url: str) -> str:
    """Reject anything that is not a public http(s) endpoint. Returns the host."""
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise LinkPreviewError(f"Unsupported URL scheme: {parsed.scheme or 'none'}")
    host = parsed.hostname
    if not host:
        raise LinkPreviewError("URL has no host")

    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise LinkPreviewError(f"Could not resolve host: {host}") from exc

    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if not address.is_global or address.is_multicast:
            raise LinkPreviewError(f"Refusing to fetch non-public address: {address}")
    return host


_META_RE = re.compile(r"<meta\b[^>]*>", re.IGNORECASE)
_ATTR_RE = re.compile(r"""(\w[\w:-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))""")
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def _meta_tags(markup: str) -> dict[str, str]:
    tags: dict[str, str] = {}
    for tag in _META_RE.findall(markup):
        attrs: dict[str, str] = {}
        for match in _ATTR_RE.finditer(tag):
            value = match.group(3) or match.group(4) or match.group(5) or ""
            attrs[match.group(1).lower()] = value
        key = attrs.get("property") or attrs.get("name")
        content = attrs.get("content")
        if key and content and key.lower() not in tags:
            tags[key.lower()] = content
    return tags


def _clean(value: str | None, limit: int) -> str | None:
    if not value:
        return None
    text = html.unescape(value)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None
    if len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    return text


def parse_preview(markup: str, *, url: str) -> LinkPreview:
    tags = _meta_tags(markup)
    title = tags.get("og:title") or tags.get("twitter:title")
    if not title:
        match = _TITLE_RE.search(markup)
        title = match.group(1) if match else None
    description = (
        tags.get("og:description") or tags.get("twitter:description") or tags.get("description")
    )
    image = tags.get("og:image") or tags.get("og:image:url") or tags.get("twitter:image")
    if image:
        image = urljoin(url, image)
        if urlparse(image).scheme not in {"http", "https"}:
            image = None

    return LinkPreview(
        url=url,
        site=_clean(tags.get("og:site_name"), 60) or (urlparse(url).hostname or "").replace("www.", ""),
        title=_clean(title, 140),
        description=_clean(description, 320),
        image=image,
    )


def fetch_preview(url: str) -> LinkPreview:
    cached = _cache_get(url)
    if cached is not None:
        return cached

    current = url
    with httpx.Client(
        timeout=_TIMEOUT_SECONDS,
        follow_redirects=False,
        headers={"User-Agent": _USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    ) as client:
        for _ in range(_MAX_REDIRECTS + 1):
            _assert_public_url(current)
            try:
                with client.stream("GET", current) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise LinkPreviewError("Redirect without a location header")
                        current = urljoin(current, location)
                        continue
                    if response.status_code >= 400:
                        raise LinkPreviewError(f"Upstream returned HTTP {response.status_code}")

                    content_type = response.headers.get("content-type", "")
                    if "html" not in content_type.lower():
                        preview = LinkPreview(
                            url=current,
                            site=(urlparse(current).hostname or "").replace("www.", ""),
                        )
                        _cache_put(url, preview)
                        return preview

                    chunks: list[bytes] = []
                    total = 0
                    for chunk in response.iter_bytes():
                        chunks.append(chunk)
                        total += len(chunk)
                        if total >= _MAX_HTML_BYTES:
                            break
                    markup = b"".join(chunks).decode("utf-8", errors="replace")
            except httpx.HTTPError as exc:
                raise LinkPreviewError(f"Fetch failed: {exc}") from exc

            preview = parse_preview(markup, url=current)
            _cache_put(url, preview)
            return preview

    raise LinkPreviewError("Too many redirects")
