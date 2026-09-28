import 'server-only'
import { appUrl } from '@/lib/env'

// Public webhook URLs handed to Twilio. They are always built from appUrl():
// Twilio signs the exact URL it calls, and readVerifiedTwilioForm rebuilds the
// URL from the same base, so any other host (a preview URL, the request host)
// would make every signature check fail.

export type TelephonyWebhook =
  | 'inbound'
  | 'outbound'
  | 'fallback'
  | 'status'
  | 'stream-ended'
  | 'stream-status'
  | 'transfer-status'
  | 'recording'
  | 'sms'

export function telephonyUrl(hook: TelephonyWebhook, query?: Record<string, string | null | undefined>): string {
  const base = `${appUrl()}/api/telephony/${hook}`
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== '') params.set(key, value)
  }
  const search = params.toString()
  return search ? `${base}?${search}` : base
}

/** The four URLs a number owned by the app router must carry. */
export function numberWebhookUrls(): { voiceUrl: string; voiceFallbackUrl: string; statusCallback: string; smsUrl: string } {
  return {
    voiceUrl: telephonyUrl('inbound'),
    voiceFallbackUrl: telephonyUrl('fallback'),
    statusCallback: telephonyUrl('status'),
    smsUrl: telephonyUrl('sms'),
  }
}
