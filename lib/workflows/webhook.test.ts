import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UnsafeUrlError } from '@/lib/security/ssrf'
import { buildWebhookPayload, sampleCallData, WEBHOOK_EVENT } from './payload'
import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_DELAYS_MS,
  customerWebhookHeaders,
  deliverJson,
  describeDelivery,
  isRetryableOutcome,
  postJsonSafely,
  signWebhookPayload,
  unsafeUrlReason,
  type DeliveryOptions,
} from './webhook'
import type { WorkflowCallData } from './types'

function call(overrides: Partial<WorkflowCallData> = {}): WorkflowCallData {
  return { ...sampleCallData(new Date('2026-09-17T10:00:00Z')), call_id: '9f1c2e4a-1111-4222-8333-444455556666', ...overrides }
}

describe('buildWebhookPayload', () => {
  const payload = buildWebhookPayload({
    call: call({ conversation_id: 'ac_123', tags: ['vip'], extracted: { name: 'Ana' }, outcome: 'booked', intent: 'book_appointment' }),
    trigger: 'call_ended',
    workflow: { id: 'wf-1', name: 'CRM' },
    deliveryId: 'delivery-1',
    test: false,
    now: new Date('2026-09-17T10:05:00Z'),
  })

  it('keeps every key the unsigned payload had', () => {
    expect(payload.event).toBe('workflow_triggered')
    expect(payload.timestamp).toBe('2026-09-17T10:05:00.000Z')
    for (const key of ['id', 'conversation_id', 'caller_number', 'direction', 'duration_seconds', 'status', 'sentiment', 'summary', 'started_at']) {
      expect(payload.call).toHaveProperty(key)
    }
    expect(payload.call.id).toBe('9f1c2e4a-1111-4222-8333-444455556666')
    expect(payload.call.conversation_id).toBe('ac_123')
  })

  it('adds outcome, intent, tags, extracted and the agent name', () => {
    expect(payload.call.outcome).toBe('booked')
    expect(payload.call.intent).toBe('book_appointment')
    expect(payload.call.tags).toEqual(['vip'])
    expect(payload.call.extracted).toEqual({ name: 'Ana' })
    expect(payload.agent).toEqual({ name: 'Your AI agent' })
    expect(payload.trigger).toBe('call_ended')
    expect(payload.workflow).toEqual({ id: 'wf-1', name: 'CRM' })
    expect(payload.delivery_id).toBe('delivery-1')
    expect(payload.test).toBe(false)
  })

  it('falls back to the call id when there is no provider conversation id', () => {
    const p = buildWebhookPayload({ call: call({ conversation_id: null }), trigger: 'call_missed', workflow: { id: 'w', name: 'n' }, deliveryId: 'd', test: true })
    expect(p.call.conversation_id).toBe('9f1c2e4a-1111-4222-8333-444455556666')
    expect(p.test).toBe(true)
  })

  it('serialises unknown values as null rather than dropping keys', () => {
    const json = JSON.parse(JSON.stringify(buildWebhookPayload({ call: call({ call_id: null, conversation_id: null, sentiment: null }), trigger: 'call_ended', workflow: { id: 'w', name: 'n' }, deliveryId: 'd', test: false })))
    expect(json.call).toHaveProperty('id', null)
    expect(json.call).toHaveProperty('conversation_id', null)
    expect(json.call).toHaveProperty('sentiment', null)
  })
})

describe('signature', () => {
  it('is t=<unix>,v1=<hex hmac of "t.body">', () => {
    const body = '{"event":"workflow_triggered"}'
    const header = signWebhookPayload(body, 'secret-key', 1_758_000_000.9)
    const expected = createHmac('sha256', 'secret-key').update(`1758000000.${body}`).digest('hex')
    expect(header).toBe(`t=1758000000,v1=${expected}`)
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/)
  })

  it('sends the event, delivery id, attempt and signature headers', () => {
    const headers = customerWebhookHeaders({ body: '{}', secret: 's', deliveryId: 'abc', event: WEBHOOK_EVENT, attempt: 2, nowSeconds: 100 })
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['X-NTV-Event']).toBe('workflow_triggered')
    expect(headers['X-NTV-Delivery']).toBe('abc')
    expect(headers['X-NTV-Attempt']).toBe('2')
    expect(headers['X-NTV-Signature']).toBe(signWebhookPayload('{}', 's', 100))
  })
})

describe('retry policy', () => {
  it('retries network errors, 408, 429 and 5xx only', () => {
    expect(isRetryableOutcome({ kind: 'network_error', timeout: true })).toBe(true)
    expect(isRetryableOutcome({ kind: 'response', status: 408 })).toBe(true)
    expect(isRetryableOutcome({ kind: 'response', status: 429 })).toBe(true)
    expect(isRetryableOutcome({ kind: 'response', status: 500 })).toBe(true)
    expect(isRetryableOutcome({ kind: 'response', status: 503 })).toBe(true)
    expect(isRetryableOutcome({ kind: 'response', status: 400 })).toBe(false)
    expect(isRetryableOutcome({ kind: 'response', status: 404 })).toBe(false)
    expect(isRetryableOutcome({ kind: 'response', status: 302 })).toBe(false)
    expect(isRetryableOutcome({ kind: 'response', status: 301 })).toBe(false)
    expect(isRetryableOutcome({ kind: 'unsafe_url', message: 'x' })).toBe(false)
  })
})

