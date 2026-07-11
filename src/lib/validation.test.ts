import { describe, expect, it } from 'vitest'
import { ModelOutputError, parseGeneratedDeck } from '@/lib/validation'

describe('AI JSON validation', () => {
  it('accepts a fenced valid deck and normalizes its values', () => {
    const result = parseGeneratedDeck('```json\n{"title":" Demo ","slides":[{"title":" Intro ","body":[" Point "]}]}\n```')
    expect(result).toEqual({ title: 'Demo', slides: [{ title: 'Intro', body: ['Point'], build: 'none' }] })
  })

  it('rejects malformed JSON before markdown generation', () => {
    expect(() => parseGeneratedDeck('{not json}')).toThrow(ModelOutputError)
  })

  it('rejects output without slides', () => {
    expect(() => parseGeneratedDeck('{"title":"Empty","slides":[]}')).toThrow(/slides/i)
  })

  it('recovers a missing model title from the requested presentation title', () => {
    const result = parseGeneratedDeck('{"slides":[{"title":"Opening","body":["A point"]}]}', 'Requested title')
    expect(result.title).toBe('Requested title')
  })

  it('unwraps JSON-encoded slides returned by the model', () => {
    const result = parseGeneratedDeck('{"slides":"[{\\"title\\":\\"Opening\\",\\"body\\":[\\"A point\\"]}]"}', 'Requested title')
    expect(result).toEqual({ title: 'Requested title', slides: [{ title: 'Opening', body: ['A point'], build: 'none' }] })
  })

  it('unwraps multiply encoded and prefixed slide arrays', () => {
    const slides = JSON.stringify(JSON.stringify([{ title: 'Opening', body: ['A point'] }]))
    const result = parseGeneratedDeck(JSON.stringify({ title: 'Demo', slides: `Generated slides: ${slides}` }))
    expect(result.slides[0]?.title).toBe('Opening')
  })

  it('unwraps a complete deck encoded inside the slides field', () => {
    const embedded = JSON.stringify({ title: 'Embedded title', slides: [{ title: 'Opening', body: ['A point'] }] })
    const result = parseGeneratedDeck(JSON.stringify({ slides: embedded }), 'Fallback title')
    expect(result).toEqual({ title: 'Embedded title', slides: [{ title: 'Opening', body: ['A point'], build: 'none' }] })
  })

  it('normalizes a plain body string without weakening slide validation', () => {
    const result = parseGeneratedDeck('{"title":"Demo","slides":[{"title":"Opening","body":"A point"}]}')
    expect(result.slides[0]?.body).toEqual(['A point'])
  })
})
