import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SchedulingSettings } from '@/types'

// Booking service against an in-memory bookings table and a fake Google
// Calendar: idempotency across cancel and re-book, events that exist although
// the insert reported a failure, calendar writes that outlive the caller's
// deadline, and keeping Google and the database in step when one side fails.

type Row = Record<string, unknown>
const db: Record<string, Row[]> = {}
let failRescheduleUpdate = false

function query(table: string) {
  const rows = () => (db[table] ??= [])
  const filters: ((row: Row) => boolean)[] = []
  let op: { kind: 'select' } | { kind: 'insert'; values: Row } | { kind: 'update'; values: Row } | { kind: 'delete' } = { kind: 'select' }
  let max = Number.POSITIVE_INFINITY
  const matching = () => rows().filter((row) => filters.every((filter) => filter(row)))
  const exec = (): { data: Row[] | null; error: { code: string; message: string } | null } => {
    if (op.kind === 'insert') {
      const values = op.values
      if (values.idempotency_key && rows().some((row) => row.idempotency_key === values.idempotency_key)) {
        return { data: null, error: { code: '23505', message: 'duplicate key' } }
      }
      const now = new Date().toISOString()
      const row: Row = { id: randomUUID(), google_event_id: null, confirmation_sent_at: null, reminder_sent_at: null, created_at: now, updated_at: now, ...values }
      rows().push(row)
      return { data: [{ ...row }], error: null }
    }
    if (op.kind === 'update') {
      if (table === 'bookings' && failRescheduleUpdate && 'starts_at' in op.values) {
        return { data: null, error: { code: 'XX000', message: 'database unavailable' } }
      }
      const hit = matching()
      for (const row of hit) Object.assign(row, op.values)
      return { data: hit.map((row) => ({ ...row })), error: null }
    }
    if (op.kind === 'delete') {
      const hit = matching()
      db[table] = rows().filter((row) => !hit.includes(row))
      return { data: hit, error: null }
    }
    return { data: matching().slice(0, max).map((row) => ({ ...row })), error: null }
  }
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value)
      return chain
    },
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]))
      return chain
    },
    lt: (column: string, value: string) => {
      filters.push((row) => String(row[column]) < value)
      return chain
    },
    gt: (column: string, value: string) => {
      filters.push((row) => String(row[column]) > value)
      return chain
    },
    gte: (column: string, value: string) => {
      filters.push((row) => String(row[column]) >= value)
      return chain
    },
    like: (column: string, pattern: string) => {
      const prefix = pattern.replace(/%$/, '')
      filters.push((row) => typeof row[column] === 'string' && (row[column] as string).startsWith(prefix))
      return chain
    },
    order: () => chain,
    abortSignal: () => chain,
    limit: (n: number) => {
      max = n
      return chain
    },
    insert: (values: Row) => {
      op = { kind: 'insert', values }
      return chain
    },
    update: (values: Row) => {
      op = { kind: 'update', values }
      return chain
    },
    delete: () => {
      op = { kind: 'delete' }
      return chain
    },
    single: async () => {
      const result = exec()
      if (result.error) return result
      return result.data?.length === 1 ? { data: result.data[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'not one row' } }
    },
    maybeSingle: async () => {
      const result = exec()
      return result.error ? result : { data: result.data?.[0] ?? null, error: null }
    },
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(exec()).then(resolve, reject),
  }
  return chain
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => query(table) }) }))

const kv = new Map<string, number>()
vi.mock('@/lib/kv', () => ({
  kvIncr: async (key: string) => {
    const next = (kv.get(key) ?? 0) + 1
    kv.set(key, next)
    return next
  },
  kvDel: async (key: string) => {
    kv.delete(key)
  },
}))

const sendSms = vi.fn()
vi.mock('@/lib/twilio/sms', () => ({ sendSms: (...args: unknown[]) => sendSms(...args) }))

const offerFreedSlot = vi.fn()
vi.mock('@/lib/scheduling/waitlist', () => ({ offerFreedSlot: (...args: unknown[]) => offerFreedSlot(...args) }))

