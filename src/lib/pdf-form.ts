import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { FormAnswers, FormSchema } from '@/lib/form-schema'

const PAGE_MARGIN = 50
const LABEL_SIZE = 11
const VALUE_SIZE = 13
const LINE_GAP = 6
const FIELD_GAP = 18

export async function generateFormPdf(schema: FormSchema, answers: FormAnswers): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = pdfDoc.addPage()
  const { width, height } = page.getSize()
  let y = height - PAGE_MARGIN

  const ensureSpace = (needed: number) => {
    if (y - needed < PAGE_MARGIN) {
      page = pdfDoc.addPage()
      y = height - PAGE_MARGIN
    }
  }

  const drawWrapped = (text: string, targetFont: PDFFont, size: number, targetPage: PDFPage) => {
    const maxWidth = width - PAGE_MARGIN * 2
    const words = text.split(/\s+/)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (targetFont.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        ensureSpace(size + LINE_GAP)
        targetPage.drawText(line, { x: PAGE_MARGIN, y, size, font: targetFont, color: rgb(0.1, 0.1, 0.1) })
        y -= size + LINE_GAP
        line = word
      } else {
        line = candidate
      }
    }
    if (line) {
      ensureSpace(size + LINE_GAP)
      targetPage.drawText(line, { x: PAGE_MARGIN, y, size, font: targetFont, color: rgb(0.1, 0.1, 0.1) })
      y -= size + LINE_GAP
    }
  }

  ensureSpace(28)
  page.drawText(schema.title, { x: PAGE_MARGIN, y, size: 20, font: boldFont, color: rgb(0, 0, 0) })
  y -= 20 + LINE_GAP * 2

  for (const field of schema.fields) {
    ensureSpace(LABEL_SIZE + VALUE_SIZE + FIELD_GAP)
    drawWrapped(field.label, boldFont, LABEL_SIZE, page)

    const rawAnswer = answers[field.id]
    const displayValue =
      field.type === 'checkbox' ? (rawAnswer ? 'Yes' : 'No') : (rawAnswer as string)?.toString().trim() || '—'
    drawWrapped(displayValue, font, VALUE_SIZE, page)
    y -= FIELD_GAP
  }

  return pdfDoc.save()
}
