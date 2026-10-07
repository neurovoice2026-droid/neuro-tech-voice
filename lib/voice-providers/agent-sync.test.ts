import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { makeAgentSpec } from '@/tests/helpers/agent-spec'
import type { AgentSpec } from './types'

vi.mock('server-only', () => ({}))

const state: { db: MemoryDb | null; spec: AgentSpec } = { db: null, spec: makeAgentSpec() }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/observability/telemetry', () => ({ emitProviderEvent: () => {} }))
vi.mock('@/lib/telephony/binding', () => ({ applyNumberRouting: vi.fn() }))
vi.mock('./agent-spec', () => ({
  loadAgentRow: async () => ({ id: AGENT }),
  buildAgentSpec: async () => state.spec,
}))
const lifecycle = {
  provider: 'elevenlabs' as const,
  isConfigured: () => true,
  hash: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByLocalAgent: vi.fn(),
  health: vi.fn(),
}
vi.mock('./adapters', () => ({ lifecycleFor: () => lifecycle }))

import { syncAgent } from './agent-sync'
import { ProviderError } from './errors'

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'

function seed(resource: Record<string, unknown> | null) {
  state.db = memoryDb(
    {
      agents: [{ id: AGENT, org_id: ORG, config_revision: 3 }],
      phone_numbers: [],
      agent_provider_resources: resource
        ? [{ id: 'r1', org_id: ORG, agent_id: AGENT, provider: 'elevenlabs', status: 'ready', attempt_count: 0, synced_revision: 3, config_hash: 'old', details: {}, lock_token: null, lock_expires_at: null, ...resource }]
        : [],
    },
    { unique: { agent_provider_resources: [['agent_id', 'provider']] } },
  )
}

const synced = (spec: AgentSpec) => ({
  provider: 'elevenlabs' as const,
  externalId: 'el_1',
  version: 'v2',
  configHash: 'new',
  appliedVoiceId: null,
  details: { privacy_applied: { ...spec.privacy } },
})

beforeEach(() => {
  for (const fn of [lifecycle.hash, lifecycle.create, lifecycle.update, lifecycle.findByLocalAgent]) fn.mockReset()
  lifecycle.hash.mockResolvedValue('new')
  lifecycle.findByLocalAgent.mockResolvedValue([])
  state.spec = makeAgentSpec({ localAgentId: AGENT, orgId: ORG, revision: 3 })
})

describe('syncAgent: one-shot retroactive privacy', () => {
  it('asks for apply_to_existing_conversations when retention got shorter, then records the applied privacy', async () => {
    seed({ external_id: 'el_1', details: { privacy_applied: { record_audio: true, retention_days: 365 } } })
    state.spec = { ...state.spec, privacy: { record_audio: true, retention_days: 30 } }
    lifecycle.update.mockImplementation(async (_id: string, spec: AgentSpec) => synced(spec))
    const [res] = await syncAgent(AGENT, { providers: ['elevenlabs'] })
    expect(res.status).toBe('ready')
    expect(lifecycle.update).toHaveBeenCalledWith('el_1', state.spec, { applyPrivacyToExisting: true })
    const row = state.db!.tables.agent_provider_resources[0]
    expect(row.details).toMatchObject({ privacy_applied: { record_audio: true, retention_days: 30 } })
  })

  it('does not apply retroactively for looser settings or an unknown previous state', async () => {
    seed({ external_id: 'el_1', details: { privacy_applied: { record_audio: true, retention_days: 30 } } })
    state.spec = { ...state.spec, privacy: { record_audio: true, retention_days: 365 } }
    lifecycle.update.mockImplementation(async (_id: string, spec: AgentSpec) => synced(spec))
    await syncAgent(AGENT, { providers: ['elevenlabs'] })
    expect(lifecycle.update).toHaveBeenLastCalledWith('el_1', state.spec, { applyPrivacyToExisting: false })

    seed({ external_id: 'el_1', details: {} })
    state.spec = { ...state.spec, privacy: { record_audio: false, retention_days: 0 } }
    await syncAgent(AGENT, { providers: ['elevenlabs'] })
    expect(lifecycle.update).toHaveBeenLastCalledWith('el_1', state.spec, { applyPrivacyToExisting: false })
  })
})

