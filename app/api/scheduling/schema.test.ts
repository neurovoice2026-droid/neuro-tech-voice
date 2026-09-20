import { describe, expect, it } from 'vitest'
import {
  ALWAYS_OPEN_HOURS,
  DEFAULT_SCHEDULING_SETTINGS,
  DEFAULT_WORKING_HOURS,
  WEEKDAYS,
  isAlwaysOpen,
  normalizeWorkingHours,
  schedulingSettingsInputSchema,
  servicesSchema,
  validateWorkingHours,
  withSchedulingDefaults,
  workingHoursSchema,
} from './schema'
import type { WorkingHours } from '@/types'

function hours(overrides: Partial<WorkingHours> = {}): WorkingHours {
  return { ...structuredClone(DEFAULT_WORKING_HOURS), ...overrides } as WorkingHours
}

describe('validateWorkingHours', () => {
  it('accepts the defaults and the 24/7 preset', () => {
    expect(validateWorkingHours(DEFAULT_WORKING_HOURS)).toEqual({})
    expect(validateWorkingHours(ALWAYS_OPEN_HOURS)).toEqual({})
  })

  it('rejects a closing time that is not after the opening time', () => {
    expect(validateWorkingHours(hours({ monday: { start: '18:00', end: '09:00', enabled: true } }))).toEqual({
      monday: 'Closing time must be after opening time.',
    })
    expect(validateWorkingHours(hours({ friday: { start: '10:00', end: '10:00', enabled: true } }))).toHaveProperty('friday')
  })

  it('ignores the order of times on closed days so they can be switched back on later', () => {
    expect(validateWorkingHours(hours({ sunday: { start: '18:00', end: '09:00', enabled: false } }))).toEqual({})
  })

  it('rejects malformed times, including 24:00', () => {
    expect(validateWorkingHours(hours({ tuesday: { start: '9:00', end: '18:00', enabled: true } }))).toHaveProperty('tuesday')
    expect(validateWorkingHours(hours({ tuesday: { start: '09:00', end: '24:00', enabled: true } }))).toHaveProperty('tuesday')
    expect(validateWorkingHours(hours({ tuesday: { start: '09:60', end: '18:00', enabled: true } }))).toHaveProperty('tuesday')
  })

  it('reports every missing day and non-object input', () => {
    const errors = validateWorkingHours({ monday: DEFAULT_WORKING_HOURS.monday })
    expect(Object.keys(errors).sort()).toEqual(WEEKDAYS.filter((d) => d !== 'monday').sort())
    expect(Object.keys(validateWorkingHours(null))).toHaveLength(7)
  })

  it('agrees with the zod schema the API uses', () => {
    const bad = hours({ wednesday: { start: '12:00', end: '11:59', enabled: true } })
    const result = workingHoursSchema.safeParse(bad)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['wednesday', 'end'])
    expect(workingHoursSchema.safeParse(ALWAYS_OPEN_HOURS).success).toBe(true)
  })
})

describe('normalizeWorkingHours / isAlwaysOpen', () => {
  it('fills missing and malformed days from the defaults', () => {
    const normalized = normalizeWorkingHours({ monday: { start: '08:00', end: 'late', enabled: true }, junk: 1 })
    expect(normalized.monday).toEqual({ start: '08:00', end: '18:00', enabled: true })
    expect(normalized.sunday).toEqual(DEFAULT_WORKING_HOURS.sunday)
    expect(Object.keys(normalized)).toEqual([...WEEKDAYS])
  })

  it('detects the 24/7 preset', () => {
    expect(isAlwaysOpen(ALWAYS_OPEN_HOURS)).toBe(true)
    expect(isAlwaysOpen(DEFAULT_WORKING_HOURS)).toBe(false)
  })
})

describe('booking settings', () => {
  it('accepts the defaults', () => {
    expect(schedulingSettingsInputSchema.safeParse(DEFAULT_SCHEDULING_SETTINGS).success).toBe(true)
  })

  it('caps services at 30 and requires distinct names and sane durations', () => {
    const many = Array.from({ length: 31 }, (_, i) => ({ name: `Service ${i}`, duration_minutes: 30 }))
    expect(servicesSchema.safeParse(many).success).toBe(false)
    expect(servicesSchema.safeParse(many.slice(0, 30)).success).toBe(true)
    expect(
      servicesSchema.safeParse([
        { name: 'Cleaning', duration_minutes: 30 },
        { name: ' cleaning ', duration_minutes: 45 },
      ]).success
    ).toBe(false)
    expect(servicesSchema.safeParse([{ name: 'Quick call', duration_minutes: 2 }]).success).toBe(false)
    expect(servicesSchema.safeParse([{ name: '', duration_minutes: 30 }]).success).toBe(false)
  })

  it('rejects invalid business hours inside the settings', () => {
    const input = {
      ...DEFAULT_SCHEDULING_SETTINGS,
      business_hours: hours({ monday: { start: '17:00', end: '08:00', enabled: true } }),
    }
    expect(schedulingSettingsInputSchema.safeParse(input).success).toBe(false)
  })

  it('turns stored rows into complete settings', () => {
    expect(withSchedulingDefaults(null)).toEqual(DEFAULT_SCHEDULING_SETTINGS)
    const settings = withSchedulingDefaults({
      calendar_id: 'team@example.com',
      slot_minutes: 1000,
      services: [{ name: ' Consultation ', duration_minutes: 45 }, { name: '' }, 'junk'],
      business_hours: null,
      send_reminders: false,
    })
    expect(settings.calendar_id).toBe('team@example.com')
    expect(settings.slot_minutes).toBe(30)
    expect(settings.services).toEqual([{ name: 'Consultation', duration_minutes: 45 }])
    expect(settings.business_hours).toEqual(DEFAULT_WORKING_HOURS)
    expect(settings.send_reminders).toBe(false)
    expect(schedulingSettingsInputSchema.safeParse(settings).success).toBe(true)
  })
})
