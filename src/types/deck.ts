export type TahtaVariant =
  | 'editorial'
  | 'brutalist'
  | 'soft'
  | 'minimal'
  | 'paper'
  | 'atelier'
  | 'notebook'
  | 'lagoon'
  | 'press'
  | 'boardroom'
  | 'signal'
  | 'muse'
  | 'poster'
export type DeckAtmosphere = 'none' | 'mesh' | 'aurora' | 'grain' | 'dots' | 'grid'
export type Density = 'airy' | 'balanced' | 'dense'
export type Tone = 'executive' | 'educational' | 'persuasive' | 'conversational'
export type SlideBuild = 'none' | 'sequential' | 'pairs'

export interface DeckConfig {
  title: string
  variant: TahtaVariant
  accent: string
  atmosphere: DeckAtmosphere
  logo: string
  logoInvert: boolean
  density: Density
  tone: Tone
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
  build: SlideBuild
}

export interface GeneratedDeck {
  title: string
  slides: GeneratedSlide[]
}

export type ProjectFile = string | Uint8Array
export type ProjectFiles = Record<string, ProjectFile>
