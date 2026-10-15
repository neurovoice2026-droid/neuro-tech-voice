import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// PATCH / DELETE /api/workflows/[id]: a changed step list goes through the same
// URL guard as a new workflow (DNS mocked), and cross-site browser requests are
// rejected.

const state = vi.hoisted(() => ({ db: null as unknown, addresses: ['93.184.216.34'] as string[] }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (table: string) => (state.db as MemoryDb).from(table),
  }),
}))
vi.mock('node:dns/promises', () => ({
  default: { lookup: vi.fn(async () => state.addresses.map((address) => ({ address, family: 4 }))) },
}))

import { DELETE, PATCH } from './route'

const SAFE = [{ id: 'a0', type: 'send_webhook', config: { url: 'https://example.com/hook' } }]
let db: MemoryDb

beforeEach(() => {
  state.addresses = ['93.184.216.34']
  db = memoryDb({
    organizations: [{ id: 'org1', user_id: 'u1' }],
    workflows: [{ id: 'wf1', org_id: 'org1', name: 'Follow up', trigger: 'call_ended', actions: SAFE, enabled: true }],
  })
  state.db = db
})

const params = { params: Promise.resolve({ id: 'wf1' }) }

function request(method: 'PATCH' | 'DELETE', body?: unknown, origin = 'https://app.test') {
  return new Request('https://app.test/api/workflows/wf1', {
    method,
    headers: { 'content-type': 'application/json', host: 'app.test', origin },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('PATCH /api/workflows/[id]', () => {
  it('toggles a workflow without re-checking its steps', async () => {
    const res = await PATCH(request('PATCH', { enabled: false }), params)
    expect(res.status).toBe(200)
    expect(db.tables.workflows[0]).toMatchObject({ enabled: false, actions: SAFE })
  })

  it('saves safe steps and refuses an internal webhook URL or a non-Slack Slack URL', async () => {
    const slack = [{ id: 'a0', type: 'notify_slack', config: { webhook_url: 'https://hooks.slack.com/services/T0/B0/x' } }]
    expect((await PATCH(request('PATCH', { actions: slack }), params)).status).toBe(200)
    expect(db.tables.workflows[0].actions).toEqual(slack)

    for (const actions of [
      [{ id: 'a0', type: 'send_webhook', config: { url: 'https://169.254.169.254/latest/meta-data' } }],
      [{ id: 'a0', type: 'send_webhook', config: { url: 'http://example.com/hook' } }],
      [{ id: 'a0', type: 'notify_slack', config: { webhook_url: 'https://example.com/services/x' } }],
    ]) {
      const res = await PATCH(request('PATCH', { actions }), params)
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ code: 'invalid_request' })
    }
    state.addresses = ['172.16.0.9']
    expect((await PATCH(request('PATCH', { actions: SAFE }), params)).status).toBe(400)
    expect(db.tables.workflows[0].actions).toEqual(slack)
  })

  it('rejects a cross-site browser request', async () => {
    const res = await PATCH(request('PATCH', { enabled: false }, 'https://evil.example'), params)
    expect(res.status).toBe(403)
    expect(db.tables.workflows[0].enabled).toBe(true)
  })
})

describe('DELETE /api/workflows/[id]', () => {
  it('deletes on a same-origin request and rejects a cross-site one', async () => {
    expect((await DELETE(request('DELETE', undefined, 'https://evil.example'), params)).status).toBe(403)
    expect(db.tables.workflows).toHaveLength(1)
    expect((await DELETE(request('DELETE'), params)).status).toBe(200)
    expect(db.tables.workflows).toHaveLength(0)
  })
})
