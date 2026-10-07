import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// Maintenance budget starvation: the cheap billing/privacy steps run first,
// the long tail's start rotates (persisted) so every step eventually runs,
// and agent sync retries never let unsyncable rows block the batch.

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const syncAgent = vi.fn()
vi.mock('./agent-sync', () => ({ syncAgent: (...a: unknown[]) => syncAgent(...a) }))

import { SKIPPED_SYNC_RETRY_DELAY_MS, TAIL_ROTATION_KEY, maintenanceSteps, retryAgentSyncs, runMaintenanceSteps, type MaintenanceStep } from './maintenance'
import type { Logger } from '@/lib/observability/logger'

function logger() {
  const calls: Array<{ level: string; args: unknown[] }> = []
  const l: Record<string, unknown> = {
    info: (...args: unknown[]) => calls.push({ level: 'info', args }),
    warn: (...args: unknown[]) => calls.push({ level: 'warn', args }),
    error: (...args: unknown[]) => calls.push({ level: 'error', args }),
    debug: () => {},
  }
  l.child = () => l
  return { log: l as unknown as Logger, calls }
}

function stateDb() {
  return memoryDb({ maintenance_state: [] }, { unique: { maintenance_state: [['key']] } })
}

describe('maintenance step order', () => {
  it('runs the cheap billing, call-data and privacy steps first; every step is still scheduled exactly once', () => {
    const { head, tail } = maintenanceSteps(logger().log)
    expect(head.map(([n]) => n)).toEqual([
      'health',
      'agent_sync_retries',
      'webhook_retries',
      'cartesia_poll',
      'conversation_reconcile',
      'stale_elevenlabs_calls',
      'web_test_finalize',
      'call_retention',
      'business_tools_retention',
      'retention',
      'elevenlabs_quota',
      'elevenlabs_workspace_health',
    ])
    const all = [...head, ...tail].map(([n]) => n)
    expect(new Set(all).size).toBe(all.length)
    expect(tail.map(([n]) => n).sort()).toEqual(
      ['account_deletions', 'config_rollout', 'default_voice_migration', 'knowledge_retries', 'knowledge_sync', 'library_voices', 'platform_tools', 'rejected_clones', 'voice_housekeeping', 'voice_orphans', 'voice_saves'].sort(),
    )
  })
})

describe('runMaintenanceSteps (budget and tail rotation)', () => {
  /** Steps that advance a fake clock by their cost and record that they ran. */
  function fakeRun(costs: { head: Record<string, number>; tail: Record<string, number> }) {
    const clock = { now: 1_000_000 }
    const ran: string[] = []
    const deadlines: number[] = []
    const make = (costsOf: Record<string, number>): MaintenanceStep[] =>
      Object.entries(costsOf).map(([name, cost]) => [
        name,
        async (deadline: number) => {
          ran.push(name)
          deadlines.push(deadline)
          clock.now += cost
          return { ok: name }
        },
      ])
    return { steps: { head: make(costs.head), tail: make(costs.tail) }, clock, ran, deadlines }
  }

  it('the head always runs first; the next run starts the tail at the first step deferred, so every step eventually runs', async () => {
    const db = stateDb()
    const costs = { head: { h1: 1, h2: 1, h3: 1 }, tail: { t0: 80, t1: 10, t2: 10, t3: 10 } }
    const everRan = new Set<string>()
    const order: string[][] = []
    for (let i = 0; i < 3; i++) {
      const r = fakeRun(costs)
      const report = await runMaintenanceSteps(r.steps, logger().log, { budgetMs: 100, clock: () => r.clock.now, db: db as never })
      expect(r.ran.slice(0, 3)).toEqual(['h1', 'h2', 'h3'])
      for (const n of r.ran) everRan.add(n)
      order.push(r.ran.slice(3))
      expect(report.h1).toEqual({ ok: 'h1' })
    }
    expect(order).toEqual([
      ['t0', 't1', 't2'], // t3 deferred
      ['t3', 't0', 't1'], // starts with t3; t2 deferred
      ['t2', 't3', 't0'],
    ])
    expect(everRan).toEqual(new Set(['h1', 'h2', 'h3', 't0', 't1', 't2', 't3']))
    expect(db.tables.maintenance_state).toEqual([expect.objectContaining({ key: TAIL_ROTATION_KEY, details: { next_index: 1, next_step: 't1' } })])
  })

  it('a step that always eats the whole budget no longer starves the steps listed after it', async () => {
    const db = stateDb()
    const costs = { head: { h: 1 }, tail: { slow: 500, a: 1, b: 1 } }
    const runs: string[][] = []
    for (let i = 0; i < 3; i++) {
      const r = fakeRun(costs)
      await runMaintenanceSteps(r.steps, logger().log, { budgetMs: 100, clock: () => r.clock.now, db: db as never })
      runs.push(r.ran)
    }
    expect(runs[0]).toEqual(['h', 'slow'])
    // From then on the cheap ones run first, then the slow one with what is left.
    expect(runs[1]).toEqual(['h', 'a', 'b', 'slow'])
    expect(runs[2]).toEqual(['h', 'a', 'b', 'slow'])
  })

  it('deferred steps are reported, every step gets the run deadline, and a failing step never stops the others', async () => {
    const db = stateDb()
    const r = fakeRun({ head: { h1: 1 }, tail: { t1: 1, t2: 1 } })
    r.steps.head.push(['boom', async () => { throw new Error('exploded') }])
    const { log, calls } = logger()
    const report = await runMaintenanceSteps(r.steps, log, { budgetMs: 50, clock: () => r.clock.now, db: db as never })
    expect(report.boom).toEqual({ error: 'exploded' })
    expect(r.ran).toEqual(['h1', 't1', 't2'])
    expect(new Set(r.deadlines)).toEqual(new Set([1_000_000 + 50]))
    expect(calls.some((c) => c.level === 'error' && c.args[0] === 'maintenance.step_failed')).toBe(true)

    const late = fakeRun({ head: { h1: 100 }, tail: { t1: 1 } })
    const deferred = await runMaintenanceSteps(late.steps, log, { budgetMs: 50, clock: () => late.clock.now, db: stateDb() as never })
    expect(deferred.t1).toEqual({ skipped: 'time_budget' })
    expect(deferred.maintenance_rotation).toEqual({ tail_start: 't1', next_tail_start: 't1', deferred: true })
  })

  it('an unreadable rotation state starts the tail at its first step', async () => {
    const db = stateDb()
    const from = db.from
    db.from = (t: string) => {
      const q = from(t)
      ;(q as unknown as { maybeSingle: () => Promise<unknown> }).maybeSingle = () => Promise.resolve({ data: null, error: { message: 'relation does not exist' } })
      return q
    }
    const r = fakeRun({ head: {}, tail: { t1: 1, t2: 1 } })
    await runMaintenanceSteps(r.steps, logger().log, { budgetMs: 50, clock: () => r.clock.now, db: db as never })
    expect(r.ran).toEqual(['t1', 't2'])
  })
})

