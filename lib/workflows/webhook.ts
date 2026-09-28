import 'server-only'
import { createHmac } from 'node:crypto'
import { assertPublicHttpsUrl, UnsafeUrlError } from '@/lib/security/ssrf'
import { WEBHOOK_HEADERS } from './payload'

// Outgoing HTTP for workflow steps (customer webhooks and Slack): SSRF-checked
// on every attempt and redirect hop, signed, and retried on failures that a
// retry can fix.
//
// Signature (documented for customers): header
//   X-NTV-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(signing_secret, "<t>.<raw body>")>
// The secret string is used as-is (UTF-8) as the HMAC key. Receivers should
// reject timestamps older than a few minutes and compare in constant time.

export const WEBHOOK_MAX_ATTEMPTS = 3
/** Pause before attempt 2 and attempt 3. */
export const WEBHOOK_RETRY_DELAYS_MS = [1_000, 4_000] as const
export const WEBHOOK_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3

export function signWebhookPayload(rawBody: string, secret: string, nowSeconds: number): string {
  const t = Math.floor(nowSeconds)
  const v1 = createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex')
  return `t=${t},v1=${v1}`
}

export type AttemptOutcome =
  | { kind: 'response'; status: number }
  | { kind: 'network_error'; timeout: boolean }
  | { kind: 'unsafe_url'; message: string }

/** Network errors, timeouts, 408, 429 and 5xx are worth another try; any other answer is final. */
export function isRetryableOutcome(outcome: AttemptOutcome): boolean {
  if (outcome.kind === 'network_error') return true
  if (outcome.kind !== 'response') return false
  return outcome.status === 408 || outcome.status === 429 || outcome.status >= 500
}

export function isSuccessfulOutcome(outcome: AttemptOutcome): boolean {
  return outcome.kind === 'response' && outcome.status >= 200 && outcome.status < 300
}

export interface DeliveryResult {
  ok: boolean
  attempts: number
  outcome: AttemptOutcome
  duration_ms: number
}

export interface PostInit {
  headers: Record<string, string>
  body: string
}

/** One POST (following safe redirects). Resolves with the final HTTP status; throws on network or URL problems. */
export type WebhookFetcher = (
  url: string,
  init: PostInit,
  opts: { timeoutMs: number; maxRedirects: number }
) => Promise<{ status: number; finalUrl: string }>

export interface DeliveryOptions {
  url: string
  body: string
  /** Built per attempt, so each attempt carries a fresh signature timestamp. */
  headers: (attempt: number) => Record<string, string>
  /** Epoch ms after which no new attempt starts. */
  deadline: number
  fetcher?: WebhookFetcher
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// 307 and 308 repeat the same POST with its body at the new address. 301, 302
// and 303 make HTTP clients (and lib/security/ssrf.ts safeFetch) switch to a
// GET without a body, so the call details would silently never arrive while
// the endpoint answers 200. Those are reported to the owner instead.
const BODY_PRESERVING_REDIRECTS = new Set([307, 308])

/**
 * POST for untrusted addresses: every hop passes assertPublicHttpsUrl (no
 * private, loopback or metadata addresses, https only, ports 80/443), one
 * timeout covers the whole chain, and the reply body is never read.
 */
export const postJsonSafely: WebhookFetcher = async (url, init, opts) => {
  const signal = AbortSignal.timeout(opts.timeoutMs)
  let current = await assertPublicHttpsUrl(url)
  for (let hop = 0; ; hop++) {
    const res = await fetch(current, {
      method: 'POST',
      headers: init.headers,
      body: init.body,
      redirect: 'manual',
      signal,
    })
    // Only the status matters; dropping the body frees the connection right away.
    await res.body?.cancel().catch(() => undefined)

    const location = res.headers.get('location')
    if (!BODY_PRESERVING_REDIRECTS.has(res.status) || !location) {
      return { status: res.status, finalUrl: current.toString() }
    }
    if (hop >= opts.maxRedirects) throw new UnsafeUrlError('Too many redirects')
    let next: URL
    try {
      next = new URL(location, current)
    } catch {
      throw new UnsafeUrlError('Redirect location is not valid')
    }
    current = await assertPublicHttpsUrl(next.toString())
  }
}

function classifyError(error: unknown): AttemptOutcome {
  if (error instanceof UnsafeUrlError) {
    // A failed DNS lookup is usually temporary; every other URL problem is permanent.
    if (/could not be resolved/i.test(error.message)) return { kind: 'network_error', timeout: false }
    return { kind: 'unsafe_url', message: error.message }
  }
  const name = error instanceof Error || error instanceof DOMException ? error.name : ''
  return { kind: 'network_error', timeout: name === 'TimeoutError' || name === 'AbortError' }
}

/** POSTs a JSON body with up to three attempts (1 s, then 4 s apart), staying inside the deadline. */
export async function deliverJson(options: DeliveryOptions): Promise<DeliveryResult> {
  const fetcher = options.fetcher ?? postJsonSafely
  const sleep = options.sleep ?? defaultSleep
  const now = options.now ?? Date.now
  const startedAt = now()

  let attempts = 0
  let outcome: AttemptOutcome = { kind: 'network_error', timeout: false }

  while (attempts < WEBHOOK_MAX_ATTEMPTS) {
    if (attempts > 0) {
      const delay = WEBHOOK_RETRY_DELAYS_MS[attempts - 1] ?? WEBHOOK_RETRY_DELAYS_MS[WEBHOOK_RETRY_DELAYS_MS.length - 1]
      // Only retry when the pause and a full attempt still fit in the run's time budget.
      if (now() + delay + WEBHOOK_TIMEOUT_MS > options.deadline) break
      await sleep(delay)
    }
    attempts += 1
    try {
      const res = await fetcher(
        options.url,
        { headers: options.headers(attempts), body: options.body },
        { timeoutMs: WEBHOOK_TIMEOUT_MS, maxRedirects: MAX_REDIRECTS }
      )
      outcome = { kind: 'response', status: res.status }
    } catch (error) {
      outcome = classifyError(error)
    }
    if (isSuccessfulOutcome(outcome) || !isRetryableOutcome(outcome)) break
  }

  return { ok: isSuccessfulOutcome(outcome), attempts, outcome, duration_ms: now() - startedAt }
}

export function customerWebhookHeaders(input: {
  body: string
  secret: string
  deliveryId: string
  event: string
  attempt: number
  nowSeconds?: number
}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'NeuroTechVoice-Webhooks/1.0',
    [WEBHOOK_HEADERS.event]: input.event,
    [WEBHOOK_HEADERS.delivery]: input.deliveryId,
    [WEBHOOK_HEADERS.attempt]: String(input.attempt),
    [WEBHOOK_HEADERS.signature]: signWebhookPayload(input.body, input.secret, input.nowSeconds ?? Date.now() / 1000),
  }
}

