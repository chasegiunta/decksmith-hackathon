import { describe, expect, it } from 'vitest'
import { serializeProjectFiles } from './useVercelPreview'

describe('Vercel preview file transport', () => {
  it('serializes text and binary project files safely', () => {
    expect(serializeProjectFiles({
      'slides.md': '# Hello',
      'public/cover.png': new Uint8Array([1, 2, 3]),
    })).toEqual([
      { path: 'slides.md', content: '# Hello', encoding: 'utf8' },
      { path: 'public/cover.png', content: 'AQID', encoding: 'base64' },
    ])
  })
})
