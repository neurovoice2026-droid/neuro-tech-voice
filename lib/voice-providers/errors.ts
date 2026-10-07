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
  /**
   * 429 caused by ONE tenant's own limits (per-agent concurrency or daily
   * call limit, platform_settings.call_limits): says nothing about the
   * provider's health, so it never feeds the shared routing circuit. The
   * call that hit it goes to the fallback/apology path. Not retryable.
   */
  | 'tenant_limited'
  /** 401/403: bad or revoked platform credentials. Not retryable. */
  | 'auth'
  /**
   * 403 with a documented permission code (insufficient_permissions,
   * workspace_access_denied, feature_not_available, subscription_required):
   * the platform key or plan lacks something. An operations problem, not
   * provider health and not the tenant's fault. Not retryable.
   */
  | 'permission'
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
  tenant_limited: 'Your agent reached its call limit for now. Please try again later.',
  auth: 'The platform could not authenticate with the voice provider. Please contact support if this persists.',
  permission: 'The platform is not allowed to do this at the voice provider. Please contact support if this persists.',
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
  /** The provider's machine-readable error code (ElevenLabs `detail.code`), when it sent one. */
  providerCode?: string | null
}

export class ProviderError extends Error {
  readonly system: ExternalSystem
  readonly code: ProviderErrorCode
  readonly operation: string
  readonly status: number | null
  readonly detail: string | null
  readonly safeMessage: string
  readonly retryAfterSeconds: number | null
  readonly providerCode: string | null

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
    this.providerCode = init.providerCode ?? null
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
 * The documented ElevenLabs error body (developers/resources/errors):
 * `{ detail: { type, code, message, status, request_id, param } }`, where
 * `status` is a legacy copy of `code`. Only short, machine-readable fields are
 * kept; `message` is redacted and clipped by the callers.
 */
export interface ProviderErrorBody {
  code: string | null
  type: string | null
  message: string | null
  param: string | null
  requestId: string | null
}

const MACHINE_TOKEN = /^[A-Za-z0-9_.:\-[\]]{1,120}$/

function machineToken(v: unknown): string | null {
  return typeof v === 'string' && MACHINE_TOKEN.test(v) ? v : null
}

/** Parses the structured `detail` object of an error body (null when absent or not JSON). */
export function parseProviderErrorBody(body: string): ProviderErrorBody | null {
  if (!body) return null
  const result = parseJson(body)
  if (!result.ok || !result.value || typeof result.value !== 'object' || Array.isArray(result.value)) return null
  const detail = (result.value as Record<string, unknown>).detail
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  const d = detail as Record<string, unknown>
  const out: ProviderErrorBody = {
    // `status` is the legacy field carrying the same value as `code`.
    code: machineToken(d.code) ?? machineToken(d.status),
    type: machineToken(d.type),
    message: typeof d.message === 'string' ? d.message : null,
    param: machineToken(d.param),
    requestId: machineToken(d.request_id),
  }
  return out.code || out.message || out.param || out.requestId ? out : null
}

/** Documented 429 codes that describe the shared workspace (every tenant), not one agent. */
const WORKSPACE_429_CODES = new Set(['rate_limit_exceeded', 'concurrent_limit_exceeded', 'system_busy'])
/** Words that tie a 429 to one agent's own call_limits (agent_concurrency_limit / daily_limit). */
const AGENT_LIMIT_HINT = /\bagent\b|\bdaily\b|\bper[ _-]?day\b|agent_|daily_/i
/** Words that tie a 429 to the whole workspace (its subscription concurrency, burst capacity). */
const WORKSPACE_LIMIT_HINT = /\b(workspace|subscription|plan|account|organi[sz]ation|burst)\b/i

/**
 * Whether a 429 is scoped to one tenant's agent. The per-agent limits have no
 * documented code, so: a workspace code counts as tenant-scoped only when its
 * message names the agent; an unknown code counts as tenant-scoped unless the
 * message names the workspace (failing every organization over because one
 * agent hit its own cap is worse than one call taking the fallback path).
 */
function isTenantScoped429(code: string | null, message: string): boolean {
  if (WORKSPACE_LIMIT_HINT.test(message)) return false
  if (code && WORKSPACE_429_CODES.has(code)) return AGENT_LIMIT_HINT.test(message)
  return !!code || AGENT_LIMIT_HINT.test(message)
}

const PERMISSION_403_CODES = new Set(['insufficient_permissions', 'workspace_access_denied', 'forbidden'])
const PLAN_403_CODES = new Set(['feature_not_available', 'subscription_required'])

export interface HttpErrorClassification {
  code: ProviderErrorCode
  providerCode: string | null
  /** Log-only detail (redacted, bounded); may carry request_id and param. */
  detail: string | null
  /** Browser-safe message when the default for `code` is not precise enough. */
  safeMessage?: string
}

/**
 * Classifies a failed HTTP response from its status AND its documented error
 * code. The distinction that matters most: a 429 caused by one tenant's own
 * call limits must never count against the shared circuit breaker, while a
 * workspace-wide 429 (concurrency of the whole workspace, system busy, API
 * rate limit) still does.
 */
export function classifyHttpError(status: number, bodyText: string): HttpErrorClassification {
  const body = parseProviderErrorBody(bodyText)
  const providerCode = body?.code ?? null
  const detail = summarizeErrorBody(bodyText)
  const base = codeForStatus(status)

  if (status === 429 && body) {
    const scoped = isTenantScoped429(providerCode, `${providerCode && !WORKSPACE_429_CODES.has(providerCode) ? providerCode : ''} ${body.message ?? ''}`)
    return { code: scoped ? 'tenant_limited' : 'rate_limited', providerCode, detail }
  }

  if (status === 403 && providerCode) {
    if (PERMISSION_403_CODES.has(providerCode)) return { code: 'permission', providerCode, detail }
    if (PLAN_403_CODES.has(providerCode)) {
      return { code: 'permission', providerCode, detail, safeMessage: 'This feature is not available on the platform\'s voice provider plan. Please contact support.' }
    }
    if (providerCode === 'voice_access_denied') {
      return { code: 'validation', providerCode, detail, safeMessage: 'This voice is not available to the platform. Choose another voice.' }
    }
    if (providerCode === 'model_access_denied') {
      return { code: 'validation', providerCode, detail, safeMessage: 'The selected voice model is not available to the platform.' }
    }
  }
  return { code: base, providerCode, detail }
}

/**
 * Pulls a short, non-sensitive detail out of a provider error body. ElevenLabs
 * returns `{ detail: { type, code, message, status (legacy), request_id,
 * param } }` or `{ detail: [ { msg, loc } ] }` (validation), Cartesia
 * `{ error, message }`. We keep the machine-readable code/param/loc, the
 * request id (for support tickets; logs only) and a bounded message, never
 * the whole body.
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
    const d = parseProviderErrorBody(body)
    if (d) {
      const parts = [d.code, d.param ? `param ${d.param}` : null, d.message].filter((v): v is string => !!v)
      const text = parts.length ? clip(parts.join(' - '), max) : ''
      const rid = d.requestId ? `request_id ${d.requestId}` : ''
      const out = [text, rid].filter(Boolean).join(' ')
      if (out) return out
    }
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
