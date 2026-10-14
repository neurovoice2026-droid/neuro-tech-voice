// GET    /api/commerce/connections/[id] — one connection (polled during the first import).
// DELETE /api/commerce/connections/[id] — remove the store and every mirrored record ({ confirm: store_domain }).
import { z } from 'zod'
import { RequestError, assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import { commerceRoute, noStore, ownedConnection, requireCommerceOrg } from '@/lib/commerce/api'
import { deleteStore } from '@/lib/commerce/connections'
import { connectionDto } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  return commerceRoute(request, 'connections.get', async (log) => {
    const ctx = await requireCommerceOrg(log)
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    const row = await ownedConnection(ctx.db, ctx.org.id, (await params).id)
    return noStore({ connection: await connectionDto(ctx.db, row) })
  })
}

export async function DELETE(request: Request, { params }: Params) {
  return commerceRoute(request, 'connections.delete', async (log) => {
    assertSameOrigin(request)
    const ctx = await requireCommerceOrg(log)
    const row = await ownedConnection(ctx.db, ctx.org.id, (await params).id)
    const body = await parseJsonBody(request, z.object({ confirm: z.string().trim().max(255) }), 4 * 1024)
    if (body.confirm.toLowerCase() !== row.store_domain.toLowerCase()) throw new RequestError('precondition_failed', 'Type the store domain exactly to confirm the deletion.', 409, { reason: 'confirm_mismatch' })
    await deleteStore(ctx.db, row, ctx.user.id, ctx.log)
    return noStore({ deleted: true })
  })
}
