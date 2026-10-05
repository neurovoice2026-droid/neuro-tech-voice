import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backoffDelay, providerRequest } from './http'
import { setCircuitStore, peek } from './circuit-registry'
import { MemoryCircuitStore } from './circuit-breaker'
import { ProviderError } from './errors'
import { setProviderEventSink, type ProviderEvent } from '@/lib/observability/telemetry'

let events: ProviderEvent[] = []
let restoreSink: () => void

beforeEach(() => {
  events = []
  restoreSink = setProviderEventSink((e) => events.push(e))
  setCircuitStore(new MemoryCircuitStore())
})
afterEach(() => {
  restoreSink()
  setCircuitStore(null)
})

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

const FAST = { attempts: 3, baseDelayMs: 1, maxDelayMs: 2 }

describe('providerRequest', () => {
  it('returns parsed JSON and records a successful api_call', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await providerRequest<{ ok: number }>({ system: 'elevenlabs', operation: 'test.get', url: 'https://x.test/a', timeoutMs: 1000 })
    expect(res.data).toEqual({ ok: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    expect(events.at(-1)).toMatchObject({ kind: 'api_call', ok: true, operation: 'test.get' })
  })

  it('retries idempotent GETs on 5xx with backoff, then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('boom', { status: 503 }))
      .mockResolvedValueOnce(json({ fine: true }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await providerRequest({ system: 'cartesia', operation: 'voices.list', url: 'https://x.test', timeoutMs: 1000, retry: FAST })
    expect(res.data).toEqual({ fine: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('never retries validation errors and never leaks the upstream body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({ detail: { status: 'invalid_voice', message: 'voice +40712345678 secret sk_abcdefghijklmnop' } }, 422),
    )
    vi.stubGlobal('fetch', fetchMock)
    const err = await providerRequest({ system: 'elevenlabs', operation: 'agents.update', url: 'https://x.test', method: 'PATCH', idempotent: true, timeoutMs: 1000, retry: FAST })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderError)
    const pe = err as ProviderError
    expect(pe.code).toBe('validation')
    expect(pe.retryable).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(pe.safeMessage).toBe('The voice provider rejected this configuration.')
    expect(pe.message).not.toContain('+40712345678')
    expect(pe.message).not.toContain('sk_abcdefghijklmnop')
    expect(pe.detail).toContain('invalid_voice')
    // breaker untouched by our own validation error
    expect((await peek('elevenlabs')).raw.consecutiveFailures).toBe(0)
  })

  it('does not retry non-idempotent POSTs (no duplicate agent creation)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('down', { status: 502 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(providerRequest({ system: 'elevenlabs', operation: 'agents.create', url: 'https://x.test', method: 'POST', body: {}, timeoutMs: 1000, retry: FAST }))
      .rejects.toMatchObject({ code: 'upstream' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('maps a timeout to a retryable timeout error', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal?.addEventListener('abort', () => rej(init.signal?.reason))
    })))
    await expect(providerRequest({ system: 'cartesia', operation: 'slow', url: 'https://x.test', timeoutMs: 20, retry: { attempts: 1, baseDelayMs: 0, maxDelayMs: 0 } }))
      .rejects.toMatchObject({ code: 'timeout' })
  })

  it('opens the circuit after repeated failures and then fails fast without calling fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('x', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    for (let i = 0; i < 3; i++) {
      await providerRequest({ system: 'elevenlabs', operation: 'twilio.register_call', url: 'https://x.test', timeoutMs: 100, breaker: true, retry: { attempts: 1, baseDelayMs: 0, maxDelayMs: 0 } }).catch(() => undefined)
    }
    expect((await peek('elevenlabs')).state).toBe('open')
    fetchMock.mockClear()
    await expect(providerRequest({ system: 'elevenlabs', operation: 'twilio.register_call', url: 'https://x.test', timeoutMs: 100, breaker: true }))
      .rejects.toMatchObject({ code: 'circuit_open' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('leaves the routing circuit alone for requests that did not opt in (previews, uploads, syncs)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 429 })))
    for (let i = 0; i < 5; i++) {
      await providerRequest({ system: 'elevenlabs', operation: 'tts.convert', url: 'https://x.test', method: 'POST', timeoutMs: 100, retry: { attempts: 1, baseDelayMs: 0, maxDelayMs: 0 } }).catch(() => undefined)
    }
    expect((await peek('elevenlabs')).state).toBe('closed')
  })

  it('does not apply the voice-provider breaker to Twilio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 500 })))
    for (let i = 0; i < 4; i++) {
      await providerRequest({ system: 'twilio', operation: 'x', url: 'https://x.test', timeoutMs: 100, retry: { attempts: 1, baseDelayMs: 0, maxDelayMs: 0 } }).catch(() => undefined)
    }
    expect((await peek('elevenlabs')).state).toBe('closed')
  })
})

describe('backoffDelay', () => {
  it('uses full jitter bounded by the exponential ceiling and max', () => {
    const policy = { attempts: 5, baseDelayMs: 100, maxDelayMs: 1000 }
    expect(backoffDelay(0, policy, () => 0.999)).toBeLessThan(100)
    expect(backoffDelay(3, policy, () => 0.999)).toBeLessThan(800)
    expect(backoffDelay(10, policy, () => 0.999)).toBeLessThan(1000)
    expect(backoffDelay(2, policy, () => 0)).toBe(0)
  })
})
