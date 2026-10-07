// syncAgent never re-creates or updates provider agents of an organization
// whose deletion was requested (slice H), and keeps working on a database
// without migration 021.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

vi.mock('server-only', () => ({}))

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/observability/telemetry', () => ({ emitProviderEvent: () => {} }))
vi.mock('@/lib/telephony/binding', () => ({ applyNumberRouting: vi.fn() }))
vi.mock('./agent-spec', () => ({ loadAgentRow: vi.fn(), buildAgentSpec: vi.fn() }))
const lifecycle = vi.hoisted(() => ({
  provider: 'elevenlabs' as const,
  isConfigured: () => true,
  hash: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByLocalAgent: vi.fn(),
  health: vi.fn(),
}))
vi.mock('./adapters', () => ({ lifecycleFor: () => lifecycle }))

import { syncAgent } from './agent-sync'
import { isOrgBeingDeleted } from '@/lib/account/state'

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  for (const fn of [lifecycle.hash, lifecycle.create, lifecycle.update, lifecycle.findByLocalAgent]) fn.mockReset()
})

describe('syncAgent during account deletion', () => {
  it('does nothing at any provider once deletion_requested_at is set', async () => {
    state.db = memoryDb({
      organizations: [{ id: ORG, deletion_requested_at: '2026-10-07T10:00:00Z' }],
      agents: [{ id: AGENT, org_id: ORG }],
      agent_provider_resources: [],
      phone_numbers: [],
    })
    expect(await syncAgent(AGENT, { providers: ['elevenlabs'] })).toEqual([])
    expect(lifecycle.create).not.toHaveBeenCalled()
    expect(lifecycle.update).not.toHaveBeenCalled()
    expect(lifecycle.findByLocalAgent).not.toHaveBeenCalled()
    expect(state.db.tables.agent_provider_resources).toEqual([])
  })
})

describe('isOrgBeingDeleted', () => {
  const fakeDb = (result: { data: unknown; error: unknown }) =>
    ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }) }) as never

  it('reads the marker; a missing column (migration 021 not applied) or row means no', async () => {
    expect(await isOrgBeingDeleted(fakeDb({ data: { deletion_requested_at: '2026-10-07T10:00:00Z' }, error: null }), ORG)).toBe(true)
    expect(await isOrgBeingDeleted(fakeDb({ data: { deletion_requested_at: null }, error: null }), ORG)).toBe(false)
    expect(await isOrgBeingDeleted(fakeDb({ data: null, error: null }), ORG)).toBe(false)
    expect(await isOrgBeingDeleted(fakeDb({ data: null, error: { code: '42703', message: 'column does not exist' } }), ORG)).toBe(false)
  })

  it('reports other read errors and fails open (the caller keeps its behaviour)', async () => {
    const log = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn(), child: vi.fn(), context: {} }
    expect(await isOrgBeingDeleted(fakeDb({ data: null, error: { code: '08006', message: 'down' } }), ORG, log)).toBe(false)
    expect(log.error).toHaveBeenCalledWith('account_state.read_failed', expect.anything(), { orgId: ORG })
  })
})
