import {
  GlobalWorkerOptions,
  ImageKind,
  OPS,
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { ExtractedPdf, ExtractedPdfImage, SourcePage } from '@/types/deck'
import { PdfExtractionError, validateExtractedPages } from '@/lib/pdf-guards'
import { isUsefulImage, sampledHash } from '@/lib/pdf-image-utils'

export { PdfExtractionError, validateExtractedPages } from '@/lib/pdf-guards'

GlobalWorkerOptions.workerSrc = workerUrl

export const MAX_PDF_BYTES = 25 * 1024 * 1024
export const MAX_PDF_PAGES = 80
export const MAX_PDF_IMAGES = 16
const MAX_IMAGES_PER_PAGE = 3
const MAX_IMAGE_EDGE = 1_280
const THUMBNAIL_EDGE = 320

interface PdfImageObject {
  width: number
  height: number
  kind?: number
  data?: Uint8Array | Uint8ClampedArray
  bitmap?: ImageBitmap
}

interface EncodedImage {
  data: Uint8Array
  extension: 'webp' | 'png'
  previewDataUrl: string
}

function imageDataFromPdf(image: PdfImageObject, context: CanvasRenderingContext2D): ImageData | undefined {
  const source = image.data
  if (!source) return undefined
  const output = context.createImageData(image.width, image.height)
  const rgba = output.data

  if (image.kind === ImageKind.RGBA_32BPP || source.length === rgba.length) {
    rgba.set(source.subarray(0, rgba.length))
    return output
  }
  if (image.kind === ImageKind.RGB_24BPP || source.length === image.width * image.height * 3) {
    for (let sourceIndex = 0, outputIndex = 0; outputIndex < rgba.length; sourceIndex += 3, outputIndex += 4) {
      rgba[outputIndex] = source[sourceIndex] ?? 0
      rgba[outputIndex + 1] = source[sourceIndex + 1] ?? 0
      rgba[outputIndex + 2] = source[sourceIndex + 2] ?? 0
      rgba[outputIndex + 3] = 255
    }
    return output
  }
  if (image.kind === ImageKind.GRAYSCALE_1BPP) {
    const bytesPerRow = (image.width + 7) >> 3
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const byte = source[y * bytesPerRow + (x >> 3)] ?? 0
        const value = byte & (128 >> (x & 7)) ? 255 : 0
        const outputIndex = (y * image.width + x) * 4
        rgba[outputIndex] = value
        rgba[outputIndex + 1] = value
        rgba[outputIndex + 2] = value
        rgba[outputIndex + 3] = 255
      }
    }
    return output
  }
  return undefined
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function encodePdfImage(image: PdfImageObject): Promise<EncodedImage | undefined> {
  if (typeof document === 'undefined' || !isUsefulImage(image)) return undefined
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = image.width
  sourceCanvas.height = image.height
  const sourceContext = sourceCanvas.getContext('2d')
  if (!sourceContext) return undefined

  if (image.bitmap) {
    sourceContext.drawImage(image.bitmap, 0, 0, image.width, image.height)
  } else {
    const pixels = imageDataFromPdf(image, sourceContext)
    if (!pixels) return undefined
    sourceContext.putImageData(pixels, 0, 0)
  }

  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height)

  let blob = await canvasBlob(canvas, 'image/webp', 0.86)
  let extension: EncodedImage['extension'] = 'webp'
  if (!blob || blob.type !== 'image/webp') {
    blob = await canvasBlob(canvas, 'image/png')
    extension = 'png'
  }
  if (!blob) return undefined

  const thumbnailScale = Math.min(1, THUMBNAIL_EDGE / Math.max(canvas.width, canvas.height))
  const thumbnail = document.createElement('canvas')
  thumbnail.width = Math.max(1, Math.round(canvas.width * thumbnailScale))
  thumbnail.height = Math.max(1, Math.round(canvas.height * thumbnailScale))
  thumbnail.getContext('2d')?.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height)
  const previewDataUrl = thumbnail.toDataURL('image/webp', 0.68)

  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    extension,
    previewDataUrl,
  }
}

function resolveImageObject(page: PDFPageProxy, id: string): Promise<PdfImageObject | undefined> {
  if (page.objs.has(id)) return Promise.resolve(page.objs.get(id) as PdfImageObject)
  if (page.commonObjs.has(id)) return Promise.resolve(page.commonObjs.get(id) as PdfImageObject)
  return new Promise((resolve) => {
    let settled = false
    const finish = (value?: PdfImageObject) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    page.objs.get(id, finish)
    page.commonObjs.get(id, finish)
    window.setTimeout(() => finish(undefined), 1_000)
  })
}

async function extractPageImages(page: PDFPageProxy, pageNumber: number): Promise<ExtractedPdfImage[]> {
  const operatorList = await page.getOperatorList()
  const candidates: Array<PdfImageObject | Promise<PdfImageObject | undefined>> = []
  const namedImages = new Set<string>()

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operation = operatorList.fnArray[index]
    const args = operatorList.argsArray[index]
    if (operation === OPS.paintImageXObject || operation === OPS.paintImageXObjectRepeat) {
      const id = String(args?.[0] ?? '')
      if (id && !namedImages.has(id)) {
        namedImages.add(id)
        candidates.push(resolveImageObject(page, id))
      }
    } else if (operation === OPS.paintInlineImageXObject || operation === OPS.paintInlineImageXObjectGroup) {
      if (args?.[0]) candidates.push(args[0] as PdfImageObject)
    }
  }

  const images: ExtractedPdfImage[] = []
  const resolved = await Promise.all(candidates)
  for (const image of resolved) {
    if (!image || !isUsefulImage(image) || images.length >= MAX_IMAGES_PER_PAGE) continue
    try {
      const encoded = await encodePdfImage(image)
      if (!encoded) continue
      const hash = sampledHash(encoded.data, image.width, image.height)
      images.push({
        id: `pdf-p${pageNumber}-${hash}.${encoded.extension}`,
        pageNumber,
        width: image.width,
        height: image.height,
        data: encoded.data,
        previewDataUrl: encoded.previewDataUrl,
      })
    } catch {
      // A malformed image should not prevent the rest of the PDF from loading.
    }
  }
  return images
}

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
  const images: ExtractedPdfImage[] = []
  const seenImages = new Set<string>()
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    pages.push({ pageNumber, text, characterCount: text.length })
    if (images.length < MAX_PDF_IMAGES) {
      const pageImages = await extractPageImages(page, pageNumber)
      for (const image of pageImages) {
        const hash = image.id.replace(/^pdf-p\d+-/, '')
        if (seenImages.has(hash)) continue
        seenImages.add(hash)
        images.push(image)
        if (images.length >= MAX_PDF_IMAGES) break
      }
    }
    onProgress?.(pageNumber, pdf.numPages)
  }

  if (images.length === 0) validateExtractedPages(pages)
  const coverPng = await renderCover(pdf)
  return { fileName: file.name, pageCount: pdf.numPages, pages, images, coverPng }
}
