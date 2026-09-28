import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionTokenPayload } from '@/lib/voice/contracts'
import {
  internalSignatureHeaders,
  readVerifiedInternalBody,
  signInternalBody,
  signSessionToken,
  timingSafeEqualString,
  verifyInternalSignature,
  verifySessionToken,
} from './signing'
import { INTERNAL_SIGNATURE_VECTORS, SESSION_TOKEN_VECTORS, SIGNING_VECTOR_SECRET } from './signing.vectors'

// The vectors are fixed strings computed independently with node:crypto. The
// gateway runs the same file; if one of these tests fails, the two sides no
// longer agree and every gateway ↔ app request would be rejected.

const SECRET = SIGNING_VECTOR_SECRET

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('test vectors', () => {
  it.each(INTERNAL_SIGNATURE_VECTORS)('signs internal body: $name', (vector) => {
    expect(signInternalBody(vector.rawBody, vector.secret, vector.timestamp)).toBe(vector.header)
    expect(verifyInternalSignature(vector.header, vector.rawBody, vector.secret, vector.timestamp)).toBe(true)
  })

  it.each(SESSION_TOKEN_VECTORS)('signs session token: $name', (vector) => {
    const payload = vector.payload as SessionTokenPayload
    expect(signSessionToken(payload, vector.secret)).toBe(vector.token)
    expect(verifySessionToken(vector.token, vector.secret, vector.validAt)).toEqual(payload)
    expect(vector.token.length).toBeLessThan(450)
  })
})

describe('timingSafeEqualString', () => {
  it('compares strings of any length without throwing', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true)
    expect(timingSafeEqualString('abc', 'abd')).toBe(false)
    expect(timingSafeEqualString('abc', 'abcd')).toBe(false)
    expect(timingSafeEqualString('', '')).toBe(true)
    expect(timingSafeEqualString('ă', 'a')).toBe(false)
  })
})

describe('internal signatures', () => {
  const body = '{"call_id":"x"}'
  const t = 1_767_225_600

  it('accepts a fresh signature within the tolerance', () => {
    const header = signInternalBody(body, SECRET, t)
    expect(verifyInternalSignature(header, body, SECRET, t + 300)).toBe(true)
    expect(verifyInternalSignature(header, body, SECRET, t - 300)).toBe(true)
  })

  it('rejects stale or future timestamps', () => {
    const header = signInternalBody(body, SECRET, t)
    expect(verifyInternalSignature(header, body, SECRET, t + 301)).toBe(false)
    expect(verifyInternalSignature(header, body, SECRET, t - 301)).toBe(false)
  })

  it('rejects a tampered body, wrong secret or malformed header', () => {
    const header = signInternalBody(body, SECRET, t)
    expect(verifyInternalSignature(header, `${body} `, SECRET, t)).toBe(false)
    expect(verifyInternalSignature(header, body, `${SECRET}x`, t)).toBe(false)
    expect(verifyInternalSignature(header, body, '', t)).toBe(false)
    expect(verifyInternalSignature(null, body, SECRET, t)).toBe(false)
    expect(verifyInternalSignature('', body, SECRET, t)).toBe(false)
    expect(verifyInternalSignature(`t=${t}`, body, SECRET, t)).toBe(false)
    expect(verifyInternalSignature(header.replace(/v1=/, 'v0='), body, SECRET, t)).toBe(false)
    expect(verifyInternalSignature(`t=abc,v1=${header.split('v1=')[1]}`, body, SECRET, t)).toBe(false)
    const flipped = `${header.slice(0, -1)}${header.endsWith('0') ? '1' : '0'}`
    expect(verifyInternalSignature(flipped, body, SECRET, t)).toBe(false)
  })

  it('accepts any matching v1 entry (secret rotation) and whitespace', () => {
    const good = signInternalBody(body, SECRET, t).split('v1=')[1]
    expect(verifyInternalSignature(`t=${t}, v1=${'0'.repeat(64)}, v1=${good}`, body, SECRET, t)).toBe(true)
  })

  it('builds the header map', () => {
    expect(internalSignatureHeaders(body, SECRET, t)).toEqual({ 'x-ntv-signature': signInternalBody(body, SECRET, t) })
  })
})

