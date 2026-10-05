import { describe, expect, it } from 'vitest'
import { evaluateWorkingHours, type WorkingHours } from './working-hours'

const weekdays: WorkingHours = {
  monday: { start: '09:00', end: '18:00', enabled: true },
  tuesday: { start: '09:00', end: '18:00', enabled: true },
  wednesday: { start: '09:00', end: '18:00', enabled: true },
  thursday: { start: '09:00', end: '18:00', enabled: true },
  friday: { start: '09:00', end: '18:00', enabled: true },
  saturday: { start: '09:00', end: '18:00', enabled: false },
  sunday: { start: '09:00', end: '18:00', enabled: false },
}
const ON = { enabled: true }

describe('evaluateWorkingHours', () => {
  it('is always open when the after-hours gate is disabled (opt-in, no behaviour change)', () => {
    const v = evaluateWorkingHours(weekdays, 'Europe/Bucharest', { enabled: false }, new Date('2026-10-04T23:00:00Z'))
    expect(v).toMatchObject({ open: true, reason: 'schedule_disabled' })
  })

  it('uses the organization time zone, not UTC', () => {
    // Monday 2026-10-05 06:30 UTC = 09:30 in Bucharest (UTC+3, summer time).
    const open = evaluateWorkingHours(weekdays, 'Europe/Bucharest', ON, new Date('2026-10-05T06:30:00Z'))
    expect(open).toMatchObject({ open: true, localWeekday: 'monday', localTime: '09:30' })
    // Same instant is 06:30 in UTC → closed there.
    const closed = evaluateWorkingHours(weekdays, 'UTC', ON, new Date('2026-10-05T06:30:00Z'))
    expect(closed).toMatchObject({ open: false, reason: 'outside_window' })
  })

  it('handles the DST change (Bucharest switches to UTC+2 on 2026-10-25)', () => {
    // Monday 2026-10-26 07:30 UTC = 09:30 local (UTC+2).
    const v = evaluateWorkingHours(weekdays, 'Europe/Bucharest', ON, new Date('2026-10-26T07:30:00Z'))
    expect(v).toMatchObject({ open: true, localTime: '09:30' })
  })

  it('treats the end time as exclusive and closed days as closed', () => {
    expect(evaluateWorkingHours(weekdays, 'UTC', ON, new Date('2026-10-05T18:00:00Z')).open).toBe(false)
    expect(evaluateWorkingHours(weekdays, 'UTC', ON, new Date('2026-10-05T17:59:00Z')).open).toBe(true)
    expect(evaluateWorkingHours(weekdays, 'UTC', ON, new Date('2026-10-04T12:00:00Z'))).toMatchObject({ open: false, reason: 'day_closed' })
  })

  it('supports overnight windows across midnight', () => {
    const night: WorkingHours = { friday: { start: '22:00', end: '06:00', enabled: true } }
    expect(evaluateWorkingHours(night, 'UTC', ON, new Date('2026-10-09T23:30:00Z')).open).toBe(true) // Fri 23:30
    expect(evaluateWorkingHours(night, 'UTC', ON, new Date('2026-10-10T05:59:00Z')).open).toBe(true) // Sat 05:59
    expect(evaluateWorkingHours(night, 'UTC', ON, new Date('2026-10-10T06:00:00Z')).open).toBe(false)
  })

  it('treats start === end as open 24h and accepts 24:00', () => {
    const allDay: WorkingHours = { monday: { start: '00:00', end: '00:00', enabled: true } }
    expect(evaluateWorkingHours(allDay, 'UTC', ON, new Date('2026-10-05T03:00:00Z')).open).toBe(true)
    const toMidnight: WorkingHours = { monday: { start: '12:00', end: '24:00', enabled: true } }
    expect(evaluateWorkingHours(toMidnight, 'UTC', ON, new Date('2026-10-05T23:59:00Z')).open).toBe(true)
  })

  it('falls back to UTC for an invalid zone instead of throwing', () => {
    const v = evaluateWorkingHours(weekdays, 'Mars/Olympus', ON, new Date('2026-10-05T10:00:00Z'))
    expect(v.timeZone).toBe('UTC')
    expect(v.open).toBe(true)
  })

  it('treats an empty schedule as open and an all-closed schedule as closed', () => {
    expect(evaluateWorkingHours({}, 'UTC', ON, new Date('2026-10-05T10:00:00Z')).reason).toBe('no_schedule')
    const allClosed: WorkingHours = { monday: { start: '09:00', end: '17:00', enabled: false } }
    expect(evaluateWorkingHours(allClosed, 'UTC', ON, new Date('2026-10-05T10:00:00Z')).open).toBe(false)
  })
})
