import type { DeckConfig, ExtractedPdf, GeneratedDeck } from '@/types/deck'
import { parseGeneratedDeck } from '@/lib/validation'

export interface DeckGenerationInput {
  pdf: ExtractedPdf
  config: DeckConfig
}

export interface AiProvider {
  generateDeck(input: DeckGenerationInput): Promise<GeneratedDeck>
}

export class HostedAiProvider implements AiProvider {
  async generateDeck(input: DeckGenerationInput): Promise<GeneratedDeck> {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: input.config,
        pdf: {
          fileName: input.pdf.fileName,
          pages: input.pdf.pages.map(({ pageNumber, text }) => ({ pageNumber, text })),
          images: input.pdf.images.map(({ id, pageNumber, width, height, previewDataUrl }) => ({
            id,
            pageNumber,
            width,
            height,
            previewDataUrl,
          })),
        },
      }),
    })
    const payload = await response.json().catch(() => null) as {
      output?: string
      error?: string
    } | null
    if (!response.ok) {
      throw new Error(payload?.error || `Presentation generation failed (${response.status}).`)
    }
    if (!payload?.output) throw new Error('The presentation service returned an empty response. Try again.')
    const fallbackTitle = input.config.title || input.pdf.fileName.replace(/\.pdf$/i, '')
    return parseGeneratedDeck(payload.output, fallbackTitle, input.pdf.images.map(({ id }) => id))
  }
}
