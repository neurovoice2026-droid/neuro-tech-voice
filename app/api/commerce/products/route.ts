// GET /api/commerce/products?connection_id&q&stock=in_stock|out_of_stock&cursor&limit — read-only.
import { z } from 'zod'
import { applyKeyset, commerceRoute, noStore, ownedConnection, pageQuery, pageResult, requireCommerceOrg } from '@/lib/commerce/api'
import { PRODUCT_COLUMNS, type ProductRow, primaryConnection, productDto } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export async function GET(request: Request) {
  return commerceRoute(request, 'products.list', async (log) => {
    const ctx = await requireCommerceOrg(log)
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    const url = new URL(request.url)
    const page = pageQuery(url)
    const connId = url.searchParams.get('connection_id')
    const connection = connId ? await ownedConnection(ctx.db, ctx.org.id, connId) : await primaryConnection(ctx.db, ctx.org.id)
    if (!connection) return noStore({ items: [], next_cursor: null, total: 0 })
    let q = ctx.db.from('commerce_products').select(PRODUCT_COLUMNS).eq('org_id', ctx.org.id).eq('connection_id', connection.id)
    const stock = z.enum(['in_stock', 'out_of_stock', 'on_backorder', 'unknown']).safeParse(url.searchParams.get('stock'))
    if (stock.success) q = q.eq('stock_status', stock.data)
    if (page.q) q = q.or(`name.ilike.%${page.q}%,sku.ilike.%${page.q}%`)
    const { data, error } = await applyKeyset(q, page)
    if (error) throw new Error(`commerce_products read failed: ${error.message}`)
    return noStore(pageResult((data ?? []) as ProductRow[], page, productDto))
  })
}
