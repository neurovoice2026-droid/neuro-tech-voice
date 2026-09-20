import 'server-only'
import { isCartesiaConfigError } from '@/lib/cartesia/client'
import { kvDel, kvGet, kvSet } from '@/lib/kv'

// Shared circuit breaker for the voice pipeline (the gateway keeps a local
// mirror with the same thresholds). The router asks isBreakerOpen() before
// picking a mode; the app records outcomes reported by the gateway.
//
// Rules (contract 1.3):
//   - hard failure weighs 1, soft 0.5; a success clears the consecutive count
//   - open at ≥ 3 weighted consecutive failures, or when the last 60 s hold
//     ≥ 5 outcomes and failures weigh ≥ 50 % of them
//   - open 30 s, doubling on every re-open up to 300 s; the doubling is
//     forgotten after 30 min closed
//   - then half-open: one call at a time goes through; 2 successes close,
//     any failure re-opens; a probe silent for 60 s counts as a success
//   - terminal failures (bad key, suspended account) open for 24 h or until
//     resetBreaker()
// Callers classify errors first (breakerFailureKind): configuration errors
// never count, and Cartesia quota_exceeded belongs to the budget flags.
//
// State lives in KV under breaker:<key>. Updates are read-modify-write, so two
// instances recording at the same moment can lose one outcome; the thresholds
// tolerate that. When KV is unreachable every breaker reads as closed, which
// keeps calls on the primary path (per-call failover still applies).

export type BreakerKey = 'gateway' | 'cartesia_self' | 'cartesia_managed' | 'elevenlabs'
export type FailureKind = 'hard' | 'soft' | 'terminal'
export type BreakerPhase = 'closed' | 'open' | 'half_open'

export const BREAKER_KEYS: readonly BreakerKey[] = ['gateway', 'cartesia_self', 'cartesia_managed', 'elevenlabs'] as const

export const BREAKER_WINDOW_MS = 60_000
export const BREAKER_CONSECUTIVE_FAILURES = 3
export const BREAKER_MIN_WINDOW_EVENTS = 5
export const BREAKER_FAILURE_RATIO = 0.5
export const BREAKER_BASE_OPEN_MS = 30_000
export const BREAKER_MAX_OPEN_MS = 300_000
export const BREAKER_TERMINAL_OPEN_MS = 24 * 60 * 60_000
export const BREAKER_CLOSE_AFTER_SUCCESSES = 2
/** A half-open probe that reports nothing for this long counts as a success and frees its slot. */
export const BREAKER_PROBE_TIMEOUT_MS = 60_000
/** Closed this long without re-opening: the next open starts again at 30 s. */
export const BREAKER_BACKOFF_RESET_MS = 30 * 60_000

const FAILURE_WEIGHT: Record<FailureKind, number> = { hard: 1, soft: 0.5, terminal: 1 }
const MAX_EVENTS = 100
const MAX_REOPEN_COUNT = 10

export interface BreakerEvent {
  /** Epoch ms. */
  t: number
  /** Failure weight (hard 1, soft 0.5); 0 for successes. */
  weight: number
  ok: boolean
}

export interface BreakerState {
  /** Weighted consecutive failures; a success resets it. */
  failures: number
  /** Outcomes of the last 60 s, oldest first. */
  events: BreakerEvent[]
  /** Epoch ms until which calls are refused; 0 = not open. */
  openUntil: number
  /** Opens since the breaker last stayed closed for 30 min; drives the doubling. */
  reopenCount: number
  /** The open period elapsed; probe calls decide whether to close. */
  halfOpen: boolean
  /** Successful probes since entering half-open. */
  halfOpenSuccesses: number
  /** Epoch ms until which a half-open probe is in flight; 0 = the slot is free. */
  probeUntil: number
  /** Opened by a terminal failure. */
  terminal: boolean
  /** Epoch ms of the last recovery (half-open → closed); 0 = none. */
  closedAt: number
}

export type BreakerTransition = { type: 'failure'; kind: FailureKind } | { type: 'success' } | { type: 'reset' }

export function initialBreakerState(): BreakerState {
  return {
    failures: 0,
    events: [],
    openUntil: 0,
    reopenCount: 0,
    halfOpen: false,
    halfOpenSuccesses: 0,
    probeUntil: 0,
    terminal: false,
    closedAt: 0,
  }
}

// ─── Pure state machine ──────────────────────────────────────────────────────

