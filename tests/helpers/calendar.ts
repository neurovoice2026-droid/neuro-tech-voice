// Fake Google Calendar client for booking tests: no network, every request
// recorded. Busy blocks are returned by freebusy.query for any calendar.

import { vi } from 'vitest'
import type { calendar_v3 } from 'googleapis/build/src/apis/calendar'

export interface FakeCalendarOptions {
  busy?: Array<{ start: string; end: string }>
  /** Rejection for events.insert (e.g. a GoogleCalendarError-like object). */
  insertError?: unknown
  /** events.list items (recovery after a failed insert). */
  listItems?: Array<{ id: string; status?: string }>
  freeBusyError?: unknown
}

export function fakeCalendar(opts: FakeCalendarOptions = {}) {
  const freebusyQuery = vi.fn(async (params: { requestBody: { items: Array<{ id: string }> } }) => {
    if (opts.freeBusyError) throw opts.freeBusyError
    const id = params.requestBody.items[0]?.id ?? 'primary'
    return { data: { calendars: { [id]: { busy: opts.busy ?? [] } } } }
  })
  let n = 0
  const eventsInsert = vi.fn(async (_params: unknown) => {
    if (opts.insertError) throw opts.insertError
    n += 1
    return { data: { id: `evt_${n}` } }
  })
  const eventsList = vi.fn(async () => ({ data: { items: opts.listItems ?? [] } }))
  const calendarListList = vi.fn(async () => ({ data: { items: [] } }))
  const client = {
    freebusy: { query: freebusyQuery },
    events: { insert: eventsInsert, list: eventsList },
    calendarList: { list: calendarListList },
  } as unknown as calendar_v3.Calendar
  return { client, freebusyQuery, eventsInsert, eventsList }
}
