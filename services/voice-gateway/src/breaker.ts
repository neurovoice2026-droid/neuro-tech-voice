// Process-local circuit breakers. Same state machine and thresholds as the
// app's shared breaker (lib/voice/breaker.ts, contract 1.3); the app's copy
// decides routing for new calls, this copy lets one gateway process stop
// hammering a provider that is failing *right now* (a call that would start on
// Cartesia TTS starts on ElevenLabs TTS instead while the breaker is open).
//
//   - hard failure weighs 1, soft 0.5; a success clears the consecutive count
//   - open at ≥ 3 weighted consecutive failures, or when the last 60 s hold
//     ≥ 5 outcomes whose failures weigh ≥ 50 %
//   - open 30 s, doubling per re-open up to 300 s; doubling forgotten after 30 min closed
//   - half-open: one call at a time; 2 successes close, any failure re-opens;
//     a probe silent for 60 s counts as a success
//   - outcomes arriving while open are ignored; terminal failures open 24 h

export type FailureKind = 'hard' | 'soft' | 'terminal'
export type BreakerPhase = 'closed' | 'open' | 'half_open'

/** Component breakers: finer than the app's keys because the gateway can swap components. */
export type LocalBreakerKey =
  | 'cartesia_tts'
  | 'cartesia_stt'
  | 'openai'
  | 'cartesia_managed'
  | 'elevenlabs_agent'
  | 'elevenlabs_tts'
  | 'elevenlabs_stt'

export const BREAKER_WINDOW_MS = 60_000
export const BREAKER_CONSECUTIVE_FAILURES = 3
export const BREAKER_MIN_WINDOW_EVENTS = 5
export const BREAKER_FAILURE_RATIO = 0.5
export const BREAKER_BASE_OPEN_MS = 30_000
export const BREAKER_MAX_OPEN_MS = 300_000
export const BREAKER_TERMINAL_OPEN_MS = 24 * 60 * 60_000
export const BREAKER_CLOSE_AFTER_SUCCESSES = 2
export const BREAKER_PROBE_TIMEOUT_MS = 60_000
export const BREAKER_BACKOFF_RESET_MS = 30 * 60_000

const FAILURE_WEIGHT: Record<FailureKind, number> = { hard: 1, soft: 0.5, terminal: 1 }
const MAX_EVENTS = 100
const MAX_REOPEN_COUNT = 10

export interface BreakerEvent {
  t: number
  weight: number
  ok: boolean
}

export interface BreakerState {
  failures: number
  events: BreakerEvent[]
  openUntil: number
  reopenCount: number
  halfOpen: boolean
  halfOpenSuccesses: number
  probeUntil: number
  terminal: boolean
  closedAt: number
}

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

export type BreakerTransition = { type: 'failure'; kind: FailureKind } | { type: 'success' } | { type: 'reset' }

export function nextBreakerState(state: BreakerState | null, event: BreakerTransition, now: number): BreakerState {
  if (event.type === 'reset') return initialBreakerState()
  const s = normalize(state, now)
  if (event.type === 'failure') {
    const kind: FailureKind = Object.prototype.hasOwnProperty.call(FAILURE_WEIGHT, event.kind) ? event.kind : 'hard'
    if (kind === 'terminal') return s.terminal && s.openUntil > now ? s : open(s, now, true)
    if (s.openUntil > now) return s
    if (s.halfOpen) return open(s, now, false)
    const weight = FAILURE_WEIGHT[kind]
    s.failures += weight
    pushEvent(s, { t: now, weight, ok: false })
    if (s.failures >= BREAKER_CONSECUTIVE_FAILURES || failureRatioTripped(s.events)) return open(s, now, false)
    return s
  }
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

export function admitBreakerCall(state: BreakerState | null, now: number): { allowed: boolean; state: BreakerState } {
  const s = normalize(state, now)
  if (s.openUntil > now) return { allowed: false, state: s }
  if (!s.halfOpen) return { allowed: true, state: s }
  if (s.probeUntil > now) return { allowed: false, state: s }
  return { allowed: true, state: { ...s, probeUntil: now + BREAKER_PROBE_TIMEOUT_MS } }
}

// ─── Error classification (mirror of breakerFailureKind) ─────────────────────

const TERMINAL_CODES = new Set([
  'invalid_api_key',
  'missing_api_key',
  'unauthorized',
  'authentication_error',
  'auth_error',
  'permission_denied',
  'insufficient_credits',
  'insufficient_quota',
  'subscription_required',
  'unaccepted_terms',
  'account_suspended',
  'account_deactivated',
])
const CONFIG_CODES = new Set([
  'invalid_request',
  'input_error',
  'invalid_voice_id',
  'agent_not_found',
  'chunk_size_exceeded',
  'context_length_exceeded',
  'model_not_found',
  'voice_not_found',
  'voice_model_mismatch',
  'language_not_supported',
  'model_sunsetted',
  'unsupported_audio_format',
  'plan_upgrade_required',
  'invalid_dynamic_variables',
  'missing_dynamic_variables',
  'dynamic_variables_not_allowed',
])
const CONFIG_STATUSES = new Set([400, 404, 409, 413, 422])

export type ProviderName = 'cartesia' | 'openai' | 'elevenlabs'

/** null = don't count (configuration problem, or Cartesia quota which the budget flags handle). */
export function failureKind(
  error: { status?: number | null; code?: string | null } | null,
  opts: { provider?: ProviderName; slow?: boolean } = {}
): FailureKind | null {
  if (!error) return opts.slow ? 'soft' : null
  const status = typeof error.status === 'number' ? error.status : null
  const code = error.code ? String(error.code).trim().toLowerCase() : null
  const cartesiaLike = opts.provider === undefined || opts.provider === 'cartesia'
  if (code === 'quota_exceeded' || (status === 402 && cartesiaLike)) return cartesiaLike ? null : 'terminal'
  if ((code !== null && TERMINAL_CODES.has(code)) || status === 401 || status === 402 || status === 403) return 'terminal'
  if (code !== null && CONFIG_CODES.has(code)) return null
  if (status !== null && CONFIG_STATUSES.has(status)) return null
  return 'hard'
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export class LocalBreakers {
  private readonly states = new Map<LocalBreakerKey, BreakerState>()

  constructor(private readonly clock: () => number = Date.now) {}

  phase(key: LocalBreakerKey): BreakerPhase {
    return breakerPhase(this.states.get(key) ?? null, this.clock())
  }

  /** Claims the half-open probe slot; call only when the call really takes this path. */
  admit(key: LocalBreakerKey): boolean {
    const { allowed, state } = admitBreakerCall(this.states.get(key) ?? null, this.clock())
    this.states.set(key, state)
    return allowed
  }

  failure(key: LocalBreakerKey, kind: FailureKind): BreakerPhase {
    const next = nextBreakerState(this.states.get(key) ?? null, { type: 'failure', kind }, this.clock())
    this.states.set(key, next)
    return breakerPhase(next, this.clock())
  }

  success(key: LocalBreakerKey): void {
    this.states.set(key, nextBreakerState(this.states.get(key) ?? null, { type: 'success' }, this.clock()))
  }

  reset(key: LocalBreakerKey): void {
    this.states.delete(key)
  }

  snapshot(): Record<string, BreakerPhase> {
    const out: Record<string, BreakerPhase> = {}
    for (const key of this.states.keys()) out[key] = this.phase(key)
    return out
  }
}
