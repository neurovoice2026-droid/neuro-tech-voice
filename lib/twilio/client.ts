import 'server-only'
import twilio from 'twilio'

let _client: ReturnType<typeof twilio> | null = null

const PLACEHOLDERS = new Set(['', 'your-twilio-account-sid', 'your-twilio-auth-token'])

export function isTwilioConfigured(): boolean {
  return !PLACEHOLDERS.has((process.env.TWILIO_ACCOUNT_SID ?? '').trim()) && !PLACEHOLDERS.has((process.env.TWILIO_AUTH_TOKEN ?? '').trim())
}

/**
 * Twilio REST client with an explicit request timeout and the SDK's built-in
 * retry for 429s. Callers on the live-call path keep their own budget.
 */
export function getTwilioClient() {
  if (!_client) {
    if (!isTwilioConfigured()) throw new Error('Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)')
    _client = twilio(process.env.TWILIO_ACCOUNT_SID!.trim(), process.env.TWILIO_AUTH_TOKEN!.trim(), {
      timeout: 10_000,
      autoRetry: true,
      maxRetries: 2,
    })
  }
  return _client
}
