# Gemini call goes through the FastAPI backend

Slide generation runs server-side: the frontend POSTs `{url}` to `POST /api/slides`, the backend fetches the transcript (sharing the helper used by `/api/transcript`), formats it as `[seconds] text` lines, calls Gemini with the system prompt baked in, and returns `{slides_html, video_id}`. The Gemini API key lives in the backend's `.env` as `GEMINI_API_KEY` and never reaches the browser. The main reason is testability: slide generation can be exercised with a single `curl` against `/api/slides` and unit-tested in `pytest` with the Gemini client mocked, instead of having to drive the browser to reproduce a generation bug. It also keeps the system prompt and the `<section class="slide">` output contract in one place (`backend/app/prompts.py`, `backend/app/gemini.py`) rather than split between languages.

## Considered Options

- **BYOK from the browser** — fewer moving parts, no server-side secret, but every test path requires the browser and the key is exposed to anything that runs JS in the page.
- **Backend orchestrates the entire flow** (fetch + Gemini + Pocketbase write) — slightly cleaner for the frontend but couples the backend to Pocketbase and duplicates state. Rejected for v1: the frontend already owns the Pocketbase record lifecycle, and `/api/slides` is easier to reason about as a pure transform `(url) → slides_html`.

## Consequences

- The backend now needs `google-genai` (the current Gemini SDK; `google-generativeai` is end-of-life) as a dependency and a `GEMINI_API_KEY` env var. `.env.example` documents it.
- Frontend still sanitises the returned HTML with DOMPurify before mounting it into a Shadow Root — the backend is trusted but defence-in-depth is cheap and the same sanitiser will be needed if `slides_html` is ever read back from Pocketbase rather than freshly generated.
