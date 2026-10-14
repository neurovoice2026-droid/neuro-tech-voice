// POST /api/commerce/connections/[id]/disconnect — erase credentials, remove webhooks, pause automations; data kept.
import { assertSameOrigin } from '@/lib/api/http'
import { commerceRoute, noStore, ownedConnection, requireCommerceOrg } from '@/lib/commerce/api'
import { disconnectStore } from '@/lib/commerce/connections'
import { connectionDto } from '@/lib/commerce/store'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return commerceRoute(request, 'connections.disconnect', async (log) => {
    assertSameOrigin(request)
    const ctx = await requireCommerceOrg(log)
    const row = await ownedConnection(ctx.db, ctx.org.id, (await params).id)
    const final = row.status === 'disconnected' ? row : await disconnectStore(ctx.db, row, ctx.user.id, ctx.log)
    return noStore({ connection: await connectionDto(ctx.db, final) })
  })
}
