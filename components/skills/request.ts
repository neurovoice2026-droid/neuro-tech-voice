// Small fetch wrapper for the dashboard: JSON in, JSON out, and the API's
// { error: { code, message } } body turned into a RequestError whose message
// is safe to show in a toast.

export class RequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'RequestError'
    this.status = status
    this.code = code
  }
}

const NETWORK_MESSAGE = 'We couldn’t reach the server. Check your connection and try again.'

export async function requestJson<T>(
  url: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
      cache: 'no-store',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new RequestError(0, 'network_error', NETWORK_MESSAGE)
  }

  const text = await res.text().catch(() => '')
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    const err = (data as { error?: unknown } | null)?.error
    if (err && typeof err === 'object') {
      const { code, message } = err as { code?: unknown; message?: unknown }
      throw new RequestError(
        res.status,
        typeof code === 'string' ? code : 'request_failed',
        typeof message === 'string' && message ? message : 'Something went wrong. Please try again.'
      )
    }
    // Legacy routes answer { error: 'text' }.
    if (typeof err === 'string' && err) throw new RequestError(res.status, 'request_failed', err)
    throw new RequestError(res.status, 'request_failed', 'Something went wrong. Please try again.')
  }
  return data as T
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof RequestError) return error.message
  return fallback
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
