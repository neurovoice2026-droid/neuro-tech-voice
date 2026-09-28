import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const kv = vi.hoisted(() => ({
  store: new Map<string, { value: unknown; ttl: number | undefined }>(),
  sets: 0,
  dels: 0,
}))

vi.mock('@/lib/kv', () => ({
  kvGet: async (key: string) => {
    const entry = kv.store.get(key)
    return entry ? JSON.parse(JSON.stringify(entry.value)) : null
  },
  kvSet: async (key: string, value: unknown, ttl?: number) => {
    kv.sets++
    kv.store.set(key, { value: JSON.parse(JSON.stringify(value)), ttl })
  },
  kvDel: async (key: string) => {
    kv.dels++
    kv.store.delete(key)
  },
  kvIncr: async () => 1,
}))

import { CartesiaError } from '@/lib/cartesia/client'
import {
  BREAKER_BACKOFF_RESET_MS,
  BREAKER_PROBE_TIMEOUT_MS,
  BREAKER_TERMINAL_OPEN_MS,
  admitBreakerCall,
  breakerFailureKind,
  breakerOpenDurationMs,
  breakerPhase,
  getBreakerPhase,
  getBreakerSnapshot,
  initialBreakerState,
  isBreakerOpen,
  isPristineBreakerState,
  nextBreakerState,
  parseBreakerState,
  recordBreakerFailure,
  recordBreakerSuccess,
  resetBreaker,
  type BreakerState,
  type BreakerTransition,
} from './breaker'

const T0 = Date.UTC(2026, 8, 17, 12, 0, 0)
const HARD: BreakerTransition = { type: 'failure', kind: 'hard' }
const SOFT: BreakerTransition = { type: 'failure', kind: 'soft' }
const TERMINAL: BreakerTransition = { type: 'failure', kind: 'terminal' }
const OK: BreakerTransition = { type: 'success' }

/** Applies transitions one second apart starting at `start`; returns the state and the last timestamp. */
function run(events: BreakerTransition[], start = T0, state: BreakerState | null = null) {
  let s = state
  let now = start
  events.forEach((event, i) => {
    now = start + i * 1000
    s = nextBreakerState(s, event, now)
  })
  return { state: s ?? initialBreakerState(), now }
}

/** Opens a fresh breaker with three hard failures. */
function opened(start = T0) {
  return run([HARD, HARD, HARD], start)
}

describe('nextBreakerState: consecutive failures', () => {
  it('opens after three consecutive hard failures, for 30 s', () => {
    const two = run([HARD, HARD])
    expect(breakerPhase(two.state, two.now)).toBe('closed')
    expect(two.state.failures).toBe(2)

    const { state, now } = opened()
    expect(breakerPhase(state, now)).toBe('open')
    expect(state.openUntil).toBe(now + 30_000)
    expect(state.reopenCount).toBe(1)
    expect(state.failures).toBe(0)
    expect(state.events).toEqual([])
  })

  it('resets the consecutive count on success', () => {
    // Enough successes that the ratio rule (4 of 9) stays quiet.
    const { state, now } = run([OK, OK, OK, OK, HARD, HARD, OK, HARD, HARD])
    expect(breakerPhase(state, now)).toBe('closed')
    expect(state.failures).toBe(2)
    // Without them the same failures trip the ratio rule (4 of 5).
    const ratio = run([HARD, HARD, OK, HARD, HARD])
    expect(breakerPhase(ratio.state, ratio.now)).toBe('open')
  })

  it('weighs soft failures at 0.5', () => {
    const { state, now } = run([SOFT, SOFT, SOFT, SOFT])
    expect(state.failures).toBe(2)
    expect(breakerPhase(state, now)).toBe('closed')

    const mixed = run([HARD, HARD, SOFT, SOFT])
    expect(breakerPhase(mixed.state, mixed.now)).toBe('open')
  })

  it('treats an unknown failure kind as hard', () => {
    const odd = { type: 'failure', kind: 'weird' } as unknown as BreakerTransition
    const { state, now } = run([odd, odd, odd])
    expect(breakerPhase(state, now)).toBe('open')
  })
})

describe('nextBreakerState: failure ratio', () => {
  it('opens when failures weigh at least 50 % of five or more events in 60 s', () => {
    const four = run([HARD, OK, HARD, OK])
    expect(breakerPhase(four.state, four.now)).toBe('closed')

    const five = run([HARD, OK, HARD, OK, HARD])
    expect(breakerPhase(five.state, five.now)).toBe('open')
  })

  it('stays closed below 50 %', () => {
    const { state, now } = run([OK, OK, HARD, OK, HARD, OK, HARD])
    expect(breakerPhase(state, now)).toBe('closed')
    const next = nextBreakerState(state, HARD, now + 1000)
    expect(breakerPhase(next, now + 1000)).toBe('open')
  })

  it('counts soft failures at half weight in the ratio', () => {
    // 4 soft (2.0) + 1 success over 5 events = 40 %
    const { state, now } = run([SOFT, OK, SOFT, SOFT, SOFT])
    expect(breakerPhase(state, now)).toBe('closed')
  })

  it('only counts events from the last 60 s', () => {
    const old = run([HARD, OK, HARD, OK])
    const later = old.now + 61_000
    const s = nextBreakerState(old.state, HARD, later)
    expect(s.events).toHaveLength(1)
    expect(breakerPhase(s, later)).toBe('closed')
  })
})

