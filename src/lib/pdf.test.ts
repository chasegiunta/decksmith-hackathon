import { describe, expect, it } from 'vitest'
import { PdfExtractionError, validateExtractedPages } from '@/lib/pdf-guards'
import { isUsefulImage, sampledHash } from '@/lib/pdf-image-utils'

describe('PDF text guards', () => {
  it('rejects an empty PDF extraction', () => {
    expect(() => validateExtractedPages([{ pageNumber: 1, text: '', characterCount: 0 }])).toThrow(PdfExtractionError)
  })

  it('rejects a likely scanned PDF with negligible selectable text', () => {
    expect(() => validateExtractedPages([
      { pageNumber: 1, text: '1', characterCount: 1 },
      { pageNumber: 2, text: '2', characterCount: 1 },
    ])).toThrow(/OCR-enabled PDF/)
  })

  it('accepts useful extracted text', () => {
    expect(() => validateExtractedPages([{ pageNumber: 1, text: 'A meaningful paragraph with enough content.', characterCount: 41 }])).not.toThrow()
  })
})

describe('PDF image filtering', () => {
  it('keeps presentation-sized visuals and rejects decorative icons', () => {
    expect(isUsefulImage({ width: 900, height: 500 })).toBe(true)
    expect(isUsefulImage({ width: 32, height: 32 })).toBe(false)
  })

  it('produces the same sampled hash for repeated image data', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6])
    expect(sampledHash(data, 900, 500)).toBe(sampledHash(data, 900, 500))
    expect(sampledHash(data, 900, 500)).not.toBe(sampledHash(data, 500, 900))
  })
})
