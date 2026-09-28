import crypto from 'node:crypto'
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  RateLimitError,
} from 'openai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/http'
import {
  EMBEDDING_DIMENSIONS,
  classifyOpenAIError,
  embedTexts,
  embeddingBatches,
  getOpenAI,
  openAIAnalysisModel,
  openAIEmbeddingModel,
  openAIVoiceModel,
  safetyIdentifier,
} from './client'

type EmbeddingRequest = { url: string; body: { model: string; input: string[]; dimensions?: number; encoding_format?: string }; headers: Headers }

const requests: EmbeddingRequest[] = []
let replies: ((req: EmbeddingRequest) => Response)[] = []
let keyCounter = 0

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === 0 ? seed : 0))
}

// Answers with embeddings whose first component encodes the input's global
// position ("t<N>"), returned in reverse order to check index handling.
function embeddingsReply(req: EmbeddingRequest): Response {
  const data = req.body.input
    .map((text, index) => ({ object: 'embedding', index, embedding: vector(Number(text.slice(1))) }))
    .reverse()
  return new Response(JSON.stringify({ object: 'list', data, model: req.body.model, usage: { prompt_tokens: 1, total_tokens: 1 } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function errorReply(status: number, code: string | null, headers: Record<string, string> = {}): () => Response {
  return () =>
    new Response(JSON.stringify({ error: { message: 'nope', type: 'error', code } }), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    })
}

beforeEach(() => {
  requests.length = 0
  replies = []
  // A fresh key per test forces a fresh SDK client that picks up the stubbed fetch.
  vi.stubEnv('OPENAI_API_KEY', `sk-test-${++keyCounter}`)
  vi.stubEnv('OPENAI_EMBEDDING_MODEL', '')
  vi.stubEnv('OPENAI_VOICE_MODEL', '')
  vi.stubEnv('OPENAI_ANALYSIS_MODEL', '')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const req: EmbeddingRequest = {
        url: String(input instanceof Request ? input.url : input),
        body: JSON.parse(String(init.body)),
        headers: new Headers(init.headers),
      }
      requests.push(req)
      const reply = replies.shift() ?? embeddingsReply
      return reply(req)
    })
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('configuration', () => {
  it('throws ApiError 503 not_configured without a key', () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    expect(() => getOpenAI()).toThrow(ApiError)
    try {
      getOpenAI()
    } catch (e) {
      expect(e).toMatchObject({ status: 503, code: 'not_configured' })
    }
  })

  it('treats placeholder keys as missing', () => {
    vi.stubEnv('OPENAI_API_KEY', 'your-openai-api-key')
    expect(() => getOpenAI()).toThrow(/not configured/)
  })

  it('builds the client without SDK retries and a 15 s timeout, reusing it per key', () => {
    const client = getOpenAI()
    expect(client.maxRetries).toBe(0)
    expect(client.timeout).toBe(15_000)
    expect(getOpenAI()).toBe(client)
    vi.stubEnv('OPENAI_API_KEY', 'sk-rotated')
    expect(getOpenAI()).not.toBe(client)
  })

  it('defaults the models and honours overrides', () => {
    expect(openAIVoiceModel()).toBe('gpt-5.6-luna')
    expect(openAIAnalysisModel()).toBe('gpt-5.6-luna')
    expect(openAIEmbeddingModel()).toBe('text-embedding-3-small')
    vi.stubEnv('OPENAI_VOICE_MODEL', 'gpt-5.4-nano')
    vi.stubEnv('OPENAI_ANALYSIS_MODEL', 'gpt-5.6-terra')
    vi.stubEnv('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-large')
    expect(openAIVoiceModel()).toBe('gpt-5.4-nano')
    expect(openAIAnalysisModel()).toBe('gpt-5.6-terra')
    expect(openAIEmbeddingModel()).toBe('text-embedding-3-large')
  })
})

describe('classifyOpenAIError', () => {
  const headers = new Headers()

  it('recognises aborts', () => {
    expect(classifyOpenAIError(new APIUserAbortError())).toBe('abort')
    expect(classifyOpenAIError(new DOMException('aborted', 'AbortError'))).toBe('abort')
  })

  it('recognises timeouts before connection errors', () => {
    expect(classifyOpenAIError(new APIConnectionTimeoutError())).toBe('timeout')
    expect(classifyOpenAIError(new DOMException('timed out', 'TimeoutError'))).toBe('timeout')
  })

  it('retries rate limits, overloads, 5xx and connection errors', () => {
    expect(classifyOpenAIError(new RateLimitError(429, { code: 'rate_limit_exceeded' }, 'slow', headers))).toBe('retry')
    expect(classifyOpenAIError(new RateLimitError(429, undefined, 'slow_down', headers))).toBe('retry')
    expect(classifyOpenAIError(new InternalServerError(503, { code: 'server_is_overloaded' }, 'busy', headers))).toBe('retry')
    expect(classifyOpenAIError(new InternalServerError(500, undefined, 'boom', headers))).toBe('retry')
    expect(classifyOpenAIError(new APIConnectionError({ message: 'ECONNRESET' }))).toBe('retry')
    expect(classifyOpenAIError(new ConflictError(409, undefined, 'conflict', headers))).toBe('retry')
    expect(classifyOpenAIError(new APIError(408, undefined, 'timeout', headers))).toBe('retry')
  })

  it('never retries billing and spend limits', () => {
    for (const code of [
      'insufficient_quota',
      'credit_balance_exhausted',
      'organization_spend_limit_exceeded',
      'project_spend_limit_exceeded',
      'organization_usage_limit_exceeded',
    ]) {
      expect(classifyOpenAIError(new RateLimitError(429, { code }, 'limit', headers))).toBe('fatal')
    }
  })

  it('treats client errors and unknown values as fatal', () => {
    expect(classifyOpenAIError(new BadRequestError(400, { code: 'previous_response_not_found' }, 'bad', headers))).toBe('fatal')
    expect(classifyOpenAIError(new AuthenticationError(401, undefined, 'auth', headers))).toBe('fatal')
    expect(classifyOpenAIError(new Error('whatever'))).toBe('fatal')
    expect(classifyOpenAIError('string')).toBe('fatal')
    expect(classifyOpenAIError(null)).toBe('fatal')
  })
})

describe('embeddingBatches', () => {
  it('caps batches at 256 inputs and keeps order', () => {
    const texts = Array.from({ length: 600 }, (_, i) => `t${i}`)
    const batches = embeddingBatches(texts)
    expect(batches.map((b) => b.length)).toEqual([256, 256, 88])
    expect(batches.flat()).toEqual(texts)
  })

  it('splits on total size before the token cap', () => {
    const big = 'x'.repeat(250_000)
    expect(embeddingBatches([big, big, big]).map((b) => b.length)).toEqual([2, 1])
    expect(embeddingBatches([])).toEqual([])
  })

  it('splits dense scripts by estimated tokens, not characters', () => {
    // Devanagari is about one token per character: 3 × 100K chars would pass a character cap but not the 300K-token request cap.
    const hindi = 'क'.repeat(100_000)
    expect(embeddingBatches([hindi, hindi, hindi]).map((b) => b.length)).toEqual([2, 1])
  })
})

describe('embedTexts', () => {
  it('returns [] without calling OpenAI', async () => {
    expect(await embedTexts([])).toEqual([])
    expect(requests).toHaveLength(0)
  })

  it('embeds in order across batches with the small model at 1536 dims', async () => {
    const texts = Array.from({ length: 300 }, (_, i) => `t${i}`)
    const vectors = await embedTexts(texts)
    expect(requests).toHaveLength(2)
    expect(requests[0].url).toBe('https://api.openai.com/v1/embeddings')
    expect(requests[0].headers.get('authorization')).toMatch(/^Bearer sk-test-/)
    expect(requests[0].body).toMatchObject({ model: 'text-embedding-3-small', dimensions: 1536, encoding_format: 'float' })
    expect(requests[0].body.input).toHaveLength(256)
    expect(requests[1].body.input).toHaveLength(44)
    expect(vectors).toHaveLength(300)
    expect(vectors.map((v) => v[0])).toEqual(texts.map((_, i) => i))
    expect(vectors.every((v) => v.length === 1536)).toBe(true)
  })

  it('rejects empty inputs before calling OpenAI', async () => {
    await expect(embedTexts(['t0', '  '])).rejects.toThrow('input 1 is empty')
    expect(requests).toHaveLength(0)
  })

  it('retries a batch once on a rate limit', async () => {
    replies.push(errorReply(429, 'rate_limit_exceeded', { 'retry-after-ms': '10' }))
    const vectors = await embedTexts(['t7'])
    expect(requests).toHaveLength(2)
    expect(vectors[0][0]).toBe(7)
  })

  it('does not retry spend limits', async () => {
    replies.push(errorReply(429, 'insufficient_quota'))
    const error = await embedTexts(['t1']).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RateLimitError)
    expect(classifyOpenAIError(error)).toBe('fatal')
    expect(requests).toHaveLength(1)
  })

  it('gives up after the second failure', async () => {
    replies.push(errorReply(500, null, { 'retry-after-ms': '5' }), errorReply(500, null, { 'retry-after-ms': '5' }))
    await expect(embedTexts(['t1'])).rejects.toBeInstanceOf(InternalServerError)
    expect(requests).toHaveLength(2)
  })

  it('rejects embeddings with the wrong dimension count', async () => {
    replies.push(
      () =>
        new Response(JSON.stringify({ object: 'list', data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2] }], model: 'm' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    )
    await expect(embedTexts(['t1'])).rejects.toThrow('expected 1536')
  })

  it('throws not_configured without a key', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    await expect(embedTexts(['t1'])).rejects.toMatchObject({ status: 503, code: 'not_configured' })
  })
})

describe('safetyIdentifier', () => {
  it('is the first 32 hex chars of sha256(org id)', () => {
    const orgId = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'
    const expected = crypto.createHash('sha256').update(orgId).digest('hex').slice(0, 32)
    expect(safetyIdentifier(orgId)).toBe(expected)
    expect(safetyIdentifier(orgId)).toMatch(/^[0-9a-f]{32}$/)
    expect(safetyIdentifier(orgId)).not.toBe(safetyIdentifier('other-org'))
  })
})
