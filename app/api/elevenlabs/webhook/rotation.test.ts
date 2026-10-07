import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/voice-providers/webhook-ingest', () => ({
  ingestWebhookEvent: vi.fn(),
  processAfterResponse: vi.fn(),
}))

import { POST } from './route'
import { ingestWebhookEvent } from '@/lib/voice-providers/webhook-ingest'

// Webhook secret rotation: the previous secret keeps working while the new
// one is rolled out; the current one is still required (fails closed).

const NOW_MS = Date.parse('2026-10-07T12:00:00.000Z')
const NOW_S = Math.floor(NOW_MS / 1000)
const body = JSON.stringify({ type: 'post_call_transcription', event_timestamp: NOW_S, data: { conversation_id: 'conv_1', agent_id: 'agent_1' } })
const sign = (secret: string, t = NOW_S) => `t=${t},v0=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`
const post = (signature: string) => new Request('https://app.example.test/api/elevenlabs/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'ElevenLabs-Signature': signature }, body })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW_MS)
  vi.stubEnv('ALLOW_UNSIGNED_WEBHOOKS', '')
  vi.mocked(ingestWebhookEvent).mockReset().mockResolvedValue({ status: 'new', id: 'evt_1' })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.useRealTimers())

describe('ElevenLabs webhook secret rotation', () => {
  it('accepts deliveries signed with the current or the previous secret, nothing else', async () => {
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', 'wsec_new_secret_value')
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET_PREVIOUS', 'wsec_old_secret_value')
    expect((await POST(post(sign('wsec_new_secret_value')))).status).toBe(200)
    expect((await POST(post(sign('wsec_old_secret_value')))).status).toBe(200)
    expect((await POST(post(sign('wsec_other')))).status).toBe(401)
    expect(ingestWebhookEvent).toHaveBeenCalledTimes(2)
  })

  it('a previous secret alone does not configure the receiver (fails closed)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', '')
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET_PREVIOUS', 'wsec_old_secret_value')
    expect((await POST(post(sign('wsec_old_secret_value')))).status).toBe(503)
    expect(ingestWebhookEvent).not.toHaveBeenCalled()
  })

  it('a stale signature is rejected (401) whichever secret signed it', async () => {
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', 'wsec_new_secret_value')
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET_PREVIOUS', 'wsec_old_secret_value')
    expect((await POST(post(sign('wsec_old_secret_value', NOW_S - 3600)))).status).toBe(401)
  })
})
