import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/telephony/router', () => ({ transferLiveCall: vi.fn() }))
const toolRow = { current: null as Record<string, unknown> | null }
vi.mock('@/lib/voice-providers/platform-resources', () => ({
  readResourceRow: vi.fn(async () => toolRow.current),
  isReadyRow: (row: { external_id?: string; status?: string } | null) => !!row && !!row.external_id && (row.status ?? 'ready') === 'ready',
  pinnedResourceId: () => (process.env.ELEVENLABS_TRANSFER_TOOL_ID ?? '').trim() || null,
}))
const rateLimit = vi.fn()
vi.mock('@/lib/security/rate-limit', () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }))
const events: Array<Record<string, unknown>> = []
vi.mock('@/lib/observability/telemetry', () => ({ emitProviderEvent: (e: Record<string, unknown>) => events.push(e) }))

import { POST } from './route'
import { transferLiveCall } from '@/lib/telephony/router'
import { signCallToken } from '@/lib/telephony/tokens'
import { resetLegacyToolAuthState } from '../_lib/elevenlabs-tool'
import { FAKE_TWILIO_ACCOUNT_SID } from '@/tests/helpers/fixtures'

const SECRET = 'voice-token-secret-0123456789abcdef-xyz'
const TOOL_KEY = 'tool-key-0123456789abcdef-0123456789abcdef'
const OLD_TOOL_KEY = 'old-tool-key-0123456789abcdef-0123456789ab'
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

/** The headers a reconciled platform tool sends. */
function authHeaders(token = signCallToken(CALL_ID, 'tool', 300), key = TOOL_KEY): Record<string, string> {
  return { 'X-NTV-Tool-Key': key, 'X-NTV-Call-Token': token }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('VOICE_TOKEN_SECRET', SECRET)
  vi.stubEnv('ELEVENLABS_TOOL_SECRET', TOOL_KEY)
  vi.stubEnv('ELEVENLABS_TOOL_SECRET_PREVIOUS', '')
  vi.stubEnv('ELEVENLABS_TRANSFER_TOOL_ID', '')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(transferLiveCall).mockReset()
  rateLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 5, resetAt: NOW + 600_000 })
  toolRow.current = { key: 'elevenlabs.transfer_tool', external_id: 'tool_1', status: 'ready', details: { auth: 'headers', config_hash: 'h' } }
  resetLegacyToolAuthState()
  events.length = 0
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('POST /api/telephony/tools/transfer — header authentication', () => {
  it('transfers with the workspace key and the per-call tool token; the destination never comes from the request', async () => {
    vi.mocked(transferLiveCall).mockResolvedValue({ ok: true, message: 'Transferring the caller now.' })
    const res = await POST(post({ reason: '  Caller asked for a human  ', number: '+40799999999' }, authHeaders()))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ ok: true, message: 'Transferring the caller now.' })
    const [callId, reason, log] = vi.mocked(transferLiveCall).mock.calls[0]
    expect(callId).toBe(CALL_ID)
    expect(reason).toBe('Caller asked for a human')
    expect(log?.context).toMatchObject({ callId: CALL_ID, route: 'tools.transfer' })
    expect(rateLimit).toHaveBeenCalledWith({ name: 'tool_transfer', limit: 6, windowSeconds: 600 }, CALL_ID)
  })

  it('401 (generic body, nothing transferred) without the workspace key or with a wrong one', async () => {
    for (const headers of [{ 'X-NTV-Call-Token': signCallToken(CALL_ID, 'tool', 300) }, authHeaders(undefined, 'x'.repeat(40))]) {
      const res = await POST(post({ reason: 'x' }, headers))
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ ok: false, message: FAILED })
    }
    expect(transferLiveCall).not.toHaveBeenCalled()
    expect(events.map((e) => e.kind)).toEqual(['webhook_verification_failed', 'webhook_verification_failed'])
    expect(JSON.stringify(events)).not.toContain(TOOL_KEY)
  })

  it('accepts the previous key during a rotation, and only while it is configured', async () => {
    vi.mocked(transferLiveCall).mockResolvedValue({ ok: true, message: 'ok' })
    vi.stubEnv('ELEVENLABS_TOOL_SECRET_PREVIOUS', OLD_TOOL_KEY)
    expect((await POST(post({ reason: 'x' }, authHeaders(undefined, OLD_TOOL_KEY)))).status).toBe(200)
    vi.stubEnv('ELEVENLABS_TOOL_SECRET_PREVIOUS', '')
    expect((await POST(post({ reason: 'x' }, authHeaders(undefined, OLD_TOOL_KEY)))).status).toBe(401)
  })

  it('production without ELEVENLABS_TOOL_SECRET refuses tool requests; elsewhere the call token alone is enough', async () => {
    vi.mocked(transferLiveCall).mockResolvedValue({ ok: true, message: 'ok' })
    vi.stubEnv('ELEVENLABS_TOOL_SECRET', '')
    expect((await POST(post({ reason: 'x' }, { 'X-NTV-Call-Token': signCallToken(CALL_ID, 'tool', 300) }))).status).toBe(200)
    vi.stubEnv('NODE_ENV', 'production')
    expect((await POST(post({ reason: 'x' }, { 'X-NTV-Call-Token': signCallToken(CALL_ID, 'tool', 300) }))).status).toBe(401)
    expect(transferLiveCall).toHaveBeenCalledTimes(1)
  })

  it('200 {ok:false} (guidance for the agent) for a forged, expired, wrong-purpose or rotated call token', async () => {
    const tokens = [
      'forged.token.value',
      signCallToken(CALL_ID, 'tool', 60, NOW - 120_000),
      // The correlation token (ntv_call_token, visible in transcripts) never authorizes a tool.
      signCallToken(CALL_ID, 'transfer', 300),
      signCallToken(CALL_ID, 'stream_ended', 300),
    ]
    for (const token of tokens) {
      const res = await POST(post({ reason: 'x' }, authHeaders(token)))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: false, message: FAILED })
    }
    const token = signCallToken(CALL_ID, 'tool', 300)
    vi.stubEnv('VOICE_TOKEN_SECRET', 'rotated-secret-0123456789abcdef-rotated')
    expect(await (await POST(post({ reason: 'x' }, authHeaders(token)))).json()).toEqual({ ok: false, message: FAILED })
    expect(transferLiveCall).not.toHaveBeenCalled()
  })

  it('401 for a request with no credentials at all', async () => {
    const res = await POST(post({ reason: 'x' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ ok: false, message: FAILED })
    expect(transferLiveCall).not.toHaveBeenCalled()
  })
})

