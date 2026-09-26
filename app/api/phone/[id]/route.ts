import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseJson, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPhoneNumberView, releasePhoneNumber } from '@/lib/twilio/numbers'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

async function phoneNumberId(ctx: Params): Promise<string> {
  const { id } = await ctx.params
  const parsed = zUuid.safeParse(id)
  if (!parsed.success) throw new ApiError(404, 'not_found', 'Phone number not found.')
  return parsed.data
}

// Release a number: Twilio first (so it stops costing money), then its Stripe
// subscription and the row. If Twilio refuses, nothing changes and the owner
// can simply try again.
export const DELETE = handleRoute(async (_req: NextRequest, ctx: Params) => {
  const org = await requireOrgContext()
  const id = await phoneNumberId(ctx)
  await enforceRateLimit(RATE_LIMITS.apiWrite, org.user.id)

  const result = await releasePhoneNumber({ phoneNumberId: id, orgId: org.org.id, cancelSubscription: true })
  if (!result.ok) {
    const status = { not_found: 404, not_configured: 503, provider_error: 502, database_error: 500 }[result.code]
    throw new ApiError(status, result.code, result.error)
  }
  return noStore(Response.json({ success: true, billing_warning: result.billingWarning }))
})

const PatchSchema = z.object({ is_active: z.boolean() }).strict()

// Pause or resume a number. A paused number still rings, but the router
// answers with a short "can't take your call" message and logs a missed call.
export const PATCH = handleRoute(async (req: NextRequest, ctx: Params) => {
  const org = await requireOrgContext()
  const id = await phoneNumberId(ctx)
  const body = await parseJson(req, PatchSchema)
  await enforceRateLimit(RATE_LIMITS.apiWrite, org.user.id)

  // phone_numbers is read-only for browser sessions after migration 011.
  const { data, error } = await createAdminClient()
    .from('phone_numbers')
    .update({ is_active: body.is_active })
    .eq('id', id)
    .eq('org_id', org.org.id)
    .select('id')
  if (error) {
    console.error('[telephony] phone number update failed', error.code, error.message)
    throw new ApiError(500, 'internal_error', 'We couldn’t update this number. Please try again.')
  }
  if (!data || data.length === 0) throw new ApiError(404, 'not_found', 'Phone number not found.')

  const view = await getPhoneNumberView(org.supabase, org.org.id, id)
  if (!view) throw new ApiError(404, 'not_found', 'Phone number not found.')
  return noStore(Response.json(view))
})
