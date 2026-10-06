// Which circuit store and config the running process uses, plus the two calls
// the rest of the app needs: "may I call provider X now?" and "record outcome".

import {
  DEFAULT_CIRCUIT_CONFIG,
  MemoryCircuitStore,
  advance,
  decide,
  initialCircuitState,
  recordFailure,
  recordSuccess,
  updateCircuit,
  type CircuitConfig,
  type CircuitState,
  type CircuitStateName,
  type CircuitStore,
  type CircuitKey,
} from './circuit-breaker'
import { isHealthSignalCode, type ProviderErrorCode, type VoiceProvider } from './errors'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger({ component: 'circuit' })

let store: CircuitStore | null = null
let storeFactory: (() => Promise<CircuitStore>) | null = null

function envInt(name: string, fallback: number, min: number, max: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v >= min && v <= max ? Math.floor(v) : fallback
}

export function circuitConfig(): CircuitConfig {
  return {
    consecutiveFailureThreshold: envInt('VOICE_CIRCUIT_FAILURE_THRESHOLD', DEFAULT_CIRCUIT_CONFIG.consecutiveFailureThreshold, 1, 50),
    windowMs: envInt('VOICE_CIRCUIT_WINDOW_MS', DEFAULT_CIRCUIT_CONFIG.windowMs, 5_000, 3_600_000),
    windowMinEvents: envInt('VOICE_CIRCUIT_WINDOW_MIN_EVENTS', DEFAULT_CIRCUIT_CONFIG.windowMinEvents, 1, 1000),
    windowFailureRate: DEFAULT_CIRCUIT_CONFIG.windowFailureRate,
    openMs: envInt('VOICE_CIRCUIT_OPEN_MS', DEFAULT_CIRCUIT_CONFIG.openMs, 1_000, 3_600_000),
    maxOpenMs: envInt('VOICE_CIRCUIT_MAX_OPEN_MS', DEFAULT_CIRCUIT_CONFIG.maxOpenMs, 1_000, 86_400_000),
    probeLeaseMs: envInt('VOICE_CIRCUIT_PROBE_LEASE_MS', DEFAULT_CIRCUIT_CONFIG.probeLeaseMs, 1_000, 600_000),
  }
}

/** Test hook. Pass null to go back to the default resolution. */
export function setCircuitStore(next: CircuitStore | null): void {
  store = next
  storeFactory = null
}

async function getStore(): Promise<CircuitStore> {
  if (store) return store
  if (!storeFactory) {
    storeFactory = async () => {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NODE_ENV !== 'test') {
        const { SupabaseCircuitStore } = await import('./circuit-store')
        return new SupabaseCircuitStore()
      }
      log.warn('circuit.memory_store', { reason: 'Supabase service role not configured; breaker state is per-instance' })
      return new MemoryCircuitStore()
    }
  }
  store = await storeFactory()
  return store
}

function systemOf(key: CircuitKey): VoiceProvider {
  return key.endsWith('_media') ? (key.slice(0, -'_media'.length) as VoiceProvider) : (key as VoiceProvider)
}

/** Worst of a provider's API and media circuits, as seen by routing. */
export async function peekProvider(provider: VoiceProvider, now = Date.now()): Promise<CircuitStateName> {
  const [api, media] = await Promise.all([peek(provider, now), peek(`${provider}_media`, now)])
  if (api.state === 'open' || media.state === 'open') return 'open'
  if (api.state === 'half_open' || media.state === 'half_open') return 'half_open'
  return 'closed'
}

export interface AcquireResult {
  allowed: boolean
  probe: boolean
  state: CircuitStateName
}

/**
 * Asks the breaker whether `provider` may be called now. Reads only, except
 * when a half-open probe must be claimed: that write is optimistic, so exactly
 * one instance gets the probe and the others are told to wait.
 */
