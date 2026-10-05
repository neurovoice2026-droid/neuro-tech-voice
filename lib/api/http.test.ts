import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { RequestError, apiError, assertSameOrigin, errorResponse, parseJsonBody, rateLimitedError, requestErrorResponse } from './http'
import { ProviderError, type ProviderErrorCode } from '@/lib/voice-providers/errors'
import type { Logger } from '@/lib/observability/logger'
import { FAKE_STRIPE_LIVE_KEY } from '@/tests/helpers/fixtures'

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0)

function fakeLogger() {
  const error = vi.fn<Logger['error']>()
  const log: Logger = {
    context: {},
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error,
    child: () => log,
  }
  return { log, error }
}

function jsonRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request('https://app.example.com/api/thing', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
}

async function thrown(p: Promise<unknown>): Promise<RequestError> {
  const err = await p.then(() => null, (e: unknown) => e)
  expect(err).toBeInstanceOf(RequestError)
  return err as RequestError
}

function thrownSync(fn: () => void): RequestError | null {
  try {
    fn()
    return null
  } catch (e) {
    expect(e).toBeInstanceOf(RequestError)
    return e as RequestError
  }
}

const Schema = z.object({
  name: z.string().min(1),
  settings: z.object({ count: z.number().int().max(10) }),
  tag: z.string().default('none'),
})

describe('parseJsonBody', () => {
  it('returns the parsed, schema-validated value (defaults applied)', async () => {
    const data = await parseJsonBody(jsonRequest(JSON.stringify({ name: 'Ana', settings: { count: 3 } })), Schema)
    expect(data).toEqual({ name: 'Ana', settings: { count: 3 }, tag: 'none' })
  })

  it('accepts application/json with a charset parameter', async () => {
    const data = await parseJsonBody(jsonRequest('{"name":"a","settings":{"count":1}}', { 'content-type': 'Application/JSON; charset=utf-8' }), Schema)
    expect(data.name).toBe('a')
  })

  it('treats an empty body as {} (so the schema decides)', async () => {
    await expect(parseJsonBody(jsonRequest(''), z.object({ a: z.string().optional() }))).resolves.toEqual({})
  })

  it('415 for a non-JSON content type', async () => {
    const err = await thrown(parseJsonBody(jsonRequest('{}', { 'content-type': 'text/plain' }), Schema))
    expect(err).toMatchObject({ status: 415, code: 'unsupported_media_type' })
    const form = new Request('https://app.example.com/x', { method: 'POST', body: new URLSearchParams({ a: '1' }) })
    expect(await thrown(parseJsonBody(form, Schema))).toMatchObject({ status: 415 })
  })

  it('413 when the declared Content-Length exceeds the limit (body not read)', async () => {
    const req = jsonRequest('{}', { 'content-length': '70000' })
    const textSpy = vi.spyOn(req, 'text')
    const err = await thrown(parseJsonBody(req, Schema))
    expect(err).toMatchObject({ status: 413, code: 'payload_too_large' })
    expect(textSpy).not.toHaveBeenCalled()
  })

  it('413 when the actual body exceeds the limit even without/with a lying Content-Length', async () => {
    const big = JSON.stringify({ name: 'x'.repeat(200), settings: { count: 1 } })
    expect(await thrown(parseJsonBody(jsonRequest(big), Schema, 100))).toMatchObject({ status: 413 })
    expect(await thrown(parseJsonBody(jsonRequest(big, { 'content-length': '10' }), Schema, 100))).toMatchObject({ status: 413 })
  })

  it('measures the limit in bytes, not characters', async () => {
    // 40 characters but 80 UTF-8 bytes ("ă" is 2 bytes).
    const body = JSON.stringify({ name: 'ă'.repeat(36) })
    expect(body.length).toBeLessThanOrEqual(50)
    expect(await thrown(parseJsonBody(jsonRequest(body), z.object({ name: z.string() }), 50))).toMatchObject({ status: 413 })
  })

  it('400 for invalid JSON', async () => {
    const err = await thrown(parseJsonBody(jsonRequest('{"name": '), Schema))
    expect(err).toMatchObject({ status: 400, code: 'invalid_request', message: 'Request body is not valid JSON.' })
    expect(err.details).toEqual({ parse_error: expect.any(String) })
  })

  it('400 with zod issue paths for schema violations', async () => {
    const err = await thrown(parseJsonBody(jsonRequest(JSON.stringify({ name: '', settings: { count: 99 } })), Schema))
    expect(err).toMatchObject({ status: 400, code: 'invalid_request', message: 'Some fields are invalid.' })
    const details = err.details as Array<{ path: string; message: string }>
    expect(details.map((d) => d.path).sort()).toEqual(['name', 'settings.count'])
    for (const d of details) expect(typeof d.message).toBe('string')
  })

  it('caps the reported issues at 10', async () => {
    const Many = z.object(Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`f${i}`, z.string()])))
    const err = await thrown(parseJsonBody(jsonRequest('{}'), Many))
    expect(err.details).toHaveLength(10)
  })
})

