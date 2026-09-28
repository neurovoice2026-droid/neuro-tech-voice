import { describe, expect, it } from 'vitest'
import {
  declaredAudioFormat,
  detectAudioFormat,
  formatFromFileName,
  formatFromMimeType,
  wavDurationSeconds,
} from './audio-format'

function bytes(...parts: (string | number[])[]): Uint8Array {
  const out: number[] = []
  for (const part of parts) {
    if (typeof part === 'string') for (const ch of part) out.push(ch.charCodeAt(0))
    else out.push(...part)
  }
  return Uint8Array.from(out)
}

function wav(seconds: number, sampleRate = 16000): Uint8Array {
  const channels = 1
  const bitsPerSample = 16
  const byteRate = (sampleRate * channels * bitsPerSample) / 8
  const dataSize = Math.round(byteRate * seconds)
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  write(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, (channels * bitsPerSample) / 8, true)
  view.setUint16(34, bitsPerSample, true)
  write(36, 'data')
  view.setUint32(40, dataSize, true)
  return new Uint8Array(buffer)
}

describe('detectAudioFormat', () => {
  it('recognises every accepted container from its magic bytes', () => {
    expect(detectAudioFormat(wav(0.1))).toBe('wav')
    expect(detectAudioFormat(bytes('fLaC', [0, 0, 0, 34]))).toBe('flac')
    expect(detectAudioFormat(bytes('OggS', [0, 2, 0, 0]))).toBe('ogg')
    expect(detectAudioFormat(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]))).toBe('webm')
    expect(detectAudioFormat(bytes('ID3', [4, 0, 0, 0, 0, 0, 0]))).toBe('mp3')
    // MPEG-1 Layer III, 128 kbps, 44.1 kHz frame header.
    expect(detectAudioFormat(bytes([0xff, 0xfb, 0x90, 0x64]))).toBe('mp3')
    expect(detectAudioFormat(bytes([0, 0, 0, 0x20], 'ftypM4A ', [0, 0, 0, 0]))).toBe('m4a')
  })

  it('rejects look-alikes and other files', () => {
    // RIFF but not WAVE (an AVI).
    expect(detectAudioFormat(bytes('RIFF', [0, 0, 0, 0], 'AVI '))).toBeNull()
    // AAC ADTS sync word (layer bits 00) is not MP3.
    expect(detectAudioFormat(bytes([0xff, 0xf1, 0x50, 0x80]))).toBeNull()
    // Invalid bitrate index.
    expect(detectAudioFormat(bytes([0xff, 0xfb, 0xf0, 0x64]))).toBeNull()
    expect(detectAudioFormat(bytes('%PDF-1.7'))).toBeNull()
    expect(detectAudioFormat(bytes([0x89], 'PNG'))).toBeNull()
    expect(detectAudioFormat(bytes('<html>'))).toBeNull()
    expect(detectAudioFormat(new Uint8Array())).toBeNull()
    expect(detectAudioFormat(bytes('RIF'))).toBeNull()
  })
})

describe('declared formats', () => {
  it('reads the format from the MIME type, ignoring parameters', () => {
    expect(formatFromMimeType('audio/webm;codecs=opus')).toBe('webm')
    expect(formatFromMimeType('video/webm')).toBe('webm')
    expect(formatFromMimeType('audio/x-m4a')).toBe('m4a')
    expect(formatFromMimeType('AUDIO/MPEG')).toBe('mp3')
    expect(formatFromMimeType('application/pdf')).toBeNull()
    expect(formatFromMimeType('')).toBeNull()
  })

  it('reads the format from the file extension', () => {
    expect(formatFromFileName('greeting.MP3')).toBe('mp3')
    expect(formatFromFileName('clip.wave')).toBe('wav')
    expect(formatFromFileName('memo.m4a')).toBe('m4a')
    expect(formatFromFileName('notes.txt')).toBeNull()
    expect(formatFromFileName('noextension')).toBeNull()
  })

  it('limits the declared format to what the feature accepts', () => {
    expect(declaredAudioFormat({ name: 'a.m4a', type: 'audio/mp4' }, ['wav', 'mp3'])).toBeNull()
    expect(declaredAudioFormat({ name: 'a.m4a', type: 'audio/mp4' }, ['m4a'])).toBe('m4a')
    // Windows often sends an empty type; the name decides.
    expect(declaredAudioFormat({ name: 'a.flac', type: '' }, ['flac'])).toBe('flac')
  })
})

describe('wavDurationSeconds', () => {
  it('computes the duration of PCM WAV files', () => {
    expect(wavDurationSeconds(wav(2))).toBeCloseTo(2, 5)
    expect(wavDurationSeconds(wav(1.5, 44100))).toBeCloseTo(1.5, 3)
  })

  it('uses the bytes present when the header size is a streaming placeholder', () => {
    const file = wav(1)
    new DataView(file.buffer).setUint32(40, 0xffffffff, true)
    expect(wavDurationSeconds(file)).toBeCloseTo(1, 5)
  })

  it('returns null for other formats or truncated headers', () => {
    expect(wavDurationSeconds(bytes('OggS'))).toBeNull()
    expect(wavDurationSeconds(wav(1).slice(0, 30))).toBeNull()
  })
})
