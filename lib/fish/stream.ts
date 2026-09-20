// ─── Fish Audio streaming TTS over SSE ───────────────────────────────────────
// The path that makes s2.1-pro usable on a live call.
//
// Fish exposes two streaming mechanisms and they do NOT accept the same models
// — a distinction their prose docs never state, visible only in the OpenAPI
// spec:
//
//   wss://api.fish.audio/v1/tts/live       model: s1 | s2-pro
//   POST /v1/tts/stream/with-timestamp     model: s1 | s2-pro | s2.1-pro | s2.1-pro-free
//
// So s2.1-pro is not excluded from realtime use at all; it is excluded from
// the WebSocket. This module uses the HTTP endpoint instead, which streams
// Server-Sent Events where each event carries one audio chunk.
//
// The tradeoff versus the WebSocket: one request per sentence rather than one
// persistent session. HTTP keep-alive absorbs most of that, and it buys the
// better model — which is the point.

import { TTS_MODEL_STANDARD } from './client'

const BASE = 'https://api.fish.audio'

export interface StreamTTSOptions {
  voiceId?: string | null
  model?: string
  /**
   * 16000 rather than telephony's 8000 by default: the agent's voice is
   * generated at full width and only narrowed at the very last step, if the
   * transport requires it. Generating at 8k throws away detail that can never
   * be recovered.
   */
  sampleRate?: number
  latency?: 'low' | 'normal' | 'balanced'
  speed?: number
  signal?: AbortSignal
}

interface TimestampEvent {
  audio_base64?: string
  chunk_seq?: number
  chunk_audio_offset_sec?: number
  content?: string
}

/**
 * Synthesise one piece of text, yielding raw PCM as it arrives.
 *
 * Chunks must be concatenated in arrival order — `chunk_seq` is informational,
 * not a reordering instruction, because SSE preserves order on a single
 * connection.
 */
export async function* streamTTS(
  text: string,
  opts: StreamTTSOptions = {}
): AsyncGenerator<Buffer> {
  const body: Record<string, unknown> = {
    text,
    format: 'pcm',
    sample_rate: opts.sampleRate ?? 16000,
    latency: opts.latency ?? 'low',
    normalize: true,
  }
  if (opts.voiceId) body.reference_id = opts.voiceId
  if (opts.speed !== undefined) body.prosody = { speed: opts.speed }

  const res = await fetch(`${BASE}/v1/tts/stream/with-timestamp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.FISH_AUDIO_API_KEY!}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      // Model selection is a header on every Fish TTS endpoint, never a body
      // field. Sent in the body it is ignored and you silently get the
      // account default — which is s2.1-pro-free, without TTFA guarantees.
      model: opts.model ?? TTS_MODEL_STANDARD,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  })

  if (!res.ok || !res.body) {
    throw new Error(`Fish streaming TTS failed ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by a blank line. The trailing element is
    // usually a partial frame, so it stays in the buffer.
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''

    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue

        try {
          const evt = JSON.parse(payload) as TimestampEvent
          if (evt.audio_base64) {
            yield Buffer.from(evt.audio_base64, 'base64')
          }
        } catch {
          // A malformed frame is not worth dropping the utterance over.
          continue
        }
      }
    }
  }
}

/**
 * Speaks a queue of sentences in order.
 *
 * Serialisation is the whole reason this class exists. Firing a request per
 * sentence concurrently would be faster but interleaves the audio of sentence
 * two into sentence one — the agent comes out sounding like two people talking
 * at once. Each sentence therefore waits for the previous one to finish
 * streaming.
 */
export class FishStreamSpeaker {
  private queue: string[] = []
  private running = false
  private controller: AbortController | null = null
  private aborted = false

  constructor(
    private opts: StreamTTSOptions & {
      onAudio: (pcm: Buffer) => void
      onError?: (err: Error) => void
    }
  ) {}

  push(text: string) {
    if (this.aborted || !text.trim()) return
    this.queue.push(text)
    if (!this.running) void this.drain()
  }

  private async drain() {
    this.running = true
    while (this.queue.length && !this.aborted) {
      const text = this.queue.shift()!
      this.controller = new AbortController()
      try {
        for await (const pcm of streamTTS(text, {
          ...this.opts,
          signal: this.controller.signal,
        })) {
          if (this.aborted) break
          this.opts.onAudio(pcm)
        }
      } catch (err) {
        // An abort is an expected interruption, not a failure to report.
        if (!this.aborted) {
          this.opts.onError?.(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }
    this.running = false
  }

  /** Nothing is buffered between sentences, so this is a no-op by design. */
  async flush() {}

  async stop() {
    // Let whatever is queued finish playing — this ends the utterance, it does
    // not cut it off. abort() is the one that cuts.
    this.aborted = false
  }

  abort() {
    this.aborted = true
    this.queue = []
    this.controller?.abort()
  }

  get idle(): boolean {
    return !this.running && !this.queue.length
  }
}
