// Validation for weekly hours and booking settings. Shared by the scheduling
// API and the dashboard editors (agent working hours, booking hours), so the
// browser shows exactly the errors the server would return. Client-safe: zod
// and types only.

import '@/lib/zod-setup'
import { z } from 'zod'
import type { ServiceOffering, WorkingHours } from '@/types'
import { DEFAULT_WORKING_HOURS, MAX_SERVICES, SERVICE_DURATION_MAX, SERVICE_DURATION_MIN, TIME_PATTERN, WEEKDAYS, minutesOfDay, normalizeWorkingHours } from './hours'

// The browser-side helpers live in ./hours (no zod); the API imports them from here.
export * from './hours'

export const workingHourSlotSchema = z.object({
  start: z.string().regex(TIME_PATTERN, 'Use a time like 09:00'),
  end: z.string().regex(TIME_PATTERN, 'Use a time like 18:00'),
  enabled: z.boolean(),
})

export const workingHoursSchema = z
  .object({
    monday: workingHourSlotSchema,
    tuesday: workingHourSlotSchema,
    wednesday: workingHourSlotSchema,
    thursday: workingHourSlotSchema,
    friday: workingHourSlotSchema,
    saturday: workingHourSlotSchema,
    sunday: workingHourSlotSchema,
  })
  .superRefine((hours, ctx) => {
    for (const day of WEEKDAYS) {
      const s = hours[day]
      if (s.enabled && minutesOfDay(s.end) <= minutesOfDay(s.start)) {
        ctx.addIssue({ code: 'custom', path: [day, 'end'], message: 'Closing time must be after opening time' })
      }
    }
  })

// ─── Services and booking settings ────────────────────────────────────────────

export const serviceSchema = z.object({
  name: z.string().trim().min(1, 'Give the service a name').max(80, 'Keep the name under 80 characters'),
  duration_minutes: z
    .number()
    .int('Use whole minutes')
    .min(SERVICE_DURATION_MIN, `At least ${SERVICE_DURATION_MIN} minutes`)
    .max(SERVICE_DURATION_MAX, 'At most 8 hours'),
})

export const servicesSchema = z
  .array(serviceSchema)
  .max(MAX_SERVICES, `You can list up to ${MAX_SERVICES} services`)
  .superRefine((services, ctx) => {
    const seen = new Set<string>()
    services.forEach((service, index) => {
      const key = service.name.trim().toLowerCase()
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: [index, 'name'], message: 'Each service needs a different name' })
      }
      seen.add(key)
    })
  })

export const schedulingSettingsInputSchema = z.object({
  calendar_id: z.string().trim().min(1).max(254),
  slot_minutes: z.number().int().min(5).max(240),
  buffer_minutes: z.number().int().min(0).max(240),
  min_notice_minutes: z.number().int().min(0).max(14 * 24 * 60),
  max_days_ahead: z.number().int().min(1).max(365),
  business_hours: workingHoursSchema,
  services: servicesSchema,
  send_sms_confirmation: z.boolean(),
  send_reminders: z.boolean(),
  reminder_hours_before: z.number().int().min(1).max(168),
})

// business_hours is widened to the shared WorkingHours type the agent editor also uses.
export type SchedulingSettingsInput = Omit<z.infer<typeof schedulingSettingsInputSchema>, 'business_hours'> & {
  business_hours: WorkingHours
}

/** Same defaults as the scheduling_settings table. */
export const DEFAULT_SCHEDULING_SETTINGS: SchedulingSettingsInput = {
  calendar_id: 'primary',
  slot_minutes: 30,
  buffer_minutes: 0,
  min_notice_minutes: 60,
  max_days_ahead: 30,
  business_hours: DEFAULT_WORKING_HOURS,
  services: [],
  send_sms_confirmation: true,
  send_reminders: true,
  reminder_hours_before: 24,
}

function intOr(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

function normalizeServices(value: unknown): ServiceOffering[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((s): s is ServiceOffering => Boolean(s) && typeof s === 'object' && typeof (s as ServiceOffering).name === 'string')
    .map((s) => ({
      name: s.name.trim().slice(0, 80),
      duration_minutes: intOr(s.duration_minutes, 30, SERVICE_DURATION_MIN, SERVICE_DURATION_MAX),
    }))
    .filter((s) => s.name.length > 0)
    .slice(0, MAX_SERVICES)
}

/** A stored row (or nothing yet) → a complete, valid settings object. */
export function withSchedulingDefaults(row: Record<string, unknown> | null | undefined): SchedulingSettingsInput {
  const d = DEFAULT_SCHEDULING_SETTINGS
  if (!row) return { ...d, business_hours: { ...d.business_hours }, services: [] }
  return {
    calendar_id: typeof row.calendar_id === 'string' && row.calendar_id.trim() ? row.calendar_id : d.calendar_id,
    slot_minutes: intOr(row.slot_minutes, d.slot_minutes, 5, 240),
    buffer_minutes: intOr(row.buffer_minutes, d.buffer_minutes, 0, 240),
    min_notice_minutes: intOr(row.min_notice_minutes, d.min_notice_minutes, 0, 14 * 24 * 60),
    max_days_ahead: intOr(row.max_days_ahead, d.max_days_ahead, 1, 365),
    business_hours: normalizeWorkingHours(row.business_hours),
    services: normalizeServices(row.services),
    send_sms_confirmation: typeof row.send_sms_confirmation === 'boolean' ? row.send_sms_confirmation : d.send_sms_confirmation,
    send_reminders: typeof row.send_reminders === 'boolean' ? row.send_reminders : d.send_reminders,
    reminder_hours_before: intOr(row.reminder_hours_before, d.reminder_hours_before, 1, 168),
  }
}
