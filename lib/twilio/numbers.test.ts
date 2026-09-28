import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Fakes ────────────────────────────────────────────────────────────────────

interface Op {
  table: string
  action: 'select' | 'insert' | 'update' | 'delete'
  payload?: Record<string, unknown>
  filters: [string, unknown][]
}

const db = vi.hoisted(() => ({
  ops: [] as Op[],
  /** Rows returned by select queries, per table. */
  rows: {} as Record<string, Record<string, unknown> | null>,
  insertResult: null as null | { data: unknown; error: unknown },
  deleteError: null as null | { code: string; message: string },
}))

const twilio = vi.hoisted(() => ({
  fetched: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  created: [] as Record<string, unknown>[],
  removed: [] as string[],
  owned: [] as Record<string, unknown>[],
  updateError: null as unknown,
  removeError: null as unknown,
}))

const stripe = vi.hoisted(() => ({ cancelled: [] as string[], cancelError: null as unknown }))

vi.mock('@/lib/supabase/admin', () => {
  function from(table: string) {
    const op: Op = { table, action: 'select', filters: [] }
    const result = () => {
      db.ops.push(op)
      if (op.action === 'insert') return db.insertResult ?? { data: { id: 'new-row' }, error: null }
      if (op.action === 'delete') return { data: null, error: db.deleteError }
      if (op.action === 'update') return { data: null, error: null }
      return { data: db.rows[table] ?? null, error: null }
    }
    const b = {
      select: () => b,
      insert: (payload: Record<string, unknown>) => ((op.action = 'insert'), (op.payload = payload), b),
      update: (payload: Record<string, unknown>) => ((op.action = 'update'), (op.payload = payload), b),
      delete: () => ((op.action = 'delete'), b),
      eq: (c: string, v: unknown) => (op.filters.push([c, v]), b),
      order: () => b,
      limit: () => b,
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
    }
    return b
  }
  return { createAdminClient: () => ({ from }) }
})

vi.mock('@/lib/twilio/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  const numberResource = (sid: string) => ({
    fetch: async () => {
      const current = twilio.fetched.shift()
      return current ?? {}
    },
    update: async (params: Record<string, unknown>) => {
      twilio.updates.push({ sid, ...params })
      if (twilio.updateError) throw twilio.updateError
      return { sid, phoneNumber: '+15550001111', friendlyName: '(555) 000-1111', capabilities: { sms: true, voice: true }, ...params }
    },
    remove: async () => {
      twilio.removed.push(sid)
      if (twilio.removeError) throw twilio.removeError
      return true
    },
  })
  const incomingPhoneNumbers = Object.assign(numberResource, {
    list: async () => twilio.owned,
    create: async (params: Record<string, unknown>) => {
      twilio.created.push(params)
      return { sid: 'PN00000000000000000000000000000002', phoneNumber: params.phoneNumber, friendlyName: 'new', capabilities: { sms: false, voice: true } }
    },
  })
  return { ...actual, getTwilioClient: () => ({ incomingPhoneNumbers }) }
})

vi.mock('@/lib/stripe/client', () => ({
  getStripeClient: () => ({
    subscriptions: {
      cancel: async (id: string) => {
        stripe.cancelled.push(id)
        if (stripe.cancelError) throw stripe.cancelError
      },
    },
  }),
}))

import { numberCapabilities } from './client'
import {
  configureNumberRouting,
  isVoiceRoutingReady,
  provisionPhoneNumber,
  releasePhoneNumber,
  routingStatusFor,
  toPhoneNumberView,
} from './numbers'

const APP = 'https://app.example.com'
const URLS = {
  voiceUrl: `${APP}/api/telephony/inbound`,
  voiceFallbackUrl: `${APP}/api/telephony/fallback`,
  statusCallback: `${APP}/api/telephony/status`,
  smsUrl: `${APP}/api/telephony/sms`,
}
const ORG = 'org-1'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', APP)
  vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC00000000000000000000000000000000')
  vi.stubEnv('TWILIO_AUTH_TOKEN', 'token-0123456789')
  vi.stubEnv('ELEVENLABS_API_KEY', 'el-key')
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  db.ops = []
  db.rows = {}
  db.insertResult = null
  db.deleteError = null
  twilio.fetched = []
  twilio.updates = []
  twilio.created = []
  twilio.removed = []
  twilio.owned = []
  twilio.updateError = null
  twilio.removeError = null
  stripe.cancelled = []
  stripe.cancelError = null
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const updates = (table: string) => db.ops.filter((op) => op.table === table && op.action === 'update').map((op) => op.payload)

