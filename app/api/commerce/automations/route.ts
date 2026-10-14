// GET /api/commerce/automations?connection_id — the three templates of a connection (configured or not).
import { commerceRoute, noStore, ownedConnection, requireCommerceOrg } from '@/lib/commerce/api'
import { listAutomationDtos } from '@/lib/commerce/automations/service'
import { primaryConnection } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export async function GET(request: Request) {
  return commerceRoute(request, 'automations.list', async (log) => {
    const ctx = await requireCommerceOrg(log)
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    const connId = new URL(request.url).searchParams.get('connection_id')
    const connection = connId ? await ownedConnection(ctx.db, ctx.org.id, connId) : await primaryConnection(ctx.db, ctx.org.id)
    if (!connection) return noStore({ items: [] })
    return noStore({ items: await listAutomationDtos(ctx.db, connection, ctx.profile.display_name || ctx.org.name) })
  })
}
