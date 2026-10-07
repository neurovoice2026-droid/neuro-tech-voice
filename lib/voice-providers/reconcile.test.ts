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
const syncAgent = vi.fn()
vi.mock('./agent-sync', () => ({ providersFor: async () => ['elevenlabs'], syncAgent: (...a: unknown[]) => syncAgent(...a) }))

import { reconcileVoiceProviders } from './reconcile'
import { ProviderError } from './errors'

const A1 = '11111111-1111-4111-8111-111111111111'
const A2 = '22222222-2222-4222-8222-222222222222'
const GONE = '99999999-9999-4999-8999-999999999999'
const ENV = 'ntv-env:preview'
const tagged = (id: string, local: string) => ({ agent_id: id, name: id, tags: ['ntv', `ntv-agent:${local}`, ENV] })

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'preview')
  list.mockReset()
  get.mockReset()
  del.mockReset()
  syncAgent.mockReset().mockResolvedValue([{ provider: 'elevenlabs', status: 'ready' }])
  state.db = memoryDb({
    agents: [
      { id: A1, created_at: '1' },
      { id: A2, created_at: '2' },
    ],
    agent_provider_resources: [
      { agent_id: A1, provider: 'elevenlabs', external_id: 'el_1', status: 'ready', details: {} },
      { agent_id: A2, provider: 'elevenlabs', external_id: 'el_legacy', status: 'ready', details: { analysis_items_migrated: true } },
    ],
  })
})

describe('reconcileVoiceProviders (ElevenLabs listing)', () => {
  it('lists with the environment tag only and pages to the end', async () => {
    list
      .mockResolvedValueOnce({ agents: [tagged('el_1', A1)], has_more: true, next_cursor: 'c2' })
      .mockResolvedValueOnce({ agents: [tagged('el_orphan', GONE)], has_more: false, next_cursor: null })
    get.mockResolvedValue({ agent_id: 'el_legacy' })
    const report = await reconcileVoiceProviders({ apply: false, deleteOrphans: false, limit: 10 })
    expect(list).toHaveBeenCalledTimes(2)
    for (const call of list.mock.calls) expect(call[0].tags).toEqual([ENV])
    expect(list.mock.calls[1][0].cursor).toBe('c2')
    expect(report.orphans.map((o) => o.externalId)).toEqual(['el_orphan'])
  })

  it('verifies a recorded id missing from the listing with a direct GET (legacy untagged agents are not "missing")', async () => {
    list.mockResolvedValue({ agents: [tagged('el_1', A1)], has_more: false })
    get.mockResolvedValue({ agent_id: 'el_legacy' })
    let report = await reconcileVoiceProviders({ apply: true, deleteOrphans: false, limit: 10 })
    expect(get).toHaveBeenCalledWith('el_legacy')
    expect(report.issues.find((i) => i.agentId === A2 && i.kind === 'untagged_remote')).toBeTruthy()
    expect(report.issues.some((i) => i.kind === 'missing_remote')).toBe(false)
    // The re-sync re-tags it.
    expect(syncAgent).toHaveBeenCalledWith(A2, expect.objectContaining({ providers: ['elevenlabs'], force: true }))

    // Tagged for another environment (e.g. a database copied from production): never touched.
    syncAgent.mockClear()
    get.mockResolvedValue({ agent_id: 'el_legacy', tags: ['ntv', `ntv-agent:${A2}`, 'ntv-env:production'] })
    report = await reconcileVoiceProviders({ apply: true, deleteOrphans: false, limit: 10 })
    expect(report.issues).toContainEqual(expect.objectContaining({ agentId: A2, kind: 'foreign_remote', action: 'report_only' }))
    expect(syncAgent).not.toHaveBeenCalledWith(A2, expect.anything())

    get.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'agents.get' }))
    report = await reconcileVoiceProviders({ apply: false, deleteOrphans: false, limit: 10 })
    expect(report.issues.find((i) => i.agentId === A2 && i.kind === 'missing_remote')).toBeTruthy()

    get.mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'upstream', operation: 'agents.get' }))
    report = await reconcileVoiceProviders({ apply: false, deleteOrphans: false, limit: 10 })
    expect(report.issues.some((i) => i.agentId === A2 && (i.kind === 'missing_remote' || i.kind === 'untagged_remote'))).toBe(false)
    expect(report.errors.map((e) => e.step)).toContain('verify_agent')
  })

  it('a truncated listing is reported and blocks missing/orphan decisions', async () => {
    list.mockResolvedValue({ agents: [tagged('el_orphan', GONE)], has_more: true, next_cursor: null })
    const report = await reconcileVoiceProviders({ apply: true, deleteOrphans: true, limit: 10 })
    expect(report.errors.map((e) => e.step)).toContain('list')
    expect(report.issues.some((i) => i.kind === 'missing_remote' || i.kind === 'untagged_remote')).toBe(false)
    expect(report.orphans).toEqual([])
    expect(del).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })

  it('reports agents whose remote config moved to analysis items (report only)', async () => {
    list.mockResolvedValue({ agents: [tagged('el_1', A1), tagged('el_legacy', A2)], has_more: false })
    const report = await reconcileVoiceProviders({ apply: true, deleteOrphans: false, limit: 10 })
    expect(report.issues).toContainEqual(expect.objectContaining({ agentId: A2, kind: 'analysis_items_migrated', action: 'report_only' }))
    expect(syncAgent).not.toHaveBeenCalled()
  })
})
