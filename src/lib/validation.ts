import { z } from 'zod'
import type { GeneratedDeck } from '@/types/deck'

const slideSchema = z.object({
  title: z.string().trim().min(1).max(140),
  body: z.array(z.string().trim().min(1).max(800)).min(1).max(12),
  speakerNotes: z.string().trim().max(4000).optional(),
  sourcePages: z.array(z.number().int().positive()).max(30).optional(),
})

export const generatedDeckSchema = z.object({
  title: z.string().trim().min(1).max(160),
  slides: z.array(slideSchema).min(1).max(100),
})

export class ModelOutputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelOutputError'
  }
}

function extractJson(raw: string): string {
  const unfenced = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start < 0 || end <= start) throw new ModelOutputError('The AI response did not contain a JSON object.')
  return unfenced.slice(start, end + 1)
}

function decodeJsonField(value: unknown): unknown {
  let decoded = value
  for (let depth = 0; depth < 4 && typeof decoded === 'string'; depth += 1) {
    const candidate = decoded.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const representations = [candidate]
    if (candidate.includes('\\"')) representations.push(candidate.replaceAll('\\"', '"'))
    const attempts = representations.flatMap((representation) => {
      const shaped = [representation]
      const arrayStart = representation.indexOf('[')
      const arrayEnd = representation.lastIndexOf(']')
      const objectStart = representation.indexOf('{')
      const objectEnd = representation.lastIndexOf('}')
      if (arrayStart >= 0 && arrayEnd > arrayStart) shaped.push(representation.slice(arrayStart, arrayEnd + 1))
      if (objectStart >= 0 && objectEnd > objectStart) shaped.push(representation.slice(objectStart, objectEnd + 1))
      return shaped
    })

    let next: unknown = decoded
    for (const attempt of attempts) {
      try {
        next = JSON.parse(attempt) as unknown
        break
      } catch {
        // Try the next safe JSON-shaped representation.
      }
    }
    if (next === decoded) return decoded
    decoded = next
  }
  return decoded
}

function normalizeGeneratedDeck(value: unknown, fallbackTitle?: string): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const deck = value as Record<string, unknown>
  const decodedSlides = decodeJsonField(deck.slides)
  const embeddedDeck = decodedSlides && typeof decodedSlides === 'object' && !Array.isArray(decodedSlides)
    ? decodedSlides as Record<string, unknown>
    : undefined
  const rawSlides = embeddedDeck ? decodeJsonField(embeddedDeck.slides) : decodedSlides
  const slides = Array.isArray(rawSlides)
    ? rawSlides.map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry
        const slide = entry as Record<string, unknown>
        const decodedBody = decodeJsonField(slide.body)
        const body = typeof decodedBody === 'string' && decodedBody.trim() ? [decodedBody] : decodedBody
        return { ...slide, body, sourcePages: decodeJsonField(slide.sourcePages) }
      })
    : decodedSlides
  const fallback = fallbackTitle?.trim().slice(0, 160)
  const suppliedTitle = deck.title ?? embeddedDeck?.title
  const title = (suppliedTitle == null || suppliedTitle === '') && fallback ? fallback : suppliedTitle
  return { ...deck, title, slides }
}

export function parseGeneratedDeck(raw: string, fallbackTitle?: string): GeneratedDeck {
  let value: unknown
  try {
    value = JSON.parse(extractJson(raw))
  } catch (error) {
    if (error instanceof ModelOutputError) throw error
    throw new ModelOutputError('The AI response was not valid JSON. Try generating again.')
  }

  const result = generatedDeckSchema.safeParse(normalizeGeneratedDeck(value, fallbackTitle))
  if (!result.success) {
    const issue = result.error.issues[0]
    const location = issue?.path.join('.') || 'response'
    throw new ModelOutputError(`The AI response failed validation at ${location}: ${issue?.message ?? 'invalid value'}`)
  }
  return result.data
}
