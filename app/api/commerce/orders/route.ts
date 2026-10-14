// GET /api/commerce/orders?connection_id&q&status&cod=1&cursor&limit — read-only, tenant-scoped, keyset paged.
import { z } from 'zod'
import { applyKeyset, commerceRoute, noStore, ownedConnection, pageQuery, pageResult, requireCommerceOrg } from '@/lib/commerce/api'
import { ORDER_COLUMNS, type OrderRow, orderDto, primaryConnection } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

const STATUSES = ['pending', 'processing', 'on_hold', 'completed', 'cancelled', 'refunded', 'failed', 'draft', 'unknown'] as const

export async function GET(request: Request) {
  return commerceRoute(request, 'orders.list', async (log) => {
    const ctx = await requireCommerceOrg(log)
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    const url = new URL(request.url)
    const page = pageQuery(url)
    const connId = url.searchParams.get('connection_id')
    const connection = connId ? await ownedConnection(ctx.db, ctx.org.id, connId) : await primaryConnection(ctx.db, ctx.org.id)
    if (!connection) return noStore({ items: [], next_cursor: null, total: 0 })
    let q = ctx.db.from('commerce_orders').select(ORDER_COLUMNS).eq('org_id', ctx.org.id).eq('connection_id', connection.id)
    const status = z.enum(STATUSES).safeParse(url.searchParams.get('status'))
    if (status.success) q = q.eq('status', status.data)
    if (url.searchParams.get('cod') === '1') q = q.eq('is_cod', true)
    // The columns the Orders page advertises (number, name, city) plus the platform id; pageQuery stripped %,_,(,) from q.
    if (page.q) q = q.or(`order_number.ilike.%${page.q}%,contact_name.ilike.%${page.q}%,external_id.ilike.%${page.q}%,shipping_city.ilike.%${page.q}%`)
    const { data, error } = await applyKeyset(q, page)
    if (error) throw new Error(`commerce_orders read failed: ${error.message}`)
    return noStore(pageResult((data ?? []) as OrderRow[], page, orderDto))
  })
}
