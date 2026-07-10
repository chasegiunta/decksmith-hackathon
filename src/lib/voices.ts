'use client'

import { useEffect, useState } from 'react'

/** Loads the browser's available speechSynthesis voices, waiting for the async voiceschanged
 * event (most browsers report an empty list on the very first call). */
export function useSpeechVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    const updateVoices = () => setVoices(window.speechSynthesis.getVoices())
    updateVoices()
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices)
  }, [])

  return voices
}

// Common names for higher-quality British English voices across macOS/Chrome/Edge — checked in
// order of preference. Falls back to any en-GB voice, then any English voice, then whatever's first.
const PREFERRED_VOICE_NAMES = [
  'Daniel',
  'Google UK English Male',
  'Google UK English Female',
  'Arthur',
  'Oliver',
  'Kate',
]

export function pickDefaultVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null

  for (const name of PREFERRED_VOICE_NAMES) {
    const match = voices.find((voice) => voice.name.includes(name))
    if (match) return match
  }

  const britishVoice = voices.find((voice) => voice.lang === 'en-GB')
  if (britishVoice) return britishVoice

  const anyEnglishVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('en'))
  return anyEnglishVoice ?? voices[0]
}

export function englishVoiceOptions(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  return english.length > 0 ? english : voices
}
