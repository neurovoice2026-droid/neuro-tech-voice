import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// Unauthenticated requests to the public tool/webhook endpoints each emit a
// webhook_verification_failed event: only one per route per minute (per
// instance) may become a provider_events row, the rest are only logged.
// The admin client is mocked: nothing ever leaves the process.
const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))

import { AUTH_FAILURE_PERSIST_WINDOW_MS, emitProviderEvent, resetAuthFailureThrottle, type ProviderEvent } from './telemetry'

const fail = (path: string, system = 'cartesia'): ProviderEvent => ({ system, kind: 'webhook_verification_failed', ok: false, details: { path } })

const rows = () => state.db.tables.provider_events ?? []

async function flush() {
  // The persistence is a dynamic import + promise chain run detached outside a request.
  for (let i = 0; i < 50; i++) await new Promise((r) => setTimeout(r, 0))
}

beforeAll(async () => {
  await import('@/lib/observability/telemetry-store')
})

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.supabase.co')
  vi.stubEnv('LOG_LEVEL', 'warn')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  state.db = memoryDb({ provider_events: [] })
  resetAuthFailureThrottle()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('webhook_verification_failed persistence', () => {
  it('persists at most one per route per minute; the others are logged with a counter, and the next row says how many were suppressed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-07T10:00:00Z'))
    for (let i = 0; i < 50; i++) emitProviderEvent(fail('tools/cartesia-message'))
    await flush()
    expect(rows()).toHaveLength(1)
    const warn = vi.mocked(console.warn).mock.calls.map((c) => String(c[0])).filter((l) => l.includes('"persisted":false'))
    expect(warn).toHaveLength(49)
    expect(warn.at(-1)).toContain('"suppressedInWindow":49')

    // Another route has its own window.
    emitProviderEvent(fail('tools/cartesia-context'))
    emitProviderEvent(fail('elevenlabs/initiation', 'elevenlabs'))
    await flush()
    expect(rows()).toHaveLength(3)

    // Next window: one more row, carrying the count suppressed since the last one.
    vi.setSystemTime(new Date(Date.parse('2026-10-07T10:00:00Z') + AUTH_FAILURE_PERSIST_WINDOW_MS))
    emitProviderEvent(fail('tools/cartesia-message'))
    emitProviderEvent(fail('tools/cartesia-message'))
    await flush()
    expect(rows()).toHaveLength(4)
    expect(rows()[3]).toMatchObject({ kind: 'webhook_verification_failed', details: { path: 'tools/cartesia-message', suppressed_since_last: 49 } })
  })

  it('other event kinds are not throttled', async () => {
    for (let i = 0; i < 5; i++) emitProviderEvent({ system: 'elevenlabs', kind: 'webhook_processing_failed', ok: false, details: { path: 'elevenlabs/webhook' } })
    await vi.waitFor(() => expect(rows()).toHaveLength(5))
  })
})
