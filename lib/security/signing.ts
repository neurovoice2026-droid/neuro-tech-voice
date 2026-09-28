import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  INTERNAL_SIGNATURE_HEADER,
  INTERNAL_SIGNATURE_TOLERANCE_SECONDS,
  VOICE_PIPELINE_MODES,
  type SessionTokenPayload,
} from '@/lib/voice/contracts'
import { ApiError, readBodyText } from '@/lib/api/http'
import { env, MIN_GATEWAY_SECRET_LENGTH } from '@/lib/env'

// App ↔ gateway authentication. Two primitives, both HMAC-SHA256 with
// VOICE_GATEWAY_SECRET:
// - request signatures: header `t=<unix>,v1=<hex>` over `${t}.${rawBody}`
// - session tokens: `base64url(JSON).base64url(HMAC(first part))`
// services/voice-gateway/src/signing.ts implements the same algorithm and runs
// the vectors from signing.vectors.ts, so change both together or neither.

/** Internal bodies carry full transcripts; anything bigger is not from the gateway. */
export const MAX_INTERNAL_BODY_BYTES = 2 * 1024 * 1024

/** Longest session token accepted; real ones stay under 450 chars (Twilio <Parameter> cap). */
const MAX_SESSION_TOKEN_LENGTH = 1024

/** Constant-time string comparison that doesn't throw on length mismatch. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) {
    // Burn comparable time anyway; only the length (public for hex/base64 MACs) leaks.
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

/** Headers for a signed internal request (app → gateway direction). */
export function internalSignatureHeaders(rawBody: string, secret: string, nowSeconds?: number): Record<string, string> {
  return { [INTERNAL_SIGNATURE_HEADER]: signInternalBody(rawBody, secret, nowSeconds) }
}

export function verifyInternalSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  nowSeconds?: number
): boolean {
  if (!header || !secret || header.length > 1024) return false

  let timestamp: string | null = null
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 't') timestamp = value
    // Several v1 entries are allowed so a secret rotation can sign with both.
    else if (key === 'v1') signatures.push(value)
  }
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || signatures.length === 0) return false

  const t = Number(timestamp)
  const now = Math.floor(nowSeconds ?? nowUnix())
  if (Math.abs(now - t) > INTERNAL_SIGNATURE_TOLERANCE_SECONDS) return false

  const expected = hmacHex(secret, `${t}.${rawBody}`)
  let valid = false
  // Compare against every candidate so timing doesn't reveal which one matched.
  for (const signature of signatures) {
    if (timingSafeEqualString(signature.toLowerCase(), expected)) valid = true
  }
  return valid
}

// ─── Session tokens ──────────────────────────────────────────────────────────

function base64UrlEncode(input: string | Buffer): string {
  return (typeof input === 'string' ? Buffer.from(input, 'utf8') : input).toString('base64url')
}

function tokenMac(encodedPayload: string, secret: string): string {
  return base64UrlEncode(createHmac('sha256', secret).update(encodedPayload, 'utf8').digest())
}

/** Fixed key order keeps tokens byte-identical to the gateway's and drops unknown fields. */
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

export function signSessionToken(payload: SessionTokenPayload, secret: string): string {
  if (!secret) throw new Error('signSessionToken requires a secret')
  const encoded = base64UrlEncode(JSON.stringify(canonicalPayload(payload)))
  return `${encoded}.${tokenMac(encoded, secret)}`
}

const BASE64URL = /^[A-Za-z0-9_-]+$/

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
}

export function verifySessionToken(
  token: string,
  secret: string,
  nowSeconds?: number
): SessionTokenPayload | null {
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

/**
 * Reads the raw body of a gateway → app request and verifies its signature.
 * Returns the raw text so the route can JSON.parse + zod-validate exactly the
 * bytes that were signed.
 */
export async function readVerifiedInternalBody(req: Request): Promise<string> {
  const secret = env.VOICE_GATEWAY_SECRET
  // Same bar as isGatewayConfigured(): a short secret would make signatures
  // guessable, so it is refused here too instead of being accepted quietly.
  if (!secret || secret.length < MIN_GATEWAY_SECRET_LENGTH) {
    throw new ApiError(503, 'not_configured', 'The voice gateway is not configured.')
  }
  const rawBody = await readBodyText(req, MAX_INTERNAL_BODY_BYTES)
  if (!verifyInternalSignature(req.headers.get(INTERNAL_SIGNATURE_HEADER), rawBody, secret)) {
    throw new ApiError(401, 'bad_signature', 'Invalid or expired signature.')
  }
  return rawBody
}
