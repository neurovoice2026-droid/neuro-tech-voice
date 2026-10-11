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
// account. Per-client and per-address limits apply before the account lookup
// for the same reason; the overall caps apply after it, so only real sends
// count against them. The address and the token never appear in a log line.

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { isConfigured as emailConfigured, sendEmail } from '@/lib/email/client'
import { passwordResetEmail } from '@/lib/email/templates'
import { RATE_LIMITS, rateLimit, type RateLimitRule } from '@/lib/security/rate-limit'
import type { Logger } from '@/lib/observability/logger'

export type PasswordResetOutcome =
  /** An email went out, or the address has no account (indistinguishable to the user). */
  | { status: 'sent' }
  /** This address or this client asked too often; `wait` says how long to tell the user. */
  | { status: 'rate_limited'; wait: 'minute' | 'later' }
  /**
   * The app did not mint a token (email not configured, overall cap reached,
   * link generation failed): the caller may fall back to Supabase's own email.
   */
  | { status: 'unavailable' }
  /**
   * A token was minted but the email did not go out. No fallback: Supabase
   * refuses another recovery email for this user within a minute anyway.
   */
  | { status: 'send_failed' }

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
    void err // A malformed setting means no usable link; the caller logs it and falls back.
    return null
  }
}

/** Counts one hit per rule in order and stops at the first denial, so later buckets are untouched. */
async function firstDenied(rules: Array<[RateLimitRule, string]>): Promise<RateLimitRule | null> {
  for (const [rule, subject] of rules) {
    if (!(await rateLimit(rule, subject)).allowed) return rule
  }
  return null
}

export async function requestPasswordResetEmail(
  email: string,
  opts: { ipKey: string | null; log: Logger },
): Promise<PasswordResetOutcome> {
  const { log } = opts
  const baseUrl = appBaseUrl()
  if (!emailConfigured() || !baseUrl) {
    log.warn('auth.password_reset.not_configured', { email_configured: emailConfigured(), base_url: !!baseUrl })
    return { status: 'unavailable' }
  }

  // The client first: one over its limit stops here, before it can count against an address.
  const key = emailKey(email)
  const denied = await firstDenied([
    ...(opts.ipKey ? [[RATE_LIMITS.passwordResetIp, opts.ipKey] as [RateLimitRule, string]] : []),
    [RATE_LIMITS.passwordResetEmail, key],
    [RATE_LIMITS.passwordResetEmailHourly, key],
  ])
  if (denied) {
    log.info('auth.password_reset.rate_limited', { rule: denied.name })
    return { status: 'rate_limited', wait: denied.name === RATE_LIMITS.passwordResetEmail.name ? 'minute' : 'later' }
  }

  // No account (or one being deleted): nothing to send, same answer. Looked up before the overall
  // caps so made-up addresses cannot use them up. If the lookup fails, generateLink decides below.
  const db = createAdminClient()
  const { data: canReset, error: lookupError } = await db.rpc('auth_account_can_reset', { p_email: email.trim() })
  if (lookupError) log.warn('auth.password_reset.lookup_failed', { code: lookupError.code ?? null })
  else if (canReset === false) {
    log.info('auth.password_reset.no_account')
    return { status: 'sent' }
  }

  // Overall caps keep the Resend quota shared with billing and notification email; past them
  // the caller falls back to Supabase's own mailer (no token has been minted yet).
  const capped = await firstDenied([
    [RATE_LIMITS.passwordResetGlobalHourly, 'all'],
    [RATE_LIMITS.passwordResetGlobalDaily, 'all'],
  ])
  if (capped) {
    log.warn('auth.password_reset.global_cap', { rule: capped.name })
    return { status: 'unavailable' }
  }

  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email: email.trim() })
  if (error) {
    // No such account: say nothing different (no account enumeration).
    if (error.status === 404 || error.code === 'user_not_found') {
      log.info('auth.password_reset.no_account')
      return { status: 'sent' }
    }
    log.error('auth.password_reset.link_failed', error, { code: error.code ?? null, status: error.status ?? null })
    return { status: 'unavailable' }
  }
  const tokenHash = data.properties?.hashed_token
  if (!tokenHash) {
    log.error('auth.password_reset.link_failed', new Error('generateLink returned no token hash'))
    return { status: 'send_failed' }
  }

  const content = passwordResetEmail({ link: resetConfirmUrl(baseUrl, tokenHash) })
  const sent = await sendEmail({ to: email.trim(), subject: content.subject, html: content.html })
  if (!sent) {
    log.warn('auth.password_reset.send_failed')
    return { status: 'send_failed' }
  }
  log.info('auth.password_reset.sent')
  return { status: 'sent' }
}
