import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agent, Organization } from '@/types'
import type { CallRow, PhoneNumberRow } from './session-loader'

// ─── Fakes ────────────────────────────────────────────────────────────────────

interface Op {
  table: string
  action: 'select' | 'insert' | 'update' | 'delete'
  payload?: Record<string, unknown>
  filters: [string, string, unknown][]
}

const db = vi.hoisted(() => ({
  ops: [] as Op[],
  onCallContact: null as null | { id: string; name: string; phone: string },
  insertError: null as null | { code: string; message: string },
}))

const fixtures = vi.hoisted(() => ({
  number: null as PhoneNumberRow | null,
  numberLookupFails: false,
  existingCall: null as CallRow | null,
  callById: null as CallRow | null,
  org: null as Organization | null,
  agent: null as Agent | null,
  mode: { mode: 'cartesia_self', reason: 'credits_available', fallback: false, skipped: [] } as {
    mode: 'cartesia_self' | 'cartesia_managed' | 'elevenlabs'
    reason: string
    fallback: boolean
    skipped: { mode: string; reason: string }[]
  },
  registerTwiml: null as string | null,
  registerCalls: [] as Record<string, unknown>[],
  workflows: [] as [string, string, Record<string, unknown>][],
  notifications: [] as Record<string, unknown>[],
  modeCalls: 0,
  afterTasks: [] as (() => unknown)[],
}))

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => {
    fixtures.afterTasks.push(task)
  },
}))

vi.mock('@/lib/supabase/admin', () => {
  function from(table: string) {
    const op: Op = { table, action: 'select', filters: [] }
    const result = (single: boolean) => {
      db.ops.push(op)
      if (op.action === 'insert') {
        if (db.insertError) return { data: null, error: db.insertError }
        return { data: { ...defaultCall(), ...op.payload }, error: null }
      }
      if (op.action === 'select' && table === 'escalation_contacts') return { data: db.onCallContact, error: null }
      return { data: single ? null : [], error: null }
    }
    const b = {
      select: () => b,
      insert: (payload: Record<string, unknown>) => ((op.action = 'insert'), (op.payload = payload), b),
      update: (payload: Record<string, unknown>) => ((op.action = 'update'), (op.payload = payload), b),
      eq: (c: string, v: unknown) => (op.filters.push(['eq', c, v]), b),
      is: (c: string, v: unknown) => (op.filters.push(['is', c, v]), b),
      not: (c: string, _o: string, v: unknown) => (op.filters.push(['not', c, v]), b),
      order: () => b,
      limit: () => b,
      single: () => Promise.resolve(result(true)),
      maybeSingle: () => Promise.resolve(result(true)),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result(false)).then(resolve, reject),
    }
    return b
  }
  return { createAdminClient: () => ({ from }) }
})

vi.mock('@/lib/voice/session-loader', () => ({
  CALL_ROW_COLUMNS: 'id',
  loadPhoneNumberByNumber: async () => {
    if (fixtures.numberLookupFails) throw new Error('db down')
    return fixtures.number
  },
  loadCallByTwilioSid: async () => fixtures.existingCall,
  loadCallById: async () => fixtures.callById,
  loadOrganization: async () => fixtures.org,
  loadAgent: async () => fixtures.agent,
  buildSessionForCall: async () => ({
    call_context: 'Call context (this call only):\n- Today is Thursday',
    elevenlabs: {
      agent_id: 'el-agent',
      voice_id: 'voice-el',
      prompt: 'SYSTEM PROMPT',
      first_message: 'Hello!',
      language: 'en',
    },
  }),
}))

vi.mock('@/lib/voice/mode', () => ({
  resolvePipelineMode: async () => {
    fixtures.modeCalls++
    return fixtures.mode
  },
}))

vi.mock('@/lib/elevenlabs/register-call', () => ({
  registerElevenLabsCall: async (input: Record<string, unknown>) => {
    fixtures.registerCalls.push(input)
    return fixtures.registerTwiml
  },
}))

vi.mock('@/lib/workflows/executor', () => ({
  executeWorkflows: async (orgId: string, trigger: string, ctx: Record<string, unknown>) => {
    fixtures.workflows.push([orgId, trigger, ctx])
  },
}))

