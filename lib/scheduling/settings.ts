import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SchedulingSettings, ServiceOffering, WorkingHours } from '@/types'
import { parseClock, WEEKDAYS } from '@/lib/scheduling/time'

// Booking rules per organisation (scheduling_settings). An org that never
// opened the booking settings still gets sensible rules: the migration's
// defaults, with the agent's working hours as business hours when known.

export const DEFAULT_BUSINESS_HOURS: WorkingHours = {
  monday: { start: '09:00', end: '18:00', enabled: true },
  tuesday: { start: '09:00', end: '18:00', enabled: true },
  wednesday: { start: '09:00', end: '18:00', enabled: true },
  thursday: { start: '09:00', end: '18:00', enabled: true },
  friday: { start: '09:00', end: '18:00', enabled: true },
  saturday: { start: '09:00', end: '18:00', enabled: false },
  sunday: { start: '09:00', end: '18:00', enabled: false },
}

export const DEFAULT_SCHEDULING_SETTINGS: Omit<SchedulingSettings, 'org_id' | 'updated_at'> = {
  calendar_id: 'primary',
  slot_minutes: 30,
  buffer_minutes: 0,
  min_notice_minutes: 60,
  max_days_ahead: 30,
  business_hours: DEFAULT_BUSINESS_HOURS,
  services: [],
  send_sms_confirmation: true,
  send_reminders: true,
  reminder_hours_before: 24,
}

export const MAX_SERVICES = 30
/** Reminders are sent by a daily job, so more than a week ahead isn't useful. */
export const MAX_REMINDER_HOURS = 168

const SETTINGS_COLUMNS =
  'org_id, calendar_id, slot_minutes, buffer_minutes, min_notice_minutes, max_days_ahead, business_hours, services, send_sms_confirmation, send_reminders, reminder_hours_before, updated_at'

function intIn(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Every weekday present with valid HH:MM times; bad days fall back to `fallback`. */
export function normalizeBusinessHours(value: unknown, fallback: WorkingHours = DEFAULT_BUSINESS_HOURS): WorkingHours {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const out: WorkingHours = {}
  for (const day of WEEKDAYS) {
    const raw = source[day]
    const slot = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
    const start = typeof slot?.start === 'string' ? slot.start.trim() : ''
    const end = typeof slot?.end === 'string' ? slot.end.trim() : ''
    const startMin = parseClock(start)
    const endMin = parseClock(end)
    if (slot && startMin !== null && endMin !== null && typeof slot.enabled === 'boolean') {
      out[day] = { start, end, enabled: slot.enabled && endMin > startMin }
    } else {
      out[day] = { ...(fallback[day] ?? DEFAULT_BUSINESS_HOURS[day]) }
    }
  }
  return out
}

export function normalizeServices(value: unknown): ServiceOffering[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: ServiceOffering[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push({ name, duration_minutes: intIn(record.duration_minutes, 5, 480, 30) })
    if (out.length >= MAX_SERVICES) break
  }
  return out
}

/** A stored row (or nothing) → complete, valid settings. */
export function normalizeSchedulingSettings(
  orgId: string,
  row: Record<string, unknown> | null | undefined,
  opts: { fallbackHours?: WorkingHours | null } = {}
): SchedulingSettings {
  const defaults = DEFAULT_SCHEDULING_SETTINGS
  const fallbackHours = opts.fallbackHours ? normalizeBusinessHours(opts.fallbackHours) : defaults.business_hours
  const calendarId = typeof row?.calendar_id === 'string' ? row.calendar_id.trim() : ''
  return {
    org_id: orgId,
    calendar_id: calendarId && calendarId.length <= 255 ? calendarId : defaults.calendar_id,
    slot_minutes: intIn(row?.slot_minutes, 5, 240, defaults.slot_minutes),
    buffer_minutes: intIn(row?.buffer_minutes, 0, 240, defaults.buffer_minutes),
    min_notice_minutes: intIn(row?.min_notice_minutes, 0, 30 * 24 * 60, defaults.min_notice_minutes),
    max_days_ahead: intIn(row?.max_days_ahead, 0, 365, defaults.max_days_ahead),
    business_hours: row ? normalizeBusinessHours(row.business_hours, fallbackHours) : fallbackHours,
    services: normalizeServices(row?.services),
    send_sms_confirmation: bool(row?.send_sms_confirmation, defaults.send_sms_confirmation),
    send_reminders: bool(row?.send_reminders, defaults.send_reminders),
    reminder_hours_before: intIn(row?.reminder_hours_before, 0, MAX_REMINDER_HOURS, defaults.reminder_hours_before),
    updated_at: typeof row?.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  }
}

export interface LoadedSchedulingSettings {
  settings: SchedulingSettings
  /** false when the org has no scheduling_settings row yet (defaults in use). */
  exists: boolean
}

/**
 * Settings for an org through the service-role client (voice tools, cron) or
 * a session client (dashboard; RLS scopes it). Missing table (migration 010
 * not applied) reads as "no row" so the caller still gets defaults.
 */
export async function loadSchedulingSettings(
  orgId: string,
  opts: { client?: SupabaseClient; fallbackHours?: WorkingHours | null; signal?: AbortSignal } = {}
): Promise<LoadedSchedulingSettings> {
  const client = opts.client ?? createAdminClient()
  let query = client.from('scheduling_settings').select(SETTINGS_COLUMNS).eq('org_id', orgId)
  if (opts.signal) query = query.abortSignal(opts.signal)
  const { data, error } = await query.maybeSingle()
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return { settings: normalizeSchedulingSettings(orgId, null, opts), exists: false }
    }
    console.error('[scheduling] settings lookup failed', error.code, error.message)
    throw new Error('Scheduling settings lookup failed')
  }
  return {
    settings: normalizeSchedulingSettings(orgId, (data as Record<string, unknown> | null) ?? null, opts),
    exists: !!data,
  }
}
