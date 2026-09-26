// Weekly opening hours and service limits: the plain helpers the dashboard
// editors run in the browser. Kept free of zod so the agent page doesn't ship
// the validation library; ./schema re-exports everything here and adds the
// zod schemas the API uses.

import type { WorkingHourSlot, WorkingHours } from '@/types'

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

// 24-hour HH:MM, the format <input type="time"> produces and the voice
// pipeline (summarizeWorkingHours, slot generation) reads.
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function slot(start: string, end: string, enabled: boolean): WorkingHourSlot {
  return { start, end, enabled }
}

/** Monday to Friday 09:00-18:00, the same default as the database column. */
export const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: slot('09:00', '18:00', true),
  tuesday: slot('09:00', '18:00', true),
  wednesday: slot('09:00', '18:00', true),
  thursday: slot('09:00', '18:00', true),
  friday: slot('09:00', '18:00', true),
  saturday: slot('09:00', '18:00', false),
  sunday: slot('09:00', '18:00', false),
}

// 23:59 rather than 24:00: every consumer validates HH:MM in 00:00-23:59.
export const ALWAYS_OPEN_HOURS: WorkingHours = Object.fromEntries(
  WEEKDAYS.map((day) => [day, slot('00:00', '23:59', true)])
) as WorkingHours

export function isAlwaysOpen(hours: WorkingHours): boolean {
  return WEEKDAYS.every((day) => {
    const s = hours[day]
    return Boolean(s?.enabled && s.start === '00:00' && s.end === '23:59')
  })
}

export type WorkingHoursErrors = Partial<Record<Weekday, string>>

/** Per-day problems in plain words; an empty object means the hours are valid. */
export function validateWorkingHours(hours: unknown): WorkingHoursErrors {
  const errors: WorkingHoursErrors = {}
  const record = hours && typeof hours === 'object' ? (hours as Record<string, unknown>) : {}
  for (const day of WEEKDAYS) {
    const value = record[day]
    if (!value || typeof value !== 'object') {
      errors[day] = 'Opening hours are missing for this day.'
      continue
    }
    const { start, end, enabled } = value as Partial<WorkingHourSlot>
    if (typeof enabled !== 'boolean') {
      errors[day] = 'Choose whether you are open on this day.'
      continue
    }
    if (typeof start !== 'string' || !TIME_PATTERN.test(start) || typeof end !== 'string' || !TIME_PATTERN.test(end)) {
      errors[day] = 'Use times like 09:00 and 18:00.'
      continue
    }
    // Closed days keep their times so switching them back on restores them.
    if (enabled && minutesOfDay(end) <= minutesOfDay(start)) {
      errors[day] = 'Closing time must be after opening time.'
    }
  }
  return errors
}

/** Fills missing or malformed days from the defaults (rows written before the editor existed). */
export function normalizeWorkingHours(value: unknown): WorkingHours {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const out = {} as WorkingHours
  for (const day of WEEKDAYS) {
    const raw = record[day] as Partial<WorkingHourSlot> | undefined
    const fallback = DEFAULT_WORKING_HOURS[day]
    out[day] = {
      start: typeof raw?.start === 'string' && TIME_PATTERN.test(raw.start) ? raw.start : fallback.start,
      end: typeof raw?.end === 'string' && TIME_PATTERN.test(raw.end) ? raw.end : fallback.end,
      enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : fallback.enabled,
    }
  }
  return out
}

export const MAX_SERVICES = 30
export const SERVICE_DURATION_MIN = 5
export const SERVICE_DURATION_MAX = 480
