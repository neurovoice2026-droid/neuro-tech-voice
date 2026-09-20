import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import twilio from 'twilio'
import { readVerifiedTwilioForm, twilioSignedUrl } from './signature'

const AUTH_TOKEN = 'test-auth-token-0123456789abcdef'
const APP_URL = 'https://app.example.com'

beforeEach(() => {
  vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC00000000000000000000000000000000')
  vi.stubEnv('TWILIO_AUTH_TOKEN', AUTH_TOKEN)
  vi.stubEnv('NEXT_PUBLIC_APP_URL', `${APP_URL}/`)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const form = {
  CallSid: 'CA1234567890abcdef1234567890abcdef',
  From: '+40712345678',
  To: '+40312345678',
  CallStatus: 'ringing',
  Direction: 'inbound',
}

function twilioRequest(opts: { requestUrl: string; signedUrl: string; params?: Record<string, string>; signature?: string | null; body?: string }) {
  const params = opts.params ?? form
  const body = opts.body ?? new URLSearchParams(params).toString()
  const signature =
    opts.signature === undefined ? twilio.getExpectedTwilioSignature(AUTH_TOKEN, opts.signedUrl, params) : opts.signature
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' }
  if (signature) headers['x-twilio-signature'] = signature
  return new NextRequest(opts.requestUrl, { method: 'POST', body, headers })
}

describe('twilioSignedUrl', () => {
  it('rebuilds the public URL from appUrl()', () => {
    const req = new Request('http://internal-host:3000/api/telephony/outbound?call_id=abc&x=1')
    expect(twilioSignedUrl(req)).toBe(`${APP_URL}/api/telephony/outbound?call_id=abc&x=1`)
  })
})

describe('readVerifiedTwilioForm', () => {
  it('accepts a valid signature and returns the form fields', async () => {
    const url = `${APP_URL}/api/telephony/inbound`
    await expect(readVerifiedTwilioForm(twilioRequest({ requestUrl: url, signedUrl: url }))).resolves.toEqual(form)
  })

  it('validates against the public URL even when the request arrives on an internal host', async () => {
    const req = twilioRequest({
      requestUrl: 'http://10.0.0.7:3000/api/telephony/outbound?call_id=7b0c6f4e-3f1a-4c2b-9d8e-1a2b3c4d5e6f',
      signedUrl: `${APP_URL}/api/telephony/outbound?call_id=7b0c6f4e-3f1a-4c2b-9d8e-1a2b3c4d5e6f`,
    })
    await expect(readVerifiedTwilioForm(req)).resolves.toMatchObject({ CallSid: form.CallSid })
  })

  it('rejects a signature computed for a different URL', async () => {
    const req = twilioRequest({
      requestUrl: `${APP_URL}/api/telephony/inbound`,
      signedUrl: `${APP_URL}/api/telephony/status`,
    })
    await expect(readVerifiedTwilioForm(req)).rejects.toMatchObject({ status: 403, code: 'invalid_signature' })
  })

  it('rejects tampered parameters', async () => {
    const url = `${APP_URL}/api/telephony/inbound`
    const signature = twilio.getExpectedTwilioSignature(AUTH_TOKEN, url, form)
    const req = twilioRequest({
      requestUrl: url,
      signedUrl: url,
      signature,
      body: new URLSearchParams({ ...form, From: '+40799999999' }).toString(),
    })
    await expect(readVerifiedTwilioForm(req)).rejects.toMatchObject({ status: 403, code: 'invalid_signature' })
  })

  it('rejects a missing signature or one made with another token', async () => {
    const url = `${APP_URL}/api/telephony/inbound`
    await expect(readVerifiedTwilioForm(twilioRequest({ requestUrl: url, signedUrl: url, signature: null }))).rejects.toMatchObject({
      status: 403,
    })
    const forged = twilio.getExpectedTwilioSignature('another-token', url, form)
    await expect(readVerifiedTwilioForm(twilioRequest({ requestUrl: url, signedUrl: url, signature: forged }))).rejects.toMatchObject({
      status: 403,
    })
  })

  it('handles repeated keys the way Twilio signs them', async () => {
    const url = `${APP_URL}/api/telephony/sms`
    const body = 'MediaUrl=b&MediaUrl=a&From=%2B40712345678'
    const signature = twilio.getExpectedTwilioSignature(AUTH_TOKEN, url, { MediaUrl: ['b', 'a'], From: '+40712345678' })
    const req = new NextRequest(url, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signature },
    })
    await expect(readVerifiedTwilioForm(req)).resolves.toEqual({ MediaUrl: 'b', From: '+40712345678' })
  })

  it('answers 503 when Twilio is not configured', async () => {
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'your-twilio-auth-token')
    const url = `${APP_URL}/api/telephony/inbound`
    await expect(readVerifiedTwilioForm(twilioRequest({ requestUrl: url, signedUrl: url }))).rejects.toMatchObject({
      status: 503,
      code: 'not_configured',
    })
  })
})