/** Applies the clock: prunes old events, turns an elapsed open period into half-open, expires stale probes and backoff. */
function normalize(state: BreakerState | null, now: number): BreakerState {
  const s: BreakerState = state ? { ...state, events: state.events.filter((e) => e.t > now - BREAKER_WINDOW_MS) } : initialBreakerState()
  if (s.openUntil > 0 && s.openUntil <= now) {
    s.openUntil = 0
    s.terminal = false
    s.halfOpen = true
    s.halfOpenSuccesses = 0
    s.probeUntil = 0
  }
  if (s.probeUntil > 0 && s.probeUntil <= now) {
    const reportedAt = s.probeUntil
    s.probeUntil = 0
    if (s.halfOpen) {
      // The probe call reported no failure within the probe window. Provider
      // failures surface within seconds (handshakes, first audio), so silence
      // counts as a success; otherwise a caller that never records successes
      // would leave the breaker half-open, admitting one call a minute, forever.
      s.halfOpenSuccesses += 1
      if (s.halfOpenSuccesses >= BREAKER_CLOSE_AFTER_SUCCESSES) {
        s.halfOpen = false
        s.halfOpenSuccesses = 0
        s.failures = 0
        s.events = []
        s.closedAt = reportedAt
      }
    }
  }
  if (s.openUntil === 0 && !s.halfOpen && s.closedAt > 0 && now - s.closedAt >= BREAKER_BACKOFF_RESET_MS) {
    s.reopenCount = 0
    s.closedAt = 0
  }
  return s
}

export function breakerPhase(state: BreakerState | null, now: number): BreakerPhase {
  const s = normalize(state, now)
  if (s.openUntil > now) return 'open'
  return s.halfOpen ? 'half_open' : 'closed'
}

/** Duration the next (non-terminal) open would last. */
export function breakerOpenDurationMs(reopenCount: number): number {
  return Math.min(BREAKER_BASE_OPEN_MS * 2 ** Math.max(0, reopenCount), BREAKER_MAX_OPEN_MS)
}

function open(s: BreakerState, now: number, terminal: boolean): BreakerState {
  return {
    ...s,
    failures: 0,
    events: [],
    openUntil: now + (terminal ? BREAKER_TERMINAL_OPEN_MS : breakerOpenDurationMs(s.reopenCount)),
    reopenCount: terminal ? s.reopenCount : Math.min(s.reopenCount + 1, MAX_REOPEN_COUNT),
    halfOpen: false,
    halfOpenSuccesses: 0,
    probeUntil: 0,
    terminal,
    closedAt: 0,
  }
}

function pushEvent(s: BreakerState, event: BreakerEvent): void {
  s.events.push(event)
  if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS)
}

function failureRatioTripped(events: BreakerEvent[]): boolean {
  if (events.length < BREAKER_MIN_WINDOW_EVENTS) return false
  const failed = events.reduce((sum, e) => sum + (e.ok ? 0 : e.weight), 0)
  return failed / events.length >= BREAKER_FAILURE_RATIO
}

/** Next state after an outcome. Pure: `now` is epoch ms. */
export function nextBreakerState(state: BreakerState | null, event: BreakerTransition, now: number): BreakerState {
  if (event.type === 'reset') return initialBreakerState()
  const s = normalize(state, now)

  if (event.type === 'failure') {
    // Unknown kinds (a malformed gateway report) count as hard rather than being dropped.
    const kind: FailureKind = Object.prototype.hasOwnProperty.call(FAILURE_WEIGHT, event.kind) ? event.kind : 'hard'
    if (kind === 'terminal') return s.terminal && s.openUntil > now ? s : open(s, now, true)
    // Late result of a call admitted before the breaker opened: extending the
    // open period for it would keep the breaker shut long after the outage.
    if (s.openUntil > now) return s
    if (s.halfOpen) return open(s, now, false)
    const weight = FAILURE_WEIGHT[kind]
    s.failures += weight
    pushEvent(s, { t: now, weight, ok: false })
    if (s.failures >= BREAKER_CONSECUTIVE_FAILURES || failureRatioTripped(s.events)) return open(s, now, false)
    return s
  }

  // success
  if (s.openUntil > now) return s
  if (s.halfOpen) {
    s.halfOpenSuccesses += 1
    s.probeUntil = 0
    if (s.halfOpenSuccesses < BREAKER_CLOSE_AFTER_SUCCESSES) return s
    return { ...s, failures: 0, events: [], halfOpen: false, halfOpenSuccesses: 0, closedAt: now }
  }
  s.failures = 0
  pushEvent(s, { t: now, weight: 0, ok: true })
  return s
}

