import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { env } from '@/lib/env'

// Encryption at rest for long-lived third-party credentials (Google refresh
// tokens). AES-256-GCM, fresh 12-byte IV per value, 16-byte auth tag.
// Format: 'v1.<iv>.<tag>.<ciphertext>', every part base64url. The version
// prefix leaves room for key rotation without guessing at old rows.

const VERSION = 'v1'
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

let cachedKey: { raw: string; key: Buffer | null } | null = null

function encryptionKey(): Buffer | null {
  const raw = env.TOKEN_ENCRYPTION_KEY
  if (!raw) return null
  if (cachedKey?.raw === raw) return cachedKey.key
  let key: Buffer | null = null
  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(raw)) {
    const decoded = Buffer.from(raw, 'base64')
    key = decoded.length === KEY_BYTES ? decoded : null
  }
  cachedKey = { raw, key }
  return key
}

function requireKey(): Buffer {
  const key = encryptionKey()
  if (!key) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is missing or invalid: it must be 32 random bytes encoded as base64 (openssl rand -base64 32)'
    )
  }
  return key
}

export function isEncryptionConfigured(): boolean {
  return encryptionKey() !== null
}

export function encryptSecret(plain: string): string {
  const key = requireKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES })
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptSecret(encoded: string): string {
  const key = requireKey()
  const parts = typeof encoded === 'string' ? encoded.split('.') : []
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Encrypted secret has an unknown format')
  }
  const iv = Buffer.from(parts[1], 'base64url')
  const tag = Buffer.from(parts[2], 'base64url')
  const ciphertext = Buffer.from(parts[3], 'base64url')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Encrypted secret has an unknown format')
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES })
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    // Don't surface OpenSSL internals; a wrong key and tampering look the same.
    throw new Error('Encrypted secret could not be decrypted (wrong key or corrupted value)')
  }
}

export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex')
}

/** URL-safe random token; 32 bytes by default (256 bits). */
export function randomToken(bytes = 32): string {
  if (!Number.isInteger(bytes) || bytes < 1 || bytes > 1024) {
    throw new Error('randomToken bytes must be an integer between 1 and 1024')
  }
  return randomBytes(bytes).toString('base64url')
}