describe('syncAgent: noCreate (config rollout)', () => {
  it('skips an agent without a remote id instead of creating or adopting one', async () => {
    seed(null)
    const [res] = await syncAgent(AGENT, { providers: ['elevenlabs'], noCreate: true })
    expect(res).toMatchObject({ status: 'skipped', errorCode: 'no_remote' })
    expect(lifecycle.create).not.toHaveBeenCalled()
    expect(lifecycle.findByLocalAgent).not.toHaveBeenCalled()
    // The lease is released.
    expect(state.db!.tables.agent_provider_resources[0].lock_token).toBeNull()
  })

  it('does not recreate an agent deleted at the provider; the row is degraded for the retry job', async () => {
    seed({ external_id: 'el_gone' })
    lifecycle.update.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'agents.update' }))
    const [res] = await syncAgent(AGENT, { providers: ['elevenlabs'], noCreate: true })
    expect(res.status).toBe('degraded')
    expect(lifecycle.create).not.toHaveBeenCalled()
  })

  it('without noCreate the existing recreate-on-404 behaviour is unchanged', async () => {
    seed({ external_id: 'el_gone' })
    lifecycle.update.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'agents.update' }))
    lifecycle.create.mockImplementation(async (spec: AgentSpec) => synced(spec))
    const [res] = await syncAgent(AGENT, { providers: ['elevenlabs'] })
    expect(res.status).toBe('ready')
    expect(lifecycle.create).toHaveBeenCalledTimes(1)
  })

  it('a 404 caused by a missing referenced resource (operation agents.update_reference) never recreates the agent', async () => {
    seed({ external_id: 'el_1' })
    lifecycle.update.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'agents.update_reference' }))
    const [res] = await syncAgent(AGENT, { providers: ['elevenlabs'] })
    expect(res.status).toBe('degraded')
    expect(lifecycle.create).not.toHaveBeenCalled()
  })
})

describe('syncAgent: written without a platform tool (slice B1)', () => {
  const degraded = { code: 'transfer_tool_unavailable', message: 'Human transfer is unavailable on calls to your app-routed numbers right now.' }

  it('records the row as degraded (message, attempt, retry time) while callers see the config as applied', async () => {
    seed({ external_id: 'el_1', attempt_count: 1 })
    lifecycle.update.mockImplementation(async (_id: string, spec: AgentSpec) => ({ ...synced(spec), degraded }))
    const [res] = await syncAgent(AGENT, { providers: ['elevenlabs'] })
    // Voice, knowledge and onboarding callers rely on 'ready' = the write happened.
    expect(res).toMatchObject({ status: 'ready', externalId: 'el_1', degraded: 'transfer_tool_unavailable', error: null })
    const row = state.db!.tables.agent_provider_resources[0]
    expect(row).toMatchObject({ status: 'degraded', last_error_code: 'transfer_tool_unavailable', last_error: degraded.message, attempt_count: 2, config_hash: 'new' })
    expect(Date.parse(row.next_retry_at as string)).toBeGreaterThan(Date.now())
    expect(row.lock_token).toBeNull()
  })

  it('a degraded row is pushed again on the next sync even with an unchanged hash, and clears once the tool is back', async () => {
    seed({ external_id: 'el_1', status: 'degraded', config_hash: 'new', last_error_code: 'transfer_tool_unavailable', attempt_count: 2 })
    lifecycle.update.mockImplementation(async (_id: string, spec: AgentSpec) => synced(spec))
    const [res] = await syncAgent(AGENT, { providers: ['elevenlabs'] })
    expect(lifecycle.update).toHaveBeenCalledTimes(1)
    expect(res.degraded).toBeUndefined()
    expect(state.db!.tables.agent_provider_resources[0]).toMatchObject({ status: 'ready', last_error_code: null, last_error: null, attempt_count: 0, next_retry_at: null })
  })
})
