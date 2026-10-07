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
    })
    let n = 0
    db.rpc = (fn: string, args: unknown) => {
      db.rpcCalls.push({ fn, args })
      return Promise.resolve({ data: ++n === 1 ? 7 : 0, error: null })
    }
    state.db = db
    const report = await applyCallRetention(log, NOW)
    expect(report).toEqual({ agents: 5, withRetention: 3, purged: 7, errors: 0 })
    const calls = db.rpcCalls.map((c) => c.args as { p_agent_id: string; p_cutoff: string; p_limit: number })
    // Agents in id order; the first one purged 7 of the 500 allowed.
    expect(calls.map((c) => c.p_agent_id)).toEqual(['a-30', 'a-365', 'a-zero'])
    expect(calls[0]).toMatchObject({ p_cutoff: new Date(NOW - 30 * DAY).toISOString(), p_limit: 500 })
    expect(calls[1]).toMatchObject({ p_cutoff: new Date(NOW - 365 * DAY).toISOString(), p_limit: 493 })
    expect(calls[2].p_cutoff).toBe(new Date(NOW).toISOString())
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
