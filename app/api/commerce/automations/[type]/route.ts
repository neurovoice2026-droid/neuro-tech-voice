// PUT /api/commerce/automations/[type] — configure, enable or pause one automation of a connection.
import { RequestError, assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import { commerceRoute, noStore, ownedConnection, requireCommerceOrg } from '@/lib/commerce/api'
import { AutomationPatchSchema, upsertAutomation } from '@/lib/commerce/automations/service'
import { AUTOMATION_TYPES, type AutomationType } from '@/lib/commerce/types'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export async function PUT(request: Request, { params }: { params: Promise<{ type: string }> }) {
  return commerceRoute(request, 'automations.put', async (log) => {
    assertSameOrigin(request)
    const ctx = await requireCommerceOrg(log)
    const { type } = await params
    if (!(AUTOMATION_TYPES as readonly string[]).includes(type)) throw new RequestError('not_found', 'This automation does not exist.', 404)
    const patch = await parseJsonBody(request, AutomationPatchSchema, 32 * 1024)
    const connection = await ownedConnection(ctx.db, ctx.org.id, patch.connection_id)
    await enforceRateLimit(RATE_LIMITS.commerceAutomationWrite, ctx.org.id)
    const { data: agent, error: agentError } = await ctx.db.from('agents').select('id').eq('org_id', ctx.org.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    // A failed read must not be recorded as "no agent": enabling would then be refused for the wrong reason.
    if (agentError) throw new Error(`agents read failed: ${agentError.message}`)
    const dto = await upsertAutomation(
      ctx.db,
      { orgId: ctx.org.id, userId: ctx.user.id, connection, type: type as AutomationType, patch, agentId: (agent?.id as string | undefined) ?? null, brandName: ctx.profile.display_name || ctx.org.name },
      ctx.log,
    )
    return noStore({ automation: dto })
  })
}
