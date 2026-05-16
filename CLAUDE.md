# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack overview

Three services behind one Caddy reverse proxy on port 80:

- `frontend/` — Vite + React 19 + TypeScript + Chakra UI v3, served at `/`. Built to static assets, served by nginx in prod.
- `backend/` — FastAPI (Python 3.12, managed by `uv`), mounted at `/api/*` (uvicorn runs with `--root-path=/api`). Thin wrapper around [`youtube-transcript-api`](https://github.com/jdepoix/youtube-transcript-api).
- `database/` — Pocketbase 0.22.21, mounted at `/pb/*` (admin UI at `/pb/_/`, API at `/pb/api/*`).

`pb_data/` is git-ignored (only `.gitkeep` tracked). `pb_migrations/` is the source of truth for schema and **must** be committed.

## Commands

### Full stack (Docker)

```bash
cp .env.example .env
docker compose up --build                                            # prod-ish build
docker compose -f docker-compose.yaml -f docker-compose.preview.yaml up   # hot-reload dev
docker compose --profile tunnel up -d tunnel                         # public Cloudflare quick-tunnel
```

URLs (everything one origin via Caddy):
- Frontend: `http://192.168.0.157`
- Backend Swagger: `http://192.168.0.157/api/docs`
- Pocketbase admin: `http://192.168.0.157/pb/_/`

**Host policy:** always bind dev servers to `0.0.0.0` and use the LAN IP `192.168.0.157` in URLs, examples, and curl commands. Never use `localhost` or `127.0.0.1` — the dev box is accessed from other machines on the network.

First-time Pocketbase admin bootstrap:

```bash
docker exec -it yts-pocketbase /usr/local/bin/pocketbase \
  --dir=/pb/pb_data admin create admin@example.com changeme-please-1234
```

### Backend standalone

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest                # pytest + httpx are dev deps
```

### Frontend standalone

```bash
cd frontend
npm install
npm run dev      # Vite dev server on :5173
npm run build    # tsc -b && vite build
npm run lint     # eslint .
```

## Architecture

### Data flow (v0 — synchronous, no jobs)

1. Frontend calls `POST /api/transcript` with `{ url, languages? }` to fetch transcript snippets, or `POST /api/slides` with `{ url, languages? }` to fetch transcript **and** generate slides in one call. Backend extracts the 11-char video id (handles `youtube.com/watch`, `youtu.be`, `/embed/`, `/shorts/`, `/v/`, or bare id).
2. `/api/slides` returns `{ video_id, slides_html, transcript }`. Gemini is called server-side; the API key (`GEMINI_API_KEY`) lives in the backend's `.env` and never reaches the browser. See `docs/adr/0002-gemini-call-via-backend.md`.
3. Frontend persists video metadata, the `transcript` JSON, and `slides_html` to Pocketbase from the browser. Transcripts are stored so the frontend can re-render slides offline without re-calling the backend; they can also be re-fetched on demand via `/api/transcript`.
4. If latency forces it, switch to a status/polling model and have the backend write directly into Pocketbase.

### No-auth single-user assumption

Pocketbase rules on the `videos` collection are wide-open (`listRule`/`viewRule`/`createRule`/`updateRule`/`deleteRule` all `""`). FastAPI has no auth either. Treat the system as single-user; do not add auth without an explicit ask.

### Pocketbase schema changes

All schema work goes through migration files in `database/pb_migrations/` (JS migrations, name format `<unix-ts>_<slug>.js`, both `up` and `down`). Do **not** rely on admin-UI changes for anything that needs to be reproducible — they get overwritten when `pb_data/` is reset. Existing collection: `videos` (id `videos00000videos`) with fields `url`, `video_id` (unique, 11 chars), `title`, `status` (`pending|transcribed|slides_ready|error`), `slides_html`, `transcript` (json), `error`.

### Frontend layout

Single-page app, no router. `App.tsx` composes a 3-pane layout via `react-resizable-panels`: filter rail / video list / right pane (player + deck). State is local (`useState`); `src/data.ts` holds sample data — Pocketbase wiring is not yet in place.

### Reverse-proxy contract

Caddy strips the `/api` and `/pb` path prefixes (`handle_path`) before forwarding. Backend is therefore unaware of `/api` in routes; it sees `/transcript`, `/health`, etc. Uvicorn's `--root-path=/api` only affects OpenAPI doc URLs. Frontend env vars `VITE_BACKEND_URL` and `VITE_PB_URL` default to relative `/api` and `/pb` — keep them relative so the same build works for local, tunnel, and prod.

### Deployment

Coolify deploys via `docker-compose.preview.yaml` (overrides `Caddyfile.preview` which honors `$APP_DOMAIN` for auto-HTTPS). Set `APP_DOMAIN` in env to enable.

## Worktree workflow

Work happens in git worktrees. When creating a new worktree, copy `database/pb_data/` and `.env` into it — neither is tracked, and Pocketbase needs the data dir to start.
