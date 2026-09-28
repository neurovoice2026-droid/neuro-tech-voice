import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  INTERNAL_SIGNATURE_HEADER,
  INTERNAL_SIGNATURE_TOLERANCE_SECONDS,
  VOICE_PIPELINE_MODES,
  type SessionTokenPayload,
} from './contracts'

// Gateway side of app ↔ gateway authentication. Byte-for-byte the same
// algorithm as lib/security/signing.ts (test/signing.test.ts runs the shared
// vectors), so change both together or neither:
// - request signatures: header `t=<unix>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>`
// - session tokens: `base64url(JSON).base64url(HMAC-SHA256(first part))`,
//   JSON keys in the order v, sid, org, agt, ch, mode, exp

export { INTERNAL_SIGNATURE_HEADER }

const MAX_SESSION_TOKEN_LENGTH = 1024

export function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) {
    timingSafeEqual(left, left)
    return false
  }
  return timingSafeEqual(left, right)
}

function nowUnix(): number {
  return Math.floor(Date.now() / 1000)
}

function hmacHex(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data, 'utf8').digest('hex')
}

export function signInternalBody(rawBody: string, secret: string, nowSeconds?: number): string {
  const t = Math.floor(nowSeconds ?? nowUnix())
  return `t=${t},v1=${hmacHex(secret, `${t}.${rawBody}`)}`
}

export function verifyInternalSignature(header: string | null, rawBody: string, secret: string, nowSeconds?: number): boolean {
  if (!header || !secret || header.length > 1024) return false
  let timestamp: string | null = null
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 't') timestamp = value
    else if (key === 'v1') signatures.push(value)
  }
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || signatures.length === 0) return false
  const t = Number(timestamp)
  const now = Math.floor(nowSeconds ?? nowUnix())
  if (Math.abs(now - t) > INTERNAL_SIGNATURE_TOLERANCE_SECONDS) return false
  const expected = hmacHex(secret, `${t}.${rawBody}`)
  let valid = false
  for (const signature of signatures) {
    if (timingSafeEqualString(signature.toLowerCase(), expected)) valid = true
  }
  return valid
}

function tokenMac(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload, 'utf8').digest().toString('base64url')
}

function canonicalPayload(payload: SessionTokenPayload): SessionTokenPayload {
  return {
    v: payload.v,
    sid: payload.sid,
    org: payload.org,
    agt: payload.agt,
    ch: payload.ch,
    mode: payload.mode,
    exp: payload.exp,
  }
}

/** Only tests need to mint tokens here (the app mints real ones). */
export function signSessionToken(payload: SessionTokenPayload, secret: string): string {
  if (!secret) throw new Error('signSessionToken requires a secret')
  const encoded = Buffer.from(JSON.stringify(canonicalPayload(payload)), 'utf8').toString('base64url')
  return `${encoded}.${tokenMac(encoded, secret)}`
}

const BASE64URL = /^[A-Za-z0-9_-]+$/

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
}

export function verifySessionToken(token: string, secret: string, nowSeconds?: number): SessionTokenPayload | null {
  if (typeof token !== 'string' || !secret || token.length > MAX_SESSION_TOKEN_LENGTH) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [encoded, mac] = parts
  if (!BASE64URL.test(encoded) || !BASE64URL.test(mac)) return null
  // MAC first: never parse JSON an attacker controls.
  if (!timingSafeEqualString(mac, tokenMac(encoded, secret))) return null
  let data: unknown
  try {
    data = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const p = data as Record<string, unknown>
  if (p.v !== 1) return null
  if (!isNonEmptyString(p.sid) || !isNonEmptyString(p.org) || !isNonEmptyString(p.agt)) return null
  if (p.ch !== 'twilio' && p.ch !== 'browser') return null
  if (typeof p.mode !== 'string' || !(VOICE_PIPELINE_MODES as readonly string[]).includes(p.mode)) return null
  if (typeof p.exp !== 'number' || !Number.isInteger(p.exp)) return null
  const now = Math.floor(nowSeconds ?? nowUnix())
  if (p.exp <= now) return null
  return canonicalPayload(p as unknown as SessionTokenPayload)
}
