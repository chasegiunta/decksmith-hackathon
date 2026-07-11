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
}

const deck: GeneratedDeck = {
  title: 'A useful deck',
  slides: [
    {
      title: 'Opening',
      body: ['The setup', 'A literal divider\n---\nmust not split'],
      build: 'none',
    },
    { title: 'Outcome', body: ['The result'], build: 'none' },
  ],
}

describe('Slidev markdown generation', () => {
  it('generates headmatter and semantic slides', () => {
    const markdown = generateMarkdown(deck, config)
    expect(markdown).toContain('theme: slidev-theme-tahta')
    expect(markdown).toContain('aspectRatio: 3/2')
    expect(markdown).toContain('  variant: editorial')
    expect(markdown).toContain('  accent: "#0f7cff"')
    expect(markdown).toContain('bg: grain')
    expect(markdown).not.toContain('speakerNotes')
    expect(markdown).not.toContain('sourcePages')
    expect(parseOutline(markdown).map((item) => item.title)).toEqual(['Opening', 'Outcome'])
  })

  it('escapes standalone separators inside generated content', () => {
    const markdown = generateMarkdown(deck, config)
    expect(markdown).toContain('A literal divider\n\\---\nmust not split')
    expect(parseOutline(markdown)).toHaveLength(2)
  })

  it('adds click builds only when the model identifies an opportunity', () => {
    const markdown = generateMarkdown({
      ...deck,
      slides: [
        { title: 'A process', body: ['Discover', 'Design', 'Deliver'], build: 'sequential' },
        { title: 'Two at a time', body: ['Before', 'After', 'Risk', 'Reward'], build: 'pairs' },
        { title: 'Static', body: ['One', 'Two'], build: 'none' },
      ],
    }, config)
    expect(markdown).toContain('clickAnimation: fade')
    expect(markdown).toContain('<v-clicks>\n\n- Discover')
    expect(markdown).toContain('<v-clicks every="2">\n\n- Before')
    expect(markdown).toContain('# Static\n\n- One\n- Two')
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