describe('numberCapabilities', () => {
  it('reads SMS and MMS in either spelling Twilio uses', () => {
    expect(numberCapabilities({ voice: true, sms: true, mms: false })).toEqual({ voice: true, sms: true, mms: false })
    expect(numberCapabilities({ voice: true, SMS: true, MMS: true })).toEqual({ voice: true, sms: true, mms: true })
    expect(numberCapabilities(null)).toEqual({ voice: false, sms: false, mms: false })
  })
})

describe('routingStatusFor', () => {
  it('is connected only for app_router with the current voice URL and no error', () => {
    expect(routingStatusFor({ routing_mode: 'app_router', voice_url: URLS.voiceUrl, routing_error: null })).toBe('connected')
    expect(routingStatusFor({ routing_mode: 'elevenlabs_import', voice_url: URLS.voiceUrl, routing_error: null })).toBe('needs_reconnect')
    expect(routingStatusFor({ routing_mode: 'app_router', voice_url: 'https://old.example.com/api/telephony/inbound', routing_error: null })).toBe('needs_reconnect')
    expect(routingStatusFor({ routing_mode: 'app_router', voice_url: URLS.voiceUrl, routing_error: 'x' })).toBe('needs_reconnect')
  })
})

describe('toPhoneNumberView', () => {
  const base = { id: 'pn-1', number: '+15550001111', created_at: '2026-09-01T00:00:00Z' }

  it('flags numbers still imported into ElevenLabs, before and after migration 010', () => {
    expect(toPhoneNumberView({ ...base, routing_mode: 'elevenlabs_import' }).legacy_import).toBe(true)
    expect(toPhoneNumberView({ ...base, elevenlabs_phone_number_id: 'phnum_1' })).toMatchObject({ legacy_import: true, routing_status: 'needs_reconnect' })
    expect(toPhoneNumberView({ ...base, routing_mode: 'app_router', voice_url: URLS.voiceUrl, elevenlabs_phone_number_id: 'phnum_1' })).toMatchObject({
      legacy_import: false,
      routing_status: 'connected',
    })
    expect(toPhoneNumberView({ ...base, agents: [{ name: 'Ana' }], monthly_cost: 1.15 })).toMatchObject({ agent_name: 'Ana', monthly_cost: 1.15, legacy_import: false })
  })
})

describe('isVoiceRoutingReady', () => {
  it('needs the gateway or the ElevenLabs fallback before a number may be moved', () => {
    vi.stubEnv('VOICE_GATEWAY_URL', '')
    vi.stubEnv('VOICE_GATEWAY_SECRET', '')
    expect(isVoiceRoutingReady()).toBe(true)
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    expect(isVoiceRoutingReady()).toBe(false)
    vi.stubEnv('VOICE_GATEWAY_URL', 'wss://gw.example.com')
    vi.stubEnv('VOICE_GATEWAY_SECRET', 'gw-secret-0123456789abcdef-0123456789abcdef')
    expect(isVoiceRoutingReady()).toBe(true)
  })
})