const kv = vi.hoisted(() => new Map<string, unknown>())

vi.mock('@/lib/kv', () => ({
  kvGet: async (key: string) => (kv.has(key) ? kv.get(key) : null),
  kvSet: async (key: string, value: unknown) => {
    kv.set(key, value)
  },
}))

vi.mock('@/lib/notifications', () => ({
  notifyContacts: async (input: Record<string, unknown>) => {
    fixtures.notifications.push(input)
    return { delivered: true, smsSent: 1, emailsSent: 0, failures: 0, notifiedContactIds: [], ownerFallback: false }
  },
}))

import { verifySessionToken } from '@/lib/security/signing'
import { breakerFailureKind } from '@/lib/voice/breaker'
import {
  breakerKeyForProviderError,
  handleFallbackCall,
  handleInboundCall,
  handleOutboundCall,
  handleStreamEnded,
  handleTransferStatus,
  inboundBlock,
  isWithinWorkingHours,
  markStreamStarted,
  providerErrorFacts,
  wasHandedOffToElevenLabs,
} from './router'

const SECRET = 'gateway-secret-0123456789abcdef-0123456789'
const CALL_SID = 'CA1234567890abcdef1234567890abcdef'
const ORG_ID = '11111111-1111-4111-8111-111111111111'
const AGENT_ID = '22222222-2222-4222-8222-222222222222'
const CALL_ID = '33333333-3333-4333-8333-333333333333'

const WEEKDAYS_9_TO_18 = Object.fromEntries(
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day, i) => [
    day,
    { start: '09:00', end: '18:00', enabled: i < 5 },
  ])
)

function defaultCall(): CallRow {
  return {
    id: CALL_ID,
    org_id: ORG_ID,
    agent_id: AGENT_ID,
    phone_number_id: 'pn-1',
    twilio_call_sid: CALL_SID,
    direction: 'inbound',
    is_test: false,
    caller_number: '+40712345678',
    from_number: '+40712345678',
    to_number: '+40312345678',
    status: 'in-progress',
    end_reason: null,
    outcome: null,
    pipeline_mode: 'cartesia_self',
    voice_provider: 'cartesia',
    fallback_used: false,
    fallback_reason: null,
    duration_seconds: 0,
    started_at: '2026-09-17T10:00:00.000Z',
    ended_at: null,
    recording_sid: null,
    extracted: null,
  }
}

