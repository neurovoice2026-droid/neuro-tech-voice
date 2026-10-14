'use client'

// The store onboarding's fetch helpers: one way to call our commerce routes,
// one error shape (message, code, reason) and English fallbacks. Talks only
// to our own API routes; secrets go straight from the form into the request
// body and are never kept anywhere else.

export class CommerceRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
    /** `details.reason` of a precondition_failed response (no_consent, unreachable…). */
    readonly reason: string | null = null,
  ) {
    super(message)
    this.name = 'CommerceRequestError'
  }
}

function fallbackFor(status: number, fallback: string): string {
  if (status === 401) return 'Your session has expired. Sign in again.'
  if (status === 403) return 'This action is not allowed for your account.'
  if (status === 404) return 'The resource was not found.'
  if (status === 413) return 'The submitted content is too large.'
  if (status === 429) return 'Too many requests. Wait a moment and try again.'
  if (status === 503) return 'The service is unavailable right now. Try again shortly.'
  return fallback
}

/** Reads `{ error, code, details }` from a failed response (never throws). */
export async function readCommerceError(res: Response, fallback: string): Promise<CommerceRequestError> {
  // A non-JSON body (proxy page, empty body) just means "no server message".
  const body: unknown = await res.json().catch(() => null)
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const message = typeof record?.error === 'string' && record.error.trim() ? record.error.trim() : null
  const code = typeof record?.code === 'string' ? record.code : null
  const details = record?.details && typeof record.details === 'object' ? (record.details as Record<string, unknown>) : null
  const reason = typeof details?.reason === 'string' ? details.reason : null
  return new CommerceRequestError(message ?? fallbackFor(res.status, fallback), res.status, code, reason)
}

/** A message the merchant can read for anything a fetch threw. */
export function commerceErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof CommerceRequestError) return err.message
  if (err instanceof TypeError) return 'Network error. Check your connection and try again.'
  return fallback
}

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** No answer within the request's time limit: every wait in this flow ends with a message, never a spinner. */
export const REQUEST_TIMEOUT_MS = 30_000
export const TIMEOUT_MESSAGE = 'The server did not respond in time. Please try again.'

interface JsonRequestInit {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Message used when the server gives none. */
  fallback: string
  /** Time limit of this request; the default suits our own routes, a connect test may need more. */
  timeoutMs?: number
}

/**
 * fetch + JSON + our error shape. Throws CommerceRequestError on a non-2xx response and
 * (code 'timeout', status 0) when nothing came back in time. The caller's own abort (unmount,
 * a newer request) still surfaces as an AbortError, so `isAbort` keeps telling the two apart.
 */
export async function requestJson<T>(url: string, init: JsonRequestInit): Promise<T> {
  const ctrl = new AbortController()
  const outer = init.signal
  const onOuterAbort = () => ctrl.abort(outer?.reason)
  if (outer?.aborted) onOuterAbort()
  else outer?.addEventListener('abort', onOuterAbort, { once: true })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort(new DOMException(TIMEOUT_MESSAGE, 'TimeoutError'))
  }, init.timeoutMs ?? REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: { Accept: 'application/json', ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: ctrl.signal,
    })
    if (!res.ok) throw await readCommerceError(res, init.fallback)
    return (await res.json()) as T
  } catch (err) {
    // Checked by our own flag, not the error's name: an old runtime rejects with a plain
    // AbortError whatever reason the abort carried.
    if (timedOut) throw new CommerceRequestError(TIMEOUT_MESSAGE, 0, 'timeout')
    throw err
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', onOuterAbort)
  }
}

export const PROGRESS_NOT_SAVED = 'Your progress could not be saved.'

/** Persists the resume position; a failure only affects where a reload lands, so the caller just reports it. */
export async function persistStep(step: number): Promise<void> {
  await requestJson<{ onboarding_step: number }>('/api/commerce/onboarding/step', {
    method: 'POST',
    body: { step },
    fallback: PROGRESS_NOT_SAVED,
  })
}
