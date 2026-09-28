import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Fakes ────────────────────────────────────────────────────────────────────

interface Recorded {
  table: string
  action: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  payload?: unknown
  filters: [string, unknown][]
}

const state = vi.hoisted(() => ({
  ops: [] as Recorded[],
  org: { plan: 'starter', sms_enabled: true } as Record<string, unknown> | null,
  optedOut: false,
  senders: [{ id: 'pn-1', number: '+15550001111', is_active: true, sms_capable: true }] as Record<string, unknown>[],
  createError: null as null | { status: number; code: number; message: string },
  created: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/supabase/admin', () => {
  function builder(table: string) {
    const op: Recorded = { table, action: 'select', filters: [] }
    const result = () => {
      state.ops.push(op)
      if (op.action !== 'select') return { data: null, error: null }
      if (table === 'organizations') return { data: state.org, error: null }
      if (table === 'sms_opt_outs') return { data: state.optedOut ? { phone: 'x' } : null, error: null }
      if (table === 'phone_numbers') return { data: state.senders, error: null }
      if (table === 'calls') return { data: null, error: null }
      return { data: null, error: null }
    }
    const b = {
      select: () => b,
      insert: (payload: unknown) => ((op.action = 'insert'), (op.payload = payload), b),
      upsert: (payload: unknown) => ((op.action = 'upsert'), (op.payload = payload), b),
      update: (payload: unknown) => ((op.action = 'update'), (op.payload = payload), b),
      eq: (column: string, value: unknown) => (op.filters.push([column, value]), b),
      order: () => b,
      limit: () => b,
      maybeSingle: () => Promise.resolve(result()),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
    }
    return b
  }
  return { createAdminClient: () => ({ from: builder }) }
})

vi.mock('@/lib/twilio/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return {
    ...actual,
    getTwilioClient: () => ({
      messages: {
        create: async (params: Record<string, unknown>) => {
          state.created.push(params)
          if (state.createError) throw state.createError
          return { sid: 'SM00000000000000000000000000000001', status: 'queued' }
        },
      },
    }),
  }
})

import { normalizeSmsBody, sendSms, smsGuardReason, smsKeyword, smsStatusesReplaceableBy, MAX_SMS_BODY_CHARACTERS } from './sms'

