import 'server-only'
// Envelope encryption of store credentials (commerce_connections.encrypted_credentials).
//
// AES-256-GCM with a random 96-bit IV per record and the connection's
// identity as additional authenticated data, so a ciphertext copied onto
// another connection row does not decrypt. The key comes from
// COMMERCE_CREDENTIALS_ENCRYPTION_KEY (base64, exactly 32 bytes); the
// envelope records the key version (COMMERCE_CREDENTIALS_KEY_VERSION, default
// 1) and a previous key (COMMERCE_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS, version
// - 1) is accepted for reads during a rotation. Misconfiguration fails
// closed: nothing is ever stored in the clear, and nothing decrypts.

import crypto from 'crypto'

export const ENVELOPE_VERSION = 1 as const

/** What is stored in the database: no plaintext, no key. */
export interface CredentialEnvelope {
  v: typeof ENVELOPE_VERSION
  /** Key version the record was encrypted with. */
  k: number
  iv: string
  ct: string
  tag: string
}

export class CommerceCryptoError extends Error {
  constructor(
    readonly code: 'not_configured' | 'invalid_key' | 'unknown_key_version' | 'malformed' | 'auth_failed',
    message: string,
  ) {
    super(message)
    this.name = 'CommerceCryptoError'
  }
}

const KEY_BYTES = 32
const IV_BYTES = 12
const MAX_PLAINTEXT_BYTES = 64 * 1024

function parseKey(name: string, raw: string | undefined): Buffer | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  let key: Buffer
  try {
    key = Buffer.from(value, 'base64')
  } catch (err) {
    throw new CommerceCryptoError('invalid_key', `${name} is not valid base64: ${err instanceof Error ? err.message : 'decode failed'}`)
  }
  // Buffer.from(base64) silently drops invalid characters: re-encode to catch garbage.
  if (key.length !== KEY_BYTES || key.toString('base64').replace(/=+$/, '') !== value.replace(/=+$/, '')) {
    throw new CommerceCryptoError('invalid_key', `${name} must be exactly ${KEY_BYTES} random bytes encoded as base64`)
  }
  return key
}

export function currentKeyVersion(): number {
  const raw = (process.env.COMMERCE_CREDENTIALS_KEY_VERSION ?? '').trim()
  if (!raw) return 1
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) throw new CommerceCryptoError('invalid_key', 'COMMERCE_CREDENTIALS_KEY_VERSION must be a positive integer')
  return n
}

/** The key of `version`: the current one, or the previous one during a rotation. Throws when not configured. */
function keyForVersion(version: number): Buffer {
  const current = parseKey('COMMERCE_CREDENTIALS_ENCRYPTION_KEY', process.env.COMMERCE_CREDENTIALS_ENCRYPTION_KEY)
  if (!current) throw new CommerceCryptoError('not_configured', 'COMMERCE_CREDENTIALS_ENCRYPTION_KEY is not configured')
  const currentVersion = currentKeyVersion()
  if (version === currentVersion) return current
  if (version === currentVersion - 1) {
    const previous = parseKey('COMMERCE_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS', process.env.COMMERCE_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS)
    if (previous) return previous
  }
  throw new CommerceCryptoError('unknown_key_version', `no key for credential key version ${version}`)
}

/** True when encryption can be used (key present and well-formed). Never throws. */
export function commerceCryptoConfigured(): boolean {
  try {
    keyForVersion(currentKeyVersion())
    return true
  } catch (err) {
    if (err instanceof CommerceCryptoError) return false
    throw err
  }
}

/** The AAD binds a ciphertext to one connection of one organization. */
export function credentialAad(orgId: string, connectionId: string): string {
  return `ntv-commerce:${orgId}:${connectionId}`
}

export function encryptCredentials(plain: Record<string, unknown>, aad: string): CredentialEnvelope {
  const version = currentKeyVersion()
  const key = keyForVersion(version)
  const text = Buffer.from(JSON.stringify(plain), 'utf8')
  if (text.length > MAX_PLAINTEXT_BYTES) throw new CommerceCryptoError('malformed', 'credentials are too large')
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ct = Buffer.concat([cipher.update(text), cipher.final()])
  const tag = cipher.getAuthTag()
  return { v: ENVELOPE_VERSION, k: version, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: tag.toString('base64') }
}

export function isCredentialEnvelope(raw: unknown): raw is CredentialEnvelope {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const r = raw as Record<string, unknown>
  return r.v === ENVELOPE_VERSION && Number.isInteger(r.k) && typeof r.iv === 'string' && typeof r.ct === 'string' && typeof r.tag === 'string'
}

export function decryptCredentials<T extends Record<string, unknown> = Record<string, unknown>>(envelope: unknown, aad: string): T {
  if (!isCredentialEnvelope(envelope)) throw new CommerceCryptoError('malformed', 'stored credentials are not a valid envelope')
  const key = keyForVersion(envelope.k)
  const iv = Buffer.from(envelope.iv, 'base64')
  const tag = Buffer.from(envelope.tag, 'base64')
  if (iv.length !== IV_BYTES || tag.length !== 16) throw new CommerceCryptoError('malformed', 'stored credentials are not a valid envelope')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(tag)
  let text: Buffer
  try {
    text = Buffer.concat([decipher.update(Buffer.from(envelope.ct, 'base64')), decipher.final()])
  } catch (err) {
    throw new CommerceCryptoError('auth_failed', `stored credentials could not be decrypted: ${err instanceof Error ? err.message : 'authentication failed'}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text.toString('utf8'))
  } catch (err) {
    throw new CommerceCryptoError('malformed', `stored credentials are not valid JSON: ${err instanceof Error ? err.message : 'parse failed'}`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new CommerceCryptoError('malformed', 'stored credentials are not an object')
  return parsed as T
}

/** A fresh random token (webhook public ids, webhook secrets, OAuth state). */
export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url')
}
