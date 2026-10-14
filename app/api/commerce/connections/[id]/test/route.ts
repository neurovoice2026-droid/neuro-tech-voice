// POST /api/commerce/connections/[id]/test — re-validate the stored credentials against the platform.
import { assertSameOrigin } from '@/lib/api/http'
import { commerceRoute, noStore, ownedConnection, requireCommerceOrg } from '@/lib/commerce/api'
import { testConnection } from '@/lib/commerce/connections'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return commerceRoute(request, 'connections.test', async (log) => {
    assertSameOrigin(request)
    const ctx = await requireCommerceOrg(log)
    const row = await ownedConnection(ctx.db, ctx.org.id, (await params).id)
    await enforceRateLimit(RATE_LIMITS.commerceConnect, ctx.org.id, 'Too many tests. Try again in a few minutes.')
    return noStore(await testConnection(ctx.db, row, ctx.log))
  })
}
