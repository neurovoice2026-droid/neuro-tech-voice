import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/api/auth', () => ({
  requireOrg: vi.fn(async () => ({
    supabase: state.db,
    user: { id: 'u1', email: 'owner@example.test', email_confirmed_at: '2026-01-01T00:00:00Z' },
    org: { id: 'org1', name: 'Smile', timezone: 'Europe/Bucharest', plan: 'pro' },
  })),
}))
const enforce = vi.fn(async () => undefined)
vi.mock('@/lib/security/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/security/rate-limit')>()),
  enforceRateLimit: (...a: unknown[]) => enforce(...(a as [])),
}))
const sync = vi.fn()
vi.mock('@/lib/agents/ensure-agent', () => ({
  defaultAgentName: () => 'Smile Agent',
  ensureAgent: vi.fn(async () => ({ id: 'agent1', org_id: 'org1', primary_provider: 'elevenlabs' })),
  syncAgentProviders: (...a: unknown[]) => sync(...a),
}))
const calendar = { connection: vi.fn(), list: vi.fn() }
vi.mock('@/lib/google/calendar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/google/calendar')>()),
  calendarConnection: (...a: unknown[]) => calendar.connection(...a),
  listCalendars: (...a: unknown[]) => calendar.list(...a),
}))

import { GET, PUT } from './route'
import { GET as calendarsGET } from './calendars/route'
import { GoogleCalendarError } from '@/lib/google/calendar'
import { DEFAULT_BOOKING_SETTINGS, DEFAULT_MESSAGE_SETTINGS } from '@/lib/voice-providers/types'

let db: MemoryDb
const put = (body: unknown, origin = 'https://app.test') =>
  PUT(new Request('https://app.test/api/agent/business-tools', { method: 'PUT', headers: { 'content-type': 'application/json', origin, host: 'app.test', 'x-forwarded-proto': 'https' }, body: JSON.stringify(body) }))

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db = memoryDb({ agents: [{ id: 'agent1', org_id: 'org1', booking_settings: {}, message_settings: {} }, { id: 'agent2', org_id: 'org2', booking_settings: {}, message_settings: {} }] })
  state.db = db
  enforce.mockClear()
  sync.mockReset().mockResolvedValue([{ provider: 'elevenlabs', status: 'ready', error: null }])
  calendar.connection.mockReset().mockResolvedValue({ connected: true, needsReconnect: false })
  calendar.list.mockReset().mockResolvedValue([
    { id: 'primary@example.test', name: 'Main', primary: true, timeZone: 'Europe/Bucharest', canBook: true },
    { id: 'team@group.calendar.google.com', name: 'Team', primary: false, timeZone: null, canBook: true },
    { id: 'holidays@group.v.calendar.google.com', name: 'Holidays', primary: false, timeZone: null, canBook: false },
  ])
})

describe('GET /api/agent/business-tools', () => {
  it('returns the defaults, the calendar connection and the verified owner address', async () => {
    const res = await GET(new Request('https://app.test/api/agent/business-tools'))
    const body = await res.json()
    expect(body.booking).toEqual(DEFAULT_BOOKING_SETTINGS)
    expect(body.messages).toEqual(DEFAULT_MESSAGE_SETTINGS)
    expect(body.calendar).toMatchObject({ connected: true, needs_reconnect: false, connect_url: '/api/integrations/google/connect?type=google_calendar' })
    expect(body).toMatchObject({ owner_email: 'owner@example.test', owner_email_verified: true })
  })
})

describe('PUT /api/agent/business-tools', () => {
  it('validates, saves with the service role on the org’s own agent, and pushes the agent config', async () => {
    const messages = { enabled: true, notify_owner: true, extra_recipients: [' Desk@Clinic.Example '], email_notifications: 'urgent_only' }
    const res = await put({ messages })
    expect(res.status).toBe(200)
    expect(db.tables.agents[0].message_settings).toEqual({ ...messages, extra_recipients: ['desk@clinic.example'] })
    expect(db.tables.agents[1].message_settings).toEqual({})
    expect(enforce).toHaveBeenCalled()
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org1', agentId: 'agent1', bump: true, primary: true }))
  })

  it('rejects invalid values, unknown keys, too many recipients and cross-site requests', async () => {
    expect((await put({ booking: { ...DEFAULT_BOOKING_SETTINGS, duration_minutes: 3 } })).status).toBe(400)
    expect((await put({ messages: DEFAULT_MESSAGE_SETTINGS, org_id: 'org2' })).status).toBe(400)
    const many = Array.from({ length: 6 }, (_, i) => `p${i}@example.test`)
    expect((await put({ messages: { ...DEFAULT_MESSAGE_SETTINGS, extra_recipients: many } })).status).toBe(400)
    expect((await put({ messages: { ...DEFAULT_MESSAGE_SETTINGS, extra_recipients: ['not-an-email'] } })).status).toBe(400)
    expect((await put({ messages: DEFAULT_MESSAGE_SETTINGS }, 'https://evil.example')).status).toBe(403)
    expect(sync).not.toHaveBeenCalled()
  })

  it('a chosen calendar must be writable by the connected Google account', async () => {
    const booking = { ...DEFAULT_BOOKING_SETTINGS, enabled: true }
    expect((await put({ booking: { ...booking, calendar_id: 'holidays@group.v.calendar.google.com' } })).status).toBe(400)
    expect((await put({ booking: { ...booking, calendar_id: 'someone-else@example.test' } })).status).toBe(400)
    expect(db.tables.agents[0].booking_settings).toEqual({})
    const ok = await put({ booking: { ...booking, calendar_id: 'team@group.calendar.google.com' } })
    expect(ok.status).toBe(200)
    expect(db.tables.agents[0].booking_settings).toMatchObject({ enabled: true, calendar_id: 'team@group.calendar.google.com' })
    calendar.list.mockRejectedValue(new GoogleCalendarError('failed', 'down'))
    expect((await put({ booking: { ...booking, calendar_id: 'other@group.calendar.google.com' } })).status).toBe(502)
  })

  it('an unchanged save does not push anything', async () => {
    const res = await put({ booking: DEFAULT_BOOKING_SETTINGS, messages: DEFAULT_MESSAGE_SETTINGS })
    expect(res.status).toBe(200)
    expect(sync).not.toHaveBeenCalled()
  })
})

describe('GET /api/agent/business-tools/calendars', () => {
  it('lists the connected account calendars; a revoked consent asks to reconnect', async () => {
    const body = await (await calendarsGET(new Request('https://app.test/api/agent/business-tools/calendars'))).json()
    expect(body.calendars).toEqual([
      { id: 'primary@example.test', name: 'Main', primary: true, can_book: true },
      { id: 'team@group.calendar.google.com', name: 'Team', primary: false, can_book: true },
      { id: 'holidays@group.v.calendar.google.com', name: 'Holidays', primary: false, can_book: false },
    ])
    expect(calendar.list).toHaveBeenCalledWith('org1', expect.anything())
    calendar.list.mockRejectedValue(new GoogleCalendarError('auth', 'revoked'))
    expect(await (await calendarsGET(new Request('https://app.test/x'))).json()).toEqual({ connected: true, needs_reconnect: true, calendars: [] })
    calendar.list.mockResolvedValue(null)
    expect(await (await calendarsGET(new Request('https://app.test/x'))).json()).toEqual({ connected: false, needs_reconnect: false, calendars: [] })
  })
})
