import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// Billing safety net from Twilio's duration: every skip condition is a SQL
// filter, so rows the step never bills (test sessions, Twilio leg not ended)
// cannot fill the oldest-first batch and starve newer calls.

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const recordUsage = vi.fn()
vi.mock('./call-store', () => ({ recordUsage: (...a: unknown[]) => recordUsage(...a) }))

import { finalizeStaleElevenLabsCalls } from './stale-calls'
import { createLogger } from '@/lib/observability/logger'

const NOW = Date.parse('2026-10-07T12:00:00.000Z')
const ORG = '11111111-1111-4111-8111-111111111111'
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString()

/** memoryDb knows plain columns only: add the JSON path filter the scan uses, and record every filter. */
function withJsonPathIn(db: MemoryDb, seen: Array<[string, unknown]>): MemoryDb {
  const from = db.from
  db.from = (t: string) => {
    const q = from(t) as unknown as Record<string, unknown> & { filters: Array<(r: Record<string, unknown>) => boolean> }
    for (const op of ['eq', 'in'] as const) {
      const orig = (q[op] as (c: string, v: unknown) => unknown).bind(q)
      q[op] = (c: string, v: unknown) => {
        seen.push([`${op}:${c}`, v])
        const m = /^(\w+)->>(\w+)$/.exec(c)
        if (!m) return orig(c, v)
        q.filters.push((r) => {
          const json = r[m[1]] as Record<string, unknown> | null
          const value = json && typeof json === 'object' ? json[m[2]] : undefined
          return op === 'in' ? (v as unknown[]).includes(value) : value === v
        })
        return q
      }
    }
    return q as unknown as ReturnType<MemoryDb['from']>
  }
  return db
}

function row(id: string, minAgo: number, over: Record<string, unknown> = {}) {
  return {
    id, org_id: ORG, provider: 'elevenlabs', status: 'in-progress', lifecycle_rank: 20, is_test: false, reconcile_attempts: 1,
    created_at: iso(minAgo), routing: { twilio_status: 'completed', twilio_duration: 75 }, usage_recorded_at: null, duration_seconds: null, ...over,
  }
}

let seen: Array<[string, unknown]>
beforeEach(() => {
  recordUsage.mockReset().mockResolvedValue(undefined)
  seen = []
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('finalizeStaleElevenLabsCalls', () => {
  it('filters test sessions and calls without a terminal Twilio status in SQL', async () => {
    state.db = withJsonPathIn(memoryDb({ calls: [] }), seen)
    await finalizeStaleElevenLabsCalls(50, createLogger({ component: 'test' }), NOW)
    expect(seen).toContainEqual(['eq:is_test', false])
    expect(seen).toContainEqual(['in:routing->>twilio_status', ['completed', 'busy', 'failed', 'no-answer', 'canceled']])
  })

  it('older rows it never bills cannot starve a newer call out of the batch', async () => {
    const old: Array<Record<string, unknown>> = []
    // A full batch of older browser tests (no Twilio leg) and of calls whose Twilio leg is still up.
    for (let i = 0; i < 3; i++) old.push(row(`web-${i}`, 600 - i, { is_test: true, routing: { mode: 'web_test' } }))
    for (let i = 0; i < 3; i++) old.push(row(`live-${i}`, 500 - i, { routing: { twilio_status: 'in-progress' } }))
    const db = withJsonPathIn(memoryDb({ calls: [...old, row('billable', 90)] }), seen)
    state.db = db
    const res = await finalizeStaleElevenLabsCalls(3, createLogger({ component: 'test' }), NOW)
    expect(res).toEqual({ scanned: 1, finalized: 1 })
    expect(recordUsage).toHaveBeenCalledTimes(1)
    expect(recordUsage.mock.calls[0][1]).toMatchObject({ orgId: ORG, callId: 'billable', seconds: 75, source: 'twilio_call_duration' })
    const byId = Object.fromEntries(db.tables.calls.map((c) => [c.id, c]))
    expect(byId.billable).toMatchObject({ lifecycle_rank: 40, status: 'completed', duration_seconds: 75 })
    for (const id of ['web-0', 'live-0']) expect(byId[id]).toMatchObject({ lifecycle_rank: 20, status: 'in-progress' })
  })

  it('a busy / no-answer leg is finalized with that status and nothing to bill', async () => {
    const db = withJsonPathIn(memoryDb({ calls: [row('busy', 120, { routing: { twilio_status: 'busy', twilio_duration: 0 } })] }), seen)
    state.db = db
    expect(await finalizeStaleElevenLabsCalls(50, createLogger({ component: 'test' }), NOW)).toEqual({ scanned: 1, finalized: 1 })
    expect(recordUsage).not.toHaveBeenCalled()
    expect(db.tables.calls[0]).toMatchObject({ status: 'busy', lifecycle_rank: 40 })
  })
})
