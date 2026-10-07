import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// memoryDb ignores JSON-path filters, so the compare-and-set on
// pronunciation->>version_id is emulated here by a wrapper.
const state = vi.hoisted(() => ({ db: null as unknown as MemoryDb, casFail: false }))
function client() {
  return {
    from: (table: string) => {
      const q = state.db.from(table) as unknown as Record<string, (...a: unknown[]) => unknown>
      const wrap = (target: Record<string, (...a: unknown[]) => unknown>): Record<string, (...a: unknown[]) => unknown> =>
        new Proxy(target, {
          get(t, prop: string) {
            if (prop === 'eq') {
              return (col: string, val: unknown) => (col.includes('->>') ? wrap(state.casFail ? (t.eq('id', '__none__') as never) : t) : wrap(t.eq(col, val) as never))
            }
            const v = t[prop]
            return typeof v === 'function' ? (...a: unknown[]) => {
              const r = v.apply(t, a)
              return r === t ? wrap(t) : r
            } : v
          },
        })
      return wrap(q)
    },
  }
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => client() }))
const api = vi.hoisted(() => ({
  createDictionary: vi.fn(),
  addRules: vi.fn(),
  removeRules: vi.fn(),
  setRules: vi.fn(),
  getDictionary: vi.fn(),
  archiveDictionary: vi.fn(),
}))
vi.mock('@/lib/elevenlabs/api/pronunciation', () => api)
vi.mock('@/lib/elevenlabs/client', () => ({ isConfigured: () => true }))

import { ProviderError } from './errors'
import { deleteOrgPronunciation, retireDictionary, savePronunciationRules } from './pronunciation'
import { createLogger } from '@/lib/observability/logger'

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'
const log = createLogger({ test: true })
const r = (term: string, say_as: string) => ({ term, say_as, case_sensitive: false, word_boundaries: true })
const stored = (rules = [r('Acme', 'acmi'), r('Ioana', 'yo-ana')]) => ({ dictionary_id: 'dict_0001', version_id: 'ver_0001', rules })

beforeEach(() => {
  state.casFail = false
  for (const fn of Object.values(api)) fn.mockReset()
  state.db = memoryDb({ agents: [{ id: AGENT, org_id: ORG, pronunciation: null }], audit_log: [] })
})

const agentState = () => state.db.tables.agents[0].pronunciation as Record<string, unknown> | null

