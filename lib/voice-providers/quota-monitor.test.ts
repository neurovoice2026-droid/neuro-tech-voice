import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// Shared-workspace credits / voice capacity / billing (GET /v1/user/subscription)
// and platform key health (slice G).

const state: { db: MemoryDb | null; configured: boolean } = { db: null, configured: true }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: () => state.configured }))
const sub = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/elevenlabs/api/subscription', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/elevenlabs/api/subscription')>()),
  getSubscription: (...a: unknown[]) => sub.get(...a),
}))
const due = vi.hoisted(() => ({ value: true }))
vi.mock('./maintenance-state', () => ({
  runIfDue: async (_k: string, _i: number, _l: unknown, fn: () => Promise<unknown>) => (due.value ? fn() : { skipped: 'not_due' }),
}))

import { setProviderEventSink, type ProviderEvent } from '@/lib/observability/telemetry'
import type { ELSubscription } from '@/lib/elevenlabs/api/subscription'
import { ProviderError } from './errors'
import { gradeSubscription, quotaDiagnostics, quotaSnapshot, recordQuotaSnapshot, runQuotaMonitor, QUOTA_STATE_KEY } from './quota-monitor'

const NOW = Date.parse('2026-10-07T12:00:00Z')

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

function subscription(over: Partial<ELSubscription> = {}): ELSubscription {
  return {
    tier: 'business',
    status: 'active',
    character_count: 100_000,
    character_limit: 1_000_000,
    max_credit_limit_extension: 0,
    can_extend_character_limit: false,
    next_character_count_reset_unix: Math.floor(NOW / 1000) + 10 * 86_400,
    voice_slots_used: 100,
    voice_limit: 660,
    voice_add_edit_counter: 50,
    max_voice_add_edits: 1040,
    can_use_instant_voice_cloning: true,
    has_open_invoices: false,
    open_invoices: [],
    ...over,
  }
}

const codes = (s: { problems: Array<{ code: string; level: string }> }) => s.problems.map((p) => `${p.level}:${p.code}`)

let events: ProviderEvent[]
let restore: () => void
beforeEach(() => {
  state.configured = true
  due.value = true
  sub.get.mockReset()
  events = []
  restore = setProviderEventSink((e) => events.push(e))
  for (const k of ['ELEVENLABS_CREDIT_ALERT_PCT', 'ELEVENLABS_CREDIT_CRITICAL_PCT', 'ELEVENLABS_VOICE_SLOTS_MIN_FREE', 'ELEVENLABS_QUOTA_CHECK_MINUTES']) vi.stubEnv(k, '')
  state.db = memoryDb({ maintenance_state: [], provider_events: [] }, { unique: { maintenance_state: [['key']] } })
})
afterEach(() => restore())

describe('gradeSubscription', () => {
  it('is ok with headroom, and reports the reset date', () => {
    const s = gradeSubscription(subscription(), NOW)
    expect(s.status).toBe('ok')
    expect(s.problems).toEqual([])
    expect(s.credits).toMatchObject({ used: 100_000, included: 1_000_000, hard_limit: 1_000_000, used_pct: 10, days_to_reset: 10 })
    expect(s.voice_slots).toEqual({ used: 100, limit: 660, free: 560, used_pct: 15.2 })
  })

  it('warns at 80 % and errors at 95 % of the hard credit limit (thresholds configurable)', () => {
    expect(codes(gradeSubscription(subscription({ character_count: 850_000 }), NOW))).toEqual(['warn:credits_low'])
    expect(codes(gradeSubscription(subscription({ character_count: 960_000 }), NOW))).toEqual(['error:credits_critical'])
    vi.stubEnv('ELEVENLABS_CREDIT_ALERT_PCT', '50')
    expect(codes(gradeSubscription(subscription({ character_count: 600_000 }), NOW))).toEqual(['warn:credits_low'])
  })

  it('counts a capped overage in the hard limit; unlimited overage never hard-stops (warning only)', () => {
    // 1.2 M used, 1 M included + 1 M extension → 60 % of the hard limit.
    expect(codes(gradeSubscription(subscription({ character_count: 1_200_000, can_extend_character_limit: true, max_credit_limit_extension: 1_000_000 }), NOW))).toEqual([])
    const unlimited = gradeSubscription(subscription({ character_count: 1_200_000, can_extend_character_limit: true, max_credit_limit_extension: 'unlimited' }), NOW)
    expect(unlimited.credits?.hard_limit).toBeNull()
    expect(codes(unlimited)).toEqual(['warn:credits_overage'])
    // Extension set but the workspace is not entitled to overages: the included credits are the limit.
    expect(codes(gradeSubscription(subscription({ character_count: 990_000, can_extend_character_limit: false, max_credit_limit_extension: 'unlimited' }), NOW))).toEqual(['error:credits_critical'])
  })

  it('alerts on blocking billing states and open invoices, not on trialing', () => {
    for (const status of ['past_due', 'incomplete', 'free_disabled']) {
      expect(codes(gradeSubscription(subscription({ status }), NOW))).toEqual([`error:subscription_${status}`])
    }
    expect(gradeSubscription(subscription({ status: 'trialing' }), NOW).status).toBe('ok')
    expect(codes(gradeSubscription(subscription({ has_open_invoices: true, open_invoices: [{}, {}] }), NOW))).toEqual(['error:open_invoices'])
  })

  it('grades voice slots, add/edit operations and instant cloning', () => {
    expect(codes(gradeSubscription(subscription({ voice_slots_used: 660 }), NOW))).toEqual(['error:voice_slots_full'])
    expect(codes(gradeSubscription(subscription({ voice_slots_used: 645 }), NOW))).toEqual(['error:voice_slots_full']) // 97.7 %
    expect(codes(gradeSubscription(subscription({ voice_slots_used: 600 }), NOW))).toEqual(['warn:voice_slots_low']) // 90.9 %
    expect(codes(gradeSubscription(subscription({ voice_slots_used: 15, voice_limit: 30 }), NOW))).toEqual(['warn:voice_slots_low']) // fewer than 20 free
    expect(codes(gradeSubscription(subscription({ voice_add_edit_counter: 1000 }), NOW))).toEqual(['error:voice_edits_critical'])
    expect(codes(gradeSubscription(subscription({ max_voice_add_edits: null, voice_add_edit_counter: 999_999 }), NOW))).toEqual([])
    expect(codes(gradeSubscription(subscription({ can_use_instant_voice_cloning: false }), NOW))).toEqual(['warn:instant_cloning_unavailable'])
  })
})

