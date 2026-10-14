// GET /api/commerce/orders?q= searches the columns the Orders page advertises
// ("numărul comenzii, nume sau oraș"): order number, contact name and shipping
// city, plus the platform id. The memory DB ignores or(), so the filter the
// route sends to PostgREST is captured and inspected.
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => ({ supabase: null, user: { id: '66666666-6666-4666-8666-666666666666', email: null }, org: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Magazinul Exemplu', timezone: 'Europe/Bucharest', plan: 'pro' } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))

import { ORG_A, commerceDb, connectionRow, orgRow } from '@/tests/helpers/commerce'
import { GET as listOrders } from '@/app/api/commerce/orders/route'

/** The memory DB with every or() filter string recorded per table. */
function seed() {
  const db = commerceDb({ organizations: [orgRow(ORG_A)], commerce_connections: [connectionRow()], commerce_orders: [] })
  const ors: Array<{ table: string; filter: string }> = []
  const from = db.from
  state.db = {
    ...db,
    from: (table: string) => {
      const query = from(table) as unknown as { or: (filter: string) => unknown }
      const or = query.or.bind(query)
      query.or = (filter: string) => {
        ors.push({ table, filter })
        return or(filter)
      }
      return query
    },
  }
  return ors
}

const get = (query: string) => listOrders(new Request(`https://app.example.com/api/commerce/orders${query}`, { headers: { host: 'app.example.com' } }))

describe('orders search', () => {
  it('matches the order number, the contact name and the shipping city', async () => {
    const ors = seed()
    const res = await get('?q=Cluj')
    expect(res.status).toBe(200)
    const search = ors.filter((o) => o.table === 'commerce_orders' && o.filter.includes('ilike'))
    expect(search).toHaveLength(1)
    const terms = search[0].filter.split(',')
    expect(terms).toContain('order_number.ilike.%Cluj%')
    expect(terms).toContain('contact_name.ilike.%Cluj%')
    expect(terms).toContain('shipping_city.ilike.%Cluj%')
  })

  it('sends no search filter without q and keeps PostgREST syntax out of the term', async () => {
    const none = seed()
    expect((await get('')).status).toBe(200)
    expect(none.filter((o) => o.filter.includes('ilike'))).toHaveLength(0)

    const unsafe = seed()
    expect((await get('?q=' + encodeURIComponent('Cluj,or(1%'))).status).toBe(200)
    const filter = unsafe.find((o) => o.filter.includes('ilike'))?.filter ?? ''
    expect(filter).toContain('shipping_city.ilike.%Cluj or 1%')
    expect(filter.split(',')).toHaveLength(4)
  })
})
