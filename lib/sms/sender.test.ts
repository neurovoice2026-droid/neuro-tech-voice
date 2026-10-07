import { beforeEach, describe, expect, it, vi } from 'vitest'

const twilio = vi.hoisted(() => ({ configured: true, fetch: vi.fn(), create: vi.fn() }))
vi.mock('@/lib/twilio/client', () => ({
  isTwilioConfigured: () => twilio.configured,
  getTwilioClient: () => ({
    incomingPhoneNumbers: (sid: string) => ({ fetch: () => twilio.fetch(sid) }),
    messages: { create: (p: unknown) => twilio.create(p) },
  }),
}))
const rateLimit = vi.fn()
vi.mock('@/lib/security/rate-limit', () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }))

import type { SupabaseClient } from '@supabase/supabase-js'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { createLogger } from '@/lib/observability/logger'
import { numberCanSendSms, orgSmsAvailability, SMS_CAPABILITY_TTL_MS } from './capability'
import { sendTransactionalSms, smsDailyCapPerOrg } from './sender'

const log = createLogger({ component: 'test' })
const NOW = Date.parse('2026-10-07T07:00:00Z')
let db: MemoryDb

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  twilio.configured = true
  twilio.fetch.mockReset().mockResolvedValue({ capabilities: { sms: true, voice: true } })
  twilio.create.mockReset().mockResolvedValue({ sid: 'SM123' })
  rateLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 10, resetAt: NOW })
  db = memoryDb(
    {
      phone_numbers: [
        { id: 'pn-voice', org_id: 'org1', number: '+40310000001', twilio_sid: 'PN1', is_active: true, sms_capable: false, sms_checked_at: new Date().toISOString() },
        { id: 'pn-sms', org_id: 'org1', number: '+40310000002', twilio_sid: 'PN2', is_active: true, sms_capable: null, sms_checked_at: null },
        { id: 'pn-other', org_id: 'org2', number: '+40310000009', twilio_sid: 'PN9', is_active: true, sms_capable: true, sms_checked_at: new Date().toISOString() },
      ],
    },
    { unique: { sms_messages: [['org_id', 'idempotency_key']], sms_opt_outs: [['org_id', 'phone']] } },
  )
})

const send = (over: Partial<Parameters<typeof sendTransactionalSms>[0]> = {}) =>
  sendTransactionalSms({ db: db as unknown as SupabaseClient, log, orgId: 'org1', callId: 'call1', preferredNumberId: 'pn-voice', to: '+40712345678', body: 'Smile: thanks for calling.', idempotencyKey: 'wf:w1:a0:call1', ...over })

describe('SMS capability (cached on the number for a day)', () => {
  it('reads Twilio once, then uses the cached answer until it is a day old', async () => {
    const row = db.tables.phone_numbers[1] as never
    expect(await numberCanSendSms(db as unknown as SupabaseClient, row, log, NOW)).toBe(true)
    expect(twilio.fetch).toHaveBeenCalledWith('PN2')
    expect(db.tables.phone_numbers[1]).toMatchObject({ sms_capable: true })
    const cached = { ...db.tables.phone_numbers[1], sms_checked_at: new Date(NOW).toISOString() } as never
    expect(await numberCanSendSms(db as unknown as SupabaseClient, cached, log, NOW + SMS_CAPABILITY_TTL_MS - 1)).toBe(true)
    expect(twilio.fetch).toHaveBeenCalledTimes(1)
  })

  it('a Twilio failure keeps the last known answer (unknown = cannot text)', async () => {
    twilio.fetch.mockRejectedValue(Object.assign(new Error('Accounts/AC123/IncomingPhoneNumbers/PN2 not found'), { status: 404, code: 20404 }))
    expect(await numberCanSendSms(db as unknown as SupabaseClient, db.tables.phone_numbers[1] as never, log, NOW)).toBe(false)
  })

  it('availability for the workflow builder', async () => {
    expect(await orgSmsAvailability(db as unknown as SupabaseClient, 'org1', log)).toEqual({ available: true })
    twilio.fetch.mockResolvedValue({ capabilities: { sms: false } })
    db.tables.phone_numbers[1].sms_checked_at = null
    db.tables.phone_numbers[1].sms_capable = null
    expect(await orgSmsAvailability(db as unknown as SupabaseClient, 'org1', log)).toEqual({ available: false, reason: 'not_capable' })
    expect(await orgSmsAvailability(db as unknown as SupabaseClient, 'org-none', log)).toEqual({ available: false, reason: 'no_number' })
    twilio.configured = false
    expect(await orgSmsAvailability(db as unknown as SupabaseClient, 'org1', log)).toEqual({ available: false, reason: 'not_configured' })
  })
})

