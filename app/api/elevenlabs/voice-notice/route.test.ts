import crypto from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const notice = vi.hoisted(() => ({ recordVoiceNotice: vi.fn(), processVoiceNotice: vi.fn() }))
vi.mock('@/lib/voice-providers/voice-notice', async (orig) => ({ ...(await orig<object>()), ...notice }))
const deferred = vi.hoisted(() => ({ list: [] as Promise<unknown>[] }))
vi.mock('@/lib/observability/telemetry', () => ({ deferBackground: (p: Promise<unknown>) => deferred.list.push(p), emitProviderEvent: () => {} }))

import { POST } from './route'

const SECRET = 'whsec_voice_notice_test_secret_0123456789'
function signed(body: unknown, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(body)
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')
  return new Request('http://app.test/api/elevenlabs/voice-notice', { method: 'POST', headers: { 'content-type': 'application/json', 'elevenlabs-signature': `t=${t},v0=${sig}` }, body: raw })
}
const EVENT = { type: 'voice_removal_notice', event_timestamp: 1_790_000_000, data: { voice_id: 'VoiceAAAA0000000001' } }

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_VOICE_NOTICE_WEBHOOK_SECRET', SECRET)
  notice.recordVoiceNotice.mockReset().mockResolvedValue({ id: 'evt1', isNew: true })
  notice.processVoiceNotice.mockReset().mockResolvedValue(undefined)
  deferred.list = []
})

describe('POST /api/elevenlabs/voice-notice', () => {
  it('fails closed without a secret and rejects bad or stale signatures', async () => {
    vi.stubEnv('ELEVENLABS_VOICE_NOTICE_WEBHOOK_SECRET', '')
    expect((await POST(signed(EVENT))).status).toBe(503)
    vi.stubEnv('ELEVENLABS_VOICE_NOTICE_WEBHOOK_SECRET', SECRET)
    expect((await POST(signed(EVENT, 'wrong-secret-wrong-secret-wrong'))).status).toBe(401)
    expect((await POST(signed(EVENT, SECRET, Math.floor(Date.now() / 1000) - 3600))).status).toBe(401)
    const unsigned = new Request('http://app.test/api/elevenlabs/voice-notice', { method: 'POST', body: JSON.stringify(EVENT) })
    expect((await POST(unsigned)).status).toBe(401)
    expect(notice.recordVoiceNotice).not.toHaveBeenCalled()
  })

  it('stores a signed notice and checks the named voices after the response; retries are acknowledged once', async () => {
    const res = await POST(signed(EVENT))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, duplicate: false })
    expect(notice.recordVoiceNotice).toHaveBeenCalledWith({ type: 'voice_removal_notice', eventTimestamp: 1_790_000_000, voiceIds: ['VoiceAAAA0000000001'] })
    await Promise.all(deferred.list)
    expect(notice.processVoiceNotice).toHaveBeenCalledTimes(1)

    notice.recordVoiceNotice.mockResolvedValueOnce({ id: 'evt1', isNew: false })
    expect(await (await POST(signed(EVENT))).json()).toEqual({ received: true, duplicate: true })
    expect(notice.processVoiceNotice).toHaveBeenCalledTimes(1)
  })

  it('ignores other event types, answers 400 to invalid JSON and 503 when it cannot store (provider retries)', async () => {
    expect(await (await POST(signed({ type: 'post_call_transcription', data: {} }))).json()).toEqual({ received: true, ignored: true })
    const t = Math.floor(Date.now() / 1000)
    const raw = 'not json'
    const sig = crypto.createHmac('sha256', SECRET).update(`${t}.${raw}`).digest('hex')
    expect((await POST(new Request('http://app.test/x', { method: 'POST', headers: { 'elevenlabs-signature': `t=${t},v0=${sig}` }, body: raw }))).status).toBe(400)
    notice.recordVoiceNotice.mockRejectedValueOnce(new Error('db down'))
    expect((await POST(signed(EVENT))).status).toBe(503)
  })
})
