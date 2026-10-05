// One HTTP policy for every provider call:
// - explicit timeout per request (AbortSignal.timeout), never an open-ended fetch;
// - retries only for retryable failures (timeout/network/429/5xx) and only for
//   idempotent requests unless the caller opts in; exponential backoff with full
//   jitter, honouring Retry-After within a cap;
// - per-provider circuit breaker (fail fast while open, one probe when half-open);
// - telemetry for latency/outcome; upstream bodies are never surfaced verbatim.

import {
  ProviderError,
  codeForStatus,
  summarizeErrorBody,
  toProviderError,
  type ExternalSystem,
  type VoiceProvider,
} from './errors'
import { acquire, reportOutcome } from './circuit-registry'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { createLogger } from '@/lib/observability/logger'

export interface RetryPolicy {
  /** Total attempts including the first (1 = no retry). */
  attempts: number
  baseDelayMs: number
  maxDelayMs: number
}

export const NO_RETRY: RetryPolicy = { attempts: 1, baseDelayMs: 0, maxDelayMs: 0 }
export const DEFAULT_RETRY: RetryPolicy = { attempts: 3, baseDelayMs: 250, maxDelayMs: 2_000 }

export type ResponseKind = 'json' | 'text' | 'arrayBuffer' | 'response' | 'none'

export interface ProviderRequest {
  system: ExternalSystem
  /** Stable operation name for logs/metrics, e.g. "agents.update". */
  operation: string
  url: string
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  /** JSON-serialisable body, FormData, or a raw string. */
  body?: unknown
  timeoutMs: number
  retry?: RetryPolicy
  /** POST/PATCH are retried only when the caller says the operation is idempotent. */
  idempotent?: boolean
  /**
   * Whether this call feeds/consults the routing circuit breaker. Off by
   * default: only live-call requests (register-call, outbound call) opt in,
   * so tenant-triggered work (previews, catalog, uploads, syncs) can never
   * open the circuit that routes every organization's calls.
   */
  breaker?: boolean
  responseKind?: ResponseKind
  signal?: AbortSignal
  context?: { orgId?: string | null; agentId?: string | null; callId?: string | null }
}

export interface ProviderResponse<T> {
  data: T
  status: number
  headers: Headers
  latencyMs: number
}

const IDEMPOTENT_METHODS = new Set(['GET', 'PUT', 'DELETE'])
const MAX_ERROR_BODY_BYTES = 8_192

function isVoiceProvider(system: ExternalSystem): system is VoiceProvider {
  return system === 'elevenlabs' || system === 'cartesia'
}

/** Full-jitter backoff: uniform in [0, min(max, base·2^attempt)]. */
export function backoffDelay(attempt: number, policy: RetryPolicy, random = Math.random): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt)
  return Math.floor(random() * ceiling)
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const secs = Number(value)
  if (Number.isFinite(secs) && secs >= 0) return secs
  const at = Date.parse(value)
  return Number.isFinite(at) ? Math.max(0, (at - Date.now()) / 1000) : null
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(signal.reason)
    }, { once: true })
  })
}

async function readBounded(res: Response): Promise<string> {
  try {
    const text = await res.text()
    return text.length > MAX_ERROR_BODY_BYTES ? text.slice(0, MAX_ERROR_BODY_BYTES) : text
  } catch (err) {
    return `[unreadable body: ${(err as Error)?.name ?? 'error'}]`
  }
}

function encodeBody(body: unknown, headers: Record<string, string>): BodyInit | undefined {
  if (body === undefined) return undefined
  if (typeof FormData !== 'undefined' && body instanceof FormData) return body
  if (typeof body === 'string') return body
  if (body instanceof URLSearchParams) return body
  if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/json'
  }
  return JSON.stringify(body)
}

