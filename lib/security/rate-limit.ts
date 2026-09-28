import 'server-only'
import { kvGet, kvIncr } from '@/lib/kv'
import { ApiError } from '@/lib/api/http'

// Fixed-window rate limits on top of kvIncr. The key embeds the window start,
// so each window is a fresh counter that expires on its own. Fixed windows
// allow up to 2× the limit across a boundary; that's fine for abuse and cost
// protection, which is all these limits are for.

export interface RateLimitPolicy {
  name: string
  limit: number
  windowSeconds: number
}

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const RATE_LIMITS: {
  auth: RateLimitPolicy
  authFailures: RateLimitPolicy
  apiWrite: RateLimitPolicy
  voicePreview: RateLimitPolicy
  ttsTool: RateLimitPolicy
  sttTool: RateLimitPolicy
  voiceLabUpload: RateLimitPolicy
  voiceClone: RateLimitPolicy
  testCall: RateLimitPolicy
  outboundCall: RateLimitPolicy
  knowledgeWrite: RateLimitPolicy
  checkout: RateLimitPolicy
  phoneSearch: RateLimitPolicy
  publicWebhook: RateLimitPolicy
  gatewayInternal: RateLimitPolicy
} = {
  /** Per IP. */
  auth: { name: 'auth', limit: 10, windowSeconds: 10 * MINUTE },
  /**
   * Per account: failed sign-ins only. Higher than the per-IP limit so a
   * stranger who knows an email can't lock its owner out with a few wrong
   * passwords, while guessing across many IPs still stops.
   */
  authFailures: { name: 'authFailures', limit: 20, windowSeconds: 10 * MINUTE },
  /** Per user. */
  apiWrite: { name: 'apiWrite', limit: 60, windowSeconds: MINUTE },
  /** Per org. */
  voicePreview: { name: 'voicePreview', limit: 20, windowSeconds: 10 * MINUTE },
  /** Per org. */
  ttsTool: { name: 'ttsTool', limit: 30, windowSeconds: 10 * MINUTE },
  /** Per org. */
  sttTool: { name: 'sttTool', limit: 10, windowSeconds: 10 * MINUTE },
  /** Per org: signed Voice Lab upload URLs (25 MB each), a few more than transcriptions to allow retries. */
  voiceLabUpload: { name: 'voiceLabUpload', limit: 20, windowSeconds: 10 * MINUTE },
  /** Per org. */
  voiceClone: { name: 'voiceClone', limit: 5, windowSeconds: DAY },
  /** Per org. */
  testCall: { name: 'testCall', limit: 10, windowSeconds: DAY },
  /** Per org. */
  outboundCall: { name: 'outboundCall', limit: 30, windowSeconds: HOUR },
  /** Per org. */
  knowledgeWrite: { name: 'knowledgeWrite', limit: 30, windowSeconds: HOUR },
  /** Per user. */
  checkout: { name: 'checkout', limit: 10, windowSeconds: HOUR },
  /** Per user. */
  phoneSearch: { name: 'phoneSearch', limit: 30, windowSeconds: 10 * MINUTE },
  /** Per IP. */
  publicWebhook: { name: 'publicWebhook', limit: 600, windowSeconds: MINUTE },
  /** Per call (session id). */
  gatewayInternal: { name: 'gatewayInternal', limit: 3000, windowSeconds: MINUTE },
}

const MAX_IDENTIFIER_LENGTH = 200

export function rateLimitKey(policy: RateLimitPolicy, identifier: string, windowStart: number): string {
  const id = (identifier || 'unknown').trim().slice(0, MAX_IDENTIFIER_LENGTH) || 'unknown'
  return `rl:${policy.name}:${id}:${windowStart}`
}

export async function rateLimit(
  policy: RateLimitPolicy,
  identifier: string
): Promise<{ ok: boolean; remaining: number; resetSeconds: number }> {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - (now % policy.windowSeconds)
  const resetSeconds = Math.max(1, windowStart + policy.windowSeconds - now)
  const count = await kvIncr(rateLimitKey(policy, identifier, windowStart), policy.windowSeconds)
  return {
    ok: count <= policy.limit,
    remaining: Math.max(0, policy.limit - count),
    resetSeconds,
  }
}

/** The current window's count without adding to it (e.g. to check before a sign-in that only counts when it fails). */
export async function peekRateLimit(policy: RateLimitPolicy, identifier: string): Promise<{ ok: boolean; count: number }> {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - (now % policy.windowSeconds)
  const raw = await kvGet<number | string>(rateLimitKey(policy, identifier, windowStart))
  const count = Number(raw ?? 0)
  const safe = Number.isFinite(count) ? count : 0
  return { ok: safe < policy.limit, count: safe }
}

function retryPhrase(seconds: number): string {
  if (seconds < 60) return seconds <= 5 ? 'in a few seconds' : `in ${seconds} seconds`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return minutes === 1 ? 'in a minute' : `in ${minutes} minutes`
  const hours = Math.ceil(minutes / 60)
  return hours === 1 ? 'in about an hour' : `in about ${hours} hours`
}

export async function enforceRateLimit(policy: RateLimitPolicy, identifier: string): Promise<void> {
  const result = await rateLimit(policy, identifier)
  if (result.ok) return
  throw new ApiError(
    429,
    'rate_limited',
    `You're doing that a bit too often. Please try again ${retryPhrase(result.resetSeconds)}.`,
    { 'Retry-After': String(result.resetSeconds) }
  )
}

/** Client IP for per-IP limits: first x-forwarded-for hop, then x-real-ip. */
export function clientIp(req: Request): string {
  return clientIpFromHeaders(req.headers)
}

/** Same as clientIp for code that only has headers (server actions read them via next/headers). */
export function clientIpFromHeaders(headers: Pick<Headers, 'get'>): string {
  const forwarded = headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  if (first) return first.slice(0, 64)
  const real = headers.get('x-real-ip')?.trim()
  if (real) return real.slice(0, 64)
  return 'unknown'
}
