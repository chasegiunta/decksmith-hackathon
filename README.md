# Decksmith

Decksmith is a Vue app that turns a PDF into an editable, runnable Slidev project.

It extracts selectable PDF text locally, sends that text through a server-side Vercel Function to LiteLLM, validates the returned slide JSON, generates `slides.md`, and runs the real Slidev development server in an isolated Vercel Sandbox.

## Requirements

- Node.js 20.19+ or 22.12+
- The LiteLLM environment variables listed in `.env.local.example`
- A Vercel project with Sandbox enabled

## Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. During local development, Vite runs server-only adapters for the generation and preview APIs; deployed builds use Vercel Functions.

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
4. Start the live preview. A Vercel Sandbox restores the preinstalled Slidev environment and opens the deck in an iframe.
5. Download either `slides.md` or a complete project zip with themes, styles, assets, and a README.

The browser calls the same-origin `/api/generate` route. The LiteLLM key is read only by the Vercel Function and is never included in the browser bundle.

## Vercel configuration

Add `LITELLM_BASE_URL`, `LITELLM_API_KEY`, `LITELLM_MODEL`, `PREVIEW_SESSION_SECRET`, and `VERCEL_SANDBOX_SNAPSHOT_ID` in the Vercel project’s environment variables for Production, Preview, and Development. Never prefix these variables with `VITE_`, which would expose them to the client.

### Prepare the Slidev snapshot

Vercel automatically provides Sandbox authentication in production. For local setup, link the checkout and pull a development OIDC token first:

```bash
npx vercel link
npx vercel env pull .env.local
```

Make sure `.env.local` contains the LiteLLM values and a random `PREVIEW_SESSION_SECRET`, then create the reusable environment:

```bash
openssl rand -base64 32
npm run preview:snapshot
```

Copy the printed snapshot ID into `VERCEL_SANDBOX_SNAPSHOT_ID` locally and in Vercel. The snapshot contains Slidev and its themes, so preview sessions do not run `npm install`. Recreate it whenever the generated project dependencies change.

Preview sandboxes use one vCPU, deny outbound network access after restoration, expire after 40 minutes by default, and are deleted when the editor closes whenever the browser can deliver the cleanup request.
