import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { FormSchema } from '@/lib/form-schema'

export const maxDuration = 60

const SYSTEM_PROMPT = `You design short web form schemas from a plain-English description of what the form is for.

Respond with ONLY a JSON object, no markdown fences, no commentary, matching this shape:
{
  "title": "string",
  "fields": [
    {
      "id": "short_snake_case_id",
      "label": "Human-readable question",
      "type": "text" | "textarea" | "email" | "number" | "date" | "select" | "checkbox",
      "required": true | false,
      "options": ["only present when type is select"]
    }
  ]
}

Keep it to 4-10 fields covering what's actually needed for the described form. Use "textarea" for
anything that needs more than a short answer, "select" (with 2-6 sensible "options") for a fixed
set of choices, and "checkbox" for yes/no or agreement questions. Every "id" must be unique.`

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 500 },
    )
  }

  const { prompt } = (await request.json()) as { prompt?: string }
  if (!prompt || !prompt.trim()) {
    return NextResponse.json({ error: 'A description of the form is required.' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = message.content.find((block) => block.type === 'text')
  const raw = textBlock && textBlock.type === 'text' ? textBlock.text : '{}'

  let schema: FormSchema
  try {
    schema = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Model did not return valid JSON.', raw }, { status: 502 })
  }

  return NextResponse.json({ schema })
}
