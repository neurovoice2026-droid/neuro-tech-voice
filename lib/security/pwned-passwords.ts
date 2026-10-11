import 'server-only'
// Leaked-password check against Have I Been Pwned's Pwned Passwords range API
// (https://haveibeenpwned.com/API/v3#PwnedPasswords), the same source Supabase's
// Pro-plan "leaked password protection" uses. k-anonymity: only the first 5
// hex characters of the password's SHA-1 leave the process; the match against
// the returned suffixes happens here. Add-Padding hides the response size.
//
// Fails open: when the service cannot answer, the caller lets the password
// through (the composition rules still apply) and a warning is logged. The
// password, its hash, the prefix and the suffix never appear in a log line.

import crypto from 'crypto'
import { createLogger, type Logger } from '@/lib/observability/logger'

export const PWNED_RANGE_URL = 'https://api.pwnedpasswords.com/range/'
/** An interactive form waits on this; the endpoint is edge-cached and normally answers in tens of ms. */
export const PWNED_TIMEOUT_MS = 2_500

export type PwnedPasswordResult =
  | { status: 'pwned'; count: number }
  | { status: 'clean' }
  | { status: 'unavailable'; reason: 'timeout' | 'network' | 'http' | 'bad_response'; httpStatus: number | null }

const LINE = /^([0-9A-F]{35}):(\d+)$/i

/**
 * How often `suffix` appears in a range response: 0 when absent or listed as a
 * padding entry (count 0); null when the body has no valid line at all.
 */
export function suffixCount(body: string, suffix: string): number | null {
  const wanted = suffix.toUpperCase()
  let valid = 0
  for (const raw of body.split('\n')) {
    const m = LINE.exec(raw.trim())
    if (!m) continue
    valid++
    if (m[1].toUpperCase() === wanted) return Number(m[2])
  }
  return valid > 0 ? 0 : null
}

export async function checkPwnedPassword(
  password: string,
  opts: { log?: Logger; timeoutMs?: number } = {},
): Promise<PwnedPasswordResult> {
  const log = opts.log ?? createLogger({ component: 'pwned_passwords' })
  const hash = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)
  const started = Date.now()

  const unavailable = (reason: 'timeout' | 'network' | 'http' | 'bad_response', httpStatus: number | null): PwnedPasswordResult => {
    log.warn('auth.pwned_check.unavailable', { reason, http_status: httpStatus, latency_ms: Date.now() - started })
    return { status: 'unavailable', reason, httpStatus }
  }

  let res: Response
  try {
    res = await fetch(PWNED_RANGE_URL + prefix, {
      method: 'GET',
      headers: { 'Add-Padding': 'true', 'User-Agent': 'neuro-tech-voice-password-check' },
      signal: AbortSignal.timeout(opts.timeoutMs ?? PWNED_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (err) {
    // The error is reduced to its kind: nothing from the request (the prefix is in the URL) is logged.
    return unavailable(err instanceof DOMException && err.name === 'TimeoutError' ? 'timeout' : 'network', null)
  }
  // An error body is never read or surfaced.
  if (!res.ok) return unavailable('http', res.status)

  let body: string
  try {
    body = await res.text()
  } catch (err) {
    return unavailable(err instanceof DOMException && err.name === 'TimeoutError' ? 'timeout' : 'network', res.status)
  }
  const count = suffixCount(body, suffix)
  if (count === null) return unavailable('bad_response', res.status)
  if (count > 0) {
    log.info('auth.pwned_check.match', { latency_ms: Date.now() - started })
    return { status: 'pwned', count }
  }
  return { status: 'clean' }
}
