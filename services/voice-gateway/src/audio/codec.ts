// Telephony audio primitives: G.711 μ-law ⇄ PCM16, streaming resampling and
// energy. Everything is stateful-per-stream where it has to be (filters carry
// their history across chunks) and allocation-light: this runs for every
// 20 ms frame of every call.

export type AudioEncoding = 'mulaw' | 'pcm16'

export interface AudioFormat {
  encoding: AudioEncoding
  sampleRate: number
}

/** The two channel formats: Twilio Media Streams and the browser test call. */
export type ChannelAudioFormat = 'mulaw_8000' | 'pcm_16000'

export const MULAW_8000: AudioFormat = { encoding: 'mulaw', sampleRate: 8000 }
export const PCM_16000: AudioFormat = { encoding: 'pcm16', sampleRate: 16000 }

export function channelFormat(format: ChannelAudioFormat): AudioFormat {
  return format === 'mulaw_8000' ? MULAW_8000 : PCM_16000
}

export function bytesPerSample(format: AudioFormat): number {
  return format.encoding === 'mulaw' ? 1 : 2
}

export function bytesPerSecond(format: AudioFormat): number {
  return format.sampleRate * bytesPerSample(format)
}

/** Buffer length for `ms` of audio, aligned to whole samples. */
export function bytesForMs(format: AudioFormat, ms: number): number {
  const samples = Math.round((format.sampleRate * ms) / 1000)
  return samples * bytesPerSample(format)
}

export function sameFormat(a: AudioFormat, b: AudioFormat): boolean {
  return a.encoding === b.encoding && a.sampleRate === b.sampleRate
}

export function silence(format: AudioFormat, ms: number): Buffer {
  // μ-law 0xFF is digital silence; PCM silence is zeros.
  return Buffer.alloc(bytesForMs(format, ms), format.encoding === 'mulaw' ? 0xff : 0x00)
}

// ─── G.711 μ-law ──────────────────────────────────────────────────────────────

const MULAW_DECODE = new Int16Array(256)
for (let i = 0; i < 256; i++) {
  const u = ~i & 0xff
  const sign = u & 0x80
  const exponent = (u >> 4) & 0x07
  const mantissa = u & 0x0f
  const magnitude = (((mantissa << 3) + 0x84) << exponent) - 0x84
  MULAW_DECODE[i] = sign ? -magnitude : magnitude
}

const MULAW_BIAS = 0x84
const MULAW_CLIP = 32635
const MULAW_ENCODE = new Uint8Array(65536)
for (let i = -32768; i < 32768; i++) {
  let sample = i
  const sign = sample < 0 ? 0x80 : 0
  if (sign) sample = -sample
  if (sample > MULAW_CLIP) sample = MULAW_CLIP
  sample += MULAW_BIAS
  let exponent = 7
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) exponent--
  const mantissa = (sample >> (exponent + 3)) & 0x0f
  MULAW_ENCODE[i & 0xffff] = ~(sign | (exponent << 4) | mantissa) & 0xff
}

export function mulawDecodeSample(byte: number): number {
  return MULAW_DECODE[byte & 0xff]
}

export function mulawEncodeSample(sample: number): number {
  return MULAW_ENCODE[sample & 0xffff]
}

/** μ-law bytes → PCM16 samples. */
export function mulawToSamples(mulaw: Uint8Array): Int16Array {
  const out = new Int16Array(mulaw.length)
  for (let i = 0; i < mulaw.length; i++) out[i] = MULAW_DECODE[mulaw[i]]
  return out
}

