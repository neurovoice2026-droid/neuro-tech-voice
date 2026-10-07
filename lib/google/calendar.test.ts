import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { fakeCalendar } from '@/tests/helpers/calendar'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))

import { calendarConnection, freeBusy, getCalendarClientForOrg, GoogleCalendarError, googleErrorInfo, isGoogleAuthError, listCalendars } from './calendar'

let db: MemoryDb
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db = memoryDb({
    integrations: [
      { org_id: 'org1', type: 'google_calendar', is_active: true, google_refresh_token: 'rt-1', config: {}, connected_at: '2026-10-01T00:00:00Z' },
      { org_id: 'org2', type: 'google_calendar', is_active: true, google_refresh_token: null, config: {}, connected_at: '2026-10-01T00:00:00Z' },
    ],
  })
  state.db = db
})

describe('Google Calendar connection (the org’s own integrations row)', () => {
  it('connected only with an active row holding a refresh token; another org’s row never counts', async () => {
    expect(await calendarConnection('org1')).toEqual({ connected: true, needsReconnect: false })
    expect(await calendarConnection('org2')).toEqual({ connected: false, needsReconnect: false })
    expect(await calendarConnection('org3')).toEqual({ connected: false, needsReconnect: false })
  })

  it('no client without the Google OAuth app configured or without a token', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    expect(await getCalendarClientForOrg('org1')).toBeNull()
    vi.stubEnv('GOOGLE_CLIENT_ID', 'id')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret')
    expect(await getCalendarClientForOrg('org2')).toBeNull()
    expect(await getCalendarClientForOrg('org1')).not.toBeNull()
    vi.unstubAllEnvs()
  })

  it('a refused token marks the connection "reconnect" until the owner reconnects (newer connected_at)', async () => {
    const revoked = Object.assign(new Error('invalid_grant'), { response: { status: 400, data: { error: 'invalid_grant' } } })
    expect(isGoogleAuthError(revoked)).toBe(true)
    const cal = fakeCalendar({ freeBusyError: revoked })
    await expect(freeBusy(cal.client, { orgId: 'org1', calendarId: 'primary', timeMin: 0, timeMax: 1 })).rejects.toMatchObject({ code: 'auth' })
    expect(await calendarConnection('org1')).toEqual({ connected: true, needsReconnect: true })
    db.tables.integrations[0].connected_at = new Date(Date.now() + 1000).toISOString()
    expect(await calendarConnection('org1')).toEqual({ connected: true, needsReconnect: false })
  })

  it('maps errors without keeping provider messages', () => {
    expect(googleErrorInfo({ response: { status: 403, data: { error: { errors: [{ reason: 'rateLimitExceeded' }] } } } })).toEqual({ status: 403, reason: 'rateLimitExceeded', grant: null })
    expect(isGoogleAuthError({ response: { status: 403, data: { error: { errors: [{ reason: 'insufficientPermissions' }] } } } })).toBe(true)
    expect(isGoogleAuthError({ response: { status: 500 } })).toBe(false)
  })

  it('freeBusy reports a missing calendar instead of "nothing busy"', async () => {
    const client = {
      freebusy: { query: vi.fn(async () => ({ data: { calendars: { cal1: { errors: [{ reason: 'notFound' }] } } } })) },
    } as never
    await expect(freeBusy(client, { orgId: 'org1', calendarId: 'cal1', timeMin: 0, timeMax: 1 })).rejects.toBeInstanceOf(GoogleCalendarError)
  })

  it('lists calendars primary first with write access flagged', async () => {
    const client = {
      calendarList: {
        list: vi.fn(async () => ({
          data: {
            items: [
              { id: 'b@group.calendar.google.com', summary: 'Team', accessRole: 'writer' },
              { id: 'owner@example.test', summary: 'Me', primary: true, accessRole: 'owner' },
              { id: 'h@group.v.calendar.google.com', summary: 'Holidays', accessRole: 'reader' },
            ],
          },
        })),
      },
    } as never
    expect(await listCalendars('org1', { client })).toEqual([
      { id: 'owner@example.test', name: 'Me', primary: true, timeZone: null, canBook: true },
      { id: 'h@group.v.calendar.google.com', name: 'Holidays', primary: false, timeZone: null, canBook: false },
      { id: 'b@group.calendar.google.com', name: 'Team', primary: false, timeZone: null, canBook: true },
    ])
  })
})
