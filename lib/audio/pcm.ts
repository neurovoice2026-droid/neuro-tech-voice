// PCM helpers for the in-browser test call. The gateway speaks signed 16-bit
// little-endian PCM, 16 kHz, mono, in both directions (lib/voice/contracts.ts
// BROWSER_SAMPLE_RATE); the microphone gives float samples at the audio
// context's rate (usually 44.1 or 48 kHz).
//
// public/worklets/pcm-capture.js runs the same streaming downsampler, framer
// and RMS inside the AudioWorklet (worklets can't import modules from the
// app bundle); pcm.test.ts runs both on the same input to keep them identical.
// Pure, no browser globals.

import { BROWSER_SAMPLE_RATE } from '@/lib/voice/contracts'

/** 20 ms at 16 kHz. */
export const FRAME_SAMPLES = (BROWSER_SAMPLE_RATE / 1000) * 20
export const BYTES_PER_SAMPLE = 2

export interface StreamingDownsampler {
  /** Feeds input samples and returns the output samples they completed. */
  push(input: Float32Array): Float32Array
  reset(): void
}

/**
 * Streaming resampler for speech: each output sample is the mean of the input
 * samples that fall in its window (a box low-pass, which keeps aliasing out
 * of the speech band at 48→16 kHz), and non-integer ratios such as 44.1→16 kHz
 * carry the fractional remainder across calls so no drift builds up. Upsampling
 * (a 8 kHz device) repeats samples. State survives between push() calls, so
 * 128-sample worklet blocks resample exactly like one long buffer.
 */
export function createStreamingDownsampler(inputRate: number, outputRate: number): StreamingDownsampler {
  if (!(inputRate > 0) || !(outputRate > 0)) throw new RangeError('Sample rates must be positive')
  const ratio = inputRate / outputRate
  let sum = 0
  let count = 0
  let position = 0
  let boundary = ratio

  return {
    push(input) {
      // At most len/ratio + 1 outputs per call (the pending window is shorter
      // than one ratio); +2 absorbs float rounding. Trimmed at the end.
      const out = new Float32Array(Math.ceil(input.length / ratio) + 2)
      let written = 0
      for (let i = 0; i < input.length; i++) {
        sum += input[i]
        count += 1
        position += 1
        if (position >= boundary) {
          const value = sum / count
          while (position >= boundary) {
            out[written++] = value
            boundary += ratio
          }
          sum = 0
          count = 0
          boundary -= position
          position = 0
        }
      }
      return out.subarray(0, written)
    },
    reset() {
      sum = 0
      count = 0
      position = 0
      boundary = ratio
    },
  }
}

/** One-shot resample of a whole buffer. */
export function downsampleBuffer(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  return createStreamingDownsampler(inputRate, outputRate).push(input).slice()
}

/** Float [-1, 1] → Int16, clamped, asymmetric so both ends of the range are reachable. */
export function floatToInt16Sample(sample: number): number {
  const s = Number.isNaN(sample) ? 0 : Math.max(-1, Math.min(1, sample))
  return s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
}

export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) out[i] = floatToInt16Sample(input[i])
  return out
}

export function int16ToFloat32(input: Int16Array): Float32Array {
  const out = new Float32Array(input.length)
  for (let i = 0; i < input.length; i++) out[i] = input[i] < 0 ? input[i] / 0x8000 : input[i] / 0x7fff
  return out
}

/** Int16 samples → little-endian bytes (explicit, whatever the platform's endianness). */
export function int16ToLeBytes(samples: Int16Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * BYTES_PER_SAMPLE)
  const view = new DataView(buffer)
  for (let i = 0; i < samples.length; i++) view.setInt16(i * BYTES_PER_SAMPLE, samples[i], true)
  return buffer
}

export interface Pcm16Decoder {
  /** Little-endian bytes → float samples. An odd trailing byte waits for the next chunk. */
  decode(chunk: ArrayBuffer | Uint8Array): Float32Array
  reset(): void
}

export function createPcm16Decoder(): Pcm16Decoder {
  let carry: number | null = null
  return {
    decode(chunk) {
      const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
      const total = bytes.length + (carry === null ? 0 : 1)
      const sampleCount = Math.floor(total / BYTES_PER_SAMPLE)
      const out = new Float32Array(sampleCount)
      let offset = 0
      let written = 0
      if (carry !== null && bytes.length > 0) {
        out[written++] = int16FromBytes(carry, bytes[0])
        offset = 1
        carry = null
      }
      for (; offset + 1 < bytes.length; offset += 2) {
        out[written++] = int16FromBytes(bytes[offset], bytes[offset + 1])
      }
      if (offset < bytes.length) carry = bytes[offset]
      return out.subarray(0, written)
    },
    reset() {
      carry = null
    },
  }
}

function int16FromBytes(low: number, high: number): number {
  const value = (high << 8) | low
  const signed = value & 0x8000 ? value - 0x10000 : value
  return signed < 0 ? signed / 0x8000 : signed / 0x7fff
}

export interface Pcm16Framer {
  /** Appends Int16 samples and returns every complete frame as little-endian bytes. */
  push(samples: Int16Array): ArrayBuffer[]
  reset(): void
}

export function createPcm16Framer(frameSamples: number = FRAME_SAMPLES): Pcm16Framer {
  if (!Number.isInteger(frameSamples) || frameSamples <= 0) throw new RangeError('frameSamples must be a positive integer')
  let pending = new Int16Array(frameSamples)
  let filled = 0
  return {
    push(samples) {
      const frames: ArrayBuffer[] = []
      let offset = 0
      while (offset < samples.length) {
        const take = Math.min(frameSamples - filled, samples.length - offset)
        pending.set(samples.subarray(offset, offset + take), filled)
        filled += take
        offset += take
        if (filled === frameSamples) {
          frames.push(int16ToLeBytes(pending))
          pending = new Int16Array(frameSamples)
          filled = 0
        }
      }
      return frames
    },
    reset() {
      pending = new Int16Array(frameSamples)
      filled = 0
    },
  }
}

/** Root mean square of float samples, 0..1. */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let total = 0
  for (let i = 0; i < samples.length; i++) total += samples[i] * samples[i]
  return Math.sqrt(total / samples.length)
}

/** Perceptual 0..1 meter level from an RMS value (speech sits around 0.02-0.2). */
export function meterLevel(rmsValue: number): number {
  if (!(rmsValue > 0)) return 0
  const db = 20 * Math.log10(rmsValue)
  return Math.max(0, Math.min(1, (db + 60) / 50))
}