async function attemptOnce<T>(req: ProviderRequest, method: string): Promise<ProviderResponse<T>> {
  const headers = { ...(req.headers ?? {}) }
  const body = encodeBody(req.body, headers)
  const timeout = AbortSignal.timeout(req.timeoutMs)
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout
  const started = Date.now()
  const res = await fetch(req.url, { method, headers, body, signal, cache: 'no-store' })
  const latencyMs = Date.now() - started

  if (!res.ok) {
    const text = await readBounded(res)
    throw new ProviderError({
      system: req.system,
      operation: req.operation,
      code: codeForStatus(res.status),
      status: res.status,
      detail: summarizeErrorBody(text),
      retryAfterSeconds: parseRetryAfter(res.headers.get('retry-after')),
    })
  }

  const kind = req.responseKind ?? 'json'
  let data: unknown
  if (kind === 'response') data = res
  else if (kind === 'none') {
    // Release the connection; the body (if any) is not needed. A failure to
    // drain does not change the outcome of a request that already succeeded.
    await res.arrayBuffer().catch((err: unknown) => {
      createLogger({ component: 'provider_http' }).debug('provider.drain_failed', { system: req.system, operation: req.operation, error: err instanceof Error ? err.message : 'drain failed' })
    })
    data = undefined
  } else if (kind === 'arrayBuffer') data = await res.arrayBuffer()
  else if (kind === 'text') data = await res.text()
  else {
    const text = await res.text()
    if (!text) data = null
    else {
      try {
        data = JSON.parse(text)
      } catch (err) {
        throw new ProviderError({
          system: req.system,
          operation: req.operation,
          code: 'bad_response',
          status: res.status,
          detail: 'response was not valid JSON',
          cause: err,
        })
      }
    }
  }
  return { data: data as T, status: res.status, headers: res.headers, latencyMs }
}

export async function providerRequest<T = unknown>(req: ProviderRequest): Promise<ProviderResponse<T>> {
  const method = req.method ?? 'GET'
  const policy = req.retry ?? (IDEMPOTENT_METHODS.has(method) || req.idempotent ? DEFAULT_RETRY : NO_RETRY)
  const mayRetry = IDEMPOTENT_METHODS.has(method) || req.idempotent === true
  const useBreaker = req.breaker === true && isVoiceProvider(req.system)
  const ctx = req.context ?? {}

  if (useBreaker) {
    const gate = await acquire(req.system as VoiceProvider)
    if (!gate.allowed) {
      const err = new ProviderError({ system: req.system, operation: req.operation, code: 'circuit_open', detail: `circuit ${gate.state}` })
      emitProviderEvent({ system: req.system, kind: 'api_call', operation: req.operation, ok: false, errorCode: err.code, ...ctx })
      throw err
    }
  }

  const started = Date.now()
  let lastError: ProviderError | null = null
  for (let attempt = 0; attempt < policy.attempts; attempt++) {
    try {
      const res = await attemptOnce<T>(req, method)
      emitProviderEvent({
        system: req.system,
        kind: 'api_call',
        operation: req.operation,
        ok: true,
        latencyMs: Date.now() - started,
        status: res.status,
        ...ctx,
        details: attempt > 0 ? { attempts: attempt + 1 } : null,
      })
      if (useBreaker) await reportOutcome(req.system as VoiceProvider, { ok: true })
      return res
    } catch (e) {
      lastError = toProviderError(e, req.system, req.operation)
      const last = attempt === policy.attempts - 1
      if (!lastError.retryable || !mayRetry || last || req.signal?.aborted) break
      const retryAfterMs = lastError.retryAfterSeconds !== null ? Math.min(lastError.retryAfterSeconds * 1000, policy.maxDelayMs) : null
      await sleep(retryAfterMs ?? backoffDelay(attempt, policy), req.signal)
    }
  }

  const err = lastError ?? new ProviderError({ system: req.system, operation: req.operation, code: 'unknown' })
  emitProviderEvent({
    system: req.system,
    kind: 'api_call',
    operation: req.operation,
    ok: false,
    latencyMs: Date.now() - started,
    status: err.status,
    errorCode: err.code,
    ...ctx,
  })
  if (useBreaker) await reportOutcome(req.system as VoiceProvider, { ok: false, code: err.code })
  throw err
}