describe('half-open', () => {
  it('lets one probe through after the open period, and a second after a success', () => {
    const { state, now } = opened()
    const at = now + 30_000
    expect(breakerPhase(state, at - 1)).toBe('open')
    expect(admitBreakerCall(state, at - 1).allowed).toBe(false)
    expect(breakerPhase(state, at)).toBe('half_open')

    const first = admitBreakerCall(state, at)
    expect(first).toMatchObject({ allowed: true, changed: true })
    expect(admitBreakerCall(first.state, at + 10).allowed).toBe(false)

    const afterOne = nextBreakerState(first.state, OK, at + 2000)
    expect(breakerPhase(afterOne, at + 2000)).toBe('half_open')
    const second = admitBreakerCall(afterOne, at + 2001)
    expect(second.allowed).toBe(true)

    const closed = nextBreakerState(second.state, OK, at + 4000)
    expect(breakerPhase(closed, at + 4000)).toBe('closed')
    expect(closed.closedAt).toBe(at + 4000)
    expect(admitBreakerCall(closed, at + 4001)).toMatchObject({ allowed: true, changed: false })
  })

  it('counts a probe that reported nothing within the window as a success', () => {
    const { state, now } = opened()
    const at = now + 30_000
    const claimed = admitBreakerCall(state, at).state
    expect(admitBreakerCall(claimed, at + BREAKER_PROBE_TIMEOUT_MS - 1).allowed).toBe(false)

    const silentOnce = admitBreakerCall(claimed, at + BREAKER_PROBE_TIMEOUT_MS)
    expect(silentOnce.allowed).toBe(true)
    expect(silentOnce.state).toMatchObject({ halfOpen: true, halfOpenSuccesses: 1 })

    const secondProbeAt = at + BREAKER_PROBE_TIMEOUT_MS
    const silentTwice = secondProbeAt + BREAKER_PROBE_TIMEOUT_MS
    expect(breakerPhase(silentOnce.state, silentTwice)).toBe('closed')
    expect(nextBreakerState(silentOnce.state, HARD, silentTwice)).toMatchObject({ failures: 1, closedAt: silentTwice })
  })

  it('still re-opens when the probe fails after a silent one', () => {
    const { state, now } = opened()
    const at = now + 30_000
    const first = admitBreakerCall(state, at).state
    const second = admitBreakerCall(first, at + BREAKER_PROBE_TIMEOUT_MS).state
    const failed = nextBreakerState(second, HARD, at + BREAKER_PROBE_TIMEOUT_MS + 2000)
    expect(breakerPhase(failed, at + BREAKER_PROBE_TIMEOUT_MS + 2001)).toBe('open')
    expect(failed.openUntil - (at + BREAKER_PROBE_TIMEOUT_MS + 2000)).toBe(60_000)
  })

  it('re-opens on a probe failure with doubling durations capped at 300 s', () => {
    let { state, now } = opened()
    const durations: number[] = []
    for (let i = 0; i < 6; i++) {
      now = state.openUntil
      state = admitBreakerCall(state, now).state
      state = nextBreakerState(state, HARD, now + 500)
      durations.push(state.openUntil - (now + 500))
    }
    expect(durations).toEqual([60_000, 120_000, 240_000, 300_000, 300_000, 300_000])
    expect(breakerOpenDurationMs(0)).toBe(30_000)
    expect(breakerOpenDurationMs(50)).toBe(300_000)
  })

  it('re-opens on a soft probe failure too', () => {
    const { state, now } = opened()
    const s = nextBreakerState(state, SOFT, now + 30_000)
    expect(breakerPhase(s, now + 30_001)).toBe('open')
  })

  it('keeps the doubling after a recovery and forgets it after 30 min closed', () => {
    const first = opened()
    let at = first.state.openUntil
    let s = nextBreakerState(nextBreakerState(first.state, OK, at), OK, at + 1)
    expect(breakerPhase(s, at + 1)).toBe('closed')
    expect(s.reopenCount).toBe(1)

    // Fails again soon: second open lasts 60 s.
    at += 10_000
    s = run([HARD, HARD, HARD], at, s).state
    expect(s.openUntil - (at + 2000)).toBe(60_000)

    // Recover, then stay quiet for 30 min: the next open is back to 30 s.
    at = s.openUntil
    s = nextBreakerState(nextBreakerState(s, OK, at), OK, at + 1)
    const later = at + 1 + BREAKER_BACKOFF_RESET_MS
    s = run([HARD, HARD, HARD], later, s).state
    expect(s.openUntil - (later + 2000)).toBe(30_000)
  })
})

