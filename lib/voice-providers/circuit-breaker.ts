// Per-provider circuit breaker.
//
// The state machine is pure (functions of state + time + config) so it can be
// unit-tested without timers. Persistence is a pluggable store: on Vercel every
// request may land on a different instance, so production uses the Supabase
// store (lib/voice-providers/circuit-store.ts) and tests/dev use memory.
//
//   closed ──(N consecutive health failures, or ≥ rate over window)──> open
//   open ──(open period elapsed)──> half_open (exactly one probe allowed)
//   half_open ──probe ok──> closed        half_open ──probe failed──> open (period doubles, capped)
//
// Only failures that say something about the provider's health count
// (timeouts, network, 5xx, 429, malformed responses). A 400 caused by our own
// request never opens a circuit.

import type { ProviderErrorCode, VoiceProvider } from './errors'

/**
 * Circuits: one per provider for its API (live-call requests + health probe),
 * plus a media circuit per provider fed by call outcomes (stream ended in the
 * first seconds / SIP leg failed vs. conversations that ran). Routing treats a
 * provider as unavailable when either of its circuits is open.
 */
export type CircuitKey = VoiceProvider | `${VoiceProvider}_media`

import { isHealthSignalCode } from './errors'

export type CircuitStateName = 'closed' | 'open' | 'half_open'

export interface CircuitState {
  state: CircuitStateName
  consecutiveFailures: number
  /** Rolling window for the failure-rate rule. */
  windowStartedAt: number
  windowFailures: number
  windowTotal: number
  openedAt: number | null
  openUntil: number | null
  /** How many times in a row the circuit re-opened from half_open (drives backoff). */
  reopenCount: number
  /** When a half-open probe was handed out; another probe is allowed only after the lease expires. */
  probeStartedAt: number | null
  lastErrorCode: ProviderErrorCode | null
  lastFailureAt: number | null
  lastSuccessAt: number | null
  /** Manual override from the admin endpoint: force open (maintenance) or closed. */
  forced: 'open' | 'closed' | null
}

