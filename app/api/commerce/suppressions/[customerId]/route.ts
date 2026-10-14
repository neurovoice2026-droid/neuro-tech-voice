// DELETE /api/commerce/suppressions/[customerId] { confirm: true, reason } — remove a suppression (explicit, audited operator action).
import { z } from 'zod'
import { RequestError, assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import { commerceRoute, noStore, requireCommerceOrg, uuid } from '@/lib/commerce/api'
import { CUSTOMER_COLUMNS, type CustomerRow, clearDoNotCall, customerDto, writeAudit } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

const Body = z.object({ confirm: z.literal(true), reason: z.string().trim().min(3, 'Motivul are cel puțin 3 caractere').max(200) })

export async function DELETE(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  return commerceRoute(request, 'suppressions.remove', async (log) => {
    assertSameOrigin(request)
    const ctx = await requireCommerceOrg(log)
    const { customerId } = await params
    if (!uuid.safeParse(customerId).success) throw new RequestError('not_found', 'Clientul nu există.', 404)
    const body = await parseJsonBody(request, Body, 4 * 1024)
    await enforceRateLimit(RATE_LIMITS.commerceAutomationWrite, ctx.org.id)
    const { data: existing, error } = await ctx.db.from('commerce_customers').select(CUSTOMER_COLUMNS).eq('id', customerId).eq('org_id', ctx.org.id).maybeSingle()
    if (error) throw new Error(`commerce_customers read failed: ${error.message}`)
    if (!existing) throw new RequestError('not_found', 'Clientul nu există.', 404)
    const current = existing as CustomerRow
    if (current.do_not_call_source === 'customer_opt_out') {
      // The customer asked on a call: an operator may still lift it, but it is recorded as such.
      ctx.log.warn('commerce.suppression.customer_opt_out_lifted', { customerId })
    }
    const row = (await clearDoNotCall(ctx.db, { orgId: ctx.org.id, customerId })) ?? current
    await writeAudit(ctx.db, { orgId: ctx.org.id, actor: 'user', actorUserId: ctx.user.id, action: 'suppression.removed', connectionId: current.connection_id, metadata: { customer: current.id, previous_source: current.do_not_call_source, reason: body.reason } }, ctx.log)
    return noStore({ customer: customerDto(row) })
  })
}
