// Audio file checks that don't trust the browser: the declared type and the
// file name only pick what we expect, the magic bytes decide what it is.
// Pure (audio-format.test.ts).

import type { AudioFileFormat } from '@/components/voice/voice-options'

export type { AudioFileFormat }

function ascii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false
  }
  return true
}

/** MPEG audio frame header: 11 sync bits, a real layer, a usable bitrate and sample rate. */
function isMpegFrame(bytes: Uint8Array, offset: number): boolean {
  if (bytes.length < offset + 4) return false
  const b1 = bytes[offset + 1]
  const b2 = bytes[offset + 2]
  if (bytes[offset] !== 0xff || (b1 & 0xe0) !== 0xe0) return false
  const version = (b1 >> 3) & 0x03 // 01 is reserved
  const layer = (b1 >> 1) & 0x03 // 00 is reserved (and what AAC ADTS uses)
  const bitrate = (b2 >> 4) & 0x0f // 1111 is invalid
  const sampleRate = (b2 >> 2) & 0x03 // 11 is reserved
  return version !== 0x01 && layer !== 0x00 && bitrate !== 0x0f && sampleRate !== 0x03
}

/**
 * Identifies an audio container from its first bytes (16 are enough).
 * - wav: `RIFF....WAVE`
 * - flac: `fLaC`
 * - ogg: `OggS` (Opus or Vorbis)
 * - webm: EBML header 1A 45 DF A3 (what MediaRecorder produces)
 * - mp3: `ID3` tag or an MPEG audio frame header
 * - m4a: ISO BMFF `ftyp` box at offset 4
 */
export function detectAudioFormat(bytes: Uint8Array): AudioFileFormat | null {
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WAVE')) return 'wav'
  if (ascii(bytes, 0, 'fLaC')) return 'flac'
  if (ascii(bytes, 0, 'OggS')) return 'ogg'
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm'
  if (ascii(bytes, 0, 'ID3')) return 'mp3'
  if (isMpegFrame(bytes, 0)) return 'mp3'
  if (ascii(bytes, 4, 'ftyp')) return 'm4a'
  return null
}

const EXTENSION_FORMATS: Record<string, AudioFileFormat> = {
  wav: 'wav',
  wave: 'wav',
  mp3: 'mp3',
  mpga: 'mp3',
  ogg: 'ogg',
  oga: 'ogg',
  opus: 'ogg',
  webm: 'webm',
  weba: 'webm',
  flac: 'flac',
  m4a: 'm4a',
  mp4: 'm4a',
}

const MIME_FORMATS: Record<string, AudioFileFormat> = {
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/vnd.wave': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'application/ogg': 'ogg',
  'audio/webm': 'webm',
  // Browsers label .webm files as video/webm even when they only carry audio.
  'video/webm': 'webm',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'm4a',
}

export function formatFromFileName(name: string): AudioFileFormat | null {
  const match = /\.([a-z0-9]{2,5})$/i.exec(name.trim())
  return match ? EXTENSION_FORMATS[match[1].toLowerCase()] ?? null : null
}

/** 'audio/webm;codecs=opus' → 'webm'. */
export function formatFromMimeType(type: string | null | undefined): AudioFileFormat | null {
  const base = (type ?? '').split(';')[0].trim().toLowerCase()
  return MIME_FORMATS[base] ?? null
}

/**
 * The format a browser file claims to be, from its type first and its name
 * second, restricted to what the feature accepts. The bytes are checked again
 * after upload.
 */
export function declaredAudioFormat(
  file: { name: string; type: string | null | undefined },
  allowed: readonly AudioFileFormat[]
): AudioFileFormat | null {
  const byType = formatFromMimeType(file.type)
  const byName = formatFromFileName(file.name)
  const format = byType ?? byName
  return format && allowed.includes(format) ? format : null
}

/**
 * Duration of a PCM WAV file from its header, or null when the header is
 * unusual (compressed WAV, streaming size placeholders, truncated file).
 */
export function wavDurationSeconds(bytes: Uint8Array): number | null {
  if (!ascii(bytes, 0, 'RIFF') || !ascii(bytes, 8, 'WAVE')) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 12
  let byteRate: number | null = null
  while (offset + 8 <= bytes.length) {
    const size = view.getUint32(offset + 4, true)
    // fmt chunk body: format(2) channels(2) sample rate(4) byte rate(4)…
    if (ascii(bytes, offset, 'fmt ') && offset + 20 <= bytes.length) {
      byteRate = view.getUint32(offset + 16, true)
    } else if (ascii(bytes, offset, 'data')) {
      if (!byteRate) return null
      // 0xFFFFFFFF / 0 mean "unknown" in streamed WAVs: use what is really there.
      const available = bytes.length - (offset + 8)
      const dataSize = size === 0 || size === 0xffffffff ? available : Math.min(size, available)
      return dataSize / byteRate
    }
    const next = offset + 8 + size + (size % 2)
    if (next <= offset) return null
    offset = next
  }
  return null
}
