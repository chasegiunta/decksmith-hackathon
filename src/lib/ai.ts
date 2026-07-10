import type { DeckConfig, ExtractedPdf, GeneratedDeck } from '@/types/deck'
import { parseGeneratedDeck } from '@/lib/validation'

export interface DeckGenerationInput {
  pdf: ExtractedPdf
  config: DeckConfig
}

export interface AiProvider {
  generateDeck(input: DeckGenerationInput): Promise<GeneratedDeck>
}

export class MissingApiKeyError extends Error {
  constructor() {
    super('Add an Anthropic API key before generating a deck.')
    this.name = 'MissingApiKeyError'
  }
}

function systemPrompt(config: DeckConfig): string {
  return `You are an expert presentation editor. Rewrite source material into a coherent Slidev deck.

Return JSON only, with this exact shape:
{"title":"Deck title","slides":[{"title":"Slide title","body":["concise point"],"speakerNotes":"optional notes","sourcePages":[1]}]}

Rules:
- Organize by topic and narrative, never one slide per source page by default.
- Split dense single-page material into multiple semantic slides.
- Preserve factual meaning. Do not invent statistics, names, or conclusions.
- Each slide needs 1-8 useful body points. Prefer fragments over paragraphs.
- Tone: ${config.tone}. Density: ${config.density}.
- ${config.includeNotes ? 'Include helpful speakerNotes for every substantive slide.' : 'Omit speakerNotes.'}
- ${config.preserveSourceReferences ? 'Include accurate sourcePages for each slide.' : 'sourcePages may be omitted.'}
- Do not emit Markdown fences, commentary, or fields outside the schema.`
}

function sourcePrompt(pdf: ExtractedPdf, config: DeckConfig): string {
  const pages = pdf.pages.map((page) => `[[SOURCE PAGE ${page.pageNumber}]]\n${page.text}`).join('\n\n')
  const clipped = pages.slice(0, 180_000)
  return `Requested deck title: ${config.title || 'Infer a clear title from the source'}\nSource file: ${pdf.fileName}\n\n${clipped}`
}

export class AnthropicBrowserProvider implements AiProvider {
  private readonly apiKey: string
  private readonly model: string

  constructor(apiKey: string, model = 'claude-sonnet-5') {
    if (!apiKey.trim()) throw new MissingApiKeyError()
    this.apiKey = apiKey.trim()
    this.model = model
  }

  async generateDeck(input: DeckGenerationInput): Promise<GeneratedDeck> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 12_000,
        system: systemPrompt(input.config),
        messages: [{ role: 'user', content: sourcePrompt(input.pdf, input.config) }],
      }),
    })

    const payload = await response.json().catch(() => null) as {
      content?: Array<{ type: string; text?: string }>
      error?: { message?: string }
    } | null
    if (!response.ok) {
      throw new Error(payload?.error?.message || `Anthropic request failed (${response.status}).`)
    }
    const raw = payload?.content?.filter((block) => block.type === 'text').map((block) => block.text ?? '').join('\n') ?? ''
    return parseGeneratedDeck(raw)
  }
}
