'use client'

import { useCallback, useRef, useState } from 'react'
import { loadPdfPages, type PdfPage } from '@/lib/pdf'

type Slide = PdfPage & { script?: string }

type Status = 'idle' | 'rendering' | 'narrating' | 'ready' | 'error'

export default function Home() {
  const [slides, setSlides] = useState<Slide[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [presenting, setPresenting] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setStatus('rendering')
    try {
      const pages = await loadPdfPages(file)
      setSlides(pages)
      setStatus('narrating')

      const response = await fetch('/api/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Narration request failed (${response.status})`)
      }

      const { narrations } = (await response.json()) as {
        narrations: { pageNumber: number; script: string }[]
      }

      setSlides((current) =>
        current.map((slide) => ({
          ...slide,
          script: narrations.find((n) => n.pageNumber === slide.pageNumber)?.script,
        })),
      )
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setStatus('error')
    }
  }, [])

  const startPresenting = () => {
    setActiveIndex(0)
    setPresenting(true)
  }

  if (presenting) {
    return (
      <PresentMode
        slides={slides}
        activeIndex={activeIndex}
        onIndexChange={setActiveIndex}
        onExit={() => setPresenting(false)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight">Slide Deck Mode</h1>
        <p className="mt-2 text-slate-400">
          Upload a PDF and it becomes a narrated slideshow — AI writes the script, your browser speaks it.
        </p>

        <div className="mt-8 rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md bg-emerald-500 px-5 py-2.5 font-medium text-slate-950 hover:bg-emerald-400"
            disabled={status === 'rendering' || status === 'narrating'}
          >
            {status === 'rendering' && 'Rendering pages…'}
            {status === 'narrating' && 'Writing narration…'}
            {(status === 'idle' || status === 'ready' || status === 'error') && 'Choose a PDF'}
          </button>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>

        {slides.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">{slides.length} slides</h2>
              <button
                onClick={startPresenting}
                disabled={status !== 'ready'}
                className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-40"
              >
                ▶ Present
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {slides.map((slide) => (
                <div key={slide.pageNumber} className="rounded-lg border border-slate-800 bg-slate-900 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.imageDataUrl} alt={`Page ${slide.pageNumber}`} className="w-full rounded" />
                  <p className="mt-2 text-xs text-slate-500">Page {slide.pageNumber}</p>
                  {slide.script && <p className="mt-1 text-xs text-slate-400 line-clamp-3">{slide.script}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PresentMode({
  slides,
  activeIndex,
  onIndexChange,
  onExit,
}: {
  slides: Slide[]
  activeIndex: number
  onIndexChange: (index: number) => void
  onExit: () => void
}) {
  const slide = slides[activeIndex]
  const [speaking, setSpeaking] = useState(false)

  const speak = useCallback((text: string, onEnd: () => void) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => {
      setSpeaking(false)
      onEnd()
    }
    window.speechSynthesis.speak(utterance)
  }, [])

  const goTo = useCallback(
    (index: number) => {
      window.speechSynthesis.cancel()
      onIndexChange(index)
    },
    [onIndexChange],
  )

  const playCurrent = () => {
    if (!slide?.script) return
    speak(slide.script, () => {
      if (activeIndex < slides.length - 1) {
        goTo(activeIndex + 1)
      }
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <div className="flex items-center justify-between px-6 py-3 text-sm text-slate-400">
        <span>
          Slide {activeIndex + 1} / {slides.length}
        </span>
        <button onClick={onExit} className="hover:text-white">
          Exit ✕
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slide?.imageDataUrl}
          alt={`Page ${slide?.pageNumber}`}
          className="max-h-[70vh] rounded-lg border border-slate-800 object-contain"
        />
      </div>

      <div className="mx-auto mb-4 max-w-2xl px-6 text-center text-slate-300">{slide?.script}</div>

      <div className="mb-8 flex items-center justify-center gap-4">
        <button
          onClick={() => goTo(Math.max(0, activeIndex - 1))}
          disabled={activeIndex === 0}
          className="rounded-md border border-slate-700 px-4 py-2 disabled:opacity-30"
        >
          ← Prev
        </button>
        <button
          onClick={playCurrent}
          disabled={!slide?.script || speaking}
          className="rounded-md bg-emerald-500 px-6 py-2 font-medium text-slate-950 disabled:opacity-40"
        >
          {speaking ? 'Speaking…' : '▶ Narrate'}
        </button>
        <button
          onClick={() => goTo(Math.min(slides.length - 1, activeIndex + 1))}
          disabled={activeIndex === slides.length - 1}
          className="rounded-md border border-slate-700 px-4 py-2 disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
