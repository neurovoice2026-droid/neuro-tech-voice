import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { signInternalBody, signSessionToken, timingSafeEqualString, verifyInternalSignature, verifySessionToken } from '../src/signing'
import { INTERNAL_SIGNATURE_VECTORS, SESSION_TOKEN_VECTORS, SIGNING_VECTOR_SECRET } from './signing.vectors'

// The gateway must sign and verify byte-for-byte like lib/security/signing.ts.
// signing.vectors.ts is a verbatim copy of the app's file; the first test
// fails if the two copies drift.

const here = path.dirname(fileURLToPath(import.meta.url))

describe('shared signing vectors', () => {
  it('is a verbatim copy of lib/security/signing.vectors.ts', () => {
    const app = readFileSync(path.resolve(here, '../../../lib/security/signing.vectors.ts'), 'utf8')
    const gateway = readFileSync(path.resolve(here, 'signing.vectors.ts'), 'utf8')
    expect(gateway.replace(/\r\n/g, '\n')).toBe(app.replace(/\r\n/g, '\n'))
  })

  for (const vector of INTERNAL_SIGNATURE_VECTORS) {
    it(`signs internal bodies: ${vector.name}`, () => {
      expect(signInternalBody(vector.rawBody, vector.secret, vector.timestamp)).toBe(vector.header)
      expect(verifyInternalSignature(vector.header, vector.rawBody, vector.secret, vector.timestamp + 10)).toBe(true)
    })
  }

  for (const vector of SESSION_TOKEN_VECTORS) {
    it(`mints and verifies session tokens: ${vector.name}`, () => {
      expect(signSessionToken(vector.payload, vector.secret)).toBe(vector.token)
      expect(verifySessionToken(vector.token, vector.secret, vector.validAt)).toEqual(vector.payload)
    })
  }
})

describe('internal signature verification', () => {
  const [vector] = INTERNAL_SIGNATURE_VECTORS

  it('rejects a tampered body, a wrong secret, and stale or future timestamps', () => {
    expect(verifyInternalSignature(vector.header, `${vector.rawBody} `, vector.secret, vector.timestamp)).toBe(false)
    expect(verifyInternalSignature(vector.header, vector.rawBody, `${vector.secret}x`, vector.timestamp)).toBe(false)
    expect(verifyInternalSignature(vector.header, vector.rawBody, vector.secret, vector.timestamp + 301)).toBe(false)
    expect(verifyInternalSignature(vector.header, vector.rawBody, vector.secret, vector.timestamp - 301)).toBe(false)
  })

  it('accepts any matching v1 entry (secret rotation) and ignores malformed headers', () => {
    const rotated = `${vector.header},v1=${'0'.repeat(64)}`
    expect(verifyInternalSignature(rotated, vector.rawBody, vector.secret, vector.timestamp)).toBe(true)
    expect(verifyInternalSignature(null, vector.rawBody, vector.secret, vector.timestamp)).toBe(false)
    expect(verifyInternalSignature('garbage', vector.rawBody, vector.secret, vector.timestamp)).toBe(false)
    expect(verifyInternalSignature('t=abc,v1=00', vector.rawBody, vector.secret, vector.timestamp)).toBe(false)
    expect(verifyInternalSignature(vector.header, vector.rawBody, '', vector.timestamp)).toBe(false)
  })
})

describe('session tokens', () => {
  const [vector] = SESSION_TOKEN_VECTORS

  it('rejects expired, tampered and wrong-secret tokens', () => {
    expect(verifySessionToken(vector.token, vector.secret, vector.payload.exp)).toBeNull()
    const [body, mac] = vector.token.split('.')
    expect(verifySessionToken(`${body}x.${mac}`, vector.secret, vector.validAt)).toBeNull()
    expect(verifySessionToken(vector.token, 'another-secret-that-is-long-enough-0123456789', vector.validAt)).toBeNull()
    expect(verifySessionToken('a.b.c', SIGNING_VECTOR_SECRET, vector.validAt)).toBeNull()
    expect(verifySessionToken('x'.repeat(2000), SIGNING_VECTOR_SECRET, vector.validAt)).toBeNull()
  })

  it('rejects a well-signed payload with an unknown mode or channel', () => {
    const forged = Buffer.from(JSON.stringify({ ...vector.payload, mode: 'other' })).toString('base64url')
    const mac = createHmac('sha256', vector.secret).update(forged).digest().toString('base64url')
    expect(verifySessionToken(`${forged}.${mac}`, vector.secret, vector.validAt)).toBeNull()
  })

  it('compares strings in constant time without throwing on length mismatch', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true)
    expect(timingSafeEqualString('abc', 'abcd')).toBe(false)
  })
})