export interface CircuitConfig {
  consecutiveFailureThreshold: number
  windowMs: number
  windowMinEvents: number
  windowFailureRate: number
  openMs: number
  maxOpenMs: number
  probeLeaseMs: number
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitConfig = {
  consecutiveFailureThreshold: 3,
  windowMs: 60_000,
  windowMinEvents: 5,
  windowFailureRate: 0.5,
  openMs: 30_000,
  maxOpenMs: 300_000,
  probeLeaseMs: 15_000,
}

export function initialCircuitState(now: number): CircuitState {
  return {
    state: 'closed',
    consecutiveFailures: 0,
    windowStartedAt: now,
    windowFailures: 0,
    windowTotal: 0,
    openedAt: null,
    openUntil: null,
    reopenCount: 0,
    probeStartedAt: null,
    lastErrorCode: null,
    lastFailureAt: null,
    lastSuccessAt: null,
    forced: null,
  }
}

export interface CircuitDecision {
  allowed: boolean
  /** True when this request is the single half-open probe. */
  probe: boolean
  state: CircuitState
  /** The state the caller should report (after time-based transitions). */
  effective: CircuitStateName
}

/** Time-based transition only (open → half_open when the period elapsed). */
export function advance(s: CircuitState, now: number): CircuitState {
  if (s.forced) return s
  if (s.state === 'open' && s.openUntil !== null && now >= s.openUntil) {
    return { ...s, state: 'half_open', probeStartedAt: null }
  }
  return s
}

/** Whether a request may be attempted now. Hands out at most one probe per lease. */
export function decide(s0: CircuitState, now: number, cfg: CircuitConfig = DEFAULT_CIRCUIT_CONFIG): CircuitDecision {
  if (s0.forced === 'open') return { allowed: false, probe: false, state: s0, effective: 'open' }
  if (s0.forced === 'closed') return { allowed: true, probe: false, state: s0, effective: 'closed' }

  const s = advance(s0, now)
  if (s.state === 'closed') return { allowed: true, probe: false, state: s, effective: 'closed' }
  if (s.state === 'open') return { allowed: false, probe: false, state: s, effective: 'open' }

  // half_open: one probe at a time.
  const leaseActive = s.probeStartedAt !== null && now - s.probeStartedAt < cfg.probeLeaseMs
  if (leaseActive) return { allowed: false, probe: false, state: s, effective: 'half_open' }
  return { allowed: true, probe: true, state: { ...s, probeStartedAt: now }, effective: 'half_open' }
}

function rollWindow(s: CircuitState, now: number, cfg: CircuitConfig): CircuitState {
  if (now - s.windowStartedAt >= cfg.windowMs) {
    return { ...s, windowStartedAt: now, windowFailures: 0, windowTotal: 0 }
  }
  return s
}

export function recordSuccess(s0: CircuitState, now: number, cfg: CircuitConfig = DEFAULT_CIRCUIT_CONFIG): CircuitState {
  const s = rollWindow(advance(s0, now), now, cfg)
  const base: CircuitState = {
    ...s,
    consecutiveFailures: 0,
    windowTotal: s.windowTotal + 1,
    lastSuccessAt: now,
  }
  if (s.state === 'half_open' || s.state === 'open') {
    // A success while open can only come from a request that was already in
    // flight when the circuit opened; treat it like a successful probe.
    return {
      ...base,
      state: 'closed',
      openedAt: null,
      openUntil: null,
      reopenCount: 0,
      probeStartedAt: null,
      windowStartedAt: now,
      windowFailures: 0,
      windowTotal: 0,
    }
  }
  return base
}

export function recordFailure(
  s0: CircuitState,
  now: number,
  code: ProviderErrorCode,
  cfg: CircuitConfig = DEFAULT_CIRCUIT_CONFIG,
): CircuitState {
  if (!isHealthSignalCode(code)) {
    // Our own mistake (validation/auth/not_found...): remember it for
    // diagnostics, but it says nothing about provider health.
    return { ...s0, lastErrorCode: code }
  }
  const s = rollWindow(advance(s0, now), now, cfg)
  const failed: CircuitState = {
    ...s,
    consecutiveFailures: s.consecutiveFailures + 1,
    windowFailures: s.windowFailures + 1,
    windowTotal: s.windowTotal + 1,
    lastErrorCode: code,
    lastFailureAt: now,
  }

  if (s.state === 'half_open') {
    const reopenCount = s.reopenCount + 1
    return open(failed, now, reopenCount, cfg)
  }
  if (s.state === 'open') return failed

  const tripConsecutive = failed.consecutiveFailures >= cfg.consecutiveFailureThreshold
  const tripRate =
    failed.windowTotal >= cfg.windowMinEvents &&
    failed.windowFailures / failed.windowTotal >= cfg.windowFailureRate
  if (tripConsecutive || tripRate) return open(failed, now, 0, cfg)
  return failed
}

function open(s: CircuitState, now: number, reopenCount: number, cfg: CircuitConfig): CircuitState {
  const duration = Math.min(cfg.maxOpenMs, cfg.openMs * 2 ** reopenCount)
  return {
    ...s,
    state: 'open',
    openedAt: now,
    openUntil: now + duration,
    reopenCount,
    probeStartedAt: null,
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

export interface CircuitStore {
  /** Returns the stored state and an opaque version for optimistic writes. */
  read(provider: CircuitKey): Promise<{ state: CircuitState; version: number } | null>
  /** Writes if the version still matches; returns false on a concurrent write. */
  write(provider: CircuitKey, state: CircuitState, expectedVersion: number | null): Promise<boolean>
}

export class MemoryCircuitStore implements CircuitStore {
  private readonly data = new Map<CircuitKey, { state: CircuitState; version: number }>()

  async read(provider: CircuitKey) {
    const row = this.data.get(provider)
    return row ? { state: { ...row.state }, version: row.version } : null
  }

  async write(provider: CircuitKey, state: CircuitState, expectedVersion: number | null) {
    const row = this.data.get(provider)
    const current = row?.version ?? null
    if (current !== expectedVersion) return false
    this.data.set(provider, { state: { ...state }, version: (current ?? 0) + 1 })
    return true
  }
}

export interface CircuitTransition {
  provider: CircuitKey
  from: CircuitStateName
  to: CircuitStateName
  errorCode: ProviderErrorCode | null
}

/**
 * Applies `fn` to the stored state with optimistic concurrency (a few retries
 * on a concurrent writer). Returns the new state and whether its name changed.
 */
export async function updateCircuit(
  store: CircuitStore,
  provider: CircuitKey,
  now: number,
  fn: (s: CircuitState) => CircuitState,
): Promise<{ state: CircuitState; transition: CircuitTransition | null }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await store.read(provider)
    const before = row?.state ?? initialCircuitState(now)
    const after = fn(before)
    const ok = await store.write(provider, after, row?.version ?? null)
    if (ok) {
      const fromName = advance(before, now).state
      const transition = fromName !== after.state
        ? { provider, from: fromName, to: after.state, errorCode: after.lastErrorCode }
        : null
      return { state: after, transition }
    }
  }
  // Persistent contention: compute without persisting rather than failing the
  // caller's request. The next write will catch up.
  const row = await store.read(provider)
  return { state: fn(row?.state ?? initialCircuitState(now)), transition: null }
}