describe('POST /api/telephony/tools/transfer — legacy body token (tool not reconciled yet)', () => {
  it('accepts the body token while the stored tool still runs the old config, and only the old token purpose', async () => {
    vi.mocked(transferLiveCall).mockResolvedValue({ ok: true, message: 'Transferring the caller now.' })
    toolRow.current = { key: 'elevenlabs.transfer_tool', external_id: 'tool_1', details: {} }
    const ok = await POST(post({ call_token: signCallToken(CALL_ID, 'transfer', 300), reason: 'human' }))
    expect(ok.status).toBe(200)
    expect(vi.mocked(transferLiveCall).mock.calls[0][0]).toBe(CALL_ID)
    const wrongPurpose = await POST(post({ call_token: signCallToken(CALL_ID, 'tool', 300) }))
    expect(await wrongPurpose.json()).toEqual({ ok: false, message: FAILED })
    expect(transferLiveCall).toHaveBeenCalledTimes(1)
  })

  it('is closed once the tool runs header authentication, when no tool exists, and when the check fails', async () => {
    const legacy = () => POST(post({ call_token: signCallToken(CALL_ID, 'transfer', 300) }))
    expect((await legacy()).status).toBe(401) // reconciled (beforeEach row)
    resetLegacyToolAuthState()
    toolRow.current = null
    expect((await legacy()).status).toBe(401) // no legacy tool to accept requests from
    resetLegacyToolAuthState()
    const { readResourceRow } = await import('@/lib/voice-providers/platform-resources')
    vi.mocked(readResourceRow).mockRejectedValueOnce(new Error('db down'))
    expect((await legacy()).status).toBe(401) // fails closed
    expect(transferLiveCall).not.toHaveBeenCalled()
  })

  it('stays closed on this instance once seen closed', async () => {
    const legacy = () => POST(post({ call_token: signCallToken(CALL_ID, 'transfer', 300) }))
    expect((await legacy()).status).toBe(401)
    toolRow.current = { key: 'elevenlabs.transfer_tool', external_id: 'tool_1', details: {} }
    expect((await legacy()).status).toBe(401)
  })
})

describe('POST /api/telephony/tools/transfer — body validation', () => {
  it('400 with ok:false for invalid JSON or an invalid field', async () => {
    for (const body of ['{"reason":', { call_token: 'short' }, { reason: 7 }]) {
      const res = await POST(post(body, authHeaders()))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ ok: false, message: FAILED })
    }
    expect(transferLiveCall).not.toHaveBeenCalled()
  })

  it('415 with ok:false for a non-JSON content type', async () => {
    const res = await POST(post({ reason: 'x' }, { ...authHeaders(), 'content-type': 'text/plain' }))
    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({ ok: false, message: FAILED })
    expect(transferLiveCall).not.toHaveBeenCalled()
  })

  it('413 with ok:false for a body over 8 KiB', async () => {
    const res = await POST(post({ reason: 'x'.repeat(9 * 1024) }, authHeaders()))
    expect(res.status).toBe(413)
    expect(await res.json()).toMatchObject({ ok: false })
  })
})

describe('POST /api/telephony/tools/transfer — transfer', () => {
  it('stores a sanitized reason: one line, no long digit runs, at most 200 characters', async () => {
    vi.mocked(transferLiveCall).mockResolvedValue({ ok: true, message: 'ok' })
    await POST(post({ reason: `Call me on +40 712 345 678\nor card 4111111111111111 ${'z'.repeat(300)}` }, authHeaders()))
    const reason = vi.mocked(transferLiveCall).mock.calls[0][1]
    expect(reason).not.toMatch(/\d{4}/)
    expect(reason).toContain('[number]')
    expect(reason).not.toContain('\n')
    expect(reason.length).toBeLessThanOrEqual(200)
  })

  it('defaults the reason to an empty string and passes guidance through', async () => {
    vi.mocked(transferLiveCall).mockResolvedValue({ ok: false, message: 'Transfers are not available for this business.' })
    const res = await POST(post({}, authHeaders()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false, message: 'Transfers are not available for this business.' })
    expect(vi.mocked(transferLiveCall).mock.calls[0][1]).toBe('')
  })

  it('answers 200 ok:false (never the internal error) when transferLiveCall throws', async () => {
    vi.mocked(transferLiveCall).mockRejectedValue(new Error(`twilio 20003 auth failed for ${FAKE_TWILIO_ACCOUNT_SID}`))
    const res = await POST(post({ reason: 'human please' }, authHeaders()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: false, message: FAILED })
    expect(JSON.stringify(body)).not.toContain('20003')
  })

  it('answers 200 ok:false without touching the call when the per-call budget is spent', async () => {
    rateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: NOW + 60_000 })
    const res = await POST(post({ reason: 'again' }, authHeaders()))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: false })
    expect(transferLiveCall).not.toHaveBeenCalled()
  })
})