function org(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORG_ID,
    user_id: 'u',
    name: 'Clinica Test',
    industry: null,
    website: null,
    description: null,
    logo_url: null,
    onboarding_completed: true,
    onboarding_step: 4,
    plan: 'pro',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    minutes_used: 0,
    minutes_limit: 850,
    timezone: 'Europe/Bucharest',
    trial_ends_at: null,
    billing_interval: 'month',
    usage_period_start: null,
    usage_period_end: null,
    sms_enabled: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: AGENT_ID,
    org_id: ORG_ID,
    elevenlabs_agent_id: 'el-agent',
    cartesia_agent_id: null,
    name: 'Ana',
    voice_id: null,
    voice_name: null,
    cartesia_voice_id: null,
    cartesia_voice_name: null,
    language: 'ro',
    system_prompt: null,
    first_message: null,
    is_active: true,
    working_hours: WEEKDAYS_9_TO_18,
    fallback_message: null,
    tone: 'professional',
    voice_speed: null,
    voice_emotion: null,
    keyterms: [],
    lead_fields: [],
    recording_notice: false,
    pipeline_mode_override: null,
    provider_sync: {},
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const inboundForm = { CallSid: CALL_SID, From: '+40712345678', To: '+40312345678', CallStatus: 'ringing', Direction: 'inbound' }

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com')
  vi.stubEnv('VOICE_GATEWAY_URL', 'https://gw.example.com')
  vi.stubEnv('VOICE_GATEWAY_SECRET', SECRET)
  vi.stubEnv('ELEVENLABS_API_KEY', 'el-key')
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  db.ops = []
  db.onCallContact = null
  db.insertError = null
  fixtures.number = { id: 'pn-1', org_id: ORG_ID, number: '+40312345678', agent_id: AGENT_ID, is_active: true, sms_capable: true, twilio_sid: 'PN1', country: 'RO' }
  fixtures.numberLookupFails = false
  fixtures.existingCall = null
  fixtures.callById = null
  fixtures.org = org()
  fixtures.agent = agent()
  fixtures.mode = { mode: 'cartesia_self', reason: 'credits_available', fallback: false, skipped: [] }
  fixtures.registerTwiml = null
  fixtures.registerCalls = []
  fixtures.workflows = []
  fixtures.notifications = []
  fixtures.modeCalls = 0
  fixtures.afterTasks = []
  kv.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

async function runAfterTasks() {
  for (const task of fixtures.afterTasks.splice(0)) await task()
}

function inserts(table = 'calls') {
  return db.ops.filter((op) => op.table === table && op.action === 'insert').map((op) => op.payload as Record<string, unknown>)
}

function updates(table = 'calls') {
  return db.ops.filter((op) => op.table === table && op.action === 'update').map((op) => op.payload as Record<string, unknown>)
}

// ─── Inbound ─────────────────────────────────────────────────────────────────

describe('handleInboundCall', () => {
  it('rejects calls to numbers the app does not know', async () => {
    fixtures.number = null
    const res = await handleInboundCall(inboundForm)
    expect(res.headers.get('content-type')).toContain('text/xml')
    expect(await res.text()).toContain('<Reject reason="rejected"/>')
    expect(db.ops).toHaveLength(0)
  })

  it('rejects malformed webhooks', async () => {
    expect(await (await handleInboundCall({ ...inboundForm, CallSid: 'nope' })).text()).toContain('<Reject')
    expect(await (await handleInboundCall({ ...inboundForm, To: 'anonymous' })).text()).toContain('<Reject')
  })

  it('routes to the gateway with a signed 120 s session token', async () => {
    const res = await handleInboundCall(inboundForm)
    const xml = await res.text()
    expect(xml).toContain('<Connect action="https://app.example.com/api/telephony/stream-ended?call_id=')
    expect(xml).toContain('<Stream url="wss://gw.example.com/twilio" statusCallback="https://app.example.com/api/telephony/stream-status?call_id=')
    const token = /<Parameter name="session" value="([^"]+)"\/>/.exec(xml)?.[1]
    expect(token).toBeTruthy()
    const payload = verifySessionToken(token as string, SECRET)
    const row = inserts()[0]
    expect(payload).toMatchObject({ v: 1, sid: row.id, org: ORG_ID, agt: AGENT_ID, ch: 'twilio', mode: 'cartesia_self' })
    expect((payload?.exp ?? 0) - Math.floor(Date.now() / 1000)).toBeGreaterThan(110)
    expect(row).toMatchObject({
      org_id: ORG_ID,
      agent_id: AGENT_ID,
      phone_number_id: 'pn-1',
      twilio_call_sid: CALL_SID,
      direction: 'inbound',
      status: 'in-progress',
      caller_number: '+40712345678',
      from_number: '+40712345678',
      to_number: '+40312345678',
      voice_provider: 'cartesia',
      pipeline_mode: 'cartesia_self',
      fallback_reason: null,
    })
    expect(fixtures.modeCalls).toBe(1)
  })

  it('stores the fallback reason when the router picked a lower tier', async () => {
    fixtures.mode = { mode: 'cartesia_managed', reason: 'credits_exhausted', fallback: true, skipped: [{ mode: 'cartesia_self', reason: 'credits_exhausted' }] }
    const xml = await (await handleInboundCall(inboundForm)).text()
    expect(verifySessionToken(/value="([^"]+)"/.exec(xml)?.[1] ?? '', SECRET)?.mode).toBe('cartesia_managed')
    expect(inserts()[0]).toMatchObject({ pipeline_mode: 'cartesia_managed', fallback_reason: 'credits_exhausted' })
  })

  it('answers with ElevenLabs register-call TwiML, with the call context in the prompt', async () => {
    fixtures.mode = { mode: 'elevenlabs', reason: 'gateway_not_configured', fallback: true, skipped: [] }
    fixtures.registerTwiml = '<Response><Connect><Stream url="wss://el"/></Connect></Response>'
    const xml = await (await handleInboundCall(inboundForm)).text()
    expect(xml).toBe(fixtures.registerTwiml)
    expect(inserts()[0]).toMatchObject({ voice_provider: 'elevenlabs', pipeline_mode: 'elevenlabs', fallback_reason: 'gateway_not_configured' })
    expect(fixtures.registerCalls[0]).toMatchObject({
      agentId: 'el-agent',
      from: '+40712345678',
      to: '+40312345678',
      direction: 'inbound',
      reason: 'gateway_not_configured',
      orgId: ORG_ID,
      twilioCallSid: CALL_SID,
    })
    const overrides = fixtures.registerCalls[0].overrides as { prompt: string }
    expect(overrides.prompt).toBe('SYSTEM PROMPT\n\nCall context (this call only):\n- Today is Thursday')
  })

  it('still offers ElevenLabs to callers who withhold their number', async () => {
    fixtures.mode = { mode: 'elevenlabs', reason: 'gateway_not_configured', fallback: true, skipped: [] }
    fixtures.registerTwiml = '<Response><Connect><Stream url="wss://el"/></Connect></Response>'
    const xml = await (await handleInboundCall({ ...inboundForm, From: 'anonymous' })).text()
    expect(xml).toBe(fixtures.registerTwiml)
    expect(inserts()[0]).toMatchObject({ from_number: null, caller_number: null })
    expect(fixtures.registerCalls[0]).toMatchObject({ from: 'anonymous', to: '+40312345678' })
  })

  it('apologises and hangs up when ElevenLabs cannot take the call either', async () => {
    fixtures.mode = { mode: 'elevenlabs', reason: 'gateway_breaker_open', fallback: true, skipped: [] }
    fixtures.registerTwiml = null
    const xml = await (await handleInboundCall(inboundForm)).text()
    expect(xml).toContain('<Say language="ro-RO" voice="Google.ro-RO-Standard-B">Ne pare rău, întâmpinăm o problemă tehnică.')
    expect(xml).toContain('<Hangup/>')
    expect(updates()[0]).toMatchObject({ end_reason: 'error', fallback_used: true, fallback_reason: 'elevenlabs_unavailable' })
  })

  it('plays the apology for no_provider and hands the caller to the on-call contact when allowed', async () => {
    fixtures.mode = { mode: 'elevenlabs', reason: 'no_provider', fallback: true, skipped: [] }
    db.onCallContact = { id: '44444444-4444-4444-8444-444444444444', name: 'Dana', phone: '+40799999999' }
    const xml = await (await handleInboundCall(inboundForm)).text()
    expect(inserts()[0]).toMatchObject({ pipeline_mode: null, status: 'in-progress' })
    expect(updates()[0]).toMatchObject({ end_reason: 'no_provider', fallback_reason: 'no_provider' })
    expect(xml).toContain('<Dial callerId="+40312345678" timeout="25" timeLimit="3600" action="https://app.example.com/api/telephony/transfer-status?call_id=')
    expect(xml).toContain('reason=fallback')
    expect(xml).toContain('<Number>+40799999999</Number>')
    expect(xml).not.toContain('Dana')
    expect(fixtures.registerCalls).toHaveLength(0)
  })

  it('caps the on-call fallback leg and skips an on-call number the destination policy refuses', async () => {
    fixtures.mode = { mode: 'elevenlabs', reason: 'no_provider', fallback: true, skipped: [] }
    db.onCallContact = { id: '44444444-4444-4444-8444-444444444444', name: 'Dana', phone: '+40799999999' }
    const capped = await (await handleInboundCall(inboundForm)).text()
    expect(capped).toContain('timeLimit="3600"')

    db.ops = []
    db.onCallContact = { id: '44444444-4444-4444-8444-444444444444', name: 'Dana', phone: '+40900123456' }
    const refused = await (await handleInboundCall(inboundForm)).text()
    expect(refused).not.toContain('<Dial')
    expect(refused).toContain('<Hangup/>')
  })

  it('refuses calls for an expired trial: logs a missed call, fires call_missed, never resolves a mode', async () => {
    fixtures.org = org({ plan: 'trial', trial_ends_at: '2020-01-01T00:00:00Z' })
    const xml = await (await handleInboundCall(inboundForm)).text()
    expect(xml).toContain('Ne pare rău, momentan nu putem prelua apelul dumneavoastră.')
    expect(xml).toContain('<Hangup/>')
    expect(inserts()[0]).toMatchObject({ status: 'no-answer', outcome: 'missed', end_reason: 'trial_expired' })
    expect(fixtures.modeCalls).toBe(0)
    await runAfterTasks()
    expect(fixtures.workflows).toHaveLength(1)
    expect(fixtures.workflows[0][0]).toBe(ORG_ID)
    expect(fixtures.workflows[0][1]).toBe('call_missed')
    expect(fixtures.workflows[0][2]).toMatchObject({ caller_number: '+40712345678', outcome: 'missed', direction: 'inbound' })
  })

  it('refuses paused agents and paused numbers', async () => {
    fixtures.agent = agent({ is_active: false })
    await handleInboundCall(inboundForm)
    expect(inserts()[0]).toMatchObject({ end_reason: 'agent_inactive' })

    db.ops = []
    fixtures.agent = agent()
    fixtures.number = { ...(fixtures.number as PhoneNumberRow), is_active: false }
    await handleInboundCall(inboundForm)
    expect(inserts()[0]).toMatchObject({ end_reason: 'number_inactive' })
  })

  it('answers a Twilio retry from the existing row without a second insert', async () => {
    fixtures.existingCall = { ...defaultCall(), pipeline_mode: 'cartesia_managed' }
    const xml = await (await handleInboundCall(inboundForm)).text()
    expect(inserts()).toHaveLength(0)
    expect(verifySessionToken(/value="([^"]+)"/.exec(xml)?.[1] ?? '', SECRET)).toMatchObject({ sid: CALL_ID, mode: 'cartesia_managed' })
    expect(fixtures.modeCalls).toBe(0)
  })
})

