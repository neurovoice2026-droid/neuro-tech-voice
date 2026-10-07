import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestError } from '@/lib/api/http'
import { fakeDb } from '@/tests/helpers/fake-db'

const state = { admin: true, db: fakeDb(() => ({ data: null, error: null })) }
const runConfigRollout = vi.fn()

vi.mock('@/lib/api/auth', () => ({
  requireAdmin: async () => {
    if (!state.admin) throw new RequestError('forbidden', 'Forbidden', 403)
    return { kind: 'token', userId: null }
  },
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/voice-providers/config-rollout', () => ({ runConfigRollout: (...a: unknown[]) => runConfigRollout(...a) }))

import { POST } from './route'

const REPORT = { platformVersion: 1, dryRun: true, skipped: null, canary: false, scanned: 3, inSync: 2, drifted: 1, synced: [], deferred: 0, errors: 0 }

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(new Request('https://app.example/api/admin/voice/rollout', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }))
}

beforeEach(() => {
  state.admin = true
  state.db = fakeDb(() => ({ data: null, error: null }))
  runConfigRollout.mockReset().mockResolvedValue(REPORT)
})

describe('POST /api/admin/voice/rollout', () => {
  it('is a dry run by default and writes no audit entry', async () => {
    const res = await post({})
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual(REPORT)
    expect(runConfigRollout).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true, limit: undefined }))
    expect(state.db.calls.filter((c) => c.table === 'audit_log')).toHaveLength(0)
  })

  it('applies with a bounded limit and audits it', async () => {
    runConfigRollout.mockResolvedValue({ ...REPORT, dryRun: false, synced: [{ agentId: 'a', status: 'ready' }] })
    const res = await post({ dry_run: false, limit: 5 })
    expect(res.status).toBe(200)
    expect(runConfigRollout).toHaveBeenCalledWith(expect.objectContaining({ dryRun: false, limit: 5 }))
    const audit = state.db.calls.find((c) => c.table === 'audit_log')
    expect(audit?.payload).toMatchObject({ action: 'voice.config_rollout.applied', details: { synced: 1 } })
  })

  it('validates the body and refuses non-admins and cross-site requests', async () => {
    expect((await post({ limit: 500 })).status).toBe(400)
    expect((await post({ dry_run: 'no' })).status).toBe(400)
    expect((await post({ unknown: true })).status).toBe(400)
    expect((await post({}, { origin: 'https://evil.example' })).status).toBe(403)
    state.admin = false
    expect((await post({})).status).toBe(403)
    expect(runConfigRollout).not.toHaveBeenCalled()
  })
})
