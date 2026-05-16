# LLM emits a single HTML blob, not structured JSON

Gemini returns slide content as one HTML document containing a sequence of `<section class="slide">…</section>` elements; each section is body-only HTML and may include its own `<style>` block and freely chosen layout. The backend (see ADR-0002) returns the blob unchanged in the `/api/slides` response. The frontend splits it with `DOMParser.querySelectorAll('section.slide')`, sanitises each section with DOMPurify (whitelisting `<section>`, `<style>`, `<button>`, and `data-t`), and mounts it in a Shadow Root (see ADR-0001). The alternative — making the model return structured JSON that the frontend renders through a fixed `Slide.tsx`-style component set — was rejected because it caps slide variety at whatever layouts we pre-build, while the explicit goal is for slides to feel intuitive and topic-appropriate (a stat slide for stat-heavy content, a timeline for historical content, a quote slide where a quote anchors the section, etc.). Timestamps follow a single contract — `<button class="ts" data-t="seconds">M:SS</button>` — so a delegated click handler on the deck container can pipe them into `YT.Player.seekTo` regardless of how the surrounding layout looks.

## Consequences

- Output is harder to validate than JSON; we mitigate with strict DOMPurify whitelisting and Shadow DOM isolation rather than with a schema.
- "Regenerate" is the recovery path for a malformed or off-style response — there is no per-field repair.