describe('configureNumberRouting', () => {
  const legacyRow = { id: 'pn-1', org_id: ORG, number: '+15550001111', twilio_sid: 'PN00000000000000000000000000000001', elevenlabs_phone_number_id: 'phnum_el_1' }

  it('removes the ElevenLabs import, points every webhook at the app and records the result', async () => {
    db.rows.phone_numbers = legacyRow
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    twilio.fetched = [
      { voiceApplicationSid: 'AP123', smsApplicationSid: '', trunkSid: null },
      { ...URLS, voiceMethod: 'POST', voiceApplicationSid: '', trunkSid: null, capabilities: { sms: true } },
    ]

    await expect(configureNumberRouting('pn-1')).resolves.toEqual({ ok: true })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.elevenlabs.io/v1/convai/phone-numbers/phnum_el_1')
    expect(init.method).toBe('DELETE')
    expect(twilio.updates[0]).toEqual({
      sid: legacyRow.twilio_sid,
      ...URLS,
      voiceMethod: 'POST',
      voiceFallbackMethod: 'POST',
      statusCallbackMethod: 'POST',
      smsMethod: 'POST',
      voiceApplicationSid: '',
    })
    expect(updates('phone_numbers')[0]).toMatchObject({
      routing_mode: 'app_router',
      voice_url: URLS.voiceUrl,
      sms_capable: true,
      routing_error: null,
      elevenlabs_phone_number_id: null,
    })
  })

  it('stores sms_capable from capitalised capabilities too', async () => {
    db.rows.phone_numbers = { ...legacyRow, elevenlabs_phone_number_id: null }
    twilio.fetched = [{}, { ...URLS, voiceMethod: 'POST', capabilities: { voice: true, SMS: true } }]
    await expect(configureNumberRouting('pn-1')).resolves.toEqual({ ok: true })
    expect(updates('phone_numbers')[0]).toMatchObject({ sms_capable: true })
  })

  it('stores a readable routing_error when Twilio does not keep the settings', async () => {
    db.rows.phone_numbers = { ...legacyRow, elevenlabs_phone_number_id: null }
    twilio.fetched = [{}, { ...URLS, voiceUrl: 'https://api.us.elevenlabs.io/twilio/inbound_call', voiceMethod: 'POST' }]
    const result = await configureNumberRouting('pn-1')
    expect(result.ok).toBe(false)
    expect(updates('phone_numbers')[0]).toEqual({ routing_error: 'The phone provider did not keep the new settings. Please try again.' })
  })

  it('keeps the ElevenLabs id for a retry when the import could not be removed', async () => {
    db.rows.phone_numbers = legacyRow
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
    twilio.fetched = [{}, { ...URLS, voiceMethod: 'POST', capabilities: { sms: false } }]
    await expect(configureNumberRouting('pn-1')).resolves.toEqual({ ok: true })
    expect(updates('phone_numbers')[0]).not.toHaveProperty('elevenlabs_phone_number_id')
  })

  it('reports provider errors without leaking Twilio messages', async () => {
    db.rows.phone_numbers = { ...legacyRow, elevenlabs_phone_number_id: null }
    twilio.fetched = [{}]
    twilio.updateError = { status: 401, code: 20003, message: 'Authenticate' }
    const result = await configureNumberRouting('pn-1')
    expect(result).toEqual({ ok: false, error: 'Our phone provider rejected the account credentials.' })
  })
})

