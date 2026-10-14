// GET /api/commerce/overview — the store overview (connection, automations, queue, recent calls, problems).
import { commerceRoute, noStore, requireCommerceOrg } from '@/lib/commerce/api'
import { buildOverview } from '@/lib/commerce/overview'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export async function GET(request: Request) {
  return commerceRoute(request, 'overview', async (log) => {
    const ctx = await requireCommerceOrg(log)
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    return noStore(await buildOverview(ctx.db, { id: ctx.org.id, plan: ctx.org.plan }, ctx.profile.display_name || ctx.org.name))
  })
}
