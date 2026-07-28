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
- Frontend: `http://localhost`
- Backend Swagger: `http://localhost/api/docs`
- Pocketbase admin: `http://localhost/pb/_/`

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
2. `/api/slides` returns `{ video_id, deck, duration_seconds, transcript, classification }`. Gemini is called server-side; the API key (`GEMINI_API_KEY`) lives in the backend's `.env` and never reaches the browser. See `docs/adr/0002-gemini-call-via-backend.md`.
   If the request carries a `vocabulary` (`{ topics: string[], tags: [{name, count}] }`) the backend makes a second Gemini call to file the video — see *Library management* below. `POST /api/classify` is the same step standalone, for re-tagging and for the backfill script.
3. Frontend persists video metadata, the `transcript` JSON, and `slides_html` to Pocketbase from the browser. Transcripts are stored so the frontend can re-render slides offline without re-calling the backend; they can also be re-fetched on demand via `/api/transcript`.
4. If latency forces it, switch to a status/polling model and have the backend write directly into Pocketbase.

### No-auth single-user assumption

Pocketbase rules on the `videos` collection are wide-open (`listRule`/`viewRule`/`createRule`/`updateRule`/`deleteRule` all `""`). FastAPI has no auth either. Treat the system as single-user; do not add auth without an explicit ask.

### Pocketbase schema changes

All schema work goes through migration files in `database/pb_migrations/` (JS migrations, name format `<unix-ts>_<slug>.js`, both `up` and `down`). Do **not** rely on admin-UI changes for anything that needs to be reproducible — they get overwritten when `pb_data/` is reset. Existing collections:
- `videos` (id `videos00000videos`): `url`, `video_id` (unique, 11 chars), `title`, `status` (ingest state: `pending|transcribed|slides_ready|error`), `slides_html`, `transcript` (json), `deck` (json), `error`, `topic` (relation→tags, maxSelect 1), `tags` (relation→tags), `tag_source` (json), `read_status` (`unread|reading|read`), `starred` (bool).
- `tags` (id `tags00000000tags`): `name`, `norm` (unique), `kind` (`topic|tag`), `color`, `sort`.

Note `status` (ingest pipeline) and `read_status` (have you read it) are different fields.

### Frontend layout

Single-page app, no router. `App.tsx` composes a 3-pane layout via `react-resizable-panels`: filter rail / video list / right pane (player + tag bar + deck). State is local (`useState`), loaded from Pocketbase on mount via `lib/pb.ts` and `lib/tags.ts`.

### Library management

Videos are organised on two tiers, both stored in the one `tags` collection and told apart by `kind`:

- **Topics** (`kind: 'topic'`) — 5-9 shelves, at most one per video, always visible at the top of the rail. The classifier picks from them via a response-schema enum and can never invent one; you curate them in the tag manager.
- **tags** (`kind: 'tag'`) — many per video, shown below the Topics and **scoped to the selected Topic**, so the tag list never becomes another long list.

One collection means promoting a tag to a Topic is a `kind` flip, not a data move.

`norm` (lowercased, whitespace/`-`/`_` stripped) is unique and is the identity key that stops `Machine Learning` / `machine-learning` / `machine_learning` from becoming three tags. It is computed in three places that must stay in sync: `normalize_tag()` in `backend/app/main.py`, `normalizeTag()` in `frontend/src/lib/tags.ts`, and `normalize_tag()` in `backend/scripts/pblib.py`.

Auto-tagging rules, all deliberate:

- The topic enum is enforced by the response schema, but free-form tags still leak out-of-vocabulary names, so `_reconcile()` matches every returned tag against the vocabulary by norm — a hit is canonicalised, a miss is demoted to a proposal.
- Existing tags above `AUTO_APPLY_THRESHOLD` (0.75) are pre-selected; **proposed new tags are never pre-selected**, at any confidence. Applying a wrong existing tag is one click to undo; creating a redundant tag splits the vocabulary permanently.
- Every attached tag is recorded in `tag_source` as `ai` or `human`, which is what makes a bad auto-tagging run revertible.
- A failed classification never fails `/slides` — you keep the deck and tag by hand.

Two one-off scripts, both propose-to-a-JSON-file first and only write on a second `--apply` run:

```bash
cd backend
uv run python scripts/seed_vocabulary.py            # propose topics+tags from the existing library
uv run python scripts/seed_vocabulary.py --apply    # after you edit vocabulary_proposal.json
uv run python scripts/backfill_tags.py --limit 5    # classify unfiled videos
uv run python scripts/backfill_tags.py --apply      # after you edit backfill_proposal.json
uv run python scripts/backfill_tags.py --revert     # strip every ai-attached tag
```

They talk to Pocketbase over REST (`PB_URL`, default `http://localhost/pb`) with stdlib only.

`docs/library-management-options.html` is the report the design came from, including the options that were rejected.

### Reverse-proxy contract

Caddy strips the `/api` and `/pb` path prefixes (`handle_path`) before forwarding. Backend is therefore unaware of `/api` in routes; it sees `/transcript`, `/health`, etc. Uvicorn's `--root-path=/api` only affects OpenAPI doc URLs. Frontend env vars `VITE_BACKEND_URL` and `VITE_PB_URL` default to relative `/api` and `/pb` — keep them relative so the same build works for local, tunnel, and prod.

### Deployment

Coolify deploys via `docker-compose.coolify.yaml` (self-contained prod stack: nginx-served frontend build, real uvicorn, no host ports). Attach the domain to the `caddy` service (container port 80); Coolify's Traefik terminates TLS. Set `GEMINI_API_KEY` in Coolify env. Pocketbase production data is a host bind mount at the absolute path `/root/yts_pb_data_prod` — the single source of truth, surviving container crashes, redeploys, and node reboots. A named volume would get rewritten to a UUID-prefixed name by Coolify (coollabsio/coolify#3954), and the bind-mounted `./database/pb_data` in the local compose files survives nothing on redeploy. First-run admin bootstrap is manual (see compose file header). The footer build version comes from the `VITE_GIT_SHA` build arg (Coolify's `SOURCE_COMMIT`, shortened to 7 chars in `vite.config.ts`) — the frontend build context is `./frontend` and must never need `.git`, since Coolify's build checkout has none. Do **not** deploy `docker-compose.preview.yaml` to Coolify — it runs the Vite dev server, which rejects unknown `Host` headers.

## Worktree workflow

Work happens in git worktrees. When creating a new worktree, copy `database/pb_data/` and `.env` into it — neither is tracked, and Pocketbase needs the data dir to start.
