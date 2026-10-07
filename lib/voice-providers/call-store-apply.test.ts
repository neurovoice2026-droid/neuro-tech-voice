import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import type { NormalizedCallEvent } from './types'

// applyCallEvent end to end against an in-memory database (slice D):
// non-telephony sessions, native-number mapping, test rows, tombstones,
// provider cost kept off the calls row, workflow context.

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const elDelete = vi.fn()
vi.mock('@/lib/elevenlabs/client', () => ({ conversations: { delete: (...a: unknown[]) => elDelete(...a) } }))
const executeWorkflows = vi.fn()
vi.mock('@/lib/workflows/executor', () => ({ executeWorkflows: (...a: unknown[]) => executeWorkflows(...a) }))
vi.mock('./circuit-registry', () => ({ reportOutcome: vi.fn(async () => undefined) }))
vi.mock('@/lib/email/client', () => ({ sendEmail: vi.fn() }))

import { applyCallEvent } from './call-store'
import { ProviderError } from './errors'
import { signCallToken } from '@/lib/telephony/tokens'

const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG = '22222222-2222-4222-8222-222222222222'
const AGENT = 'a1111111-1111-4111-8111-111111111111'
const CALL = 'c0000000-0000-4000-8000-000000000001'

function event(over: Partial<NormalizedCallEvent> = {}): NormalizedCallEvent {
  return {
    provider: 'elevenlabs',
    kind: 'call.completed',
    providerCallId: 'conv_1',
    externalAgentId: 'agent_el_1',
    localCallId: null,
    twilioCallSid: null,
    direction: 'inbound',
    fromNumber: '+40712345123',
    toNumber: '+40312345678',
    startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    durationSeconds: 90,
    status: 'completed',
    transcript: [{ role: 'agent', message: 'Hi', time_in_call_secs: 0 }],
    summary: 'Booked',
    summaryTitle: 'Booking',
    callSuccessful: 'failure',
    analysis: { evaluation: {}, data: { caller_name: 'Ana', reason_for_call: 'booking', outcome: 'booked' } },
    terminationReason: 'Call ended by remote party',
    costCredits: 900,
    costUsd: 0.5,
    hasRecording: true,
    failureReason: null,
    eventTimestamp: null,
    channel: 'phone',
    metadata: { channel: 'phone', main_language: 'ro', phone_number_external_id: 'pn_1' },
    charging: { isBurst: true, tier: 'pro', devDiscount: false, llmPrice: 0.01, platformPrice: 0.08 },
    ...over,
  }
}

/** memoryDb's contains() only knows arrays; wasDeleted() queries a jsonb object. */
function withJsonContains(db: MemoryDb): MemoryDb {
  const from = db.from
  db.from = (t: string) => {
    const q = from(t) as unknown as { contains: (c: string, v: unknown) => unknown; filters: Array<(r: Record<string, unknown>) => boolean> }
    const arrayContains = q.contains.bind(q)
    q.contains = (c: string, v: unknown) => {
      if (Array.isArray(v)) return arrayContains(c, v)
      const want = v as Record<string, unknown[]>
      q.filters.push((r) => Object.entries(want).every(([k, vals]) => Array.isArray((r[c] as Record<string, unknown> | null)?.[k]) && vals.every((x) => ((r[c] as Record<string, unknown[]>)[k]).includes(x))))
      return q
    }
    return q as unknown as ReturnType<MemoryDb['from']>
  }
  return db
}

function seed(extra: Record<string, Array<Record<string, unknown>>> = {}) {
  state.db = withJsonContains(
    memoryDb(
      {
        agent_provider_resources: [{ org_id: ORG, agent_id: AGENT, provider: 'elevenlabs', external_id: 'agent_el_1' }],
        phone_numbers: [
          { id: 'num-other', org_id: OTHER_ORG, elevenlabs_phone_number_id: 'pn_1' },
          { id: 'num-ours', org_id: ORG, elevenlabs_phone_number_id: 'pn_1' },
        ],
        calls: [],
        audit_log: [],
        call_provider_costs: [],
        ...extra,
      },
      { unique: { call_provider_costs: [['call_id', 'provider']] } },
    ),
  )
  return state.db
}

beforeEach(() => {
  vi.stubEnv('VOICE_TOKEN_SECRET', 'test-secret-0123456789-abcdefghijklmnop')
  elDelete.mockReset()
  executeWorkflows.mockReset().mockResolvedValue(undefined)
})