describe('assertSameOrigin', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com')
    vi.stubEnv('VOICE_PUBLIC_BASE_URL', '')
  })

  function req(headers: Record<string, string>, url = 'https://internal.vercel.test/api/calls/outbound'): Request {
    return new Request(url, { method: 'POST', headers })
  }

  it('allows the configured app origin', () => {
    expect(thrownSync(() => assertSameOrigin(req({ origin: 'https://app.example.com' })))).toBeNull()
  })

  it('allows the VOICE_PUBLIC_BASE_URL origin', () => {
    vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://voice.example.com/some/path')
    expect(thrownSync(() => assertSameOrigin(req({ origin: 'https://voice.example.com' })))).toBeNull()
  })

  it('allows the request’s own host (preview deployments)', () => {
    expect(thrownSync(() => assertSameOrigin(req({ origin: 'https://preview-123.vercel.app', host: 'preview-123.vercel.app' })))).toBeNull()
    expect(thrownSync(() => assertSameOrigin(req({
      origin: 'https://branch.example.dev',
      'x-forwarded-host': 'branch.example.dev',
      'x-forwarded-proto': 'https',
      host: 'internal:3000',
    })))).toBeNull()
  })

  it('derives the protocol from the request URL when no forwarded proto is present', () => {
    expect(thrownSync(() => assertSameOrigin(req({ origin: 'http://localhost:3000', host: 'localhost:3000' }, 'http://localhost:3000/api/x')))).toBeNull()
    expect(thrownSync(() => assertSameOrigin(req({ origin: 'http://preview.example.dev', host: 'preview.example.dev' }, 'https://preview.example.dev/api/x'))))
      .toMatchObject({ status: 403 })
  })

  it.each([
    'https://evil.example',
    'https://app.example.com.evil.example',
    'http://app.example.com',
    'https://app.example.com:8443',
    'null',
  ])('rejects foreign Origin %s with 403', (origin) => {
    const err = thrownSync(() => assertSameOrigin(req({ origin, host: 'app.example.com' })))
    expect(err).toMatchObject({ status: 403, code: 'forbidden' })
  })

  it('rejects Sec-Fetch-Site cross-site / same-site without an Origin header', () => {
    expect(thrownSync(() => assertSameOrigin(req({ 'sec-fetch-site': 'cross-site' })))).toMatchObject({ status: 403 })
    expect(thrownSync(() => assertSameOrigin(req({ 'sec-fetch-site': 'same-site' })))).toMatchObject({ status: 403 })
  })

  it('allows same-origin / user-initiated navigations without Origin', () => {
    expect(thrownSync(() => assertSameOrigin(req({ 'sec-fetch-site': 'same-origin' })))).toBeNull()
    expect(thrownSync(() => assertSameOrigin(req({ 'sec-fetch-site': 'none' })))).toBeNull()
  })

  it('allows server-to-server callers that send no browser headers', () => {
    expect(thrownSync(() => assertSameOrigin(req({})))).toBeNull()
  })

  it('ignores a malformed env URL instead of throwing', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'not a url')
    expect(thrownSync(() => assertSameOrigin(req({ origin: 'https://evil.example' })))).toMatchObject({ status: 403 })
  })
})