// ─── Working hours ───────────────────────────────────────────────────────────

describe('inboundBlock and working hours', () => {
  // Thursday 2026-09-17 20:30 in Bucharest (UTC+3).
  const evening = new Date('2026-09-17T17:30:00Z')
  const morning = new Date('2026-09-17T07:30:00Z')
  const number = { is_active: true }

  it('always answers by default, even outside hours', () => {
    expect(inboundBlock({ org: org(), agent: agent(), number, now: evening })).toBeNull()
  })

  it('plays the configured message outside hours when the owner chose it', () => {
    const closed = agent({ metadata: { outside_hours: { type: 'message', message: 'Suntem închiși. Reveniți mâine.', notify_email: '' } } })
    expect(inboundBlock({ org: org(), agent: closed, number, now: evening })).toEqual({
      reason: 'outside_hours',
      message: 'Suntem închiși. Reveniți mâine.',
    })
    expect(inboundBlock({ org: org(), agent: closed, number, now: morning })).toBeNull()
  })

  it('falls back to the unavailable line when the message is empty', () => {
    const closed = agent({ metadata: { outside_hours: { type: 'message', message: '  ' } } })
    expect(inboundBlock({ org: org(), agent: closed, number, now: evening })?.message).toContain('Ne pare rău')
  })

  it('evaluates hours in the org time zone, including overnight slots', () => {
    expect(isWithinWorkingHours(WEEKDAYS_9_TO_18, 'Europe/Bucharest', morning)).toBe(true)
    expect(isWithinWorkingHours(WEEKDAYS_9_TO_18, 'Europe/Bucharest', evening)).toBe(false)
    // Same instant is 13:30 in New York.
    expect(isWithinWorkingHours(WEEKDAYS_9_TO_18, 'America/New_York', evening)).toBe(true)
    // Saturday is disabled.
    expect(isWithinWorkingHours(WEEKDAYS_9_TO_18, 'Europe/Bucharest', new Date('2026-09-19T08:00:00Z'))).toBe(false)

    const nights = { ...WEEKDAYS_9_TO_18, thursday: { start: '22:00', end: '06:00', enabled: true } }
    expect(isWithinWorkingHours(nights, 'UTC', new Date('2026-09-17T23:00:00Z'))).toBe(true)
    // Friday 03:00 belongs to Thursday's overnight slot.
    expect(isWithinWorkingHours(nights, 'UTC', new Date('2026-09-18T03:00:00Z'))).toBe(true)
    expect(isWithinWorkingHours(nights, 'UTC', new Date('2026-09-17T12:00:00Z'))).toBe(false)
  })

  it('keeps the 24/7 preset (00:00 to 23:59) open during the last minute of the day', () => {
    const allDay = { start: '00:00', end: '23:59', enabled: true }
    const always = Object.fromEntries(
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => [day, allDay])
    ) as typeof WEEKDAYS_9_TO_18
    expect(isWithinWorkingHours(always, 'UTC', new Date('2026-09-17T23:59:30Z'))).toBe(true)
    expect(isWithinWorkingHours(always, 'UTC', new Date('2026-09-18T00:00:10Z'))).toBe(true)
  })

  it('treats missing or broken hours as open', () => {
    expect(isWithinWorkingHours(null, 'UTC', evening)).toBeNull()
    expect(isWithinWorkingHours({} as never, 'UTC', evening)).toBeNull()
    expect(isWithinWorkingHours(WEEKDAYS_9_TO_18, 'Not/AZone', morning)).not.toBeNull()
  })
})

