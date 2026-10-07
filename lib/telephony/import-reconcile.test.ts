// Admin report of this environment's native imports vs our phone_numbers rows:
// dry run by default, deletions only with apply+delete_orphans and never for
// an import assigned to an agent this database does not know.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { createLogger } from '@/lib/observability/logger'
import { ProviderError } from '@/lib/voice-providers/errors'

const ORG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const el = vi.hoisted(() => ({ isConfigured: vi.fn(() => true), phoneNumbers: { delete: vi.fn() } }))
vi.mock('@/lib/elevenlabs/client', () => el)
const collectImportedNumbers = vi.fn()
vi.mock('@/lib/elevenlabs/api/phone-numbers', () => ({ collectImportedNumbers: (...a: unknown[]) => collectImportedNumbers(...a) }))
let db: MemoryDb
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))

import { reconcileNativeImports } from './import-reconcile'
import { parseImportLabel, nativeImportLabel } from './import-label'

const log = createLogger({ test: 'imports' })
const label = (org = ORG, env = 'production') => `ntv:${env}:${org}`

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'production')
  el.phoneNumbers.delete.mockReset().mockResolvedValue(undefined)
  db = memoryDb({
    phone_numbers: [
      { id: 'n1', org_id: ORG, number: '+40310000001', routing_mode: 'native_elevenlabs', elevenlabs_phone_number_id: 'p1' },
      { id: 'n2', org_id: ORG, number: '+40310000002', routing_mode: 'app_routed', elevenlabs_phone_number_id: null },
    ],
    agent_provider_resources: [{ provider: 'elevenlabs', external_id: 'el_ours' }],
  })
  collectImportedNumbers.mockReset().mockResolvedValue({
    truncated: false,
    numbers: [
      { phone_number_id: 'p1', phone_number: '+40310000001', label: label(), assigned_agent: { agent_id: 'el_ours' } },
      { phone_number_id: 'p2', phone_number: '+40310000002', label: label(), assigned_agent: { agent_id: 'el_ours' } },
      { phone_number_id: 'p3', phone_number: '+40310000003', label: label(), assigned_agent: null },
      { phone_number_id: 'p4', phone_number: '+40310000004', label: label(), assigned_agent: { agent_id: 'el_someone_else' } },
      // Substring match of another environment: ignored entirely.
      { phone_number_id: 'p5', phone_number: '+40310000005', label: 'xntv:production:zz', assigned_agent: null },
      { phone_number_id: 'p6', phone_number: '+40310000006', label: label(ORG, 'preview'), assigned_agent: null },
    ],
  })
})

describe('labels', () => {
  it('round-trip env and org; legacy labels are not ours', () => {
    expect(nativeImportLabel(ORG)).toBe(`ntv:production:${ORG}`)
    expect(parseImportLabel(label())).toEqual({ env: 'production', orgId: ORG })
    expect(parseImportLabel('ntv aaaaaaaa')).toBeNull()
    expect(parseImportLabel('xntv:production:zz')).toBeNull()
  })
})

describe('reconcileNativeImports', () => {
  it('dry run: matches, orphans (none/ours/foreign) and issues, numbers masked, nothing deleted', async () => {
    const r = await reconcileNativeImports({ log })
    expect(r).toMatchObject({ configured: true, env: 'production', listed: 4, matched: 1, deleted: 0, truncated: false })
    expect(r.orphans.map((o) => [o.phone_number_id, o.assigned, o.deleted ?? false])).toEqual([
      ['p2', 'ours', false],
      ['p3', 'none', false],
      ['p4', 'foreign', false],
    ])
    expect(r.issues).toEqual([{ phone_number_id: 'p2', number: expect.not.stringContaining('0000002'), issue: 'not_native' }])
    expect(JSON.stringify(r)).not.toContain('+40310000003')
    expect(el.phoneNumbers.delete).not.toHaveBeenCalled()
    expect(collectImportedNumbers).toHaveBeenCalledWith({ label: 'ntv:production:' })
  })

  it('apply alone deletes nothing; apply + delete_orphans never touches a foreign assignment', async () => {
    await reconcileNativeImports({ apply: true, log })
    expect(el.phoneNumbers.delete).not.toHaveBeenCalled()
    const r = await reconcileNativeImports({ apply: true, deleteOrphans: true, log })
    expect(el.phoneNumbers.delete.mock.calls.map((c) => c[0])).toEqual(['p2', 'p3'])
    expect(r.deleted).toBe(2)
    expect(r.orphans.find((o) => o.phone_number_id === 'p4')?.deleted).toBeUndefined()
  })

  it('deletions are bounded and failures reported (404 = already gone)', async () => {
    el.phoneNumbers.delete.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'phone_numbers.delete' }))
    const r = await reconcileNativeImports({ apply: true, deleteOrphans: true, limit: 1, log })
    expect(el.phoneNumbers.delete).toHaveBeenCalledTimes(1)
    expect(r.orphans.find((o) => o.phone_number_id === 'p2')?.deleted).toBe(true)
    expect(r.orphans.find((o) => o.phone_number_id === 'p3')?.deleted).toBeUndefined()
  })

  it('reports an id mismatch on a matched number', async () => {
    db.tables.phone_numbers[0].elevenlabs_phone_number_id = 'p_old'
    const r = await reconcileNativeImports({ log })
    expect(r.issues).toContainEqual(expect.objectContaining({ phone_number_id: 'p1', issue: 'id_mismatch' }))
  })

  it('does nothing without an API key', async () => {
    el.isConfigured.mockReturnValueOnce(false)
    expect(await reconcileNativeImports({ log })).toMatchObject({ configured: false, listed: 0 })
    expect(collectImportedNumbers).not.toHaveBeenCalled()
  })
})
