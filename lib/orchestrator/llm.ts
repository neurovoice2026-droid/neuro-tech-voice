// ─── LLM turn generation ─────────────────────────────────────────────────────
// ElevenLabs used to own this: we handed it a prompt and a model name and it
// ran the conversation. Running our own loop means calling the model directly,
// and streaming is not optional — the first sentence has to reach the TTS
// engine while the rest is still being written, or the caller hears silence.
//
// Hand-rolled fetch rather than a vendor SDK, matching the other service
// clients in this codebase (email, SmartBill, and the former ElevenLabs
// client all follow this shape).

/**
 * gpt-5.6-luna — the fast, low-cost tier of the GPT-5.6 family, which is the
 * right trade for a receptionist that must answer quickly far more than it
 * must reason deeply. Replaces the gpt-5.4-mini the ElevenLabs platform was
 * configured with, and keeps that same latency-first rationale.
 *
 * Use the FULL id, never the bare `gpt-5.6` alias: that alias resolves to Sol,
 * the top tier of the family, which is several times the price per token. The
 * mistake is silent — calls succeed and the bill arrives later.
 */
export const DEFAULT_LLM_MODEL = 'gpt-5.6-luna'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * GPT-5.6 defaults `reasoning_effort` to **medium**, and that default is wrong
 * for a phone call in a way that is easy to miss: reasoning tokens are emitted
 * before any visible token, so every turn pays a thinking delay before the
 * first word reaches the TTS engine. The caller hears it as dead air.
 *
 * 'none' is therefore set explicitly on every conversational turn. A
 * receptionist answering "what are your opening hours" gains nothing from
 * deliberation and loses the one thing that matters on a call.
 *
 * Accepted values are none | low | medium | high | xhigh | max — raise this
 * only for an agent doing genuinely analytical work, and expect the latency.
 */
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export const REALTIME_REASONING_EFFORT: ReasoningEffort = 'none'

export class LLMError extends Error {
  constructor(public status: number, public body: string) {
    super(`LLM API error ${status}: ${body}`)
    this.name = 'LLMError'
  }
}

export function isConfigured(): boolean {
  const key = process.env.LLM_API_KEY
  return !!key && key !== 'your-llm-api-key'
}

/**
 * Stream a reply token by token.
 *
 * `signal` is what makes barge-in work: when the caller interrupts, the
 * session aborts this generation rather than letting it run to completion and
 * bill for tokens nobody will ever hear.
 */
export async function* streamCompletion(
  messages: ChatMessage[],
  opts: {
    model?: string
    maxTokens?: number
    temperature?: number
    reasoningEffort?: ReasoningEffort
    signal?: AbortSignal
  } = {}
): AsyncGenerator<string> {
  const base = process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LLM_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_LLM_MODEL,
      messages,
      stream: true,
      reasoning_effort: opts.reasoningEffort ?? REALTIME_REASONING_EFFORT,
      // Phone replies must stay short; an agent that monologues is worse than
      // one that occasionally has to be asked to elaborate.
      max_tokens: opts.maxTokens ?? 300,
      temperature: opts.temperature ?? 0.7,
    }),
    signal: opts.signal,
  })

  if (!res.ok || !res.body) {
    throw new LLMError(res.status, await res.text().catch(() => ''))
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE frames are newline-delimited; the last element is usually a partial
    // line, so it is kept in the buffer rather than parsed.
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue

      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>
        }
        const token = parsed.choices?.[0]?.delta?.content
        if (token) yield token
      } catch {
        // A malformed frame mid-stream is not worth killing the call over.
        continue
      }
    }
  }
}

// ─── Sentence chunking ───────────────────────────────────────────────────────

/**
 * Splits a token stream into speakable chunks.
 *
 * TTS quality depends on the engine seeing whole clauses — feeding it raw
 * tokens produces flat, wrongly-stressed speech because it cannot see where
 * the sentence is going. Feeding it whole paragraphs is accurate but slow.
 * Clause boundaries are the compromise.
 *
 * `minLength` prevents "Da." or "OK." from being emitted as their own chunk,
 * which makes the agent sound clipped and staccato at the start of a reply.
 */
export function createSentenceChunker(minLength = 40, maxLength = 220) {
  let buffer = ''

  return {
    /** Feed a token; returns a chunk ready to speak, or null. */
    push(token: string): string | null {
      buffer += token

      if (buffer.length >= maxLength) {
        // Over the hard limit — break at the last space so a word is not split.
        const cut = buffer.lastIndexOf(' ', maxLength)
        const idx = cut > minLength ? cut : maxLength
        const chunk = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx)
        return chunk || null
      }

      if (buffer.length < minLength) return null

      // Sentence-final punctuation followed by whitespace. Checking for the
      // trailing space avoids cutting inside "3.5" or "dr. Ionescu".
      const match = /[.!?…](\s)/.exec(buffer)
      if (match) {
        const idx = match.index + 1
        const chunk = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx)
        return chunk || null
      }

      return null
    },

    /** Whatever is left when the stream ends. */
    flush(): string | null {
      const rest = buffer.trim()
      buffer = ''
      return rest || null
    },
  }
}
