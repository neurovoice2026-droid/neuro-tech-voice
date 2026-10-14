// GET /api/commerce/orders/[id] — one order with its items and automation runs (tenant-scoped).
import { RequestError } from '@/lib/api/http'
import { maskPhone } from '@/lib/phone/e164'
import { commerceRoute, noStore, requireCommerceOrg, uuid } from '@/lib/commerce/api'
import { ORDER_COLUMNS, type OrderRow, RUN_COLUMNS_WITH_REFS, type RunRow, orderDto, runDto } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

function maskEmail(email: string | null): string | null {
  if (!email) return null
  const [user, domain] = email.split('@')
  return domain ? `${user.slice(0, 2)}***@${domain}` : '***'
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return commerceRoute(request, 'orders.get', async (log) => {
    const ctx = await requireCommerceOrg(log)
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    const { id } = await params
    if (!uuid.safeParse(id).success) throw new RequestError('not_found', 'This order does not exist.', 404)
    const { data, error } = await ctx.db.from('commerce_orders').select(ORDER_COLUMNS).eq('id', id).eq('org_id', ctx.org.id).maybeSingle()
    if (error) throw new Error(`commerce_orders read failed: ${error.message}`)
    if (!data) throw new RequestError('not_found', 'This order does not exist.', 404)
    const order = data as OrderRow
    const [items, runs] = await Promise.all([
      ctx.db.from('commerce_order_items').select('name, sku, quantity, unit_price, total').eq('order_id', order.id).eq('org_id', ctx.org.id).order('created_at', { ascending: true }).limit(200),
      ctx.db.from('commerce_automation_runs').select(RUN_COLUMNS_WITH_REFS).eq('order_id', order.id).eq('org_id', ctx.org.id).order('created_at', { ascending: false }).limit(20),
    ])
    if (items.error) throw new Error(`commerce_order_items read failed: ${items.error.message}`)
    if (runs.error) throw new Error(`commerce_automation_runs read failed: ${runs.error.message}`)
    return noStore({
      order: {
        ...orderDto(order),
        items: (items.data ?? []).map((i) => ({ name: String(i.name), sku: (i.sku as string | null) ?? null, quantity: Number(i.quantity ?? 1), unit_price: i.unit_price === null ? null : Number(i.unit_price), total: i.total === null ? null : Number(i.total) })),
        shipping_summary: order.shipping_summary,
        shipping_country: order.shipping_country,
        contact_email_masked: maskEmail(order.contact_email),
        contact_phone_masked: order.contact_phone_e164 ? maskPhone(order.contact_phone_e164) : null,
        provider_updated_at: order.provider_updated_at,
        external_id: order.external_id,
      },
      runs: ((runs.data ?? []) as RunRow[]).map(runDto),
    })
  })
}
