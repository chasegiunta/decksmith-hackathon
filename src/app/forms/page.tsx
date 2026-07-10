'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { FormAnswers, FormField, FormSchema } from '@/lib/form-schema'

type Stage = 'prompt' | 'fill' | 'generating-pdf'

export default function FormsPage() {
  const [stage, setStage] = useState<Stage>('prompt')
  const [prompt, setPrompt] = useState('')
  const [schema, setSchema] = useState<FormSchema | null>(null)
  const [answers, setAnswers] = useState<FormAnswers>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateForm = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/generate-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Form generation failed (${response.status})`)
      }
      const { schema: newSchema } = (await response.json()) as { schema: FormSchema }
      setSchema(newSchema)
      setAnswers({})
      setStage('fill')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const setAnswer = (fieldId: string, value: string | boolean) => {
    setAnswers((current) => ({ ...current, [fieldId]: value }))
  }

  const generatePdf = async () => {
    if (!schema) return
    setStage('generating-pdf')
    setError(null)
    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema, answers }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `PDF generation failed (${response.status})`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${schema.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'form'}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setStage('fill')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Form → PDF</h1>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Slide Deck Mode
          </Link>
        </div>
        <p className="mt-2 text-slate-400">
          Describe a form, AI builds it, fill it in, and get a generated PDF of the responses.
        </p>

        {stage === 'prompt' && (
          <div className="mt-8">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A job application form for a barista position"
              rows={3}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500"
            />
            <button
              onClick={generateForm}
              disabled={loading || !prompt.trim()}
              className="mt-3 rounded-md bg-emerald-500 px-5 py-2.5 font-medium text-slate-950 disabled:opacity-40"
            >
              {loading ? 'Designing form…' : 'Generate Form'}
            </button>
          </div>
        )}

        {schema && (stage === 'fill' || stage === 'generating-pdf') && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium">{schema.title}</h2>
              <button
                onClick={() => {
                  setSchema(null)
                  setStage('prompt')
                }}
                className="text-sm text-slate-400 hover:text-slate-200"
              >
                Start over
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {schema.fields.map((field) => (
                <FieldInput key={field.id} field={field} value={answers[field.id]} onChange={setAnswer} />
              ))}
            </div>

            <button
              onClick={generatePdf}
              disabled={stage === 'generating-pdf'}
              className="mt-6 rounded-md bg-emerald-500 px-5 py-2.5 font-medium text-slate-950 disabled:opacity-40"
            >
              {stage === 'generating-pdf' ? 'Generating PDF…' : 'Generate PDF'}
            </button>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  )
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField
  value: string | boolean | undefined
  onChange: (fieldId: string, value: string | boolean) => void
}) {
  const inputClasses =
    'w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500'

  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-300">
        {field.label}
        {field.required && <span className="text-red-400"> *</span>}
      </span>

      {field.type === 'textarea' && (
        <textarea
          rows={3}
          className={inputClasses}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.id, e.target.value)}
        />
      )}

      {field.type === 'select' && (
        <select
          className={inputClasses}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.id, e.target.value)}
        >
          <option value="" disabled>
            Choose…
          </option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {field.type === 'checkbox' && (
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={Boolean(value)}
          onChange={(e) => onChange(field.id, e.target.checked)}
        />
      )}

      {(field.type === 'text' || field.type === 'email' || field.type === 'number' || field.type === 'date') && (
        <input
          type={field.type}
          className={inputClasses}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.id, e.target.value)}
        />
      )}
    </label>
  )
}
