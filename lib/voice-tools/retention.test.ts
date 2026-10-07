import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown, calendars: new Map<string, unknown>() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/google/calendar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/google/calendar')>()),
  getCalendarClientForOrg: async (orgId: string) => state.calendars.get(orgId) ?? null,
}))

import { createLogger } from '@/lib/observability/logger'
import { GoogleCalendarError } from '@/lib/google/calendar'
import { applyBusinessToolRetention } from './retention'

const NOW = Date.parse('2026-10-07T07:00:00Z')
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const DAY = 86_400_000
let db: MemoryDb

/** Google Calendar fake answering events.list by the ntv_booking_id private property. */
function calendar(events: Record<string, Array<{ id: string; status?: string }> | 'error'>) {
  const list = vi.fn(async (params: { calendarId: string; privateExtendedProperty: string[] }) => {
    const bookingId = params.privateExtendedProperty[0].replace('ntv_booking_id=', '')
    const found = events[bookingId] ?? []
    if (found === 'error') throw new GoogleCalendarError('failed', 'Google is down')
    return { data: { items: found } }
  })
  return { client: { events: { list } }, list }
}

const booking = (id: string, minutesAgo: number, over: Record<string, unknown> = {}) => ({
  id, org_id: 'o1', calendar_id: 'primary', status: 'pending', google_event_id: null, created_at: iso(minutesAgo * 60_000), ...over,
})

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  state.calendars = new Map()
  db = memoryDb({
    call_slot_offers: [{ id: 'o1', created_at: iso(3 * DAY) }, { id: 'o2', created_at: iso(60_000) }],
    tool_invocations: [{ id: 't1', created_at: iso(8 * DAY) }, { id: 't2', created_at: iso(DAY) }],
    bookings: [
      booking('b1', 20),
      booking('b2', 1),
      booking('b3', 20, { status: 'booked', google_event_id: 'evt_3' }),
    ],
    agents: [
      { id: 'a-30', org_id: 'o1', privacy_settings: { record_audio: true, retention_days: 30 }, metadata: {} },
      { id: 'a-unlimited', org_id: 'o2', privacy_settings: { record_audio: true, retention_days: -1 }, metadata: {} },
      { id: 'a-0', org_id: 'o3', privacy_settings: { record_audio: true, retention_days: 0 }, metadata: {} },
    ],
  })
  state.db = db
})

describe('business_tools_retention', () => {
  it('cleans up old offers and invocations, settles abandoned pending bookings, applies each agent’s retention (min 1 day)', async () => {
    state.calendars.set('o1', calendar({}).client)
    const report = await applyBusinessToolRetention(createLogger({ component: 'test' }), NOW)
    expect(db.tables.call_slot_offers.map((r) => r.id)).toEqual(['o2'])
    expect(db.tables.tool_invocations.map((r) => r.id)).toEqual(['t2'])
    expect(db.tables.bookings.map((r) => [r.id, r.status])).toEqual([['b1', 'cancelled'], ['b2', 'pending'], ['b3', 'booked']])
    expect(report).toMatchObject({ offersDeleted: true, invocationsDeleted: true, pendingReleased: 1, pendingConfirmed: 0, pendingKept: 0, agents: 2, errors: 0 })
    expect(db.rpcCalls).toEqual([
      // Retention 0 still keeps a message for a day, so it can be read before it is cleared.
      { fn: 'apply_business_tool_retention', args: { p_agent_id: 'a-0', p_cutoff: iso(DAY), p_limit: 500 } },
      { fn: 'apply_business_tool_retention', args: { p_agent_id: 'a-30', p_cutoff: iso(30 * DAY), p_limit: 500 } },
    ])
  })

  it('only agents whose owner saved a retention period are purged (never the default)', async () => {
    db.tables.agents.push(
      { id: 'a-never-saved', org_id: 'o4', privacy_settings: null, metadata: {} },
      { id: 'a-legacy-flag', org_id: 'o5', privacy_settings: { record_audio: true }, metadata: { behavior_settings: { record_calls: true } } },
    )
    const report = await applyBusinessToolRetention(createLogger({ component: 'test' }), NOW)
    expect(db.rpcCalls.map((c) => (c.args as { p_agent_id: string }).p_agent_id)).toEqual(['a-0', 'a-30'])
    expect(report.agents).toBe(2)
  })

  it('a pending booking whose event Google holds (looked up by ntv_booking_id) is confirmed, never cancelled', async () => {
    db.tables.bookings = [booking('b-has-event', 20), booking('b-no-event', 20), booking('b-other-org', 20, { org_id: 'o9', calendar_id: 'team' })]
    const ours = calendar({ 'b-has-event': [{ id: 'evt_found' }], 'b-no-event': [{ id: 'evt_gone', status: 'cancelled' }] })
    const theirs = calendar({ 'b-other-org': [{ id: 'evt_other' }] })
    state.calendars.set('o1', ours.client)
    state.calendars.set('o9', theirs.client)
    const report = await applyBusinessToolRetention(createLogger({ component: 'test' }), NOW)
    const byId = Object.fromEntries(db.tables.bookings.map((b) => [b.id, b]))
    expect(byId['b-has-event']).toMatchObject({ status: 'booked', google_event_id: 'evt_found' })
    expect(byId['b-no-event']).toMatchObject({ status: 'cancelled', google_event_id: null })
    expect(byId['b-other-org']).toMatchObject({ status: 'booked', google_event_id: 'evt_other' })
    expect(report).toMatchObject({ pendingConfirmed: 2, pendingReleased: 1 })
    // Each org's own calendar, by the booking's private property.
    expect(ours.list).toHaveBeenCalledWith(expect.objectContaining({ calendarId: 'primary', privateExtendedProperty: ['ntv_booking_id=b-has-event'] }), expect.anything())
    expect(theirs.list).toHaveBeenCalledWith(expect.objectContaining({ calendarId: 'team', privateExtendedProperty: ['ntv_booking_id=b-other-org'] }), expect.anything())
  })

  it('when Google cannot be asked, the booking keeps its time until a later run; after a day it is released anyway', async () => {
    db.tables.bookings = [booking('b-error', 20), booking('b-not-connected', 20, { org_id: 'o-off' }), booking('b-old-error', 25 * 60)]
    state.calendars.set('o1', calendar({ 'b-error': 'error', 'b-old-error': 'error' }).client)
    const report = await applyBusinessToolRetention(createLogger({ component: 'test' }), NOW)
    const byId = Object.fromEntries(db.tables.bookings.map((b) => [b.id, b]))
    expect(byId['b-error'].status).toBe('pending')
    expect(byId['b-not-connected'].status).toBe('pending')
    expect(byId['b-old-error'].status).toBe('cancelled')
    expect(report).toMatchObject({ pendingKept: 2, pendingReleased: 1, pendingConfirmed: 0, errors: 0 })
  })
})
