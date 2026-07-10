import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

type NarrateRequestSlide = {
  pageNumber: number
  text: string
}

type NarrateRequestBody = {
  slides: NarrateRequestSlide[]
}

const SYSTEM_PROMPT = `You turn PDF slide content into short spoken narration scripts for a presentation.
For each slide you're given its page number and extracted text. Write a natural, conversational
narration (2-4 sentences) that a presenter would say out loud while showing that slide — summarize
the key point, don't just read the text verbatim, and don't mention "the slide" or "the page".
If the text is empty or just a title/image, write a brief natural transition line instead.

Respond with ONLY a JSON array, no markdown fences, no commentary, matching this shape:
[{"pageNumber": 1, "script": "..."}, ...]`

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 500 },
    )
  }

  const body = (await request.json()) as NarrateRequestBody
  const slides = body.slides ?? []
  if (slides.length === 0) {
    return NextResponse.json({ error: 'No slides provided.' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey })

  const userContent = slides
    .map((slide) => `Page ${slide.pageNumber}:\n${slide.text || '(no extractable text)'}`)
    .join('\n\n---\n\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const textBlock = message.content.find((block) => block.type === 'text')
  const raw = textBlock && textBlock.type === 'text' ? textBlock.text : '[]'

  let narrations: { pageNumber: number; script: string }[] = []
  try {
    narrations = JSON.parse(raw)
  } catch {
    return NextResponse.json(
      { error: 'Model did not return valid JSON.', raw },
      { status: 502 },
    )
  }

  return NextResponse.json({ narrations })
}