describe('applyCallEvent — conversation source classification', () => {
  it('stores a web/SDK/dashboard session as a test call: no billing, no workflows', async () => {
    const db = seed()
    const res = await applyCallEvent(event({ channel: 'web', direction: null, fromNumber: null, toNumber: null, metadata: { channel: 'web', initiation_source: 'react_sdk' } }))
    expect(res).toMatchObject({ outcome: 'created', test: true })
    const row = db.tables.calls[0]
    expect(row).toMatchObject({ channel: 'web', is_test: true, phone_number_id: null })
    expect((row.routing as { mode: string }).mode).toBe('test')
    expect(db.rpcCalls.filter((c) => c.fn === 'record_call_usage')).toHaveLength(0)
    expect(executeWorkflows).not.toHaveBeenCalled()
  })

  it('a native phone call is billed once, mapped to the owner org\'s number, and runs workflows with the collected data', async () => {
    const db = seed()
    const res = await applyCallEvent(event())
    expect(res).toMatchObject({ outcome: 'created', test: false })
    const row = db.tables.calls[0]
    expect(row).toMatchObject({ channel: 'phone', is_test: false, phone_number_id: 'num-ours', org_id: ORG })
    const usage = db.rpcCalls.filter((c) => c.fn === 'record_call_usage')
    expect(usage).toHaveLength(1)
    expect(usage[0].args).toMatchObject({ p_org_id: ORG, p_seconds: 90, p_source: 'elevenlabs_webhook' })
    // call_ended + the "AI marked the call unsuccessful" trigger (sentiment_negative).
    expect(executeWorkflows.mock.calls.map((c) => c[0])).toEqual(['call_ended', 'sentiment_negative', 'keyword_detected'])
    const ctx = executeWorkflows.mock.calls[0][1]
    expect(ctx).toMatchObject({ call_successful: 'failure', outcome: 'booked', summary_title: 'Booking', collected: { caller_name: 'Ana', reason_for_call: 'booking', outcome: 'booked' } })
  })

  it('a reconciliation poll bills with its own source label', async () => {
    const db = seed()
    await applyCallEvent(event(), undefined, { source: 'poll' })
    expect(db.rpcCalls.find((c) => c.fn === 'record_call_usage')?.args).toMatchObject({ p_source: 'elevenlabs_poll' })
  })

  it('a pre-created test row (web test session) is never billed nor triggers workflows', async () => {
    const token = signCallToken(CALL, 'transfer', 3600)
    const db = seed({ calls: [{ id: CALL, org_id: ORG, agent_id: AGENT, status: 'in-progress', lifecycle_rank: 20, provider: 'elevenlabs', is_test: true, channel: 'web', updated_at: 'u1', direction: 'inbound' }] })
    const res = await applyCallEvent(event({ localCallId: CALL, localCallToken: token }))
    expect(res).toMatchObject({ callId: CALL, outcome: 'updated', test: true })
    expect(db.rpcCalls.filter((c) => c.fn === 'record_call_usage')).toHaveLength(0)
    expect(executeWorkflows).not.toHaveBeenCalled()
    expect(db.tables.calls[0].lifecycle_rank).toBe(50)
  })

  it('keeps provider cost off the calls row and in call_provider_costs (with burst)', async () => {
    const db = seed()
    await applyCallEvent(event())
    const row = db.tables.calls[0]
    expect(row.cost_usd).toBeUndefined()
    expect(row.cost_credits).toBeUndefined()
    expect(db.tables.call_provider_costs).toEqual([
      expect.objectContaining({ call_id: row.id, org_id: ORG, provider: 'elevenlabs', cost_usd: 0.5, cost_credits: 900, is_burst: true, tier: 'pro' }),
    ])
  })
})

describe('applyCallEvent — deleted calls', () => {
  it('a late event for a tombstoned call deletes the provider conversation and never recreates the row', async () => {
    const db = seed({ audit_log: [{ id: 'a1', org_id: ORG, action: 'call.deleted', target_id: CALL, details: { provider_call_ids: ['conv_1'] } }] })
    elDelete.mockResolvedValue(undefined)
    const res = await applyCallEvent(event())
    expect(res).toEqual({ callId: null, outcome: 'deleted' })
    expect(elDelete).toHaveBeenCalledWith('conv_1', { orgId: ORG })
    expect(db.tables.calls).toHaveLength(0)
    expect(db.rpcCalls).toHaveLength(0)
  })

  it('matches the tombstone by the trusted call id when the conversation id was never known', async () => {
    seed({ audit_log: [{ id: 'a1', org_id: ORG, action: 'call.deleted', target_id: CALL, details: { provider_call_ids: [] } }] })
    elDelete.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'conversations.delete', status: 404 }))
    const res = await applyCallEvent(event({ localCallId: CALL, localCallToken: signCallToken(CALL, 'transfer', 3600) }))
    expect(res.outcome).toBe('deleted')
    expect(elDelete).toHaveBeenCalledTimes(1)
  })

  it('a provider failure throws so the stored webhook event is retried', async () => {
    seed({ audit_log: [{ id: 'a1', org_id: ORG, action: 'call.deleted', target_id: CALL, details: { provider_call_ids: ['conv_1'] } }] })
    elDelete.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'upstream', operation: 'conversations.delete', status: 500 }))
    await expect(applyCallEvent(event())).rejects.toThrow()
  })

  it('never deletes a conversation whose agent no other org row owns (unowned)', async () => {
    seed({ agent_provider_resources: [] })
    const res = await applyCallEvent(event())
    expect(res.outcome).toBe('unowned')
    expect(elDelete).not.toHaveBeenCalled()
  })
})
