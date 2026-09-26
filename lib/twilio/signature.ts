import 'server-only'
import type { NextRequest } from 'next/server'
import twilio from 'twilio'
import { ApiError, readBodyText } from '@/lib/api/http'
import { appUrl, env, isTwilioConfigured } from '@/lib/env'

// Twilio signs the exact public URL it was configured with plus the POSTed
// form fields. Behind Vercel the request URL the route sees can differ (host,
// protocol), so the URL is rebuilt from appUrl(), which must equal the base
// used when the number's webhooks were configured.

/** Twilio webhook forms are a few KB; anything larger isn't from Twilio. */
const MAX_TWILIO_FORM_BYTES = 256 * 1024

export const TWILIO_SIGNATURE_HEADER = 'x-twilio-signature'

/** The URL Twilio signed for this request: public base + path + query. */
export function twilioSignedUrl(req: Request): string {
  const { pathname, search } = new URL(req.url)
  return `${appUrl()}${pathname}${search}`
}

export async function readVerifiedTwilioForm(req: NextRequest): Promise<Record<string, string>> {
  const authToken = env.TWILIO_AUTH_TOKEN
  if (!isTwilioConfigured() || !authToken) {
    throw new ApiError(503, 'not_configured', 'Telephony is not configured.')
  }

  // The body stream can only be read once, so the same parsed params feed
  // both the signature check and the caller.
  const raw = await readBodyText(req, MAX_TWILIO_FORM_BYTES)
  const search = new URLSearchParams(raw)
  const form: Record<string, string> = {}
  const signed: Record<string, string | string[]> = {}
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key)
    form[key] = values[0]
    // Repeated keys are signed as a sorted list; pass them all to the validator.
    signed[key] = values.length > 1 ? values : values[0]
  }

  const signature = req.headers.get(TWILIO_SIGNATURE_HEADER)
  const url = twilioSignedUrl(req)
  if (!signature || !twilio.validateRequest(authToken, signature, url, signed)) {
    // The usual cause in practice is NEXT_PUBLIC_APP_URL not matching the
    // webhook URL on the number, so log the URL we checked (no secrets in it).
    console.warn('[telephony] rejected Twilio request with', signature ? 'an invalid' : 'no', 'signature for', url)
    throw new ApiError(403, 'invalid_signature', 'Invalid Twilio signature.')
  }
  return form
}
