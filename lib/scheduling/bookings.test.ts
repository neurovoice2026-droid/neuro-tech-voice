import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { fakeCalendar } from '@/tests/helpers/calendar'
import { createLogger } from '@/lib/observability/logger'
import { GoogleCalendarError } from '@/lib/google/calendar'
import { bookAppointment, checkAvailability, fullDays, resolveIdempotencyKey } from './bookings'
import { slotRulesFor } from './settings'
import { DEFAULT_BOOKING_SETTINGS, type BookingSettings } from '@/lib/voice-providers/types'
import { parseIsoDate } from './time'

const TZ = 'Europe/Bucharest'
const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_ORG = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CALL = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
// Wednesday 7 October 2026, 10:00 in Bucharest (UTC+3).
const NOW = new Date('2026-10-07T07:00:00Z')
const HOURS = {
  monday: { start: '09:00', end: '17:00', enabled: true },
  tuesday: { start: '09:00', end: '17:00', enabled: true },
  wednesday: { start: '09:00', end: '17:00', enabled: true },
  thursday: { start: '09:00', end: '17:00', enabled: true },
  friday: { start: '09:00', end: '17:00', enabled: true },
  saturday: { start: '09:00', end: '13:00', enabled: false },
  sunday: { start: '09:00', end: '13:00', enabled: false },
}
const BOOKING: BookingSettings = { ...DEFAULT_BOOKING_SETTINGS, enabled: true, duration_minutes: 60, min_notice_hours: 1 }
const log = createLogger({ component: 'test' })

let db: MemoryDb
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db = memoryDb({}, { unique: { bookings: [['org_id', 'idempotency_key']] } })
})
afterEach(() => vi.restoreAllMocks())

function book(overrides: Partial<Parameters<typeof bookAppointment>[0]> = {}) {
  const cal = fakeCalendar()
  return bookAppointment({
    db: db as unknown as SupabaseClient,
    log,
    orgId: ORG,
    agentId: 'agent-1',
    callId: CALL,
    calendarId: 'primary',
    rules: slotRulesFor(BOOKING, HOURS),
    dailyCap: null,
    timezone: TZ,
    startMs: Date.parse('2026-10-08T07:00:00Z'), // Thursday 10:00 local
    callerName: 'Ana Pop',
    callerPhone: '+40712345678',
    notes: null,
    now: NOW,
    client: cal.client,
    lockOptions: { attempts: 2, waitMs: 1 },
    ...overrides,
  })
}

