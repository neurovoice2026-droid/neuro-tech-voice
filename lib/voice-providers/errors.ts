// Provider-independent error taxonomy for every external voice/telephony call.
//
// Two audiences, two messages:
// - `message` is for server logs. It may name the provider, the operation and
//   the HTTP status, but never a secret or a raw upstream body (upstream bodies
//   can echo request data: phone numbers, prompts, transcripts).
// - `safeMessage` is what an API route may return to the browser. It says what
//   went wrong in product terms and nothing about the platform's internals.
//
// Pure module: no imports from Next.js or Node-only APIs, so it is unit-testable
// and can be shared by the client for type-only imports.

import { redactText } from '@/lib/security/redact'
import { parseJson } from '@/lib/util/json'

export type VoiceProvider = 'elevenlabs' | 'cartesia'

export const VOICE_PROVIDERS: readonly VoiceProvider[] = ['elevenlabs', 'cartesia'] as const

/** External systems the app calls. Providers plus the telephony carrier. */
export type ExternalSystem = VoiceProvider | 'twilio'

export type ProviderErrorCode =
  /** The provider is not configured in this deployment (missing key/URL). */
  | 'not_configured'
  /** We gave up waiting (AbortSignal.timeout fired). Retryable. */
  | 'timeout'
  /** DNS/TCP/TLS failure before a response. Retryable. */
  | 'network'
  /** 429. Retryable after backoff. */
  | 'rate_limited'
  /** 401/403: bad or revoked platform credentials. Not retryable. */
  | 'auth'
  /** 404 on a resource we expected to exist. Not retryable. */
  | 'not_found'
  /** 400/422: our request was rejected (bad voice id, invalid model...). Not retryable. */
  | 'validation'
  /** 409. Not retryable without changing the request. */
  | 'conflict'
  /** 402 / quota / credits exhausted. Not retryable. */
  | 'quota'
  /** 5xx. Retryable. */
  | 'upstream'
  /** The circuit breaker is open for this provider: the call was not attempted. */
  | 'circuit_open'
  /** The response did not have the shape we rely on. Not retryable. */
  | 'bad_response'
  | 'unknown'

const RETRYABLE: ReadonlySet<ProviderErrorCode> = new Set([
  'timeout',
  'network',
  'rate_limited',
  'upstream',
])

/**
 * Codes that say something about the provider's health (and therefore count
 * towards opening its circuit). A validation error is our fault and must never
 * trip the breaker, otherwise one bad voice id could fail every org over.
 */
const HEALTH_SIGNAL: ReadonlySet<ProviderErrorCode> = new Set([
  'timeout',
  'network',
  'upstream',
  'rate_limited',
  'bad_response',
])

const SAFE_MESSAGES: Record<ProviderErrorCode, string> = {
  not_configured: 'This voice provider is not configured on the platform.',
  timeout: 'The voice provider took too long to respond. Please try again.',
  network: 'Could not reach the voice provider. Please try again.',
  rate_limited: 'The voice provider is busy right now. Please try again in a moment.',
  auth: 'The platform could not authenticate with the voice provider. Please contact support if this persists.',
  not_found: 'The requested voice resource no longer exists at the provider.',
  validation: 'The voice provider rejected this configuration.',
  conflict: 'The voice provider reported a conflicting change. Please retry.',
  quota: 'The voice provider quota is exhausted for now.',
  upstream: 'The voice provider is having trouble right now. Please try again.',
  circuit_open: 'The voice provider is temporarily unavailable.',
  bad_response: 'The voice provider returned an unexpected response.',
  unknown: 'Something went wrong while talking to the voice provider.',
}

export interface ProviderErrorInit {
  system: ExternalSystem
  code: ProviderErrorCode
  operation: string
  status?: number | null
  /** Short, already-sanitized detail for logs (e.g. the upstream error `detail.status`). */
  detail?: string | null
  /** Override for the browser-facing message (must not contain internals). */
  safeMessage?: string
  cause?: unknown
  /** Seconds the provider asked us to wait (Retry-After). */
  retryAfterSeconds?: number | null
}

export class ProviderError extends Error {
  readonly system: ExternalSystem
  readonly code: ProviderErrorCode
  readonly operation: string
  readonly status: number | null
  readonly detail: string | null
  readonly safeMessage: string
  readonly retryAfterSeconds: number | null

