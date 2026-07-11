import type { DeckAtmosphere, TahtaVariant } from '@/types/deck'

export interface ThemeOption {
  value: TahtaVariant
  label: string
  description: string
  fit: string
  dark: boolean
  canvas: string
  surface: string
  ink: string
  accent: string
}

export const themeOptions: ThemeOption[] = [
  { value: 'editorial', label: 'Editorial', description: 'Elegant serif type with quiet depth.', fit: 'Reports & keynotes', dark: true, canvas: '#101114', surface: '#17191e', ink: '#f2efe9', accent: '#7da2ff' },
  { value: 'brutalist', label: 'Brutalist', description: 'Technical, direct, and intentionally raw.', fit: 'Engineering & data', dark: true, canvas: '#080908', surface: '#141513', ink: '#f5f6ee', accent: '#b7ff00' },
  { value: 'soft', label: 'Soft', description: 'Warm, rounded, and approachable.', fit: 'Products & people', dark: false, canvas: '#f6f1e8', surface: '#fffaf2', ink: '#20201f', accent: '#ff6846' },
  { value: 'minimal', label: 'Minimal', description: 'Swiss clarity with generous whitespace.', fit: 'Strategy & updates', dark: false, canvas: '#ffffff', surface: '#f5f5f4', ink: '#171717', accent: '#f04438' },
  { value: 'paper', label: 'Paper', description: 'Tactile, literary, and quietly expressive.', fit: 'Stories & research', dark: false, canvas: '#f4efe3', surface: '#fffaf0', ink: '#25211d', accent: '#c45732' },
  { value: 'atelier', label: 'Atelier', description: 'Polished gradients with studio energy.', fit: 'Creative pitches', dark: true, canvas: '#0b0c14', surface: '#151726', ink: '#f4f4ff', accent: '#7b84ff' },
  { value: 'notebook', label: 'Notebook', description: 'Ruled-paper cues for guided learning.', fit: 'Teaching & workshops', dark: false, canvas: '#fbfcff', surface: '#ffffff', ink: '#1e2742', accent: '#315bd6' },
  { value: 'lagoon', label: 'Lagoon', description: 'Calm deep teal with rounded surfaces.', fit: 'Modern products', dark: true, canvas: '#082825', surface: '#103b36', ink: '#e8fffa', accent: '#50d8c8' },
  { value: 'press', label: 'Press', description: 'High-contrast newsprint and sharp rules.', fit: 'Briefings & journalism', dark: false, canvas: '#faf9f5', surface: '#ffffff', ink: '#151515', accent: '#c5221f' },
  { value: 'boardroom', label: 'Boardroom', description: 'Confident navy built for decisions.', fit: 'Leadership & finance', dark: true, canvas: '#0d1d34', surface: '#172945', ink: '#f3f7ff', accent: '#ff8b38' },
  { value: 'signal', label: 'Signal', description: 'Electric contrast with launch-day glow.', fit: 'Demos & launches', dark: true, canvas: '#000000', surface: '#0c1515', ink: '#f1ffff', accent: '#11ded1' },
  { value: 'muse', label: 'Muse', description: 'Thoughtful stone tones and classic serif.', fit: 'Ideas & insight', dark: false, canvas: '#ded3bd', surface: '#eee6d6', ink: '#2f3827', accent: '#66734d' },
  { value: 'poster', label: 'Poster', description: 'Big condensed type and energetic rules.', fit: 'Events & bold ideas', dark: false, canvas: '#f5efe2', surface: '#fff9ee', ink: '#201c17', accent: '#f04426' },
]

export const atmosphereOptions: Array<{ value: DeckAtmosphere; label: string; description: string }> = [
  { value: 'none', label: 'Plain', description: 'Let the typography lead' },
  { value: 'mesh', label: 'Mesh', description: 'Soft dimensional color' },
  { value: 'aurora', label: 'Aurora', description: 'A gentle luminous wash' },
  { value: 'grain', label: 'Grain', description: 'Subtle tactile texture' },
  { value: 'dots', label: 'Dots', description: 'A precise dotted field' },
  { value: 'grid', label: 'Grid', description: 'Structured technical lines' },
]

export const accentPresets = ['#0f7cff', '#ff5a36', '#f5b700', '#2abf88', '#8b5cf6', '#ec4899']

const defaultAtmospheres: DeckAtmosphere[] = ['aurora', 'grid', 'dots']

function randomItem<T>(items: readonly T[], random: () => number): T {
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(random() * items.length)))
  return items[index] as T
}

export function randomThemeVariant(random: () => number = Math.random): TahtaVariant {
  return randomItem(themeOptions, random).value
}

export function randomDeckAtmosphere(random: () => number = Math.random): DeckAtmosphere {
  return randomItem(defaultAtmospheres, random)
}