describe('bookAppointment (ported from e7c7974, Postgres lease)', () => {
  it('writes the calendar event, then confirms the booking with the event id and the caller details', async () => {
    const cal = fakeCalendar()
    const res = await book({ client: cal.client })
    expect(res).toMatchObject({ ok: true, duplicate: false })
    const row = db.tables.bookings[0]
    expect(row).toMatchObject({
      org_id: ORG,
      call_id: CALL,
      status: 'booked',
      google_event_id: 'evt_1',
      caller_name: 'Ana Pop',
      caller_phone: '+40712345678',
      starts_at: '2026-10-08T07:00:00.000Z',
      ends_at: '2026-10-08T08:00:00.000Z',
      idempotency_key: `${CALL}:2026-10-08T07:00:00.000Z`,
    })
    const insert = cal.eventsInsert.mock.calls[0][0] as unknown as { calendarId: string; sendUpdates: string; requestBody: Record<string, unknown> }
    expect(insert.calendarId).toBe('primary')
    expect(insert.sendUpdates).toBe('none')
    expect(insert.requestBody.summary).toBe('Appointment: Ana Pop')
    expect(insert.requestBody.description).toContain('Phone: +40712345678')
    expect(insert.requestBody.extendedProperties).toEqual({ private: { ntv_booking_id: row.id, ntv_call_id: CALL } })
    // The lease is given back.
    expect(db.tables.booking_locks ?? []).toEqual([])
  })

  it('is idempotent per call and start: a repeat returns the first booking without a second event', async () => {
    const cal = fakeCalendar()
    expect(await book({ client: cal.client })).toMatchObject({ ok: true, duplicate: false })
    expect(await book({ client: cal.client })).toMatchObject({ ok: true, duplicate: true })
    expect(cal.eventsInsert).toHaveBeenCalledTimes(1)
    expect(db.tables.bookings).toHaveLength(1)
  })

  it('never confirms a duplicate that is still being written (pending)', async () => {
    await book()
    db.tables.bookings[0].status = 'pending'
    expect(await book()).toEqual({ ok: false, reason: 'in_progress' })
  })

  it('rejects a time outside the opening hours and writes nothing', async () => {
    const cal = fakeCalendar()
    const saturday = await book({ client: cal.client, startMs: Date.parse('2026-10-10T07:00:00Z') })
    expect(saturday).toMatchObject({ ok: false, reason: 'outside_hours' })
    const evening = await book({ client: cal.client, startMs: Date.parse('2026-10-08T15:00:00Z') }) // 18:00 local
    expect(evening).toMatchObject({ ok: false, reason: 'outside_hours' })
    expect(cal.eventsInsert).not.toHaveBeenCalled()
    expect(db.tables.bookings ?? []).toEqual([])
  })

  it('rejects a slot Google shows as busy, with nearby free alternatives', async () => {
    const cal = fakeCalendar({ busy: [{ start: '2026-10-08T07:00:00Z', end: '2026-10-08T08:00:00Z' }] })
    const res = await book({ client: cal.client })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('slot_taken')
    expect(res.alternatives?.map((a) => a.time)).toEqual(['09:00', '11:00', '12:00'])
    expect(cal.eventsInsert).not.toHaveBeenCalled()
  })

  it('a slot booked by another call (not yet visible in Google) is taken', async () => {
    db.tables.bookings = [{ id: 'b0', org_id: ORG, status: 'booked', starts_at: '2026-10-08T07:00:00.000Z', ends_at: '2026-10-08T08:00:00.000Z', idempotency_key: 'other' }]
    expect(await book()).toMatchObject({ ok: false, reason: 'slot_taken' })
  })

  it("another organisation's bookings never block this one", async () => {
    db.tables.bookings = [{ id: 'b0', org_id: OTHER_ORG, status: 'booked', starts_at: '2026-10-08T07:00:00.000Z', ends_at: '2026-10-08T08:00:00.000Z', idempotency_key: 'x' }]
    expect(await book()).toMatchObject({ ok: true })
  })

  it('enforces the daily cap', async () => {
    db.tables.bookings = [{ id: 'b0', org_id: ORG, status: 'booked', starts_at: '2026-10-08T12:00:00.000Z', ends_at: '2026-10-08T13:00:00.000Z', idempotency_key: 'x' }]
    expect(await book({ dailyCap: 1 })).toMatchObject({ ok: false, reason: 'day_full' })
    expect(await book({ dailyCap: 2 })).toMatchObject({ ok: true })
  })

  it('a failed calendar write leaves no booking behind and is never confirmed', async () => {
    const cal = fakeCalendar({ insertError: new GoogleCalendarError('failed', 'boom') })
    expect(await book({ client: cal.client })).toEqual({ ok: false, reason: 'calendar_error' })
    expect(db.tables.bookings).toEqual([])
  })

  it('keeps the booking when the insert failed but the event exists (recovered by its private property)', async () => {
    const cal = fakeCalendar({ insertError: new GoogleCalendarError('timeout', 'slow'), listItems: [{ id: 'evt_recovered' }] })
    expect(await book({ client: cal.client })).toMatchObject({ ok: true })
    expect(db.tables.bookings[0]).toMatchObject({ status: 'booked', google_event_id: 'evt_recovered' })
  })

  it('not connected: nothing is checked or written', async () => {
    expect(await book({ client: null })).toEqual({ ok: false, reason: 'not_connected' })
  })

  it('another booking holding the lease → in_progress (the caller is told to retry)', async () => {
    db.tables.booking_locks = [{ org_id: ORG, lock_owner: 'someone', lock_until: new Date(Date.now() + 30_000).toISOString() }]
    expect(await book()).toEqual({ ok: false, reason: 'in_progress' })
    // An expired lease (crashed writer) is taken over.
    db.tables.booking_locks = [{ org_id: ORG, lock_owner: 'someone', lock_until: new Date(Date.now() - 1_000).toISOString() }]
    expect(await book()).toMatchObject({ ok: true })
  })
})

