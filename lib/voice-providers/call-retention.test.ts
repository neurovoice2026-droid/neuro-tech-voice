import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// Privacy retention of our own copy, and cadence from a stored last run.

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))

import { applyCallRetention } from './call-retention'
import { claimStep, runIfDue } from './maintenance-state'
import { createLogger } from '@/lib/observability/logger'

const log = createLogger({ component: 'test' })
const NOW = Date.parse('2026-10-07T12:00:00.000Z')
const DAY = 86_400_000

beforeEach(() => vi.stubEnv('CALL_RETENTION_BATCH', ''))

describe('call retention', () => {
  it('purges per agent with an explicit retention_days >= 0, skips unlimited and never-saved agents, and stays within the batch', async () => {
    const db = memoryDb({
      agents: [
        { id: 'a-default', org_id: 'o1', privacy_settings: null, metadata: null }, // never saved: our copies are kept
        { id: 'a-365', org_id: 'o1', privacy_settings: { record_audio: true, retention_days: 365 }, metadata: null },
        { id: 'a-30', org_id: 'o1', privacy_settings: { record_audio: true, retention_days: 30 }, metadata: null },
        { id: 'a-unlimited', org_id: 'o2', privacy_settings: { record_audio: true, retention_days: -1 }, metadata: null },
        { id: 'a-zero', org_id: 'o3', privacy_settings: { record_audio: false, retention_days: 0 }, metadata: null },
      ],
      maintenance_state: [],
    }, { unique: { maintenance_state: [['key']] } })
    let n = 0
    db.rpc = (fn: string, args: unknown) => {
      db.rpcCalls.push({ fn, args })
      return Promise.resolve({ data: ++n === 1 ? 7 : 0, error: null })
    }
    state.db = db
    const report = await applyCallRetention(log, NOW)
    expect(report).toEqual({ agents: 5, withRetention: 3, purged: 7, errors: 0, rounds: 1, deadlineReached: false })
    const calls = db.rpcCalls.map((c) => c.args as { p_agent_id: string; p_cutoff: string; p_limit: number })
    // Agents in id order, each with an equal share of the 500 allowed; none had a full share left over.
    expect(calls.map((c) => c.p_agent_id)).toEqual(['a-30', 'a-365', 'a-zero'])
    expect(calls[0]).toMatchObject({ p_cutoff: new Date(NOW - 30 * DAY).toISOString(), p_limit: 167 })
    expect(calls[1]).toMatchObject({ p_cutoff: new Date(NOW - 365 * DAY).toISOString(), p_limit: 167 })
    expect(calls[2].p_cutoff).toBe(new Date(NOW).toISOString())
    // The next run starts after the last agent served.
    expect(db.tables.maintenance_state).toEqual([expect.objectContaining({ key: 'call_retention_cursor', details: { after_agent_id: 'a-zero' } })])
  })

  it('an RPC failure is logged per agent and the others continue', async () => {
    const db = memoryDb({ agents: [{ id: 'a1', org_id: 'o1', privacy_settings: { retention_days: 30 } }, { id: 'a2', org_id: 'o1', privacy_settings: { retention_days: 30 } }] })
    let n = 0
    // The helper's rpc type only models success; the failure shape is cast in.
    db.rpc = ((fn: string, args: unknown) => {
      db.rpcCalls.push({ fn, args })
      return Promise.resolve(++n === 1 ? { data: null, error: { message: 'boom' } } : { data: 2, error: null })
    }) as unknown as MemoryDb['rpc']
    state.db = db
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await applyCallRetention(log, NOW)).toMatchObject({ purged: 2, errors: 1 })
  })
})

