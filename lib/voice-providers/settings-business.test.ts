import { describe, expect, it } from 'vitest'
import { BookingSettingsSchema, MessageSettingsSchema, readBookingSettings, readMessageSettings } from './settings'
import { DEFAULT_BOOKING_SETTINGS, DEFAULT_MESSAGE_SETTINGS } from './types'

describe('booking settings', () => {
  it('validates ranges and the calendar id', () => {
    expect(BookingSettingsSchema.safeParse(DEFAULT_BOOKING_SETTINGS).success).toBe(true)
    for (const bad of [
      { duration_minutes: 4 },
      { duration_minutes: 241 },
      { buffer_minutes: -1 },
      { booking_window_days: 0 },
      { min_notice_hours: 169 },
      { daily_cap: 0 },
      { calendar_id: '' },
      { calendar_id: 'a b' },
      { calendar_id: '<script>' },
    ]) {
      expect(BookingSettingsSchema.safeParse({ ...DEFAULT_BOOKING_SETTINGS, ...bad }).success, JSON.stringify(bad)).toBe(false)
    }
    expect(BookingSettingsSchema.safeParse({ ...DEFAULT_BOOKING_SETTINGS, calendar_id: 'team@group.calendar.google.com', daily_cap: 12 }).success).toBe(true)
  })

  it('stored values are read leniently: invalid fields fall back, valid ones are kept', () => {
    expect(readBookingSettings(null)).toEqual(DEFAULT_BOOKING_SETTINGS)
    expect(readBookingSettings({ enabled: true, duration_minutes: 9999, buffer_minutes: 15 })).toEqual({ ...DEFAULT_BOOKING_SETTINGS, enabled: true, buffer_minutes: 15 })
  })
})

describe('message settings', () => {
  it('normalizes recipients and caps them at five distinct valid addresses', () => {
    const ok = MessageSettingsSchema.safeParse({ ...DEFAULT_MESSAGE_SETTINGS, extra_recipients: [' Desk@Clinic.Example '] })
    expect(ok.success && ok.data.extra_recipients).toEqual(['desk@clinic.example'])
    expect(MessageSettingsSchema.safeParse({ ...DEFAULT_MESSAGE_SETTINGS, extra_recipients: ['a@b.example', 'A@B.example'] }).success).toBe(false)
    expect(MessageSettingsSchema.safeParse({ ...DEFAULT_MESSAGE_SETTINGS, extra_recipients: ['x', 'y'] }).success).toBe(false)
    const six = Array.from({ length: 6 }, (_, i) => `p${i}@example.test`)
    expect(MessageSettingsSchema.safeParse({ ...DEFAULT_MESSAGE_SETTINGS, extra_recipients: six }).success).toBe(false)
    expect(MessageSettingsSchema.safeParse({ ...DEFAULT_MESSAGE_SETTINGS, email_notifications: 'sometimes' }).success).toBe(false)
  })

  it('a stored list that is no longer valid falls back to none (never sends to unvalidated addresses)', () => {
    expect(readMessageSettings({ enabled: true, extra_recipients: ['not-an-address'] })).toEqual({ ...DEFAULT_MESSAGE_SETTINGS, enabled: true })
    expect(readMessageSettings(undefined)).toEqual(DEFAULT_MESSAGE_SETTINGS)
  })
})
