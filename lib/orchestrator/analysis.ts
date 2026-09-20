// ─── Post-call analysis ──────────────────────────────────────────────────────
// ElevenLabs returned `transcript_summary` and `call_successful` on its
// post-call webhook, and the dashboard's summary and sentiment columns are fed
// entirely from those two fields. Nothing in the Fish/Telnyx stack produces
// them, so they are generated here from the transcript after the call ends.
//
// This runs off the critical path — the call is already over — so it uses a
// single non-streaming request and tolerates being slow.

import { DEFAULT_LLM_MODEL } from './llm'
import type { TranscriptEntry } from './session'

export type Sentiment = 'positive' | 'neutral' | 'negative'

export interface CallAnalysis {
  summary: string | null
  sentiment: Sentiment | null
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

const SYSTEM_PROMPT = `You analyse transcripts of phone calls handled by an AI receptionist.
Reply with ONLY a JSON object, no prose and no code fences:
{"summary": "<two sentences maximum, in the same language as the transcript>", "sentiment": "positive" | "neutral" | "negative"}

sentiment describes how the CALLER appeared to feel about the outcome, not the agent's politeness:
- positive: they got what they wanted
- neutral: routine, informational, or inconclusive
- negative: they were frustrated, blocked, or the agent could not help`

/**
 * Summarise a finished call. Returns nulls rather than throwing — a missing
 * summary makes one dashboard row less useful, while a thrown error here would
 * abort the webhook and lose the whole call record.
 */
export async function analyseCall(
  transcript: TranscriptEntry[],
  opts: { model?: string; language?: string } = {}
): Promise<CallAnalysis> {
  if (!transcript.length) return { summary: null, sentiment: null }

  const rendered = transcript
    .map((t) => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.message}`)
    .join('\n')

  try {
    const base = process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.LLM_API_KEY!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model ?? DEFAULT_LLM_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: rendered },
        ],
        temperature: 0.2,
        max_tokens: 200,
        // 'low' rather than the realtime 'none': this runs after the call, so
        // a little deliberation is affordable and produces a better summary.
        // Still well below the medium default, which would burn reasoning
        // tokens on what is essentially a summarisation task.
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      console.error('Call analysis failed:', res.status, await res.text())
      return { summary: null, sentiment: null }
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = json.choices?.[0]?.message?.content
    if (!content) return { summary: null, sentiment: null }

    const parsed = JSON.parse(content) as { summary?: string; sentiment?: string }
    const sentiment = (['positive', 'neutral', 'negative'] as const).find(
      (s) => s === parsed.sentiment
    )

    return {
      summary: parsed.summary?.trim() || null,
      // An unrecognised label is treated as neutral rather than null so the
      // dashboard's sentiment breakdown still totals to the call count.
      sentiment: sentiment ?? 'neutral',
    }
  } catch (err) {
    console.error('Call analysis failed:', err instanceof Error ? err.message : err)
    return { summary: null, sentiment: null }
  }
}