const DAY = { start: '09:00', end: '18:00', enabled: true }
const settings: SchedulingSettings = {
  org_id: 'org',
  calendar_id: 'primary',
  slot_minutes: 30,
  buffer_minutes: 0,
  min_notice_minutes: 60,
  max_days_ahead: 30,
  business_hours: { monday: DAY, tuesday: DAY, wednesday: DAY, thursday: DAY, friday: DAY, saturday: DAY, sunday: DAY },
  services: [],
  send_sms_confirmation: true,
  send_reminders: true,
  reminder_hours_before: 24,
  updated_at: '',
}
vi.mock('@/lib/scheduling/settings', () => ({ loadSchedulingSettings: async () => ({ settings, exists: true }) }))

const calendar = {
  freeBusy: vi.fn(),
  createEvent: vi.fn(),
  patchEvent: vi.fn(),
  deleteEvent: vi.fn(),
  findBookingEvent: vi.fn(),
}
vi.mock('@/lib/google/calendar', () => {
  class GoogleCalendarError extends Error {
    readonly code: string
    constructor(code: string, message: string) {
      super(message)
      this.name = 'GoogleCalendarError'
      this.code = code
    }
  }
  return {
    GoogleCalendarError,
    getCalendarClientForOrg: async () => ({}),
    freeBusy: (...args: unknown[]) => calendar.freeBusy(...args),
    createEvent: (...args: unknown[]) => calendar.createEvent(...args),
    patchEvent: (...args: unknown[]) => calendar.patchEvent(...args),
    deleteEvent: (...args: unknown[]) => calendar.deleteEvent(...args),
    findBookingEvent: (...args: unknown[]) => calendar.findBookingEvent(...args),
  }
})

const { bookAppointment, cancelBooking, rescheduleBooking, resolveIdempotencyKey } = await import('@/lib/scheduling/bookings')
const { GoogleCalendarError } = await import('@/lib/google/calendar')

const ORG = '44444444-4444-4444-8444-444444444444'
const CALL = '55555555-5555-4555-8555-555555555555'
const PHONE = '+40712345678'
// Thursday 17 September 2026, 10:00 in Bucharest (UTC+3).
const NOW = new Date('2026-09-17T07:00:00Z')
const START = '2026-09-18T10:00:00+03:00'
const START_UTC = '2026-09-18T07:00:00.000Z'

function bookingInput(overrides: Partial<Parameters<typeof bookAppointment>[0]> = {}): Parameters<typeof bookAppointment>[0] {
  return {
    orgId: ORG,
    agentId: null,
    callId: CALL,
    timezone: 'Europe/Bucharest',
    language: 'ro',
    businessName: 'Acme Dental',
    start: START,
    callerName: 'Ion Pop',
    callerPhone: PHONE,
    callerEmail: null,
    service: null,
    notes: null,
    sendSmsConfirmation: false,
    now: NOW,
    ...overrides,
  }
}

function seedBooking(overrides: Row = {}): Row {
  const row: Row = {
    id: randomUUID(),
    org_id: ORG,
    agent_id: null,
    call_id: CALL,
    calendar_id: 'primary',
    google_event_id: 'evt-1',
    caller_name: 'Ion Pop',
    caller_phone: PHONE,
    caller_email: null,
    service: null,
    starts_at: START_UTC,
    ends_at: '2026-09-18T07:30:00.000Z',
    timezone: 'Europe/Bucharest',
    status: 'booked',
    notes: null,
    idempotency_key: `${CALL}:${START_UTC}`,
    confirmation_sent_at: null,
    reminder_sent_at: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  }
  ;(db.bookings ??= []).push(row)
  return row
}

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key]
  kv.clear()
  failRescheduleUpdate = false
  sendSms.mockReset()
  offerFreedSlot.mockReset().mockResolvedValue({ offered: false, entryId: null })
  calendar.freeBusy.mockReset().mockResolvedValue([])
  calendar.createEvent.mockReset().mockResolvedValue({ id: 'evt-new', htmlLink: null })
  calendar.patchEvent.mockReset().mockResolvedValue(undefined)
  calendar.deleteEvent.mockReset().mockResolvedValue({ alreadyGone: false })
  calendar.findBookingEvent.mockReset().mockResolvedValue(null)
})

