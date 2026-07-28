"""Minimal Pocketbase REST helpers for the one-off library scripts.

Stdlib only, on purpose: these run with `uv run` against the backend project and
should not need any dependency the API itself does not already have. The videos
and tags collections have open rules (single-user assumption), so no auth.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

PB_URL = os.environ.get("PB_URL", "http://localhost/pb").rstrip("/")


def normalize_tag(name: str) -> str:
    """Must match `normalize_tag()` in app/main.py and `normalizeTag()` in the
    frontend - it is the uniqueness key on the tags collection."""
    return re.sub(r"[\s_-]+", "", name.strip().lower())


def _request(method: str, path: str, body: dict[str, Any] | None = None) -> Any:
    url = f"{PB_URL}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            payload = resp.read()
            return json.loads(payload) if payload else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:400]
        raise RuntimeError(f"{method} {url} -> {exc.code}: {detail}") from exc


def get_full_list(collection: str, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    page = 1
    while True:
        query = {"page": str(page), "perPage": "200", **(params or {})}
        result = _request("GET", f"/api/collections/{collection}/records?{urllib.parse.urlencode(query)}")
        items.extend(result.get("items", []))
        if page >= result.get("totalPages", 1):
            return items
        page += 1


def create(collection: str, body: dict[str, Any]) -> dict[str, Any]:
    return _request("POST", f"/api/collections/{collection}/records", body)


def update(collection: str, record_id: str, body: dict[str, Any]) -> dict[str, Any]:
    return _request("PATCH", f"/api/collections/{collection}/records/{record_id}", body)


def load_dotenv(path: str = "../.env") -> None:
    """The repo keeps GEMINI_API_KEY in the root .env, which uvicorn reads via
    docker compose; scripts run outside that, so read it here."""
    if not os.path.exists(path):
        return
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def video_text(record: dict[str, Any]) -> tuple[str, str, str]:
    """(title, tldr, body) for a video record, drawn from its generated deck."""
    deck = record.get("deck") or {}
    if not isinstance(deck, dict):
        deck = {}
    title = deck.get("title") or record.get("title") or ""
    tldr = deck.get("tldr") or ""
    parts: list[str] = []
    for block in deck.get("blocks") or []:
        if isinstance(block, dict):
            parts.append(json.dumps(block, ensure_ascii=False))
    return title, tldr, "\n".join(parts)[:20000]
