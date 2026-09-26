// Free appointment times from business hours, calendar busy blocks and the
// booking rules (slot length, buffers, minimum notice, days ahead). Pure, so
// the exact times a caller is offered are unit-tested, including the days the
// clocks change.

import type { ServiceOffering, WorkingHours } from '@/types'
import {
  addDays,
  compareDates,
  formatClock,
  formatIsoDate,
  formatIsoWithOffset,
  localDateOf,
  parseClock,
  parseIsoDate,
  safeTimeZone,
  weekdayOf,
  zonedWallTimeToUtc,
  type CalendarDate,
  type Weekday,
} from '@/lib/scheduling/time'
import { containsTokens, matchTokens, normalizeForMatch, similarity } from '@/lib/scheduling/text'

export type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening'

export const TIME_OF_DAY_VALUES: readonly TimeOfDay[] = ['any', 'morning', 'afternoon', 'evening'] as const

/** Start-time windows in minutes after local midnight: [from, to). */
export const TIME_OF_DAY_WINDOWS: Record<Exclude<TimeOfDay, 'any'>, [number, number]> = {
  morning: [0, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, 24 * 60],
}

/** Longest range one availability search covers; callers ask about days, not months. */
export const MAX_SEARCH_DAYS = 14

export interface SlotRules {
  slot_minutes: number
  buffer_minutes: number
  min_notice_minutes: number
  max_days_ahead: number
  business_hours: WorkingHours
}

/** Busy block, epoch milliseconds, end exclusive. */
export interface BusyInterval {
  start: number
  end: number
}

/** Local calendar days in the business zone, inclusive. */
export interface DateRange {
  from: string
  to: string
}

