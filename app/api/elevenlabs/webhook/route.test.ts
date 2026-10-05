import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/voice-providers/webhook-ingest', () => ({
  ingestWebhookEvent: vi.fn(),
  processAfterResponse: vi.fn(),
}))

import { POST } from './route'
import { ingestWebhookEvent, processAfterResponse } from '@/lib/voice-providers/webhook-ingest'
import { setProviderEventSink, type ProviderEvent } from '@/lib/observability/telemetry'

const SECRET = 'wsec_el_route_test_secret'
const NOW_MS = Date.parse('2026-10-05T12:00:00.000Z')
const NOW_S = Math.floor(NOW_MS / 1000)
const ENDPOINT = 'https://app.example.test/api/elevenlabs/webhook'

/** Exactly what ElevenLabs sends: t=<unix s>,v0=hex(HMAC-SHA256(secret, `${t}.${rawBody}`)). */
function sign(rawBody: string, t: number = NOW_S, secret: string = SECRET): string {
  return `t=${t},v0=${crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')}`
}

function post(rawBody: string, signature: string | null, extraHeaders: Record<string, string> = {}): Request {
  const headers = new Headers({ 'content-type': 'application/json', ...extraHeaders })
  if (signature !== null) headers.set('ElevenLabs-Signature', signature)
  return new Request(ENDPOINT, { method: 'POST', headers, body: rawBody })
}

function signed(payload: unknown): Request {
  const raw = JSON.stringify(payload)
  return post(raw, sign(raw))
}

const transcription = {
  type: 'post_call_transcription',
  event_timestamp: NOW_S,
  data: {
    agent_id: 'agent_el_1',
    conversation_id: 'conv_123',
    status: 'done',
    transcript: [{ role: 'agent', message: 'Hello', time_in_call_secs: 0 }],
    metadata: { call_duration_secs: 42, phone_call: { direction: 'inbound', agent_number: '+40312345678', external_number: '+40712345123' } },
  },
}

let events: ProviderEvent[] = []
let restoreSink: () => void

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW_MS)
  events = []
  restoreSink = setProviderEventSink((e) => events.push(e))
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('ALLOW_UNSIGNED_WEBHOOKS', '')
  vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', SECRET)
  vi.mocked(ingestWebhookEvent).mockReset()
  vi.mocked(processAfterResponse).mockReset()
  vi.mocked(ingestWebhookEvent).mockResolvedValue({ status: 'new', id: 'evt_1' })
  // Keep test output clean; the logger writes JSON lines to the console.
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  restoreSink()
  vi.useRealTimers()
})

describe('POST /api/elevenlabs/webhook — configuration', () => {
  it('fails closed with 503 in production when no secret is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', '')
    vi.stubEnv('ALLOW_UNSIGNED_WEBHOOKS', 'true') // ignored in production
    const res = await POST(post(JSON.stringify(transcription), null))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not_configured' })
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
    expect(events).toContainEqual(expect.objectContaining({ system: 'elevenlabs', kind: 'webhook_verification_failed', ok: false, errorCode: 'not_configured' }))
  })

  it('treats a whitespace-only secret as missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', '   ')
    const res = await POST(signed(transcription))
    expect(res.status).toBe(503)
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
  })

  it('fails closed outside production too unless unsigned webhooks are explicitly allowed', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', '')
    const res = await POST(post(JSON.stringify(transcription), null))
    expect(res.status).toBe(503)
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
  })

  it('accepts unsigned deliveries only in development with ALLOW_UNSIGNED_WEBHOOKS=true', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', '')
    vi.stubEnv('ALLOW_UNSIGNED_WEBHOOKS', 'true')
    const res = await POST(post(JSON.stringify(transcription), null))
    expect(res.status).toBe(200)
    expect(ingestWebhookEvent).toHaveBeenCalledTimes(1)
  })

  it('rejects oversized bodies with 413 before verifying or storing', async () => {
    const raw = JSON.stringify(transcription)
    const res = await POST(post(raw, sign(raw), { 'content-length': String(5 * 1024 * 1024) }))
    expect(res.status).toBe(413)
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
  })
})

