// Limits, labels and the consent statement shared by the voice pickers, the
// clone dialog, the Voice Lab and the API routes that enforce the same rules.
// Pure and client-safe: the server imports these constants so the numbers the
// UI shows are the numbers the API checks.

import { AGENT_LANGUAGES } from '@/lib/agent-languages'

export type VoiceGender = 'masculine' | 'feminine' | 'gender_neutral'

export const VOICE_LANGUAGES = AGENT_LANGUAGES

export const VOICE_LANGUAGE_CODES: readonly string[] = AGENT_LANGUAGES.map((l) => l.value)

export const GENDER_OPTIONS: readonly { value: VoiceGender; label: string }[] = [
  { value: 'feminine', label: 'Female' },
  { value: 'masculine', label: 'Male' },
  { value: 'gender_neutral', label: 'Neutral' },
]

/** Sonic speed range ("Pace"). 1 = the voice's natural pace. */
export const SPEED_MIN = 0.6
export const SPEED_MAX = 1.5
export const SPEED_STEP = 0.05

/** Greeting / pace previews. */
export const PREVIEW_MAX_CHARS = 300
/** Voice Lab text to speech, per generation. */
export const TTS_TOOL_MAX_CHARS = 1000

/** Cartesia instant clones: 10 s is enough, up to 60 s is used. */
/**
 * Cartesia accepts clone clips up to 16 MB (decimal). 15 MiB (15,728,640
 * bytes) stays under that with room for the multipart envelope, so a file the
 * app accepts is never refused after the upload.
 */
export const CLONE_MAX_BYTES = 15 * 1024 * 1024
export const CLONE_MIN_SECONDS = 10
export const CLONE_MAX_SECONDS = 60
export const CLONE_NAME_MAX = 40
/** Active clones per organisation; protects the shared provider account. */
export const MAX_CLONES_PER_ORG = 10

/** Voice Lab speech to text uploads. */
export const STT_MAX_BYTES = 25 * 1024 * 1024

export type AudioFileFormat = 'wav' | 'mp3' | 'ogg' | 'webm' | 'flac' | 'm4a'

export const CLONE_AUDIO_FORMATS: readonly AudioFileFormat[] = ['wav', 'mp3', 'ogg', 'webm', 'flac']
export const STT_AUDIO_FORMATS: readonly AudioFileFormat[] = ['wav', 'mp3', 'm4a', 'ogg', 'webm', 'flac']

/** Content type used for uploads; storage buckets only accept audio/*. */
export const AUDIO_CONTENT_TYPES: Record<AudioFileFormat, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
}

/** `accept` attribute for file inputs. */
export function acceptAttribute(formats: readonly AudioFileFormat[]): string {
  const types = new Set<string>()
  for (const format of formats) {
    types.add(`.${format}`)
    types.add(AUDIO_CONTENT_TYPES[format])
  }
  return [...types].join(',')
}

export function languageOption(code: string | null | undefined): (typeof AGENT_LANGUAGES)[number] | null {
  if (!code) return null
  const base = code.trim().toLowerCase().split(/[-_]/)[0]
  return AGENT_LANGUAGES.find((l) => l.value === base) ?? null
}

export function languageLabel(code: string | null | undefined): string {
  return languageOption(code)?.label ?? (code ? code.toUpperCase() : 'Unknown language')
}

export function genderLabel(gender: VoiceGender | null | undefined): string | null {
  return GENDER_OPTIONS.find((g) => g.value === gender)?.label ?? null
}

/** 'general-american' → 'General American'. Used when Cartesia's accent name isn't loaded. */
export function accentLabel(accentId: string): string {
  return accentId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** "1.00×" style label for a pace value; null means the voice's natural pace. */
export function speedLabel(speed: number | null | undefined): string {
  if (typeof speed !== 'number' || !Number.isFinite(speed)) return 'Natural'
  if (Math.abs(speed - 1) < 0.001) return 'Natural'
  return `${speed.toFixed(2)}×`
}

/**
 * The exact sentence the owner agrees to before cloning. The API stores it
 * with the clone and refuses a statement that differs from this one, so the
 * record always matches what was on screen.
 */
export function consentStatement(voiceName: string): string {
  const name = voiceName.trim()
  return (
    `I confirm that the voice in this recording is my own, or that the person speaking has given me ` +
    `explicit permission to create an AI copy of their voice named "${name}". I understand it will be ` +
    `used to speak on calls for my business, and that I can delete it at any time.`
  )
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
