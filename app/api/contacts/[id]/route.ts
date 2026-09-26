import { NextResponse, type NextRequest } from 'next/server'
import { ApiError, handleRoute, noStore, parseJson, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { resyncOrgAgentAfterResponse } from '@/app/api/settings/agent-resync'
import { CONTACT_COLUMNS, contactInputSchema } from '../schema'

export const runtime = 'nodejs'
// Covers the agent provider sync that runs after the response.
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

async function contactId(ctx: Ctx): Promise<string> {
  const { id } = await ctx.params
  const parsed = zUuid.safeParse(id)
  if (!parsed.success) throw new ApiError(404, 'not_found', 'This person is no longer on your team.')
  return parsed.data
}

/** Full replace: the dashboard form always sends every field. */
export const PATCH = handleRoute(async (req: NextRequest, routeCtx: Ctx) => {
  const id = await contactId(routeCtx)
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const input = await parseJson(req, contactInputSchema)

  const { data, error } = await ctx.supabase
    .from('escalation_contacts')
    .update(input)
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .select(CONTACT_COLUMNS)
    .maybeSingle()

  if (error) {
    console.error('[contacts] update failed', error.code, error.message)
    throw new ApiError(500, 'save_failed', 'We couldn’t save these changes. Please try again.')
  }
  if (!data) throw new ApiError(404, 'not_found', 'This person is no longer on your team.')

  await resyncOrgAgentAfterResponse(ctx, 'contact update')
  return noStore(NextResponse.json({ contact: data }))
})

export const DELETE = handleRoute(async (_req: NextRequest, routeCtx: Ctx) => {
  const id = await contactId(routeCtx)
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)

  const { data, error } = await ctx.supabase
    .from('escalation_contacts')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .select('id')

  if (error) {
    console.error('[contacts] delete failed', error.code, error.message)
    throw new ApiError(500, 'delete_failed', 'We couldn’t remove this person. Please try again.')
  }
  if (!data || data.length === 0) throw new ApiError(404, 'not_found', 'This person is no longer on your team.')

  await resyncOrgAgentAfterResponse(ctx, 'contact delete')
  return noStore(NextResponse.json({ ok: true }))
})