/** PCM16 samples → μ-law bytes. */
export function samplesToMulaw(samples: Int16Array): Buffer {
  const out = Buffer.allocUnsafe(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = MULAW_ENCODE[samples[i] & 0xffff]
  return out
}

/** Little-endian PCM16 bytes → samples (copies, so odd byte offsets are safe). A trailing odd byte is dropped. */
export function pcm16BytesToSamples(bytes: Uint8Array): Int16Array {
  const count = bytes.length >> 1
  const out = new Int16Array(count)
  const view = new DataView(bytes.buffer, bytes.byteOffset, count * 2)
  for (let i = 0; i < count; i++) out[i] = view.getInt16(i * 2, true)
  return out
}

export function samplesToPcm16Bytes(samples: Int16Array): Buffer {
  const out = Buffer.allocUnsafe(samples.length * 2)
  for (let i = 0; i < samples.length; i++) out.writeInt16LE(samples[i], i * 2)
  return out
}

export function decodeToSamples(bytes: Uint8Array, encoding: AudioEncoding): Int16Array {
  return encoding === 'mulaw' ? mulawToSamples(bytes) : pcm16BytesToSamples(bytes)
}

export function encodeSamples(samples: Int16Array, encoding: AudioEncoding): Buffer {
  return encoding === 'mulaw' ? samplesToMulaw(samples) : samplesToPcm16Bytes(samples)
}

// ─── Energy ───────────────────────────────────────────────────────────────────

/** Root-mean-square level, 0 (silence) … 1 (full scale). */
export function rms(samples: Int16Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length) / 32768
}

export function rmsOf(bytes: Uint8Array, encoding: AudioEncoding): number {
  if (encoding === 'pcm16') return rms(pcm16BytesToSamples(bytes))
  if (bytes.length === 0) return 0
  let sum = 0
  for (let i = 0; i < bytes.length; i++) {
    const s = MULAW_DECODE[bytes[i]]
    sum += s * s
  }
  return Math.sqrt(sum / bytes.length) / 32768
}

// ─── Resampling ───────────────────────────────────────────────────────────────

/** Windowed-sinc low-pass taps; `cutoff` is a fraction of the input sample rate (0 … 0.5). */
export function designLowPass(taps: number, cutoff: number): Float64Array {
  const h = new Float64Array(taps)
  const mid = (taps - 1) / 2
  let sum = 0
  for (let n = 0; n < taps; n++) {
    const x = n - mid
    const sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x)
    // Blackman window: ~74 dB stopband, plenty for 8 kHz speech.
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (taps - 1))
    h[n] = sinc * w
    sum += h[n]
  }
  for (let n = 0; n < taps; n++) h[n] /= sum
  return h
}

class FirFilter {
  private readonly history: Float64Array
  private pos = 0

  constructor(private readonly taps: Float64Array) {
    this.history = new Float64Array(taps.length)
  }

  process(input: Int16Array): Float64Array {
    const out = new Float64Array(input.length)
    const n = this.taps.length
    for (let i = 0; i < input.length; i++) {
      this.history[this.pos] = input[i]
      let acc = 0
      let idx = this.pos
      for (let k = 0; k < n; k++) {
        acc += this.taps[k] * this.history[idx]
        idx = idx === 0 ? n - 1 : idx - 1
      }
      out[i] = acc
      this.pos = (this.pos + 1) % n
    }
    return out
  }
}

function clamp16(value: number): number {
  const v = Math.round(value)
  return v > 32767 ? 32767 : v < -32768 ? -32768 : v
}

/**
 * Streaming sample-rate converter. Downsampling low-passes first (anti-alias),
 * then every rate change uses linear interpolation with the fractional phase
 * carried between chunks, so chunk boundaries don't click.
 */
export class StreamResampler {
  private readonly step: number
  private readonly filter: FirFilter | null
  private phase = 0
  private previous = 0
  private primed = false

  constructor(
    private readonly fromRate: number,
    private readonly toRate: number
  ) {
    if (!(fromRate > 0) || !(toRate > 0)) throw new Error('Sample rates must be positive')
    this.step = fromRate / toRate
    this.filter = toRate < fromRate ? new FirFilter(designLowPass(31, (0.5 * toRate) / fromRate * 0.9)) : null
  }

