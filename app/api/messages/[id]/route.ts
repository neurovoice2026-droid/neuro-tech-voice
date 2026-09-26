import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseJson, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

// 'new' = mark as unread again; 'notified' is set only by the notification service.
const bodySchema = z.object({
  status: z.enum(['new', 'read', 'done']),
})

const COLUMNS =
  'id, org_id, agent_id, call_id, recipient_contact_id, recipient_name, caller_name, caller_number, callback_number, body, urgency, status, notified_at, created_at'

export const PATCH = handleRoute(async (req: NextRequest, routeCtx: Ctx) => {
  const { id } = await routeCtx.params
  if (!zUuid.safeParse(id).success) throw new ApiError(404, 'not_found', 'This message no longer exists.')
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const { status } = await parseJson(req, bodySchema, { maxBytes: 1024 })

  const { data, error } = await ctx.supabase
    .from('agent_messages')
    .update({ status })
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .select(COLUMNS)
    .maybeSingle()

  if (error) {
    console.error('[messages] update failed', error.code, error.message)
    throw new ApiError(500, 'update_failed', 'We couldn’t update this message. Please try again.')
  }
  if (!data) throw new ApiError(404, 'not_found', 'This message no longer exists.')
  return noStore(NextResponse.json({ message: data }))
})
