import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import twilio from 'twilio'
import { twilioRoute, type TwilioRouteContext } from './route-handler'
import { signCallToken } from './tokens'
import { hangup } from './twiml'
import { setProviderEventSink, type ProviderEvent } from '@/lib/observability/telemetry'
import { findAll, findOne, parseXml } from '@/tests/helpers/xml'
import { FAKE_TWILIO_ACCOUNT_SID } from '@/tests/helpers/fixtures'

const AUTH_TOKEN = 'twilio_auth_token_0123456789abcdef'
const PUBLIC_BASE = 'https://voice.example.com'
const TOKEN_SECRET = 'voice-token-secret-0123456789abcdef-xyz'
const CALL_ID = '3f2b6c1e-8a4d-4f7b-9c2e-1d5a6b7c8d9e'
const NOW = Date.UTC(2026, 9, 5, 12, 0, 0)
const PATH = '/api/telephony/twilio/inbound'

const PARAMS = {
  CallSid: 'CA0123456789abcdef0123456789abcdef',
  AccountSid: FAKE_TWILIO_ACCOUNT_SID,
  From: '+40712345678',
  To: '+40312345678',
  CallStatus: 'ringing',
}

const SAY_HI = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Hi</Say></Response>'

let events: ProviderEvent[] = []
let restoreSink: () => void

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('TWILIO_AUTH_TOKEN', AUTH_TOKEN)
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', PUBLIC_BASE)
  vi.stubEnv('VOICE_TOKEN_SECRET', TOKEN_SECRET)
  vi.stubEnv('ALLOW_UNSIGNED_WEBHOOKS', '')
  events = []
  restoreSink = setProviderEventSink((e) => events.push(e))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  restoreSink()
  vi.useRealTimers()
})

/**
 * A Twilio webhook as it arrives behind the proxy: the internal URL differs
 * from the public one Twilio signed, so the handler must rebuild it from
 * VOICE_PUBLIC_BASE_URL.
 */
function twilioRequest(opts: {
  search?: string
  params?: Record<string, string>
  signature?: string | null
  contentType?: string
  body?: string
} = {}): Request {
  const search = opts.search ?? ''
  const params = opts.params ?? PARAMS
  const signature = opts.signature === undefined
    ? twilio.getExpectedTwilioSignature(AUTH_TOKEN, `${PUBLIC_BASE}${PATH}${search}`, params)
    : opts.signature
  const headers: Record<string, string> = { 'content-type': opts.contentType ?? 'application/x-www-form-urlencoded' }
  if (signature !== null) headers['x-twilio-signature'] = signature
  return new Request(`http://internal.vercel.test${PATH}${search}`, {
    method: 'POST',
    headers,
    body: opts.body ?? new URLSearchParams(params).toString(),
  })
}

describe('twilioRoute — signature validation', () => {
  it('runs the handler for a valid signature and returns TwiML as text/xml', async () => {
    const run = vi.fn(async (_ctx: TwilioRouteContext) => SAY_HI)
    const res = await twilioRoute('twilio.inbound', run, { onError: 'retry' })(twilioRequest())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^text\/xml/)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).toBe(SAY_HI)
    expect(run).toHaveBeenCalledTimes(1)
    const ctx = run.mock.calls[0][0]
    expect(ctx.params).toEqual(PARAMS)
    expect(ctx.callId).toBeNull()
    expect(ctx.url.pathname).toBe(PATH)
  })

  it('validates against the public URL including the query string', async () => {
    const run = vi.fn(async () => SAY_HI)
    const handler = twilioRoute('twilio.dial', run, { onError: 'hangup' })
    expect((await handler(twilioRequest({ search: '?leg=cartesia&x=1' }))).status).toBe(200)
    // Signed for a different query → rejected.
    const sig = twilio.getExpectedTwilioSignature(AUTH_TOKEN, `${PUBLIC_BASE}${PATH}?leg=elevenlabs`, PARAMS)
    expect((await handler(twilioRequest({ search: '?leg=cartesia', signature: sig }))).status).toBe(403)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('returns 204 when the handler has nothing to say', async () => {
    const res = await twilioRoute('twilio.status', async () => null, { onError: 'retry' })(twilioRequest())
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })

  it('rejects an invalid signature with 403 without calling the handler', async () => {
    const run = vi.fn(async () => SAY_HI)
    const handler = twilioRoute('twilio.inbound', run, { onError: 'retry' })
    const wrongKey = twilio.getExpectedTwilioSignature('another_token_0123456789abcdef', `${PUBLIC_BASE}${PATH}`, PARAMS)
    expect((await handler(twilioRequest({ signature: wrongKey }))).status).toBe(403)
    expect((await handler(twilioRequest({ signature: 'not-a-signature' }))).status).toBe(403)
    expect((await handler(twilioRequest({ signature: null }))).status).toBe(403)
    expect(run).not.toHaveBeenCalled()
    expect(events.filter((e) => e.kind === 'webhook_verification_failed')).toHaveLength(3)
    expect(events[0]).toMatchObject({ system: 'twilio', ok: false, details: { path: PATH } })
  })

  it('rejects params tampered after signing', async () => {
    const run = vi.fn(async () => SAY_HI)
    const sig = twilio.getExpectedTwilioSignature(AUTH_TOKEN, `${PUBLIC_BASE}${PATH}`, PARAMS)
    const tampered = new URLSearchParams({ ...PARAMS, From: '+40799999999' }).toString()
    const res = await twilioRoute('twilio.inbound', run, { onError: 'retry' })(twilioRequest({ signature: sig, body: tampered }))
    expect(res.status).toBe(403)
    expect(run).not.toHaveBeenCalled()
  })

  it('fails closed when TWILIO_AUTH_TOKEN is missing', async () => {
    const req = twilioRequest()
    vi.stubEnv('TWILIO_AUTH_TOKEN', '')
    const run = vi.fn(async () => SAY_HI)
    expect((await twilioRoute('twilio.inbound', run, { onError: 'retry' })(req)).status).toBe(403)
    expect(run).not.toHaveBeenCalled()
  })

  it('rejects a non-form content type with 415', async () => {
    const run = vi.fn(async () => SAY_HI)
    const res = await twilioRoute('twilio.inbound', run, { onError: 'retry' })(
      twilioRequest({ contentType: 'application/json', body: JSON.stringify(PARAMS) }),
    )
    expect(res.status).toBe(415)
    expect(run).not.toHaveBeenCalled()
  })

  it('rejects an oversized form body with 413', async () => {
    const run = vi.fn(async () => SAY_HI)
    const res = await twilioRoute('twilio.inbound', run, { onError: 'retry' })(twilioRequest({ body: `Pad=${'x'.repeat(70 * 1024)}` }))
    expect(res.status).toBe(413)
    expect(run).not.toHaveBeenCalled()
  })
})