describe('resolveIdempotencyKey', () => {
  const base = `${CALL}:${START_UTC}`
  const at = Date.parse(START_UTC)

  it('uses the base key first and treats a live booking at that time as a retry', () => {
    expect(resolveIdempotencyKey([], base, at)).toEqual({ key: base, duplicate: null })
    const live = { idempotency_key: base, status: 'booked', starts_at: START_UTC }
    expect(resolveIdempotencyKey([live], base, at)).toEqual({ key: base, duplicate: live })
  })

  it('numbers the key when the earlier booking of that time was cancelled or moved away', () => {
    const cancelled = { idempotency_key: base, status: 'cancelled', starts_at: START_UTC }
    const moved = { idempotency_key: `${base}#2`, status: 'rescheduled', starts_at: '2026-09-18T09:00:00.000Z' }
    expect(resolveIdempotencyKey([cancelled], base, at).key).toBe(`${base}#2`)
    expect(resolveIdempotencyKey([cancelled, moved], base, at)).toEqual({ key: `${base}#3`, duplicate: null })
  })
})

describe('bookAppointment', () => {
  it('books into the calendar with traceable event properties', async () => {
    const result = await bookAppointment(bookingInput({ isTest: true }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.booking.google_event_id).toBe('evt-new')
    expect(db.bookings).toHaveLength(1)
    expect(db.bookings[0]).toMatchObject({ google_event_id: 'evt-new', idempotency_key: `${CALL}:${START_UTC}`, status: 'booked' })
    const event = calendar.createEvent.mock.calls[0][1]
    expect(event.properties).toEqual({ ntv_booking_id: result.booking.id, ntv_call_id: CALL, ntv_caller_phone: PHONE })
    expect(event.summary).toBe('[Test] Appointment: Ion Pop')
  })

  it('books the same time again after the caller cancelled it in the same call', async () => {
    const first = await bookAppointment(bookingInput())
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const cancelled = await cancelBooking(ORG, first.booking.id, { callerPhone: PHONE, offerToWaitlist: false, now: NOW })
    expect(cancelled.ok).toBe(true)

    const again = await bookAppointment(bookingInput())
    expect(again).toMatchObject({ ok: true, duplicate: false })
    if (!again.ok) return
    expect(again.booking.id).not.toBe(first.booking.id)
    expect(again.booking.status).toBe('booked')

    // A retry of that request finds the live booking, not the cancelled one.
    const retry = await bookAppointment(bookingInput())
    expect(retry).toMatchObject({ ok: true, duplicate: true, booking: { id: again.booking.id } })
    expect(calendar.createEvent).toHaveBeenCalledTimes(2)
  })

  it('treats a simultaneous retry as the same booking, not as a taken time', async () => {
    const [a, b] = await Promise.all([bookAppointment(bookingInput()), bookAppointment(bookingInput())])
    expect([a, b].filter((r) => r.ok && !r.duplicate)).toHaveLength(1)
    expect([a, b].filter((r) => r.ok && r.duplicate)).toHaveLength(1)
    expect(db.bookings).toHaveLength(1)
    expect(calendar.createEvent).toHaveBeenCalledTimes(1)
  })

  it('keeps the booking when Google created the event but the insert timed out', async () => {
    calendar.createEvent.mockRejectedValue(new GoogleCalendarError('timeout', 'timed out'))
    calendar.findBookingEvent.mockResolvedValue('evt-late')
    const result = await bookAppointment(bookingInput())
    expect(result).toMatchObject({ ok: true, booking: { google_event_id: 'evt-late' } })
    expect(db.bookings[0].google_event_id).toBe('evt-late')
  })

  it('gives the time back when no event was created', async () => {
    calendar.createEvent.mockRejectedValue(new GoogleCalendarError('failed', 'boom'))
    const result = await bookAppointment(bookingInput())
    expect(result).toEqual({ ok: false, reason: 'calendar_error' })
    expect(db.bookings ?? []).toHaveLength(0)
  })

  it("lets a started calendar write finish after the caller's deadline", async () => {
    const caller = new AbortController()
    let writeSignal: AbortSignal | undefined
    calendar.createEvent.mockImplementation(async (_client: unknown, input: { signal: AbortSignal }) => {
      caller.abort()
      writeSignal = input.signal
      return { id: 'evt-slow', htmlLink: null }
    })
    const result = await bookAppointment(bookingInput({ signal: caller.signal }))
    expect(result.ok).toBe(true)
    expect(writeSignal).toBeDefined()
    expect(writeSignal?.aborted).toBe(false)
  })

  it("doesn't start writing once the caller's deadline has passed", async () => {
    const caller = new AbortController()
    calendar.freeBusy.mockImplementation(async () => {
      caller.abort()
      return []
    })
    const result = await bookAppointment(bookingInput({ signal: caller.signal }))
    expect(result).toEqual({ ok: false, reason: 'timeout' })
    expect(db.bookings ?? []).toHaveLength(0)
    expect(calendar.createEvent).not.toHaveBeenCalled()
  })

  it('texts a confirmation only when asked and allowed', async () => {
    sendSms.mockResolvedValue({ ok: true, sid: 'SM1' })
    const result = await bookAppointment(bookingInput({ sendSmsConfirmation: true }))
    expect(result).toMatchObject({ ok: true, sms: 'sent' })
    expect(sendSms.mock.calls[0][0]).toMatchObject({ orgId: ORG, to: PHONE, kind: 'confirmation', callId: CALL })
    expect(db.bookings[0].confirmation_sent_at).toEqual(expect.any(String))
  })
})

describe('rescheduleBooking', () => {
  const move = (bookingId: string) =>
    rescheduleBooking({
      orgId: ORG,
      agentId: null,
      callId: CALL,
      timezone: 'Europe/Bucharest',
      language: 'ro',
      businessName: 'Acme Dental',
      bookingId,
      newStart: '2026-09-18T12:00:00+03:00',
      callerPhone: PHONE,
      notifyCaller: false,
      now: NOW,
    })

  it('moves the calendar event back when the booking could not be saved', async () => {
    const row = seedBooking()
    failRescheduleUpdate = true
    const result = await move(row.id as string)
    expect(result).toEqual({ ok: false, reason: 'storage_error' })
    expect(calendar.patchEvent).toHaveBeenCalledTimes(2)
    expect(calendar.patchEvent.mock.calls[0][1]).toMatchObject({ eventId: 'evt-1', startMs: Date.parse('2026-09-18T09:00:00Z') })
    expect(calendar.patchEvent.mock.calls[1][1]).toMatchObject({ eventId: 'evt-1', startMs: Date.parse(START_UTC) })
    expect(db.bookings[0].starts_at).toBe(START_UTC)
  })

  it('finds the event by booking id when its id was never stored', async () => {
    const row = seedBooking({ google_event_id: null })
    calendar.findBookingEvent.mockResolvedValue('evt-found')
    const result = await move(row.id as string)
    expect(result).toMatchObject({ ok: true, booking: { google_event_id: 'evt-found', status: 'rescheduled' } })
    expect(calendar.patchEvent.mock.calls[0][1]).toMatchObject({ eventId: 'evt-found' })
    expect(calendar.createEvent).not.toHaveBeenCalled()
    expect(offerFreedSlot).toHaveBeenCalledWith(expect.objectContaining({ startsAt: START_UTC, excludePhone: PHONE }))
  })

  it("refuses bookings made under another number", async () => {
    const row = seedBooking({ caller_phone: '+40799999999' })
    expect(await move(row.id as string)).toEqual({ ok: false, reason: 'not_found' })
    expect(calendar.patchEvent).not.toHaveBeenCalled()
  })
})

describe('cancelBooking', () => {
  it('removes the calendar event even when its id was never stored', async () => {
    const row = seedBooking({ google_event_id: null })
    calendar.findBookingEvent.mockResolvedValue('evt-orphan')
    const result = await cancelBooking(ORG, row.id as string, { callerPhone: PHONE, now: NOW, offerToWaitlist: false })
    expect(result).toMatchObject({ ok: true, calendarSynced: true, booking: { status: 'cancelled' } })
    expect(calendar.deleteEvent.mock.calls[0][1]).toMatchObject({ eventId: 'evt-orphan' })
  })

  it('leaves the booking alone when the calendar refuses the change', async () => {
    const row = seedBooking()
    calendar.deleteEvent.mockRejectedValue(new GoogleCalendarError('failed', 'boom'))
    const result = await cancelBooking(ORG, row.id as string, { now: NOW })
    expect(result).toMatchObject({ ok: false, reason: 'calendar_error' })
    expect(db.bookings[0].status).toBe('booked')
  })
})
