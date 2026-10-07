import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeCalendar } from '@/tests/helpers/calendar'
import { AGENT_A, CALL_A, CALL_B, ORG_A, ORG_B, OWNER_A, WEEKDAY_HOURS, toolDb } from '@/tests/helpers/voice-tools'

const state = vi.hoisted(() => ({ db: null as unknown, calendar: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const getCalendarClientForOrg = vi.fn(async (_orgId: string) => state.calendar)
vi.mock('@/lib/google/calendar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/google/calendar')>()),
  getCalendarClientForOrg: (orgId: string) => getCalendarClientForOrg(orgId),
}))
const rateLimit = vi.fn()
vi.mock('@/lib/security/rate-limit', () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }))
const pending: Array<Promise<unknown>> = []
const events: Array<Record<string, unknown>> = []
vi.mock('@/lib/observability/telemetry', () => ({
  emitProviderEvent: (e: Record<string, unknown>) => events.push(e),
  deferBackground: (work: Promise<unknown>) => pending.push(work),
}))
const sendEmail = vi.fn()
vi.mock('@/lib/email/client', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a), isConfigured: () => true }))

import { POST as checkAvailability } from './check-availability/route'
import { POST as bookAppointment } from './book-appointment/route'
import { POST as takeMessage } from './take-message/route'
import { signCallToken } from '@/lib/telephony/tokens'

const SECRET = 'voice-token-secret-0123456789abcdef-xyz'
const TOOL_KEY = 'tool-key-0123456789abcdef-0123456789abcdef'
const NOW = Date.parse('2026-10-07T07:00:00Z')