/**
 * Why an address was refused (lib/security/ssrf.ts messages), in words an
 * owner can act on. Completes "We can’t send to this address: …".
 */
export function unsafeUrlReason(message: string): string {
  if (/private or reserved/i.test(message)) return 'it points to a private or internal network, which call data is never sent to'
  if (/must use https/i.test(message)) return 'it has to start with https://'
  if (/credentials/i.test(message)) return 'it contains a username or password. Remove them from the address'
  if (/ports? 80 and 443/i.test(message)) return 'it uses an unusual port. Only standard web addresses (ports 80 and 443) are allowed'
  if (/could not be resolved|no host/i.test(message)) return 'we couldn’t find that web address. Check it for typos'
  if (/too many redirects/i.test(message)) return 'it redirected too many times. Use the final address instead'
  if (/redirect location/i.test(message)) return 'it redirected to an address that isn’t valid'
  if (/too long/i.test(message)) return 'the address is too long'
  return 'the address isn’t valid'
}

/** Owner-facing sentence for a finished delivery. Mentions the host only, never the path or query (they can hold tokens). */
export function describeDelivery(result: DeliveryResult, target: { label: string; url: string }): string {
  let host = target.label
  try {
    host = new URL(target.url).host
  } catch {
    // keep the label
  }
  const tries = result.attempts === 1 ? '' : ` after ${result.attempts} attempts`
  const { outcome } = result
  switch (outcome.kind) {
    case 'response':
      if (result.ok) return `${target.label} accepted it (${outcome.status})${result.attempts > 1 ? ` on attempt ${result.attempts}` : ''}.`
      if (outcome.status === 404 || outcome.status === 410) {
        return `${host} answered ${outcome.status}: the address no longer exists. Check the link in this step.`
      }
      if (outcome.status === 401 || outcome.status === 403) {
        return `${host} refused the request (${outcome.status}). Check that the address is still allowed to receive data.`
      }
      if (outcome.status >= 300 && outcome.status < 400) {
        return `${host} redirected the request (${outcome.status}), which would drop the call details on the way. Paste the address it redirects to into this step.`
      }
      return `${host} answered ${outcome.status}${tries}.`
    case 'network_error':
      return outcome.timeout
        ? `${host} didn’t answer within ${WEBHOOK_TIMEOUT_MS / 1000} seconds${tries}.`
        : `We couldn’t reach ${host}${tries}.`
    case 'unsafe_url':
      return `We can’t send to this address: ${unsafeUrlReason(outcome.message)}.`
  }
}
