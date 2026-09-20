// Time-zone math for scheduling, built on Intl only (no date library).
//
// Everything a caller hears is wall-clock time in the organisation's zone,
// while Google Calendar, the database and comparisons work in UTC instants.
// The two conversions that matter:
// - instant → wall time: Intl.DateTimeFormat with timeZone (exact, DST-aware)
// - wall time → instant: try the zone's offsets around that moment and keep
//   the ones that format back to the same wall time. A time that falls in a
//   spring-forward gap has no instant (null); a time repeated at fall-back
//   resolves to the earlier instant, which is what a person means by "1:30".
//
// Pure and client-safe.

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export interface CalendarDate {
  year: number
  month: number
  day: number
}

export interface WallTime extends CalendarDate {
  hour: number
  minute: number
  second: number
}

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatters.set(timeZone, formatter)
  }
  return formatter
}

export function isValidTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false
  try {
    partsFormatter(timeZone)
    return true
  } catch {
    return false
  }
}

/** The zone itself when Intl knows it, otherwise UTC (a bad row must not break booking). */
export function safeTimeZone(timeZone: string | null | undefined): string {
  const trimmed = typeof timeZone === 'string' ? timeZone.trim() : ''
  return isValidTimeZone(trimmed) ? trimmed : 'UTC'
}

export function wallTimeInZone(instantMs: number, timeZone: string): WallTime {
  const out: WallTime = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 }
  for (const part of partsFormatter(timeZone).formatToParts(new Date(instantMs))) {
    switch (part.type) {
      case 'year': out.year = Number(part.value); break
      case 'month': out.month = Number(part.value); break
      case 'day': out.day = Number(part.value); break
      // Some engines still print "24" at midnight even with h23.
      case 'hour': out.hour = Number(part.value) % 24; break
      case 'minute': out.minute = Number(part.value); break
      case 'second': out.second = Number(part.value); break
    }
  }
  return out
}

/** Minutes the zone is ahead of UTC at that instant (Bucharest summer: 180). */
export function zoneOffsetMinutes(instantMs: number, timeZone: string): number {
  const wall = wallTimeInZone(instantMs, timeZone)
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
  const truncated = instantMs - (((instantMs % 1000) + 1000) % 1000)
  return Math.round((asUtc - truncated) / MINUTE_MS)
}

/**
 * UTC instant of a wall-clock time in a zone, or null when that time doesn't
 * exist there (the hour skipped when clocks go forward).
 */
export function zonedWallTimeToUtc(
  wall: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string
): number | null {
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)
  if (!Number.isFinite(wallAsUtc)) return null
  // Offsets a day either side cover any transition near this wall time.
  const offsets = new Set([
    zoneOffsetMinutes(wallAsUtc - DAY_MS, timeZone),
    zoneOffsetMinutes(wallAsUtc, timeZone),
    zoneOffsetMinutes(wallAsUtc + DAY_MS, timeZone),
  ])
  let best: number | null = null
  for (const offset of offsets) {
    const candidate = wallAsUtc - offset * MINUTE_MS
    const back = wallTimeInZone(candidate, timeZone)
    const matches =
      back.year === wall.year &&
      back.month === wall.month &&
      back.day === wall.day &&
      back.hour === wall.hour &&
      back.minute === wall.minute
    if (matches && (best === null || candidate < best)) best = candidate
  }
  return best
}

function pad(value: number, length = 2): string {
  return String(Math.abs(value)).padStart(length, '0')
}

export function formatIsoDate(date: CalendarDate): string {
  return `${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}`
}

/** "+02:00" / "-05:00" */
export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** "2026-03-18T14:30:00+02:00": the instant, written in the zone's local time. */
export function formatIsoWithOffset(instantMs: number, timeZone: string): string {
  const wall = wallTimeInZone(instantMs, timeZone)
  const offset = zoneOffsetMinutes(instantMs, timeZone)
  return `${formatIsoDate(wall)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}${formatOffset(offset)}`
}

/** "HH:MM" of an instant in a zone. */
export function formatClock(instantMs: number, timeZone: string): string {
  const wall = wallTimeInZone(instantMs, timeZone)
  return `${pad(wall.hour)}:${pad(wall.minute)}`
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Strict YYYY-MM-DD that is a real calendar date. */
export function parseIsoDate(value: string | null | undefined): CalendarDate | null {
  if (typeof value !== 'string') return null
  const match = ISO_DATE.exec(value.trim())
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null
  return { year, month, day }
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const probe = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return { year: probe.getUTCFullYear(), month: probe.getUTCMonth() + 1, day: probe.getUTCDate() }
}

/** Negative when a is before b. Whole days. */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return Math.round((Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / DAY_MS)
}

export function weekdayOf(date: CalendarDate): Weekday {
  // getUTCDay: 0 = Sunday … 6 = Saturday; WEEKDAYS starts on Monday.
  const index = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
  return WEEKDAYS[(index + 6) % 7]
}

export function localDateOf(instantMs: number, timeZone: string): CalendarDate {
  const wall = wallTimeInZone(instantMs, timeZone)
  return { year: wall.year, month: wall.month, day: wall.day }
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/

/** "09:30" → 570 minutes after midnight; "24:00" is accepted as end of day. */
export function parseClock(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '24:00') return 24 * 60
  const match = CLOCK.exec(trimmed)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const OFFSET_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i

/**
 * Start time argument from the model. The exact value check_availability
 * returned carries an offset; a bare local time ("2026-03-18T14:30") is read
 * as wall time in the business zone rather than rejected.
 */
export function parseDateTimeInZone(value: string | null | undefined, timeZone: string): number | null {
  if (typeof value !== 'string') return null
  const match = OFFSET_DATE_TIME.exec(value.trim())
  if (!match) return null
  const date = parseIsoDate(`${match[1]}-${match[2]}-${match[3]}`)
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = match[6] ? Number(match[6]) : 0
  if (!date || hour > 23 || minute > 59 || second > 59) return null

  const zone = match[7]
  if (!zone) {
    const instant = zonedWallTimeToUtc({ ...date, hour, minute }, timeZone)
    return instant === null ? null : instant + second * 1000
  }
  const wallAsUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute, second)
  if (zone.toUpperCase() === 'Z') return wallAsUtc
  const digits = zone.replace(':', '')
  const sign = digits[0] === '-' ? -1 : 1
  const offsetHours = Number(digits.slice(1, 3))
  const offsetMinutes = Number(digits.slice(3, 5))
  if (offsetHours > 14 || offsetMinutes > 59) return null
  return wallAsUtc - sign * (offsetHours * 60 + offsetMinutes) * MINUTE_MS
}

/**
 * Date argument from the model: YYYY-MM-DD, a full timestamp (its local date
 * in the zone), or the words today / tomorrow.
 */
export function resolveDateArgument(value: string | null | undefined, now: Date, timeZone: string): CalendarDate | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  const today = localDateOf(now.getTime(), timeZone)
  if (trimmed === 'today') return today
  if (trimmed === 'tomorrow') return addDays(today, 1)
  const direct = parseIsoDate(trimmed)
  if (direct) return direct
  const instant = parseDateTimeInZone(value, timeZone)
  return instant === null ? null : localDateOf(instant, timeZone)
}
