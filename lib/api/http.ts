// Small helpers shared by route handlers: consistent JSON errors with a request
// id, Zod body parsing with a size limit, and a same-origin check for browser
// requests that spend money or start calls (CSRF defence in depth on top of the
// SameSite=Lax Supabase auth cookies).

import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { isProviderError } from '@/lib/voice-providers/errors'
import type { Logger } from '@/lib/observability/logger'

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'rate_limited'
  | 'conflict'
  | 'precondition_failed'
  | 'provider_error'
  | 'not_configured'
  | 'voice_not_provisioned'
  | 'internal'

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  extra?: { requestId?: string; details?: unknown; headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      ...(extra?.requestId ? { request_id: extra.requestId } : {}),
      ...(extra?.details !== undefined ? { details: extra.details } : {}),
    },
    { status, headers: extra?.headers },
  )
}

/**
 * Converts any thrown error into a safe response. Provider errors keep their
 * product-level message; everything else becomes a generic 500. The full
 * error goes to the structured log only.
 */
export function errorResponse(err: unknown, log: Logger, event: string, requestId?: string): NextResponse {
  log.error(event, err)
  if (isProviderError(err)) {
    const status =
      err.code === 'not_configured' ? 503
      : err.code === 'circuit_open' ? 503
      : err.code === 'rate_limited' || err.code === 'tenant_limited' ? 429
      : err.code === 'validation' ? 422
      : err.code === 'not_found' ? 404
      : 502
    return apiError(err.code === 'not_configured' ? 'not_configured' : 'provider_error', err.safeMessage, status, {
      requestId,
      details: { provider: err.system, code: err.code },
    })
  }
  return apiError('internal', 'Something went wrong. Please try again.', 500, { requestId })
}

export class RequestError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown,
    readonly headers?: Record<string, string>,
  ) {
    super(message)
    this.name = 'RequestError'
  }
}

export function requestErrorResponse(err: RequestError, requestId?: string): NextResponse {
  return apiError(err.code, err.message, err.status, { requestId, details: err.details, headers: err.headers })
}

/** 429 with Retry-After for a denied rate-limit check. */
export function rateLimitedError(resetAt: number, message = 'Too many requests. Please try again later.'): RequestError {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return new RequestError('rate_limited', message, 429, { retry_after_seconds: retryAfter }, { 'Retry-After': String(retryAfter) })
}

const DEFAULT_MAX_JSON_BYTES = 64 * 1024

/** Reads and validates a JSON body. Throws RequestError (400/413/415). */
export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<z.infer<S>> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new RequestError('unsupported_media_type', 'Expected a JSON body.', 415)
  }
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > maxBytes) throw new RequestError('payload_too_large', 'Request body is too large.', 413)
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new RequestError('payload_too_large', 'Request body is too large.', 413)
  }
  let raw: unknown
  try {
    raw = text ? JSON.parse(text) : {}
  } catch (err) {
    throw new RequestError('invalid_request', 'Request body is not valid JSON.', 400, {
      parse_error: err instanceof Error ? err.message.slice(0, 120) : 'invalid JSON',
    })
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new RequestError(
      'invalid_request',
      'Some fields are invalid.',
      400,
      parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  return parsed.data
}

/** Allowed browser origins: the configured app URL plus the request's own host. */
function allowedOrigins(request: Request): Set<string> {
  const out = new Set<string>()
  for (const raw of [process.env.NEXT_PUBLIC_APP_URL, process.env.VOICE_PUBLIC_BASE_URL]) {
    if (!raw) continue
    if (URL.canParse(raw)) out.add(new URL(raw).origin)
    // A malformed env URL is reported by the config diagnostics (validateVoiceConfig).
  }
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '')
  if (host) out.add(`${proto}://${host}`)
  return out
}

/**
 * Rejects cross-site browser requests. Browsers always send Origin on POST /
 * PATCH / DELETE fetches; a missing Origin with Sec-Fetch-Site=cross-site is
 * also rejected. Server-to-server callers (no browser headers) pass.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin')
  const fetchSite = request.headers.get('sec-fetch-site')
  if (origin) {
    if (!allowedOrigins(request).has(origin)) {
      throw new RequestError('forbidden', 'Cross-site request rejected.', 403)
    }
    return
  }
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new RequestError('forbidden', 'Cross-site request rejected.', 403)
  }
}
