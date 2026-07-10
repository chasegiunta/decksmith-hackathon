export type PdfPage = {
  pageNumber: number
  imageDataUrl: string
  text: string
}

const RENDER_SCALE = 1.5

// pdfjs-dist touches browser-only globals (DOMMatrix, etc.) at module-evaluation time, which
// breaks Next.js's server-side prerender pass even inside a 'use client' component. Loading it
// lazily, only once this function actually runs in the browser, sidesteps that entirely.
export async function loadPdfPages(file: File): Promise<PdfPage[]> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  const pages: PdfPage[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)

    const viewport = page.getViewport({ scale: RENDER_SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not get canvas context')

    await page.render({ canvasContext: context, viewport, canvas }).promise

    const textContent = await page.getTextContent()
    const text = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ').trim()

    pages.push({
      pageNumber,
      imageDataUrl: canvas.toDataURL('image/png'),
      text,
    })
  }

  return pages
}