describe('quotaSnapshot', () => {
  it('a key without user_read is "unknown", never "ok"', async () => {
    sub.get.mockRejectedValue(new ProviderError({ system: 'elevenlabs', operation: 'user.subscription', code: 'permission', status: 403 }))
    const s = await quotaSnapshot(logger().log, NOW)
    expect(s).toMatchObject({ status: 'unknown', reason: 'no_permission' })
    expect(codes(s)).toEqual(['warn:quota_unknown'])
  })

  it('an outage is "unknown/unavailable"; not configured is reported as such', async () => {
    sub.get.mockRejectedValue(new ProviderError({ system: 'elevenlabs', operation: 'user.subscription', code: 'upstream', status: 503 }))
    expect(await quotaSnapshot(logger().log, NOW)).toMatchObject({ status: 'unknown', reason: 'unavailable' })
    state.configured = false
    expect(await quotaSnapshot(logger().log, NOW)).toMatchObject({ status: 'unknown', reason: 'not_configured', problems: [] })
  })
})

describe('runQuotaMonitor', () => {
  it('logs an error, emits a provider event and stores the snapshot for diagnostics', async () => {
    sub.get.mockResolvedValue(subscription({ character_count: 990_000, has_open_invoices: true }))
    const { log, calls } = logger()
    const res = await runQuotaMonitor(log, { now: NOW })
    expect(res).toEqual({ status: 'error', problems: ['credits_critical', 'open_invoices'] })
    expect(calls.find((c) => c.level === 'error')?.args[0]).toBe('quota.alert')
    expect(events).toEqual([expect.objectContaining({ system: 'elevenlabs', kind: 'health_check', operation: 'quota_snapshot', ok: false, errorCode: 'credits_critical' })])
    const row = state.db?.tables.maintenance_state.find((r) => r.key === QUOTA_STATE_KEY)
    expect(row?.details).toMatchObject({ status: 'error' })
  })

  it('warns (not errors) for warnings only, and is skipped when not due', async () => {
    sub.get.mockResolvedValue(subscription({ character_count: 850_000 }))
    const { log, calls } = logger()
    await runQuotaMonitor(log, { now: NOW })
    expect(calls.some((c) => c.level === 'error')).toBe(false)
    expect(calls.find((c) => c.level === 'warn')?.args[0]).toBe('quota.warning')
    due.value = false
    expect(await runQuotaMonitor(log, { now: NOW })).toEqual({ skipped: 'not_due' })
  })
})

describe('quotaDiagnostics', () => {
  it('reads the stored snapshot and the key health from telemetry', async () => {
    const db = state.db as MemoryDb
    await recordQuotaSnapshot(gradeSubscription(subscription({ voice_slots_used: 660 }), NOW), logger().log, db as never)
    const recent = new Date(NOW - 3_600_000).toISOString()
    db.tables.provider_events.push(
      { system: 'elevenlabs', kind: 'health_check', operation: null, ok: false, error_code: 'auth', created_at: recent },
      { system: 'elevenlabs', kind: 'health_check', operation: null, ok: true, error_code: null, created_at: new Date(NOW - 7_200_000).toISOString() },
      { system: 'elevenlabs', kind: 'health_check', operation: 'quota_snapshot', ok: true, error_code: null, created_at: new Date(NOW - 60_000).toISOString() },
      { system: 'elevenlabs', kind: 'api_call', operation: 'agents.update', ok: false, error_code: 'quota', created_at: recent },
      { system: 'elevenlabs', kind: 'api_call', operation: 'agents.update', ok: false, error_code: 'quota', created_at: recent },
      { system: 'elevenlabs', kind: 'api_call', operation: 'agents.get', ok: false, error_code: 'timeout', created_at: recent },
    )
    const d = await quotaDiagnostics(db as never, logger().log, { now: NOW })
    expect(d.snapshot?.status).toBe('error')
    expect(d.key_health.last_probe.elevenlabs).toMatchObject({ ok: false, error_code: 'auth' })
    expect(d.key_health.blocked_calls_24h).toEqual({ elevenlabs: { quota: 2 } })
    const messages = d.problems.map((p) => `${p.key}:${p.severity}`)
    expect(messages).toEqual(['ELEVENLABS_QUOTA:error', 'PROVIDER_KEY:error', 'PROVIDER_KEY:error'])
  })

  it('without a snapshot asks for one; with ?probe=1 reads live', async () => {
    const empty = await quotaDiagnostics(state.db as never, logger().log, { now: NOW })
    expect(empty.snapshot).toBeNull()
    expect(empty.problems[0]).toMatchObject({ key: 'ELEVENLABS_QUOTA', severity: 'warning' })
    sub.get.mockResolvedValue(subscription())
    const live = await quotaDiagnostics(state.db as never, logger().log, { now: NOW, probe: true })
    expect(live.snapshot?.status).toBe('ok')
    expect(live.problems).toEqual([])
  })
})