describe('retryAgentSyncs', () => {
  const NOW = Date.parse('2026-10-07T12:00:00.000Z')
  const res = (agent_id: string, over: Record<string, unknown> = {}) => ({
    id: `r-${agent_id}`, org_id: 'o1', agent_id, provider: 'elevenlabs', status: 'failed', next_retry_at: null, ...over,
  })
  let orderCalls: unknown[][]

  beforeEach(() => {
    syncAgent.mockReset()
    orderCalls = []
  })

  function seed(rows: Array<Record<string, unknown>>, orgs: Array<Record<string, unknown>> = [{ id: 'o1', deletion_requested_at: null }]) {
    const db = memoryDb({ agent_provider_resources: rows, organizations: orgs })
    const from = db.from
    db.from = (t: string) => {
      const q = from(t)
      const order = q.order.bind(q)
      q.order = (...a: Parameters<typeof q.order>) => {
        orderCalls.push([t, ...a])
        return order(...a)
      }
      return q
    }
    state.db = db
    return db
  }

  it('oldest retry first (never-scheduled rows first), and rows that could not sync are pushed back instead of blocking the batch', async () => {
    const db = seed([res('a-empty'), res('a-unconfigured'), res('a-ok'), res('a-busy')])
    syncAgent.mockImplementation(async (id: string) => {
      if (id === 'a-empty') return []
      if (id === 'a-unconfigured') return [{ provider: 'elevenlabs', status: 'skipped', errorCode: 'not_configured' }]
      if (id === 'a-busy') return [{ provider: 'elevenlabs', status: 'in_progress' }]
      return [{ provider: 'elevenlabs', status: 'ready' }]
    })
    const before = Date.now()
    const done = await retryAgentSyncs(20, logger().log, { now: NOW })
    expect(orderCalls).toContainEqual(['agent_provider_resources', 'next_retry_at', { ascending: true, nullsFirst: true }])
    expect(done.map((d) => [d.agentId, d.status])).toEqual([
      ['a-empty', 'skipped'],
      ['a-unconfigured', 'skipped'],
      ['a-ok', 'ready'],
      ['a-busy', 'in_progress'],
    ])
    const byId = Object.fromEntries(db.tables.agent_provider_resources.map((r) => [r.agent_id, r]))
    for (const id of ['a-empty', 'a-unconfigured']) {
      const at = Date.parse(byId[id].next_retry_at as string)
      expect(at).toBeGreaterThanOrEqual(before + SKIPPED_SYNC_RETRY_DELAY_MS)
    }
    // A sync that ran (or holds the lease) decides its own next_retry_at.
    expect(byId['a-ok'].next_retry_at).toBeNull()
    expect(byId['a-busy'].next_retry_at).toBeNull()
  })

  it('never syncs an organisation being deleted (its rows are pushed back) and stops at the deadline', async () => {
    const db = seed(
      [res('a-deleting', { org_id: 'o-del' }), res('a-1'), res('a-2')],
      [{ id: 'o1', deletion_requested_at: null }, { id: 'o-del', deletion_requested_at: '2026-10-07T10:00:00Z' }],
    )
    syncAgent.mockResolvedValue([{ provider: 'elevenlabs', status: 'ready' }])
    const done = await retryAgentSyncs(20, logger().log, { now: NOW })
    expect(syncAgent.mock.calls.map((c) => c[0])).toEqual(['a-1', 'a-2'])
    expect(done[0]).toEqual({ agentId: 'a-deleting', provider: 'elevenlabs', status: 'skipped_deleting' })
    expect(db.tables.agent_provider_resources.find((r) => r.agent_id === 'a-deleting')?.next_retry_at).toBeTruthy()

    syncAgent.mockClear()
    seed([res('a-1'), res('a-2')])
    const late = await retryAgentSyncs(20, logger().log, { now: NOW, deadline: Date.now() - 1 })
    expect(syncAgent).not.toHaveBeenCalled()
    expect(late.map((d) => d.status)).toEqual(['deferred', 'deferred'])
  })
})
