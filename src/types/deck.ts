export type ThemeName = 'default' | 'seriph' | 'apple-basic'
export type Density = 'airy' | 'balanced' | 'dense'
export type Tone = 'executive' | 'educational' | 'persuasive' | 'conversational'

export interface DeckConfig {
  title: string
  theme: ThemeName
  density: Density
  tone: Tone
  includeNotes: boolean
  preserveSourceReferences: boolean
}

export interface SourcePage {
  pageNumber: number
  text: string
  characterCount: number
}

export interface ExtractedPdf {
  fileName: string
  pageCount: number
  pages: SourcePage[]
  coverPng?: Uint8Array
}

export interface GeneratedSlide {
  title: string
  body: string[]
  speakerNotes?: string
  sourcePages?: number[]
}

export interface GeneratedDeck {
  title: string
  slides: GeneratedSlide[]
}

export type ProjectFile = string | Uint8Array
export type ProjectFiles = Record<string, ProjectFile>
