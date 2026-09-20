import type { KnowledgeSourceRef, VoiceToolName } from '../contracts'
import type { PlaybackTracker } from '../audio/playback'
import { SentenceChunker } from '../text/chunker'
import type { TtsProvider, TtsStream } from '../providers/tts'
import type { ProviderError } from '../providers/errors'
import { deferred, type Deferred } from '../util/emitter'

// One agent turn as the caller hears it. Text arrives in pieces (LLM deltas,
// fillers, tool hops) and becomes a sequence of TTS segments — one provider
// stream each, because a stream can't stay open across a slow tool call.
// Segments may generate concurrently, but their audio reaches the channel in
// order: a segment's audio is held until every earlier segment finished.
// Word timestamps (Cartesia) or byte proportions (ElevenLabs) turn "bytes the
// caller heard" back into "text the caller heard" for barge-in transcripts.
// The same estimate tells when each sentence starts playing, for owners who
// watch the live transcript of a browser test call.

const APPROX_CHARS_PER_SECOND = 15
/**
 * Cartesia expires a context ~1 s after its last audio, and a sentence renders
 * in a few hundred ms. If the LLM pauses longer than this between sentences,
 * the next sentence goes to a fresh segment instead of a possibly expired context.
 */
const SEGMENT_IDLE_ROTATE_MS = 700

export interface Segment {
  stream: TtsStream
  text: string
  lastPushAt: number
  /** Pending audio while an earlier segment is still generating. */
  held: Buffer[]
  /** Byte offset in the playback stream of this segment's first audio; null until written. */
  startOffset: number | null
  writtenBytes: number
  words: { word: string; end: number }[]
  done: boolean
  /** True when no more text will be pushed. */
  ended: boolean
}

export type UtteranceOutcome = 'played' | 'interrupted' | 'failed'

/** A sentence-sized piece of a segment, reported once its audio starts playing. */
interface SpeechPiece {
  segment: Segment
  /** Offset of the piece in `segment.text`. */
  charStart: number
  text: string
  state: 'waiting' | 'scheduled' | 'spoken'
  timer: NodeJS.Timeout | null
}

export interface UtteranceHooks {
  /** A segment's provider stream failed; the owner decides how to recover. */
  onSegmentError(utterance: Utterance, segment: Segment, error: ProviderError): void
  /** First audio of the utterance reached the channel. */
  onFirstAudio?(utterance: Utterance): void
  /**
   * A sentence started playing (estimated from the playback position). When
   * absent, sentences aren't tracked at all (phone calls have no live view).
   */
  onSpeechText?(utterance: Utterance, text: string): void
}

export class Utterance {
  readonly segments: Segment[] = []
  readonly toolCalls: { name: VoiceToolName; ok: boolean }[] = []
  readonly sources: KnowledgeSourceRef[] = []
  interrupted = false
  closed = false
  failed = false
  startedAtSeconds: number | null = null
  private readonly chunker = new SentenceChunker()
  private readonly finished: Deferred<UtteranceOutcome> = deferred<UtteranceOutcome>()
  private waitingForPlayback = false
  private currentHop = -1
  private readonly pieces: SpeechPiece[] = []
  private lastSpeechAt = 0

  constructor(
    readonly id: number,
    private tts: TtsProvider,
    private readonly playback: PlaybackTracker,
    private readonly bytesPerSecond: number,
    private readonly hooks: UtteranceHooks,
    private readonly clockSeconds: () => number
  ) {}

  get outcome(): Promise<UtteranceOutcome> {
    return this.finished.promise
  }

  get text(): string {
    return this.segments.map((s) => s.text).join('') + this.chunker.pending
  }

  get hasSpeech(): boolean {
    return this.text.trim().length > 0
  }

  /** Some of this utterance's text was already reported through onSpeechText. */
  get speechReported(): boolean {
    return this.pieces.some((p) => p.state === 'spoken')
  }

