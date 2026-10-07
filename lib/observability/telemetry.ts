// Provider telemetry: latency, failures, circuit transitions, failovers,
// webhook verification failures, sync failures. Events are logged (structured)
// and persisted to `provider_events` (service-role only; admin diagnostics read
// it). Persistence is best-effort and never blocks or fails the caller.

import { after } from 'next/server'
import { createLogger } from '@/lib/observability/logger'

export type ProviderEventKind =
  | 'api_call'
  | 'health_check'
  | 'circuit_transition'
  | 'failover'
  | 'routing_decision'
  | 'sync_failure'
  | 'sync_success'
  | 'webhook_received'
  | 'webhook_duplicate'
  | 'webhook_verification_failed'
  | 'webhook_processing_failed'
  | 'usage_recorded'

export interface ProviderEvent {
  system: string
  kind: ProviderEventKind
  operation?: string | null
  ok: boolean
  latencyMs?: number | null
  status?: number | null
  errorCode?: string | null
  orgId?: string | null
  agentId?: string | null
  callId?: string | null
  /** Small, non-sensitive structured details (redacted again on write). */
  details?: Record<string, unknown> | null
}

export type ProviderEventSink = (event: ProviderEvent) => void

const log = createLogger({ component: 'telemetry' })

function successSampleRate(): number {
  const raw = Number(process.env.TELEMETRY_SUCCESS_SAMPLE_RATE ?? '0.1')
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.1
}

// ─── Unauthenticated noise ───────────────────────────────────────────────────
// Public tool and webhook endpoints answer every unauthenticated request with
// a webhook_verification_failed event. Persisting each one would let anyone
// write provider_events rows at will, so per route (system + path) at most
// one is persisted per window and per instance; the others are only logged,
// with a counter, and the next persisted event carries how many were
// suppressed since the previous one.

const AUTH_FAILURE_KINDS: ReadonlySet<ProviderEventKind> = new Set(['webhook_verification_failed'])
export const AUTH_FAILURE_PERSIST_WINDOW_MS = 60_000
const MAX_THROTTLED_ROUTES = 500
const authFailureWindows = new Map<string, { windowStart: number; suppressed: number }>()

/** For tests. */
export function resetAuthFailureThrottle(): void {
  authFailureWindows.clear()
}

function routeKey(event: ProviderEvent): string {
  const path = event.details && typeof event.details.path === 'string' ? event.details.path : (event.operation ?? '')
  return `${event.system}|${path}`.slice(0, 200)
}

/**
 * Whether this auth-failure event is the one persisted for its route in the
 * current window; otherwise counts it. `suppressed` = events not persisted
 * since the last persisted one of the route.
 */
function claimAuthFailurePersist(event: ProviderEvent, now = Date.now()): { persist: boolean; suppressed: number } {
  const key = routeKey(event)
  const cur = authFailureWindows.get(key)
  if (cur && now - cur.windowStart < AUTH_FAILURE_PERSIST_WINDOW_MS) {
    cur.suppressed++
    return { persist: false, suppressed: cur.suppressed }
  }
  if (!cur && authFailureWindows.size >= MAX_THROTTLED_ROUTES) authFailureWindows.clear()
  authFailureWindows.set(key, { windowStart: now, suppressed: 0 })
  return { persist: true, suppressed: cur?.suppressed ?? 0 }
}

/**
 * Default sink: always log failures and non-api events; persist everything
 * except sampled-out successful api calls and throttled auth failures. The
 * DB write is dynamically imported so pure modules that emit telemetry stay
 * testable without Supabase.
 */
const defaultSink: ProviderEventSink = (event) => {
  const routine = event.kind === 'api_call' && event.ok
  if (AUTH_FAILURE_KINDS.has(event.kind)) {
    const claim = claimAuthFailurePersist(event)
    if (!claim.persist) {
      log.warn('provider.event', { ...event, persisted: false, suppressedInWindow: claim.suppressed })
      return
    }
    if (claim.suppressed) event = { ...event, details: { ...(event.details ?? {}), suppressed_since_last: claim.suppressed } }
  }
  if (!routine) {
    log[event.ok ? 'info' : 'warn']('provider.event', { ...event })
  }
  if (routine && Math.random() > successSampleRate()) return
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return

  const write = import('@/lib/observability/telemetry-store')
    .then(({ persistProviderEvent }) => persistProviderEvent(event))
    .catch((err: unknown) => log.warn('telemetry.persist_failed', { error: String((err as Error)?.message ?? err) }))
  deferBackground(write)
}

let sink: ProviderEventSink = defaultSink

export function emitProviderEvent(event: ProviderEvent): void {
  try {
    sink(event)
  } catch (err) {
    log.warn('telemetry.sink_threw', { error: String((err as Error)?.message ?? err) })
  }
}

/** Test hook: capture events instead of persisting them. Returns a restore fn. */
export function setProviderEventSink(next: ProviderEventSink): () => void {
  const prev = sink
  sink = next
  return () => {
    sink = prev
  }
}

/**
 * Keeps background work alive after the response when running inside a
 * Next.js request (after() → waitUntil on Vercel); otherwise (scripts, tests)
 * lets it run detached. Errors must already be handled by the promise itself.
 */
export function deferBackground(work: Promise<unknown>): void {
  try {
    after(() => work)
  } catch (err) {
    log.debug('telemetry.after_unavailable', { reason: String((err as Error)?.message ?? err) })
  }
}
