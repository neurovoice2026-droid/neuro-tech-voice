import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Slice G bug fix (maintenance.ts:39): a health probe failing with auth,
// permission or quota (revoked / auto-disabled key, missing scope, credits
// exhausted) is an alert for every tenant: error log + provider event, not a
// warning. Health signals still feed the circuit; other codes stay warnings.

const health = vi.hoisted(() => ({ elevenlabs: vi.fn(), cartesia: vi.fn() }))
vi.mock('./adapters', () => ({ LIFECYCLES: { elevenlabs: { health: () => health.elevenlabs() }, cartesia: { health: () => health.cartesia() } } }))
const reportOutcome = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('./circuit-registry', () => ({ reportOutcome }))

import { probeProviders } from './maintenance'
import { setProviderEventSink, type ProviderEvent } from '@/lib/observability/telemetry'

type LogCall = { level: string; args: unknown[] }
function logger() {
  const calls: LogCall[] = []
  const l: Record<string, unknown> = {
    info: (...args: unknown[]) => calls.push({ level: 'info', args }),
    warn: (...args: unknown[]) => calls.push({ level: 'warn', args }),
    error: (...args: unknown[]) => calls.push({ level: 'error', args }),
    debug: () => {},
  }
  l.child = () => l
  return { log: l as unknown as import('@/lib/observability/logger').Logger, calls }
}

const result = (provider: string, errorCode: string | null) => ({ provider, configured: true, ok: errorCode === null, latencyMs: 10, errorCode, checkedAt: new Date().toISOString() })

let events: ProviderEvent[]
let restore: () => void
beforeEach(() => {
  events = []
  restore = setProviderEventSink((e) => events.push(e))
  reportOutcome.mockClear()
  health.cartesia.mockResolvedValue(result('cartesia', null))
})
afterEach(() => restore())

describe('probeProviders', () => {
  for (const code of ['auth', 'permission', 'quota']) {
    it(`"${code}" is logged as an error with a provider_blocked event, and never feeds the circuit`, async () => {
      health.elevenlabs.mockResolvedValue(result('elevenlabs', code))
      const { log, calls } = logger()
      await probeProviders(log)
      expect(calls).toContainEqual({ level: 'error', args: ['maintenance.provider_blocked', null, { provider: 'elevenlabs', code }] })
      expect(calls.some((c) => c.args[0] === 'maintenance.health_non_signal')).toBe(false)
      expect(events).toContainEqual(expect.objectContaining({ system: 'elevenlabs', kind: 'health_check', operation: 'provider_blocked', ok: false, errorCode: code }))
      expect(reportOutcome).not.toHaveBeenCalledWith('elevenlabs', expect.objectContaining({ ok: false }))
    })
  }

  it('health signals still feed the circuit; other codes stay warnings', async () => {
    health.elevenlabs.mockResolvedValue(result('elevenlabs', 'upstream'))
    await probeProviders(logger().log)
    expect(reportOutcome).toHaveBeenCalledWith('elevenlabs', { ok: false, code: 'upstream' })
    health.elevenlabs.mockResolvedValue(result('elevenlabs', 'validation'))
    const { log, calls } = logger()
    await probeProviders(log)
    expect(calls).toContainEqual({ level: 'warn', args: ['maintenance.health_non_signal', { provider: 'elevenlabs', code: 'validation' }] })
    expect(calls.some((c) => c.level === 'error')).toBe(false)
  })
})
