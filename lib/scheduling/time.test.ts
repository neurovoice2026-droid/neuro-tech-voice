import { describe, expect, it } from 'vitest'
import {
  addDays,
  formatIsoWithOffset,
  localDateOf,
  parseClock,
  parseDateTimeInZone,
  parseIsoDate,
  resolveDateArgument,
  safeTimeZone,
  weekdayOf,
  zonedWallTimeToUtc,
  zoneOffsetMinutes,
} from '@/lib/scheduling/time'

const BUCHAREST = 'Europe/Bucharest'

describe('zone offsets', () => {
  it('reads winter and summer offsets for Bucharest', () => {
    expect(zoneOffsetMinutes(Date.parse('2026-01-15T12:00:00Z'), BUCHAREST)).toBe(120)
    expect(zoneOffsetMinutes(Date.parse('2026-07-15T12:00:00Z'), BUCHAREST)).toBe(180)
  })

  it('handles zones west of UTC and half-hour zones', () => {
    expect(zoneOffsetMinutes(Date.parse('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(-300)
    expect(zoneOffsetMinutes(Date.parse('2026-01-15T12:00:00Z'), 'Asia/Kolkata')).toBe(330)
  })
})

describe('zonedWallTimeToUtc', () => {
  it('converts an ordinary wall time', () => {
    const instant = zonedWallTimeToUtc({ year: 2026, month: 3, day: 18, hour: 14, minute: 30 }, BUCHAREST)
    expect(new Date(instant as number).toISOString()).toBe('2026-03-18T12:30:00.000Z')
  })

  it('returns null inside the spring-forward gap (29 March 2026, 03:00 → 04:00 in Bucharest)', () => {
    expect(zonedWallTimeToUtc({ year: 2026, month: 3, day: 29, hour: 3, minute: 30 }, BUCHAREST)).toBeNull()
    const after = zonedWallTimeToUtc({ year: 2026, month: 3, day: 29, hour: 4, minute: 0 }, BUCHAREST)
    expect(new Date(after as number).toISOString()).toBe('2026-03-29T01:00:00.000Z')
  })

  it('picks the earlier instant for a repeated fall-back time (25 October 2026, 03:30 twice)', () => {
    const instant = zonedWallTimeToUtc({ year: 2026, month: 10, day: 25, hour: 3, minute: 30 }, BUCHAREST)
    expect(new Date(instant as number).toISOString()).toBe('2026-10-25T00:30:00.000Z')
  })
})

describe('formatting and parsing', () => {
  it('writes ISO 8601 with the local offset', () => {
    expect(formatIsoWithOffset(Date.parse('2026-03-18T12:30:00Z'), BUCHAREST)).toBe('2026-03-18T14:30:00+02:00')
    expect(formatIsoWithOffset(Date.parse('2026-07-01T16:00:00Z'), 'America/New_York')).toBe('2026-07-01T12:00:00-04:00')
  })

  it('parses offset, Z and bare local times', () => {
    expect(parseDateTimeInZone('2026-03-18T14:30:00+02:00', 'UTC')).toBe(Date.parse('2026-03-18T12:30:00Z'))
    expect(parseDateTimeInZone('2026-03-18T12:30:00Z', BUCHAREST)).toBe(Date.parse('2026-03-18T12:30:00Z'))
    expect(parseDateTimeInZone('2026-03-18T14:30', BUCHAREST)).toBe(Date.parse('2026-03-18T12:30:00Z'))
    expect(parseDateTimeInZone('2026-03-18 14:30:00+0200', 'UTC')).toBe(Date.parse('2026-03-18T12:30:00Z'))
  })

  it('rejects impossible values', () => {
    expect(parseDateTimeInZone('2026-02-30T10:00:00+02:00', BUCHAREST)).toBeNull()
    expect(parseDateTimeInZone('tomorrow at ten', BUCHAREST)).toBeNull()
    expect(parseDateTimeInZone('2026-03-29T03:30', BUCHAREST)).toBeNull()
    expect(parseIsoDate('2026-13-01')).toBeNull()
    expect(parseIsoDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 })
  })

  it('resolves today, tomorrow and timestamps in the business zone', () => {
    // 23:30 UTC on 17 September is already 18 September in Bucharest.
    const now = new Date('2026-09-17T23:30:00Z')
    expect(resolveDateArgument('today', now, BUCHAREST)).toEqual({ year: 2026, month: 9, day: 18 })
    expect(resolveDateArgument('Tomorrow', now, BUCHAREST)).toEqual({ year: 2026, month: 9, day: 19 })
    expect(resolveDateArgument('2026-09-20T09:00:00+03:00', now, BUCHAREST)).toEqual({ year: 2026, month: 9, day: 20 })
    expect(resolveDateArgument('next week', now, BUCHAREST)).toBeNull()
  })

  it('knows weekdays, clocks, day arithmetic and bad zones', () => {
    expect(weekdayOf({ year: 2026, month: 9, day: 17 })).toBe('thursday')
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 })
    expect(parseClock('09:30')).toBe(570)
    expect(parseClock('24:00')).toBe(1440)
    expect(parseClock('9:30')).toBeNull()
    expect(safeTimeZone('Mars/Olympus')).toBe('UTC')
    expect(localDateOf(Date.parse('2026-09-17T22:00:00Z'), BUCHAREST)).toEqual({ year: 2026, month: 9, day: 18 })
  })
})