describe('checkAvailability', () => {
  const check = (overrides: Partial<Parameters<typeof checkAvailability>[0]> = {}) =>
    checkAvailability({
      db: db as unknown as SupabaseClient,
      orgId: ORG,
      calendarId: 'primary',
      rules: slotRulesFor(BOOKING, HOURS),
      dailyCap: null,
      dateFrom: parseIsoDate('2026-10-07')!,
      dateTo: null,
      timeOfDay: 'any',
      timezone: TZ,
      now: NOW,
      client: fakeCalendar({ busy: [{ start: '2026-10-07T09:00:00Z', end: '2026-10-07T10:00:00Z' }] }).client,
      ...overrides,
    })

  it('offers times within opening hours, after the minimum notice, around busy blocks', async () => {
    const res = await check()
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // 10:00 now + 1 h notice → 11:00 first; 12:00 is busy in Google; closes at 17:00.
    expect(res.slots.map((s) => s.time)).toEqual(['11:00', '13:00', '14:00', '15:00', '16:00'])
    expect(res.durationMinutes).toBe(60)
  })

  it('a full day (daily cap) offers the next days instead', async () => {
    db.tables.bookings = [{ id: 'b0', org_id: ORG, status: 'booked', starts_at: '2026-10-07T12:00:00.000Z', ends_at: '2026-10-07T13:00:00.000Z' }]
    const res = await check({ dailyCap: 1 })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.slots).toEqual([])
    expect(res.later[0]?.date).toBe('2026-10-08')
  })

  it('dates beyond the booking window and a missing connection are refused', async () => {
    expect(await check({ dateFrom: parseIsoDate('2027-03-01')! })).toMatchObject({ ok: false, reason: 'beyond_booking_window' })
    expect(await check({ client: null })).toEqual({ ok: false, reason: 'not_connected' })
  })

  it('a calendar failure is reported, never an empty "no availability"', async () => {
    const res = await check({ client: fakeCalendar({ freeBusyError: new GoogleCalendarError('auth', 'revoked') }).client })
    expect(res).toEqual({ ok: false, reason: 'calendar_auth' })
  })
})

describe('pure helpers', () => {
  it('resolveIdempotencyKey: retry, new key, numbered key after a cancellation', () => {
    const base = `${CALL}:2026-10-08T07:00:00.000Z`
    const start = Date.parse('2026-10-08T07:00:00Z')
    expect(resolveIdempotencyKey([], base, start)).toEqual({ key: base, duplicate: null })
    const live = { idempotency_key: base, status: 'booked', starts_at: '2026-10-08T07:00:00.000Z' }
    expect(resolveIdempotencyKey([live], base, start).duplicate).toBe(live)
    const cancelled = { ...live, status: 'cancelled' }
    expect(resolveIdempotencyKey([cancelled], base, start)).toEqual({ key: `${base}#2`, duplicate: null })
  })

  it('fullDays counts active bookings per local day', () => {
    const b = (iso: string) => ({ start: Date.parse(iso), end: Date.parse(iso) + 3_600_000 })
    // 22:30Z on the 7th is already the 8th in Bucharest.
    const full = fullDays([b('2026-10-07T21:30:00Z'), b('2026-10-08T07:00:00Z'), b('2026-10-07T07:00:00Z')], 2, TZ)
    expect([...full]).toEqual(['2026-10-08'])
    expect(fullDays([b('2026-10-07T07:00:00Z')], null, TZ).size).toBe(0)
  })
})
