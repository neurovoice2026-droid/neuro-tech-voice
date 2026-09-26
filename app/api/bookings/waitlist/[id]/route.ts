import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseJson, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

// The owner can mark someone as booked (arranged by hand), take them off the
// list, or put them back. 'offered' is set only when an SMS offer goes out.
const bodySchema = z.object({
  status: z.enum(['waiting', 'booked', 'removed']),
})

const COLUMNS = 'id, org_id, agent_id, call_id, caller_name, caller_phone, service, preferred_times, status, offered_at, created_at'

export const PATCH = handleRoute(async (req: NextRequest, routeCtx: Ctx) => {
  const { id } = await routeCtx.params
  if (!zUuid.safeParse(id).success) throw new ApiError(404, 'not_found', 'This waitlist entry no longer exists.')
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const { status } = await parseJson(req, bodySchema, { maxBytes: 1024 })

  // waitlist_entries allows owners to update their own rows (RLS).
  const { data, error } = await ctx.supabase
    .from('waitlist_entries')
    .update({ status })
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .select(COLUMNS)
    .maybeSingle()

  if (error) {
    console.error('[waitlist] update failed', error.code, error.message)
    throw new ApiError(500, 'update_failed', 'We couldn’t update this entry. Please try again.')
  }
  if (!data) throw new ApiError(404, 'not_found', 'This waitlist entry no longer exists.')
  return noStore(NextResponse.json({ entry: data }))
})
