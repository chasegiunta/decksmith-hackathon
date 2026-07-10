import { describe, expect, it } from 'vitest'
import { PdfExtractionError, validateExtractedPages } from '@/lib/pdf-guards'

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
