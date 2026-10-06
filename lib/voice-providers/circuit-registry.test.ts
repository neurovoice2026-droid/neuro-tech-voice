import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryCircuitStore } from './circuit-breaker'
import { forceCircuit, peek, peekProvider, reportOutcome, setCircuitStore } from './circuit-registry'
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
})
