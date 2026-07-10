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

export function parseGeneratedDeck(raw: string): GeneratedDeck {
  let value: unknown
  try {
    value = JSON.parse(extractJson(raw))
  } catch (error) {
    if (error instanceof ModelOutputError) throw error
    throw new ModelOutputError('The AI response was not valid JSON. Try generating again.')
  }

  const result = generatedDeckSchema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    const location = issue?.path.join('.') || 'response'
    throw new ModelOutputError(`The AI response failed validation at ${location}: ${issue?.message ?? 'invalid value'}`)
  }
  return result.data
}