// ─── Outbound ────────────────────────────────────────────────────────────────

describe('handleOutboundCall', () => {
  const outboundRow = (): CallRow => ({
    ...defaultCall(),
    direction: 'outbound',
    twilio_call_sid: null,
    pipeline_mode: null,
    from_number: '+40312345678',
    to_number: '+40711111111',
    caller_number: '+40711111111',
  })

  it('routes an answered outbound call and records the Twilio SID and mode', async () => {
    fixtures.callById = outboundRow()
    const xml = await (await handleOutboundCall(CALL_ID, { CallSid: CALL_SID, AnsweredBy: 'human' })).text()
    expect(xml).toContain('<Connect')
    expect(updates()[0]).toMatchObject({ twilio_call_sid: CALL_SID, pipeline_mode: 'cartesia_self', voice_provider: 'cartesia' })
  })

  it('hangs up on voicemail and on unknown or mismatched calls', async () => {
    fixtures.callById = outboundRow()
    expect(await (await handleOutboundCall(CALL_ID, { CallSid: CALL_SID, AnsweredBy: 'machine_start' })).text()).toContain('<Hangup/>')
    expect(updates()[0]).toMatchObject({ status: 'no-answer', end_reason: 'voicemail', outcome: 'missed' })

    fixtures.callById = { ...outboundRow(), twilio_call_sid: 'CAffffffffffffffffffffffffffffffff' }
    expect(await (await handleOutboundCall(CALL_ID, { CallSid: CALL_SID })).text()).toContain('<Hangup/>')

    fixtures.callById = null
    expect(await (await handleOutboundCall(CALL_ID, { CallSid: CALL_SID })).text()).toContain('<Hangup/>')
    expect(fixtures.modeCalls).toBe(0)
  })

  it('lets test calls through while the agent is paused, but not real ones', async () => {
    fixtures.agent = agent({ is_active: false })
    fixtures.callById = { ...outboundRow(), is_test: true }
    expect(await (await handleOutboundCall(CALL_ID, { CallSid: CALL_SID })).text()).toContain('<Connect')

    db.ops = []
    fixtures.callById = outboundRow()
    expect(await (await handleOutboundCall(CALL_ID, { CallSid: CALL_SID })).text()).toContain('<Hangup/>')
    expect(updates()[0]).toMatchObject({ status: 'failed', end_reason: 'agent_inactive' })
  })
})