export async function acquire(provider: CircuitKey, now = Date.now()): Promise<AcquireResult> {
  const cfg = circuitConfig()
  try {
    const s = await getStore()
    for (let attempt = 0; attempt < 2; attempt++) {
      const row = await s.read(provider)
      const d = decide(row?.state ?? initialCircuitState(now), now, cfg)
      if (!d.probe) return { allowed: d.allowed, probe: false, state: d.effective }
      if (await s.write(provider, d.state, row?.version ?? null)) {
        return { allowed: true, probe: true, state: 'half_open' }
      }
    }
    // Lost the race for the probe twice: someone else is probing.
    return { allowed: false, probe: false, state: 'half_open' }
  } catch (err) {
    // If we cannot read breaker state we fail open: refusing every call because
    // our own database blipped would turn a minor incident into an outage.
    log.error('circuit.acquire_failed', err, { provider })
    return { allowed: true, probe: false, state: 'closed' }
  }
}

/** Read-only view for routing and diagnostics (does not claim a probe). */
export async function peek(provider: CircuitKey, now = Date.now()): Promise<{ state: CircuitStateName; raw: CircuitState }> {
  try {
    const s = await getStore()
    const row = await s.read(provider)
    const raw = row?.state ?? initialCircuitState(now)
    const d = decide(raw, now, circuitConfig())
    return { state: d.effective, raw }
  } catch (err) {
    log.error('circuit.peek_failed', err, { provider })
    return { state: 'closed', raw: initialCircuitState(now) }
  }
}

/**
 * Records the outcome of a provider call. A success while everything is
 * already healthy is not written (no failures to reset), which keeps the hot
 * path to a single read; the failure-rate rule therefore counts events since
 * the first failure in the current window.
 */
export async function reportOutcome(
  provider: CircuitKey,
  outcome: { ok: true } | { ok: false; code: ProviderErrorCode },
  now = Date.now(),
  opts: {
    /**
     * Media circuits: when the call that proves health started. A call that
     * started before the latest failure (e.g. dropped by the very outage that
     * opened the circuit) is not evidence of recovery.
     */
    evidenceStartedAt?: number
  } = {},
): Promise<void> {
  const cfg = circuitConfig()
  try {
    const s = await getStore()
    if (outcome.ok) {
      const row = await s.read(provider)
      const st = row?.state
      const healthy = !st || (st.state === 'closed' && st.consecutiveFailures === 0 && st.windowFailures === 0 && !st.forced)
      if (healthy) return
      if (st && opts.evidenceStartedAt !== undefined && st.lastFailureAt !== null && opts.evidenceStartedAt < st.lastFailureAt) return
      // A media circuit is closed only by a success while half-open (after the
      // open period), never by a call that happened to finish while open.
      if (st && provider.endsWith('_media') && advance(st, now).state === 'open') return
    } else if (!isHealthSignalCode(outcome.code)) {
      return // our own request was wrong; provider health is unaffected
    }
    const { transition } = await updateCircuit(s, provider, now, (state) =>
      outcome.ok ? recordSuccess(state, now, cfg) : recordFailure(state, now, outcome.code, cfg),
    )
    if (transition) {
      emitProviderEvent({
        system: systemOf(provider),
        kind: 'circuit_transition',
        ok: transition.to === 'closed',
        errorCode: transition.errorCode,
        details: { circuit: provider, from: transition.from, to: transition.to },
      })
    }
  } catch (err) {
    log.error('circuit.report_failed', err, { provider })
  }
}

/** Admin override: force a circuit open (maintenance), closed, or clear the override. */
export async function forceCircuit(provider: CircuitKey, forced: 'open' | 'closed' | null, now = Date.now()): Promise<CircuitState> {
  const s = await getStore()
  const { state } = await updateCircuit(s, provider, now, (st) => {
    if (forced !== null) return { ...st, forced }
    // Back to automatic: a circuit that was forced open (or is open/half-open)
    // resumes half-open, so recovery goes through a probe instead of sending
    // all traffic back at once; a healthy circuit simply stays closed.
    const recovering = st.forced === 'open' || st.state !== 'closed'
    return {
      ...st,
      forced: null,
      state: recovering ? ('half_open' as const) : ('closed' as const),
      openUntil: null,
      openedAt: recovering ? st.openedAt : null,
      consecutiveFailures: 0,
      reopenCount: 0,
      probeStartedAt: null,
    }
  })
  emitProviderEvent({ system: systemOf(provider), kind: 'circuit_transition', ok: forced !== 'open', details: { circuit: provider, forced } })
  return state
}
