import { describe, expect, it } from 'vitest'
import { DEFAULT_BUSINESS_HOURS, bookableHours, normalizeBusinessHours, slotRulesFor } from './settings'
import { DEFAULT_BOOKING_SETTINGS } from '@/lib/voice-providers/types'

describe('booking rules from the agent settings', () => {
  it('uses the agent opening hours; defaults only when no weekday was ever set', () => {
    expect(bookableHours(null)).toEqual(DEFAULT_BUSINESS_HOURS)
    expect(bookableHours({})).toEqual(DEFAULT_BUSINESS_HOURS)
    const hours = bookableHours({ monday: { start: '10:00', end: '14:00', enabled: true }, tuesday: { start: '09:00', end: '17:00', enabled: false } })
    expect(hours.monday).toEqual({ start: '10:00', end: '14:00', enabled: true })
    expect(hours.tuesday?.enabled).toBe(false)
  })

  it('a day the owner closed stays closed, and an overnight window is not bookable', () => {
    const allClosed = Object.fromEntries(Object.keys(DEFAULT_BUSINESS_HOURS).map((d) => [d, { start: '09:00', end: '17:00', enabled: false }]))
    expect(Object.values(bookableHours(allClosed)).every((d) => !d?.enabled)).toBe(true)
    expect(normalizeBusinessHours({ friday: { start: '22:00', end: '06:00', enabled: true } }).friday?.enabled).toBe(false)
  })

  it('maps the settings to slot rules', () => {
    const rules = slotRulesFor({ ...DEFAULT_BOOKING_SETTINGS, duration_minutes: 45, buffer_minutes: 15, min_notice_hours: 3, booking_window_days: 14 }, null)
    expect(rules).toMatchObject({ slot_minutes: 45, buffer_minutes: 15, min_notice_minutes: 180, max_days_ahead: 14 })
  })
})