// ─── Stream ended, fallback, transfer status ─────────────────────────────────

describe('handleStreamEnded', () => {
  it('returns an empty response once the caller is gone', async () => {
    fixtures.callById = defaultCall()
    const xml = await (await handleStreamEnded({ CallSid: CALL_SID, CallStatus: 'completed' }, CALL_ID)).text()
    expect(xml).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  })

  it('hangs up after a deliberate end', async () => {
    fixtures.callById = { ...defaultCall(), end_reason: 'agent_hangup' }
    expect(await (await handleStreamEnded({ CallSid: CALL_SID, CallStatus: 'in-progress' }, CALL_ID)).text()).toContain('<Hangup/>')
    expect(fixtures.registerCalls).toHaveLength(0)
  })

  it('hands a live caller to ElevenLabs when the gateway stream dropped', async () => {
    fixtures.callById = defaultCall()
    fixtures.registerTwiml = '<Response><Connect><Stream url="wss://el"/></Connect></Response>'
    const xml = await (await handleStreamEnded({ CallSid: CALL_SID, CallStatus: 'in-progress' }, CALL_ID)).text()
    expect(xml).toBe(fixtures.registerTwiml)
    expect(fixtures.registerCalls[0]).toMatchObject({ reason: 'stream_ended' })
    expect(updates().at(-1)).toMatchObject({ pipeline_mode: 'elevenlabs', voice_provider: 'elevenlabs', fallback_used: true, fallback_reason: 'stream_ended' })
    // The gateway never started, so the caller heard nothing: a normal greeting.
    const overrides = fixtures.registerCalls[0].overrides as { first_message: string; prompt: string }
    expect(overrides.first_message).toBe('Hello!')
    expect(overrides.prompt).not.toContain('Conversation so far')
    // The status callback must bill this call even if the failed leg's finalize writes error later.
    expect(await wasHandedOffToElevenLabs(CALL_ID)).toBe(true)
  })

  it('resumes the conversation instead of greeting again when the caller was already talking to the agent', async () => {
    fixtures.callById = defaultCall()
    fixtures.registerTwiml = '<Response><Connect><Stream url="wss://el"/></Connect></Response>'
    await markStreamStarted(CALL_ID)
    await handleStreamEnded({ CallSid: CALL_SID, CallStatus: 'in-progress' }, CALL_ID)
    const overrides = fixtures.registerCalls[0].overrides as { first_message: string; prompt: string }
    // Agent language is ro: the localized "sorry, I'm back" line.
    expect(overrides.first_message).toMatch(/am revenit/)
    expect(fixtures.registerCalls[0]).toMatchObject({ reason: 'stream_ended' })
  })

  it('does not mark a hand-over when ElevenLabs could not take the call', async () => {
    fixtures.callById = defaultCall()
    fixtures.registerTwiml = null
    const xml = await (await handleStreamEnded({ CallSid: CALL_SID, CallStatus: 'in-progress' }, CALL_ID)).text()
    expect(xml).toContain('<Hangup/>')
    expect(await wasHandedOffToElevenLabs(CALL_ID)).toBe(false)
    expect(updates().at(-1)).toMatchObject({ end_reason: 'error', fallback_used: true })
  })

  it('does not retry ElevenLabs when the call was already on it', async () => {
    fixtures.callById = { ...defaultCall(), pipeline_mode: 'elevenlabs' }
    const xml = await (await handleStreamEnded({ CallSid: CALL_SID, CallStatus: 'in-progress' }, CALL_ID)).text()
    expect(fixtures.registerCalls).toHaveLength(0)
    expect(xml).toContain('<Hangup/>')
  })
})

