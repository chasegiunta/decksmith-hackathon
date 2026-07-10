import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { ExtractedPdf, SourcePage } from '@/types/deck'
import { PdfExtractionError, validateExtractedPages } from '@/lib/pdf-guards'

export { PdfExtractionError, validateExtractedPages } from '@/lib/pdf-guards'

GlobalWorkerOptions.workerSrc = workerUrl

export const MAX_PDF_BYTES = 25 * 1024 * 1024
export const MAX_PDF_PAGES = 80

async function renderCover(pdf: PDFDocumentProxy): Promise<Uint8Array | undefined> {
  if (typeof document === 'undefined') return undefined
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 0.45 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) return undefined
  await page.render({ canvas, canvasContext: context, viewport }).promise
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.84))
  return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined
}

export async function extractPdf(file: File, onProgress?: (current: number, total: number) => void): Promise<ExtractedPdf> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new PdfExtractionError('Choose a PDF file to continue.')
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new PdfExtractionError('This PDF is larger than 25 MB. Reduce its size and try again.')
  }

  let pdf: PDFDocumentProxy
  try {
    pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  } catch {
    throw new PdfExtractionError('This PDF could not be opened. It may be damaged or password protected.')
  }

  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new PdfExtractionError(`This PDF has ${pdf.numPages} pages. The current limit is ${MAX_PDF_PAGES}.`)
  }

  const pages: SourcePage[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    pages.push({ pageNumber, text, characterCount: text.length })
    onProgress?.(pageNumber, pdf.numPages)
  }

  validateExtractedPages(pages)
  const coverPng = await renderCover(pdf)
  return { fileName: file.name, pageCount: pdf.numPages, pages, coverPng }
}
