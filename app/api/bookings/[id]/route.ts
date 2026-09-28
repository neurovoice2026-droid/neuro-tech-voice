import { NextResponse, after, type NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseJson, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { isSupabaseAdminConfigured } from '@/lib/env'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { BOOKING_COLUMNS, cancelBooking } from '@/lib/scheduling/bookings'

export const runtime = 'nodejs'
// Cancelling talks to Google Calendar.
export const maxDuration = 30

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  status: z.enum(['cancelled', 'completed', 'no_show']),
})

const CANCEL_STATUS: Record<string, number> = {
  not_found: 404,
  not_cancellable: 409,
  storage_error: 500,
  calendar_error: 502,
  calendar_auth: 409,
  calendar_not_found: 409,
  timeout: 504,
}

export const PATCH = handleRoute(async (req: NextRequest, routeCtx: Ctx) => {
  const { id } = await routeCtx.params
  if (!zUuid.safeParse(id).success) throw new ApiError(404, 'not_found', 'This booking no longer exists.')
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const { status } = await parseJson(req, bodySchema, { maxBytes: 1024 })

  if (!isSupabaseAdminConfigured()) {
    throw new ApiError(503, 'not_configured', 'Bookings can’t be changed right now. Please try again later.')
  }

  // Ownership check with the owner's own session (RLS) before any write.
  const { data: current, error: loadError } = await ctx.supabase
    .from('bookings')
    .select('id, status, starts_at, ends_at')
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .maybeSingle()
  if (loadError) {
    console.error('[bookings] lookup failed', loadError.code, loadError.message)
    throw new ApiError(500, 'update_failed', 'We couldn’t update this booking. Please try again.')
  }
  if (!current) throw new ApiError(404, 'not_found', 'This booking no longer exists.')

  if (status === 'cancelled') {
    // Removes the Google event, texts the caller when texts are on, and offers
    // the freed time to the waitlist in the background.
    const result = await cancelBooking(ctx.org.id, id, {
      notifyCaller: true,
      onlyUpcoming: true,
      signal: AbortSignal.timeout(15_000),
      defer: (task) => after(task),
    })
    if (!result.ok) {
      throw new ApiError(CANCEL_STATUS[result.reason] ?? 500, result.reason, result.message)
    }
    return noStore(
      NextResponse.json({
        booking: result.booking,
        calendar_synced: result.calendarSynced,
        sms: result.sms,
      })
    )
  }

  // Completed / no-show are bookkeeping for appointments that have started.
  if (current.status !== 'booked' && current.status !== 'rescheduled' && current.status !== status) {
    throw new ApiError(409, 'not_updatable', 'Only active bookings can be marked as completed or no-show.')
  }
  if (Date.parse(current.starts_at as string) > Date.now()) {
    throw new ApiError(409, 'not_started', 'You can mark an appointment once its start time has passed.')
  }

  // bookings is read-only for signed-in users (RLS); write with the service role, scoped to the org.
  const { data, error } = await createAdminClient()
    .from('bookings')
    .update({ status })
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .select(BOOKING_COLUMNS)
    .single()
  if (error || !data) {
    console.error('[bookings] status update failed', error?.code, error?.message)
    throw new ApiError(500, 'update_failed', 'We couldn’t update this booking. Please try again.')
  }
  return noStore(NextResponse.json({ booking: data }))
})
