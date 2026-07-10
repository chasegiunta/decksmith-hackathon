import type { DeckConfig, GeneratedDeck, GeneratedSlide } from '@/types/deck'

function yamlString(value: string): string {
  return JSON.stringify(value.replace(/[\r\n]+/g, ' ').trim())
}

function escapeSlideSeparators(value: string): string {
  return value.replace(/(^|\n)(\s*)---(?=\s*(?:\n|$))/g, '$1$2\\---')
}

function escapeCommentEnd(value: string): string {
  return value.replaceAll('-->', '—>')
}

export function buildHeadmatter(config: DeckConfig): string {
  const lines = [
    '---',
    'theme: slidev-theme-tahta',
    `title: ${yamlString(config.title || 'Untitled deck')}`,
    'themeConfig:',
    `  variant: ${config.variant}`,
    `  accent: ${yamlString(config.accent)}`,
    '  lang: en',
  ]
  if (config.logo.trim()) lines.push(`  logo: ${yamlString(config.logo)}`)
  if (config.logoInvert) lines.push('  logoInvert: true')
  if (config.atmosphere !== 'none') lines.push(`bg: ${config.atmosphere}`)
  lines.push(
    'layout: cover',
    'drawings:',
    '  persist: false',
    'transition: slide-left',
    'mdc: true',
    '---',
  )
  return lines.join('\n')
}

function slideToMarkdown(slide: GeneratedSlide, config: DeckConfig): string {
  const lines = [`# ${escapeSlideSeparators(slide.title)}`, '']
  for (const point of slide.body) lines.push(`- ${escapeSlideSeparators(point)}`)

  if (config.preserveSourceReferences && slide.sourcePages?.length) {
    lines.push('', `<div class="source-ref">Source ${slide.sourcePages.map((page) => `p. ${page}`).join(', ')}</div>`)
  }

  if (config.includeNotes && slide.speakerNotes) {
    lines.push('', '<!--', escapeCommentEnd(slide.speakerNotes), '-->')
  }

  return lines.join('\n').trim()
}

export function generateMarkdown(deck: GeneratedDeck, config: DeckConfig): string {
  const slides = deck.slides.map((slide) => slideToMarkdown(slide, config))
  return `${buildHeadmatter({ ...config, title: config.title || deck.title })}\n\n${slides.join('\n\n---\n\n')}\n`
}

export function updateMarkdownHeadmatter(markdown: string, config: DeckConfig): string {
  const headmatter = buildHeadmatter(config)
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)
  if (!match) return `${headmatter}\n\n${markdown.trimStart()}`
  return `${headmatter}\n${markdown.slice(match[0].length).replace(/^\r?\n?/, '\n')}`
}

export interface OutlineItem {
  index: number
  title: string
}

export function parseOutline(markdown: string): OutlineItem[] {
  const withoutHeadmatter = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
  const chunks = withoutHeadmatter.split(/\n\s*---\s*\n/g)
  return chunks.map((chunk, index) => {
    const heading = chunk.match(/^#\s+(.+)$/m)?.[1]?.trim()
    return { index, title: heading || `Slide ${index + 1}` }
  }).filter((item, index) => item.title !== `Slide ${index + 1}` || chunks[index]?.trim())
}

export const markdownInternals = { escapeSlideSeparators }
