// POST /api/admin/accounts/[orgId]/offboard: admin only, dry run by default
// (plan, nothing started), a real run needs confirm = the organization id.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const state = vi.hoisted(() => ({ admin: true, deferred: [] as Promise<unknown>[] }))
vi.mock('@/lib/api/auth', () => ({
  requireAdmin: async () => {
    if (!state.admin) {
      const { RequestError: RE } = await import('@/lib/api/http')
      throw new RE('forbidden', 'Forbidden', 403)
    }
    return { kind: 'user', userId: 'adadadad-adad-4ada-8ada-adadadadadad' }
  },
}))
vi.mock('@/lib/observability/telemetry', () => ({ deferBackground: (p: Promise<unknown>) => state.deferred.push(p) }))
const plan = vi.hoisted(() => ({ planAccountDeletion: vi.fn() }))
vi.mock('@/lib/account/plan', () => plan)
const account = vi.hoisted(() => ({ REQUEST_RUN_BUDGET_MS: 240_000, requestAccountDeletion: vi.fn(), runAccountDeletion: vi.fn() }))
vi.mock('@/lib/account/delete', () => account)

import { POST } from './route'

const post = (orgId: string, body: unknown) => [
  new Request(`http://app.test/api/admin/accounts/${orgId}/offboard`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    body: JSON.stringify(body),
  }),
  { params: Promise.resolve({ orgId }) },
] as const

beforeEach(() => {
  state.admin = true
  state.deferred = []
  plan.planAccountDeletion.mockReset().mockResolvedValue({ org_id: ORG, org_exists: true, steps: [] })
  account.requestAccountDeletion.mockReset().mockResolvedValue({ job: { id: 'job-1', status: 'pending', step: 'block_activity', attempts: 0, last_error: null }, created: true, reopened: false })
  account.runAccountDeletion.mockReset().mockResolvedValue({ jobId: 'job-1', ran: true, outcome: 'completed' })
})

describe('admin offboard', () => {
  it('is refused to non-admins before anything runs', async () => {
    state.admin = false
    expect((await POST(...post(ORG, {}))).status).toBe(403)
    expect(plan.planAccountDeletion).not.toHaveBeenCalled()
  })

  it('dry run by default: returns the plan, starts nothing', async () => {
    const res = await POST(...post(ORG, {}))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ dry_run: true, plan: { org_id: ORG, org_exists: true, steps: [] } })
    expect(plan.planAccountDeletion).toHaveBeenCalledWith(ORG)
    expect(account.requestAccountDeletion).not.toHaveBeenCalled()
    expect(state.deferred).toHaveLength(0)
  })

  it('a real run needs confirm = the organization id, then opens the job and runs it in the background', async () => {
    expect((await POST(...post(ORG, { dry_run: false }))).status).toBe(400)
    expect((await POST(...post(ORG, { dry_run: false, confirm: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }))).status).toBe(400)
    expect(account.requestAccountDeletion).not.toHaveBeenCalled()
    const res = await POST(...post(ORG, { dry_run: false, confirm: ORG.toUpperCase() }))
    expect(res.status).toBe(202)
    expect(await res.json()).toMatchObject({ dry_run: false, created: true, deletion: { id: 'job-1', status: 'pending' } })
    expect(account.requestAccountDeletion).toHaveBeenCalledWith(expect.objectContaining({ orgId: ORG, via: 'admin', requestedBy: 'adadadad-adad-4ada-8ada-adadadadadad' }))
    expect(state.deferred).toHaveLength(1)
  })

  it('404 for an id that is not a uuid; 400 for unknown fields', async () => {
    expect((await POST(...post('not-a-uuid', {}))).status).toBe(404)
    expect((await POST(...post(ORG, { dry_run: true, org: 'x' }))).status).toBe(400)
  })
})