/**
 * Whether a call may use the protected path right now. In half-open this
 * claims the single probe slot, so only call it when the call will really go
 * that way (use breakerPhase / getBreakerPhase to look without side effects).
 */
export function admitBreakerCall(state: BreakerState | null, now: number): { allowed: boolean; state: BreakerState; changed: boolean } {
  const s = normalize(state, now)
  if (s.openUntil > now) return { allowed: false, state: s, changed: false }
  if (!s.halfOpen) return { allowed: true, state: s, changed: false }
  if (s.probeUntil > now) return { allowed: false, state: s, changed: false }
  return { allowed: true, state: { ...s, probeUntil: now + BREAKER_PROBE_TIMEOUT_MS }, changed: true }
}

/** A state with nothing worth persisting (closed, no failures in the window, no backoff). */
export function isPristineBreakerState(s: BreakerState): boolean {
  return (
    s.openUntil === 0 &&
    !s.halfOpen &&
    !s.terminal &&
    s.failures === 0 &&
    s.reopenCount === 0 &&
    s.probeUntil === 0 &&
    s.events.every((e) => e.ok)
  )
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Tolerant reader for KV values; anything unrecognisable counts as no state. */
export function parseBreakerState(raw: unknown): BreakerState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = raw as Record<string, unknown>
  if (typeof v.failures !== 'number' || !Array.isArray(v.events) || typeof v.openUntil !== 'number') return null
  const events = v.events
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({ t: finiteNumber(e.t, NaN), weight: Math.max(0, finiteNumber(e.weight)), ok: e.ok === true }))
    .filter((e) => Number.isFinite(e.t))
  return {
    failures: Math.max(0, finiteNumber(v.failures)),
    events,
    openUntil: Math.max(0, finiteNumber(v.openUntil)),
    reopenCount: Math.max(0, Math.floor(finiteNumber(v.reopenCount))),
    halfOpen: v.halfOpen === true,
    halfOpenSuccesses: Math.max(0, Math.floor(finiteNumber(v.halfOpenSuccesses))),
    probeUntil: Math.max(0, finiteNumber(v.probeUntil)),
    terminal: v.terminal === true,
    closedAt: Math.max(0, finiteNumber(v.closedAt)),
  }
}

// ─── Error classification ────────────────────────────────────────────────────

// Keys, billing and account problems: every call would fail until a human acts.
const TERMINAL_CODES = new Set([
  'invalid_api_key',
  'missing_api_key',
  'unauthorized',
  'authentication_error',
  'permission_denied',
  'insufficient_credits',
  'insufficient_quota',
  'subscription_required',
  'unaccepted_terms',
  'account_suspended',
  'account_deactivated',
])
// Our request is wrong; failing over this call is right, tripping the breaker is not.
const CONFIG_CODES = new Set([
  'invalid_request',
  'input_error',
  'invalid_voice_id',
  'agent_not_found',
  'chunk_size_exceeded',
  'context_length_exceeded',
  'model_not_found',
  'voice_not_found',
])
const CONFIG_STATUSES = new Set([400, 404, 409, 413, 422])

export type BreakerProvider = 'cartesia' | 'openai' | 'elevenlabs' | 'gateway'

function errorFacts(error: unknown): { status: number | null; code: string | null } {
  if (!error || typeof error !== 'object') return { status: null, code: null }
  const e = error as Record<string, unknown>
  const statusValue = [e.status, e.status_code, e.statusCode].find((v) => typeof v === 'number' && Number.isFinite(v))
  const codeValue = [e.errorCode, e.error_code, e.code].find(
    (v) => (typeof v === 'string' && v.trim() !== '') || typeof v === 'number'
  )
  return {
    status: typeof statusValue === 'number' ? statusValue : null,
    code: codeValue === undefined ? null : String(codeValue).trim().toLowerCase(),
  }
}

/**
 * How a provider error should count, or null when it must not count at all
 * (configuration errors; Cartesia quota, which markBudgetExhausted handles).
 * Accepts CartesiaError, OpenAI/ElevenLabs SDK errors, WebSocket error events
 * ({ status_code, error_code }) and gateway event data ({ code }). `slow` marks
 * a call that worked but blew its latency budget (soft failure).
 */
