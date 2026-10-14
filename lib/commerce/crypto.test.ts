import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { CommerceCryptoError, commerceCryptoConfigured, credentialAad, decryptCredentials, encryptCredentials, isCredentialEnvelope, randomToken } from './crypto'

const KEY = crypto.randomBytes(32).toString('base64')
const AAD = credentialAad('org-1', 'conn-1')

beforeEach(() => {
  vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY', KEY)
  vi.stubEnv('COMMERCE_CREDENTIALS_KEY_VERSION', '')
  vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('commerce credential envelope', () => {
  it('round-trips and stores nothing in the clear', () => {
    const plain = { consumer_key: 'ck_live_abc', consumer_secret: 'cs_live_xyz', webhook_secret: 'whs' }
    const env = encryptCredentials(plain, AAD)
    expect(env).toMatchObject({ v: 1, k: 1 })
    expect(isCredentialEnvelope(env)).toBe(true)
    const stored = JSON.stringify(env)
    expect(stored).not.toContain('ck_live_abc')
    expect(stored).not.toContain('cs_live_xyz')
    expect(decryptCredentials(env, AAD)).toEqual(plain)
    // A new IV every time.
    expect(encryptCredentials(plain, AAD).iv).not.toBe(env.iv)
  })

  it('fails closed without a key, and never falls back to plaintext', () => {
    vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY', '')
    expect(commerceCryptoConfigured()).toBe(false)
    expect(() => encryptCredentials({ a: 1 }, AAD)).toThrow(CommerceCryptoError)
    try {
      encryptCredentials({ a: 1 }, AAD)
    } catch (err) {
      expect((err as CommerceCryptoError).code).toBe('not_configured')
    }
  })

  it('rejects a key that is not 32 bytes of base64', () => {
    vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY', 'short')
    expect(commerceCryptoConfigured()).toBe(false)
    expect(() => encryptCredentials({ a: 1 }, AAD)).toThrow(/32 random bytes/)
    vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY', 'not*base64!'.padEnd(44, 'x'))
    expect(commerceCryptoConfigured()).toBe(false)
  })

  it('does not decrypt a ciphertext moved onto another connection (AAD), nor a tampered one', () => {
    const env = encryptCredentials({ token: 't' }, AAD)
    expect(() => decryptCredentials(env, credentialAad('org-1', 'conn-2'))).toThrow(CommerceCryptoError)
    const tampered = { ...env, ct: Buffer.from('xx').toString('base64') + env.ct.slice(4) }
    expect(() => decryptCredentials(tampered, AAD)).toThrow(/could not be decrypted/)
    expect(() => decryptCredentials({ v: 2, k: 1, iv: env.iv, ct: env.ct, tag: env.tag }, AAD)).toThrow(/valid envelope/)
    expect(() => decryptCredentials(null, AAD)).toThrow(/valid envelope/)
  })

  it('reads records of the previous key version during a rotation, nothing older', () => {
    const env = encryptCredentials({ token: 't' }, AAD)
    const next = crypto.randomBytes(32).toString('base64')
    vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY', next)
    vi.stubEnv('COMMERCE_CREDENTIALS_KEY_VERSION', '2')
    expect(() => decryptCredentials(env, AAD)).toThrow(/key version 1/)
    vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS', KEY)
    expect(decryptCredentials(env, AAD)).toEqual({ token: 't' })
    const fresh = encryptCredentials({ token: 't2' }, AAD)
    expect(fresh.k).toBe(2)
    vi.stubEnv('COMMERCE_CREDENTIALS_KEY_VERSION', '3')
    expect(() => decryptCredentials(env, AAD)).toThrow(/key version 1/)
  })

  it('mints url-safe random tokens', () => {
    const t = randomToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(randomToken()).not.toBe(t)
  })
})
