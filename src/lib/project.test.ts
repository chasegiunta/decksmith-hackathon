import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createProjectZip } from '@/lib/export'
import { createProjectFiles } from '@/lib/project'
import type { DeckConfig } from '@/types/deck'

const config: DeckConfig = {
  title: 'Quarterly plan',
  variant: 'boardroom',
  accent: '#ff8b38',
  atmosphere: 'mesh',
  logo: '',
  logoInvert: false,
  density: 'airy',
  tone: 'executive',
  includeNotes: true,
  preserveSourceReferences: true,
}

describe('Slidev project generation', () => {
  it('creates a complete runnable Slidev project', () => {
    const files = createProjectFiles('# Hello', config, { 'cover.png': new Uint8Array([1, 2, 3]) })
    expect(files).toHaveProperty('slides.md')
    expect(files).toHaveProperty('package.json')
    expect(files).toHaveProperty('vite.config.ts')
    expect(files).toHaveProperty('global-top.vue')
    expect(files).toHaveProperty('styles/index.css')
    expect(files).toHaveProperty('README.md')
    expect(files).toHaveProperty('public/assets/cover.png')
    expect(files['vite.config.ts']).toContain('allowedHosts: true')
    expect(files['global-top.vue']).toContain("message.type !== 'decksmith:navigate'")
    expect(files['package.json']).toContain('slidev-theme-tahta')
    expect(files['package.json']).toContain('echarts')
  })

  it('exports every project file into a readable zip', async () => {
    const files = createProjectFiles('# Hello', config)
    const blob = await createProjectZip(files)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(['slides.md', 'package.json', 'vite.config.ts', 'global-top.vue', 'styles/index.css', 'README.md']))
    expect(await zip.file('slides.md')?.async('string')).toBe('# Hello')
  })
})
