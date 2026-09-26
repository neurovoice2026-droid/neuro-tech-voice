import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  FRAME_SAMPLES,
  createPcm16Decoder,
  createPcm16Framer,
  createStreamingDownsampler,
  downsampleBuffer,
  floatTo16BitPCM,
  floatToInt16Sample,
  int16ToFloat32,
  int16ToLeBytes,
  meterLevel,
  rms,
} from './pcm'

function sine(freq: number, rate: number, seconds: number, amplitude = 0.5): Float32Array {
  const out = new Float32Array(Math.round(rate * seconds))
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / rate)
  return out
}

function chunks(input: Float32Array, size: number): Float32Array[] {
  const out: Float32Array[] = []
  for (let i = 0; i < input.length; i += size) out.push(input.subarray(i, i + size))
  return out
}

function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

describe('FRAME_SAMPLES', () => {
  it('is 20 ms at 16 kHz', () => {
    expect(FRAME_SAMPLES).toBe(320)
  })
})

describe('createStreamingDownsampler', () => {
  it('produces the output rate for integer and fractional ratios', () => {
    for (const rate of [48000, 44100, 32000, 22050, 16000]) {
      const out = downsampleBuffer(new Float32Array(rate), rate, 16000)
      expect(Math.abs(out.length - 16000)).toBeLessThanOrEqual(1)
    }
  })

  it('upsamples a low-rate device by repeating samples', () => {
    const out = downsampleBuffer(new Float32Array([0.1, 0.2, 0.3, 0.4]), 8000, 16000)
    expect(out.length).toBe(8)
    expect(Array.from(out).map((v) => Math.round(v * 10) / 10)).toEqual([0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 0.4, 0.4])
  })

  it('averages each window at 48→16 kHz', () => {
    const out = downsampleBuffer(new Float32Array([0, 0.3, 0.6, 1, 1, 1]), 48000, 16000)
    expect(out.length).toBe(2)
    expect(out[0]).toBeCloseTo(0.3, 6)
    expect(out[1]).toBeCloseTo(1, 6)
  })

  it('gives the same result in 128-sample blocks as in one pass', () => {
    const input = sine(440, 44100, 0.5)
    const streaming = createStreamingDownsampler(44100, 16000)
    const blocks = concat(chunks(input, 128).map((c) => streaming.push(c)))
    const oneShot = downsampleBuffer(input, 44100, 16000)
    expect(blocks.length).toBe(oneShot.length)
    for (let i = 0; i < oneShot.length; i++) expect(blocks[i]).toBeCloseTo(oneShot[i], 6)
  })

  it('does not drift over a long call', () => {
    const streaming = createStreamingDownsampler(44100, 16000)
    const blocks = Math.floor((44100 * 180) / 128)
    let total = 0
    for (let block = 0; block < blocks; block++) total += streaming.push(new Float32Array(128)).length
    const expected = (blocks * 128 * 16000) / 44100
    expect(Math.abs(total - expected)).toBeLessThanOrEqual(1)
  })

  it('keeps a speech-band tone and attenuates a tone above the new Nyquist', () => {
    const speech = downsampleBuffer(sine(300, 48000, 1), 48000, 16000)
    const hiss = downsampleBuffer(sine(15000, 48000, 1), 48000, 16000)
    expect(rms(speech)).toBeGreaterThan(0.3)
    expect(rms(hiss)).toBeLessThan(rms(speech) / 2)
  })

  it('rejects impossible rates', () => {
    expect(() => createStreamingDownsampler(0, 16000)).toThrow(RangeError)
  })
})

describe('Int16 conversions', () => {
  it('clamps and maps both ends of the range', () => {
    expect(floatToInt16Sample(1)).toBe(32767)
    expect(floatToInt16Sample(-1)).toBe(-32768)
    expect(floatToInt16Sample(2)).toBe(32767)
    expect(floatToInt16Sample(-3)).toBe(-32768)
    expect(floatToInt16Sample(0)).toBe(0)
    expect(floatToInt16Sample(Number.NaN)).toBe(0)
  })

  it('round-trips float → int16 → float within one step', () => {
    const input = new Float32Array([0, 0.5, -0.5, 0.999, -0.999, 0.25])
    const back = int16ToFloat32(floatTo16BitPCM(input))
    for (let i = 0; i < input.length; i++) expect(Math.abs(back[i] - input[i])).toBeLessThan(1 / 32767)
  })

  it('writes little-endian bytes', () => {
    const bytes = new Uint8Array(int16ToLeBytes(new Int16Array([1, -2, 0x1234])))
    expect(Array.from(bytes)).toEqual([0x01, 0x00, 0xfe, 0xff, 0x34, 0x12])
  })
})

