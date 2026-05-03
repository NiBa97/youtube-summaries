# Youtube Summaries

Placeholder...

## Repo Struktur
- frontend/
- backend/
- database/
- docker-compose.yaml
- Caddyfile
- CLAUDE.md
- README.md

## Technischer Stack
- Pocketbase: Lebt im `database/` Ordner. `pb_data/` ist nur ein Platzhalter (Inhalt git-ignored), `pb_migrations/` wird mitcommittet.
- Vite und Chakra fürs Frontend: https://chakra-ui.com/docs/get-started/frameworks/vite
- Coolify für das Deployment (siehe `docker-compose.preview.yaml`)
- Backend FastAPI wrapped die Youtube-Abfrage. Bekommt eine Video-URL und gibt das Transkript synchron zurück. Im Hintergrund läuft https://github.com/jdepoix/youtube-transcript-api
- Caddy als Reverse-Proxy vor Frontend, Backend (`/api/*`) und Pocketbase (`/pb/*`)

## Technische Grundlagen
- Datenbank erstmal komplett ohne Auth / gleiches gilt für den FastAPI-Server – gehe einfach mal davon aus, dass es nur genau einen User gibt.
- Pocketbase-Änderungen werden alle über die Migrationen unter `database/pb_migrations/` gemanaged.
- **Datenfluss v0**:
  - Frontend ruft `POST /api/transcript` mit der Video-URL auf und bekommt das Transkript direkt im Response zurück (kein Job, kein Polling).
  - Frontend persistiert Video-Metadaten und (sobald implementiert) generierte Slides eigenständig in Pocketbase.
  - Das Transkript selbst wird **nicht** in der Datenbank gespeichert – es kann jederzeit neu vom Backend geholt werden.
- Slides-Generierung kommt später als zweiter Endpoint (`POST /api/slides`) und folgt erstmal dem gleichen synchronen Pattern. Falls die Latenz untragbar wird, wechseln wir auf das Status-/Polling-Modell und schreiben das Slides-Feld direkt aus dem Backend in Pocketbase.
- Arbeitsstruktur erfolgt über Worktrees. Claude soll sich für jeden neuen Worktree die `pb_data/` und `.env` in den Worktree kopieren.

## Lokales Setup

```bash
cp .env.example .env
docker compose up --build
# Frontend / Caddy:        http://localhost
# Backend Swagger (proxied): http://localhost/api/docs
# Pocketbase Admin:        http://localhost/pb/_/
```

Beim ersten Start einen Pocketbase-Admin anlegen:

```bash
docker exec -it yts-pocketbase /usr/local/bin/pocketbase --dir=/pb/pb_data admin create admin@example.com changeme-please-1234
```

## Backend nur, ohne Stack

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
# http://localhost:8000/docs
```