describe('deliverJson', () => {
  function harness(responses: (number | Error)[], deadlineMs = 10 * 60_000) {
    const sleeps: number[] = []
    const attempts: Record<string, string>[] = []
    let clock = 0
    const fetcher: NonNullable<DeliveryOptions['fetcher']> = async (_url, init) => {
      attempts.push(init.headers)
      const next = responses.shift()
      if (next instanceof Error) throw next
      return { status: next ?? 200, finalUrl: 'https://example.com/hook' }
    }
    const options: DeliveryOptions = {
      url: 'https://example.com/hook?token=secret',
      body: '{}',
      deadline: deadlineMs,
      headers: (attempt) => ({ 'X-NTV-Attempt': String(attempt) }),
      fetcher,
      sleep: async (ms) => {
        sleeps.push(ms)
        clock += ms
      },
      now: () => clock,
    }
    return { options, sleeps, attempts }
  }

  it('succeeds on the first attempt without waiting', async () => {
    const h = harness([200])
    const result = await deliverJson(h.options)
    expect(result).toMatchObject({ ok: true, attempts: 1 })
    expect(h.sleeps).toEqual([])
  })

  it('retries a 500 after 1 s and stops when it succeeds', async () => {
    const h = harness([500, 204])
    const result = await deliverJson(h.options)
    expect(result).toMatchObject({ ok: true, attempts: 2, outcome: { kind: 'response', status: 204 } })
    expect(h.sleeps).toEqual([1000])
    expect(h.attempts.map((headers) => headers['X-NTV-Attempt'])).toEqual(['1', '2'])
  })

  it('gives up after three attempts with 1 s and 4 s pauses', async () => {
    const h = harness([new TypeError('fetch failed'), 503, 429])
    const result = await deliverJson(h.options)
    expect(result).toMatchObject({ ok: false, attempts: WEBHOOK_MAX_ATTEMPTS, outcome: { kind: 'response', status: 429 } })
    expect(h.sleeps).toEqual([...WEBHOOK_RETRY_DELAYS_MS])
  })

  it('never retries other 4xx answers', async () => {
    const h = harness([404, 200])
    const result = await deliverJson(h.options)
    expect(result).toMatchObject({ ok: false, attempts: 1, outcome: { kind: 'response', status: 404 } })
    expect(h.sleeps).toEqual([])
  })

  it('never retries an address the SSRF guard refuses', async () => {
    const h = harness([new UnsafeUrlError('URL points to a private or reserved address'), 200])
    const result = await deliverJson(h.options)
    expect(result).toMatchObject({ ok: false, attempts: 1, outcome: { kind: 'unsafe_url' } })
  })

  it('retries a failed DNS lookup like a network error', async () => {
    const h = harness([new UnsafeUrlError('URL host could not be resolved'), 200])
    const result = await deliverJson(h.options)
    expect(result).toMatchObject({ ok: true, attempts: 2 })
  })

  it('does not start a retry that would overrun the deadline', async () => {
    const h = harness([500, 200], 5_000)
    const result = await deliverJson(h.options)
    expect(result).toMatchObject({ ok: false, attempts: 1 })
    expect(h.sleeps).toEqual([])
  })

  it('treats timeouts as retryable network errors', async () => {
    const h = harness([new DOMException('Request timed out', 'TimeoutError'), 200])
    const result = await deliverJson(h.options)
    expect(result).toMatchObject({ ok: true, attempts: 2 })
  })
})

describe('describeDelivery', () => {
  it('names the host but never the path or query', () => {
    const message = describeDelivery(
      { ok: false, attempts: 3, outcome: { kind: 'response', status: 500 }, duration_ms: 5 },
      { label: 'Your endpoint', url: 'https://hooks.example.com/catch/123/secret-token?key=abc' }
    )
    expect(message).toContain('hooks.example.com')
    expect(message).toContain('after 3 attempts')
    expect(message).not.toContain('secret-token')
    expect(message).not.toContain('key=abc')
  })
})

