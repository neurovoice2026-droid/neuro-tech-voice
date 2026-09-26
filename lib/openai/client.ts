import 'server-only'
import crypto from 'node:crypto'
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  InternalServerError,
  RateLimitError,
} from 'openai'
import { ApiError } from '@/lib/api/http'
import { env, envString } from '@/lib/env'
import { estimateTokens } from '@/lib/knowledge/text'

// OpenAI access for the app: post-call analysis, knowledge-base embeddings and
// anything else that runs inside Next.js. The live voice loop runs in the
// gateway with its own client. SDK retries are off (maxRetries 0) because the
// callers decide: a live turn must never be replayed after audio has started,
// and background jobs retry through classifyOpenAIError.

export const DEFAULT_OPENAI_VOICE_MODEL = 'gpt-5.6-luna'
export const DEFAULT_OPENAI_ANALYSIS_MODEL = 'gpt-5.6-luna'
export const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
/** knowledge_chunks.embedding is vector(1536). */
export const EMBEDDING_DIMENSIONS = 1536

const CLIENT_TIMEOUT_MS = 15_000
const EMBEDDING_TIMEOUT_MS = 30_000
const EMBEDDING_BATCH_SIZE = 256
// The API caps a request at 300K tokens across inputs. Batches are cut by an
// estimated token count (Devanagari or Thai run about one token per
// character, so a character cap alone can overflow) with headroom for the
// estimate's error, plus a character cap as a second guard.
const EMBEDDING_BATCH_MAX_TOKENS = 250_000
const EMBEDDING_BATCH_MAX_CHARS = 600_000
const EMBEDDING_MAX_ATTEMPTS = 2
const MAX_RETRY_WAIT_MS = 5_000

let cachedClient: { key: string; client: OpenAI } | null = null

export function getOpenAI(): OpenAI {
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) throw new ApiError(503, 'not_configured', 'OpenAI is not configured.')
  // Rebuild when the key rotates (tests, env reload); one client per key otherwise.
  if (cachedClient?.key !== apiKey) {
    cachedClient = { key: apiKey, client: new OpenAI({ apiKey, maxRetries: 0, timeout: CLIENT_TIMEOUT_MS }) }
  }
  return cachedClient.client
}

export function openAIVoiceModel(): string {
  return envString('OPENAI_VOICE_MODEL', DEFAULT_OPENAI_VOICE_MODEL)
}

export function openAIAnalysisModel(): string {
  return envString('OPENAI_ANALYSIS_MODEL', DEFAULT_OPENAI_ANALYSIS_MODEL)
}

export function openAIEmbeddingModel(): string {
  return envString('OPENAI_EMBEDDING_MODEL', DEFAULT_OPENAI_EMBEDDING_MODEL)
}

// Billing or spend limits: retrying can't succeed, fail over instead.
const NO_RETRY_CODES = new Set([
  'insufficient_quota',
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
])

function errorName(e: unknown): string | null {
  return typeof e === 'object' && e !== null && typeof (e as { name?: unknown }).name === 'string'
    ? (e as { name: string }).name
    : null
}

/**
 * - `abort`: we cancelled it (barge-in, client gone). Not a failure.
 * - `timeout`: no answer in time; may be retried when nothing was consumed yet.
 * - `retry`: rate limit, overload, 5xx or connection error.
 * - `fatal`: bad request, auth, spend limits, anything else.
 */
export function classifyOpenAIError(e: unknown): 'abort' | 'timeout' | 'retry' | 'fatal' {
  if (e instanceof APIUserAbortError) return 'abort'
  // Order matters: the timeout error is a subclass of the connection error.
  if (e instanceof APIConnectionTimeoutError) return 'timeout'
  if (e instanceof RateLimitError) return NO_RETRY_CODES.has(e.code ?? '') ? 'fatal' : 'retry'
  if (e instanceof InternalServerError || e instanceof APIConnectionError) return 'retry'
  if (e instanceof APIError) {
    if (NO_RETRY_CODES.has(e.code ?? '')) return 'fatal'
    return e.status === 408 || e.status === 409 ? 'retry' : 'fatal'
  }
  // Signals passed straight to fetch or streams surface as DOM exceptions.
  const name = errorName(e)
  if (name === 'AbortError') return 'abort'
  if (name === 'TimeoutError') return 'timeout'
  return 'fatal'
}

