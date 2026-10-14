// Ownership checks of the /api/commerce routes: ids of another organization
// are 404 (never 403, never a hint that the row exists), and a service-type
// organization cannot use the store routes at all.
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ db: null as unknown, businessType: 'ecommerce' as string | null }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({ supabase: null, user: { id: '66666666-6666-4666-8666-666666666666', email: null }, org: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Magazinul Exemplu', timezone: 'Europe/Bucharest', plan: 'pro' } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))

import { AUTO_A, CONN_A, CONN_B, ORG_A, ORG_B, automationRow, commerceDb, connectionRow, orgRow } from '@/tests/helpers/commerce'
import { GET as getConnection, DELETE as deleteConnection } from '@/app/api/commerce/connections/[id]/route'
import { POST as syncConnection } from '@/app/api/commerce/connections/[id]/sync/route'
import { PUT as putAutomation } from '@/app/api/commerce/automations/[type]/route'
import { GET as listRuns } from '@/app/api/commerce/runs/route'
import { POST as cancelRun } from '@/app/api/commerce/runs/[id]/cancel/route'
import { GET as getOrder } from '@/app/api/commerce/orders/[id]/route'
import { DELETE as removeSuppression } from '@/app/api/commerce/suppressions/[customerId]/route'
import { GET as overview } from '@/app/api/commerce/overview/route'

const RUN_B = '99999999-9999-4999-8999-999999999999'
const ORDER_B = '88888888-8888-4888-8888-888888888888'
const CUST_B = '77777777-7777-4777-8777-777777777777'

function seed(businessType: string | null = 'ecommerce') {
  state.businessType = businessType
  state.db = commerceDb({
    organizations: [orgRow(ORG_A, { business_type: businessType }), orgRow(ORG_B, { user_id: 'other' })],
    commerce_connections: [connectionRow(), connectionRow({ id: CONN_B, org_id: ORG_B, store_domain: 'other.example.com', webhook_public_id: 'pubid-bbbbbbbbbbbbbbbbbbbbbbbbbbbbb' })],
    commerce_automations: [automationRow({ id: AUTO_A, org_id: ORG_B, connection_id: CONN_B })],
    commerce_automation_runs: [{ id: RUN_B, org_id: ORG_B, automation_id: AUTO_A, connection_id: CONN_B, automation_type: 'cod_confirmation', external_ref: '1', event_key: 'order:1', idempotency_key: 'kb', status: 'scheduled', created_at: 'x', updated_at: 'x' }],
    commerce_orders: [{ id: ORDER_B, org_id: ORG_B, connection_id: CONN_B, external_id: '1', order_number: '1', status: 'processing', financial_status: 'pending', fulfillment_status: 'unfulfilled', is_cod: true, items_count: 0, updated_at: 'x' }],
    commerce_customers: [{ id: CUST_B, org_id: ORG_B, connection_id: CONN_B, external_id: 'c', do_not_call: true, updated_at: 'x' }],
    agents: [],
    phone_numbers: [],
  })
}

const json = (method: string, url: string, body?: unknown) =>
  new Request(url, { method, headers: { 'content-type': 'application/json', origin: 'https://app.example.com', host: 'app.example.com' }, body: body === undefined ? undefined : JSON.stringify(body) })
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) })

describe('commerce route ownership', () => {
  it('answers 404 for connections, orders, runs and customers of another organization', async () => {
    seed()
    expect((await getConnection(json('GET', 'https://app.example.com/api/commerce/connections/x'), params({ id: CONN_B }))).status).toBe(404)
    expect((await deleteConnection(json('DELETE', 'https://app.example.com/x', { confirm: 'other.example.com' }), params({ id: CONN_B }))).status).toBe(404)
    expect((await syncConnection(json('POST', 'https://app.example.com/x', { resource: 'all' }), params({ id: CONN_B }))).status).toBe(404)
    const put = await putAutomation(json('PUT', 'https://app.example.com/x', { connection_id: CONN_B, enabled: true }), params({ type: 'cod_confirmation' }))
    expect(put.status).toBe(404)
    expect((await getOrder(json('GET', 'https://app.example.com/x'), params({ id: ORDER_B }))).status).toBe(404)
    expect((await cancelRun(json('POST', 'https://app.example.com/x'), params({ id: RUN_B }))).status).toBe(409)
    expect((await removeSuppression(json('DELETE', 'https://app.example.com/x', { confirm: true, reason: 'test' }), params({ customerId: CUST_B }))).status).toBe(404)
    // Nothing of org B changed.
    const db = state.db as ReturnType<typeof commerceDb>
    expect(db.tables.commerce_automation_runs[0].status).toBe('scheduled')
    expect(db.tables.commerce_customers[0].do_not_call).toBe(true)
    expect(db.tables.commerce_connections).toHaveLength(2)
  })

  it('lists only the organization\'s own runs and serves its own connection', async () => {
    seed()
    const res = await listRuns(json('GET', 'https://app.example.com/api/commerce/runs?limit=10'))
    expect(res.status).toBe(200)
    expect((await res.json()).items).toEqual([])
    const own = await getConnection(json('GET', 'https://app.example.com/x'), params({ id: CONN_A }))
    expect(own.status).toBe(200)
    const body = await own.json()
    expect(body.connection.id).toBe(CONN_A)
    expect(JSON.stringify(body)).not.toMatch(/encrypted|webhook_public_id|sync_cursor/)
  })

  it('refuses a service-business organization with 403', async () => {
    seed('services')
    expect((await overview(json('GET', 'https://app.example.com/api/commerce/overview'))).status).toBe(403)
    expect((await listRuns(json('GET', 'https://app.example.com/api/commerce/runs'))).status).toBe(403)
  })

  it('rejects cross-site state changes', async () => {
    seed()
    const req = new Request('https://app.example.com/x', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example', host: 'app.example.com' }, body: '{}' })
    expect((await syncConnection(req, params({ id: CONN_A }))).status).toBe(403)
  })
})
