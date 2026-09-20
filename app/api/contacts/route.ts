import { NextResponse } from 'next/server'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { resyncOrgAgentAfterResponse } from '@/app/api/settings/agent-resync'
import { CONTACT_COLUMNS, MAX_CONTACTS, contactInputSchema } from './schema'

export const runtime = 'nodejs'
// Covers the agent provider sync that runs after the response.
export const maxDuration = 60

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  const { data, error } = await ctx.supabase
    .from('escalation_contacts')
    .select(CONTACT_COLUMNS)
    .eq('org_id', ctx.org.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(MAX_CONTACTS)

  if (error) {
    if (isMissingTable(error)) {
      return noStore(NextResponse.json({ contacts: [], available: false, max: MAX_CONTACTS }))
    }
    console.error('[contacts] list failed', error.code, error.message)
    throw new ApiError(500, 'load_failed', 'We couldn’t load your team. Please try again.')
  }
  return noStore(NextResponse.json({ contacts: data ?? [], available: true, max: MAX_CONTACTS }))
})

export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const input = await parseJson(req, contactInputSchema)

  const { data: existing, error: countError } = await ctx.supabase
    .from('escalation_contacts')
    .select('sort_order')
    .eq('org_id', ctx.org.id)
    .order('sort_order', { ascending: false })
    .limit(MAX_CONTACTS)

  if (countError) {
    if (isMissingTable(countError)) {
      throw new ApiError(503, 'not_configured', 'Team contacts aren’t available yet. Please try again later.')
    }
    console.error('[contacts] count failed', countError.code, countError.message)
    throw new ApiError(500, 'save_failed', 'We couldn’t add this person. Please try again.')
  }
  if ((existing?.length ?? 0) >= MAX_CONTACTS) {
    throw new ApiError(409, 'limit_reached', `You can add up to ${MAX_CONTACTS} people. Remove someone first.`)
  }
  const nextOrder = existing && existing.length > 0 ? Number(existing[0].sort_order ?? 0) + 1 : 0

  const { data, error } = await ctx.supabase
    .from('escalation_contacts')
    .insert({ ...input, org_id: ctx.org.id, sort_order: nextOrder })
    .select(CONTACT_COLUMNS)
    .single()

  if (error) {
    console.error('[contacts] insert failed', error.code, error.message)
    throw new ApiError(500, 'save_failed', 'We couldn’t add this person. Please try again.')
  }

  await resyncOrgAgentAfterResponse(ctx, 'contact create')
  return noStore(NextResponse.json({ contact: data }, { status: 201 }))
})