describe('open and terminal', () => {
  it('ignores late outcomes while open', () => {
    const { state, now } = opened()
    const late = nextBreakerState(state, HARD, now + 5000)
    expect(late.openUntil).toBe(state.openUntil)
    const lateOk = nextBreakerState(state, OK, now + 5000)
    expect(breakerPhase(lateOk, now + 5000)).toBe('open')
  })

  it('opens for 24 h on a terminal failure, then probes', () => {
    const s = nextBreakerState(null, TERMINAL, T0)
    expect(s.terminal).toBe(true)
    expect(s.openUntil).toBe(T0 + BREAKER_TERMINAL_OPEN_MS)
    expect(breakerPhase(s, T0 + 23 * 3600_000)).toBe('open')
    expect(breakerPhase(s, T0 + BREAKER_TERMINAL_OPEN_MS)).toBe('half_open')
  })

  it('upgrades an ordinary open to terminal', () => {
    const { state, now } = opened()
    const s = nextBreakerState(state, TERMINAL, now + 1000)
    expect(s.terminal).toBe(true)
    expect(s.openUntil).toBe(now + 1000 + BREAKER_TERMINAL_OPEN_MS)
  })

  it('reset returns to a fresh closed state', () => {
    const s = nextBreakerState(nextBreakerState(null, TERMINAL, T0), { type: 'reset' }, T0 + 1)
    expect(s).toEqual(initialBreakerState())
  })
})

describe('parseBreakerState / isPristineBreakerState', () => {
  it('rejects garbage and repairs bad fields', () => {
    expect(parseBreakerState(null)).toBeNull()
    expect(parseBreakerState('x')).toBeNull()
    expect(parseBreakerState({ failures: 'a', events: [], openUntil: 0 })).toBeNull()
    const parsed = parseBreakerState({
      failures: 1,
      events: [{ t: T0, weight: 1, ok: false }, { t: 'bad' }, null],
      openUntil: -5,
      reopenCount: 2.7,
    })
    expect(parsed).toMatchObject({ failures: 1, openUntil: 0, reopenCount: 2, halfOpen: false, probeUntil: 0 })
    expect(parsed?.events).toEqual([{ t: T0, weight: 1, ok: false }])
  })

  it('treats success-only closed states as pristine', () => {
    expect(isPristineBreakerState(run([OK, OK]).state)).toBe(true)
    expect(isPristineBreakerState(run([HARD, OK]).state)).toBe(false)
  })
})

describe('breakerFailureKind', () => {
  it('never counts configuration errors', () => {
    const configErrors: unknown[] = [
      new CartesiaError({ status: 404, errorCode: 'voice_not_found', message: 'x' }),
      new CartesiaError({ status: 400, errorCode: null, message: 'bad accent' }),
      { status_code: 422, error_code: null },
      { code: 'model_not_found' },
      { code: 'voice_model_mismatch' },
      { code: 'language_not_supported' },
      { status: 409 },
    ]
    for (const error of configErrors) expect(breakerFailureKind(error)).toBeNull()
    expect(breakerFailureKind({ status: 400, code: 'context_length_exceeded' }, { provider: 'openai' })).toBeNull()
  })

  it('leaves Cartesia quota to the budget flags but treats other providers’ quota as terminal', () => {
    expect(breakerFailureKind({ code: 'quota_exceeded' })).toBeNull()
    expect(breakerFailureKind(new CartesiaError({ status: 402, message: 'x' }), { provider: 'cartesia' })).toBeNull()
    expect(breakerFailureKind({ code: 'quota_exceeded' }, { provider: 'elevenlabs' })).toBe('terminal')
    expect(breakerFailureKind({ status: 429, code: 'insufficient_quota' }, { provider: 'openai' })).toBe('terminal')
  })

  it('classifies key and account errors as terminal', () => {
    expect(breakerFailureKind({ status: 401 })).toBe('terminal')
    expect(breakerFailureKind({ status: 403, code: 'x' }, { provider: 'elevenlabs' })).toBe('terminal')
    expect(breakerFailureKind({ code: 'invalid_api_key' }, { provider: 'openai' })).toBe('terminal')
    expect(breakerFailureKind({ status: 402, code: 'insufficient_credits' }, { provider: 'elevenlabs' })).toBe('terminal')
  })

  it('classifies outages, capacity and unknown errors as hard, slowness as soft', () => {
    expect(breakerFailureKind(new CartesiaError({ status: 0, errorCode: 'timeout', message: 'x' }))).toBe('hard')
    expect(breakerFailureKind({ status: 503 })).toBe('hard')
    expect(breakerFailureKind({ status: 429, code: 'rate_limit_exceeded' }, { provider: 'openai' })).toBe('hard')
    expect(breakerFailureKind({ code: 'concurrency_limited' })).toBe('hard')
    expect(breakerFailureKind({ code: '1006' }, { provider: 'gateway' })).toBe('hard')
    expect(breakerFailureKind(new Error('boom'))).toBe('hard')
    expect(breakerFailureKind(null, { slow: true })).toBe('soft')
  })
})

