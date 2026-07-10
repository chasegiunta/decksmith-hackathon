import { NextRequest, NextResponse } from 'next/server'
import { generateFormPdf } from '@/lib/pdf-form'
import type { FormAnswers, FormSchema } from '@/lib/form-schema'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { schema?: FormSchema; answers?: FormAnswers }
  if (!body.schema || !body.schema.fields?.length) {
    return NextResponse.json({ error: 'A form schema with at least one field is required.' }, { status: 400 })
  }

  const pdfBytes = await generateFormPdf(body.schema, body.answers ?? {})

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="form-submission.pdf"',
    },
  })
}
