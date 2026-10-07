import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '@/lib/observability/logger'
import { fakeCalendar } from '@/tests/helpers/calendar'
import { CALL_A, CALL_B, ORG_A, ORG_B, toolContext, toolDb } from '@/tests/helpers/voice-tools'
import { bookAppointmentTool, checkAvailabilityTool, MAX_OFFERED_SLOTS, slotIdOf } from './booking-tools'

const log = createLogger({ component: 'test' })
let db: ReturnType<typeof toolDb>

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db = toolDb()
})

describe('check_availability', () => {
  it('offers at most three free times as {id, label} and remembers them for this call', async () => {
    const cal = fakeCalendar()
    const res = await checkAvailabilityTool(toolContext(db), { date_from: '2026-10-08' }, log, { client: cal.client })
    expect(res.ok).toBe(true)
    expect(res.slots).toHaveLength(MAX_OFFERED_SLOTS)
    expect(res.slot_ids).toEqual(res.slots!.map((s) => s.id))
    expect(res.slots![0]).toEqual({ id: 's202610080900', label: 'Thursday 8 October at 9:00' })
    // Spread across the day, not the first three hours.
    expect(res.slot_ids).toEqual(['s202610080900', 's202610081300', 's202610081600'])
    expect(db.tables.call_slot_offers.map((o) => [o.call_id, o.org_id, o.slot_id, o.starts_at])).toEqual([
      [CALL_A, ORG_A, 's202610080900', '2026-10-08T06:00:00.000Z'],
      [CALL_A, ORG_A, 's202610081300', '2026-10-08T10:00:00.000Z'],
      [CALL_A, ORG_A, 's202610081600', '2026-10-08T13:00:00.000Z'],
    ])
    expect(res.message).toContain('book_appointment')
  })

  it('accepts today / tomorrow and refuses an invalid date with guidance', async () => {
    const cal = fakeCalendar()
    expect((await checkAvailabilityTool(toolContext(db), { date_from: 'tomorrow' }, log, { client: cal.client })).slot_ids?.[0]).toBe('s202610080900')
    const bad = await checkAvailabilityTool(toolContext(db), { date_from: 'next blue moon' }, log, { client: cal.client })
    expect(bad).toEqual({ ok: false, message: expect.stringContaining('today is 2026-10-07') })
  })

  it('nothing free: ok with an empty list (no invented times)', async () => {
    const cal = fakeCalendar({ busy: [{ start: '2026-10-01T00:00:00Z', end: '2026-12-01T00:00:00Z' }] })
    const res = await checkAvailabilityTool(toolContext(db), { date_from: '2026-10-08' }, log, { client: cal.client })
    expect(res).toMatchObject({ ok: true, slots: [], slot_ids: [] })
    expect(res.message).toMatch(/Nothing is free/)
  })

  it('booking off or calendar not connected: ok:false telling the agent to take a message, no slot ids', async () => {
    const off = await checkAvailabilityTool(toolContext(db, { booking: { enabled: false } }), { date_from: '2026-10-08' }, log, { client: fakeCalendar().client })
    expect(off.ok).toBe(false)
    expect(off.message).toMatch(/take a message/)
    const disconnected = await checkAvailabilityTool(toolContext(db), { date_from: '2026-10-08' }, log, { client: null })
    expect(disconnected).toEqual({ ok: false, message: expect.stringContaining('take a message') })
    expect('slot_ids' in disconnected).toBe(false)
  })

  it('slot ids are deterministic per start time', () => {
    expect(slotIdOf({ date: '2026-10-08', time: '09:30' })).toBe('s202610080930')
  })
})

describe('book_appointment', () => {
  async function offer(ctx = toolContext(db)) {
    return checkAvailabilityTool(ctx, { date_from: '2026-10-08' }, log, { client: fakeCalendar().client })
  }

  it('books an offered slot with the caller number from the call; body fields naming another org, calendar or phone are ignored', async () => {
    await offer()
    const cal = fakeCalendar()
    const res = await bookAppointmentTool(
      toolContext(db),
      { slot_id: 's202610081300', caller_name: 'Ana Pop', org_id: ORG_B, calendar_id: 'victim@example.com', caller_phone: '+40799999999', call_id: CALL_B },
      log,
      { client: cal.client },
    )
    expect(res).toEqual({ ok: true, message: expect.stringMatching(/^Booked: .*13:00/) })
    expect(db.tables.bookings[0]).toMatchObject({ org_id: ORG_A, call_id: CALL_A, calendar_id: 'primary', caller_phone: '+40712345678', status: 'booked' })
    expect((cal.eventsInsert.mock.calls[0][0] as unknown as { calendarId: string }).calendarId).toBe('primary')
  })

  it('a slot that was not offered on this call is refused (even one offered on another call)', async () => {
    await offer(toolContext(db, { call: { id: CALL_B } }))
    const cal = fakeCalendar()
    const res = await bookAppointmentTool(toolContext(db), { slot_id: 's202610081300', caller_name: 'Ana' }, log, { client: cal.client })
    expect(res).toEqual({ ok: false, message: expect.stringContaining('not offered on this call') })
    expect(cal.eventsInsert).not.toHaveBeenCalled()
    expect(db.tables.bookings ?? []).toEqual([])
  })

  it('a made-up slot id is refused by validation', async () => {
    const res = await bookAppointmentTool(toolContext(db), { slot_id: 'tomorrow at 10', caller_name: 'Ana' }, log, { client: fakeCalendar().client })
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/slot_id/)
  })

  it('idempotent: the same slot twice in one call books once and replays the answer', async () => {
    await offer()
    const cal = fakeCalendar()
    const first = await bookAppointmentTool(toolContext(db), { slot_id: 's202610081300', caller_name: 'Ana' }, log, { client: cal.client })
    const second = await bookAppointmentTool(toolContext(db), { slot_id: 's202610081300', caller_name: 'Ana Pop' }, log, { client: cal.client })
    expect(second).toEqual(first)
    expect(cal.eventsInsert).toHaveBeenCalledTimes(1)
    expect(db.tables.bookings).toHaveLength(1)
  })

  it('a slot taken since it was offered is refused: never confirmed, the agent is told to check again', async () => {
    await offer()
    const cal = fakeCalendar({ busy: [{ start: '2026-10-08T10:00:00Z', end: '2026-10-08T11:00:00Z' }] })
    const res = await bookAppointmentTool(toolContext(db), { slot_id: 's202610081300', caller_name: 'Ana' }, log, { client: cal.client })
    expect(res).toEqual({ ok: false, message: expect.stringContaining('check_availability again') })
    expect(db.tables.bookings ?? []).toEqual([])
  })

  it('a transient calendar failure can be retried with the same values (the claim is released)', async () => {
    await offer()
    const failing = fakeCalendar({ freeBusyError: new Error('socket hang up') })
    const res = await bookAppointmentTool(toolContext(db), { slot_id: 's202610081300', caller_name: 'Ana' }, log, { client: failing.client })
    expect(res.ok).toBe(false)
    const retry = await bookAppointmentTool(toolContext(db), { slot_id: 's202610081300', caller_name: 'Ana' }, log, { client: fakeCalendar().client })
    expect(retry.ok).toBe(true)
  })
})
