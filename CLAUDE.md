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
   `/api/slides` does **not** touch comments. Reading a video's comment section is a separate, on-demand call — see *Community sentiment* below.
3. Frontend persists video metadata, the `transcript` JSON, and `slides_html` to Pocketbase from the browser. Transcripts are stored so the frontend can re-render slides offline without re-calling the backend; they can also be re-fetched on demand via `/api/transcript`.
4. If latency forces it, switch to a status/polling model and have the backend write directly into Pocketbase.

### No-auth single-user assumption

Pocketbase rules on the `videos` collection are wide-open (`listRule`/`viewRule`/`createRule`/`updateRule`/`deleteRule` all `""`). FastAPI has no auth either. Treat the system as single-user; do not add auth without an explicit ask.

### Pocketbase schema changes

All schema work goes through migration files in `database/pb_migrations/` (JS migrations, name format `<unix-ts>_<slug>.js`, both `up` and `down`). Do **not** rely on admin-UI changes for anything that needs to be reproducible — they get overwritten when `pb_data/` is reset. Existing collections:
- `videos` (id `videos00000videos`): `url`, `video_id` (unique, 11 chars), `title`, `status` (ingest state: `pending|transcribed|slides_ready|error`), `slides_html`, `transcript` (json), `deck` (json), `comments` (json), `instructions` (the directive the deck was generated with), `error`, `topic` (relation→tags, maxSelect 1), `tags` (relation→tags), `tag_source` (json), `read_status` (`unread|reading|read`), `starred` (bool).
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

### Re-importing a video (second pass)

Pasting a URL that is already in the library is a normal thing to do — usually because the first summary missed something. `video_id` is unique, so this was previously a silent upsert: the second import overwrote the deck **and** reset `read_status` and clobbered hand-made tags, with no UI signal that anything had been replaced.

The rule now is that a duplicate is a **choice, never an inference**:

- `AddVideoDialog` matches the pasted id against the in-memory `videos` list as you type — no round trip, so the warning lands while you are still looking at the box. The primary button is *removed* while the choice is open, so nothing can be overwritten by muscle memory. You get *Open it* or *Re-summarise*.
- A re-run sends `previous_deck` to `/slides`. The prompt frames it as an earlier deck **the reader rejected**, not a draft to edit: the anchoring risk is that the model re-emits the old deck with cosmetic edits, and the instruction is what has to drive the difference. It is also explicitly not evidence — the transcript stays the only source.
- `_deck_for_rerun()` flattens that deck through `_block_text()`, the same as `_deck_body()`, so the `community` section and block `caveat`s — which originate in public comments — never re-enter the generation prompt. The untrusted path stays exactly as narrow as *Community sentiment* below describes. Pinned by a test.
- `rerunVideo()` in `lib/pb.ts` writes the new deck without ever putting `read_status` or `starred` in the payload, and the step-2 tag picker is seeded from the tags already on the record, so the classifier adds to your filing instead of replacing it. Tags that were already there keep their existing `tag_source` — a re-run must not relabel your hand-filing as the model's work. Stored `comments` are cleared, because they described the deck that was just replaced.
- `createVideo()` still falls back to a re-run if it finds an existing record: the dialog check reads one browser's list, and a second tab would otherwise hit the unique index.

### Community sentiment

`POST /api/community` reads a video's top comments against its **already-written deck** and fills in two things: an optional top-level `community` section (`sentiment` / `summary` / `notes`) and a short `caveat` on any block commenters materially dispute. `community` is deliberately **not** a sixth block type, so the block union stays at five variants.

It is a **button in the deck panel, not part of importing a video**, and that is the load-bearing decision. Always-on was tried first and rejected: the scrape adds 3-5s to every single import, and the gate below is built so that most comment sections correctly produce nothing — so you would pay a certain cost on 100% of videos for an occasional benefit. On demand it also gets to fail loudly, because someone is waiting on it.

Load-bearing details, all deliberate:

