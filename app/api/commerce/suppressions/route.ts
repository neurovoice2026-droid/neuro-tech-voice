// GET  /api/commerce/suppressions?connection_id&cursor&limit — the do-not-call list.
// POST /api/commerce/suppressions { customer_id, reason? } — add a customer (operator action, audited).
import { z } from 'zod'
import { RequestError, assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import { applyKeyset, commerceRoute, noStore, ownedConnection, pageQuery, pageResult, requireCommerceOrg } from '@/lib/commerce/api'
import { cancelRunsForSuppressedContact } from '@/lib/commerce/automations/scheduler'
import { CUSTOMER_COLUMNS, type CustomerRow, customerDto, markDoNotCall, primaryConnection, writeAudit } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export async function GET(request: Request) {
  return commerceRoute(request, 'suppressions.list', async (log) => {
    const ctx = await requireCommerceOrg(log)
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    const url = new URL(request.url)
    const page = pageQuery(url)
    const connId = url.searchParams.get('connection_id')
    const connection = connId ? await ownedConnection(ctx.db, ctx.org.id, connId) : await primaryConnection(ctx.db, ctx.org.id)
    if (!connection) return noStore({ items: [], next_cursor: null, total: 0 })
    const q = ctx.db.from('commerce_customers').select(CUSTOMER_COLUMNS).eq('org_id', ctx.org.id).eq('connection_id', connection.id).eq('do_not_call', true)
    const { data, error } = await applyKeyset(q, page)
    if (error) throw new Error(`commerce_customers read failed: ${error.message}`)
    return noStore(pageResult((data ?? []) as CustomerRow[], page, customerDto))
  })
}

const Body = z.object({ customer_id: z.string().uuid(), reason: z.string().trim().max(200).optional() })

export async function POST(request: Request) {
  return commerceRoute(request, 'suppressions.add', async (log) => {
    assertSameOrigin(request)
    const ctx = await requireCommerceOrg(log)
    const body = await parseJsonBody(request, Body, 4 * 1024)
    await enforceRateLimit(RATE_LIMITS.commerceAutomationWrite, ctx.org.id)
    const { data: existing, error } = await ctx.db.from('commerce_customers').select(CUSTOMER_COLUMNS).eq('id', body.customer_id).eq('org_id', ctx.org.id).maybeSingle()
    if (error) throw new Error(`commerce_customers read failed: ${error.message}`)
    if (!existing) throw new RequestError('not_found', 'Clientul nu există.', 404)
    const current = existing as CustomerRow
    const row = (await markDoNotCall(ctx.db, { orgId: ctx.org.id, connectionId: current.connection_id, customerId: current.id, phoneE164: current.phone_e164, reason: body.reason ?? 'Adăugat de operator', source: 'operator' })) ?? current
    const cancelled = await cancelRunsForSuppressedContact({ db: ctx.db, orgId: ctx.org.id, connectionId: current.connection_id, timezone: ctx.org.timezone ?? 'UTC', log: ctx.log }, { customerId: current.id, phone: current.phone_e164 })
    await writeAudit(ctx.db, { orgId: ctx.org.id, actor: 'user', actorUserId: ctx.user.id, action: 'suppression.added', connectionId: current.connection_id, metadata: { source: 'operator', customer: current.id, cancelled_runs: cancelled } }, ctx.log)
    return noStore({ customer: customerDto(row) })
  })
}
