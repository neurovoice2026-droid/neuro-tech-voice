import 'server-only'
import { sha256Hex } from '@/lib/security/crypto'
import { clientIpFromHeaders, peekRateLimit, RATE_LIMITS, rateLimit } from '@/lib/security/rate-limit'

// Rate limits for the auth server actions (RATE_LIMITS.auth: 10 per 10 min).
// Each action counts separately, per client IP and per account identifier, so
// a credential-stuffing run from many IPs still stops at the account, and a
// busy office behind one IP doesn't lock out a password reset after a few
// failed sign-ins.

export type AuthAction = 'sign_in' | 'sign_up' | 'password_reset' | 'password_update' | 'google'

export interface AuthThrottleSubject {
  /** Null skips the per-IP bucket, for a second check within the same attempt. */
  ip: string | null
  /** Normalised email. Hashed before it becomes part of a storage key. */
  email?: string | null
  userId?: string | null
}

function emailIdentifier(action: AuthAction, email: string): string {
  return `${action}:email:${sha256Hex(email).slice(0, 32)}`
}

/**
 * Sign-in counts an account's failed attempts only (RATE_LIMITS.authFailures):
 * true while the account still has attempts left. Checked before the password,
 * recorded after a failure, so the right password isn't refused because a
 * stranger tried a few wrong ones.
 */
export async function allowAccountSignIn(email: string): Promise<boolean> {
  const { ok } = await peekRateLimit(RATE_LIMITS.authFailures, emailIdentifier('sign_in', email))
  if (!ok) console.warn('[auth] rate limited', 'sign_in', 'account')
  return ok
}

export async function recordFailedSignIn(email: string): Promise<void> {
  await rateLimit(RATE_LIMITS.authFailures, emailIdentifier('sign_in', email))
}

/** Client IP from forwarded headers, the same way lib/security/rate-limit.ts reads a Request. */
export const ipFromHeaders = clientIpFromHeaders

/** True when the request may go ahead. Stops at the first exhausted bucket. */
export async function allowAuthAttempt(action: AuthAction, subject: AuthThrottleSubject): Promise<boolean> {
  const identifiers: string[] = []
  if (subject.ip !== null) identifiers.push(`${action}:ip:${subject.ip}`)
  if (subject.email) identifiers.push(emailIdentifier(action, subject.email))
  if (subject.userId) identifiers.push(`${action}:user:${subject.userId}`)

  for (const identifier of identifiers) {
    const result = await rateLimit(RATE_LIMITS.auth, identifier)
    if (!result.ok) {
      console.warn('[auth] rate limited', action, identifier.split(':')[1])
      return false
    }
  }
  return true
}