  /** Reports every sentence not reported yet, in order (the utterance finished playing). */
  flushSpeech(): void {
    for (const piece of this.pieces) {
      if (piece.state === 'spoken') continue
      if (piece.timer) clearTimeout(piece.timer)
      piece.timer = null
      this.speak(piece)
    }
  }

  /** Swap the provider for segments created from now on (sticky component fallback). */
  useProvider(tts: TtsProvider): void {
    this.tts = tts
  }

  /** Streamed LLM text. A new hop starts a new segment. */
  pushDelta(delta: string, hop: number): void {
    if (this.closed || this.interrupted) return
    if (hop !== this.currentHop) {
      this.flushChunker()
      this.endOpenSegment()
      this.currentHop = hop
    }
    for (const piece of this.chunker.push(delta)) this.pushToOpenSegment(piece)
  }

  /** A complete line (greeting, filler, silence prompt) as its own segment. */
  pushLine(text: string): void {
    if (this.closed || this.interrupted || !text.trim()) return
    this.flushChunker()
    this.endOpenSegment()
    const segment = this.openSegment()
    segment.text += text.endsWith(' ') ? text : `${text} `
    if (this.hooks.onSpeechText) {
      const sentences = new SentenceChunker()
      let offset = 0
      for (const sentence of [...sentences.push(segment.text), ...sentences.flush()]) {
        this.addPiece(segment, offset, sentence)
        offset += sentence.length
      }
    }
    segment.stream.push(segment.text)
    segment.ended = true
    segment.stream.end()
    this.currentHop = -1
  }

  /** The current hop's text is complete. */
  endHop(): void {
    this.flushChunker()
    this.endOpenSegment()
  }

  /** No more text will come; resolves `outcome` once everything played. */
  close(): void {
    if (this.closed) return
    this.flushChunker()
    this.endOpenSegment()
    this.closed = true
    this.maybeFinish()
  }

  /** Barge-in: stop generation, drop queued audio; returns the text the caller heard. */
  interrupt(): string {
    if (this.interrupted) return ''
    this.interrupted = true
    this.closed = true
    this.cancelSpeechTimers()
    for (const segment of this.segments) {
      segment.held = []
      if (!segment.done) segment.stream.cancel()
    }
    const heardOffset = this.playback.clear()
    const heard = this.heardText(heardOffset)
    this.finished.resolve('interrupted')
    return heard
  }

  /** Ends the utterance without playback (engine stopping or unrecoverable failure). */
  abandon(): void {
    if (this.finished.settled) return
    this.closed = true
    this.failed = true
    this.cancelSpeechTimers()
    for (const segment of this.segments) if (!segment.done) segment.stream.cancel()
    this.finished.resolve('failed')
  }

  /**
   * Replaces a failed segment with a new one on `tts`, carrying over the text
   * the caller hasn't received audio for yet. Returns false if nothing is left.
   */
  replaceSegment(failed: Segment, tts: TtsProvider): boolean {
    this.tts = tts
    const index = this.segments.indexOf(failed)
    if (index === -1 || this.interrupted) return false
    failed.done = true
    const spokenWords = failed.words.length
    const remaining = spokenWords > 0 ? dropWords(failed.text, spokenWords) : failed.text
    // Whatever audio arrived stays; the failed segment's text shrinks to it.
    failed.text = failed.text.slice(0, failed.text.length - remaining.length)
    const replacement = this.createSegment()
    replacement.text = remaining
    this.segments.splice(index + 1, 0, replacement)
    // Sentences the failed segment never started move with the text they belong to.
    for (const piece of this.pieces) {
      if (piece.segment !== failed || piece.state !== 'waiting' || piece.charStart < failed.text.length) continue
      piece.segment = replacement
      piece.charStart -= failed.text.length
    }
    if (remaining.trim()) replacement.stream.push(remaining)
    if (failed.ended) {
      replacement.ended = true
      replacement.stream.end()
    }
    this.flushHeld()
    return remaining.trim().length > 0 || !failed.ended
  }