  constructor(init: ProviderErrorInit) {
    const statusPart = init.status ? ` ${init.status}` : ''
    const detailPart = init.detail ? `: ${init.detail}` : ''
    super(`${init.system} ${init.operation} failed (${init.code}${statusPart})${detailPart}`)
    this.name = 'ProviderError'
    this.system = init.system
    this.code = init.code
    this.operation = init.operation
    this.status = init.status ?? null
    this.detail = init.detail ?? null
    this.safeMessage = init.safeMessage ?? SAFE_MESSAGES[init.code]
    this.retryAfterSeconds = init.retryAfterSeconds ?? null
    if (init.cause !== undefined) (this as { cause?: unknown }).cause = init.cause
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code)
  }

  /** Whether this failure says the provider (not our request) is unhealthy. */
  get healthSignal(): boolean {
    return HEALTH_SIGNAL.has(this.code)
  }

  /** A JSON-safe summary for structured logs and DB "last error" columns. */
  toSafeJSON(): { system: ExternalSystem; code: ProviderErrorCode; operation: string; status: number | null; message: string } {
    return {
      system: this.system,
      code: this.code,
      operation: this.operation,
      status: this.status,
      message: this.safeMessage,
    }
  }
}

export function isProviderError(e: unknown): e is ProviderError {
  return e instanceof ProviderError
}

export function isRetryableCode(code: ProviderErrorCode): boolean {
  return RETRYABLE.has(code)
}

export function isHealthSignalCode(code: ProviderErrorCode): boolean {
  return HEALTH_SIGNAL.has(code)
}

export function safeMessageFor(code: ProviderErrorCode): string {
  return SAFE_MESSAGES[code]
}

/** Maps an HTTP status from a provider to our taxonomy. */
export function codeForStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return 'auth'
  if (status === 402) return 'quota'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 408) return 'timeout'
  if (status === 429) return 'rate_limited'
  if (status === 400 || status === 422 || status === 413 || status === 415) return 'validation'
  if (status >= 500) return 'upstream'
  return 'unknown'
}

/**
 * Normalizes anything thrown during an external call. AbortSignal.timeout
 * rejects with a DOMException named "TimeoutError"; fetch network failures are
 * TypeErrors ("fetch failed") whose `cause` carries the socket error code.
 */
export function toProviderError(e: unknown, system: ExternalSystem, operation: string): ProviderError {
  if (e instanceof ProviderError) return e
  const name = (e as { name?: string } | null)?.name
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new ProviderError({ system, operation, code: 'timeout', cause: e })
  }
  if (e instanceof TypeError) {
    const causeCode = (e as { cause?: { code?: string } }).cause?.code
    return new ProviderError({ system, operation, code: 'network', detail: causeCode ?? 'fetch failed', cause: e })
  }
  return new ProviderError({
    system,
    operation,
    code: 'unknown',
    detail: e instanceof Error ? e.name : typeof e,
    cause: e,
  })
}

/**
 * Pulls a short, non-sensitive detail out of a provider error body. ElevenLabs
 * returns `{ detail: { status, message } }` or `{ detail: [ { msg, loc } ] }`
 * (validation), Cartesia `{ error, message }`. We keep the machine-readable
 * status/loc and a bounded message, never the whole body.
 */
export function summarizeErrorBody(body: string, max = 160): string | null {
  if (!body) return null
  // Not JSON (HTML error page, plain text): never echo it, it is unbounded and
  // may contain anything. The status code is enough to classify the failure.
  const result = parseJson(body)
  if (!result.ok || !result.value || typeof result.value !== 'object') return null
  const parsed = result.value as Record<string, unknown>
  const detail = parsed.detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const d = detail as Record<string, unknown>
    const parts = [d.status, d.code, d.message].filter((v) => typeof v === 'string') as string[]
    if (parts.length) return clip(parts.join(' - '), max)
  }
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as Record<string, unknown>
    const loc = Array.isArray(first.loc) ? first.loc.join('.') : ''
    const msg = typeof first.msg === 'string' ? first.msg : ''
    return clip(`${loc}${loc && msg ? ': ' : ''}${msg}`, max)
  }
  for (const key of ['error', 'code', 'message', 'title']) {
    if (typeof parsed[key] === 'string') return clip(parsed[key] as string, max)
  }
  return null
}

function clip(s: string, max: number): string {
  // Upstream messages can echo request data (numbers, tokens): redact first.
  const oneLine = redactText(s).replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}
