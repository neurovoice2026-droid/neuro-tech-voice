// Fetch mocking helpers for provider client tests. Nothing here performs I/O:
// the mock is installed with vi.stubGlobal and every call is recorded so tests
// can assert on the exact URL, method, headers and body the client sent.

import { vi, type Mock } from 'vitest'

export type FetchMock = Mock<typeof fetch>

export interface RecordedCall {
  url: URL
  method: string
  headers: Headers
  /** Raw body as sent (string for JSON, FormData for multipart, undefined for GET). */
  rawBody: BodyInit | null | undefined
  /** JSON-decoded body when it was a JSON string, else undefined. */
  json: unknown
}

/** Installs a fetch mock and returns it. Configure responses with mockResolvedValue/Once. */
export function installFetch(): FetchMock {
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

/** The i-th recorded fetch call, decoded for assertions. */
export function callAt(fetchMock: FetchMock, i = 0): RecordedCall {
  const call = fetchMock.mock.calls[i]
  if (!call) throw new Error(`fetch was called ${fetchMock.mock.calls.length} time(s); no call #${i}`)
  const [input, init] = call
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const rawBody = init?.body
  let json: unknown
  if (typeof rawBody === 'string') {
    try {
      json = JSON.parse(rawBody)
    } catch {
      json = undefined
    }
  }
  return {
    url: new URL(href),
    method: (init?.method ?? 'GET').toUpperCase(),
    headers: new Headers(init?.headers),
    rawBody,
    json,
  }
}

/** A DOMException shaped exactly like the rejection AbortSignal.timeout() produces. */
export function timeoutError(): DOMException {
  return new DOMException('The operation was aborted due to timeout', 'TimeoutError')
}