describe('savePronunciationRules', () => {
  it('first save creates the org dictionary (no workspace access) and stores id, version and rules', async () => {
    api.createDictionary.mockResolvedValue({ id: 'dict_0001', version_id: 'ver_0001', version_rules_num: 1 })
    const res = await savePronunciationRules({ orgId: ORG, agentId: AGENT, userId: 'u1', rules: [r('Acme', 'acmi')], log })
    expect(res.changed).toBe(true)
    expect(api.createDictionary).toHaveBeenCalledWith(
      { name: expect.stringMatching(new RegExp(`^ntv:.+:org:${ORG}$`)), description: expect.any(String), rules: [{ type: 'alias', string_to_replace: 'Acme', alias: 'acmi', case_sensitive: false, word_boundaries: true }] },
      { orgId: ORG },
    )
    expect(JSON.stringify(api.createDictionary.mock.calls[0])).not.toContain('workspace_access')
    expect(agentState()).toMatchObject({ dictionary_id: 'dict_0001', version_id: 'ver_0001', rules: [r('Acme', 'acmi')] })
    // Audit holds counts only (rules can be names).
    expect(state.db.tables.audit_log[0]).toMatchObject({ action: 'voice.pronunciation.updated', details: { rules: 1, upserted: 1, removed: 0 } })
    expect(JSON.stringify(state.db.tables.audit_log)).not.toContain('acmi')
  })

  it('no rules and no dictionary: nothing to do; same rules: no provider call', async () => {
    expect(await savePronunciationRules({ orgId: ORG, agentId: AGENT, userId: 'u1', rules: [], log })).toEqual({ state: null, changed: false })
    state.db.tables.agents[0].pronunciation = stored()
    expect((await savePronunciationRules({ orgId: ORG, agentId: AGENT, userId: 'u1', rules: stored().rules, log })).changed).toBe(false)
    expect(api.getDictionary).not.toHaveBeenCalled()
  })

  it('later saves remove dropped words and add new/changed ones, storing the last version', async () => {
    state.db.tables.agents[0].pronunciation = stored()
    api.getDictionary.mockResolvedValue({ id: 'dict_0001', latest_version_id: 'ver_0001', rules: [] })
    api.removeRules.mockResolvedValue({ id: 'dict_0001', version_id: 'ver_0002', version_rules_num: 1 })
    api.addRules.mockResolvedValue({ id: 'dict_0001', version_id: 'ver_0003', version_rules_num: 2 })
    await savePronunciationRules({ orgId: ORG, agentId: AGENT, userId: 'u1', rules: [r('Acme', 'ak-me'), r('Bistro', 'bistro')].slice(0, 2), log })
    expect(api.removeRules).toHaveBeenCalledWith('dict_0001', ['Ioana'], { orgId: ORG })
    expect(api.addRules).toHaveBeenCalledWith('dict_0001', [expect.objectContaining({ string_to_replace: 'Acme', alias: 'ak-me' }), expect.objectContaining({ string_to_replace: 'Bistro' })], { orgId: ORG })
    expect(agentState()).toMatchObject({ dictionary_id: 'dict_0001', version_id: 'ver_0003' })
  })

  it('resynchronises with set-rules when an earlier save stopped half-way', async () => {
    state.db.tables.agents[0].pronunciation = stored()
    api.getDictionary.mockResolvedValue({ id: 'dict_0001', latest_version_id: 'ver_9999', rules: [] })
    api.setRules.mockResolvedValue({ id: 'dict_0001', version_id: 'ver_0010', version_rules_num: 1 })
    await savePronunciationRules({ orgId: ORG, agentId: AGENT, userId: 'u1', rules: [r('Acme', 'acmi')], log })
    expect(api.setRules).toHaveBeenCalledTimes(1)
    expect(api.addRules).not.toHaveBeenCalled()
    expect(agentState()).toMatchObject({ version_id: 'ver_0010' })
  })

  it('a concurrent save fails cleanly (409) and a dictionary created for it is retired', async () => {
    state.casFail = true
    state.db.tables.agents[0].pronunciation = stored()
    api.getDictionary.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', operation: 'pronunciation.get', code: 'not_found', status: 404 }))
    api.createDictionary.mockResolvedValue({ id: 'dict_0002', version_id: 'ver_0002', version_rules_num: 1 })
    api.getDictionary.mockResolvedValueOnce({ id: 'dict_0002', latest_version_id: 'ver_0002', rules: [{ string_to_replace: 'Acme' }] })
    await expect(savePronunciationRules({ orgId: ORG, agentId: AGENT, userId: 'u1', rules: [r('Acme', 'x')], log })).rejects.toMatchObject({ status: 409 })
    expect(api.removeRules).toHaveBeenCalledWith('dict_0002', ['Acme'])
    expect(api.archiveDictionary).toHaveBeenCalledWith('dict_0002')
    expect(agentState()).toMatchObject({ dictionary_id: 'dict_0001' })
  })

  it('provider failures leave the stored state untouched', async () => {
    state.db.tables.agents[0].pronunciation = stored()
    api.getDictionary.mockResolvedValue({ id: 'dict_0001', latest_version_id: 'ver_0001', rules: [] })
    api.removeRules.mockRejectedValue(new ProviderError({ system: 'elevenlabs', operation: 'pronunciation.remove_rules', code: 'upstream', status: 502 }))
    await expect(savePronunciationRules({ orgId: ORG, agentId: AGENT, userId: 'u1', rules: [r('Acme', 'acmi')], log })).rejects.toBeInstanceOf(ProviderError)
    expect(agentState()).toMatchObject({ version_id: 'ver_0001' })
  })
})

describe('offboarding', () => {
  it('empties the rules (personal data) before archiving, clears the agent, tolerates a gone dictionary', async () => {
    state.db.tables.agents[0].pronunciation = stored()
    api.getDictionary.mockResolvedValue({ id: 'dict_0001', latest_version_id: 'ver_0001', rules: [{ string_to_replace: 'Acme' }, { string_to_replace: 'Ioana' }] })
    expect(await deleteOrgPronunciation(ORG, log)).toEqual({ archived: 1, gone: 0, failed: 0 })
    expect(api.removeRules).toHaveBeenCalledWith('dict_0001', ['Acme', 'Ioana'])
    expect(api.removeRules.mock.invocationCallOrder[0]).toBeLessThan(api.archiveDictionary.mock.invocationCallOrder[0])
    expect(agentState()).toBeNull()

    api.getDictionary.mockRejectedValue(new ProviderError({ system: 'elevenlabs', operation: 'pronunciation.get', code: 'not_found', status: 404 }))
    expect(await retireDictionary('dict_gone')).toBe('gone')
    expect(await retireDictionary('bad id!')).toBe('gone')
  })

  it('never throws for provider failures', async () => {
    state.db.tables.agents[0].pronunciation = stored()
    api.getDictionary.mockRejectedValue(new ProviderError({ system: 'elevenlabs', operation: 'pronunciation.get', code: 'upstream', status: 500 }))
    expect(await deleteOrgPronunciation(ORG, log)).toEqual({ archived: 0, gone: 0, failed: 1 })
    expect(agentState()).not.toBeNull()
  })
})
