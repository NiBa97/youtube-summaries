# Shadow DOM for AI-generated slide isolation

LLM-generated slide HTML may include arbitrary `<style>` blocks and class names. Rendering it directly into the app DOM would let LLM CSS leak into app chrome (and vice versa), and namespacing rules ("prefix every selector with `.ai-slide`") rely on LLM compliance and break the first time the model forgets. We render each `<section class="slide">` into its own Shadow Root, which gives true CSS encapsulation while letting click events bubble out via `composedPath` (so a single delegated handler on the deck container can intercept `<button class="ts" data-t="…">` and call `YT.Player.seekTo`). Theme tokens (`--ink`, `--bg`, `--accent`, `--serif`, …) cross the shadow boundary as CSS custom properties, so slides inherit the active app theme without the LLM having to know about it.

## Considered Options

- **`<iframe srcdoc>` per slide** — strongest isolation but click-to-seek requires `postMessage` plumbing and theme vars must be re-injected per frame.
- **CSS namespacing via prompt instruction** — fragile; one LLM mistake breaks the app chrome.
- **No isolation** — guaranteed style collisions both directions.
