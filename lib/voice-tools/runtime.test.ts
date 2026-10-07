import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/observability/logger'
import { AGENT_A, CALL_A, ORG_A, ORG_B, toolDb } from '@/tests/helpers/voice-tools'
import { callHasEnded, callerPhoneOf, contextFailureMessage, ENDED_GRACE_MS, loadToolCallContext, normalizeCallbackNumber } from './call-context'
import { claimInvocation, completeInvocation, invocationKey, releaseInvocation } from './invocations'
import { messageTakenEmail } from './message-email'
import { parseToolArguments } from './schemas'
import { sanitizeToolText } from './text'

const log = createLogger({ component: 'test' })
const NOW = new Date('2026-10-07T07:00:00Z')

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function seeded(call: Record<string, unknown> = {}) {
  return toolDb({
    calls: [{ id: CALL_A, org_id: ORG_A, agent_id: AGENT_A, direction: 'inbound', status: 'in-progress', provider: 'elevenlabs', from_number: '+40712345678', to_number: '+40310000001', ended_at: null, is_test: false, ...call }],
    organizations: [{ id: ORG_A, name: ' Smile Clinic ', timezone: 'Europe/Bucharest', user_id: 'owner-a' }],
    agents: [{ id: AGENT_A, org_id: ORG_A, name: 'Ana', language: 'ro', working_hours: {}, booking_settings: { enabled: true }, message_settings: { enabled: true, extra_recipients: ['A@B.example'] } }],
  })
}

describe('loadToolCallContext: everything from the verified call, nothing from the request', () => {
  it('resolves the org and agent of the call, with lenient settings', async () => {
    const ctx = await loadToolCallContext(CALL_A, { db: seeded() as unknown as SupabaseClient, now: NOW, log })
    if (typeof ctx === 'string') throw new Error(ctx)
    expect(ctx.org).toEqual({ id: ORG_A, name: 'Smile Clinic', timezone: 'Europe/Bucharest', userId: 'owner-a' })
    expect(ctx.agent).toMatchObject({ id: AGENT_A, language: 'ro' })
    expect(ctx.agent.booking).toMatchObject({ enabled: true, calendar_id: 'primary', duration_minutes: 30 })
    expect(ctx.agent.messages.extra_recipients).toEqual(['a@b.example'])
    expect(ctx.callerPhone).toBe('+40712345678')
    expect(ctx.businessPhone).toBe('+40310000001')
  })

  it('an agent of another organisation is never used, even if the call row points at it', async () => {
    const db = seeded()
    db.tables.agents[0].org_id = ORG_B
    expect(await loadToolCallContext(CALL_A, { db: db as unknown as SupabaseClient, now: NOW })).toBe('no_agent')
  })

  it('rejects unknown and ended calls (a short grace covers a request racing the hang-up)', async () => {
    expect(await loadToolCallContext('ffffffff-ffff-4fff-8fff-ffffffffffff', { db: seeded() as unknown as SupabaseClient, now: NOW })).toBe('not_found')
    const recent = new Date(NOW.getTime() - ENDED_GRACE_MS + 5_000).toISOString()
    expect(typeof (await loadToolCallContext(CALL_A, { db: seeded({ ended_at: recent, status: 'completed' }) as unknown as SupabaseClient, now: NOW }))).toBe('object')
    const old = new Date(NOW.getTime() - ENDED_GRACE_MS - 5_000).toISOString()
    expect(await loadToolCallContext(CALL_A, { db: seeded({ ended_at: old }) as unknown as SupabaseClient, now: NOW })).toBe('ended')
    expect(callHasEnded({ status: 'failed', ended_at: null }, NOW.getTime())).toBe(true)
    expect(callHasEnded({ status: 'in-progress', ended_at: null }, NOW.getTime())).toBe(false)
  })

  it('the caller is the other party of the stored call', () => {
    expect(callerPhoneOf({ direction: 'inbound', from_number: '+40712345678', to_number: '+40310000001', caller_number: null })).toBe('+40712345678')
    expect(callerPhoneOf({ direction: 'outbound', from_number: '+40310000001', to_number: '+40755555555', caller_number: null })).toBe('+40755555555')
    expect(callerPhoneOf({ direction: 'inbound', from_number: 'anonymous', to_number: null, caller_number: null })).toBeNull()
    expect(contextFailureMessage('ended')).toMatch(/already ended/)
  })

  it('normalizes a dictated callback number', () => {
    expect(normalizeCallbackNumber('+40 721 000 111', null)).toBe('+40721000111')
    expect(normalizeCallbackNumber('0721 000 111', '+40310000001')).toBe('+40721000111')
    expect(normalizeCallbackNumber('0721 000 111', null)).toBe('0721 000 111')
    expect(normalizeCallbackNumber('123', '+40310000001')).toBeNull()
    expect(normalizeCallbackNumber(null, '+40310000001')).toBeNull()
  })
})

