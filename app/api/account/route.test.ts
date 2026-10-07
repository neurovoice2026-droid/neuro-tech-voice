// DELETE /api/account: same-origin, signed in, owner only, typed business
// name, fresh sign-in, rate limited; the organization comes from the session
// only, the job starts in the background and every session is signed out.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const state = vi.hoisted(() => ({
  signedIn: true,
  // A new user per test: the rate limit (in memory under test) is per user.
  user: '',
  owner: '',
  lastSignIn: new Date().toISOString(),
  orgName: 'Smile Clinic' as string | null,
  signOut: [] as unknown[],
  deferred: [] as Promise<unknown>[],
}))

vi.mock('@/lib/api/auth', () => ({
  requireOrg: async (opts?: { allowDeleting?: boolean }) => {
    const { RequestError: RE } = await import('@/lib/api/http')
    if (!state.signedIn) throw new RE('unauthorized', 'Unauthorized', 401)
    expect(opts?.allowDeleting).toBe(true)
    return {
      supabase: { auth: { signOut: async (o: unknown) => (state.signOut.push(o), { error: null }) } },
      user: { id: state.user, last_sign_in_at: state.lastSignIn, email: 'owner@example.com' },
      org: { id: ORG, name: state.orgName, timezone: 'UTC', plan: 'pro' },
    }
  },
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: state.owner }, error: null }) }) }) }),
  }),
}))
vi.mock('@/lib/observability/telemetry', () => ({ deferBackground: (p: Promise<unknown>) => state.deferred.push(p) }))
const account = vi.hoisted(() => ({
  REQUEST_RUN_BUDGET_MS: 240_000,
  requestAccountDeletion: vi.fn(),
  runAccountDeletion: vi.fn(),
}))
vi.mock('@/lib/account/delete', () => account)

import { DELETE } from './route'

let ip = 0
function del(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://app.test/api/account', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', origin: 'http://app.test', host: 'app.test', 'x-forwarded-proto': 'http', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  ip++
  state.signedIn = true
  state.user = `a1a1a1a1-a1a1-4a1a-8a1a-${String(ip).padStart(12, '0')}`
  state.owner = state.user
  state.lastSignIn = new Date().toISOString()
  state.orgName = `Smile Clinic ${ip}`
  state.signOut = []
  state.deferred = []
  account.requestAccountDeletion.mockReset().mockResolvedValue({ job: { id: 'job-1', status: 'pending', step: 'block_activity' }, created: true, reopened: false })
  account.runAccountDeletion.mockReset().mockResolvedValue({ jobId: 'job-1', ran: true, outcome: 'completed' })
})

describe('DELETE /api/account', () => {
  it('202: opens the job for the session’s own organization, runs it in the background and signs out everywhere', async () => {
    const res = await DELETE(del({ confirm: `  ${state.orgName} ` }))
    expect(res.status).toBe(202)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ status: 'accepted', deletion: { id: 'job-1', status: 'pending', step: 'block_activity' } })
    expect(account.requestAccountDeletion).toHaveBeenCalledWith(expect.objectContaining({ orgId: ORG, requestedBy: state.user, via: 'self_service' }))
    expect(account.runAccountDeletion).toHaveBeenCalledWith('job-1', expect.objectContaining({ budgetMs: 240_000 }))
    expect(state.deferred).toHaveLength(1)
    expect(state.signOut).toEqual([{ scope: 'global' }])
  })

  it('rejects cross-site requests before anything else', async () => {
    const res = await DELETE(del({ confirm: state.orgName }, { origin: 'https://evil.example' }))
    expect(res.status).toBe(403)
    expect(account.requestAccountDeletion).not.toHaveBeenCalled()
  })

  it('401 when signed out', async () => {
    state.signedIn = false
    expect((await DELETE(del({ confirm: 'x' }))).status).toBe(401)
  })

  it('400 when the typed name does not match exactly (and nothing starts)', async () => {
    const res = await DELETE(del({ confirm: String(state.orgName).toLowerCase() }))
    expect(res.status).toBe(400)
    expect((await res.json()).details).toEqual({ reason: 'confirmation_mismatch' })
    expect(account.requestAccountDeletion).not.toHaveBeenCalled()
  })

  it('400 for an unknown field: the organization can never be chosen by the browser', async () => {
    const res = await DELETE(del({ confirm: state.orgName, org_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }))
    expect(res.status).toBe(400)
    expect(account.requestAccountDeletion).not.toHaveBeenCalled()
  })

  it('403 reauth_required without a sign-in in the last 30 minutes', async () => {
    state.lastSignIn = new Date(Date.now() - 31 * 60_000).toISOString()
    const res = await DELETE(del({ confirm: state.orgName }))
    expect(res.status).toBe(403)
    expect((await res.json()).details).toEqual({ reason: 'reauth_required' })
    expect(account.requestAccountDeletion).not.toHaveBeenCalled()
  })

  it('403 when the signed-in user is not the owner', async () => {
    state.owner = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1'
    expect((await DELETE(del({ confirm: state.orgName }))).status).toBe(403)
    expect(account.requestAccountDeletion).not.toHaveBeenCalled()
  })

  it('DELETE without a name: the user types DELETE', async () => {
    state.orgName = null
    expect((await DELETE(del({ confirm: 'Smile' }))).status).toBe(400)
    expect((await DELETE(del({ confirm: 'DELETE' }))).status).toBe(202)
  })

  it('is rate limited per user (5 per hour)', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) statuses.push((await DELETE(del({ confirm: 'wrong' }))).status)
    expect(statuses.slice(0, 5).every((s) => s === 400)).toBe(true)
    expect(statuses[5]).toBe(429)
  })
})
