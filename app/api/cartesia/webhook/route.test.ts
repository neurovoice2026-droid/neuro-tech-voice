import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/voice-providers/webhook-ingest', () => ({
  ingestWebhookEvent: vi.fn(),
  processAfterResponse: vi.fn(),
}))

import { POST } from './route'
import { ingestWebhookEvent, processAfterResponse } from '@/lib/voice-providers/webhook-ingest'
import { setProviderEventSink, type ProviderEvent } from '@/lib/observability/telemetry'

const SECRET = 'cartesia_whsec_route_test'
const ENDPOINT = 'https://app.example.test/api/cartesia/webhook'

function post(rawBody: string, secretHeader: string | null, extraHeaders: Record<string, string> = {}): Request {
  const headers = new Headers({ 'content-type': 'application/json', ...extraHeaders })
  if (secretHeader !== null) headers.set('x-webhook-secret', secretHeader)
  return new Request(ENDPOINT, { method: 'POST', headers, body: rawBody })
}

function authed(payload: unknown): Request {
  return post(JSON.stringify(payload), SECRET)
}

const completedCall = {
  type: 'call_completed',
  webhook_request_id: 'wr_abc123',
  timestamp: '2026-10-05T10:02:06.000Z',
  call_id: 'call_c1',
  agent_id: 'agent_c1',
  call: {
    id: 'call_c1',
    agent_id: 'agent_c1',
    status: 'completed',
    start_time: '2026-10-05T10:00:00.000Z',
    end_time: '2026-10-05T10:02:05.000Z',
    transcript: [{ role: 'assistant', text: 'Hi' }],
    telephony_params: { direction: 'inbound', from: '+40712345123', to: '+40312345678' },
  },
}

let events: ProviderEvent[] = []
let restoreSink: () => void

beforeEach(() => {
  events = []
  restoreSink = setProviderEventSink((e) => events.push(e))
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('ALLOW_UNSIGNED_WEBHOOKS', '')
  vi.stubEnv('CARTESIA_WEBHOOK_SECRET', SECRET)
  vi.mocked(ingestWebhookEvent).mockReset()
  vi.mocked(processAfterResponse).mockReset()
  vi.mocked(ingestWebhookEvent).mockResolvedValue({ status: 'new', id: 'evt_c1' })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  restoreSink()
})

describe('POST /api/cartesia/webhook — configuration', () => {
  it('fails closed with 503 in production when no secret is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CARTESIA_WEBHOOK_SECRET', '')
    vi.stubEnv('ALLOW_UNSIGNED_WEBHOOKS', 'true') // ignored in production
    const res = await POST(post(JSON.stringify(completedCall), null))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not_configured' })
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
    expect(events).toContainEqual(expect.objectContaining({ system: 'cartesia', kind: 'webhook_verification_failed', ok: false, errorCode: 'not_configured' }))
  })

  it('treats a whitespace-only secret as missing (an empty header can never match)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CARTESIA_WEBHOOK_SECRET', '  ')
    const res = await POST(post(JSON.stringify(completedCall), ''))
    expect(res.status).toBe(503)
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
  })

  it('accepts unsigned deliveries only in development with ALLOW_UNSIGNED_WEBHOOKS=true', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CARTESIA_WEBHOOK_SECRET', '')
    vi.stubEnv('ALLOW_UNSIGNED_WEBHOOKS', 'true')
    const res = await POST(post(JSON.stringify(completedCall), null))
    expect(res.status).toBe(200)
    expect(ingestWebhookEvent).toHaveBeenCalledTimes(1)
  })

  it('rejects oversized bodies with 413', async () => {
    const res = await POST(post(JSON.stringify(completedCall), SECRET, { 'content-length': String(3 * 1024 * 1024) }))
    expect(res.status).toBe(413)
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
  })
})

