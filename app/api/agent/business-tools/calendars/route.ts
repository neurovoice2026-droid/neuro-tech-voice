// GET /api/agent/business-tools/calendars → the calendars of the org's own
// connected Google account (for the Appointments settings). Only calendars
// the account can write to can be chosen. Google API call: rate limited.
import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { apiError, errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { GoogleCalendarError, listCalendars } from '@/lib/google/calendar'

const CALENDAR_LIST_LIMIT = { name: 'calendar_list', limit: 30, windowSeconds: 600 }

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.business_tools.calendars' })
  try {
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit(CALENDAR_LIST_LIMIT, org.id, 'Too many calendar checks. Please wait a moment.')
    try {
      const calendars = await listCalendars(org.id, { signal: AbortSignal.timeout(8_000) })
      if (!calendars) return NextResponse.json({ connected: false, needs_reconnect: false, calendars: [] })
      return NextResponse.json({
        connected: true,
        needs_reconnect: false,
        calendars: calendars.map((c) => ({ id: c.id, name: c.name, primary: c.primary, can_book: c.canBook })),
      })
    } catch (err) {
      if (err instanceof GoogleCalendarError && err.code === 'auth') {
        return NextResponse.json({ connected: true, needs_reconnect: true, calendars: [] })
      }
      log.warn('agent.business_tools.calendars_failed', { code: err instanceof GoogleCalendarError ? err.code : 'unknown' })
      return apiError('provider_error', 'Google Calendar could not be reached right now. Please try again.', 502, { requestId })
    }
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.business_tools.calendars_failed', requestId)
  }
}
