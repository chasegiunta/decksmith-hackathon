import { describe, expect, it } from 'vitest'
import {
  generateMarkdown,
  parseOutline,
  parseSlideSections,
  replaceSlideSection,
  updateMarkdownHeadmatter,
} from '@/lib/markdown'
import type { DeckConfig, GeneratedDeck } from '@/types/deck'

const config: DeckConfig = {
  title: 'A useful deck',
  variant: 'editorial',
  accent: '#0f7cff',
  atmosphere: 'grain',
  logo: '',
  logoInvert: false,
  density: 'balanced',
  tone: 'educational',
  includeNotes: true,
  preserveSourceReferences: true,
}

const deck: GeneratedDeck = {
  title: 'A useful deck',
  slides: [
    {
      title: 'Opening',
      body: ['The setup', 'A literal divider\n---\nmust not split'],
      speakerNotes: 'Say hello.',
      sourcePages: [1],
    },
    { title: 'Outcome', body: ['The result'], sourcePages: [2, 3] },
  ],
}

describe('Slidev markdown generation', () => {
  it('generates headmatter, notes, references, and semantic slides', () => {
    const markdown = generateMarkdown(deck, config)
    expect(markdown).toContain('theme: slidev-theme-tahta')
    expect(markdown).toContain('  variant: editorial')
    expect(markdown).toContain('  accent: "#0f7cff"')
    expect(markdown).toContain('bg: grain')
    expect(markdown).toContain('<!--\nSay hello.\n-->')
    expect(markdown).toContain('Source p. 2, p. 3')
    expect(parseOutline(markdown).map((item) => item.title)).toEqual(['Opening', 'Outcome'])
  })

  it('escapes standalone separators inside generated content', () => {
    const markdown = generateMarkdown(deck, config)
    expect(markdown).toContain('A literal divider\n\\---\nmust not split')
    expect(parseOutline(markdown)).toHaveLength(2)
  })

  it('updates deck config without discarding edited slide content', () => {
    const edited = `${generateMarkdown(deck, config)}\nCustom ending`
    const updated = updateMarkdownHeadmatter(edited, {
      ...config,
      variant: 'signal',
      accent: '#22ddcc',
      title: 'Renamed',
    })
    expect(updated).toContain('  variant: signal')
    expect(updated).toContain('  accent: "#22ddcc"')
    expect(updated).toContain('title: "Renamed"')
    expect(updated).toContain('Custom ending')
  })

  it('replaces one slide while preserving headmatter and neighboring slides', () => {
    const markdown = generateMarkdown(deck, config)
    const updated = replaceSlideSection(markdown, 1, '# Revised outcome\n\n- A better result')
    expect(updated).toContain('theme: slidev-theme-tahta')
    expect(updated).toContain('# Opening')
    expect(updated).toContain('# Revised outcome')
    expect(updated).not.toContain('# Outcome')
    expect(parseSlideSections(updated)).toHaveLength(2)
  })
})