describe('createPcm16Decoder', () => {
  it('decodes little-endian samples', () => {
    const decoder = createPcm16Decoder()
    const out = decoder.decode(int16ToLeBytes(new Int16Array([32767, -32768, 0])))
    expect(Array.from(out)).toEqual([1, -1, 0])
  })

  it('carries an odd byte into the next chunk', () => {
    const decoder = createPcm16Decoder()
    const bytes = new Uint8Array(int16ToLeBytes(new Int16Array([1000, -1000, 16384])))
    const a = decoder.decode(bytes.slice(0, 3))
    const b = decoder.decode(bytes.slice(3))
    expect(a.length).toBe(1)
    expect(b.length).toBe(2)
    const all = Array.from(concat([a, b]))
    expect(all.map((v) => floatToInt16Sample(v))).toEqual([1000, -1000, 16384])
  })

  it('handles empty chunks and reset', () => {
    const decoder = createPcm16Decoder()
    expect(decoder.decode(new Uint8Array([0x01])).length).toBe(0)
    expect(decoder.decode(new Uint8Array(0)).length).toBe(0)
    decoder.reset()
    expect(decoder.decode(new Uint8Array([0x00, 0x40])).length).toBe(1)
  })
})

describe('createPcm16Framer', () => {
  it('emits only complete frames and keeps the remainder', () => {
    const framer = createPcm16Framer(4)
    expect(framer.push(new Int16Array([1, 2, 3]))).toHaveLength(0)
    const frames = framer.push(new Int16Array([4, 5, 6, 7, 8, 9]))
    expect(frames).toHaveLength(2)
    expect(Array.from(new Int16Array(frames[0]))).toEqual([1, 2, 3, 4])
    expect(Array.from(new Int16Array(frames[1]))).toEqual([5, 6, 7, 8])
    expect(frames.every((f) => f.byteLength === 8)).toBe(true)
  })
})

describe('meter helpers', () => {
  it('computes RMS and a bounded meter level', () => {
    expect(rms(new Float32Array(0))).toBe(0)
    expect(rms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5)
    expect(meterLevel(0)).toBe(0)
    expect(meterLevel(1)).toBe(1)
    const speech = meterLevel(0.05)
    expect(speech).toBeGreaterThan(0.3)
    expect(speech).toBeLessThan(1)
  })
})

// ─── Worklet parity ───────────────────────────────────────────────────────────

interface WorkletMessage { type: 'frame'; pcm: ArrayBuffer; rms: number }

function loadWorklet(contextRate: number) {
  const source = readFileSync(path.resolve(__dirname, '../../public/worklets/pcm-capture.js'), 'utf8')
  const registered: Record<string, new (options: unknown) => { process(inputs: Float32Array[][]): boolean; port: { onmessage: ((e: { data: unknown }) => void) | null } }> = {}
  const messages: WorkletMessage[] = []
  class AudioWorkletProcessor {
    port = {
      onmessage: null as ((e: { data: unknown }) => void) | null,
      postMessage: (message: WorkletMessage) => messages.push(message),
    }
  }
  const sandbox = {
    AudioWorkletProcessor,
    registerProcessor: (name: string, ctor: (typeof registered)[string]) => {
      registered[name] = ctor
    },
    sampleRate: contextRate,
    ArrayBuffer,
    DataView,
    Float32Array,
    Math,
  }
  vm.runInNewContext(source, sandbox)
  const Processor = registered['pcm-capture']
  expect(Processor).toBeDefined()
  const node = new Processor({ processorOptions: { targetSampleRate: 16000, frameSamples: FRAME_SAMPLES } })
  return { node, messages }
}

describe('public/worklets/pcm-capture.js', () => {
  for (const rate of [48000, 44100]) {
    it(`matches the TypeScript pipeline at ${rate} Hz`, () => {
      const input = sine(220, rate, 0.4, 0.8)
      const { node, messages } = loadWorklet(rate)
      for (const block of chunks(input, 128)) expect(node.process([[block]])).toBe(true)

      const downsampler = createStreamingDownsampler(rate, 16000)
      const framer = createPcm16Framer(FRAME_SAMPLES)
      const expected = chunks(input, 128).flatMap((block) => framer.push(floatTo16BitPCM(downsampler.push(block))))

      expect(messages.length).toBe(expected.length)
      expect(messages.length).toBeGreaterThan(15)
      for (let i = 0; i < expected.length; i++) {
        expect(messages[i].type).toBe('frame')
        expect(Array.from(new Uint8Array(messages[i].pcm))).toEqual(Array.from(new Uint8Array(expected[i])))
        const floats = int16ToFloat32(new Int16Array(expected[i]))
        expect(messages[i].rms).toBeCloseTo(rms(floats), 3)
      }
    })
  }

  it('sends silent frames while muted and survives an empty input', () => {
    const { node, messages } = loadWorklet(48000)
    node.port.onmessage?.({ data: { type: 'mute', muted: true } })
    expect(node.process([[]])).toBe(true)
    expect(node.process([])).toBe(true)
    for (const block of chunks(sine(300, 48000, 0.1), 128)) node.process([[block]])
    expect(messages.length).toBeGreaterThan(0)
    for (const message of messages) {
      expect(message.rms).toBe(0)
      expect(new Int16Array(message.pcm).every((s) => s === 0)).toBe(true)
    }
  })
})
