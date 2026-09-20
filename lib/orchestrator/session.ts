// ─── Call session ────────────────────────────────────────────────────────────
// One instance per live call. Owns the conversation state machine:
//
//   caller audio → VAD → STT → LLM → TTS → caller
//
// ElevenLabs ran this loop; the reason it now lives here is that Fish Audio
// supplies voice only and Telnyx supplies transport only, and nobody supplies
// the loop between them. Everything subtle about how the agent *feels* on a
// call — interruption handling, endpointing, how much it says at once — is
// decided in this file.

import { decodeFromTransport, encodeForTransport, type TelephonyCodec } from '@/lib/audio/codec'
import { FishStreamSpeaker } from '@/lib/fish/stream'
import { speechToText, asrCostUsd, ttsCostUsd } from '@/lib/fish/client'
import { createSentenceChunker, streamCompletion, type ChatMessage } from './llm'
import { formatBreakdown, LatencyTracker, type TurnTimings } from './metrics'
import { DEFAULT_VAD, SAMPLE_RATE, VAD } from './vad'

export interface AgentConfig {
  id: string
  orgId: string
  name: string
  systemPrompt: string
  firstMessage: string
  language: string
  voiceId: string | null
  llmModel: string
  /** Injected retrieved context, if the agent has a knowledge base. */
  retrieve?: (query: string) => Promise<string[]>
}

/**
 * Where the caller's words come from.
 *
 * 'telnyx' — Telnyx runs a streaming engine on the call leg and pushes
 *   `call.transcription` webhooks. The transcript is usually ready within a
 *   few hundred ms of the caller stopping, because the engine transcribes
 *   *during* speech rather than after it.
 *
 * 'fish' — we buffer the utterance ourselves and POST it to Fish's batch ASR
 *   once our VAD decides the caller finished. Simpler and cheaper, but the
 *   upload-and-wait round trip cannot start until the caller is already
 *   silent, which puts a hard floor of roughly 800ms on every reply.
 *
 * VAD runs either way: with 'telnyx' it no longer decides *what* was said,
 * but it is still the fastest signal that the caller has started talking,
 * which is what barge-in needs.
 */
export type SttSource = 'telnyx' | 'fish'

export interface TranscriptEntry {
  role: 'agent' | 'user'
  message: string
  time_in_call_secs: number
}

export interface SessionCallbacks {
  /** Send a frame to Telnyx's media WebSocket. */
  send: (msg: Record<string, unknown>) => void
  onTranscript?: (entry: TranscriptEntry) => void
  onError?: (err: Error) => void
}

// Guard against a stuck call billing forever if a hangup webhook is missed.
const MAX_UTTERANCE_MS = 30_000

/** TTS is generated at 16kHz and narrowed only if the transport demands it. */
const TTS_SAMPLE_RATE = 16000

/** Bytes in one 20ms frame, per transport codec. */
const FRAME_BYTES: Record<TelephonyCodec, number> = {
  PCMU: 160,  // 8kHz, 1 byte/sample
  PCMA: 160,  // 8kHz, 1 byte/sample
  L16: 640,   // 16kHz, 2 bytes/sample
}

export class CallSession {
  private vad = new VAD()
  private utterance: Buffer[] = []
  private utteranceBytes = 0
  private history: ChatMessage[] = []
  private tts: FishStreamSpeaker | null = null
  /** Codec negotiated for audio we send back; set from Telnyx's start frame. */
  private codec: TelephonyCodec = 'PCMU'
  /** Encoding of audio arriving from the caller; also from the start frame. */
  private inboundEncoding = 'PCMU'
  private llmAbort: AbortController | null = null
  private speaking = false
  private startedAt = Date.now()
  private closed = false
  private latency = new LatencyTracker(DEFAULT_VAD.silenceMs)
  /** Timings for the turn currently in flight, if any. */
  private turn: TurnTimings | null = null

  /** Running cost of this call in USD, assembled from each metered vendor. */
  costUsd = 0

  constructor(
    private agent: AgentConfig,
    private cb: SessionCallbacks,
    private stt: SttSource = 'telnyx'
  ) {
    this.history.push({ role: 'system', content: agent.systemPrompt })
  }

