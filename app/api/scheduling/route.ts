import { NextResponse } from 'next/server'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext, type OrgContext } from '@/lib/api/auth'
import { isGoogleConfigured } from '@/lib/env'
import { entitlementsFor, requiredPlanFor } from '@/lib/billing/entitlements'
import { RATE_LIMITS, enforceRateLimit, rateLimit, type RateLimitPolicy } from '@/lib/security/rate-limit'
import { GoogleCalendarError, listCalendars } from '@/lib/google/calendar'
import { resyncOrgAgentAfterResponse } from '@/app/api/settings/agent-resync'
import { schedulingSettingsInputSchema, withSchedulingDefaults } from './schema'

export const runtime = 'nodejs'
// Covers the Google calendar list and the agent provider sync after a save.
export const maxDuration = 60

const SETTINGS_COLUMNS =
  'org_id, calendar_id, slot_minutes, buffer_minutes, min_notice_minutes, max_days_ahead, business_hours, services, send_sms_confirmation, send_reminders, reminder_hours_before, updated_at'

type PgError = { code?: string; message?: string } | null

// Each settings load asks Google for the calendar list; cap it per org so a
// reload loop can't burn the Google API quota. Over the cap, the saved calendar
// is still shown.
const CALENDAR_LIST_LIMIT: RateLimitPolicy = { name: 'calendarList', limit: 30, windowSeconds: 10 * 60 }

function isMissingRelation(error: PgError): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === '42703'
}

interface CalendarOption {
  id: string
  name: string
  primary: boolean
}

async function loadGoogleCalendarStatus(ctx: OrgContext): Promise<{ connected: boolean; account_email: string | null }> {
  // Explicit, non-secret columns only (token columns are hidden after 011).
  let result = await ctx.supabase
    .from('integrations')
    .select('is_active, account_email')
    .eq('org_id', ctx.org.id)
    .eq('type', 'google_calendar')
    .maybeSingle()
  if (result.error?.code === '42703') {
    result = await ctx.supabase
      .from('integrations')
      .select('is_active')
      .eq('org_id', ctx.org.id)
      .eq('type', 'google_calendar')
      .maybeSingle()
  }
  if (result.error) {
    console.error('[scheduling] calendar integration lookup failed', result.error.code, result.error.message)
    throw new ApiError(500, 'load_failed', 'We couldn’t load your booking settings. Please try again.')
  }
  const row = result.data as { is_active?: boolean; account_email?: string | null } | null
  return { connected: Boolean(row?.is_active), account_email: row?.account_email ?? null }
}

async function listWritableCalendars(orgId: string): Promise<{ calendars: CalendarOption[] | null; error: string | null }> {
  try {
    const list = await listCalendars(orgId, { signal: AbortSignal.timeout(8000) })
    if (!list) return { calendars: null, error: 'Reconnect Google Calendar to choose a calendar.' }
    // Only calendars the agent can write bookings into.
    const calendars = list.filter((c) => c.canBook).map((c) => ({ id: c.id, name: c.name, primary: c.primary }))
    return { calendars, error: null }
  } catch (error) {
    const code = error instanceof GoogleCalendarError ? error.code : 'failed'
    console.error('[scheduling] listing Google calendars failed', code)
    return {
      calendars: null,
      error:
        code === 'auth'
          ? 'Google Calendar needs to be reconnected before we can list your calendars.'
          : 'We couldn’t load your calendars from Google right now. Your saved calendar keeps working.',
    }
  }
}

export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  const entitlements = entitlementsFor(ctx.org.plan)
  const googleConfigured = isGoogleConfigured()

  const [settingsResult, google] = await Promise.all([
    ctx.supabase.from('scheduling_settings').select(SETTINGS_COLUMNS).eq('org_id', ctx.org.id).maybeSingle(),
    loadGoogleCalendarStatus(ctx),
  ])

  let available = true
  if (settingsResult.error) {
    if (!isMissingRelation(settingsResult.error)) {
      console.error('[scheduling] settings lookup failed', settingsResult.error.code, settingsResult.error.message)
      throw new ApiError(500, 'load_failed', 'We couldn’t load your booking settings. Please try again.')
    }
    available = false
  }

  const canListCalendars = available && google.connected && googleConfigured && entitlements.googleIntegrations
  let calendarList: { calendars: CalendarOption[] | null; error: string | null } = { calendars: null, error: null }
  if (canListCalendars) {
    const allowed = await rateLimit(CALENDAR_LIST_LIMIT, ctx.org.id)
    calendarList = allowed.ok
      ? await listWritableCalendars(ctx.org.id)
      : { calendars: null, error: 'Your calendar list couldn’t be refreshed just now. Your saved calendar keeps working.' }
  }

  return noStore(
    NextResponse.json({
      settings: withSchedulingDefaults(settingsResult.data as Record<string, unknown> | null),
      saved: Boolean(settingsResult.data),
      available,
      entitled: entitlements.googleIntegrations,
      required_plan: requiredPlanFor('googleIntegrations'),
      google: { configured: googleConfigured, connected: google.connected, account_email: google.account_email },
      calendars: calendarList.calendars,
      calendars_error: calendarList.error,
      sms: {
        entitled: entitlements.smsConfirmations,
        required_plan: requiredPlanFor('smsConfirmations'),
        org_enabled: ctx.org.sms_enabled,
      },
      timezone: ctx.org.timezone,
    })
  )
})

export const PUT = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  if (!entitlementsFor(ctx.org.plan).googleIntegrations) {
    throw new ApiError(403, 'upgrade_required', 'Booking into Google Calendar is part of a higher plan.')
  }
  const input = await parseJson(req, schedulingSettingsInputSchema)

  // scheduling_settings allows owners to insert and update their own row (RLS).
  const { data, error } = await ctx.supabase
    .from('scheduling_settings')
    .upsert({ org_id: ctx.org.id, ...input }, { onConflict: 'org_id' })
    .select(SETTINGS_COLUMNS)
    .single()

  if (error) {
    if (isMissingRelation(error)) {
      console.error('[scheduling] scheduling_settings is missing (migration 010 not applied)')
      throw new ApiError(503, 'not_configured', 'Booking settings aren’t available yet. Please try again later.')
    }
    console.error('[scheduling] settings save failed', error.code, error.message)
    throw new ApiError(500, 'save_failed', 'We couldn’t save your booking settings. Please try again.')
  }

  // Services and booking rules are part of the agent's instructions.
  await resyncOrgAgentAfterResponse(ctx, 'booking settings change')
  return noStore(NextResponse.json({ settings: withSchedulingDefaults(data as Record<string, unknown>), saved: true }))
})
