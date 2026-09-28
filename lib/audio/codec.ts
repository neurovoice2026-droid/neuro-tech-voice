// ─── Telephony audio codecs ──────────────────────────────────────────────────
// Provider-neutral conversions between what a TTS engine produces and what a
// phone line carries.
//
// The quality ceiling on a call is set here, not by the TTS model. A voice
// generated at 16kHz and then squeezed into G.711 μ-law at 8kHz loses
// everything above ~3.4kHz — most of the sibilance and air that make a voice
// sound present. Choosing a wideband transport (L16/16k) where the call path
// supports it is worth more than any model upgrade.

// ─── G.711 μ-law ─────────────────────────────────────────────────────────────

/**
 * Exponent lookup for μ-law encoding.
 *
 * The canonical G.711 implementation ships this as a hand-written 256-entry
 * table. It is computed instead: the table is exactly floor(log2(i)) clamped
 * at i=0, which is verifiable by inspection and impossible to typo — a single
 * wrong entry produces audible clicks that are very hard to trace.
 */
const EXP_LUT = new Uint8Array(256)
for (let i = 1; i < 256; i++) EXP_LUT[i] = Math.floor(Math.log2(i))

const MULAW_BIAS = 0x84
const MULAW_CLIP = 32635

export function linearToMuLawSample(sample: number): number {
  const sign = (sample >> 8) & 0x80
  if (sign !== 0) sample = -sample
  if (sample > MULAW_CLIP) sample = MULAW_CLIP
  sample += MULAW_BIAS

  const exponent = EXP_LUT[(sample >> 7) & 0xff]
  const mantissa = (sample >> (exponent + 3)) & 0x0f
  return ~(sign | (exponent << 4) | mantissa) & 0xff
}

/** Little-endian 16-bit PCM → μ-law (1 byte per sample). */
export function pcm16ToMuLaw(pcm: Buffer): Buffer {
  const out = Buffer.allocUnsafe(pcm.length >> 1)
  for (let i = 0, j = 0; i + 1 < pcm.length; i += 2, j++) {
    out[j] = linearToMuLawSample(pcm.readInt16LE(i))
  }
  return out
}

const MULAW_DECODE = new Int16Array(256)
for (let i = 0; i < 256; i++) {
  const u = ~i & 0xff
  const sign = u & 0x80
  const exponent = (u >> 4) & 0x07
  const mantissa = u & 0x0f
  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent
  sample -= MULAW_BIAS
  MULAW_DECODE[i] = sign !== 0 ? -sample : sample
}

export function muLawToPcm16(mulaw: Buffer): Buffer {
  const out = Buffer.allocUnsafe(mulaw.length * 2)
  for (let i = 0; i < mulaw.length; i++) {
    out.writeInt16LE(MULAW_DECODE[mulaw[i]], i * 2)
  }
  return out
}

// ─── G.711 A-law ─────────────────────────────────────────────────────────────
// PCMA is the European PSTN default, so a Romanian call may well negotiate it
// rather than PCMU. Decoding it wrong yields loud static, not silence, which
// is why it is handled rather than assumed away.

const ALAW_DECODE = new Int16Array(256)
for (let i = 0; i < 256; i++) {
  const a = i ^ 0x55
  const sign = a & 0x80
  const exponent = (a & 0x70) >> 4
  const mantissa = a & 0x0f
  const sample = exponent === 0 ? (mantissa << 4) + 8 : ((mantissa << 4) + 0x108) << (exponent - 1)
  ALAW_DECODE[i] = sign !== 0 ? sample : -sample
}

export function aLawToPcm16(alaw: Buffer): Buffer {
  const out = Buffer.allocUnsafe(alaw.length * 2)
  for (let i = 0; i < alaw.length; i++) {
    out.writeInt16LE(ALAW_DECODE[alaw[i]], i * 2)
  }
  return out
}

// ─── Resampling ──────────────────────────────────────────────────────────────

/**
 * Anti-aliasing low-pass, as a windowed-sinc FIR.
 *
 * Decimating 16k→8k without filtering first folds everything above 4kHz back
 * down into the audible band as inharmonic noise. It does not sound like
 * missing treble — it sounds like a rasp on every consonant, and it is
 * routinely mistaken for a bad TTS voice.
 *
 * 31 taps at a 3.4kHz cutoff: enough stopband rejection for speech, cheap
 * enough to run per frame on every concurrent call.
 */
function buildLowPass(taps: number, cutoffRatio: number): Float32Array {
  const h = new Float32Array(taps)
  const mid = (taps - 1) / 2
  let sum = 0

  for (let i = 0; i < taps; i++) {
    const n = i - mid
    // sinc(2·fc·n), with the n=0 singularity handled explicitly.
    const sinc = n === 0 ? 2 * cutoffRatio : Math.sin(2 * Math.PI * cutoffRatio * n) / (Math.PI * n)
    // Hamming window, to suppress the ringing a rectangular window leaves.
    const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1))
    h[i] = sinc * window
    sum += h[i]
  }

  // Normalise to unity DC gain so filtering does not change loudness.
  for (let i = 0; i < taps; i++) h[i] /= sum
  return h
}

const LP_16K_TO_8K = buildLowPass(31, 3400 / 16000)

/**
 * 16kHz → 8kHz.
 *
 * Stateless: the filter history resets per call, which leaves a negligible
 * click at frame boundaries. Acceptable because this path is the fallback —
 * the preferred transport is L16 at 16kHz, which needs no resampling at all.
 */
export function downsample16kTo8k(pcm: Buffer): Buffer {
  const samples = pcm.length >> 1
  const outSamples = samples >> 1
  const out = Buffer.allocUnsafe(outSamples * 2)
  const taps = LP_16K_TO_8K.length
  const mid = (taps - 1) >> 1

  for (let o = 0; o < outSamples; o++) {
    const center = o * 2
    let acc = 0
    for (let t = 0; t < taps; t++) {
      const idx = center + t - mid
      if (idx < 0 || idx >= samples) continue
      acc += pcm.readInt16LE(idx * 2) * LP_16K_TO_8K[t]
    }
    // Clamp: the filter can overshoot slightly on transients, and a wrapped
    // int16 is a loud pop rather than mild distortion.
    const v = Math.max(-32768, Math.min(32767, Math.round(acc)))
    out.writeInt16LE(v, o * 2)
  }

  return out
}

const ALAW_ENCODE_SEG = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]

export function pcm16ToALaw(pcm: Buffer): Buffer {
  const out = Buffer.allocUnsafe(pcm.length >> 1)
  for (let i = 0, j = 0; i + 1 < pcm.length; i += 2, j++) {
    let sample = pcm.readInt16LE(i)
    const sign = sample >= 0 ? 0x80 : 0x00
    if (sample < 0) sample = -sample
    if (sample > 32635) sample = 32635

    let byte: number
    if (sample < 256) {
      byte = sample >> 4
    } else {
      let exponent = 7
      for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) exponent--
      const mantissa = (sample >> (exponent + 3)) & 0x0f
      byte = (ALAW_ENCODE_SEG[exponent] << 4) | mantissa
    }
    out[j] = (byte | sign) ^ 0x55
  }
  return out
}
