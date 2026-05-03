# Backend

FastAPI wrapper around [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api).

## Endpoints

- `GET /health` — liveness probe
- `POST /transcript` — body `{ "url": "<video url or id>", "languages": ["de","en"] }` → transcript snippets
- `GET /docs` — Swagger UI

## Local dev (uv)

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs.

## Docker

```bash
docker compose up --build backend
```

## Manual test

```bash
curl -s -X POST http://localhost:8000/transcript \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","languages":["en"]}' | jq .
```
