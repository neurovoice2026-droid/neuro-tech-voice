import 'server-only'
// Password-reset emails sent by the app instead of Supabase's own template.
//
// The service role generates a recovery link (auth.admin.generateLink, which
// sends nothing) and the app emails its own /reset-password/confirm link with
// the link's token hash. That page verifies the token only when the user
// presses Continue, so the link works on any device and mail scanners that
// open links cannot spend it, without editing Supabase's email templates.
//
// The caller tells the user the same thing whether or not the address has an
// account. Limits apply before the account lookup for the same reason. The
// address and the token never appear in a log line.

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { isConfigured as emailConfigured, sendEmail } from '@/lib/email/client'
import { passwordResetEmail } from '@/lib/email/templates'
import { RATE_LIMITS, rateLimit } from '@/lib/security/rate-limit'
import type { Logger } from '@/lib/observability/logger'

export type PasswordResetOutcome =
  /** An email went out, or the address has no account (indistinguishable to the user). */
  | 'sent'
  /** Too many requests for this address or from this client. */
  | 'rate_limited'
  /** The app cannot send it (email not configured, link or send failed): the caller may fall back. */
  | 'unavailable'

/** The page the emailed link opens; it carries the one-time token hash. */
export function resetConfirmUrl(baseUrl: string, tokenHash: string): string {
  const url = new URL('/reset-password/confirm', baseUrl)
  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('type', 'recovery')
  return url.toString()
}

function emailKey(email: string): string {
  return crypto.createHash('sha256').update(`reset:${email.trim().toLowerCase()}`).digest('hex').slice(0, 32)
}

function appBaseUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim()
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch (err) {
    void err // A malformed setting means no usable link; the caller falls back.
    return null
  }
}

export async function requestPasswordResetEmail(
  email: string,
  opts: { ipKey: string | null; log: Logger },
): Promise<PasswordResetOutcome> {
  const { log } = opts
  const baseUrl = appBaseUrl()
  if (!emailConfigured() || !baseUrl) {
    log.warn('auth.password_reset.not_configured', { email_configured: emailConfigured(), base_url: !!baseUrl })
    return 'unavailable'
  }

  const key = emailKey(email)
  for (const [rule, subject] of [
    [RATE_LIMITS.passwordResetEmail, key],
    [RATE_LIMITS.passwordResetEmailHourly, key],
    ...(opts.ipKey ? [[RATE_LIMITS.passwordResetIp, opts.ipKey] as const] : []),
  ] as const) {
    const res = await rateLimit(rule, subject)
    if (!res.allowed) {
      log.info('auth.password_reset.rate_limited', { rule: rule.name })
      return 'rate_limited'
    }
  }

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'recovery', email: email.trim() })
  if (error) {
    // No such account: say nothing different (no account enumeration).
    if (error.status === 404 || error.code === 'user_not_found') {
      log.info('auth.password_reset.no_account')
      return 'sent'
    }
    log.error('auth.password_reset.link_failed', error, { code: error.code ?? null, status: error.status ?? null })
    return 'unavailable'
  }
  const tokenHash = data.properties?.hashed_token
  if (!tokenHash) {
    log.error('auth.password_reset.link_failed', new Error('generateLink returned no token hash'))
    return 'unavailable'
  }

  const content = passwordResetEmail({ link: resetConfirmUrl(baseUrl, tokenHash) })
  const sent = await sendEmail({ to: email.trim(), subject: content.subject, html: content.html })
  if (!sent) {
    log.warn('auth.password_reset.send_failed')
    return 'unavailable'
  }
  log.info('auth.password_reset.sent')
  return 'sent'
}
