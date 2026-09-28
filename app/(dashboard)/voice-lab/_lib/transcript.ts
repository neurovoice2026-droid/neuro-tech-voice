// Transcript formatting for the Voice Lab: subtitle cues, .srt and .txt
// exports, and time labels. Pure and client-safe (transcript.test.ts).

export interface TranscriptWord {
  word: string
  start: number
  end: number
}

export interface TranscriptCue {
  index: number
  start: number
  end: number
  text: string
}

// Readable subtitle cues: at most ~7 s or 12 words, a new cue after a
// sentence end or a pause longer than 0.8 s.
const MAX_CUE_SECONDS = 7
const MAX_CUE_WORDS = 12
const PAUSE_SECONDS = 0.8

function isSentenceEnd(word: string): boolean {
  return /[.!?。！？؟]["'”’)]*$/.test(word)
}

/** Joins words with spaces, except for languages written without them (ja, zh). */
export function joinWords(words: readonly string[], language: string | null | undefined): string {
  const base = (language ?? '').toLowerCase().split(/[-_]/)[0]
  const separator = base === 'ja' || base === 'zh' ? '' : ' '
  return words.map((w) => w.trim()).filter(Boolean).join(separator)
}

export function buildCues(words: readonly TranscriptWord[], language?: string | null): TranscriptCue[] {
  const cues: TranscriptCue[] = []
  let current: TranscriptWord[] = []

  const flush = () => {
    if (current.length === 0) return
    cues.push({
      index: cues.length + 1,
      start: current[0].start,
      end: Math.max(current[current.length - 1].end, current[0].start),
      text: joinWords(current.map((w) => w.word), language),
    })
    current = []
  }

  for (const word of words) {
    if (!word.word.trim() || !Number.isFinite(word.start) || !Number.isFinite(word.end)) continue
    const previous = current[current.length - 1]
    if (previous) {
      const tooLong = word.end - current[0].start > MAX_CUE_SECONDS
      const tooMany = current.length >= MAX_CUE_WORDS
      const paused = word.start - previous.end > PAUSE_SECONDS
      if (tooLong || tooMany || paused || isSentenceEnd(previous.word)) flush()
    }
    current.push(word)
  }
  flush()
  return cues
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0')
}

/** 3661.5 → "01:01:01,500" */
export function srtTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * 1000))
  const hours = Math.floor(totalMs / 3_600_000)
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
  const secs = Math.floor((totalMs % 60_000) / 1000)
  const ms = totalMs % 1000
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(ms, 3)}`
}

export function toSrt(words: readonly TranscriptWord[], language?: string | null): string {
  return buildCues(words, language)
    .map((cue) => `${cue.index}\n${srtTimestamp(cue.start)} --> ${srtTimestamp(cue.end)}\n${cue.text}\n`)
    .join('\n')
}

/** 75.2 → "1:15", 3725 → "1:02:05". */
export function clockLabel(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return hours > 0 ? `${hours}:${pad(minutes, 2)}:${pad(secs, 2)}` : `${minutes}:${pad(secs, 2)}`
}

/** Plain text with a line per cue, which reads better than one long paragraph. */
export function toPlainText(text: string, words: readonly TranscriptWord[], language?: string | null): string {
  if (words.length === 0) return text.trim() + '\n'
  return buildCues(words, language).map((cue) => cue.text).join('\n') + '\n'
}

/** "interview.mp3" → "interview" for download names. */
export function baseFileName(name: string | null | undefined): string {
  const trimmed = (name ?? '').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[^\p{L}\p{N}_ -]+/gu, '').trim()
  return trimmed.slice(0, 60) || 'transcript'
}