describe('handleFallbackCall', () => {
  it('connects the caller to ElevenLabs when the router never created a row', async () => {
    fixtures.registerTwiml = '<Response><Connect><Stream url="wss://el"/></Connect></Response>'
    const xml = await (await handleFallbackCall({ ...inboundForm, ErrorCode: '11200' }, null)).text()
    expect(xml).toBe(fixtures.registerTwiml)
    expect(inserts()[0]).toMatchObject({ pipeline_mode: 'elevenlabs', fallback_used: true, fallback_reason: 'voice_url_error' })
  })

  it('never throws: an internal error still apologises', async () => {
    fixtures.numberLookupFails = true
    const res = await handleFallbackCall(inboundForm, null)
    expect(res.status).toBe(200)
    const xml = await res.text()
    expect(xml).toContain('<Say language="en-US"')
    expect(xml).toContain('<Hangup/>')
  })
})

describe('handleTransferStatus', () => {
  it('hangs up after an answered transfer and marks the outcome', async () => {
    fixtures.callById = defaultCall()
    const xml = await (await handleTransferStatus({ DialCallStatus: 'completed' }, { callId: CALL_ID, contactId: null, reason: 'transfer' })).text()
    expect(xml).toContain('<Hangup/>')
    expect(updates()[0]).toMatchObject({ end_reason: 'transferred', outcome: 'transferred' })
  })

  it('logs a message for the team and tells the caller when nobody answered', async () => {
    fixtures.callById = defaultCall()
    const xml = await (await handleTransferStatus({ DialCallStatus: 'no-answer' }, { callId: CALL_ID, contactId: null, reason: 'transfer' })).text()
    expect(xml).toContain('Am transmis mesajul dumneavoastră echipei')
    expect(xml).toContain('<Hangup/>')
    expect(inserts('agent_messages')[0]).toMatchObject({
      org_id: ORG_ID,
      call_id: CALL_ID,
      caller_number: '+40712345678',
      callback_number: '+40712345678',
      urgency: 'normal',
      status: 'new',
    })
    expect(updates().at(-1)).toMatchObject({ outcome: 'message_taken' })
    await runAfterTasks()
    expect(fixtures.notifications[0]).toMatchObject({ orgId: ORG_ID, urgency: 'normal', callId: CALL_ID, contactIds: null })
    expect(String(fixtures.notifications[0].body)).toContain('call them back at +40712345678')
    expect(updates('agent_messages')[0]).toMatchObject({ status: 'notified' })
  })
})

