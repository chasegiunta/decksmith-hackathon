import type { SourcePage } from '@/types/deck'

export class PdfExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfExtractionError'
  }
}

export function validateExtractedPages(pages: SourcePage[]): void {
  const totalCharacters = pages.reduce((sum, page) => sum + page.characterCount, 0)
  if (totalCharacters === 0) {
    throw new PdfExtractionError('No selectable text was found. This PDF may be empty or image-only.')
  }
  if (totalCharacters < Math.max(24, pages.length * 8)) {
    throw new PdfExtractionError('There is too little selectable text to build a deck. Try an OCR-enabled PDF.')
  }
}
