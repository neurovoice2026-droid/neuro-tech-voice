// Booking rules for one agent, from its booking settings (agents.booking_settings)
// and its opening hours (agents.working_hours). An agent without opening hours
// still gets sensible bookable hours. Pure.
//
// Ported from commit e7c7974 (lib/scheduling/settings.ts): the business-hours
// normalization is unchanged; the rules now come from the agent's settings
// instead of the per-org scheduling_settings table of that branch.

import type { BookingSettings } from '@/lib/voice-providers/types'
import type { WorkingHours } from '@/lib/voice-providers/working-hours'
import { parseClock, WEEKDAYS } from '@/lib/scheduling/time'
import type { SlotRules } from '@/lib/scheduling/slots'

export const DEFAULT_BUSINESS_HOURS: WorkingHours = {
  monday: { start: '09:00', end: '18:00', enabled: true },
  tuesday: { start: '09:00', end: '18:00', enabled: true },
  wednesday: { start: '09:00', end: '18:00', enabled: true },
  thursday: { start: '09:00', end: '18:00', enabled: true },
  friday: { start: '09:00', end: '18:00', enabled: true },
  saturday: { start: '09:00', end: '18:00', enabled: false },
  sunday: { start: '09:00', end: '18:00', enabled: false },
}

/**
 * Every weekday present with valid HH:MM times; bad days fall back to
 * `fallback`. A window that runs past midnight is not bookable (closed).
 */
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
      out[day] = { ...(fallback[day] ?? DEFAULT_BUSINESS_HOURS[day]!) }
    }
  }
  return out
}

/**
 * The agent's opening hours (Availability tab); the defaults only when no
 * weekday was ever set. Days the owner closed stay closed for bookings.
 */
export function bookableHours(workingHours: unknown): WorkingHours {
  const configured = !!workingHours && typeof workingHours === 'object' && WEEKDAYS.some((d) => (workingHours as Record<string, unknown>)[d])
  return configured ? normalizeBusinessHours(workingHours) : { ...DEFAULT_BUSINESS_HOURS }
}

/** Slot rules for generateSlots: appointments start every `duration` minutes from opening time. */
export function slotRulesFor(booking: BookingSettings, workingHours: unknown): SlotRules {
  return {
    slot_minutes: booking.duration_minutes,
    buffer_minutes: booking.buffer_minutes,
    min_notice_minutes: booking.min_notice_hours * 60,
    max_days_ahead: booking.booking_window_days,
    business_hours: bookableHours(workingHours),
  }
}
