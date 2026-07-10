import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPreviewToken, decodePreviewFiles, extractModuleUrls, verifyPreviewToken } from './preview'

beforeEach(() => {
  process.env.PREVIEW_SESSION_SECRET = 'test-secret-that-is-at-least-thirty-two-characters'
})

afterEach(() => {
  delete process.env.PREVIEW_SESSION_SECRET
})

describe('preview request protection', () => {
  it('round-trips a signed, unexpired preview session', () => {
    const payload = { sandbox: 'sandbox-123', expiresAt: Date.now() + 60_000 }
    expect(verifyPreviewToken(createPreviewToken(payload))).toEqual(payload)
  })

  it('rejects a modified preview session', () => {
    const token = createPreviewToken({ sandbox: 'sandbox-123', expiresAt: Date.now() + 60_000 })
    expect(() => verifyPreviewToken(`${token.slice(0, -1)}x`)).toThrow('invalid')
  })

  it('decodes text and binary project files while rejecting traversal', () => {
    const files = decodePreviewFiles([
      { path: 'slides.md', content: '# Hello', encoding: 'utf8' },
      { path: 'public/cover.png', content: 'AQID', encoding: 'base64' },
    ])
    expect(files[0]?.content).toBe('# Hello')
    expect(files[1]?.content).toEqual(Buffer.from([1, 2, 3]))
    expect(() => decodePreviewFiles([{ path: '../secret', content: '', encoding: 'utf8' }])).toThrow('invalid')
  })

  it('discovers same-origin Vite modules without crawling external assets', () => {
    const modules = extractModuleUrls(`
      <script type="module" src="/@slidev/client/main.ts"></script>
      import { ref } from '/node_modules/.vite/deps/vue.js?v=123'
      export { setup } from './setup.ts'
      import('https://example.com/external.js')
      <link href="/logo.svg">
    `, 'https://sandbox.vercel.run/')
    expect(modules).toEqual([
      'https://sandbox.vercel.run/node_modules/.vite/deps/vue.js?v=123',
      'https://sandbox.vercel.run/setup.ts',
      'https://sandbox.vercel.run/@slidev/client/main.ts',
    ])
  })
})
