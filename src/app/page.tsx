'use client'

import Link from 'next/link'
import { useCallback, useRef, useState } from 'react'
import { loadPdfPages, type PdfPage } from '@/lib/pdf'
import { englishVoiceOptions, pickDefaultVoice, useSpeechVoices } from '@/lib/voices'

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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Slide Deck Mode</h1>
          <Link href="/forms" className="text-sm text-slate-400 hover:text-slate-200">
            Form → PDF →
          </Link>
        </div>
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
  const [paused, setPaused] = useState(false)
  const stoppedManuallyRef = useRef(false)

  const voices = useSpeechVoices()
  const voiceOptions = englishVoiceOptions(voices)

  // Only tracks an explicit choice from the dropdown; falls back to a sensible default (prefers
  // a British English voice) derived at render time once voices are available, so there's no
  // need to sync state from an effect just to apply that default.
  const [explicitVoiceName, setExplicitVoiceName] = useState<string | null>(null)
  const selectedVoiceName = explicitVoiceName ?? pickDefaultVoice(voices)?.name ?? null

  // Plays continuously from `index` through the rest of the deck: speaks each slide's script,
  // and on natural completion advances to and speaks the next one, all the way to the last
  // slide — rather than narrating one slide and going silent. Slides with no script (narration
  // failed or the page was blank) are shown briefly and skipped rather than stalling the chain.
  // A plain function (not useCallback) so it can recurse via its own hoisted name.
  function playFrom(index: number) {
    if (index >= slides.length) return
    onIndexChange(index)

    const target = slides[index]
    if (!target?.script) {
      playFrom(index + 1)
      return
    }

    stoppedManuallyRef.current = false
    window.speechSynthesis.cancel()
    setPaused(false)
    const utterance = new SpeechSynthesisUtterance(target.script)
    utterance.rate = 1
    utterance.voice = voices.find((voice) => voice.name === selectedVoiceName) ?? null
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => {
      setSpeaking(false)
      if (!stoppedManuallyRef.current) playFrom(index + 1)
    }
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  // Pauses/resumes mid-sentence, unlike stopping — the current utterance picks back up where it
  // left off (browser-dependent, but supported everywhere that matters here) instead of
  // restarting the slide from the beginning.
  const togglePause = useCallback(() => {
    if (paused) {
      window.speechSynthesis.resume()
      setPaused(false)
    } else {
      window.speechSynthesis.pause()
      setPaused(true)
    }
  }, [paused])

  const goTo = useCallback(
    (index: number) => {
      stoppedManuallyRef.current = true
      window.speechSynthesis.cancel()
      setSpeaking(false)
      setPaused(false)
      onIndexChange(index)
    },
    [onIndexChange],
  )

  const playCurrent = () => playFrom(activeIndex)

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <div className="flex items-center justify-between px-6 py-3 text-sm text-slate-400">
        <span>
          Slide {activeIndex + 1} / {slides.length}
        </span>
        {voiceOptions.length > 0 && (
          <label className="flex items-center gap-2">
            <span>Voice</span>
            <select
              value={selectedVoiceName ?? ''}
              onChange={(e) => setExplicitVoiceName(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
            >
              {voiceOptions.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </label>
        )}
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
          disabled={speaking}
          className="rounded-md bg-emerald-500 px-6 py-2 font-medium text-slate-950 disabled:opacity-40"
        >
          {speaking ? 'Speaking…' : '▶ Narrate'}
        </button>
        <button
          onClick={togglePause}
          disabled={!speaking}
          className="rounded-md border border-slate-700 px-4 py-2 disabled:opacity-30"
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
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
