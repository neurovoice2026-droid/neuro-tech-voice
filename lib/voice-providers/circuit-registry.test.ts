import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryCircuitStore } from './circuit-breaker'
import { forceCircuit, peek, peekProvider, reportOutcome, setCircuitStore, tripCircuit } from './circuit-registry'
import { setProviderEventSink } from '@/lib/observability/telemetry'

let restoreSink: () => void = () => {}
beforeEach(() => {
  setCircuitStore(new MemoryCircuitStore())
  restoreSink = setProviderEventSink(() => {})
})
afterEach(() => {
  restoreSink()
  setCircuitStore(null)
})

describe('circuit registry', () => {
  it('reports the effective state of a forced-open circuit', async () => {
    await forceCircuit('elevenlabs', 'open')
    expect((await peek('elevenlabs')).state).toBe('open')
    expect(await peekProvider('elevenlabs')).toBe('open')
  })

  it("returns to automatic through a half-open probe ('auto'), not straight to closed", async () => {
    await forceCircuit('elevenlabs', 'open')
    await forceCircuit('elevenlabs', null)
    expect((await peek('elevenlabs')).state).toBe('half_open')
    await reportOutcome('elevenlabs', { ok: true })
    expect((await peek('elevenlabs')).state).toBe('closed')
  })

  it('keeps a healthy circuit closed when the override is cleared', async () => {
    await forceCircuit('cartesia', null)
    expect((await peek('cartesia')).state).toBe('closed')
  })

  it('treats a provider as unavailable when either its API or its media circuit is open', async () => {
    for (let i = 0; i < 3; i++) await reportOutcome('elevenlabs_media', { ok: false, code: 'upstream' })
    expect((await peek('elevenlabs')).state).toBe('closed')
    expect((await peek('elevenlabs_media')).state).toBe('open')
    expect(await peekProvider('elevenlabs')).toBe('open')
    // A REST success does not touch the media circuit.
    await reportOutcome('elevenlabs', { ok: true })
    expect(await peekProvider('elevenlabs')).toBe('open')
  })

  it('ignores stale media evidence and never closes an open media circuit, only a half-open one', async () => {
    const t0 = 1_800_000_000_000
    for (let i = 0; i < 3; i++) await reportOutcome('elevenlabs_media', { ok: false, code: 'upstream' }, t0 + i)
    // A call dropped by the outage (started before the failures) proves nothing.
    await reportOutcome('elevenlabs_media', { ok: true }, t0 + 10, { evidenceStartedAt: t0 - 60_000 })
    expect((await peek('elevenlabs_media', t0 + 10)).state).toBe('open')
    // Even fresh evidence does not close it while it is still open...
    await reportOutcome('elevenlabs_media', { ok: true }, t0 + 20, { evidenceStartedAt: t0 + 15 })
    expect((await peek('elevenlabs_media', t0 + 20)).state).toBe('open')
    // ...but after the open period (half-open) a fresh success closes it.
    const later = t0 + 31_000
    expect((await peek('elevenlabs_media', later)).state).toBe('half_open')
    await reportOutcome('elevenlabs_media', { ok: true }, later, { evidenceStartedAt: later - 5_000 })
    expect((await peek('elevenlabs_media', later)).state).toBe('closed')
  })

  it('tripCircuit opens a closed circuit at once and recovery then goes through half-open', async () => {
    const t0 = 1_900_000_000_000
    await tripCircuit('elevenlabs_media', 'upstream', t0)
    expect((await peek('elevenlabs_media', t0)).state).toBe('open')
    expect((await peek('elevenlabs_media', t0 + 31_000)).state).toBe('half_open')
    // A failure while half-open re-opens it (with a longer open period).
    await reportOutcome('elevenlabs_media', { ok: false, code: 'upstream' }, t0 + 31_000)
    expect((await peek('elevenlabs_media', t0 + 61_000)).state).toBe('open')
  })
})
