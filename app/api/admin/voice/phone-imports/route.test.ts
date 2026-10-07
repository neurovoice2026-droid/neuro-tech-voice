// POST /api/admin/voice/phone-imports: admin only, dry run by default,
// delete_orphans requires apply, applied runs are audited.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ admin: true, audit: [] as unknown[] }))
vi.mock('@/lib/api/auth', () => ({
  requireAdmin: async () => {
    if (!state.admin) {
      const { RequestError: RE } = await import('@/lib/api/http')
      throw new RE('forbidden', 'Forbidden', 403)
    }
    return { kind: 'token', userId: null }
  },
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ insert: async (row: unknown) => (state.audit.push(row), { error: null }) }) }),
}))
const imports = vi.hoisted(() => ({ reconcileNativeImports: vi.fn() }))
vi.mock('@/lib/telephony/import-reconcile', () => imports)

import { POST } from './route'

const post = (body: unknown) => new Request('http://app.test/api/admin/voice/phone-imports', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer t' }, body: JSON.stringify(body) })
const REPORT = { configured: true, env: 'production', listed: 2, truncated: false, matched: 1, issues: [], orphans: [{ phone_number_id: 'p', number: '+40 3** *** 001', assigned: 'none', deleted: true }], deleted: 1 }

beforeEach(() => {
  state.admin = true
  state.audit = []
  imports.reconcileNativeImports.mockReset().mockResolvedValue(REPORT)
})

describe('admin phone imports', () => {
  it('is refused to non-admins before anything runs', async () => {
    state.admin = false
    expect((await POST(post({}))).status).toBe(403)
    expect(imports.reconcileNativeImports).not.toHaveBeenCalled()
  })

  it('dry run by default, not audited', async () => {
    const res = await POST(post({}))
    expect(res.status).toBe(200)
    expect(imports.reconcileNativeImports).toHaveBeenCalledWith(expect.objectContaining({ apply: false, deleteOrphans: false, limit: 50 }))
    expect(state.audit).toHaveLength(0)
  })

  it('delete_orphans requires apply; bounded limit; applied runs are audited', async () => {
    expect((await POST(post({ delete_orphans: true }))).status).toBe(400)
    expect((await POST(post({ apply: true, limit: 1000 }))).status).toBe(400)
    const res = await POST(post({ apply: true, delete_orphans: true, limit: 10 }))
    expect(res.status).toBe(200)
    expect(imports.reconcileNativeImports).toHaveBeenLastCalledWith(expect.objectContaining({ apply: true, deleteOrphans: true, limit: 10 }))
    expect(state.audit).toEqual([expect.objectContaining({ action: 'voice.phone_imports.applied', actor_kind: 'admin_token', details: { orphans: 1, deleted: 1, issues: 0 } })])
  })
})