describe('breakerKeyForProviderError', () => {
  it('maps gateway events to breaker keys', () => {
    expect(breakerKeyForProviderError({ provider: 'gateway' }, 'cartesia_self')).toBe('gateway')
    expect(breakerKeyForProviderError({ provider: 'cartesia', component: 'tts' }, 'cartesia_self')).toBe('cartesia_self')
    expect(breakerKeyForProviderError({ provider: 'openai', component: 'llm' }, 'cartesia_self')).toBe('cartesia_self')
    expect(breakerKeyForProviderError({ provider: 'cartesia', component: 'agent' }, 'cartesia_managed')).toBe('cartesia_managed')
    expect(breakerKeyForProviderError({ provider: 'cartesia' }, 'cartesia_managed')).toBe('cartesia_managed')
    expect(breakerKeyForProviderError({ provider: 'elevenlabs', component: 'tts' }, 'cartesia_self')).toBe('elevenlabs')
    expect(breakerKeyForProviderError({}, 'cartesia_self')).toBeNull()
  })
})

describe('providerErrorFacts', () => {
  it('reads a bare HTTP status as a status so config errors never trip the breaker', () => {
    expect(providerErrorFacts('404')).toEqual({ code: null, status: 404 })
    expect(breakerFailureKind(providerErrorFacts('404'), { provider: 'openai' })).toBeNull()
    expect(breakerFailureKind(providerErrorFacts('422'), { provider: 'elevenlabs' })).toBeNull()
    expect(breakerFailureKind(providerErrorFacts('401'), { provider: 'openai' })).toBe('terminal')
    expect(breakerFailureKind(providerErrorFacts('503'), { provider: 'cartesia' })).toBe('hard')
  })

  it('keeps provider codes and WebSocket close codes as codes', () => {
    expect(providerErrorFacts('voice_not_found')).toEqual({ code: 'voice_not_found' })
    expect(providerErrorFacts('1006')).toEqual({ code: '1006' })
    expect(breakerFailureKind(providerErrorFacts('1006'), { provider: 'gateway' })).toBe('hard')
    expect(providerErrorFacts('')).toEqual({ code: null })
    expect(providerErrorFacts(null)).toEqual({ code: null })
  })
})