  private elapsed(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000)
  }

  // ─── Inbound audio ─────────────────────────────────────────────────────────

  /**
   * Record the media format Telnyx negotiated for this call.
   *
   * Assuming PCMU is wrong often enough to matter: PCMA is the European PSTN
   * default, and decoding A-law as μ-law produces loud static rather than
   * silence — a failure that is obvious on the line but invisible in logs.
   */
  setMediaFormat(encoding?: string, outboundCodec?: string) {
    if (encoding) this.inboundEncoding = encoding.toUpperCase()
    const out = (outboundCodec ?? '').toUpperCase()
    if (out === 'L16' || out === 'PCMA' || out === 'PCMU') {
      this.codec = out
    }
  }

  /** Handle one `media` frame from Telnyx (base64, carrier-encoded). */
  handleMedia(payloadB64: string) {
    if (this.closed) return

    const pcm = decodeFromTransport(Buffer.from(payloadB64, 'base64'), this.inboundEncoding)
    const event = this.vad.push(pcm)

    if (event === 'speech-start') {
      // Barge-in. The caller talking over the agent is an instruction to stop,
      // and acting on it instantly is most of what makes an agent feel like it
      // is listening rather than reciting.
      if (this.speaking) this.interrupt()
      this.utterance = []
      this.utteranceBytes = 0
    }

    if (this.stt === 'telnyx') {
      // Telnyx owns the words; VAD only marks when the caller stopped, so the
      // latency breakdown can separate "waiting for silence" from "waiting for
      // the engine". No audio is buffered here at all.
      if (event === 'speech-end' && !this.turn) {
        this.turn = { endpoint: Date.now() }
      }
      return
    }

    if (this.vad.active) {
      this.utterance.push(pcm)
      this.utteranceBytes += pcm.length

      // A caller who never pauses would otherwise buffer without limit.
      if (this.utteranceBytes > (MAX_UTTERANCE_MS / 1000) * SAMPLE_RATE * 2) {
        void this.completeTurn()
      }
      return
    }

    if (event === 'speech-end') {
      void this.completeTurn()
    }
  }

  /**
   * Feed a transcript from Telnyx's engine.
   *
   * Interim results are ignored: they arrive repeatedly and get revised, so
   * responding to one means answering a sentence the caller had not finished.
   */
  handleTranscript(text: string, isFinal: boolean) {
    if (this.closed || this.stt !== 'telnyx') return
    if (!isFinal) return

    const clean = text.trim()
    if (!clean) return

    // A transcript can land before VAD has called the silence, in which case
    // the engine endpointed faster than our timer — start the clock now rather
    // than leaving the turn untimed.
    if (!this.turn) this.turn = { endpoint: Date.now() }
    this.turn.transcribed = Date.now()

    this.cb.onTranscript?.({ role: 'user', message: clean, time_in_call_secs: this.elapsed() })
    void this.respond(clean)
  }

  /** Stop everything the agent is currently saying. */
  private interrupt() {
    this.speaking = false
    // An interrupted turn never reached the caller's ear, so timing it would
    // pollute the latency stats with a measurement of something nobody heard.
    this.turn = null
    this.llmAbort?.abort()
    this.llmAbort = null
    this.tts?.abort()
    this.tts = null
    // Drops audio Telnyx has queued but not yet played. Without this the
    // agent keeps talking for however long the buffer is deep, which is the
    // most common way "barge-in" ends up only half-working.
    this.cb.send({ event: 'clear' })
  }

  // ─── Turn handling ─────────────────────────────────────────────────────────

  /** Greet the caller. Called once the call is answered. */
  async greet() {
    if (!this.agent.firstMessage) return
    this.history.push({ role: 'assistant', content: this.agent.firstMessage })
    this.cb.onTranscript?.({
      role: 'agent',
      message: this.agent.firstMessage,
      time_in_call_secs: this.elapsed(),
    })
    await this.speak(this.agent.firstMessage)
  }

  private async completeTurn() {
    const audio = Buffer.concat(this.utterance)
    this.utterance = []
    this.utteranceBytes = 0
    this.vad.reset()

    // Too short to be real speech — a cough, a door, a line click.
    if (audio.length < SAMPLE_RATE * 0.3 * 2) return

    // The clock starts here: the caller has stopped talking and is now waiting.
    this.turn = { endpoint: Date.now() }

    try {
      const asr = await speechToText(new Blob([toWav(audio)]), {
        language: this.agent.language,
        timestamps: false,
      })
      this.turn.transcribed = Date.now()
      this.costUsd += asrCostUsd(asr.duration ?? audio.length / (SAMPLE_RATE * 2))

      const text = asr.text?.trim()
      if (!text) {
        this.turn = null
        return
      }

      this.cb.onTranscript?.({ role: 'user', message: text, time_in_call_secs: this.elapsed() })
      await this.respond(text)
    } catch (err) {
      this.cb.onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  private async respond(userText: string) {
    let prompt = userText

    // Retrieval happens per turn rather than once per call because what the
    // caller needs changes as the conversation moves.
    if (this.agent.retrieve) {
      try {
        const chunks = await this.agent.retrieve(userText)
        if (chunks.length) {
          prompt = `${userText}\n\n[Context from knowledge base:\n${chunks.join('\n---\n')}\n]`
        }
      } catch (err) {
        // Retrieval failure degrades the answer; it must not drop the call.
        this.cb.onError?.(err instanceof Error ? err : new Error(String(err)))
      }
    }

    this.history.push({ role: 'user', content: prompt })

    this.llmAbort = new AbortController()
    const signal = this.llmAbort.signal
    const chunker = createSentenceChunker()

    this.speaking = true
    this.tts = this.openTTS()

    let full = ''
    try {
      for await (const token of streamCompletion(this.history, {
        model: this.agent.llmModel,
        signal,
      })) {
        if (signal.aborted) break
        if (this.turn && !this.turn.firstToken) this.turn.firstToken = Date.now()
        full += token
        const chunk = chunker.push(token)
        if (chunk) {
          if (this.turn && !this.turn.firstChunk) this.turn.firstChunk = Date.now()
          await this.pushToTTS(chunk)
        }
      }

      if (!signal.aborted) {
        const rest = chunker.flush()
        if (rest) await this.pushToTTS(rest)
        await this.tts?.flush()
        await this.tts?.stop()
      }
    } catch (err) {
      if (!signal.aborted) {
        this.cb.onError?.(err instanceof Error ? err : new Error(String(err)))
      }
    }

    // Record what was actually generated even if cut short — the caller heard
    // part of it, so the transcript and the model's own context must reflect
    // that rather than pretending the turn never happened.
    if (full.trim()) {
      this.history.push({ role: 'assistant', content: full })
      this.cb.onTranscript?.({
        role: 'agent',
        message: full.trim(),
        time_in_call_secs: this.elapsed(),
      })
    }

    this.speaking = false
  }

  // ─── Outbound audio ────────────────────────────────────────────────────────

  /**
   * Open a speaker for one reply.
   *
   * Uses Fish's SSE streaming endpoint rather than their WebSocket, because
   * only the SSE endpoint accepts s2.1-pro — see lib/fish/stream.ts for the
   * evidence. Generation is at 16kHz regardless of what the line carries, so
   * quality is only ever reduced at the final transport step.
   */
  private openTTS(): FishStreamSpeaker {
    return new FishStreamSpeaker({
      voiceId: this.agent.voiceId,
      sampleRate: TTS_SAMPLE_RATE,
      latency: 'low',
      onAudio: (pcm) => this.sendAudio(pcm),
      onError: (err) => this.cb.onError?.(err),
    })
  }

  private async pushToTTS(text: string) {
    this.costUsd += ttsCostUsd(text)
    await this.tts?.push(text)
  }

  /** Speak a fixed string (greeting, closing, error fallback). */
  private async speak(text: string): Promise<void> {
    this.speaking = true
    const session = this.openTTS()
    this.tts = session
    this.costUsd += ttsCostUsd(text)
    await session.push(text)
    await session.flush()
    await session.stop()
    this.speaking = false
  }

  /**
   * Encode PCM to μ-law and hand it to Telnyx in 20ms frames.
   *
   * Frame-sized sends matter: Telnyx accepts larger payloads, but chunking at
   * the RTP frame boundary keeps the `clear` command's effect tight, so an
   * interruption cuts the agent off mid-word rather than at the end of a
   * multi-second blob.
   */
  private sendAudio(pcm: Buffer) {
    if (this.closed) return

    // First audio of a turn closes the measurement — this is the instant the
    // caller stops waiting.
    if (this.turn && !this.turn.firstAudio) {
      this.turn.firstAudio = Date.now()
      const breakdown = this.latency.record(this.turn)
      if (breakdown) {
        console.log(`[turn] ${formatBreakdown(breakdown)}`)
      }
      this.turn = null
    }

    const encoded = encodeForTransport(pcm, this.codec)
    const frameBytes = FRAME_BYTES[this.codec]
    for (let i = 0; i < encoded.length; i += frameBytes) {
      const frame = encoded.subarray(i, Math.min(i + frameBytes, encoded.length))
      this.cb.send({ event: 'media', media: { payload: frame.toString('base64') } })
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  close() {
    if (this.closed) return
    this.closed = true
    this.llmAbort?.abort()
    this.tts?.abort()
  }

  get durationSeconds(): number {
    return this.elapsed()
  }

  /** Median and worst turn latency for this call, for end-of-call logging. */
  get latencyStats() {
    return {
      turns: this.latency.count,
      median: this.latency.median(),
      worst: this.latency.worst(),
    }
  }
}

/**
 * Wrap raw PCM in a 44-byte RIFF/WAVE container.
 *
 * Fish's ASR endpoint takes an audio *file*, not a raw sample stream, so the
 * buffered utterance needs a container before it can be sent.
 *
 * Returns Uint8Array rather than Buffer because Buffer's backing store is
 * typed as ArrayBufferLike, which does not satisfy BlobPart under strict
 * lib.dom types — a Blob built from one fails to typecheck.
 */
function toWav(pcm: Buffer, sampleRate = SAMPLE_RATE): Uint8Array<ArrayBuffer> {
  const out = Buffer.alloc(44 + pcm.length)
  out.write('RIFF', 0)
  out.writeUInt32LE(36 + pcm.length, 4)
  out.write('WAVE', 8)
  out.write('fmt ', 12)
  out.writeUInt32LE(16, 16)                // PCM chunk size
  out.writeUInt16LE(1, 20)                 // format 1 = PCM
  out.writeUInt16LE(1, 22)                 // mono
  out.writeUInt32LE(sampleRate, 24)
  out.writeUInt32LE(sampleRate * 2, 28)    // byte rate
  out.writeUInt16LE(2, 32)                 // block align
  out.writeUInt16LE(16, 34)                // bits per sample
  out.write('data', 36)
  out.writeUInt32LE(pcm.length, 40)
  pcm.copy(out, 44)
  return new Uint8Array(out)
}
