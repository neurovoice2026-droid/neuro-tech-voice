// ─── Fish Audio live TTS (WebSocket) ─────────────────────────────────────────
// Streams synthesised audio sentence-by-sentence instead of rendering a whole
// utterance first. On a phone call this is the difference between the agent
// answering in ~200ms and answering in ~2s, so live calls must use this path —
// lib/fish/client.ts's textToSpeech() is for previews only.
//
// Protocol (from Fish's AsyncAPI spec): MessagePack frames over
// wss://api.fish.audio/v1/tts/live, with `Authorization` and `model` sent as
// connection headers. Client sends start → text* → flush? → stop; server
// replies with audio* → finish.

import { decode, encode } from '@msgpack/msgpack'
import WebSocket from 'ws'
import { TTS_MODEL_REALTIME_FALLBACK, TTS_MODEL_REALTIME_PREFERRED } from './client'

const LIVE_URL = 'wss://api.fish.audio/v1/tts/live'

export interface LiveTTSOptions {
  voiceId?: string | null
  /**
   * Requested model. Defaults to s2.1-pro; if the endpoint rejects it (see the
   * documentation conflict noted in ./client.ts) the session silently retries
   * on s2-pro rather than failing the turn.
   */
  model?: string
  /** Used when `model` is refused at handshake. */
  fallbackModel?: string
  /** 8000 matches PCMU telephony so no resampling is needed downstream. */
  sampleRate?: number
  latency?: 'low' | 'normal' | 'balanced'
  speed?: number
  onAudio: (pcm: Buffer) => void
  onFinish?: (reason: string) => void
  onError?: (err: Error) => void
  /** Fires when the fallback was used, so the choice is visible in logs. */
  onModelFallback?: (from: string, to: string) => void
}

type ServerEvent =
  | { event: 'audio'; audio: Uint8Array }
  | { event: 'finish'; reason: string }
  | { event: string; [k: string]: unknown }

/** The server refused the upgrade request — usually an unsupported model. */
class HandshakeRejection extends Error {
  constructor(public status: number, public model: string) {
    super(`Fish live TTS refused model "${model}" (HTTP ${status})`)
    this.name = 'HandshakeRejection'
  }
}

/**
 * Only 4xx is worth retrying on another model. A 5xx or a transport failure
 * says nothing about the model and will fail the same way twice.
 */
function isHandshakeRejection(err: unknown): boolean {
  return err instanceof HandshakeRejection && err.status >= 400 && err.status < 500
}

/**
 * An open synthesis session. Text is pushed in as the LLM produces it; audio
 * comes back through onAudio as raw little-endian 16-bit PCM.
 */
export class FishLiveSession {
  private ws!: WebSocket
  private ready: Promise<void>
  private closed = false
  /** The model this session actually connected with. */
  model: string

  constructor(private opts: LiveTTSOptions) {
    const preferred = opts.model ?? TTS_MODEL_REALTIME_PREFERRED
    const fallback = opts.fallbackModel ?? TTS_MODEL_REALTIME_FALLBACK
    this.model = preferred

    this.ready = this.connect(preferred).catch((err) => {
      // Only a handshake refusal is worth retrying — a bad key or a network
      // outage will fail identically on the fallback, and retrying would just
      // double the delay before the turn gives up.
      if (preferred === fallback || !isHandshakeRejection(err)) throw err
      this.opts.onModelFallback?.(preferred, fallback)
      this.model = fallback
      return this.connect(fallback)
    })
  }

