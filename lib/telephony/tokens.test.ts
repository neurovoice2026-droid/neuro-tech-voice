import crypto from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signCallToken, verifyCallToken } from './tokens'

const SECRET = 'test-voice-token-secret-0123456789abcdef'
const CALL_ID = '3f2b6c1e-8a4d-4f7b-9c2e-1d5a6b7c8d9e'
const OTHER_CALL_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const NOW = Date.UTC(2026, 9, 5, 12, 0, 0) // fixed clock

function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url')
}

/** Signs an arbitrary body with the test secret (to craft authentic-but-bad payloads). */
function signRaw(body: string, secret = SECRET): string {
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`
}

beforeEach(() => {
  vi.stubEnv('VOICE_TOKEN_SECRET', SECRET)
})

describe('signCallToken / verifyCallToken', () => {
  it('round-trips the call id for the same purpose', () => {
    const token = signCallToken(CALL_ID, 'transfer', 300, NOW)
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(verifyCallToken(token, 'transfer', NOW)).toBe(CALL_ID)
    expect(verifyCallToken(token, 'transfer', NOW + 299_000)).toBe(CALL_ID)
  })

  it('works for every purpose', () => {
    for (const purpose of ['transfer', 'stream_ended', 'dial_complete', 'refer', 'outbound_connect'] as const) {
      expect(verifyCallToken(signCallToken(CALL_ID, purpose, 60, NOW), purpose, NOW)).toBe(CALL_ID)
    }
  })

  it('accepts upper-case UUIDs', () => {
    const upper = CALL_ID.toUpperCase()
    expect(verifyCallToken(signCallToken(upper, 'refer', 60, NOW), 'refer', NOW)).toBe(upper)
  })

  it('rejects a token issued for another purpose', () => {
    const token = signCallToken(CALL_ID, 'stream_ended', 300, NOW)
    expect(verifyCallToken(token, 'transfer', NOW)).toBeNull()
    expect(verifyCallToken(token, 'dial_complete', NOW)).toBeNull()
  })

  it('rejects an expired token (valid up to and including the expiry second)', () => {
    const token = signCallToken(CALL_ID, 'transfer', 60, NOW)
    expect(verifyCallToken(token, 'transfer', NOW + 60_000)).toBe(CALL_ID)
    expect(verifyCallToken(token, 'transfer', NOW + 61_000)).toBeNull()
    expect(verifyCallToken(token, 'transfer', NOW + 24 * 3600_000)).toBeNull()
  })

  it('uses the real clock by default', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(NOW)
      const token = signCallToken(CALL_ID, 'transfer', 30)
      expect(verifyCallToken(token, 'transfer')).toBe(CALL_ID)
      vi.setSystemTime(NOW + 31_000)
      expect(verifyCallToken(token, 'transfer')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects a tampered payload (signature no longer matches)', () => {
    const token = signCallToken(CALL_ID, 'transfer', 300, NOW)
    const [, sig] = token.split('.')
    const forgedBody = b64url(JSON.stringify({ c: OTHER_CALL_ID, p: 'transfer', e: Math.floor(NOW / 1000) + 300 }))
    expect(verifyCallToken(`${forgedBody}.${sig}`, 'transfer', NOW)).toBeNull()
    // Extending the expiry is tampering too.
    const extended = b64url(JSON.stringify({ c: CALL_ID, p: 'transfer', e: Math.floor(NOW / 1000) + 999_999 }))
    expect(verifyCallToken(`${extended}.${sig}`, 'transfer', NOW)).toBeNull()
  })

  it('rejects a tampered or truncated signature', () => {
    const token = signCallToken(CALL_ID, 'transfer', 300, NOW)
    const [body, sig] = token.split('.')
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1)
    expect(verifyCallToken(`${body}.${flipped}`, 'transfer', NOW)).toBeNull()
    expect(verifyCallToken(`${body}.${sig.slice(0, -4)}`, 'transfer', NOW)).toBeNull()
    expect(verifyCallToken(`${body}.`, 'transfer', NOW)).toBeNull()
  })

  it('rejects a token signed with another secret', () => {
    const body = b64url(JSON.stringify({ c: CALL_ID, p: 'transfer', e: Math.floor(NOW / 1000) + 300 }))
    expect(verifyCallToken(signRaw(body, 'another-secret-that-is-long-enough-000'), 'transfer', NOW)).toBeNull()
    expect(verifyCallToken(signRaw(body), 'transfer', NOW)).toBe(CALL_ID)
  })

  it('rejects malformed input without throwing', () => {
    for (const bad of [null, undefined, '', 'no-dot', '.', '.sig', 'a.b', 'x'.repeat(600) + '.' + 'y']) {
      expect(verifyCallToken(bad, 'transfer', NOW), String(bad).slice(0, 20)).toBeNull()
    }
  })

  it('rejects an authentic signature over a non-JSON or incomplete payload', () => {
    expect(verifyCallToken(signRaw(b64url('not json')), 'transfer', NOW)).toBeNull()
    expect(verifyCallToken(signRaw(b64url(JSON.stringify({ c: CALL_ID, p: 'transfer' }))), 'transfer', NOW)).toBeNull()
    expect(verifyCallToken(signRaw(b64url(JSON.stringify({ c: 42, p: 'transfer', e: Math.floor(NOW / 1000) + 60 }))), 'transfer', NOW)).toBeNull()
    expect(verifyCallToken(signRaw(b64url(JSON.stringify({ c: CALL_ID, p: 'transfer', e: '9999999999' }))), 'transfer', NOW)).toBeNull()
  })

  it('rejects a non-UUID call id even when correctly signed', () => {
    for (const id of ['not-a-uuid', '12345', 'CA0123456789abcdef0123456789abcdef', `${CALL_ID}x`, "' or 1=1 --"]) {
      expect(verifyCallToken(signCallToken(id, 'transfer', 300, NOW), 'transfer', NOW), id).toBeNull()
    }
  })

  describe('without a usable secret', () => {
    it('sign throws and verify returns null when VOICE_TOKEN_SECRET is missing', () => {
      const token = signCallToken(CALL_ID, 'transfer', 300, NOW)
      vi.stubEnv('VOICE_TOKEN_SECRET', '')
      expect(() => signCallToken(CALL_ID, 'transfer', 300, NOW)).toThrow(/VOICE_TOKEN_SECRET/)
      expect(verifyCallToken(token, 'transfer', NOW)).toBeNull()
    })

    it('treats a secret shorter than 32 chars as missing', () => {
      vi.stubEnv('VOICE_TOKEN_SECRET', 'too-short-secret')
      expect(() => signCallToken(CALL_ID, 'transfer', 300, NOW)).toThrow()
      const body = b64url(JSON.stringify({ c: CALL_ID, p: 'transfer', e: Math.floor(NOW / 1000) + 300 }))
      expect(verifyCallToken(signRaw(body, 'too-short-secret'), 'transfer', NOW)).toBeNull()
    })

    it('treats a placeholder secret as missing', () => {
      vi.stubEnv('VOICE_TOKEN_SECRET', 'your-voice-token-secret-goes-here-please')
      expect(() => signCallToken(CALL_ID, 'transfer', 300, NOW)).toThrow()
    })
  })

  it('a rotated secret invalidates existing tokens', () => {
    const token = signCallToken(CALL_ID, 'transfer', 300, NOW)
    vi.stubEnv('VOICE_TOKEN_SECRET', 'rotated-secret-0123456789abcdef-rotated')
    expect(verifyCallToken(token, 'transfer', NOW)).toBeNull()
  })
})
