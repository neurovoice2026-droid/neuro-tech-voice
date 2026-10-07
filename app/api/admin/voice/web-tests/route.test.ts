import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestError } from '@/lib/api/http'
import { fakeDb } from '@/tests/helpers/fake-db'

const state = { admin: true, db: fakeDb(() => ({ data: null, error: null })) }
const resetWebTestBlock = vi.fn()

vi.mock('@/lib/api/auth', () => ({
  requireAdmin: async () => {
    if (!state.admin) throw new RequestError('forbidden', 'Forbidden', 403)
    return { kind: 'token', userId: null }
  },
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/voice-providers/web-test', () => ({ resetWebTestBlock: (...a: unknown[]) => resetWebTestBlock(...a) }))

import { POST } from './route'

const ORG = '7b0c2a52-3a7e-4c39-9d36-2f1f0d6b8e11'

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(new Request('https://app.example/api/admin/voice/web-tests', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }))
}

beforeEach(() => {
  state.admin = true
  state.db = fakeDb(() => ({ data: null, error: null }))
  resetWebTestBlock.mockReset().mockResolvedValue(true)
})

describe('POST /api/admin/voice/web-tests', () => {
  it('lifts the block and audits it', async () => {
    const res = await post({ org_id: ORG })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ org_id: ORG, reset: true })
    expect(resetWebTestBlock).toHaveBeenCalledWith(ORG, expect.anything(), state.db)
    const audit = state.db.calls.find((c) => c.table === 'audit_log')
    expect(audit?.payload).toMatchObject({ org_id: ORG, actor_kind: 'admin_token', action: 'voice.web_test.block_reset' })
  })

  it('writes no audit entry when the org was not blocked', async () => {
    resetWebTestBlock.mockResolvedValue(false)
    const res = await post({ org_id: ORG })
    expect(await res.json()).toEqual({ org_id: ORG, reset: false })
    expect(state.db.calls.filter((c) => c.table === 'audit_log')).toHaveLength(0)
  })

  it('validates the body and refuses non-admins and cross-site requests', async () => {
    expect((await post({ org_id: 'not-a-uuid' })).status).toBe(400)
    expect((await post({ org_id: ORG, extra: 1 })).status).toBe(400)
    expect((await post({ org_id: ORG }, { origin: 'https://evil.example' })).status).toBe(403)
    state.admin = false
    expect((await post({ org_id: ORG })).status).toBe(403)
    expect(resetWebTestBlock).not.toHaveBeenCalled()
  })

  it('a database failure is a generic 500 without details', async () => {
    resetWebTestBlock.mockRejectedValue(new Error('reset_web_test_block failed: relation does not exist'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await post({ org_id: ORG })
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('relation')
  })
})
