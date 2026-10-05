import 'server-only'
// Parsing + signature validation for Twilio webhooks (voice, status, dial
// action, refer). Twilio signs HMAC-SHA1 over the exact public URL it called
// plus the sorted POST params; behind Vercel the URL is rebuilt from the
// configured public base so a proxy hop can't break validation.

import twilio from 'twilio'
import { publicBaseUrl, allowUnsignedWebhooks } from '@/lib/voice-providers/config'
import { emitProviderEvent } from '@/lib/observability/telemetry'

const MAX_FORM_BYTES = 64 * 1024

export interface TwilioRequest {
  params: Record<string, string>
  url: string
  /** Signature verified (false only in local dev with ALLOW_UNSIGNED_WEBHOOKS). */
  verified: boolean
}

export class TwilioRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'TwilioRequestError'
  }
}

export function publicUrlFor(request: Request): string {
  const u = new URL(request.url)
  const base = publicBaseUrl()
  return base ? `${base}${u.pathname}${u.search}` : u.toString()
}

export async function readTwilioRequest(request: Request): Promise<TwilioRequest> {
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase()
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    throw new TwilioRequestError(415, 'unsupported content type')
  }
  const raw = await request.text()
  if (raw.length > MAX_FORM_BYTES) throw new TwilioRequestError(413, 'payload too large')
  const params: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v

  const url = publicUrlFor(request)
  const signature = request.headers.get('x-twilio-signature') ?? ''
  const token = (process.env.TWILIO_AUTH_TOKEN ?? '').trim()
  const valid = !!token && !!signature && twilio.validateRequest(token, signature, url, params)
  if (!valid) {
    if (allowUnsignedWebhooks()) return { params, url, verified: false }
    emitProviderEvent({
      system: 'twilio',
      kind: 'webhook_verification_failed',
      ok: false,
      details: { path: new URL(request.url).pathname, hasSignature: !!signature },
    })
    throw new TwilioRequestError(403, 'invalid signature')
  }
  return { params, url, verified: true }
}
