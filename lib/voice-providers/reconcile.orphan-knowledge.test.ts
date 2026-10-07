// Admin reconcile with delete_orphans: a true orphan agent's knowledge copies
// are cleaned up before the agent is deleted (slice H); a duplicate of a live
// agent shares that agent's documents, so its knowledge is never touched.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

vi.mock('server-only', () => ({}))

const state: { db: MemoryDb | null } = { db: null }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const list = vi.fn()
const get = vi.fn()
vi.mock('@/lib/elevenlabs/client', () => ({ agents: { list: (...a: unknown[]) => list(...a), get: (...a: unknown[]) => get(...a) } }))
vi.mock('@/lib/cartesia/client', () => ({ agents: { list: vi.fn() } }))
const del = vi.fn()
vi.mock('./adapters', () => ({
  LIFECYCLES: { elevenlabs: { isConfigured: () => true, delete: (...a: unknown[]) => del(...a) }, cartesia: { isConfigured: () => false } },
}))
vi.mock('./agent-sync', () => ({ providersFor: async () => ['elevenlabs'], syncAgent: async () => [{ provider: 'elevenlabs', status: 'ready' }] }))
const orphanKnowledge = vi.hoisted(() => ({ deleteOrphanAgentKnowledge: vi.fn() }))
vi.mock('@/lib/account/orphan-knowledge', () => orphanKnowledge)

import { reconcileVoiceProviders } from './reconcile'

const A1 = '11111111-1111-4111-8111-111111111111'
const GONE = '99999999-9999-4999-8999-999999999999'
const ENV = 'ntv-env:preview'
const tagged = (id: string, local: string) => ({ agent_id: id, name: id, tags: ['ntv', `ntv-agent:${local}`, ENV] })

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'preview')
  list.mockReset()
  get.mockReset()
  del.mockReset()
  orphanKnowledge.deleteOrphanAgentKnowledge.mockReset().mockResolvedValue({ found: 2, deleted: 2, kept: 0, failed: 0 })
  state.db = memoryDb({
    agents: [{ id: A1, created_at: '1' }],
    agent_provider_resources: [{ agent_id: A1, provider: 'elevenlabs', external_id: 'el_1', status: 'ready', details: {} }],
  })
})

describe('reconcile delete_orphans and knowledge copies', () => {
  it('cleans an orphan agent’s knowledge before deleting it, never a duplicate’s', async () => {
    list.mockResolvedValue({ agents: [tagged('el_1', A1), tagged('el_dup', A1), tagged('el_orphan', GONE)], has_more: false })
    const report = await reconcileVoiceProviders({ apply: true, deleteOrphans: true, limit: 10 })
    expect(orphanKnowledge.deleteOrphanAgentKnowledge).toHaveBeenCalledTimes(1)
    expect(orphanKnowledge.deleteOrphanAgentKnowledge).toHaveBeenCalledWith('el_orphan', expect.anything())
    expect(del).toHaveBeenCalledWith('el_orphan')
    expect(report.orphans.find((o) => o.externalId === 'el_orphan')).toMatchObject({ deleted: true, knowledge: { deleted: 2 } })
    const dup = report.orphans.find((o) => o.externalId === 'el_dup')
    expect(dup?.note).toBe('duplicate')
    expect(dup?.knowledge).toBeUndefined()
  })

  it('a dry run touches nothing', async () => {
    list.mockResolvedValue({ agents: [tagged('el_1', A1), tagged('el_orphan', GONE)], has_more: false })
    await reconcileVoiceProviders({ apply: false, deleteOrphans: false, limit: 10 })
    expect(orphanKnowledge.deleteOrphanAgentKnowledge).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })
})