describe('call retention fairness (round-robin, keyset cursor across runs)', () => {
  /** Each agent holds `backlog` purgeable calls; the fake RPC purges up to p_limit of them. */
  function seedBacklogs(backlog: Record<string, number>, cursor?: string) {
    const left = { ...backlog }
    const db = memoryDb(
      {
        agents: Object.keys(backlog).map((id) => ({ id, org_id: 'o1', privacy_settings: { retention_days: 30 }, metadata: null })),
        maintenance_state: cursor ? [{ key: 'call_retention_cursor', last_run_at: '2026-10-07T00:00:00Z', details: { after_agent_id: cursor } }] : [],
      },
      { unique: { maintenance_state: [['key']] } },
    )
    db.rpc = (fn: string, args: unknown) => {
      db.rpcCalls.push({ fn, args })
      const a = args as { p_agent_id: string; p_limit: number }
      const n = Math.min(a.p_limit, left[a.p_agent_id] ?? 0)
      left[a.p_agent_id] = (left[a.p_agent_id] ?? 0) - n
      return Promise.resolve({ data: n, error: null })
    }
    state.db = db
    return { db, left }
  }

  it('a huge backlog on the first agent never starves the agents after it, and the batch is used up in later rounds', async () => {
    vi.stubEnv('CALL_RETENTION_BATCH', '300')
    const { db, left } = seedBacklogs({ 'a1-huge': 100_000, 'a2-small': 10, 'a3-medium': 150 })
    const report = await applyCallRetention(log, NOW)
    expect(report.purged).toBe(300)
    // Round 1: a share of 100 each (a2 drained with 10); round 2 splits the 90
    // left equally between the two agents that still had calls (45 each).
    expect(left['a2-small']).toBe(0)
    expect(left['a3-medium']).toBe(150 - 145)
    expect(left['a1-huge']).toBe(100_000 - 145)
    expect(report.rounds).toBe(2)
    expect(db.rpcCalls.length).toBeLessThan(10)
  })

  it('resumes after the agent the previous run stopped at, wrapping around (keyset cursor)', async () => {
    vi.stubEnv('CALL_RETENTION_BATCH', '50')
    const agents = Object.fromEntries(['a1', 'a2', 'a3', 'a4'].map((id) => [id, 1000]))
    const first = seedBacklogs(agents)
    await applyCallRetention(log, NOW)
    // 50 shared 25/25 (minimum share): a1 and a2 served, the cursor is on a2.
    expect(first.db.rpcCalls.map((c) => (c.args as { p_agent_id: string }).p_agent_id)).toEqual(['a1', 'a2'])
    const cursor = (first.db.tables.maintenance_state[0].details as { after_agent_id: string }).after_agent_id
    expect(cursor).toBe('a2')

    const second = seedBacklogs(agents, cursor)
    await applyCallRetention(log, NOW)
    expect(second.db.rpcCalls.map((c) => (c.args as { p_agent_id: string }).p_agent_id)).toEqual(['a3', 'a4'])
    expect((second.db.tables.maintenance_state[0].details as { after_agent_id: string }).after_agent_id).toBe('a4')

    const third = seedBacklogs(agents, 'a4')
    await applyCallRetention(log, NOW)
    expect(third.db.rpcCalls.map((c) => (c.args as { p_agent_id: string }).p_agent_id)).toEqual(['a1', 'a2'])
  })

  it('stops at the step deadline and keeps its place', async () => {
    const { db } = seedBacklogs({ a1: 1000, a2: 1000, a3: 1000 })
    const report = await applyCallRetention(log, NOW, { deadline: Date.now() - 1 })
    expect(report).toMatchObject({ deadlineReached: true, purged: 0, rounds: 0 })
    expect(db.rpcCalls).toHaveLength(0)
    // Nothing served: the cursor is left where it was.
    expect(db.tables.maintenance_state).toEqual([])
  })
})

describe('maintenance cadence from a stored last run', () => {
  it('claims once per interval, whatever the cron cadence', async () => {
    state.db = memoryDb({ maintenance_state: [] }, { unique: { maintenance_state: [['key']] } })
    expect(await claimStep('retention', 3_600_000, log, NOW)).toBe('claimed')
    expect(await claimStep('retention', 3_600_000, log, NOW + 60_000)).toBe('not_due')
    expect(await claimStep('retention', 3_600_000, log, NOW + 3_600_001)).toBe('claimed')
    const fn = vi.fn(async () => 'ran')
    expect(await runIfDue('retention', 3_600_000, log, fn, NOW + 3_600_002)).toEqual({ skipped: 'not_due' })
    expect(fn).not.toHaveBeenCalled()
  })

  it('runs the bounded step anyway when the state table is unavailable', async () => {
    const db = memoryDb({})
    const from = db.from
    db.from = (t: string) => {
      const q = from(t)
      ;(q as unknown as { maybeSingle: () => Promise<unknown> }).maybeSingle = () => Promise.resolve({ data: null, error: { message: 'relation "maintenance_state" does not exist' } })
      return q
    }
    state.db = db
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fn = vi.fn(async () => 'ran')
    expect(await runIfDue('retention', 3_600_000, log, fn, NOW)).toBe('ran')
  })
})
