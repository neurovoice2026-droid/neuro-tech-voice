import { beforeEach, describe, expect, it, vi } from 'vitest'

// POST /api/admin/voice/tests (slice G): admin only, same-origin, strict
// bodies, dry-run sync by default, runs only on the canary or a picked local
// agent, audited.

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
vi.mock('@/lib/security/rate-limit', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/security/rate-limit')>()), enforceRateLimit: async () => undefined }))
const lib = vi.hoisted(() => ({ sync: vi.fn(), run: vi.fn(), status: vi.fn(), target: vi.fn() }))
vi.mock('@/lib/voice-providers/agent-tests', () => ({
  syncPlatformTests: (...a: unknown[]) => lib.sync(...a),
  runPlatformTests: (...a: unknown[]) => lib.run(...a),
  testRunStatus: (...a: unknown[]) => lib.status(...a),
  resolveRunTarget: (...a: unknown[]) => lib.target(...a),
}))

import { POST } from './route'

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://app.test/api/admin/voice/tests', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer t', ...headers }, body: JSON.stringify(body) })
const AGENT = 'a1111111-1111-4111-8111-111111111111'

beforeEach(() => {
  state.admin = true
  state.audit = []
  for (const f of Object.values(lib)) f.mockReset()
  lib.sync.mockResolvedValue({ suite_version: 1, dry_run: true, tests: [{ key: 'ai_disclosure', action: 'would_create', id: null }] })
  lib.run.mockResolvedValue({ invocation_id: 'inv_1', status: 'passed', candidate: false })
  lib.status.mockResolvedValue({ runs: [] })
  lib.target.mockResolvedValue({ externalId: 'agent_canary', localAgentId: null, orgId: null })
})

describe('POST /api/admin/voice/tests', () => {
  it('is refused to non-admins and to cross-site requests before anything runs', async () => {
    state.admin = false
    expect((await POST(post({ action: 'sync' }))).status).toBe(403)
    state.admin = true
    expect((await POST(post({ action: 'sync' }, { origin: 'https://evil.example', host: 'app.test' }))).status).toBe(403)
    expect(lib.sync).not.toHaveBeenCalled()
  })

  it('sync is a dry run by default; applying is audited', async () => {
    const dry = await POST(post({ action: 'sync' }))
    expect(dry.status).toBe(200)
    expect(lib.sync).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }))
    expect(state.audit).toHaveLength(0)
    lib.sync.mockResolvedValue({ suite_version: 1, dry_run: false, tests: [{ key: 'ai_disclosure', action: 'created', id: 't1' }] })
    await POST(post({ action: 'sync', dry_run: false }))
    expect(lib.sync).toHaveBeenLastCalledWith(expect.objectContaining({ dryRun: false }))
    expect(state.audit[0]).toMatchObject({ action: 'voice.agent_tests.synced', details: { actions: ['ai_disclosure:created'] } })
  })

  it('run: canary by default, or a local agent uuid; never a free-form provider id', async () => {
    const res = await POST(post({ action: 'run' }))
    expect(res.status).toBe(202)
    expect(lib.target).toHaveBeenCalledWith(null)
    expect(lib.run).toHaveBeenCalledWith(expect.objectContaining({ target: { externalId: 'agent_canary', localAgentId: null, orgId: null }, candidate: false, waitMs: 40_000, startedBy: 'admin_token' }))
    expect(state.audit[0]).toMatchObject({ action: 'voice.agent_tests.run', details: { invocation_id: 'inv_1', status: 'passed' } })

    await POST(post({ action: 'run', agent_id: AGENT, candidate: true, wait_seconds: 0 }))
    expect(lib.target).toHaveBeenLastCalledWith(AGENT)
    expect(lib.run).toHaveBeenLastCalledWith(expect.objectContaining({ candidate: true, waitMs: 0 }))

    for (const body of [{ action: 'run', agent_id: 'agent_el_123' }, { action: 'run', wait_seconds: 300 }, { action: 'run', agent_external_id: 'x' }, { action: 'delete' }]) {
      expect((await POST(post(body))).status).toBe(400)
    }
  })

  it('run without a target explains how to set one', async () => {
    lib.target.mockResolvedValue(null)
    const res = await POST(post({ action: 'run' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/ELEVENLABS_TEST_AGENT_ID/)
    expect(lib.run).not.toHaveBeenCalled()
  })

  it('status lists runs; an unknown invocation is a 404', async () => {
    expect((await POST(post({ action: 'status' }))).status).toBe(200)
    lib.status.mockResolvedValue(null)
    expect((await POST(post({ action: 'status', invocation_id: 'inv_x' }))).status).toBe(404)
    expect((await POST(post({ action: 'status', invocation_id: '../../x' }))).status).toBe(400)
  })
})