describe('provisionPhoneNumber', () => {
  const input = { orgId: ORG, number: '+15550002222', country: 'US', agentId: null, stripeSubscriptionId: 'sub_1' }

  it('returns the existing row for a number the org already has, without buying', async () => {
    db.rows.phone_numbers = { id: 'pn-existing', org_id: ORG }
    await expect(provisionPhoneNumber(input)).resolves.toEqual({ id: 'pn-existing' })
    expect(twilio.created).toHaveLength(0)
  })

  it('refuses a number that belongs to another organization', async () => {
    db.rows.phone_numbers = { id: 'pn-other', org_id: 'org-2' }
    await expect(provisionPhoneNumber(input)).rejects.toThrow(/another organization/)
  })

  it('buys with the app webhooks set at creation and stores routing state', async () => {
    db.rows.agents = { id: 'agent-1' }
    await expect(provisionPhoneNumber(input)).resolves.toEqual({ id: 'new-row' })
    expect(twilio.created[0]).toEqual({
      phoneNumber: '+15550002222',
      ...URLS,
      voiceMethod: 'POST',
      voiceFallbackMethod: 'POST',
      statusCallbackMethod: 'POST',
      smsMethod: 'POST',
    })
    const insert = db.ops.find((op) => op.table === 'phone_numbers' && op.action === 'insert')?.payload
    expect(insert).toMatchObject({
      org_id: ORG,
      twilio_sid: 'PN00000000000000000000000000000002',
      number: '+15550002222',
      agent_id: 'agent-1',
      stripe_subscription_id: 'sub_1',
      routing_mode: 'app_router',
      voice_url: URLS.voiceUrl,
      sms_capable: false,
      is_active: true,
    })
    expect(insert).not.toHaveProperty('elevenlabs_phone_number_id')
  })

  it('reuses a number the Twilio account already owns instead of buying it twice', async () => {
    twilio.owned = [
      { sid: 'PNpartial', phoneNumber: '+155500022229' },
      { sid: 'PN00000000000000000000000000000009', phoneNumber: '+15550002222' },
    ]
    await provisionPhoneNumber(input)
    expect(twilio.created).toHaveLength(0)
    expect(twilio.updates[0]).toMatchObject({ sid: 'PN00000000000000000000000000000009', voiceUrl: URLS.voiceUrl })
  })

  it('releases a just-bought number when the row cannot be saved', async () => {
    db.insertResult = { data: null, error: { code: '42703', message: 'column does not exist' } }
    await expect(provisionPhoneNumber(input)).rejects.toThrow(/Could not save/)
    expect(twilio.removed).toEqual(['PN00000000000000000000000000000002'])
  })
})

describe('releasePhoneNumber', () => {
  const row = { id: 'pn-1', org_id: ORG, number: '+15550001111', twilio_sid: 'PN00000000000000000000000000000001', stripe_subscription_id: 'sub_9', elevenlabs_phone_number_id: null }

  it('releases in Twilio, cancels the subscription and deletes the row', async () => {
    db.rows.phone_numbers = row
    await expect(releasePhoneNumber({ phoneNumberId: 'pn-1', orgId: ORG, cancelSubscription: true })).resolves.toEqual({ ok: true, billingWarning: null })
    expect(twilio.removed).toEqual([row.twilio_sid])
    expect(stripe.cancelled).toEqual(['sub_9'])
    expect(db.ops.some((op) => op.table === 'phone_numbers' && op.action === 'delete')).toBe(true)
  })

  it('changes nothing when Twilio refuses, so a retry is safe', async () => {
    db.rows.phone_numbers = row
    twilio.removeError = { status: 500, code: 20500, message: 'Internal' }
    const result = await releasePhoneNumber({ phoneNumberId: 'pn-1', orgId: ORG, cancelSubscription: true })
    expect(result).toMatchObject({ ok: false, code: 'provider_error' })
    expect(stripe.cancelled).toHaveLength(0)
    expect(db.ops.some((op) => op.action === 'delete')).toBe(false)
  })

  it('continues when the number is already gone in Twilio and warns when billing could not be stopped', async () => {
    db.rows.phone_numbers = row
    twilio.removeError = { status: 404, code: 20404, message: 'Not found' }
    stripe.cancelError = { code: 'api_connection_error' }
    const result = await releasePhoneNumber({ phoneNumberId: 'pn-1', orgId: ORG, cancelSubscription: true })
    expect(result.ok).toBe(true)
    expect(result.ok && result.billingWarning).toMatch(/monthly charge/)
  })

  it('skips Stripe when the subscription is already cancelled and treats resource_missing as done', async () => {
    db.rows.phone_numbers = row
    await releasePhoneNumber({ phoneNumberId: 'pn-1', orgId: ORG, cancelSubscription: false })
    expect(stripe.cancelled).toHaveLength(0)

    stripe.cancelError = { code: 'resource_missing' }
    await expect(releasePhoneNumber({ phoneNumberId: 'pn-1', orgId: ORG, cancelSubscription: true })).resolves.toEqual({ ok: true, billingWarning: null })
  })

  it('answers not_found for another organization’s number', async () => {
    db.rows.phone_numbers = null
    await expect(releasePhoneNumber({ phoneNumberId: 'pn-1', orgId: ORG, cancelSubscription: true })).resolves.toMatchObject({ ok: false, code: 'not_found' })
  })
})
