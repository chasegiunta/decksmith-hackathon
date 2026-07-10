# Decksmith

Decksmith is a browser-only Vue app that turns a PDF into an editable, runnable Slidev project.

It extracts selectable PDF text locally, sends that text through a server-side Vercel Function to LiteLLM, validates the returned slide JSON, generates `slides.md`, and runs the real Slidev development server inside a WebContainer.

## Requirements

- Node.js 20.19+ or 22.12+
- A Chromium-based browser with WebContainer support
- The LiteLLM environment variables listed in `.env.local.example`

## Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. During local development, Vite runs a server-only adapter for `/api/generate`; deployed builds use the Vercel Function in `api/generate.ts`.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Browser flow

1. Upload a text-based PDF (up to 25 MB and 80 pages).
2. Configure the deck and create the first draft.
3. Generate validated slide data and edit the resulting Slidev markdown.
4. Start the live preview. The first boot installs Slidev inside the browser and can take a minute.
5. Download either `slides.md` or a complete project zip with themes, styles, assets, and a README.

The browser calls the same-origin `/api/generate` route. The LiteLLM key is read only by the Vercel Function and is never included in the browser bundle.

## Vercel configuration

Add `LITELLM_BASE_URL`, `LITELLM_API_KEY`, and `LITELLM_MODEL` in the Vercel project’s environment variables for Production, Preview, and Development. Never prefix these variables with `VITE_`, which would expose them to the client.