describe('twilioRoute — call token', () => {
  const opts = { onError: 'hangup' as const, token: 'stream_ended' as const }

  it('403 when the t parameter is missing', async () => {
    const run = vi.fn(async () => SAY_HI)
    expect((await twilioRoute('twilio.stream_ended', run, opts)(twilioRequest())).status).toBe(403)
    expect(run).not.toHaveBeenCalled()
  })

  it('403 when t is forged, expired or for another purpose', async () => {
    const run = vi.fn(async () => SAY_HI)
    const handler = twilioRoute('twilio.stream_ended', run, opts)
    const valid = signCallToken(CALL_ID, 'stream_ended', 300)
    const [body] = valid.split('.')
    const bad = [
      'garbage.token',
      `${body}.AAAA`,
      signCallToken(CALL_ID, 'transfer', 300),
      signCallToken(CALL_ID, 'stream_ended', 300, NOW - 3_600_000),
    ]
    for (const t of bad) {
      const res = await handler(twilioRequest({ search: `?t=${encodeURIComponent(t)}` }))
      expect(res.status).toBe(403)
    }
    expect(run).not.toHaveBeenCalled()
  })

  it('passes the verified call id to the handler', async () => {
    const run = vi.fn(async (_ctx: TwilioRouteContext) => SAY_HI)
    const t = signCallToken(CALL_ID, 'stream_ended', 300)
    const res = await twilioRoute('twilio.stream_ended', run, opts)(twilioRequest({ search: `?t=${encodeURIComponent(t)}` }))
    expect(res.status).toBe(200)
    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0][0].callId).toBe(CALL_ID)
  })

  it('checks the Twilio signature before the token', async () => {
    const run = vi.fn(async () => SAY_HI)
    const t = signCallToken(CALL_ID, 'stream_ended', 300)
    const res = await twilioRoute('twilio.stream_ended', run, opts)(twilioRequest({ search: `?t=${encodeURIComponent(t)}`, signature: 'bad' }))
    expect(res.status).toBe(403)
    expect(events.some((e) => e.kind === 'webhook_verification_failed')).toBe(true)
    expect(run).not.toHaveBeenCalled()
  })
})

describe('twilioRoute — handler failures', () => {
  it("onError 'retry' → 500 so Twilio uses the number's fallback URL", async () => {
    const res = await twilioRoute('twilio.inbound', async () => {
      throw new Error('db down: password=hunter2')
    }, { onError: 'retry' })(twilioRequest())
    expect(res.status).toBe(500)
    expect(await res.text()).toBe('')
  })

  it("onError 'hangup' → valid TwiML that ends the call", async () => {
    const res = await twilioRoute('twilio.dial_complete', async () => {
      throw new Error('router exploded')
    }, { onError: 'hangup' })(twilioRequest())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^text\/xml/)
    const xml = await res.text()
    expect(xml).toBe(hangup())
    const doc = parseXml(xml)
    expect(doc.name).toBe('Response')
    findOne(doc, 'Hangup')
    expect(findAll(doc, 'Say')).toHaveLength(0)
    expect(xml).not.toContain('exploded')
  })
})