- **It reads the deck, not the transcript.** The deck is the distilled claims already, so the call is small and fast (~10s including the scrape, vs ~40s if it re-read the transcript). Blocks are sent numbered (`[b01] ...`) so a caveat can name the block it qualifies; `_apply_community()` maps that number back onto the block and drops anything out of range rather than guessing.
- **Comment text is untrusted input**, and `generate_community` is the *only* call in the app that ever sees it — which is what keeps the untrusted path narrow. Defences in depth: URLs *and bare domains* are stripped in the sanitiser (bare domains need their own pattern, since `buy at spam.example` carries no scheme); each comment is flattened to one line so none can impersonate a prompt label; the block is fenced with a **per-request random id** (a constant delimiter in a public repo is a published delimiter) and followed by our own re-assertion, so our words are read last. Author names are never sent — they add nothing and cost an injection surface. Verified end to end: four hijack attempts (`SYSTEM:`, `admin:`, fence-spoofing, HTML) leaked nothing while genuine corrections came through.
- **Comment text never reaches the classifier.** `_block_text()` reads only named content fields, so `caveat` and `community` are excluded from `_deck_body()` by construction. `new_tags` reaches the tag table on one click and a redundant tag splits the vocabulary permanently — do not turn `_block_text` into a generic dump. Pinned by a test.
- **Quotes are verified, not trusted.** `_drop_unverifiable_quotes()` deletes any `note.quote` that is not verbatim in the fetched comments, matched against the comment texts rather than the formatted lines.
- **Wall clock is ours to own.** The library sets *no* timeout on its first request and retries AJAX failures 5x20s, which would pin a threadpool worker for minutes. `_clamp_session` and `_clamp_retries` bound that to ~18s worst case, and both check what they patch, so a re-signed library method skips the patch instead of silently restoring the 400s path.
- **An absent community section is the normal, correct answer.** `COMMUNITY_SYSTEM_PROMPT` opens with a gate: at least 3 comments must correct, dispute, add context, or report having applied the video's claims. Praise, memes, and nostalgia explicitly fail it, as does anything about the video-watching experience rather than its subject. Putting that gate *first* in a standalone prompt is what made it work — the same rules buried inside the deck prompt were routinely ignored.
- `GET /api/comments?url=…` is the diagnostic: the same scrape, no model call, fails loudly. The scraper reads YouTube's internals and will break; this is how you find out.
- Stored comments (`comments` json) are the sanitised list the model actually saw. Unlike a transcript, a re-scrape returns a *different* comment section, so this is the only way to tell a bad scrape from a bad model after the fact. Write-only today: the reading UI gets its community section from `deck`.

`backend/tests/conftest.py` stubs the fetch suite-wide via an autouse fixture, so a test that forgets to patch fails safe instead of scraping YouTube.

### Reverse-proxy contract

Caddy strips the `/api` and `/pb` path prefixes (`handle_path`) before forwarding. Backend is therefore unaware of `/api` in routes; it sees `/transcript`, `/health`, etc. Uvicorn's `--root-path=/api` only affects OpenAPI doc URLs. Frontend env vars `VITE_BACKEND_URL` and `VITE_PB_URL` default to relative `/api` and `/pb` — keep them relative so the same build works for local, tunnel, and prod.

### Deployment

Coolify deploys via `docker-compose.coolify.yaml` (self-contained prod stack: nginx-served frontend build, real uvicorn, no host ports). Attach the domain to the `caddy` service (container port 80); Coolify's Traefik terminates TLS. Set `GEMINI_API_KEY` in Coolify env. Pocketbase production data is a host bind mount at the absolute path `/root/yts_pb_data_prod` — the single source of truth, surviving container crashes, redeploys, and node reboots. A named volume would get rewritten to a UUID-prefixed name by Coolify (coollabsio/coolify#3954), and the bind-mounted `./database/pb_data` in the local compose files survives nothing on redeploy. First-run admin bootstrap is manual (see compose file header). The footer build version comes from the `VITE_GIT_SHA` build arg (Coolify's `SOURCE_COMMIT`, shortened to 7 chars in `vite.config.ts`) — the frontend build context is `./frontend` and must never need `.git`, since Coolify's build checkout has none. Do **not** deploy `docker-compose.preview.yaml` to Coolify — it runs the Vite dev server, which rejects unknown `Host` headers.

## Worktree workflow

Work happens in git worktrees. When creating a new worktree, copy `database/pb_data/` and `.env` into it — neither is tracked, and Pocketbase needs the data dir to start.
