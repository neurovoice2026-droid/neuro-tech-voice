// GET /api/commerce/customers?connection_id&q&dnc=1&cursor&limit — read-only, masked contact fields.
import { applyKeyset, commerceRoute, noStore, ownedConnection, pageQuery, pageResult, requireCommerceOrg } from '@/lib/commerce/api'
import { CUSTOMER_COLUMNS, type CustomerRow, customerDto, primaryConnection } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export async function GET(request: Request) {
  return commerceRoute(request, 'customers.list', async (log) => {
    const ctx = await requireCommerceOrg(log)
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    const url = new URL(request.url)
    const page = pageQuery(url)
    const connId = url.searchParams.get('connection_id')
    const connection = connId ? await ownedConnection(ctx.db, ctx.org.id, connId) : await primaryConnection(ctx.db, ctx.org.id)
    if (!connection) return noStore({ items: [], next_cursor: null, total: 0 })
    let q = ctx.db.from('commerce_customers').select(CUSTOMER_COLUMNS).eq('org_id', ctx.org.id).eq('connection_id', connection.id)
    if (url.searchParams.get('dnc') === '1') q = q.eq('do_not_call', true)
    if (page.q) q = q.or(`first_name.ilike.%${page.q}%,last_name.ilike.%${page.q}%,email.ilike.%${page.q}%,phone_e164.ilike.%${page.q.replace(/\s/g, '')}%`)
    const { data, error } = await applyKeyset(q, page)
    if (error) throw new Error(`commerce_customers read failed: ${error.message}`)
    return noStore(pageResult((data ?? []) as CustomerRow[], page, customerDto))
  })
}
