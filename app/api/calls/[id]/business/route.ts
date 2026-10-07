// GET /api/calls/[id]/business → the message taken and the appointments
// booked by the agent during this call (slice B2). The call is looked up in
// the org's own rows first; both reads are scoped by org id and RLS.
import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { apiError, errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { findOrgCall, parseCallId } from '@/lib/calls/serialize'
import { BOOKING_VIEW_COLUMNS, MESSAGE_COLUMNS, toBookingView, toMessageView } from '@/lib/voice-tools/message-view'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'calls.business' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const id = parseCallId((await params).id)
    const call = await findOrgCall<{ id: string }>(supabase, org.id, id, 'id')
    if (!call) return apiError('not_found', 'Call not found', 404, { requestId })

    const [messages, bookings] = await Promise.all([
      supabase.from('call_messages').select(MESSAGE_COLUMNS).eq('org_id', org.id).eq('call_id', call.id).limit(5),
      supabase.from('bookings').select(BOOKING_VIEW_COLUMNS).eq('org_id', org.id).eq('call_id', call.id).order('starts_at', { ascending: true }).limit(10),
    ])
    if (messages.error) throw new Error(`call_messages read failed: ${messages.error.message}`)
    if (bookings.error) throw new Error(`bookings read failed: ${bookings.error.message}`)
    return NextResponse.json({
      messages: (messages.data ?? []).map((r) => toMessageView(r as Record<string, unknown>)),
      bookings: (bookings.data ?? []).map((r) => toBookingView(r as Record<string, unknown>)),
    })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'calls.business_failed', requestId)
  }
}