describe('session tokens', () => {
  const payload: SessionTokenPayload = {
    v: 1,
    sid: '7b0c6f4e-3f1a-4c2b-9d8e-1a2b3c4d5e6f',
    org: 'org-1',
    agt: 'agent-1',
    ch: 'twilio',
    mode: 'cartesia_managed',
    exp: 2_000_000_000,
  }
  const now = 1_999_999_900

  function forge(data: unknown, secret = SECRET): string {
    // Validly signed tokens with bad payloads, to prove the payload checks run.
    const encoded = Buffer.from(JSON.stringify(data)).toString('base64url')
    return `${encoded}.${createHmac('sha256', secret).update(encoded).digest('base64url')}`
  }

  it('round-trips and drops unknown fields', () => {
    const token = signSessionToken({ ...payload, extra: 'nope' } as SessionTokenPayload, SECRET)
    expect(verifySessionToken(token, SECRET, now)).toEqual(payload)
  })

  it('rejects expired tokens (exp is exclusive)', () => {
    const token = signSessionToken(payload, SECRET)
    expect(verifySessionToken(token, SECRET, payload.exp)).toBeNull()
    expect(verifySessionToken(token, SECRET, payload.exp - 1)).not.toBeNull()
  })

  it('rejects wrong secrets and tampering', () => {
    const token = signSessionToken(payload, SECRET)
    expect(verifySessionToken(token, `${SECRET}x`, now)).toBeNull()
    const [body, mac] = token.split('.')
    const tampered = Buffer.from(JSON.stringify({ ...payload, org: 'other-org' })).toString('base64url')
    expect(verifySessionToken(`${tampered}.${mac}`, SECRET, now)).toBeNull()
    expect(verifySessionToken(`${body}.${mac}x`, SECRET, now)).toBeNull()
    expect(verifySessionToken(`${body}.${mac}.x`, SECRET, now)).toBeNull()
    expect(verifySessionToken(body, SECRET, now)).toBeNull()
    expect(verifySessionToken('', SECRET, now)).toBeNull()
    expect(verifySessionToken(token, '', now)).toBeNull()
  })

  it('rejects signed tokens with invalid payloads', () => {
    expect(verifySessionToken(forge({ ...payload, v: 2 }), SECRET, now)).toBeNull()
    expect(verifySessionToken(forge({ ...payload, sid: '' }), SECRET, now)).toBeNull()
    expect(verifySessionToken(forge({ ...payload, org: undefined }), SECRET, now)).toBeNull()
    expect(verifySessionToken(forge({ ...payload, ch: 'sip' }), SECRET, now)).toBeNull()
    expect(verifySessionToken(forge({ ...payload, mode: 'auto' }), SECRET, now)).toBeNull()
    expect(verifySessionToken(forge({ ...payload, exp: '2000000000' }), SECRET, now)).toBeNull()
    expect(verifySessionToken(forge({ ...payload, exp: 2_000_000_000.5 }), SECRET, now)).toBeNull()
    expect(verifySessionToken(forge([payload]), SECRET, now)).toBeNull()
    expect(verifySessionToken(forge(null), SECRET, now)).toBeNull()
    expect(verifySessionToken(forge(payload), SECRET, now)).toEqual(payload)
  })

  it('rejects signed tokens whose payload is not JSON', () => {
    const encoded = Buffer.from('not json').toString('base64url')
    const token = `${encoded}.${createHmac('sha256', SECRET).update(encoded).digest('base64url')}`
    expect(verifySessionToken(token, SECRET, now)).toBeNull()
  })

  it('requires a secret to sign', () => {
    expect(() => signSessionToken(payload, '')).toThrow()
  })
})

describe('readVerifiedInternalBody', () => {
  const GATEWAY_SECRET = 'g'.repeat(64)

  function request(body: string, header: string | null) {
    return new Request('https://app.example.com/api/voice/internal/events', {
      method: 'POST',
      body,
      headers: header ? { 'x-ntv-signature': header } : {},
    })
  }

  it('returns the raw body when the signature is valid', async () => {
    vi.stubEnv('VOICE_GATEWAY_SECRET', GATEWAY_SECRET)
    const body = '{"type":"stream_started"}'
    await expect(readVerifiedInternalBody(request(body, signInternalBody(body, GATEWAY_SECRET)))).resolves.toBe(body)
  })

  it('throws 401 bad_signature for missing or invalid signatures', async () => {
    vi.stubEnv('VOICE_GATEWAY_SECRET', GATEWAY_SECRET)
    await expect(readVerifiedInternalBody(request('{}', null))).rejects.toMatchObject({ status: 401, code: 'bad_signature' })
    await expect(
      readVerifiedInternalBody(request('{}', signInternalBody('{}', 'another-secret-another-secret-12345')))
    ).rejects.toMatchObject({ status: 401, code: 'bad_signature' })
  })

  it('throws 503 not_configured without a secret', async () => {
    vi.stubEnv('VOICE_GATEWAY_SECRET', '')
    await expect(readVerifiedInternalBody(request('{}', 't=1,v1=00'))).rejects.toMatchObject({
      status: 503,
      code: 'not_configured',
    })
  })

  it('refuses a secret shorter than 32 characters even with a matching signature', async () => {
    const weak = 'short-gateway-secret'
    vi.stubEnv('VOICE_GATEWAY_SECRET', weak)
    await expect(readVerifiedInternalBody(request('{}', signInternalBody('{}', weak)))).rejects.toMatchObject({
      status: 503,
      code: 'not_configured',
    })
  })
})
