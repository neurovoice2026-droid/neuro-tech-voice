import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { makeAgentSpec } from '@/tests/helpers/agent-spec'

vi.mock('server-only', () => ({}))

const state: { db: MemoryDb | null; circuit: string[]; hashes: Record<string, string>; configured: boolean; llmReasons: string[] } = {
  db: null,
  circuit: [],
  hashes: {},
  configured: true,
  llmReasons: [],
}
vi.mock('@/lib/elevenlabs/llm-selection', () => ({ effectiveAgentLlm: async () => ({ llm: 'gemini-2.5-flash', reason: state.llmReasons.shift() ?? 'ok' }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('./circuit-registry', () => ({ peek: async () => ({ state: state.circuit.shift() ?? 'closed' }) }))
vi.mock('./agent-spec', () => ({
  loadAgentRow: async (_db: unknown, id: string) => (id === 'missing' ? null : { id }),
  buildAgentSpec: async (_db: unknown, agent: { id: string }) => makeAgentSpec({ localAgentId: agent.id, revision: 3 }),
}))
vi.mock('./adapters', () => ({
  LIFECYCLES: {
    elevenlabs: {
      isConfigured: () => state.configured,
      hash: async (spec: { localAgentId: string }) => {
        const h = state.hashes[spec.localAgentId]
        if (h === 'THROW') throw new Error('catalog down')
        return h ?? 'current'
      },
    },
  },
}))
const syncAgent = vi.fn()
vi.mock('./agent-sync', () => ({ syncAgent: (...a: unknown[]) => syncAgent(...a) }))

import { rolloutBatch, rolloutCanaryOrgs, rolloutScan, runConfigRollout } from './config-rollout'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '33333333-3333-4333-8333-333333333333'

function row(agentId: string, over: Record<string, unknown> = {}) {
  return { id: `r_${agentId}`, agent_id: agentId, org_id: ORG_A, provider: 'elevenlabs', status: 'ready', external_id: `el_${agentId}`, config_hash: 'current', synced_revision: 3, rollout_checked_at: null, ...over }
}

beforeEach(() => {
  state.circuit = []
  state.llmReasons = []
  state.hashes = {}
  state.configured = true
  syncAgent.mockReset().mockResolvedValue([{ provider: 'elevenlabs', status: 'ready' }])
  for (const k of ['ELEVENLABS_ROLLOUT_BATCH', 'ELEVENLABS_ROLLOUT_SCAN', 'ELEVENLABS_ROLLOUT_CANARY_ORGS']) vi.stubEnv(k, '')
})

describe('config rollout', () => {
  it('re-syncs only drifted agents that exist remotely, oldest check first, never creating', async () => {
    state.db = memoryDb({
      agent_provider_resources: [
        row('a1', { rollout_checked_at: '2026-10-01T00:00:00Z' }),
        row('a2', { config_hash: 'stale' }),
        row('a3', { synced_revision: 2 }),
        row('a4', { external_id: null, config_hash: 'stale' }),
        row('a5', { status: 'degraded', config_hash: 'stale' }),
        row('a6', { provider: 'cartesia', config_hash: 'stale' }),
      ],
    })
    const report = await runConfigRollout({ dryRun: false })
    expect(report).toMatchObject({ scanned: 3, drifted: 2, inSync: 1, deferred: 0, errors: 0, skipped: null })
    expect(syncAgent.mock.calls.map((c) => c[0]).sort()).toEqual(['a2', 'a3'])
    for (const call of syncAgent.mock.calls) expect(call[1]).toMatchObject({ providers: ['elevenlabs'], noCreate: true })
    // Every scanned row is marked, so the next run starts with others.
    const checked = state.db.tables.agent_provider_resources.filter((r) => r.rollout_checked_at && r.rollout_checked_at !== '2026-10-01T00:00:00Z')
    expect(checked.map((r) => r.agent_id).sort()).toEqual(['a1', 'a2', 'a3'])
  })

  it('stops at the batch size and leaves the rest unmarked for the next run', async () => {
    state.db = memoryDb({ agent_provider_resources: ['b1', 'b2', 'b3'].map((id) => row(id, { config_hash: 'stale' })) })
    const report = await runConfigRollout({ dryRun: false, limit: 1 })
    expect(report.synced).toHaveLength(1)
    expect(report.deferred).toBe(2)
    expect(state.db.tables.agent_provider_resources.filter((r) => r.rollout_checked_at === null)).toHaveLength(2)
  })

  it('dry run reports drift without syncing', async () => {
    state.db = memoryDb({ agent_provider_resources: [row('c1', { config_hash: 'stale' }), row('c2')] })
    const report = await runConfigRollout({ dryRun: true })
    expect(report).toMatchObject({ dryRun: true, drifted: 1, inSync: 1 })
    expect(syncAgent).not.toHaveBeenCalled()
  })

  it('does nothing while the ElevenLabs API circuit is not closed, and stops when it opens mid-run', async () => {
    state.db = memoryDb({ agent_provider_resources: [row('d1', { config_hash: 'stale' }), row('d2', { config_hash: 'stale' })] })
    state.circuit = ['open']
    expect(await runConfigRollout({ dryRun: false })).toMatchObject({ skipped: 'circuit_open', scanned: 0 })
    state.circuit = ['closed', 'closed', 'half_open']
    const report = await runConfigRollout({ dryRun: false })
    expect(report.synced).toHaveLength(1)
    expect(report.skipped).toBe('circuit_half_open')
    expect(syncAgent).toHaveBeenCalledTimes(1)
  })

  it('skips the whole run while the LLM catalogue cannot be read: nothing compared, nothing marked drifted or synced', async () => {
    state.db = memoryDb({ agent_provider_resources: [row('g1', { config_hash: 'stale' }), row('g2', { config_hash: 'stale' })] })
    for (const reason of ['catalog_unavailable', 'unknown_without_catalog']) {
      state.llmReasons = [reason]
      const report = await runConfigRollout({ dryRun: false })
      expect(report).toMatchObject({ skipped: 'llm_catalog_unavailable', scanned: 0, drifted: 0, synced: [] })
    }
    expect(syncAgent).not.toHaveBeenCalled()
    expect(state.db.tables.agent_provider_resources.every((r) => r.rollout_checked_at === null)).toBe(true)
    // Readable again (ok, or a deprecated / not offered model, which the catalogue decided): runs.
    state.llmReasons = ['deprecated']
    expect(await runConfigRollout({ dryRun: false })).toMatchObject({ skipped: null, drifted: 2 })
  })

  it('stops pushing when the catalogue becomes unreadable mid-run', async () => {
    state.db = memoryDb({ agent_provider_resources: [row('h1', { config_hash: 'stale' }), row('h2', { config_hash: 'stale' })] })
    state.llmReasons = ['ok', 'ok', 'catalog_unavailable']
    const report = await runConfigRollout({ dryRun: false })
    expect(report.synced).toHaveLength(1)
    expect(report).toMatchObject({ skipped: 'llm_catalog_unavailable', deferred: 1 })
  })

  it('is off with batch 0, skipped when ElevenLabs is not configured, and limited to canary orgs', async () => {
    state.db = memoryDb({ agent_provider_resources: [row('e1', { config_hash: 'stale' }), row('e2', { config_hash: 'stale', org_id: ORG_B })] })
    vi.stubEnv('ELEVENLABS_ROLLOUT_BATCH', '0')
    expect(await runConfigRollout({ dryRun: false })).toMatchObject({ skipped: 'disabled' })
    vi.stubEnv('ELEVENLABS_ROLLOUT_BATCH', '')
    state.configured = false
    expect(await runConfigRollout({ dryRun: false })).toMatchObject({ skipped: 'not_configured' })
    state.configured = true
    vi.stubEnv('ELEVENLABS_ROLLOUT_CANARY_ORGS', `${ORG_B}, not-a-uuid`)
    const report = await runConfigRollout({ dryRun: false })
    expect(report.canary).toBe(true)
    expect(syncAgent.mock.calls.map((c) => c[0])).toEqual(['e2'])
  })

  it('counts a failing hash or sync as an error and carries on', async () => {
    state.db = memoryDb({ agent_provider_resources: [row('f1'), row('f2', { config_hash: 'stale' }), row('missing')] })
    state.hashes = { f1: 'THROW' }
    syncAgent.mockResolvedValue([{ provider: 'elevenlabs', status: 'degraded' }])
    const report = await runConfigRollout({ dryRun: false })
    expect(report.errors).toBe(2)
    expect(report.synced).toEqual([{ agentId: 'f2', status: 'degraded' }])
  })

  it('reads its bounds from env with safe defaults', () => {
    expect(rolloutBatch({})).toBe(10)
    expect(rolloutBatch({ ELEVENLABS_ROLLOUT_BATCH: '500' })).toBe(10)
    expect(rolloutScan({ ELEVENLABS_ROLLOUT_SCAN: '250' })).toBe(250)
    expect(rolloutCanaryOrgs({ ELEVENLABS_ROLLOUT_CANARY_ORGS: `${ORG_A},x` })).toEqual([ORG_A])
  })
})
