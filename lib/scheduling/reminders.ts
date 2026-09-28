import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseAdminConfigured } from '@/lib/env'
import { isE164 } from '@/lib/phone/e164'
import { sendSms } from '@/lib/twilio/sms'
import { bookingReminderSms } from '@/lib/sms/templates'
import { normalizeSchedulingSettings } from '@/lib/scheduling/settings'
import { selectDueReminders, type ReminderCandidate, type ReminderRules } from '@/lib/scheduling/reminder-window'
import { safeTimeZone } from '@/lib/scheduling/time'
import type { BookingStatus } from '@/types'

// Daily reminder texts for upcoming bookings (called by /api/cron/daily).
// Each booking is claimed (reminder_sent_at set) before its text goes out, so
// overlapping runs can't text twice; a text that fails releases the claim, so
// the dashboard never shows a reminder that wasn't delivered.

/** Longest reminder lead (MAX_REMINDER_HOURS) plus half the daily window. */
const LOOKAHEAD_MS = (168 + 12) * 3_600_000
const MAX_BOOKINGS_PER_RUN = 1000
const CONCURRENCY = 4

interface ReminderBooking extends ReminderCandidate {
  id: string
  agent_id: string | null
  service: string | null
  timezone: string
  status: BookingStatus
}

export async function runBookingReminders(now: Date = new Date()): Promise<{ sent: number }> {
  if (!isSupabaseAdminConfigured()) {
    console.warn('[scheduling] reminders skipped: Supabase service role is not configured')
    return { sent: 0 }
  }
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('bookings')
    .select('id, org_id, agent_id, caller_phone, service, starts_at, timezone, status, reminder_sent_at, confirmation_sent_at, created_at')
    .in('status', ['booked', 'rescheduled'])
    .is('reminder_sent_at', null)
    .not('caller_phone', 'is', null)
    .gt('starts_at', now.toISOString())
    .lt('starts_at', new Date(now.getTime() + LOOKAHEAD_MS).toISOString())
    .order('starts_at', { ascending: true })
    .limit(MAX_BOOKINGS_PER_RUN)
  if (error) {
    console.error('[scheduling] reminder lookup failed', error.code, error.message)
    throw new Error('Reminder lookup failed')
  }
  const bookings = (data ?? []) as ReminderBooking[]
  if (bookings.length === 0) return { sent: 0 }

  const orgIds = [...new Set(bookings.map((b) => b.org_id))]
  const [settingsRows, orgRows, agentRows] = await Promise.all([
    admin.from('scheduling_settings').select('org_id, send_reminders, reminder_hours_before').in('org_id', orgIds),
    admin.from('organizations').select('id, name, timezone, sms_enabled').in('id', orgIds),
    admin.from('agents').select('id, org_id, language, created_at').in('org_id', orgIds).order('created_at', { ascending: false }),
  ])
  for (const result of [settingsRows, orgRows, agentRows]) {
    if (result.error) {
      console.error('[scheduling] reminder context lookup failed', result.error.code, result.error.message)
      throw new Error('Reminder context lookup failed')
    }
  }

  const rules = new Map<string, ReminderRules>()
  for (const row of settingsRows.data ?? []) {
    const normalized = normalizeSchedulingSettings(row.org_id as string, row as Record<string, unknown>)
    rules.set(row.org_id as string, { send_reminders: normalized.send_reminders, reminder_hours_before: normalized.reminder_hours_before })
  }
  const orgs = new Map((orgRows.data ?? []).map((org) => [org.id as string, org]))
  const agentLanguage = new Map<string, string>()
  const orgLanguage = new Map<string, string>()
  for (const agent of agentRows.data ?? []) {
    agentLanguage.set(agent.id as string, agent.language as string)
    // Rows are newest first: the first agent seen is the org's current one.
    if (!orgLanguage.has(agent.org_id as string)) orgLanguage.set(agent.org_id as string, agent.language as string)
  }

  const defaults = normalizeSchedulingSettings('', null)
  const due = selectDueReminders(
    bookings.filter((b) => orgs.get(b.org_id)?.sms_enabled !== false && !!b.caller_phone && isE164(b.caller_phone)),
    (orgId) => rules.get(orgId) ?? { send_reminders: defaults.send_reminders, reminder_hours_before: defaults.reminder_hours_before },
    now
  )

  const remind = async (booking: ReminderBooking): Promise<boolean> => {
    const claimedAt = new Date().toISOString()
    const claim = await admin
      .from('bookings')
      .update({ reminder_sent_at: claimedAt })
      .eq('id', booking.id)
      .eq('org_id', booking.org_id)
      .is('reminder_sent_at', null)
      .select('id')
    if (claim.error || !claim.data?.length) {
      if (claim.error) console.error('[scheduling] reminder claim failed', claim.error.code, claim.error.message)
      return false
    }

    const org = orgs.get(booking.org_id)
    const language = (booking.agent_id && agentLanguage.get(booking.agent_id)) || orgLanguage.get(booking.org_id) || 'en'
    try {
      const result = await sendSms({
        orgId: booking.org_id,
        to: booking.caller_phone as string,
        body: bookingReminderSms({
          language,
          businessName: (org?.name as string | null | undefined) ?? null,
          startsAt: booking.starts_at,
          timezone: safeTimeZone(booking.timezone || (org?.timezone as string | undefined)),
          service: booking.service,
        }),
        kind: 'reminder',
        bookingId: booking.id,
      })
      if (result.ok) return true
      console.warn('[scheduling] reminder not sent', { orgId: booking.org_id, reason: result.reason })
    } catch (sendError) {
      console.error('[scheduling] reminder failed', sendError instanceof Error ? sendError.message : sendError)
    }

    const release = await admin
      .from('bookings')
      .update({ reminder_sent_at: null })
      .eq('id', booking.id)
      .eq('org_id', booking.org_id)
      .eq('reminder_sent_at', claimedAt)
    if (release.error) console.error('[scheduling] releasing a reminder claim failed', release.error.code, release.error.message)
    return false
  }

  let sent = 0
  const queue = [...due]
  const worker = async () => {
    for (let booking = queue.shift(); booking; booking = queue.shift()) {
      if (await remind(booking)) sent += 1
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
  return { sent }
}
