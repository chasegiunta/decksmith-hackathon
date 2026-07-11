import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../api/generate'
import type { VercelRequest, VercelResponse } from '@vercel/node'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('generation function', () => {
  it('requires a structured deck tool call from LiteLLM', async () => {
    vi.stubEnv('LITELLM_API_KEY', 'test-key')
    vi.stubEnv('LITELLM_BASE_URL', 'https://example.test')
    vi.stubEnv('LITELLM_MODEL', 'test-model')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{ function: { name: 'submit_deck', arguments: '{"title":"Demo","slides":[{"title":"Opening","body":["A point"],"build":"none"}]}' } }] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const json = vi.fn()
    const response = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json,
    } as unknown as VercelResponse
    const request = {
      method: 'POST',
      body: {
        pdf: {
          fileName: 'source.pdf',
          pages: [{ pageNumber: 1, text: 'Useful source material.' }],
          images: [{
            id: 'pdf-p1-chart.webp',
            pageNumber: 1,
            width: 900,
            height: 500,
            previewDataUrl: 'data:image/webp;base64,AAAA',
          }],
        },
        config: { title: 'Demo', density: 'balanced', tone: 'executive' },
      },
    } as VercelRequest

    await handler(request, response)

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const upstreamBody = JSON.parse(String(options.body)) as {
      tools?: Array<{ function?: { name?: string; parameters?: unknown } }>
      tool_choice?: { function?: { name?: string } }
      messages?: Array<{ content?: unknown }>
    }
    expect(upstreamBody.tools?.[0]?.function?.name).toBe('submit_deck')
    expect(upstreamBody.tool_choice?.function?.name).toBe('submit_deck')
    expect(JSON.stringify(upstreamBody.tools?.[0]?.function?.parameters)).toContain('sequential')
    expect(JSON.stringify(upstreamBody.tools?.[0]?.function?.parameters)).toContain('imageAlt')
    expect(JSON.stringify(upstreamBody.tools?.[0]?.function?.parameters)).toContain('pdf-p1-chart.webp')
    expect(JSON.stringify(upstreamBody.messages?.[1]?.content)).toContain('data:image/webp;base64,AAAA')
    expect(String(options.body)).not.toContain('speakerNotes')
    expect(String(options.body)).not.toContain('sourcePages')
    expect(response.status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith({ output: '{"title":"Demo","slides":[{"title":"Opening","body":["A point"],"build":"none"}]}' })
  })
})
