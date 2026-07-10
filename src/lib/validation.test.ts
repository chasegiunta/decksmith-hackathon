import { describe, expect, it } from 'vitest'
import { ModelOutputError, parseGeneratedDeck } from '@/lib/validation'

describe('AI JSON validation', () => {
  it('accepts a fenced valid deck and normalizes its values', () => {
    const result = parseGeneratedDeck('```json\n{"title":" Demo ","slides":[{"title":" Intro ","body":[" Point "]}]}\n```')
    expect(result).toEqual({ title: 'Demo', slides: [{ title: 'Intro', body: ['Point'] }] })
  })

  it('rejects malformed JSON before markdown generation', () => {
    expect(() => parseGeneratedDeck('{not json}')).toThrow(ModelOutputError)
  })

  it('rejects output without slides', () => {
    expect(() => parseGeneratedDeck('{"title":"Empty","slides":[]}')).toThrow(/slides/i)
  })
})
