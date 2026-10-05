import 'server-only'
// Short, signed, purpose-bound call tokens. They authenticate callbacks that
// carry no other credentials: the transfer tool the AI agent invokes, and the
// Twilio redirect/action URLs we embed in TwiML (Twilio also signs those
// requests; the token additionally binds them to one call and one purpose).
// Format: base64url(JSON payload).base64url(HMAC-SHA256(payload)).

import crypto from 'crypto'
import { voiceTokenSecret } from '@/lib/voice-providers/config'
import { parseJson } from '@/lib/util/json'

export type CallTokenPurpose = 'transfer' | 'stream_ended' | 'dial_complete' | 'refer' | 'outbound_connect'

interface Payload {
  c: string // calls.id
  p: CallTokenPurpose
  e: number // expiry, unix seconds
}

const b64url = (buf: Buffer) => buf.toString('base64url')

function secret(): string {
  const s = voiceTokenSecret()
  if (!s) throw new Error('VOICE_TOKEN_SECRET is not configured (min 32 chars)')
  return s
}

export function signCallToken(callId: string, purpose: CallTokenPurpose, ttlSeconds: number, now = Date.now()): string {
  const payload: Payload = { c: callId, p: purpose, e: Math.floor(now / 1000) + ttlSeconds }
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  const sig = b64url(crypto.createHmac('sha256', secret()).update(body).digest())
  return `${body}.${sig}`
}

/** Returns the call id when the token is authentic, unexpired and for `purpose`. */
export function verifyCallToken(token: string | null | undefined, purpose: CallTokenPurpose, now = Date.now()): string | null {
  if (!token || token.length > 512) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  // Without a secret nothing can be verified (validateVoiceConfig reports it).
  const key = voiceTokenSecret()
  if (!key) return null
  const expected = crypto.createHmac('sha256', key).update(body).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null
  const parsed = parseJson(Buffer.from(body, 'base64url').toString('utf8'))
  if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') return null
  const payload = parsed.value as Payload
  if (payload.p !== purpose || typeof payload.c !== 'string' || typeof payload.e !== 'number') return null
  if (payload.e < Math.floor(now / 1000)) return null
  return /^[0-9a-f-]{36}$/i.test(payload.c) ? payload.c : null
}
