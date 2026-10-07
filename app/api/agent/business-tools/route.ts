// GET /api/agent/business-tools → the in-call tool settings of the org's agent
//   (Appointments, Messages), the Google Calendar connection and the owner's
//   alert address.
// PUT /api/agent/business-tools {booking?, messages?} → validates, saves
//   (service role: the columns are platform-managed, migration 018) and pushes
//   the agent config so the tools are attached or removed. A chosen calendar
//   must be one the connected Google account can write to.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { apiError, assertSameOrigin, errorResponse, parseJsonBody, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { defaultAgentName, ensureAgent, syncAgentProviders, type AgentSyncReport } from '@/lib/agents/ensure-agent'
import { BookingSettingsSchema, MessageSettingsSchema, readBookingSettings, readMessageSettings } from '@/lib/voice-providers/settings'
import { calendarConnection, GoogleCalendarError, listCalendars } from '@/lib/google/calendar'
import type { BookingSettings, MessageSettings } from '@/lib/voice-providers/types'

// The awaited primary sync can take several provider round-trips.
export const maxDuration = 60

const Body = z.strictObject({
  booking: BookingSettingsSchema.optional(),
  messages: MessageSettingsSchema.optional(),
})

/** Calendar list checks (Google API) per org. */
const CALENDAR_CHECK_LIMIT = { name: 'calendar_list', limit: 30, windowSeconds: 600 }

const CONNECT_URL = '/api/integrations/google/connect?type=google_calendar'

function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1))) : v,
  )
}

async function loadState(orgId: string, agentId: string) {
  const { data, error } = await createAdminClient().from('agents').select('booking_settings, message_settings').eq('id', agentId).eq('org_id', orgId).maybeSingle()
  if (error) throw new Error(`agents business tool settings read failed: ${error.message}`)
  return { booking: readBookingSettings(data?.booking_settings), messages: readMessageSettings(data?.message_settings) }
}

function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.business_tools.get' })
  try {
    const { user, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    const [state, calendar] = await Promise.all([loadState(org.id, agent.id), calendarConnection(org.id)])
    return NextResponse.json({
      ...state,
      calendar: { configured: googleConfigured(), connected: calendar.connected, needs_reconnect: calendar.needsReconnect, connect_url: CONNECT_URL },
      owner_email: user.email ?? null,
      owner_email_verified: !!user.email_confirmed_at,
    })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.business_tools.get_failed', requestId)
  }
}

export async function PUT(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.business_tools.put' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, Body, 8 * 1024)
    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    log = log.child({ agentId: agent.id })
    const current = await loadState(org.id, agent.id)

    const patch: { booking_settings?: BookingSettings; message_settings?: MessageSettings } = {}
    if (body.booking && stable(body.booking) !== stable(current.booking)) patch.booking_settings = body.booking
    if (body.messages && stable(body.messages) !== stable(current.messages)) patch.message_settings = body.messages
    if (!patch.booking_settings && !patch.message_settings) return NextResponse.json({ ...current, sync: [] })

    // Saves push the agent config (shared provider accounts): bounded per org, checked before any write.
    await enforceRateLimit(RATE_LIMITS.agentSync, org.id, 'Too many changes in a short time. Please wait a moment and save again.')

    // The agent only ever writes to a calendar the connected account can write to.
    const calendarId = patch.booking_settings?.calendar_id
    if (calendarId && calendarId !== 'primary' && calendarId !== current.booking.calendar_id) {
      await enforceRateLimit(CALENDAR_CHECK_LIMIT, org.id, 'Too many calendar checks. Please wait a moment.')
      let calendars: Awaited<ReturnType<typeof listCalendars>>
      try {
        calendars = await listCalendars(org.id)
      } catch (err) {
        log.warn('agent.business_tools.calendar_check_failed', { code: err instanceof GoogleCalendarError ? err.code : 'unknown' })
        return apiError('provider_error', 'Google Calendar could not be checked right now. Please try again.', 502, { requestId })
      }
      const match = calendars?.find((c) => c.id === calendarId)
      if (!match || !match.canBook) {
        return apiError('invalid_request', 'Choose a calendar your connected Google account can add events to.', 400, {
          requestId,
          details: [{ path: 'booking.calendar_id', message: 'Calendar not available' }],
        })
      }
    }

    const { error } = await createAdminClient().from('agents').update(patch).eq('id', agent.id).eq('org_id', org.id)
    if (error) throw new Error(`agents business tool settings update failed: ${error.message}`)

    const sync: AgentSyncReport[] = await syncAgentProviders({
      supabase,
      orgId: org.id,
      agentId: agent.id,
      primaryProvider: agent.primary_provider === 'cartesia' ? 'cartesia' : 'elevenlabs',
      bump: true,
      primary: true,
      fallback: true,
      log,
    })
    log.info('agent.business_tools.saved', {
      booking: patch.booking_settings ? patch.booking_settings.enabled : undefined,
      messages: patch.message_settings ? patch.message_settings.enabled : undefined,
      sync: sync.map((s) => `${s.provider}:${s.status}`),
    })
    return NextResponse.json({ ...(await loadState(org.id, agent.id)), sync })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.business_tools.put_failed', requestId)
  }
}
