import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CIRCUIT_CONFIG as CFG,
  MemoryCircuitStore,
  decide,
  initialCircuitState,
  recordFailure,
  recordSuccess,
  updateCircuit,
  type CircuitState,
} from './circuit-breaker'

const T0 = 1_700_000_000_000

describe('circuit breaker state machine', () => {
  it('opens after N consecutive health failures', () => {
    let s = initialCircuitState(T0)
    s = recordFailure(s, T0 + 1, 'timeout')
    s = recordFailure(s, T0 + 2, 'upstream')
    expect(s.state).toBe('closed')
    s = recordFailure(s, T0 + 3, 'network')
    expect(s.state).toBe('open')
    expect(s.openUntil).toBe(T0 + 3 + CFG.openMs)
    expect(decide(s, T0 + 4).allowed).toBe(false)
  })

  it('never opens on validation/auth/not_found errors (our own fault)', () => {
    let s = initialCircuitState(T0)
    for (let i = 0; i < 20; i++) s = recordFailure(s, T0 + i, i % 2 ? 'validation' : 'not_found')
    expect(s.state).toBe('closed')
    expect(s.consecutiveFailures).toBe(0)
    expect(s.lastErrorCode).toBe('validation')
  })

  it('opens on failure rate over the window even without consecutive failures', () => {
    let s = initialCircuitState(T0)
    s = recordFailure(s, T0 + 1, 'timeout')
    s = recordSuccess(s, T0 + 2)
    s = recordFailure(s, T0 + 3, 'timeout')
    s = recordSuccess(s, T0 + 4)
    expect(s.state).toBe('closed')
    s = recordFailure(s, T0 + 5, 'upstream') // 3/5 = 60% ≥ 50%
    expect(s.state).toBe('open')
  })

  it('half-opens after the open period and hands out exactly one probe', () => {
    let s = initialCircuitState(T0)
    for (let i = 0; i < 3; i++) s = recordFailure(s, T0 + i, 'timeout')
    const after = T0 + 2 + CFG.openMs
    const first = decide(s, after)
    expect(first.allowed).toBe(true)
    expect(first.probe).toBe(true)
    expect(first.effective).toBe('half_open')
    const second = decide(first.state, after + 10)
    expect(second.allowed).toBe(false) // probe lease held
    const third = decide(first.state, after + CFG.probeLeaseMs + 1)
    expect(third.allowed).toBe(true) // lease expired → another probe
  })

  it('closes after a successful probe and backs off exponentially after a failed one', () => {
    let s = initialCircuitState(T0)
    for (let i = 0; i < 3; i++) s = recordFailure(s, T0 + i, 'timeout')
    const t1 = T0 + 2 + CFG.openMs
    s = decide(s, t1).state
    s = recordFailure(s, t1 + 1, 'timeout')
    expect(s.state).toBe('open')
    expect(s.reopenCount).toBe(1)
    expect(s.openUntil).toBe(t1 + 1 + CFG.openMs * 2)

    const t2 = s.openUntil! + 1
    s = decide(s, t2).state
    s = recordSuccess(s, t2 + 5)
    expect(s.state).toBe('closed')
    expect(s.reopenCount).toBe(0)
    expect(s.consecutiveFailures).toBe(0)
  })

  it('caps the open period', () => {
    let s = initialCircuitState(T0)
    for (let i = 0; i < 3; i++) s = recordFailure(s, T0 + i, 'timeout')
    let t = T0 + 10
    for (let k = 0; k < 10; k++) {
      t = (s.openUntil ?? t) + 1
      s = decide(s, t).state
      s = recordFailure(s, t + 1, 'timeout')
    }
    expect(s.openUntil! - s.openedAt!).toBe(CFG.maxOpenMs)
  })

  it('respects manual overrides', () => {
    const forcedOpen = { ...initialCircuitState(T0), forced: 'open' as const }
    expect(decide(forcedOpen, T0).allowed).toBe(false)
    let forcedClosed: CircuitState = { ...initialCircuitState(T0), forced: 'closed' }
    for (let i = 0; i < 5; i++) forcedClosed = recordFailure(forcedClosed, T0 + i, 'timeout')
    expect(decide(forcedClosed, T0 + 10).allowed).toBe(true)
  })
})

describe('updateCircuit with optimistic store', () => {
  it('persists transitions and reports them', async () => {
    const store = new MemoryCircuitStore()
    let transition = null
    for (let i = 0; i < 3; i++) {
      const r = await updateCircuit(store, 'elevenlabs', T0 + i, (s) => recordFailure(s, T0 + i, 'timeout'))
      transition = r.transition ?? transition
    }
    expect(transition).toMatchObject({ provider: 'elevenlabs', from: 'closed', to: 'open', errorCode: 'timeout' })
    const row = await store.read('elevenlabs')
    expect(row?.state.state).toBe('open')
    expect(row?.version).toBe(3)
  })

  it('retries on a concurrent writer', async () => {
    const store = new MemoryCircuitStore()
    await updateCircuit(store, 'cartesia', T0, (s) => s)
    const realWrite = store.write.bind(store)
    let conflicts = 1
    store.write = async (p, s, v) => {
      if (conflicts-- > 0) {
        await realWrite(p, { ...s }, v) // someone else wins first
        return false
      }
      return realWrite(p, s, v)
    }
    const r = await updateCircuit(store, 'cartesia', T0 + 1, (s) => recordFailure(s, T0 + 1, 'upstream'))
    expect(r.state.consecutiveFailures).toBeGreaterThanOrEqual(1)
  })
})