describe('sendTransactionalSms', () => {
  it("sends from the org's SMS-capable number (not the voice-only one, never another org's) and records it", async () => {
    expect(await send()).toEqual({ ok: true, duplicate: false })
    expect(twilio.create).toHaveBeenCalledWith({ from: '+40310000002', to: '+40712345678', body: 'Smile: thanks for calling.' })
    expect(db.tables.sms_messages[0]).toMatchObject({ org_id: 'org1', call_id: 'call1', phone_number_id: 'pn-sms', status: 'sent', twilio_sid: 'SM123' })
  })

  it('one text per step and call: a repeat never sends again', async () => {
    await send()
    expect(await send()).toEqual({ ok: true, duplicate: true })
    expect(twilio.create).toHaveBeenCalledTimes(1)
  })

  it('no SMS-capable number → clear failure, nothing sent', async () => {
    db.tables.phone_numbers[1].sms_capable = false
    db.tables.phone_numbers[1].sms_checked_at = new Date().toISOString()
    expect(await send()).toEqual({ ok: false, reason: 'no_sms_number' })
    expect(twilio.create).not.toHaveBeenCalled()
  })

  it("refuses invalid destinations and the org's own numbers", async () => {
    expect(await send({ to: '0712345678' })).toEqual({ ok: false, reason: 'invalid_number' })
    expect(await send({ to: '+40310000001' })).toEqual({ ok: false, reason: 'invalid_number' })
    expect(twilio.create).not.toHaveBeenCalled()
  })

  it('respects opt-outs, and records one when Twilio reports the recipient unsubscribed (21610)', async () => {
    twilio.create.mockRejectedValue(Object.assign(new Error('unsubscribed'), { status: 400, code: 21610 }))
    expect(await send()).toEqual({ ok: false, reason: 'opted_out' })
    expect(db.tables.sms_opt_outs).toEqual([expect.objectContaining({ org_id: 'org1', phone: '+40712345678', source: 'carrier' })])
    twilio.create.mockClear()
    expect(await send({ idempotencyKey: 'wf:w1:a0:call2' })).toEqual({ ok: false, reason: 'opted_out' })
    expect(twilio.create).not.toHaveBeenCalled()
  })

  it('daily caps (per org, per recipient) stop the text and are recorded', async () => {
    rateLimit.mockImplementation(async (rule: { name: string }) => ({ allowed: rule.name !== 'sms_org_day', remaining: 0, resetAt: NOW }))
    expect(await send()).toEqual({ ok: false, reason: 'daily_cap' })
    expect(db.tables.sms_messages[0]).toMatchObject({ status: 'failed', error_code: 'daily_cap' })
    expect(twilio.create).not.toHaveBeenCalled()
    expect(smsDailyCapPerOrg()).toBe(50)
  })

  it('a Twilio failure is final and never logs the provider message', async () => {
    const error = vi.spyOn(console, 'warn')
    twilio.create.mockRejectedValue(Object.assign(new Error('Account AC123 suspended'), { status: 403, code: 20003 }))
    expect(await send()).toEqual({ ok: false, reason: 'failed' })
    expect(JSON.stringify(error.mock.calls)).not.toContain('AC123')
    // A retry of the same step reports the failed attempt instead of sending again.
    twilio.create.mockReset()
    expect(await send()).toEqual({ ok: false, reason: 'failed' })
    expect(twilio.create).not.toHaveBeenCalled()
  })
})