describe('errorResponse', () => {
  const cases: Array<[ProviderErrorCode, number, 'not_configured' | 'provider_error']> = [
    ['not_configured', 503, 'not_configured'],
    ['circuit_open', 503, 'provider_error'],
    ['rate_limited', 429, 'provider_error'],
    ['validation', 422, 'provider_error'],
    ['not_found', 404, 'provider_error'],
    ['upstream', 502, 'provider_error'],
    ['auth', 502, 'provider_error'],
    ['timeout', 502, 'provider_error'],
    ['quota', 502, 'provider_error'],
  ]

  it.each(cases)('maps ProviderError %s → HTTP %i with the safe message only', async (code, status, apiCode) => {
    const { log, error } = fakeLogger()
    const err = new ProviderError({ system: 'elevenlabs', operation: 'agents.update', code, status: 500, detail: `internal detail ${FAKE_STRIPE_LIVE_KEY}` })
    const res = errorResponse(err, log, 'agent.patch.failed', 'req_123456')
    expect(res.status).toBe(status)
    const body = await res.json()
    expect(body).toEqual({
      error: err.safeMessage,
      code: apiCode,
      request_id: 'req_123456',
      details: { provider: 'elevenlabs', code },
    })
    expect(JSON.stringify(body)).not.toContain('internal detail')
    expect(JSON.stringify(body)).not.toContain('agents.update')
    expect(error).toHaveBeenCalledWith('agent.patch.failed', err)
  })

  it('never leaks the message of a generic error', async () => {
    const { log, error } = fakeLogger()
    const err = new Error('duplicate key value violates unique constraint "orgs_pkey" password=hunter2')
    const res = errorResponse(err, log, 'x.failed')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: 'Something went wrong. Please try again.', code: 'internal' })
    expect(JSON.stringify(body)).not.toContain('hunter2')
    expect(JSON.stringify(body)).not.toContain('orgs_pkey')
    expect(error).toHaveBeenCalledWith('x.failed', err)
  })

  it('treats non-Error throwables as internal errors', async () => {
    const { log } = fakeLogger()
    const res = errorResponse({ message: 'PostgREST secret detail', code: '42501' }, log, 'x.failed', 'req_abcdef')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Something went wrong. Please try again.', code: 'internal', request_id: 'req_abcdef' })
  })
})

describe('apiError / requestErrorResponse', () => {
  it('omits request_id and details when absent', async () => {
    const res = apiError('not_found', 'Nope', 404)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Nope', code: 'not_found' })
  })

  it('carries status, details and headers of a RequestError', async () => {
    const res = requestErrorResponse(new RequestError('conflict', 'Busy', 409, { field: 'x' }, { 'X-Test': '1' }), 'req_999999')
    expect(res.status).toBe(409)
    expect(res.headers.get('x-test')).toBe('1')
    expect(await res.json()).toEqual({ error: 'Busy', code: 'conflict', request_id: 'req_999999', details: { field: 'x' } })
  })
})

describe('rateLimitedError', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sets Retry-After to the whole seconds until reset (rounded up)', async () => {
    const err = rateLimitedError(NOW + 30_500)
    expect(err).toBeInstanceOf(RequestError)
    expect(err).toMatchObject({ status: 429, code: 'rate_limited', headers: { 'Retry-After': '31' }, details: { retry_after_seconds: 31 } })
    const res = requestErrorResponse(err, 'req_123456')
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('31')
    expect(await res.json()).toMatchObject({ code: 'rate_limited', details: { retry_after_seconds: 31 } })
  })

  it('never advertises less than one second, and accepts a custom message', () => {
    const err = rateLimitedError(NOW - 5_000, 'Slow down.')
    expect(err.message).toBe('Slow down.')
    expect(err.headers).toEqual({ 'Retry-After': '1' })
  })
})