beforeEach(() => {
  vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC00000000000000000000000000000000')
  vi.stubEnv('TWILIO_AUTH_TOKEN', 'test-token-0123456789')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com')
  state.ops = []
  state.org = { plan: 'starter', sms_enabled: true }
  state.optedOut = false
  state.senders = [{ id: 'pn-1', number: '+15550001111', is_active: true, sms_capable: true }]
  state.createError = null
  state.created = []
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// ─── Pure guard ──────────────────────────────────────────────────────────────

describe('smsGuardReason', () => {
  const ok = {
    twilioConfigured: true,
    to: '+40712345678',
    org: { plan: 'pro' as const, sms_enabled: true },
    optedOut: false,
    fromNumber: '+40312345678',
  }

  it('allows a fully eligible message', () => {
    expect(smsGuardReason(ok)).toBeNull()
  })

  it('reports each reason in order', () => {
    expect(smsGuardReason({ ...ok, twilioConfigured: false, to: null })).toBe('not_configured')
    expect(smsGuardReason({ ...ok, to: null })).toBe('invalid_number')
    // SMS pumping: premium-rate ranges are refused like an invalid number (SEC-12).
    expect(smsGuardReason({ ...ok, to: '+447011223344' })).toBe('invalid_number')
    expect(smsGuardReason({ ...ok, org: { plan: 'pro', sms_enabled: false } })).toBe('sms_disabled')
    // The caller-texts switch doesn't silence alerts to the business's own team; the plan still applies.
    expect(smsGuardReason({ ...ok, org: { plan: 'pro', sms_enabled: false }, kind: 'notification' })).toBeNull()
    expect(smsGuardReason({ ...ok, org: { plan: 'trial', sms_enabled: true }, kind: 'notification' })).toBe('sms_disabled')
    expect(smsGuardReason({ ...ok, org: { plan: 'trial', sms_enabled: true } })).toBe('sms_disabled')
    expect(smsGuardReason({ ...ok, org: null })).toBe('sms_disabled')
    expect(smsGuardReason({ ...ok, optedOut: true, fromNumber: null })).toBe('opted_out')
    expect(smsGuardReason({ ...ok, fromNumber: null })).toBe('no_sms_number')
  })
})

describe('normalizeSmsBody', () => {
  it('tidies whitespace and keeps line breaks', () => {
    expect(normalizeSmsBody('  Hi   there \r\n\r\n\r\n See you  ')).toBe('Hi there\n\nSee you')
  })

  it('caps the body at 480 characters on a word boundary', () => {
    const body = normalizeSmsBody('booking '.repeat(100))
    expect(Array.from(body).length).toBeLessThanOrEqual(MAX_SMS_BODY_CHARACTERS)
    expect(body.endsWith('booking…')).toBe(true)
  })
})

describe('smsStatusesReplaceableBy', () => {
  it('only lets a delivery callback move the status forward', () => {
    expect(smsStatusesReplaceableBy('sent')).toEqual(expect.arrayContaining(['queued', 'accepted', 'sending', 'sent']))
    expect(smsStatusesReplaceableBy('sent')).not.toContain('delivered')
    expect(smsStatusesReplaceableBy('delivered')).toEqual(expect.arrayContaining(['queued', 'sent', 'undelivered']))
    expect(smsStatusesReplaceableBy('delivered')).not.toContain('read')
    expect(smsStatusesReplaceableBy('read')).toContain('delivered')
  })

  it('ignores statuses it does not know', () => {
    expect(smsStatusesReplaceableBy('mystery')).toBeNull()
    expect(smsStatusesReplaceableBy('')).toBeNull()
  })
})

describe('smsKeyword', () => {
  it('detects opt-out, opt-in and help keywords as whole messages only', () => {
    expect(smsKeyword('STOP')).toBe('opt_out')
    expect(smsKeyword(' stop. ')).toBe('opt_out')
    expect(smsKeyword('Unsubscribe')).toBe('opt_out')
    expect(smsKeyword('STOPALL')).toBe('opt_out')
    expect(smsKeyword('start')).toBe('opt_in')
    expect(smsKeyword('UNSTOP')).toBe('opt_in')
    expect(smsKeyword('help')).toBe('help')
    expect(smsKeyword('please stop calling me tomorrow')).toBeNull()
    expect(smsKeyword('yes')).toBeNull()
  })
})

// ─── sendSms ─────────────────────────────────────────────────────────────────

describe('sendSms', () => {
  it('sends from the org SMS number with a status callback and logs the message', async () => {
    const result = await sendSms({ orgId: 'org-1', to: '+40 712 345 678', body: 'Your booking is confirmed.', kind: 'confirmation' })
    expect(result).toEqual({ ok: true, sid: 'SM00000000000000000000000000000001' })
    expect(state.created[0]).toEqual({
      to: '+40712345678',
      from: '+15550001111',
      body: 'Your booking is confirmed.',
      statusCallback: 'https://app.example.com/api/telephony/sms?event=status',
    })
    const log = state.ops.find((op) => op.table === 'sms_messages' && op.action === 'insert')
    expect(log?.payload).toMatchObject({ direction: 'outbound', kind: 'confirmation', twilio_sid: 'SM00000000000000000000000000000001', status: 'queued' })
  })

  it('returns not_configured without touching the database', async () => {
    vi.stubEnv('TWILIO_AUTH_TOKEN', '')
    expect(await sendSms({ orgId: 'org-1', to: '+40712345678', body: 'Hi', kind: 'custom' })).toEqual({ ok: false, reason: 'not_configured' })
    expect(state.ops).toHaveLength(0)
  })

  it('refuses invalid numbers, disabled SMS, opt-outs and orgs without an SMS number', async () => {
    expect(await sendSms({ orgId: 'o', to: '0712345678', body: 'Hi', kind: 'custom' })).toEqual({ ok: false, reason: 'invalid_number' })
    state.org = { plan: 'starter', sms_enabled: false }
    expect(await sendSms({ orgId: 'o', to: '+40712345678', body: 'Hi', kind: 'custom' })).toEqual({ ok: false, reason: 'sms_disabled' })
    state.org = { plan: 'trial', sms_enabled: true }
    expect(await sendSms({ orgId: 'o', to: '+40712345678', body: 'Hi', kind: 'custom' })).toEqual({ ok: false, reason: 'sms_disabled' })
    state.org = { plan: 'starter', sms_enabled: true }
    state.optedOut = true
    expect(await sendSms({ orgId: 'o', to: '+40712345678', body: 'Hi', kind: 'custom' })).toEqual({ ok: false, reason: 'opted_out' })
    state.optedOut = false
    state.senders = []
    expect(await sendSms({ orgId: 'o', to: '+40712345678', body: 'Hi', kind: 'custom' })).toEqual({ ok: false, reason: 'no_sms_number' })
    expect(state.created).toHaveLength(0)
  })

  it('logs a failed send and reports provider_error', async () => {
    state.createError = { status: 400, code: 21408, message: 'Permission to send an SMS has not been enabled' }
    expect(await sendSms({ orgId: 'o', to: '+40712345678', body: 'Hi', kind: 'reminder' })).toEqual({ ok: false, reason: 'provider_error' })
    const log = state.ops.find((op) => op.table === 'sms_messages')
    expect(log?.payload).toMatchObject({ status: 'failed', error_code: '21408', twilio_sid: null })
  })

  it('records a carrier-level unsubscribe (21610) as an opt-out', async () => {
    state.createError = { status: 400, code: 21610, message: 'Attempt to send to unsubscribed recipient' }
    expect(await sendSms({ orgId: 'o', to: '+40712345678', body: 'Hi', kind: 'reminder' })).toEqual({ ok: false, reason: 'opted_out' })
    expect(state.ops.some((op) => op.table === 'sms_opt_outs' && op.action === 'upsert')).toBe(true)
  })
})
