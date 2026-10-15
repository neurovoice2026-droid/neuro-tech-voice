import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

// POST /api/workflows: webhook and Slack URLs are fetched server-side when the
// workflow runs, so unsafe ones are refused at save time (DNS mocked), and the
// route rejects cross-site browser requests.

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

import { POST } from './route'

let db: MemoryDb

beforeEach(() => {
  state.addresses = ['93.184.216.34']
  db = memoryDb({ organizations: [{ id: 'org1', user_id: 'u1' }], workflows: [] })
  state.db = db
})

function post(body: unknown, headers: Record<string, string> = { origin: 'https://app.test' }) {
  return POST(
    new Request('https://app.test/api/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: 'app.test', ...headers },
      body: JSON.stringify(body),
    }),
  )
}

const workflow = (actions: unknown) => ({ name: 'Follow up', trigger: 'call_ended', actions })

describe('POST /api/workflows', () => {
  it('saves public https webhook and Slack steps', async () => {
    const actions = [
      { id: 'a0', type: 'send_webhook', config: { url: 'https://example.com/hook' } },
      { id: 'a1', type: 'notify_slack', config: { webhook_url: 'https://hooks.slack.com/services/T0/B0/x' } },
    ]
    const res = await post(workflow(actions))
    expect(res.status).toBe(201)
    expect(db.tables.workflows).toHaveLength(1)
    expect(db.tables.workflows[0]).toMatchObject({ org_id: 'org1', actions })
  })

  it('refuses webhook URLs that are not https or point at internal addresses', async () => {
    for (const url of ['http://example.com/hook', 'https://169.254.169.254/latest/meta-data', 'https://127.0.0.1/']) {
      const res = await post(workflow([{ id: 'a0', type: 'send_webhook', config: { url } }]))
      expect(res.status, url).toBe(400)
      expect(await res.json()).toMatchObject({ code: 'invalid_request', error: expect.stringContaining('The webhook URL in step 1 is not allowed') })
    }
    state.addresses = ['10.0.0.5']
    expect((await post(workflow([{ id: 'a0', type: 'send_webhook', config: { url: 'https://rebind.example.com/' } }]))).status).toBe(400)
    expect(db.tables.workflows).toHaveLength(0)
  })

  it('refuses a Slack step that is not a hooks.slack.com URL', async () => {
    const res = await post(workflow([{ id: 'a0', type: 'notify_slack', config: { webhook_url: 'https://example.com/services/x' } }]))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('https://hooks.slack.com/')
    expect(db.tables.workflows).toHaveLength(0)
  })

  it('refuses malformed steps', async () => {
    const res = await post(workflow([{ id: 'a0', type: 'drop_tables', config: {} }]))
    expect(res.status).toBe(400)
    expect(db.tables.workflows).toHaveLength(0)
  })

  it('rejects a cross-site browser request before touching the database', async () => {
    const res = await post(workflow([]), { origin: 'https://evil.example' })
    expect(res.status).toBe(403)
    expect(db.tables.workflows).toHaveLength(0)
  })
})
