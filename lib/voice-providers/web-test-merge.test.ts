import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import type { NormalizedCallEvent } from './types'

// End to end (slice G + slice D): the row pre-created for a browser test is
// the one the post-call webhook completes, through the existing-row path,
// and it is never billed and never runs the owner's automations.

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: () => true, conversations: { delete: vi.fn() } }))
vi.mock('@/lib/elevenlabs/api/conversation-token', () => ({ conversationToken: vi.fn(async () => ({ token: 't', conversation_id: 'conv_web_9' })) }))
const executeWorkflows = vi.fn()
vi.mock('@/lib/workflows/executor', () => ({ executeWorkflows: (...a: unknown[]) => executeWorkflows(...a) }))
vi.mock('./circuit-registry', () => ({ reportOutcome: vi.fn(async () => undefined) }))
vi.mock('@/lib/email/client', () => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/security/rate-limit', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/security/rate-limit')>()), enforceRateLimit: async () => undefined }))

import { applyCallEvent } from './call-store'
import { startWebTestSession } from './web-test'
import { createLogger } from '@/lib/observability/logger'

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = 'a1111111-1111-4111-8111-111111111111'

function webEvent(): NormalizedCallEvent {
  return {
    provider: 'elevenlabs',
    kind: 'call.completed',
    providerCallId: 'conv_web_9',
    externalAgentId: 'agent_el_1',
    localCallId: null,
    twilioCallSid: null,
    direction: 'inbound',
    fromNumber: null,
    toNumber: null,
    startedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    durationSeconds: 95,
    status: 'completed',
    transcript: [{ role: 'agent', message: 'Hello', time_in_call_secs: 0 }],
    summary: 'Owner test',
    summaryTitle: 'Test',
    callSuccessful: 'success',
    analysis: { evaluation: {}, data: {} },
    terminationReason: 'Call ended by remote party',
    costCredits: 300,
    costUsd: 0.1,
    hasRecording: true,
    failureReason: null,
    eventTimestamp: null,
    channel: 'web',
    metadata: { channel: 'web', initiation_source: 'react_sdk' },
    charging: null,
  } as NormalizedCallEvent
}

beforeEach(() => {
  executeWorkflows.mockReset()
  vi.stubEnv('VOICE_TOKEN_SECRET', 'y'.repeat(40))
  const db = memoryDb(
    {
      agents: [{ id: AGENT, org_id: ORG, name: 'Ana', language: 'ro', is_active: true, created_at: '2026-01-01T00:00:00Z' }],
      agent_provider_resources: [{ id: 'r1', org_id: ORG, agent_id: AGENT, provider: 'elevenlabs', external_id: 'agent_el_1', status: 'ready', details: {} }],
      organizations: [{ id: ORG, user_id: 'u1', plan: 'pro', minutes_used: 0, minutes_limit: 850 }],
      calls: [],
      audit_log: [],
    },
    { onUpdate: (_t, row) => (row.updated_at = `u${Math.random()}`), unique: { calls: [['id'], ['elevenlabs_conversation_id']] } },
  )
  const rpc = db.rpc
  db.rpc = (fn: string, args: unknown) => (fn === 'claim_web_test_session' ? (db.rpcCalls.push({ fn, args }), Promise.resolve({ data: [{ allowed: true, used: 1 }], error: null })) : rpc(fn, args)) as never
  state.db = db
})

describe('browser test row + post-call webhook', () => {
  it('merges the conversation into the pre-created row with no billing and no workflows', async () => {
    const log = createLogger({ component: 'test' })
    const session = await startWebTestSession({ org: { id: ORG, name: 'Acme', timezone: 'UTC', plan: 'pro' }, userId: 'u1', mode: 'voice', ipKey: null }, log)
    const db = state.db as MemoryDb
    expect(db.tables.calls).toHaveLength(1)
    db.tables.calls[0].updated_at = 'u0'

    const res = await applyCallEvent(webEvent(), log, { source: 'webhook' })
    expect(res).toMatchObject({ callId: session.call_id, outcome: 'updated', test: true })
    expect(db.tables.calls).toHaveLength(1)
    expect(db.tables.calls[0]).toMatchObject({ id: session.call_id, channel: 'web', is_test: true, status: 'completed', duration_seconds: 95 })
    expect(db.rpcCalls.map((c) => c.fn)).not.toContain('record_call_usage')
    expect(executeWorkflows).not.toHaveBeenCalled()
    // Counted against the org's browser-test seconds budget instead (server-side).
    expect(db.rpcCalls.filter((c) => c.fn === 'record_web_test_seconds')).toEqual([
      { fn: 'record_web_test_seconds', args: { p_org_id: ORG, p_call_id: session.call_id, p_seconds: 95, p_block_over: 600 } },
    ])
  })
})
