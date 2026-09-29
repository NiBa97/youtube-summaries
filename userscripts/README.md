# Tampermonkey userscript

Adds a **＋ Summarise** button on YouTube watch pages. Runs the same pipeline as the app's *Add video* dialog: `/api/slides` → pick topic/tags → write to Pocketbase.

## Install

1. Edge → Tampermonkey → *Create a new script* → paste `youtube-summaries.user.js` → save.
2. Tampermonkey menu on a YouTube tab → **Set app URL…** (default `http://localhost`; use your tunnel/prod origin, no trailing `/api`).
3. Approve the `@connect` prompt on first request.

Requests use `GM_xmlhttpRequest`, so YouTube's CSP and CORS don't apply. A video already in the library is not overwritten – re-summarise from the app.