describe('POST /api/cartesia/webhook — authentication', () => {
  it.each([
    ['a missing secret header', null],
    ['an empty secret header', ''],
    ['a wrong secret', 'cartesia_whsec_route_tesX'],
    ['a prefix of the secret', SECRET.slice(0, 8)],
  ])('answers 401 and stores nothing for %s', async (_label, header) => {
    const res = await POST(post(JSON.stringify(completedCall), header))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
    expect(processAfterResponse).not.toHaveBeenCalled()
    expect(events).toContainEqual(expect.objectContaining({ system: 'cartesia', kind: 'webhook_verification_failed', ok: false }))
  })

  it('does not read the body of an unauthenticated request', async () => {
    const req = post(JSON.stringify(completedCall), 'nope')
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(req.bodyUsed).toBe(false)
  })

  it('answers 400 for an authenticated body that is not JSON', async () => {
    const res = await POST(post('not json at all', SECRET))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_json' })
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
  })
})

describe('POST /api/cartesia/webhook — ingestion', () => {
  it.each([
    ['call_turn', { type: 'call_turn', call_id: 'call_c1', webhook_request_id: 'wr_t' }],
    ['an unknown type', { type: 'agent_updated', call_id: 'call_c1' }],
    ['a handled type without a call id', { type: 'call_completed', webhook_request_id: 'wr_x' }],
  ])('acknowledges but ignores %s', async (_label, payload) => {
    const res = await POST(authed(payload))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, ignored: true })
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
    expect(processAfterResponse).not.toHaveBeenCalled()
  })

  it('stores a valid event deduped on webhook_request_id and processes it after the response', async () => {
    const res = await POST(authed(completedCall))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, duplicate: false })
    expect(ingestWebhookEvent).toHaveBeenCalledTimes(1)
    expect(ingestWebhookEvent).toHaveBeenCalledWith({
      provider: 'cartesia',
      eventType: 'call_completed',
      dedupeKey: 'req:wr_abc123',
      externalId: 'call_c1',
      payload: completedCall,
    })
    expect(processAfterResponse).toHaveBeenCalledTimes(1)
    expect(processAfterResponse).toHaveBeenCalledWith('evt_c1', expect.objectContaining({ info: expect.any(Function), error: expect.any(Function) }))
    expect(events).toContainEqual(expect.objectContaining({ system: 'cartesia', kind: 'webhook_received', ok: true }))
  })

  it('falls back to type:call_id when there is no webhook_request_id', async () => {
    const payload = { type: 'post_call_analysis', call_id: 'call_c1', agent_id: 'agent_c1', analysis: { summary: 'S' } }
    const res = await POST(authed(payload))
    expect(res.status).toBe(200)
    expect(vi.mocked(ingestWebhookEvent).mock.calls[0][0]).toMatchObject({ eventType: 'post_call_analysis', dedupeKey: 'post_call_analysis:call_c1', externalId: 'call_c1' })
  })

  it('takes the call id from the call object when it is not at the top level', async () => {
    const payload = { type: 'call_started', webhook_request_id: 'wr_s', call: { id: 'call_c9', status: 'started' } }
    const res = await POST(authed(payload))
    expect(res.status).toBe(200)
    expect(vi.mocked(ingestWebhookEvent).mock.calls[0][0]).toMatchObject({ eventType: 'call_started', dedupeKey: 'req:wr_s', externalId: 'call_c9' })
  })

  it('re-processes a stored event that has not been processed yet (retry)', async () => {
    vi.mocked(ingestWebhookEvent).mockResolvedValue({ status: 'retry', id: 'evt_retry' })
    const res = await POST(authed(completedCall))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, duplicate: false })
    expect(processAfterResponse).toHaveBeenCalledWith('evt_retry', expect.anything())
  })

  it('acknowledges a duplicate delivery without processing it again', async () => {
    vi.mocked(ingestWebhookEvent).mockResolvedValue({ status: 'duplicate', id: 'evt_c1' })
    const res = await POST(authed(completedCall))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, duplicate: true })
    expect(processAfterResponse).not.toHaveBeenCalled()
  })

  it('answers 503 when the event cannot be stored so Cartesia retries', async () => {
    vi.mocked(ingestWebhookEvent).mockRejectedValue(new Error('webhook_events insert failed: timeout'))
    const res = await POST(authed(completedCall))
    expect(res.status).toBe(503)
    const body: unknown = await res.json()
    expect(body).toEqual({ error: 'temporarily_unavailable' })
    expect(JSON.stringify(body)).not.toContain('timeout')
    expect(processAfterResponse).not.toHaveBeenCalled()
  })
})
