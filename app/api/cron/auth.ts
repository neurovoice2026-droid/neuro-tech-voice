import 'server-only'
import { ApiError } from '@/lib/api/http'
import { env } from '@/lib/env'
import { sha256Hex } from '@/lib/security/crypto'
import { timingSafeEqualString } from '@/lib/security/signing'
import { clientIp, enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'

// Bearer authentication for Vercel Cron and ops endpoints. Vercel sends
// `Authorization: Bearer <CRON_SECRET>` on every scheduled invocation.

/** Shorter secrets are guessable; Vercel's guide asks for at least 16 random characters. */
export const MIN_CRON_SECRET_LENGTH = 16

export type CronAuthResult = 'ok' | 'not_configured' | 'unauthorized'

/** Pure check. Hashing both sides first keeps the comparison constant-time regardless of token length. */
export function checkCronAuthorization(authorization: string | null, secret: string | null | undefined): CronAuthResult {
  const expected = secret?.trim()
  if (!expected || expected.length < MIN_CRON_SECRET_LENGTH) return 'not_configured'
  const match = /^Bearer +(\S+)$/i.exec(authorization?.trim() ?? '')
  if (!match) return 'unauthorized'
  return timingSafeEqualString(sha256Hex(match[1]), sha256Hex(expected)) ? 'ok' : 'unauthorized'
}

/** Throws 429 for hammering clients, 503 without a usable CRON_SECRET, 401 for a wrong token. */
export async function requireCronRequest(req: Request, scope: 'cron' | 'ops'): Promise<void> {
  await enforceRateLimit(RATE_LIMITS.publicWebhook, `${scope}:${clientIp(req)}`)
  const result = checkCronAuthorization(req.headers.get('authorization'), env.CRON_SECRET)
  if (result === 'not_configured') {
    throw new ApiError(503, 'not_configured', `CRON_SECRET is not set (or shorter than ${MIN_CRON_SECRET_LENGTH} characters).`)
  }
  if (result === 'unauthorized') {
    throw new ApiError(401, 'unauthorized', 'A valid bearer token is required.')
  }
}
