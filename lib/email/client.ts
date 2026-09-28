import 'server-only'
import { env, isResendConfigured } from '@/lib/env'

// ─── Resend email client ─────────────────────────────────────────────────────
// Transactional email via the Resend REST API (no SDK dependency — same raw
// fetch style as the ElevenLabs/SmartBill clients). All sends are best-effort:
// callers should not let an email failure break the main flow, which is why
// sendEmail reports failure as `false` (and logs it) instead of throwing.

const ENDPOINT = 'https://api.resend.com/emails'
const SEND_TIMEOUT_MS = 10_000

/** True when a real Resend API key + from address are configured. */
export function isConfigured(): boolean {
  return isResendConfigured()
}

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  /** Plain-text part for clients that don't show HTML (and fewer spam flags). */
  text?: string
  replyTo?: string
}

/**
 * Send a transactional email. Returns true on success, false otherwise.
 * Never throws — logs failures so it is safe to call from webhooks and cron.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  if (!isResendConfigured()) {
    // No subject in the log: subjects can carry phone numbers or caller names.
    console.warn('[email] not sent: RESEND_API_KEY / RESEND_FROM_EMAIL are not configured')
    return false
  }
  const recipients = (Array.isArray(params.to) ? params.to : [params.to]).filter((to) => !!to && to.includes('@'))
  if (recipients.length === 0) return false

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: recipients,
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })

    if (!res.ok) {
      // Resend error bodies are short JSON ({ name, message }); keep only the message.
      const body = await res.text().catch(() => '')
      let message = ''
      try {
        message = String((JSON.parse(body) as { message?: unknown }).message ?? '')
      } catch {
        message = body
      }
      console.error('[email] Resend send failed', res.status, message.slice(0, 200))
      return false
    }
    return true
  } catch (err) {
    console.error('[email] Resend send error', err instanceof Error ? err.message : err)
    return false
  }
}
