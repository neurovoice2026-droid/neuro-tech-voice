// ─── Turn latency instrumentation ────────────────────────────────────────────
// Measures the only number that decides whether the agent feels alive: the gap
// between the caller finishing a sentence and hearing the first syllable back.
//
// The chain has five links and any one of them can be the problem, so they are
// timed separately. A single "response took 1.8s" figure tells you nothing
// actionable; knowing 700ms of it was the endpoint timer tells you exactly
// which knob to turn.

export interface TurnTimings {
  /** Silence detected — the caller has stopped speaking. */
  endpoint: number
  /** Transcript returned from ASR. */
  transcribed?: number
  /** First token out of the LLM. */
  firstToken?: number
  /** First text chunk handed to the TTS engine. */
  firstChunk?: number
  /** First audio frame pushed back into the call. */
  firstAudio?: number
}

export interface TurnBreakdown {
  /** Endpoint silence window — a config choice, not a cost. */
  endpointingMs: number
  asrMs: number
  llmTtftMs: number
  /** Time spent buffering tokens until a chunk was worth speaking. */
  chunkingMs: number
  ttsTtfaMs: number
  /** Endpoint → first audio. What the caller actually experiences. */
  totalMs: number
}

/**
 * Note on `endpointingMs`: it is reported as the configured silence window
 * rather than measured, because by the time the VAD fires, that time has
 * already passed. It is included because it is usually the single largest
 * term and excluding it would make the total look far better than the
 * caller's experience.
 */
export function summarise(t: TurnTimings, silenceMs: number): TurnBreakdown | null {
  if (!t.firstAudio) return null

  const asrMs = t.transcribed ? t.transcribed - t.endpoint : 0
  const llmTtftMs = t.firstToken && t.transcribed ? t.firstToken - t.transcribed : 0
  const chunkingMs = t.firstChunk && t.firstToken ? t.firstChunk - t.firstToken : 0
  const ttsTtfaMs = t.firstChunk ? t.firstAudio - t.firstChunk : 0

  return {
    endpointingMs: silenceMs,
    asrMs,
    llmTtftMs,
    chunkingMs,
    ttsTtfaMs,
    // Silence window included: this is perceived latency, not server time.
    totalMs: silenceMs + (t.firstAudio - t.endpoint),
  }
}

export function formatBreakdown(b: TurnBreakdown): string {
  return [
    `total ${b.totalMs}ms`,
    `endpoint ${b.endpointingMs}`,
    `asr ${b.asrMs}`,
    `llm ${b.llmTtftMs}`,
    `chunk ${b.chunkingMs}`,
    `tts ${b.ttsTtfaMs}`,
  ].join(' | ')
}

/** Rolling per-call aggregate, logged once when the call ends. */
export class LatencyTracker {
  private turns: TurnBreakdown[] = []

  constructor(private silenceMs: number) {}

  record(t: TurnTimings): TurnBreakdown | null {
    const b = summarise(t, this.silenceMs)
    if (b) this.turns.push(b)
    return b
  }

  get count(): number {
    return this.turns.length
  }

  /**
   * Median rather than mean: one slow turn (a cold TTS connection, a retried
   * request) skews an average badly on a call with only a handful of turns,
   * and would hide an otherwise healthy call behind one outlier.
   */
  median(): TurnBreakdown | null {
    if (!this.turns.length) return null
    const pick = (f: (b: TurnBreakdown) => number): number => {
      const sorted = this.turns.map(f).sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    return {
      endpointingMs: pick((b) => b.endpointingMs),
      asrMs: pick((b) => b.asrMs),
      llmTtftMs: pick((b) => b.llmTtftMs),
      chunkingMs: pick((b) => b.chunkingMs),
      ttsTtfaMs: pick((b) => b.ttsTtfaMs),
      totalMs: pick((b) => b.totalMs),
    }
  }

  worst(): TurnBreakdown | null {
    if (!this.turns.length) return null
    return this.turns.reduce((a, b) => (b.totalMs > a.totalMs ? b : a))
  }
}
