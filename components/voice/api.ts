// Browser helpers for the voice APIs: one error type carrying the API's
// { error: { code, message } } body, and JSON/Blob fetchers that use it.

export class VoiceApiError extends Error {
  readonly status: number
  readonly code: string
  /** Response headers when the error came from the API (quota headers on 429). */
  readonly headers: Headers | null

  constructor(status: number, code: string, message: string, headers: Headers | null = null) {
    super(message)
    this.name = 'VoiceApiError'
    this.status = status
    this.code = code
    this.headers = headers
  }
}

const NETWORK_MESSAGE = 'We couldn’t reach the server. Check your connection and try again.'

export async function toVoiceApiError(res: Response): Promise<VoiceApiError> {
  let code = 'http_error'
  let message = res.status >= 500 ? 'Something went wrong on our side. Please try again.' : 'That request didn’t work. Please try again.'
  try {
    const body = (await res.json()) as { error?: { code?: unknown; message?: unknown } }
    if (typeof body.error?.code === 'string') code = body.error.code
    if (typeof body.error?.message === 'string' && body.error.message) message = body.error.message
  } catch {
    // Not JSON (proxy error page, aborted body): keep the generic message.
  }
  return new VoiceApiError(res.status, code, message, res.headers)
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function send(input: string, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(input, init)
  } catch (error) {
    if (isAbort(error)) throw error
    throw new VoiceApiError(0, 'network_error', NETWORK_MESSAGE)
  }
  if (!res.ok) throw await toVoiceApiError(res)
  return res
}

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await send(input, init)
  return (await res.json()) as T
}

export async function postJson<T>(input: string, body: unknown, init?: RequestInit): Promise<T> {
  return fetchJson<T>(input, {
    ...init,
    method: init?.method ?? 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    body: JSON.stringify(body),
  })
}

/** Audio (or any binary) response, with the response headers for quota meters. */
export async function fetchBlob(input: string, init?: RequestInit): Promise<{ blob: Blob; headers: Headers }> {
  const res = await send(input, init)
  return { blob: await res.blob(), headers: res.headers }
}

/** The API's own message when there is one; never a raw exception text. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return error instanceof VoiceApiError ? error.message : fallback
}

export { isAbort }
