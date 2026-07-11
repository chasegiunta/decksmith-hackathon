import { describe, expect, it } from 'vitest'
import { randomDeckAtmosphere, randomThemeVariant, themeOptions } from '@/lib/themes'

describe('deck design defaults', () => {
  it('randomizes across every available theme', () => {
    expect(randomThemeVariant(() => 0)).toBe(themeOptions[0]?.value)
    expect(randomThemeVariant(() => 0.9999)).toBe(themeOptions.at(-1)?.value)
  })

  it('limits randomized backgrounds to aurora, grid, and dots', () => {
    expect(randomDeckAtmosphere(() => 0)).toBe('aurora')
    expect(randomDeckAtmosphere(() => 0.34)).toBe('grid')
    expect(randomDeckAtmosphere(() => 0.9999)).toBe('dots')
  })
})
