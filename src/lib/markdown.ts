import type { DeckConfig, GeneratedDeck, GeneratedSlide } from '@/types/deck'

function yamlString(value: string): string {
  return JSON.stringify(value.replace(/[\r\n]+/g, ' ').trim())
}

function escapeSlideSeparators(value: string): string {
  return value.replace(/(^|\n)(\s*)---(?=\s*(?:\n|$))/g, '$1$2\\---')
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function buildHeadmatter(config: DeckConfig): string {
  const lines = [
    '---',
    'theme: slidev-theme-tahta',
    'aspectRatio: 3/2',
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
    'clickAnimation: fade',
    'mdc: true',
    '---',
  )
  return lines.join('\n')
}

function slideToMarkdown(slide: GeneratedSlide): string {
  const lines = [`# ${escapeSlideSeparators(slide.title)}`, '']
  const bodyLines: string[] = []
  const usesBuild = slide.build !== 'none' && slide.body.length > 1
  if (usesBuild) bodyLines.push(slide.build === 'pairs' ? '<v-clicks every="2">' : '<v-clicks>', '')
  for (const point of slide.body) bodyLines.push(`- ${escapeSlideSeparators(point)}`)
  if (usesBuild) bodyLines.push('', '</v-clicks>')

  if (slide.image && /^[a-z0-9][a-z0-9._-]*$/.test(slide.image)) {
    lines.push(
      '<div class="decksmith-visual-slide">',
      '<div class="decksmith-visual-copy">',
      ...bodyLines,
      '</div>',
      `<img :src="'/assets/${slide.image}'" alt="${escapeHtmlAttribute(slide.imageAlt || slide.title)}" />`,
      '</div>',
    )
  } else {
    lines.push(...bodyLines)
  }

  return lines.join('\n').trim()
}

export function generateMarkdown(deck: GeneratedDeck, config: DeckConfig): string {
  const slides = deck.slides.map(slideToMarkdown)
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

export interface SlideSection extends OutlineItem {
  content: string
}

interface MarkdownDocument {
  headmatter: string
  slides: string[]
}

function splitMarkdownDocument(markdown: string): MarkdownDocument {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)
  const headmatter = match?.[0].trimEnd() ?? ''
  const body = markdown.slice(match?.[0].length ?? 0).replace(/^\r?\n?/, '')
  return {
    headmatter,
    slides: body
      .split(/\n\s*---\s*\n/g)
      .map((slide) => slide.trim())
      .filter(Boolean),
  }
}

export function parseSlideSections(markdown: string): SlideSection[] {
  return splitMarkdownDocument(markdown).slides.map((content, index) => {
    const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim()
    return { index, title: heading || `Slide ${index + 1}`, content }
  })
}

export function replaceSlideSection(markdown: string, index: number, content: string): string {
  const document = splitMarkdownDocument(markdown)
  if (!document.slides[index]) return markdown
  document.slides[index] = content.trim()
  const prefix = document.headmatter ? `${document.headmatter}\n\n` : ''
  return `${prefix}${document.slides.join('\n\n---\n\n')}\n`
}

export function parseOutline(markdown: string): OutlineItem[] {
  return parseSlideSections(markdown).map(({ index, title }) => ({ index, title }))
}

export const markdownInternals = { escapeHtmlAttribute, escapeSlideSeparators }