  private connect(model: string): Promise<void> {
    this.ws = new WebSocket(LIVE_URL, {
      headers: {
        Authorization: `Bearer ${process.env.FISH_AUDIO_API_KEY!}`,
        model,
      },
    })

    const ready = new Promise<void>((resolve, reject) => {
      this.ws.once('open', () => {
        // The start frame carries the full request config. `text` is empty
        // here — it's a config frame, not content; real text follows in text
        // events. Sending content in start would emit it before the first
        // token arrives from the LLM.
        this.send({
          event: 'start',
          request: {
            text: '',
            format: 'pcm',
            sample_rate: this.opts.sampleRate ?? 8000,
            latency: this.opts.latency ?? 'low',
            normalize: true,
            ...(this.opts.voiceId ? { reference_id: this.opts.voiceId } : {}),
            ...(this.opts.speed !== undefined ? { prosody: { speed: this.opts.speed } } : {}),
          },
        })
        resolve()
      })
      this.ws.once('error', reject)
      // A rejected model shows up as an HTTP response to the upgrade request
      // rather than a socket error, so it needs its own listener.
      this.ws.once('unexpected-response', (_req, res) => {
        reject(new HandshakeRejection(res.statusCode ?? 0, model))
      })
    })

    this.attachHandlers(this.ws)
    return ready
  }

  /**
   * Handlers are bound to the specific socket they belong to.
   *
   * When the first model is refused, its socket still emits `error` and
   * `close` while the fallback is connecting. Without this identity check
   * those events would report a spurious failure and set `closed` on a
   * session that is in fact about to work — the turn would go silent for no
   * reason anyone could find in the logs.
   */
  private attachHandlers(socket: WebSocket) {
    socket.on('message', (data: Buffer) => {
      if (this.ws !== socket) return
      let msg: ServerEvent
      try {
        msg = decode(data) as ServerEvent
      } catch (e) {
        this.opts.onError?.(e instanceof Error ? e : new Error(String(e)))
        return
      }

      if (msg.event === 'audio' && 'audio' in msg && msg.audio) {
        this.opts.onAudio(Buffer.from(msg.audio as Uint8Array))
      } else if (msg.event === 'finish') {
        this.opts.onFinish?.(String((msg as { reason?: string }).reason ?? 'stop'))
      }
    })

    socket.on('error', (err) => {
      if (this.ws === socket) this.opts.onError?.(err)
    })
    socket.on('close', () => {
      if (this.ws === socket) this.closed = true
    })
  }

  private send(payload: unknown) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(encode(payload))
    }
  }

  /** Push a text fragment. Safe to call with partial sentences. */
  async push(text: string) {
    if (this.closed || !text) return
    await this.ready
    this.send({ event: 'text', text })
  }

  /** Force synthesis of everything buffered so far without ending the session. */
  async flush() {
    if (this.closed) return
    await this.ready
    this.send({ event: 'flush' })
  }

  /** End the session cleanly. */
  async stop() {
    if (this.closed) return
    await this.ready
    this.send({ event: 'stop' })
    this.closed = true
  }

  /** Drop the connection immediately — used when the caller interrupts. */
  abort() {
    this.closed = true
    try { this.ws.terminate() } catch { /* already gone */ }
  }
}

// ─── G.711 μ-law ─────────────────────────────────────────────────────────────
// Telnyx's bidirectional stream defaults to PCMU (μ-law, 8kHz) and that is the
// best-supported codec on their side, so Fish's PCM output is encoded here
// before being pushed into the call.

/**
 * Exponent lookup for μ-law encoding.
 *
 * The canonical G.711 implementation ships this as a hand-written 256-entry
 * table. It's computed instead: the table is exactly floor(log2(i)) clamped at
 * i=0, which is easy to verify by inspection and impossible to typo — a single
 * wrong entry in a transcribed table produces audible clicks that are very
 * hard to trace back to their source.
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

/** Convert little-endian 16-bit PCM to μ-law bytes (1 byte per sample). */
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

/** Convert μ-law bytes from the call back to 16-bit PCM for the STT engine. */
export function muLawToPcm16(mulaw: Buffer): Buffer {
  const out = Buffer.allocUnsafe(mulaw.length * 2)
  for (let i = 0; i < mulaw.length; i++) {
    out.writeInt16LE(MULAW_DECODE[mulaw[i]], i * 2)
  }
  return out
}
