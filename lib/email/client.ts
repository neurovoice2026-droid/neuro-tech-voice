// ─── Resend email client ─────────────────────────────────────────────────────
// Transactional email via the Resend REST API (no SDK dependency — same raw
// fetch style as the ElevenLabs/SmartBill clients). All sends are best-effort:
// callers should not let an email failure break the main flow.

const ENDPOINT = 'https://api.resend.com/emails'
const TIMEOUT_MS = 10_000

/** True when a real Resend API key + from address are configured. */
export function isConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!fromAddress()
}

function fromAddress(): string {
  // e.g. "Neuro Tech Voice <noreply@yourdomain.com>"
  return process.env.RESEND_FROM_EMAIL ?? ''
}

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

/**
 * Send a transactional email. Returns true on success, false otherwise.
 * Never throws — logs and swallows errors so it is safe to call from webhooks.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  if (!isConfigured()) return false
  if (!params.to || (Array.isArray(params.to) && params.to.length === 0)) return false

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    })

    if (!res.ok) {
      // Only Resend's error type is logged: its message can quote the recipient address.
      const body = (await res.json().catch(() => null)) as { name?: unknown } | null
      console.error(`Resend send failed (${res.status}${typeof body?.name === 'string' ? `, ${body.name}` : ''})`)
      return false
    }
    return true
  } catch (err) {
    console.error('Resend send error:', err instanceof DOMException && err.name === 'TimeoutError' ? 'timeout' : err instanceof Error ? err.name : 'unknown')
    return false
  }
}
