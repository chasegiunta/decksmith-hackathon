import { afterEach, describe, expect, it, vi } from 'vitest'
import { HostedAiProvider } from '@/lib/ai'
import type { DeckConfig, ExtractedPdf } from '@/types/deck'

const config: DeckConfig = {
  title: 'A useful deck',
  theme: 'seriph',
  density: 'balanced',
  tone: 'executive',
  includeNotes: true,
  preserveSourceReferences: true,
}

const pdf: ExtractedPdf = {
  fileName: 'source.pdf',
  pageCount: 1,
  pages: [{ pageNumber: 1, text: 'Useful source material for the presentation.', characterCount: 44 }],
}

afterEach(() => vi.unstubAllGlobals())

describe('hosted AI provider', () => {
  it('uses the same-origin generation function without browser credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output: '{"title":"A useful deck","slides":[{"title":"Opening","body":["A clear point"]}]}',
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await new HostedAiProvider().generateDeck({ pdf, config })
    expect(result.slides[0]?.title).toBe('Opening')
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/generate')
    expect(options.headers).toEqual({ 'content-type': 'application/json' })
    expect(JSON.stringify(options.body)).not.toContain('apiKey')
  })
})