  private flushChunker(): void {
    for (const piece of this.chunker.flush()) this.pushToOpenSegment(piece)
  }

  private openSegmentOrNull(): Segment | null {
    const last = this.segments.at(-1)
    return last && !last.ended ? last : null
  }

  private pushToOpenSegment(piece: string): void {
    if (!piece) return
    const now = Date.now()
    let segment = this.openSegmentOrNull()
    if (segment && segment.text && now - segment.lastPushAt > SEGMENT_IDLE_ROTATE_MS) {
      this.endOpenSegment()
      segment = null
    }
    segment ??= this.openSegment()
    if (this.hooks.onSpeechText) this.addPiece(segment, segment.text.length, piece)
    segment.text += piece
    segment.lastPushAt = now
    segment.stream.push(piece)
  }

  private endOpenSegment(): void {
    const segment = this.openSegmentOrNull()
    if (!segment) return
    segment.ended = true
    segment.stream.end()
  }

  private openSegment(): Segment {
    const segment = this.createSegment()
    this.segments.push(segment)
    return segment
  }

  private createSegment(): Segment {
    const stream = this.tts.createStream()
    const segment: Segment = { stream, text: '', lastPushAt: Date.now(), held: [], startOffset: null, writtenBytes: 0, words: [], done: false, ended: false }
    stream.on('audio', (chunk) => {
      if (this.interrupted || segment.stream !== stream) return
      segment.held.push(chunk)
      this.flushHeld()
    })
    stream.on('words', (timings) => {
      for (let i = 0; i < timings.words.length; i++) {
        segment.words.push({ word: timings.words[i], end: Number(timings.end[i]) || 0 })
      }
      if (segment.stream === stream) this.scheduleSpeech(segment)
    })
    stream.on('done', () => {
      if (segment.stream !== stream) return
      segment.done = true
      this.flushHeld()
      this.scheduleSpeech(segment)
    })
    stream.on('error', (error) => {
      if (this.interrupted || segment.stream !== stream) return
      this.hooks.onSegmentError(this, segment, error)
    })
    return segment
  }

  /** Writes held audio in segment order. */
  private flushHeld(): void {
    if (this.interrupted) return
    for (const segment of this.segments) {
      if (segment.held.length > 0) {
        for (const chunk of segment.held) {
          if (segment.startOffset === null) {
            segment.startOffset = this.playback.writtenBytes
            if (this.startedAtSeconds === null) {
              this.startedAtSeconds = this.clockSeconds()
              this.hooks.onFirstAudio?.(this)
            }
          }
          this.playback.write(chunk)
          segment.writtenBytes += chunk.length
        }
        segment.held = []
        this.scheduleSpeech(segment)
      }
      if (!segment.done) return
    }
    this.maybeFinish()
  }

  private maybeFinish(): void {
    if (!this.closed || this.interrupted || this.waitingForPlayback || this.finished.settled) return
    if (this.segments.some((s) => !s.done)) return
    this.waitingForPlayback = true
    void this.playback.markEnd().then((result) => {
      if (this.interrupted) return
      this.finished.resolve(result === 'played' ? 'played' : 'interrupted')
    })
  }

  private addPiece(segment: Segment, charStart: number, text: string): void {
    if (!text.trim()) return
    this.pieces.push({ segment, charStart, text, state: 'waiting', timer: null })
  }

  /**
   * Schedules the segment's waiting sentences for the moment their audio
   * reaches the caller. The playback position is an estimate (marks anchor
   * it), so a sentence is reported once the audio written before it has had
   * time to play.
   */
  private scheduleSpeech(segment: Segment): void {
    if (!this.hooks.onSpeechText || this.interrupted || this.failed || segment.startOffset === null) return
    for (const piece of this.pieces) {
      if (piece.segment !== segment || piece.state !== 'waiting') continue
      const offset = this.pieceOffset(piece)
      // Its start isn't known yet (no timestamps or audio for it so far): later pieces wait too.
      if (offset === null) return
      piece.state = 'scheduled'
      const now = Date.now()
      const delay = Math.max(0, ((offset - this.playback.playedBytes(now)) / this.bytesPerSecond) * 1000)
      // Never report a sentence before the one ahead of it.
      const at = Math.max(now + delay, this.lastSpeechAt)
      this.lastSpeechAt = at
      piece.timer = setTimeout(() => {
        piece.timer = null
        this.speak(piece)
      }, at - now)
      piece.timer.unref()
    }
  }