describe('tool invocations (idempotency)', () => {
  it('first claim runs, a completed key replays, a running key waits, a released key can run again', async () => {
    const db = toolDb() as unknown as SupabaseClient
    const input = { orgId: ORG_A, callId: CALL_A, tool: 'book_appointment', key: 's202610081300' }
    const first = await claimInvocation(db, input, log, NOW.getTime())
    expect(first.kind).toBe('new')
    expect((await claimInvocation(db, input, log, NOW.getTime())).kind).toBe('in_progress')
    await completeInvocation(db, first, { ok: true, message: 'Booked' }, log)
    expect(await claimInvocation(db, input, log, NOW.getTime())).toEqual({ kind: 'replay', answer: { ok: true, message: 'Booked' } })
    const other = await claimInvocation(db, { ...input, key: 'other' }, log, NOW.getTime())
    await releaseInvocation(db, other, log)
    expect((await claimInvocation(db, { ...input, key: 'other' }, log, NOW.getTime())).kind).toBe('new')
  })

  it('an abandoned running claim (crashed instance) is taken over after a minute', async () => {
    const db = toolDb() as unknown as SupabaseClient
    const input = { orgId: ORG_A, callId: CALL_A, tool: 'take_message', key: 'k' }
    await claimInvocation(db, input, log, NOW.getTime())
    ;(db as unknown as { tables: Record<string, Array<Record<string, unknown>>> }).tables.tool_invocations[0].created_at = new Date(NOW.getTime() - 120_000).toISOString()
    expect((await claimInvocation(db, input, log, NOW.getTime())).kind).toBe('new')
  })

  it('keys are stable regardless of key order', () => {
    expect(invocationKey({ a: 1, b: 'x' })).toBe(invocationKey({ b: 'x', a: 1 }))
  })
})

describe('argument schemas (ported from e7c7974)', () => {
  it('coerces blanks and enums, rejects missing required values with guidance', () => {
    const ok = parseToolArguments('take_message', { reason: ' Call me\nback ', urgency: 'URGENT', callback_number: 'null', caller_name: '' })
    expect(ok).toEqual({ ok: true, data: { reason: 'Call me back', urgency: 'urgent', callback_number: null, caller_name: null } })
    expect(parseToolArguments('take_message', { urgency: 'whatever', reason: 'x' })).toMatchObject({ ok: true, data: { urgency: 'normal' } })
    const missing = parseToolArguments('book_appointment', { slot_id: 's202610081300' })
    expect(missing).toEqual({ ok: false, message: expect.stringContaining('caller_name is missing') })
    expect(parseToolArguments('book_appointment', { slot_id: 'S202610081300', caller_name: 'Ana' })).toMatchObject({ ok: true, data: { slot_id: 's202610081300' } })
    expect(parseToolArguments('check_availability', { date_from: '2026-10-08', time_of_day: 'Afternoon' })).toMatchObject({ ok: true, data: { time_of_day: 'afternoon', date_to: null } })
  })

  it('sanitizes free text written into the calendar', () => {
    expect(sanitizeToolText('Card 4111 1111 1111 1111, call +40 721 000 111\nthanks', 300)).toBe('Card [number], call [number] thanks')
  })
})

describe('message alert e-mail', () => {
  it('escapes every value, flags urgent and test calls, keeps the subject on one line', () => {
    const mail = messageTakenEmail({
      businessName: '<b>Clinic</b>',
      callerName: 'Ana\r\nBcc: x@evil.example',
      callbackNumber: '+40712345678',
      reason: '<script>alert(1)</script>',
      urgency: 'urgent',
      receivedAt: NOW,
      timezone: 'Europe/Bucharest',
      isTest: true,
      updated: false,
      dashboardUrl: 'https://app.example/dashboard',
    })
    expect(mail.subject).toBe('Test call: [URGENT] New message from Ana Bcc: x@evil.example')
    expect(mail.subject).not.toMatch(/[\r\n]/)
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
    expect(mail.html).toContain('&lt;b&gt;Clinic&lt;/b&gt;')
    expect(mail.html).toContain('Marked urgent')
    expect(mail.html).toContain('7 October 2026 at 10:00')
  })
})