function post(path: string, body: unknown, headers: Record<string, string>): Request {
  return new Request(`https://voice.example.com/api/telephony/tools/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function auth(callId = CALL_A, key = TOOL_KEY): Record<string, string> {
  return { 'X-NTV-Tool-Key': key, 'X-NTV-Call-Token': signCallToken(callId, 'tool', 300) }
}

function seed() {
  const db = toolDb({
    calls: [
      { id: CALL_A, org_id: ORG_A, agent_id: AGENT_A, direction: 'inbound', status: 'in-progress', provider: 'elevenlabs', from_number: '+40712345678', to_number: '+40310000001', ended_at: null, is_test: false },
      { id: CALL_B, org_id: ORG_B, agent_id: 'agent-b', direction: 'inbound', status: 'in-progress', provider: 'elevenlabs', from_number: '+40799999999', to_number: '+40310000002', ended_at: null, is_test: false },
    ],
    organizations: [
      { id: ORG_A, name: 'Smile Clinic', timezone: 'Europe/Bucharest', user_id: OWNER_A },
      { id: ORG_B, name: 'Other Business', timezone: 'Europe/Bucharest', user_id: 'owner-b' },
    ],
    agents: [
      { id: AGENT_A, org_id: ORG_A, name: 'Ana', language: 'en', working_hours: WEEKDAY_HOURS, booking_settings: { enabled: true, duration_minutes: 60, min_notice_hours: 1 }, message_settings: { enabled: true } },
      { id: 'agent-b', org_id: ORG_B, name: 'B', language: 'en', working_hours: WEEKDAY_HOURS, booking_settings: { enabled: true, calendar_id: 'b-cal@example.com' }, message_settings: { enabled: true, extra_recipients: ['b@other.example'] } },
    ],
  })
  state.db = db
  return db
}

let db: ReturnType<typeof seed>
let cal: ReturnType<typeof fakeCalendar>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('VOICE_TOKEN_SECRET', SECRET)
  vi.stubEnv('ELEVENLABS_TOOL_SECRET', TOOL_KEY)
  vi.stubEnv('ELEVENLABS_TOOL_SECRET_PREVIOUS', '')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db = seed()
  cal = fakeCalendar()
  state.calendar = cal.client
  getCalendarClientForOrg.mockClear()
  rateLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 5, resetAt: NOW + 600_000 })
  sendEmail.mockReset().mockResolvedValue(true)
  pending.length = 0
  events.length = 0
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('in-call business tool routes: authentication and tenant isolation', () => {
  it('401 without the workspace key, with a wrong key, or without any credentials', async () => {
    for (const headers of [{ 'X-NTV-Call-Token': signCallToken(CALL_A, 'tool', 300) }, auth(CALL_A, 'x'.repeat(40)), {}]) {
      const res = await checkAvailability(post('check-availability', { date_from: '2026-10-08' }, headers))
      expect(res.status).toBe(401)
      expect((await res.json()).ok).toBe(false)
    }
    expect(getCalendarClientForOrg).not.toHaveBeenCalled()
    expect(events.every((e) => e.kind === 'webhook_verification_failed')).toBe(true)
  })

  it('200 ok:false for a forged, expired or wrong-purpose call token (the correlation token never authorizes)', async () => {
    for (const token of ['forged.token', signCallToken(CALL_A, 'tool', 60, NOW - 120_000), signCallToken(CALL_A, 'transfer', 300)]) {
      const res = await takeMessage(post('take-message', { reason: 'x', urgency: 'normal' }, { 'X-NTV-Tool-Key': TOOL_KEY, 'X-NTV-Call-Token': token }))
      expect(res.status).toBe(200)
      expect((await res.json()).ok).toBe(false)
    }
    expect(db.tables.call_messages ?? []).toEqual([])
  })

  it("a token for org A's call with a body naming org B, B's call, calendar or recipients acts on org A only", async () => {
    const res = await checkAvailability(post('check-availability', { date_from: '2026-10-08', org_id: ORG_B, call_id: CALL_B, calendar_id: 'b-cal@example.com' }, auth(CALL_A)))
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(getCalendarClientForOrg).toHaveBeenCalledWith(ORG_A)
    expect(getCalendarClientForOrg).not.toHaveBeenCalledWith(ORG_B)
    expect((cal.freebusyQuery.mock.calls[0][0] as { requestBody: { items: Array<{ id: string }> } }).requestBody.items).toEqual([{ id: 'primary' }])
    expect(db.tables.call_slot_offers.every((o) => o.call_id === CALL_A && o.org_id === ORG_A)).toBe(true)

    const message = await takeMessage(post('take-message', { reason: 'Call back', urgency: 'normal', org_id: ORG_B, recipients: ['attacker@evil.example'] }, auth(CALL_A)))
    expect((await message.json()).ok).toBe(true)
    await Promise.all(pending)
    expect(db.tables.call_messages).toEqual([expect.objectContaining({ org_id: ORG_A, call_id: CALL_A, agent_id: AGENT_A })])
    expect((sendEmail.mock.calls[0][0] as { to: string[] }).to).toEqual(['owner@example.com'])
  })

  it('a call that has ended is rejected', async () => {
    db.tables.calls[0].ended_at = new Date(NOW - 5 * 60_000).toISOString()
    db.tables.calls[0].status = 'completed'
    const res = await bookAppointment(post('book-appointment', { slot_id: 's202610081300', caller_name: 'Ana' }, auth(CALL_A)))
    expect(await res.json()).toEqual({ ok: false, message: expect.stringContaining('already ended') })
    expect(cal.eventsInsert).not.toHaveBeenCalled()
  })

  it('per-call budget: over it the tool answers ok:false and does nothing', async () => {
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: NOW + 600_000 })
    const res = await bookAppointment(post('book-appointment', { slot_id: 's202610081300', caller_name: 'Ana' }, auth(CALL_A)))
    expect((await res.json()).ok).toBe(false)
    expect(rateLimit).toHaveBeenCalledWith({ name: 'tool_book_appointment', limit: 5, windowSeconds: 600 }, CALL_A)
    expect(getCalendarClientForOrg).not.toHaveBeenCalled()
  })

  it('malformed bodies get 4xx without touching anything', async () => {
    const res = await takeMessage(new Request('https://voice.example.com/api/telephony/tools/take-message', { method: 'POST', headers: { 'content-type': 'text/plain', ...auth() }, body: 'hi' }))
    expect(res.status).toBe(415)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})

describe('booking flow through the routes', () => {
  it('check → book an offered slot (once, even when repeated); an unoffered or out-of-hours time is refused', async () => {
    const offer = await (await checkAvailability(post('check-availability', { date_from: '2026-10-08' }, auth()))).json()
    expect(offer.slot_ids).toEqual(['s202610080900', 's202610081300', 's202610081600'])
    expect(offer.slots[1]).toEqual({ id: 's202610081300', label: expect.any(String) })

    const outOfHours = await (await bookAppointment(post('book-appointment', { slot_id: 's202610081800', caller_name: 'Ana' }, auth()))).json()
    expect(outOfHours).toEqual({ ok: false, message: expect.stringContaining('not offered') })

    const booked = await (await bookAppointment(post('book-appointment', { slot_id: 's202610081300', caller_name: 'Ana Pop' }, auth()))).json()
    expect(booked).toEqual({ ok: true, message: expect.stringContaining('Booked') })
    const repeat = await (await bookAppointment(post('book-appointment', { slot_id: 's202610081300', caller_name: 'Ana Pop' }, auth()))).json()
    expect(repeat).toEqual(booked)
    expect(cal.eventsInsert).toHaveBeenCalledTimes(1)
    expect(db.tables.bookings).toEqual([expect.objectContaining({ org_id: ORG_A, status: 'booked', caller_phone: '+40712345678', starts_at: '2026-10-08T10:00:00.000Z' })])
  })

  it("an offer stored for another call cannot be booked with this call's token", async () => {
    await checkAvailability(post('check-availability', { date_from: '2026-10-08' }, auth(CALL_B)))
    const res = await (await bookAppointment(post('book-appointment', { slot_id: 's202610081300', caller_name: 'Ana' }, auth(CALL_A)))).json()
    expect(res.ok).toBe(false)
    expect(cal.eventsInsert).not.toHaveBeenCalled()
  })
})