describe('POST /api/elevenlabs/webhook — signature', () => {
  it.each([
    ['a missing signature header', 'missing', (raw: string) => post(raw, null)],
    ['a signature made with another secret', 'mismatch', (raw: string) => post(raw, sign(raw, NOW_S, 'not-the-secret'))],
    ['a tampered body', 'mismatch', (raw: string) => post(raw.replace('conv_123', 'conv_666'), sign(raw))],
    ['a stale timestamp (> 30 min)', 'stale', (raw: string) => post(raw, sign(raw, NOW_S - 31 * 60))],
    ['a timestamp too far in the future (> 5 min)', 'future', (raw: string) => post(raw, sign(raw, NOW_S + 6 * 60))],
    ['a malformed header', 'malformed', (raw: string) => post(raw, 'v0=deadbeef')],
  ])('answers 401 and stores nothing for %s', async (_label, reason, build) => {
    const res = await POST(build(JSON.stringify(transcription)))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'invalid_signature' })
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
    expect(processAfterResponse).not.toHaveBeenCalled()
    expect(events).toContainEqual(expect.objectContaining({ system: 'elevenlabs', kind: 'webhook_verification_failed', ok: false, details: { reason } }))
  })

  it('verifies the raw bytes as received (pretty-printed JSON signed as-is is accepted)', async () => {
    const raw = JSON.stringify(transcription, null, 2)
    const res = await POST(post(raw, sign(raw)))
    expect(res.status).toBe(200)
    expect(vi.mocked(ingestWebhookEvent).mock.calls[0][0].payload).toEqual(transcription)
  })

  it('answers 400 for a correctly signed body that is not JSON', async () => {
    const raw = '{"type":"post_call_transcription",'
    const res = await POST(post(raw, sign(raw)))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_json' })
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
  })
})

describe('POST /api/elevenlabs/webhook — ingestion', () => {
  it('acknowledges but ignores unhandled event types', async () => {
    const res = await POST(signed({ ...transcription, type: 'conversation_started' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, ignored: true })
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
    expect(processAfterResponse).not.toHaveBeenCalled()
  })

  it('acknowledges but ignores a handled type without a conversation id', async () => {
    const res = await POST(signed({ type: 'post_call_audio', data: { agent_id: 'a' } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, ignored: true })
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
  })

  it('stores a valid transcription with its dedupe key and processes it after the response', async () => {
    const res = await POST(signed(transcription))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, duplicate: false })
    expect(ingestWebhookEvent).toHaveBeenCalledTimes(1)
    expect(ingestWebhookEvent).toHaveBeenCalledWith({
      provider: 'elevenlabs',
      eventType: 'post_call_transcription',
      dedupeKey: 'post_call_transcription:conv_123',
      externalId: 'conv_123',
      payload: transcription,
    })
    expect(processAfterResponse).toHaveBeenCalledTimes(1)
    expect(processAfterResponse).toHaveBeenCalledWith('evt_1', expect.objectContaining({ info: expect.any(Function), error: expect.any(Function) }))
    expect(events).toContainEqual(expect.objectContaining({ system: 'elevenlabs', kind: 'webhook_received', ok: true }))
  })

  it.each([
    ['post_call_audio', { agent_id: 'agent_el_1', conversation_id: 'conv_123', full_audio: 'SUQz' }],
    ['call_initiation_failure', { agent_id: 'agent_el_1', conversation_id: 'conv_123', failure_reason: 'busy' }],
  ])('uses a per-type dedupe key for %s', async (type, data) => {
    const res = await POST(signed({ type, event_timestamp: NOW_S, data }))
    expect(res.status).toBe(200)
    expect(vi.mocked(ingestWebhookEvent).mock.calls[0][0]).toMatchObject({ provider: 'elevenlabs', eventType: type, dedupeKey: `${type}:conv_123`, externalId: 'conv_123' })
  })

  it('re-processes a stored event that has not been processed yet (retry)', async () => {
    vi.mocked(ingestWebhookEvent).mockResolvedValue({ status: 'retry', id: 'evt_retry' })
    const res = await POST(signed(transcription))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, duplicate: false })
    expect(processAfterResponse).toHaveBeenCalledWith('evt_retry', expect.anything())
  })

  it('acknowledges a duplicate delivery without processing it again', async () => {
    vi.mocked(ingestWebhookEvent).mockResolvedValue({ status: 'duplicate', id: 'evt_1' })
    const res = await POST(signed(transcription))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, duplicate: true })
    expect(processAfterResponse).not.toHaveBeenCalled()
  })

  it('answers 503 when the event cannot be stored so ElevenLabs retries', async () => {
    vi.mocked(ingestWebhookEvent).mockRejectedValue(new Error('webhook_events insert failed: connection refused'))
    const res = await POST(signed(transcription))
    expect(res.status).toBe(503)
    const body: unknown = await res.json()
    expect(body).toEqual({ error: 'temporarily_unavailable' })
    expect(JSON.stringify(body)).not.toContain('connection refused')
    expect(processAfterResponse).not.toHaveBeenCalled()
  })
})
