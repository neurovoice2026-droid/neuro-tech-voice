import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))

import { createLogger } from '@/lib/observability/logger'
import { applyBusinessToolRetention } from './retention'

const NOW = Date.parse('2026-10-07T07:00:00Z')
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const DAY = 86_400_000
let db: MemoryDb

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  db = memoryDb({
    call_slot_offers: [{ id: 'o1', created_at: iso(3 * DAY) }, { id: 'o2', created_at: iso(60_000) }],
    tool_invocations: [{ id: 't1', created_at: iso(8 * DAY) }, { id: 't2', created_at: iso(DAY) }],
    bookings: [
      { id: 'b1', status: 'pending', created_at: iso(20 * 60_000) },
      { id: 'b2', status: 'pending', created_at: iso(60_000) },
      { id: 'b3', status: 'booked', created_at: iso(20 * 60_000) },
    ],
    agents: [
      { id: 'a-30', org_id: 'o1', privacy_settings: { record_audio: true, retention_days: 30 }, metadata: {} },
      { id: 'a-unlimited', org_id: 'o2', privacy_settings: { record_audio: true, retention_days: -1 }, metadata: {} },
      { id: 'a-0', org_id: 'o3', privacy_settings: { record_audio: true, retention_days: 0 }, metadata: {} },
    ],
  })
  state.db = db
})

describe('business_tools_retention', () => {
  it('cleans up old offers and invocations, releases abandoned pending bookings, applies each agent’s retention (min 1 day)', async () => {
    const report = await applyBusinessToolRetention(createLogger({ component: 'test' }), NOW)
    expect(db.tables.call_slot_offers.map((r) => r.id)).toEqual(['o2'])
    expect(db.tables.tool_invocations.map((r) => r.id)).toEqual(['t2'])
    expect(db.tables.bookings.map((r) => [r.id, r.status])).toEqual([['b1', 'cancelled'], ['b2', 'pending'], ['b3', 'booked']])
    expect(report).toMatchObject({ offersDeleted: true, invocationsDeleted: true, pendingReleased: 1, agents: 2, errors: 0 })
    expect(db.rpcCalls).toEqual([
      // Retention 0 still keeps a message for a day, so it can be read before it is cleared.
      { fn: 'apply_business_tool_retention', args: { p_agent_id: 'a-0', p_cutoff: iso(DAY), p_limit: 500 } },
      { fn: 'apply_business_tool_retention', args: { p_agent_id: 'a-30', p_cutoff: iso(30 * DAY), p_limit: 500 } },
    ])
  })
})