export interface AvailableSlot {
  /** ISO 8601 with the zone's offset: the value the model passes back to book. */
  start: string
  end: string
  startMs: number
  endMs: number
  /** Local YYYY-MM-DD */
  date: string
  /** Local HH:MM */
  time: string
  weekday: Weekday
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/**
 * The offered service a caller's words refer to: exact match, then all words
 * contained either way, then a close spelling. null when nothing fits.
 */
export function resolveService(services: readonly ServiceOffering[], requested: string | null | undefined): ServiceOffering | null {
  const query = normalizeForMatch(requested)
  if (!query || services.length === 0) return null
  const named = services.filter((s) => normalizeForMatch(s.name))

  const exact = named.find((s) => normalizeForMatch(s.name) === query)
  if (exact) return exact

  const queryTokens = matchTokens(query)
  const contained = named.filter((s) => {
    const tokens = matchTokens(s.name)
    return containsTokens(queryTokens, tokens) || containsTokens(tokens, queryTokens)
  })
  if (contained.length === 1) return contained[0]
  if (contained.length > 1) {
    // "cut" matches "cut" and "cut and colour": prefer the closest name.
    return [...contained].sort((a, b) => similarity(normalizeForMatch(b.name), query) - similarity(normalizeForMatch(a.name), query))[0]
  }

  let best: { service: ServiceOffering; score: number } | null = null
  for (const service of named) {
    const score = similarity(normalizeForMatch(service.name), query)
    if (score >= 0.75 && (!best || score > best.score)) best = { service, score }
  }
  return best?.service ?? null
}

/** Appointment length: the service's own duration, else the slot length. */
export function appointmentMinutes(rules: Pick<SlotRules, 'slot_minutes'>, service: ServiceOffering | null): number {
  const slot = clampInt(rules.slot_minutes, 5, 240, 30)
  if (service && Number.isFinite(service.duration_minutes) && service.duration_minutes > 0) {
    return clampInt(service.duration_minutes, 5, 24 * 60, slot)
  }
  return slot
}

/** Sorts and merges overlapping or touching busy blocks; drops invalid ones. */
export function mergeBusy(busy: readonly BusyInterval[]): BusyInterval[] {
  const valid = busy
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
    .sort((a, b) => a.start - b.start)
  const merged: BusyInterval[] = []
  for (const block of valid) {
    const last = merged[merged.length - 1]
    if (last && block.start <= last.end) last.end = Math.max(last.end, block.end)
    else merged.push({ start: block.start, end: block.end })
  }
  return merged
}

/** Removes `hole` from every busy block (used to ignore a booking's own time when moving it). */
export function subtractInterval(busy: readonly BusyInterval[], hole: BusyInterval): BusyInterval[] {
  const out: BusyInterval[] = []
  for (const block of busy) {
    if (hole.end <= block.start || hole.start >= block.end) {
      out.push({ ...block })
      continue
    }
    if (block.start < hole.start) out.push({ start: block.start, end: hole.start })
    if (block.end > hole.end) out.push({ start: hole.end, end: block.end })
  }
  return out
}

function overlapsAny(sorted: readonly BusyInterval[], start: number, end: number): boolean {
  for (const block of sorted) {
    if (block.start >= end) return false
    if (block.end > start) return true
  }
  return false
}

function inTimeOfDay(minutes: number, timeOfDay: TimeOfDay): boolean {
  if (timeOfDay === 'any') return true
  const [from, to] = TIME_OF_DAY_WINDOWS[timeOfDay]
  return minutes >= from && minutes < to
}

/**
 * The days a search really covers: never before today, never past
 * max_days_ahead, at most MAX_SEARCH_DAYS long. null when nothing is left.
 */
export function clampRange(range: DateRange, rules: Pick<SlotRules, 'max_days_ahead'>, now: Date, timezone: string): { from: CalendarDate; to: CalendarDate } | null {
  const tz = safeTimeZone(timezone)
  const today = localDateOf(now.getTime(), tz)
  const lastBookable = addDays(today, clampInt(rules.max_days_ahead, 0, 366, 30))
  let from = parseIsoDate(range.from)
  let to = parseIsoDate(range.to) ?? from
  if (!from || !to) return null
  if (compareDates(to, from) < 0) [from, to] = [to, from]
  if (compareDates(from, today) < 0) from = today
  if (compareDates(to, lastBookable) > 0) to = lastBookable
  const longest = addDays(from, MAX_SEARCH_DAYS - 1)
  if (compareDates(to, longest) > 0) to = longest
  return compareDates(to, from) < 0 ? null : { from, to }
}

/**
 * Every bookable start time in the range, in order. A start is offered when:
 * the day is open, the whole appointment fits before closing, it is at least
 * min_notice_minutes away, and the appointment plus buffer_minutes on both
 * sides doesn't touch a busy block. Starts step by slot_minutes from opening
 * time; local times skipped by a DST change are never offered.
 */
export function generateSlots(
  settings: SlotRules,
  busy: readonly BusyInterval[],
  range: DateRange,
  service: ServiceOffering | null,
  timeOfDay: TimeOfDay,
  now: Date,
  timezone: string
): AvailableSlot[] {
  const tz = safeTimeZone(timezone)
  const days = clampRange(range, settings, now, tz)
  if (!days) return []

  const step = clampInt(settings.slot_minutes, 5, 240, 30)
  const duration = appointmentMinutes(settings, service)
  const bufferMs = clampInt(settings.buffer_minutes, 0, 24 * 60, 0) * 60_000
  const earliestStart = now.getTime() + clampInt(settings.min_notice_minutes, 0, 366 * 24 * 60, 0) * 60_000
  const blocks = mergeBusy(busy)
  const slots: AvailableSlot[] = []

  for (let day = days.from; compareDates(day, days.to) <= 0; day = addDays(day, 1)) {
    const weekday = weekdayOf(day)
    const hours = settings.business_hours?.[weekday]
    if (!hours || !hours.enabled) continue
    const open = parseClock(hours.start)
    const close = parseClock(hours.end)
    if (open === null || close === null || close <= open) continue

    for (let minutes = open; minutes + duration <= close; minutes += step) {
      if (!inTimeOfDay(minutes, timeOfDay)) continue
      const startMs = zonedWallTimeToUtc({ ...day, hour: Math.floor(minutes / 60), minute: minutes % 60 }, tz)
      if (startMs === null || startMs < earliestStart) continue
      const endMs = startMs + duration * 60_000
      if (overlapsAny(blocks, startMs - bufferMs, endMs + bufferMs)) continue
      slots.push({
        start: formatIsoWithOffset(startMs, tz),
        end: formatIsoWithOffset(endMs, tz),
        startMs,
        endMs,
        date: formatIsoDate(day),
        time: formatClock(startMs, tz),
        weekday,
      })
    }
  }
  return slots
}

/**
 * A short, varied selection to read to the model: at most `perDay` starts per
 * day spread across the day, and `maxTotal` overall, keeping order.
 */
export function spreadSlots(slots: readonly AvailableSlot[], perDay = 6, maxTotal = 24): AvailableSlot[] {
  const byDay = new Map<string, AvailableSlot[]>()
  for (const slot of slots) {
    const list = byDay.get(slot.date)
    if (list) list.push(slot)
    else byDay.set(slot.date, [slot])
  }
  const out: AvailableSlot[] = []
  for (const list of byDay.values()) {
    if (out.length >= maxTotal) break
    const take = Math.min(perDay, list.length, maxTotal - out.length)
    if (list.length <= take) {
      out.push(...list)
      continue
    }
    const picked = new Set<number>()
    for (let i = 0; i < take; i += 1) {
      picked.add(take === 1 ? 0 : Math.round((i * (list.length - 1)) / (take - 1)))
    }
    for (const index of [...picked].sort((a, b) => a - b)) out.push(list[index])
  }
  return out
}