/** Milliseconds from retry-after-ms / retry-after, capped; null when absent. */
function retryAfterMs(e: unknown): number | null {
  if (!(e instanceof APIError) || !e.headers) return null
  const ms = Number(e.headers.get('retry-after-ms'))
  if (Number.isFinite(ms) && ms > 0) return Math.min(ms, MAX_RETRY_WAIT_MS)
  const seconds = Number(e.headers.get('retry-after'))
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, MAX_RETRY_WAIT_MS)
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Splits inputs into request-sized batches, preserving order. */
export function embeddingBatches(texts: string[]): string[][] {
  const batches: string[][] = []
  let current: string[] = []
  let chars = 0
  let tokens = 0
  for (const text of texts) {
    const textTokens = estimateTokens(text)
    if (
      current.length > 0 &&
      (current.length >= EMBEDDING_BATCH_SIZE ||
        chars + text.length > EMBEDDING_BATCH_MAX_CHARS ||
        tokens + textTokens > EMBEDDING_BATCH_MAX_TOKENS)
    ) {
      batches.push(current)
      current = []
      chars = 0
      tokens = 0
    }
    current.push(text)
    chars += text.length
    tokens += textTokens
  }
  if (current.length > 0) batches.push(current)
  return batches
}

interface EmbedOptions {
  /** Per request; defaults to 30 s. */
  timeoutMs?: number
  /** Including the first try; defaults to 2. Latency-sensitive callers pass 1. */
  maxAttempts?: number
}

async function embedBatch(client: OpenAI, model: string, input: string[], opts: EmbedOptions): Promise<number[][]> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? EMBEDDING_MAX_ATTEMPTS)
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await client.embeddings.create(
        {
          model,
          input,
          encoding_format: 'float',
          // ada-002 rejects `dimensions`; the text-embedding-3 family truncates to it.
          ...(model.startsWith('text-embedding-3') ? { dimensions: EMBEDDING_DIMENSIONS } : {}),
        },
        { timeout: opts.timeoutMs ?? EMBEDDING_TIMEOUT_MS }
      )
      const vectors: number[][] = new Array(input.length)
      for (const item of res.data) vectors[item.index] = item.embedding
      for (let i = 0; i < input.length; i++) {
        if (!Array.isArray(vectors[i]) || vectors[i].length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `OpenAI returned an embedding with ${vectors[i]?.length ?? 0} dimensions for input ${i}; expected ${EMBEDDING_DIMENSIONS}`
          )
        }
      }
      return vectors
    } catch (e) {
      const kind = classifyOpenAIError(e)
      if (attempt >= maxAttempts || (kind !== 'retry' && kind !== 'timeout')) throw e
      await sleep(retryAfterMs(e) ?? 500 * attempt)
    }
  }
}

/**
 * Embeds texts in order (1536 dims, float). Batches of ≤ 256 inputs, one retry
 * per batch on rate limits, overloads and timeouts (ingestion runs in the
 * background, so a short wait beats failing the document).
 */
export async function embedTexts(texts: string[], opts: EmbedOptions = {}): Promise<number[][]> {
  if (texts.length === 0) return []
  const empty = texts.findIndex((t) => typeof t !== 'string' || t.trim() === '')
  // The API rejects empty strings; failing here names the bad chunk.
  if (empty !== -1) throw new Error(`embedTexts: input ${empty} is empty`)

  const client = getOpenAI()
  const model = openAIEmbeddingModel()
  const vectors: number[][] = []
  for (const batch of embeddingBatches(texts)) {
    vectors.push(...(await embedBatch(client, model, batch, opts)))
  }
  return vectors
}

/** Stable per-organisation id for OpenAI abuse monitoring; never a phone number or email. */
export function safetyIdentifier(orgId: string): string {
  return crypto.createHash('sha256').update(orgId).digest('hex').slice(0, 32)
}