  /** Byte offset in the playback stream where the piece starts, or null while that isn't known. */
  private pieceOffset(piece: SpeechPiece): number | null {
    const segment = piece.segment
    if (segment.startOffset === null) return null
    const written = segment.startOffset + segment.writtenBytes
    if (piece.charStart <= 0) return segment.startOffset
    if (segment.words.length === 0) {
      if (!segment.done || segment.text.length === 0) return null
      // No timestamps (ElevenLabs): by the share of the text, once all its audio is known.
      return segment.startOffset + Math.floor((piece.charStart / segment.text.length) * segment.writtenBytes)
    }
    const wordsBefore = segment.text.slice(0, piece.charStart).match(/\S+/g)?.length ?? 0
    if (segment.words.length < wordsBefore) return segment.done ? written : null
    const startSeconds = wordsBefore === 0 ? 0 : segment.words[wordsBefore - 1].end
    const offset = segment.startOffset + Math.floor(startSeconds * this.bytesPerSecond)
    // The audio where the piece starts must have been written.
    if (offset > written) return segment.done ? written : null
    return offset
  }

  private speak(piece: SpeechPiece): void {
    if (piece.state === 'spoken' || this.interrupted) return
    piece.state = 'spoken'
    this.hooks.onSpeechText?.(this, piece.text.trim())
  }

  private cancelSpeechTimers(): void {
    for (const piece of this.pieces) {
      if (piece.timer) clearTimeout(piece.timer)
      piece.timer = null
      if (piece.state === 'scheduled') piece.state = 'waiting'
    }
  }

  /** Text covered by audio up to `heardOffset` in the playback stream. */
  heardText(heardOffset: number): string {
    let heard = ''
    for (const segment of this.segments) {
      if (segment.startOffset === null) break
      const playedBytes = Math.max(0, Math.min(segment.writtenBytes, heardOffset - segment.startOffset))
      if (playedBytes <= 0) break
      if (segment.words.length > 0) {
        const playedSeconds = playedBytes / this.bytesPerSecond
        const words = segment.words.filter((w) => w.end <= playedSeconds + 0.05).map((w) => w.word)
        if (words.length > 0) heard += (heard ? ' ' : '') + words.join(' ')
        if (playedBytes < segment.writtenBytes || !segment.done) break
      } else {
        // No timestamps (ElevenLabs): proportional estimate by audio length.
        const totalBytes = segment.done ? segment.writtenBytes : Math.max(segment.writtenBytes, (segment.text.length / APPROX_CHARS_PER_SECOND) * this.bytesPerSecond)
        const fraction = totalBytes > 0 ? Math.min(1, playedBytes / totalBytes) : 0
        const cut = cutAtWord(segment.text, Math.round(segment.text.length * fraction))
        if (cut) heard += (heard ? ' ' : '') + cut
        if (fraction < 1) break
      }
    }
    return heard.replace(/\s+/g, ' ').trim()
  }
}

function dropWords(text: string, count: number): string {
  let index = 0
  let dropped = 0
  const re = /\S+\s*/g
  let match: RegExpExecArray | null
  while (dropped < count && (match = re.exec(text)) !== null) {
    index = match.index + match[0].length
    dropped++
  }
  return text.slice(index)
}

function cutAtWord(text: string, length: number): string {
  if (length >= text.length) return text.trim()
  const slice = text.slice(0, length)
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : '').trim()
}
