# Decksmith

Decksmith is a browser-only Vue app that turns a PDF into an editable, runnable Slidev project.

It extracts selectable PDF text locally, asks Anthropic to reorganize the source by topic, validates the returned slide JSON, generates `slides.md`, and runs the real Slidev development server inside a WebContainer. Nothing requires a local backend.

## Requirements

- Node.js 20.19+ or 22.12+
- A Chromium-based browser with WebContainer support
- An Anthropic API key for generation

## Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The development server sends matching `credentialless` cross-origin isolation headers required by WebContainers while allowing its cross-origin runtime assets to load.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Browser flow

1. Upload a text-based PDF (up to 25 MB and 80 pages).
2. Configure the deck and enter an Anthropic API key.
3. Generate validated slide data and edit the resulting Slidev markdown.
4. Start the live preview. The first boot installs Slidev inside the browser and can take a minute.
5. Download either `slides.md` or a complete project zip with themes, styles, assets, and a README.

API access is isolated behind `AiProvider` in `src/lib/ai.ts`, so a hosted provider can replace browser BYOK later without changing the editor or export pipeline.