describe('describeDelivery for redirects and refused addresses', () => {
  it('asks for the final address when a redirect would drop the body', () => {
    const message = describeDelivery(
      { ok: false, attempts: 1, outcome: { kind: 'response', status: 301 }, duration_ms: 5 },
      { label: 'Your endpoint', url: 'https://old.example.com/hook?key=abc' }
    )
    expect(message).toContain('old.example.com')
    expect(message).toContain('301')
    expect(message).toMatch(/address it redirects to/)
    expect(message).not.toContain('key=abc')
  })

  it('explains SSRF refusals in plain words, never as raw error text', () => {
    const message = describeDelivery(
      { ok: false, attempts: 1, outcome: { kind: 'unsafe_url', message: 'URL points to a private or reserved address' }, duration_ms: 1 },
      { label: 'Your endpoint', url: 'https://10.0.0.5/hook' }
    )
    expect(message).toBe('We can’t send to this address: it points to a private or internal network, which call data is never sent to.')
    expect(message).not.toMatch(/uRL|URL points/)
  })

  it('maps every ssrf.ts message to an owner-friendly reason', () => {
    const messages = [
      'URL is required', 'URL is too long', 'URL is not valid', 'URL must use https', 'URLs with credentials are not allowed',
      'Only ports 80 and 443 are allowed', 'URL has no host', 'URL points to a private or reserved address',
      'URL host could not be resolved', 'Too many redirects', 'Redirect location is not valid',
    ]
    for (const raw of messages) {
      const reason = unsafeUrlReason(raw)
      expect(reason).not.toMatch(/^URL|uRL/)
      expect(reason.length).toBeGreaterThan(10)
    }
    expect(unsafeUrlReason('URL must use https')).toBe('it has to start with https://')
    expect(unsafeUrlReason('URL host could not be resolved')).toMatch(/couldn’t find that web address/)
  })
})

describe('postJsonSafely', () => {
  // IP-literal public addresses: the SSRF guard accepts them without a DNS lookup.
  const START = 'https://93.184.215.14/hook'
  const OPTS = { timeoutMs: 1_000, maxRedirects: 3 }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(responses: { status: number; location?: string }[]) {
    const calls: { url: string; method: string; body: unknown; redirect: unknown; headers: unknown }[] = []
    const fetchMock = vi.fn(async (input: URL | string, init?: RequestInit) => {
      calls.push({ url: String(input), method: String(init?.method), body: init?.body, redirect: init?.redirect, headers: init?.headers })
      const next = responses.shift() ?? { status: 200 }
      return new Response(null, { status: next.status, headers: next.location ? { location: next.location } : {} })
    })
    vi.stubGlobal('fetch', fetchMock)
    return calls
  }

  it('posts once with manual redirects and returns the status', async () => {
    const calls = stubFetch([{ status: 204 }])
    const result = await postJsonSafely(START, { headers: { 'X-NTV-Event': 'workflow_triggered' }, body: '{"a":1}' }, OPTS)
    expect(result).toEqual({ status: 204, finalUrl: START })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ method: 'POST', body: '{"a":1}', redirect: 'manual' })
  })

  it('follows 307 and 308 with the same POST body and headers', async () => {
    const calls = stubFetch([
      { status: 308, location: 'https://93.184.215.15/hook' },
      { status: 307, location: '/final' },
      { status: 200 },
    ])
    const result = await postJsonSafely(START, { headers: { 'X-NTV-Signature': 't=1,v1=x' }, body: '{"a":1}' }, OPTS)
    expect(result).toEqual({ status: 200, finalUrl: 'https://93.184.215.15/final' })
    expect(calls.map((c) => c.method)).toEqual(['POST', 'POST', 'POST'])
    expect(calls.every((c) => c.body === '{"a":1}')).toBe(true)
    expect(calls[2].headers).toEqual({ 'X-NTV-Signature': 't=1,v1=x' })
  })

  it('does not turn the POST into a GET on 301, 302 or 303: the status comes back instead', async () => {
    for (const status of [301, 302, 303]) {
      const calls = stubFetch([{ status, location: 'https://93.184.215.15/hook' }, { status: 200 }])
      const result = await postJsonSafely(START, { headers: {}, body: '{}' }, OPTS)
      expect(result.status).toBe(status)
      expect(calls).toHaveLength(1)
    }
  })

  it('refuses a redirect to a private address without calling it', async () => {
    const calls = stubFetch([{ status: 307, location: 'https://169.254.169.254/latest/meta-data' }, { status: 200 }])
    await expect(postJsonSafely(START, { headers: {}, body: '{}' }, OPTS)).rejects.toBeInstanceOf(UnsafeUrlError)
    expect(calls).toHaveLength(1)
  })

  it('refuses private and non-https starting addresses before any request', async () => {
    const calls = stubFetch([{ status: 200 }])
    await expect(postJsonSafely('https://127.0.0.1/hook', { headers: {}, body: '{}' }, OPTS)).rejects.toBeInstanceOf(UnsafeUrlError)
    await expect(postJsonSafely('http://93.184.215.14/hook', { headers: {}, body: '{}' }, OPTS)).rejects.toBeInstanceOf(UnsafeUrlError)
    expect(calls).toHaveLength(0)
  })

  it('stops after too many redirects', async () => {
    stubFetch(Array.from({ length: 5 }, () => ({ status: 308, location: 'https://93.184.215.14/loop' })))
    await expect(postJsonSafely(START, { headers: {}, body: '{}' }, { timeoutMs: 1_000, maxRedirects: 3 })).rejects.toThrow('Too many redirects')
  })

  it('a 301 through deliverJson is final and not retried', async () => {
    stubFetch([{ status: 301, location: 'https://93.184.215.15/hook' }, { status: 200 }])
    const result = await deliverJson({ url: START, body: '{}', deadline: Date.now() + 60_000, headers: () => ({}), sleep: async () => undefined })
    expect(result).toMatchObject({ ok: false, attempts: 1, outcome: { kind: 'response', status: 301 } })
  })
})