export function breakerFailureKind(
  error: unknown,
  opts: { provider?: BreakerProvider; slow?: boolean } = {}
): FailureKind | null {
  if ((error === null || error === undefined) && opts.slow) return 'soft'
  const { status, code } = errorFacts(error)
  const cartesiaLike = opts.provider === undefined || opts.provider === 'cartesia'

  if (code === 'quota_exceeded' || (status === 402 && cartesiaLike)) return cartesiaLike ? null : 'terminal'
  if ((code !== null && TERMINAL_CODES.has(code)) || status === 401 || status === 402 || status === 403) return 'terminal'
  if (code !== null && CONFIG_CODES.has(code)) return null
  if (status !== null && CONFIG_STATUSES.has(status)) return null
  if (cartesiaLike && isCartesiaConfigError({ status_code: status, error_code: code })) return null
  return 'hard'
}

// ─── KV-backed API ───────────────────────────────────────────────────────────

function storageKey(key: BreakerKey): string {
  return `breaker:${key}`
}

async function loadState(key: BreakerKey): Promise<BreakerState | null> {
  return parseBreakerState(await kvGet<unknown>(storageKey(key)))
}

async function saveState(key: BreakerKey, previous: BreakerState | null, next: BreakerState, now: number): Promise<void> {
  if (isPristineBreakerState(next)) {
    // Healthy traffic doesn't need a KV write per call.
    if (previous !== null) await kvDel(storageKey(key))
    return
  }
  // Keep the record while it matters: through any open period or probe, plus
  // the backoff memory; after that silence it expires and the breaker is fresh.
  const busyUntil = Math.max(next.openUntil, next.probeUntil, now)
  const ttlSeconds = Math.ceil((busyUntil - now + BREAKER_BACKOFF_RESET_MS) / 1000)
  await kvSet(storageKey(key), next, ttlSeconds)
}

function logTransition(key: BreakerKey, previous: BreakerState | null, next: BreakerState, now: number): void {
  const before = breakerPhase(previous, now)
  const after = breakerPhase(next, now)
  if (after === 'open' && next.openUntil !== normalize(previous, now).openUntil) {
    const seconds = Math.round((next.openUntil - now) / 1000)
    const detail = next.terminal ? ' (terminal: fix the key or account, then reset the breaker)' : ''
    console.warn('[breaker]', `${key} opened for ${seconds} s${detail}`)
  } else if (before !== 'closed' && after === 'closed') {
    console.info('[breaker]', `${key} closed`)
  }
}

/** Current state without side effects (ops status, dashboards). */
export async function getBreakerSnapshot(key: BreakerKey): Promise<{ key: BreakerKey; phase: BreakerPhase; state: BreakerState }> {
  const now = Date.now()
  const state = await loadState(key)
  return { key, phase: breakerPhase(state, now), state: normalize(state, now) }
}

/** Phase without side effects. A half-open breaker still needs isBreakerOpen() to claim the probe. */
export async function getBreakerPhase(key: BreakerKey): Promise<BreakerPhase> {
  return breakerPhase(await loadState(key), Date.now())
}

/**
 * True when calls must avoid this path. Half-open lets exactly one call
 * through (and claims that slot), so call this only for the path the call
 * will actually take.
 */
export async function isBreakerOpen(key: BreakerKey): Promise<boolean> {
  const now = Date.now()
  const previous = await loadState(key)
  if (previous === null) return false
  const { allowed, state, changed } = admitBreakerCall(previous, now)
  if (changed) await saveState(key, previous, state, now)
  return !allowed
}

export async function recordBreakerFailure(key: BreakerKey, kind: FailureKind): Promise<void> {
  const now = Date.now()
  const previous = await loadState(key)
  const next = nextBreakerState(previous, { type: 'failure', kind }, now)
  logTransition(key, previous, next, now)
  await saveState(key, previous, next, now)
}

export async function recordBreakerSuccess(key: BreakerKey): Promise<void> {
  const now = Date.now()
  const previous = await loadState(key)
  const next = nextBreakerState(previous, { type: 'success' }, now)
  logTransition(key, previous, next, now)
  await saveState(key, previous, next, now)
}

export async function resetBreaker(key: BreakerKey): Promise<void> {
  await kvDel(storageKey(key))
  console.info('[breaker]', `${key} reset`)
}