describe('KV-backed breaker', () => {
  beforeEach(() => {
    kv.store.clear()
    kv.sets = 0
    kv.dels = 0
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(T0)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('is closed with no state and writes nothing for healthy traffic', async () => {
    expect(await isBreakerOpen('cartesia_self')).toBe(false)
    await recordBreakerSuccess('cartesia_self')
    await recordBreakerSuccess('cartesia_self')
    expect(kv.sets).toBe(0)
    expect(kv.store.size).toBe(0)
  })

  it('opens, probes and closes through KV under breaker:<key>', async () => {
    for (let i = 0; i < 3; i++) await recordBreakerFailure('cartesia_self', 'hard')
    expect(kv.store.has('breaker:cartesia_self')).toBe(true)
    expect(kv.store.get('breaker:cartesia_self')?.ttl).toBe(30 + BREAKER_BACKOFF_RESET_MS / 1000)
    expect(await isBreakerOpen('cartesia_self')).toBe(true)
    expect(await getBreakerPhase('cartesia_self')).toBe('open')
    expect(console.warn).toHaveBeenCalledWith('[breaker]', 'cartesia_self opened for 30 s')

    vi.setSystemTime(T0 + 30_000)
    expect(await getBreakerPhase('cartesia_self')).toBe('half_open')
    expect(await isBreakerOpen('cartesia_self')).toBe(false) // probe claimed
    expect(await isBreakerOpen('cartesia_self')).toBe(true) // slot taken

    await recordBreakerSuccess('cartesia_self')
    expect(await isBreakerOpen('cartesia_self')).toBe(false) // second probe
    await recordBreakerSuccess('cartesia_self')
    expect(await getBreakerPhase('cartesia_self')).toBe('closed')
    expect(console.info).toHaveBeenCalledWith('[breaker]', 'cartesia_self closed')

    // The backoff memory is kept (not pristine) until 30 min have passed.
    const snapshot = await getBreakerSnapshot('cartesia_self')
    expect(snapshot).toMatchObject({ key: 'cartesia_self', phase: 'closed', state: { reopenCount: 1 } })
  })

  it('peeking never claims the probe', async () => {
    for (let i = 0; i < 3; i++) await recordBreakerFailure('gateway', 'hard')
    vi.setSystemTime(T0 + 30_000)
    expect(await getBreakerPhase('gateway')).toBe('half_open')
    expect(await getBreakerSnapshot('gateway')).toMatchObject({ phase: 'half_open' })
    expect(await isBreakerOpen('gateway')).toBe(false)
  })

  it('keeps breakers independent and resets on demand', async () => {
    await recordBreakerFailure('elevenlabs', 'terminal')
    expect(await isBreakerOpen('elevenlabs')).toBe(true)
    expect(await isBreakerOpen('cartesia_managed')).toBe(false)
    expect(kv.store.get('breaker:elevenlabs')?.ttl).toBe((BREAKER_TERMINAL_OPEN_MS + BREAKER_BACKOFF_RESET_MS) / 1000)

    await resetBreaker('elevenlabs')
    expect(kv.store.has('breaker:elevenlabs')).toBe(false)
    expect(await isBreakerOpen('elevenlabs')).toBe(false)
  })

  it('removes the record once failures have aged out and a success arrives', async () => {
    await recordBreakerFailure('cartesia_managed', 'hard')
    expect(kv.store.has('breaker:cartesia_managed')).toBe(true)
    vi.setSystemTime(T0 + 61_000)
    await recordBreakerSuccess('cartesia_managed')
    expect(kv.store.has('breaker:cartesia_managed')).toBe(false)
  })

  it('stays closed when callers skip configuration errors', async () => {
    const error = new CartesiaError({ status: 404, errorCode: 'voice_not_found', message: 'Voice not found' })
    for (let i = 0; i < 10; i++) {
      const kind = breakerFailureKind(error, { provider: 'cartesia' })
      if (kind) await recordBreakerFailure('cartesia_self', kind)
    }
    expect(await isBreakerOpen('cartesia_self')).toBe(false)
    expect(kv.sets).toBe(0)
  })
})
