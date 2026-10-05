import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/telephony/router', () => ({ transferLiveCall: vi.fn() }))

import { POST } from './route'
import { transferLiveCall } from '@/lib/telephony/router'
import { signCallToken } from '@/lib/telephony/tokens'
import { FAKE_TWILIO_ACCOUNT_SID } from '@/tests/helpers/fixtures'

const SECRET = 'voice-token-secret-0123456789abcdef-xyz'
const CALL_ID = '3f2b6c1e-8a4d-4f7b-9c2e-1d5a6b7c8d9e'
const NOW = Date.UTC(2026, 9, 5, 12, 0, 0)
const ENDPOINT = 'https://voice.example.com/api/telephony/tools/transfer'
const FAILED = 'I could not transfer the call right now. Offer to take a message instead.'

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('VOICE_TOKEN_SECRET', SECRET)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
})

describe('POST /api/telephony/tools/transfer — authentication', () => {
  it('401 with ok:false for a forged token', async () => {
    const res = await POST(post({ call_token: 'forged.token.value', reason: 'wants a human' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ ok: false, message: FAILED })
    expect(transferLiveCall).not.toHaveBeenCalled()
  })

  it('401 for an expired token or one minted for another purpose', async () => {
    for (const token of [
      signCallToken(CALL_ID, 'transfer', 60, NOW - 120_000),
      signCallToken(CALL_ID, 'stream_ended', 300),
    ]) {
      const res = await POST(post({ call_token: token }))
      expect(res.status).toBe(401)
      expect(await res.json()).toMatchObject({ ok: false })
    }
    expect(transferLiveCall).not.toHaveBeenCalled()
  })

  it('401 when the token was signed with another secret (rotated)', async () => {
    const token = signCallToken(CALL_ID, 'transfer', 300)
    vi.stubEnv('VOICE_TOKEN_SECRET', 'rotated-secret-0123456789abcdef-rotated')
    expect((await POST(post({ call_token: token }))).status).toBe(401)
    expect(transferLiveCall).not.toHaveBeenCalled()
  })
})

describe('POST /api/telephony/tools/transfer — body validation', () => {
  it('400 with ok:false for a missing call_token or invalid JSON', async () => {
    for (const body of [{ reason: 'x' }, { call_token: 'short' }, '{"call_token":']) {
      const res = await POST(post(body))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ ok: false, message: FAILED })
    }
    expect(transferLiveCall).not.toHaveBeenCalled()
  })

  it('415 with ok:false for a non-JSON content type', async () => {
    const res = await POST(post({ call_token: signCallToken(CALL_ID, 'transfer', 300) }, { 'content-type': 'text/plain' }))
    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({ ok: false, message: FAILED })
    expect(transferLiveCall).not.toHaveBeenCalled()
  })

  it('413 with ok:false for a body over 8 KiB', async () => {
    const res = await POST(post({ call_token: signCallToken(CALL_ID, 'transfer', 300), reason: 'x'.repeat(9 * 1024) }))
    expect(res.status).toBe(413)
    expect(await res.json()).toMatchObject({ ok: false })
  })
})

describe('POST /api/telephony/tools/transfer — transfer', () => {
  it('calls transferLiveCall with the call id from the token and the reason', async () => {
    vi.mocked(transferLiveCall).mockResolvedValue({ ok: true, message: 'Transferring you now.' })
    const token = signCallToken(CALL_ID, 'transfer', 300)
    const res = await POST(post({ call_token: token, reason: '  Caller asked for a human  ' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ ok: true, message: 'Transferring you now.' })
    expect(transferLiveCall).toHaveBeenCalledTimes(1)
    const [callId, reason, log] = vi.mocked(transferLiveCall).mock.calls[0]
    expect(callId).toBe(CALL_ID)
    expect(reason).toBe('Caller asked for a human')
    expect(log?.context).toMatchObject({ callId: CALL_ID, route: 'tools.transfer' })
  })

  it('defaults the reason to an empty string', async () => {
    vi.mocked(transferLiveCall).mockResolvedValue({ ok: false, message: 'Transfers are not enabled for this business.' })
    const res = await POST(post({ call_token: signCallToken(CALL_ID, 'transfer', 300) }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false, message: 'Transfers are not enabled for this business.' })
    expect(vi.mocked(transferLiveCall).mock.calls[0][1]).toBe('')
  })

  it('answers 200 ok:false (never the internal error) when transferLiveCall throws', async () => {
    vi.mocked(transferLiveCall).mockRejectedValue(new Error(`twilio 20003 auth failed for ${FAKE_TWILIO_ACCOUNT_SID}`))
    const res = await POST(post({ call_token: signCallToken(CALL_ID, 'transfer', 300), reason: 'human please' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: false, message: FAILED })
    expect(JSON.stringify(body)).not.toContain('20003')
  })
})
