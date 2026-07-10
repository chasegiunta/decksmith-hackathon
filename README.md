# Slide Deck Mode

Upload a PDF → it becomes a narrated slideshow. Claude writes a short spoken script per page,
your browser reads it out loud during "Present" mode.

## How it works

1. The PDF is rendered entirely client-side with `pdfjs-dist` — each page becomes a canvas image,
   and its text is extracted for narration input. No PDF ever touches the server.
2. The extracted text for every page is sent once to `/api/narrate`, which asks Claude for a short,
   conversational narration script per page and returns them as JSON.
3. "Present" mode shows each page full-screen and speaks its script using the browser's built-in
   `speechSynthesis` API (zero cost, zero extra API key), auto-advancing to the next slide when
   narration finishes.

## Setup

```bash
nvm use   # or: nvm install (uses .nvmrc, Node 20+)
npm install
cp .env.local.example .env.local   # then fill in ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000, upload a PDF, wait for narration to generate, hit Present.

## Deploying (for a public URL)

Easiest path: push this repo to GitHub, then import it at https://vercel.com/new — it auto-detects
Next.js. Add `ANTHROPIC_API_KEY` under Project Settings → Environment Variables before your first
deploy (or redeploy after adding it).

## Stretch ideas (if there's time left)

- Swap browser TTS for a nicer voice (OpenAI TTS / ElevenLabs) via a `/api/tts` route.
- Auto-advance through the whole deck instead of one slide at a time.
- Let the user edit/regenerate a slide's script before presenting.
- Export the narrated deck as a video (canvas + audio track).