  process(input: Int16Array): Int16Array {
    if (this.fromRate === this.toRate) return input
    if (input.length === 0) return new Int16Array(0)
    const src: ArrayLike<number> = this.filter ? this.filter.process(input) : input
    // Positions are measured from `previous` (index -1) to the last input sample.
    const out: number[] = []
    let pos = this.primed ? this.phase : 0
    if (!this.primed) {
      this.previous = src[0]
      this.primed = true
    }
    while (pos < src.length) {
      const i = Math.floor(pos)
      const frac = pos - i
      const a = i === 0 ? this.previous : src[i - 1]
      const b = src[i]
      out.push(clamp16(a + (b - a) * frac))
      pos += this.step
    }
    this.phase = pos - src.length
    this.previous = src[src.length - 1]
    return Int16Array.from(out)
  }
}

/** Stateful converter between two formats (decode → resample → encode). */
export class AudioConverter {
  private readonly resampler: StreamResampler | null
  private carry: Buffer | null = null

  constructor(
    readonly from: AudioFormat,
    readonly to: AudioFormat
  ) {
    this.resampler = from.sampleRate === to.sampleRate ? null : new StreamResampler(from.sampleRate, to.sampleRate)
  }

  get passthrough(): boolean {
    return sameFormat(this.from, this.to)
  }

  convert(chunk: Buffer): Buffer {
    if (this.passthrough) return chunk
    let bytes = chunk
    if (this.from.encoding === 'pcm16') {
      // Keep a dangling odd byte for the next chunk instead of corrupting alignment.
      if (this.carry) {
        bytes = Buffer.concat([this.carry, bytes])
        this.carry = null
      }
      if (bytes.length % 2 === 1) {
        this.carry = bytes.subarray(bytes.length - 1)
        bytes = bytes.subarray(0, bytes.length - 1)
      }
    }
    const samples = decodeToSamples(bytes, this.from.encoding)
    const resampled = this.resampler ? this.resampler.process(samples) : samples
    return encodeSamples(resampled, this.to.encoding)
  }
}

// ─── Framing ──────────────────────────────────────────────────────────────────

/** Re-chunks a byte stream into fixed-size frames (e.g. 100 ms for Cartesia STT). */
export class Framer {
  private pending: Buffer[] = []
  private pendingBytes = 0

  constructor(readonly frameBytes: number) {
    if (frameBytes <= 0) throw new Error('frameBytes must be positive')
  }

  push(chunk: Buffer): Buffer[] {
    if (chunk.length === 0) return []
    this.pending.push(chunk)
    this.pendingBytes += chunk.length
    if (this.pendingBytes < this.frameBytes) return []
    const all = Buffer.concat(this.pending, this.pendingBytes)
    const frames: Buffer[] = []
    let offset = 0
    while (all.length - offset >= this.frameBytes) {
      frames.push(all.subarray(offset, offset + this.frameBytes))
      offset += this.frameBytes
    }
    const rest = all.subarray(offset)
    this.pending = rest.length ? [Buffer.from(rest)] : []
    this.pendingBytes = rest.length
    return frames
  }

  /** Whatever is left (a partial frame). */
  drain(): Buffer | null {
    if (this.pendingBytes === 0) return null
    const rest = Buffer.concat(this.pending, this.pendingBytes)
    this.pending = []
    this.pendingBytes = 0
    return rest
  }

  get buffered(): number {
    return this.pendingBytes
  }
}

/** Keeps the most recent `capacityBytes` of audio (STT replay after a provider switch). */
export class RingBuffer {
  private chunks: Buffer[] = []
  private size = 0

  constructor(readonly capacityBytes: number) {}

  push(chunk: Buffer): void {
    if (chunk.length === 0 || this.capacityBytes <= 0) return
    this.chunks.push(chunk)
    this.size += chunk.length
    while (this.size - this.chunks[0].length >= this.capacityBytes) {
      this.size -= this.chunks[0].length
      this.chunks.shift()
    }
  }

  snapshot(): Buffer {
    const all = Buffer.concat(this.chunks, this.size)
    return all.length > this.capacityBytes ? all.subarray(all.length - this.capacityBytes) : all
  }

  clear(): void {
    this.chunks = []
    this.size = 0
  }
}
