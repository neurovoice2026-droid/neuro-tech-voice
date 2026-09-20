// Per-language decisions for the voice pipeline: which Cartesia Ink model and
// endpoint can transcribe the caller, and which Twilio <Say> language speaks
// the router's own lines (unavailable / apology). Pure, client-safe.
//
// Ink coverage (cartesia-docs.md §3.1): ink-2 is English-only; ink-preview
// adds es/fr/hi/ja with native turn detection; every other agent language
// needs ink-whisper on the manual endpoint, where the gateway runs its own VAD.

import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import type { SttConfig } from '@/lib/voice/contracts'

export const AGENT_LANGUAGE_CODES: readonly string[] = AGENT_LANGUAGES.map((l) => l.value)

function primarySubtag(language: string | null | undefined): string | null {
  const base = (language ?? '').trim().toLowerCase().split(/[-_]/)[0]
  return /^[a-z]{2,3}$/.test(base) ? base : null
}

/** 'pt-BR' → 'pt', ' RO ' → 'ro'; anything that isn't a language tag → 'en'. */
export function baseLanguage(language: string | null | undefined): string {
  return primarySubtag(language) ?? 'en'
}

export function isSupportedAgentLanguage(language: string): boolean {
  const base = primarySubtag(language)
  return base !== null && AGENT_LANGUAGE_CODES.includes(base)
}

/** Agent language or English when the stored value isn't one we support. */
export function normalizeAgentLanguage(language: string | null | undefined): string {
  const base = baseLanguage(language)
  return AGENT_LANGUAGE_CODES.includes(base) ? base : 'en'
}

// Cartesia keyterm limits per connection (cartesia-docs.md §3.5).
export const KEYTERM_MAX_COUNT = 100
export const KEYTERM_MAX_TOTAL_CHARS = 1200

/**
 * Trims, collapses inner whitespace, drops empties and case-insensitive
 * duplicates (keeping the first spelling, since capitalisation matters to
 * Ink), then fits the list into Cartesia's limits. A term that would overflow
 * the character budget is skipped rather than truncated: half a brand name
 * biases recognition toward the wrong word.
 */
export function sanitizeKeyterms(terms: readonly unknown[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  let total = 0
  for (const raw of terms) {
    if (typeof raw !== 'string') continue
    // \p{Cc} = C0/C1 control characters; the escape keeps raw NUL bytes out of
    // the source file, which would make git treat it as binary.
    const term = raw.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim()
    if (!term) continue
    const key = term.toLocaleLowerCase()
    if (seen.has(key)) continue
    if (total + term.length > KEYTERM_MAX_TOTAL_CHARS) continue
    seen.add(key)
    out.push(term)
    total += term.length
    if (out.length === KEYTERM_MAX_COUNT) break
  }
  return out
}

// Cartesia's "Balanced" turn profile (cartesia-docs.md §3.3). Phone callers
// pause mid-sentence more than people on a headset, so we don't use Responsive.
const BALANCED_TURN = {
  start_threshold: 0.8,
  eager_end_threshold: 0.4,
  end_threshold: 0.2,
  end_timeout_ms: 5600,
} as const

// ink-whisper auto-finalisation on 8 kHz phone audio: quiet enough to ignore
// line hiss, short enough that the caller isn't left waiting after a sentence.
const WHISPER_MANUAL = {
  min_volume: 0.15,
  max_silence_duration_secs: 0.8,
} as const

const INK_PREVIEW_LANGUAGES = new Set(['es', 'fr', 'hi', 'ja'])

export function sttConfigFor(language: string, keyterms: string[]): SttConfig {
  const lang = baseLanguage(language)
  if (lang === 'en' || INK_PREVIEW_LANGUAGES.has(lang)) {
    return {
      model: lang === 'en' ? 'ink-2' : 'ink-preview',
      endpoint: 'turns',
      language: lang,
      keyterms: sanitizeKeyterms(keyterms),
      turn: { ...BALANCED_TURN },
      manual: null,
    }
  }
  // Keyterms are rejected/ignored by ink-whisper, so they're never sent.
  return {
    model: 'ink-whisper',
    endpoint: 'manual',
    language: lang,
    keyterms: [],
    turn: null,
    manual: { ...WHISPER_MANUAL },
  }
}

// Twilio <Say> language codes (twilio.com/docs/voice/twiml/say/text-speech).
// Mandarin is cmn-CN and Modern Standard Arabic ar-XA in Twilio's list;
// Portuguese follows the European phrasing our copy uses.
const TWILIO_SAY_LANGUAGES: Record<string, string> = {
  en: 'en-US',
  ro: 'ro-RO',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  pl: 'pl-PL',
  nl: 'nl-NL',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'cmn-CN',
  ar: 'ar-XA',
  hi: 'hi-IN',
}

export function twilioSayLanguage(language: string): string {
  return TWILIO_SAY_LANGUAGES[baseLanguage(language)] ?? 'en-US'
}

// Without a voice attribute Twilio uses the account's Console default, which
// may be a basic voice that can't speak the language at all. These are Google
// Standard (feminine) voices listed on the same Twilio page for each code.
const TWILIO_SAY_VOICES: Record<string, string> = {
  en: 'Google.en-US-Standard-C',
  ro: 'Google.ro-RO-Standard-B',
  es: 'Google.es-ES-Standard-A',
  fr: 'Google.fr-FR-Standard-F',
  de: 'Google.de-DE-Standard-G',
  it: 'Google.it-IT-Standard-A',
  pt: 'Google.pt-PT-Standard-E',
  pl: 'Google.pl-PL-Standard-F',
  nl: 'Google.nl-NL-Standard-F',
  ja: 'Google.ja-JP-Standard-B',
  ko: 'Google.ko-KR-Standard-A',
  zh: 'Google.cmn-CN-Standard-A',
  ar: 'Google.ar-XA-Standard-A',
  hi: 'Google.hi-IN-Standard-A',
}

/** Voice attribute for <Say> that matches twilioSayLanguage(language). */
export function twilioSayVoice(language: string): string {
  return TWILIO_SAY_VOICES[baseLanguage(language)] ?? TWILIO_SAY_VOICES.en
}
