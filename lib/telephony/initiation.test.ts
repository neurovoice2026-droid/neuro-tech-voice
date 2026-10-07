// Conversation initiation webhook (native inbound calls): org resolved from
// the agent only, called number checked against that org, idempotent call row
// by Twilio CallSid, real after_hours, tool token, unavailable opening for a
// paused agent or a used-up trial, placeholders on any mismatch, error or
// deadline.
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import { createLogger } from '@/lib/observability/logger'
import { PLATFORM_AGENT_CONFIG_VERSION } from '@/lib/elevenlabs/agent-config'
import { RECORDING_NOTICE, UNAVAILABLE_MESSAGE } from '@/lib/voice/greetings'
import { verifyCallToken } from './tokens'

let db: MemoryDb | { from: () => never }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))

import { handleInitiation } from './initiation'

const ORG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const OTHER = 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const OURS = '+40312345678'
const CALLER = '+40712345678'
const SID = 'CA0123456789abcdef0123456789abcdef'
const log = createLogger({ test: 'initiation' })
// Wednesday 2026-10-07 12:00 UTC (15:00 in Bucharest).
const NOON = Date.parse('2026-10-07T12:00:00Z')

const OPEN_ALL_WEEK = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => [d, { start: '00:00', end: '00:00', enabled: true }]))
const CLOSED_ALL_WEEK = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => [d, { start: '09:00', end: '17:00', enabled: false }]))

function seed(over: { agent?: Record<string, unknown>; org?: Record<string, unknown>; number?: Record<string, unknown>; calls?: Array<Record<string, unknown>>; uniqueConversation?: boolean } = {}) {
  db = memoryDb(
    {
      agent_provider_resources: [
        {
          org_id: ORG,
          agent_id: 'agent_1',
          provider: 'elevenlabs',
          external_id: 'el_agent_1',
          details: { platform_version: PLATFORM_AGENT_CONFIG_VERSION, client_overrides: { version: PLATFORM_AGENT_CONFIG_VERSION, paths: ['agent.first_message', 'conversation.max_duration_seconds'] } },
        },
        { org_id: OTHER, agent_id: 'agent_2', provider: 'elevenlabs', external_id: 'el_agent_2', details: {} },
      ],
      organizations: [
        { id: ORG, name: 'Smile Clinic', timezone: 'Europe/Bucharest', plan: 'starter', minutes_used: 0, minutes_limit: 150, ...over.org },
        { id: OTHER, name: 'Other Co', timezone: 'UTC', plan: 'starter', minutes_used: 0, minutes_limit: 150 },
      ],
      agents: [
        {
          id: 'agent_1', org_id: ORG, name: 'Ana', language: 'ro', is_active: true,
          conversation_settings: { recording_notice: true, max_call_duration_minutes: 15 },
          working_hours: OPEN_ALL_WEEK, after_hours: { enabled: true, mode: 'ai' }, dynamic_variables: { city: 'Cluj' }, metadata: {},
          ...over.agent,
        },
      ],
      phone_numbers: [
        { id: 'num_1', org_id: ORG, number: OURS, is_active: true, routing_mode: 'native_elevenlabs', supports_inbound: true, ...over.number },
        { id: 'num_2', org_id: OTHER, number: '+40312000000', is_active: true, routing_mode: 'native_elevenlabs', supports_inbound: true },
      ],
      calls: over.calls ?? [],
    },
    { unique: { calls: over.uniqueConversation ? [['twilio_call_sid'], ['elevenlabs_conversation_id']] : [['twilio_call_sid']] } },
  )
  // Real rows get uuid ids (the signed tokens only carry uuids).
  const mem = db as MemoryDb
  const from = mem.from
  mem.from = (t: string) => {
    const q = from(t)
    const insert = q.insert.bind(q)
    q.insert = (p: Record<string, unknown> | Array<Record<string, unknown>>) => insert(Array.isArray(p) ? p : { id: randomUUID(), ...p })
    return q
  }
}

const req = (over: Record<string, unknown> = {}) => ({ agent_id: 'el_agent_1', caller_id: CALLER, called_number: OURS, call_sid: SID, conversation_id: 'conv_1', ...over })
const calls = () => (db as MemoryDb).tables.calls

beforeEach(() => {
  vi.stubEnv('VOICE_TOKEN_SECRET', 'voice-token-secret-0123456789abcdef-xyz')
  seed()
})

describe('new native inbound call', () => {
  it('creates the call row and answers every variable with real values and a tool token', async () => {
    const res = await handleInitiation(req(), log, NOON)
    expect(res.outcome).toBe('created')
    expect(calls()).toHaveLength(1)
    const row = calls()[0]
    expect(row).toMatchObject({
      org_id: ORG, agent_id: 'agent_1', phone_number_id: 'num_1', twilio_call_sid: SID, elevenlabs_conversation_id: 'conv_1', provider: 'elevenlabs',
      direction: 'inbound', from_number: CALLER, to_number: OURS, status: 'ringing', routing_reason: 'primary',
    })
    expect(row.routing).toMatchObject({ mode: 'native', source: 'initiation_webhook', after_hours: false })
    const vars = res.body.dynamic_variables as Record<string, string>
    expect(res.body.type).toBe('conversation_initiation_client_data')
    expect(vars).toMatchObject({ ntv_call_id: row.id, after_hours: 'false', business_name: 'Smile Clinic', ntv_call_direction: 'inbound', ntv_routing_mode: 'native', city: 'Cluj' })
    expect(verifyCallToken(vars.secret__ntv_call_token, 'tool')).toBe(row.id)
    expect(verifyCallToken(vars.ntv_call_token, 'transfer')).toBe(row.id)
    // Inbound: the agent's own greeting (which already carries the notices).
    expect(res.body).not.toHaveProperty('conversation_config_override')
    expect(res.body).not.toHaveProperty('user_id')
  })

  it('accepts numbers without the leading +', async () => {
    const res = await handleInitiation(req({ called_number: OURS.slice(1), caller_id: CALLER.slice(1) }), log, NOON)
    expect(res.outcome).toBe('created')
    expect(calls()[0]).toMatchObject({ from_number: CALLER, to_number: OURS })
  })

  it('is idempotent by call sid: a retried delivery gets the same call id and no second row', async () => {
    const first = await handleInitiation(req(), log, NOON)
    const second = await handleInitiation(req(), log, NOON)
    expect(second.outcome).toBe('existing')
    expect(calls()).toHaveLength(1)
    expect(second.body.dynamic_variables.ntv_call_id).toBe(first.body.dynamic_variables.ntv_call_id)
    expect(second.body.dynamic_variables.ntv_routing_mode).toBe('native')
  })

  it('a row the post-call webhook created first (same conversation, no sid yet) is reused', async () => {
    const id = randomUUID()
    seed({ uniqueConversation: true, calls: [{ id, org_id: ORG, agent_id: 'agent_1', phone_number_id: 'num_1', twilio_call_sid: 'CA_from_metadata', elevenlabs_conversation_id: 'conv_1', direction: 'inbound', status: 'completed', routing: { mode: 'native' }, from_number: CALLER, to_number: OURS }] })
    const res = await handleInitiation(req(), log, NOON)
    expect(res.outcome).toBe('existing')
    expect(calls()).toHaveLength(1)
    expect(res.body.dynamic_variables.ntv_call_id).toBe(id)
  })

  it('computes after_hours from the working hours in the org time zone', async () => {
    seed({ agent: { working_hours: CLOSED_ALL_WEEK } })
    const res = await handleInitiation(req(), log, NOON)
    expect(res.body.dynamic_variables.after_hours).toBe('true')
    expect(calls()[0].routing).toMatchObject({ after_hours: true })
  })

  it('a paused agent opens with the unavailable line and a short call', async () => {
    seed({ agent: { is_active: false } })
    const res = await handleInitiation(req(), log, NOON)
    expect(res.body.conversation_config_override).toEqual({ agent: { first_message: UNAVAILABLE_MESSAGE.ro }, conversation: { max_duration_seconds: 20 } })
    expect(calls()[0]).toMatchObject({ routing_reason: 'agent_inactive' })
  })

  it('a used-up trial is refused the same way (quota_exhausted)', async () => {
    seed({ org: { plan: 'trial', minutes_used: 30, minutes_limit: 30 } })
    const res = await handleInitiation(req(), log, NOON)
    expect((res.body.conversation_config_override as { agent: { first_message: string } }).agent.first_message).toBe(UNAVAILABLE_MESSAGE.ro)
    expect(calls()[0]).toMatchObject({ routing_reason: 'quota_exhausted' })
  })

  it('a trial with minutes left is capped to them', async () => {
    seed({ org: { plan: 'trial', minutes_used: 25, minutes_limit: 30 } })
    const res = await handleInitiation(req(), log, NOON)
    expect(res.body.conversation_config_override).toEqual({ conversation: { max_duration_seconds: 300 } })
  })
})

describe('tenant isolation and mismatches', () => {
  it("a called number of ANOTHER org (spoofed request) gets placeholders, no row and no token", async () => {
    const res = await handleInitiation(req({ called_number: '+40312000000' }), log, NOON)
    expect(res.outcome).toBe('mismatch')
    expect(calls()).toHaveLength(0)
    expect(res.body.dynamic_variables).toMatchObject({ ntv_call_id: 'unknown', ntv_call_token: 'none', secret__ntv_call_token: 'none', business_name: 'Smile Clinic', city: 'Cluj' })
  })

  it('an unknown agent id gets neutral placeholders (nothing about any org)', async () => {
    const res = await handleInitiation(req({ agent_id: 'el_agent_unknown' }), log, NOON)
    expect(res.outcome).toBe('unknown_agent')
    expect(res.body.dynamic_variables).toMatchObject({ ntv_call_id: 'unknown', business_name: '' })
    expect(calls()).toHaveLength(0)
  })

  it("a call sid of another org's row is never reused", async () => {
    seed({ calls: [{ id: 'c-other', org_id: OTHER, agent_id: 'agent_2', phone_number_id: 'num_2', twilio_call_sid: SID, direction: 'inbound', status: 'ringing', routing: { mode: 'native' }, from_number: CALLER, to_number: '+40312000000', created_at: new Date(NOON).toISOString() }] })
    const res = await handleInitiation(req(), log, NOON)
    expect(res.body.dynamic_variables.ntv_call_id).not.toBe('c-other')
    expect(calls().filter((c) => c.org_id === ORG)).toHaveLength(0)
  })
})

describe('existing rows (same values back)', () => {
  it('an app-routed call (register-call triggering the webhook) keeps its router values', async () => {
    seed({
      number: { routing_mode: 'app_routed' },
      calls: [{ id: 'c-app', org_id: ORG, agent_id: 'agent_1', phone_number_id: 'num_1', twilio_call_sid: SID, direction: 'inbound', status: 'in-progress', routing: { attempts: [{ ok: true }], after_hours: true }, from_number: CALLER, to_number: OURS, elevenlabs_conversation_id: null, created_at: new Date(NOON).toISOString() }],
    })
    const res = await handleInitiation(req(), log, NOON)
    expect(res.outcome).toBe('existing')
    expect(res.body.dynamic_variables).toMatchObject({ ntv_call_id: 'c-app', ntv_routing_mode: 'app_routed', after_hours: 'true' })
    // Router rows get their conversation id from the post-call webhook, not from here.
    expect(calls()[0].elevenlabs_conversation_id).toBeNull()
  })

  it('a native OUTBOUND call (our number is the caller) gets its outbound greeting back', async () => {
    seed({ calls: [{ id: 'c-out', org_id: ORG, agent_id: 'agent_1', phone_number_id: 'num_1', twilio_call_sid: 'CA_other', direction: 'outbound', status: 'ringing', routing: { mode: 'native', purpose: 'outbound' }, from_number: OURS, to_number: '+40722222222', elevenlabs_conversation_id: null, created_at: new Date(NOON - 30_000).toISOString() }] })
    const res = await handleInitiation(req({ caller_id: OURS, called_number: '+40722222222', call_sid: 'CA_unknown_yet' }), log, NOON)
    expect(res.outcome).toBe('existing')
    expect(res.body.dynamic_variables).toMatchObject({ ntv_call_id: 'c-out', ntv_call_direction: 'outbound', ntv_routing_mode: 'native' })
    expect((res.body.conversation_config_override as { agent: { first_message: string } }).agent.first_message).toContain(RECORDING_NOTICE.ro)
    expect(calls()[0].elevenlabs_conversation_id).toBe('conv_1')
  })
})

describe('native outbound echo', () => {
  it('a webhook naming OUR number as called, right after we placed a call to the caller, reuses the outbound row', async () => {
    seed({ calls: [{ id: 'c-out2', org_id: ORG, agent_id: 'agent_1', phone_number_id: 'num_1', twilio_call_sid: null, direction: 'outbound', status: 'ringing', routing: { mode: 'native' }, from_number: OURS, to_number: CALLER, elevenlabs_conversation_id: null, created_at: new Date(NOON - 20_000).toISOString() }] })
    const res = await handleInitiation(req(), log, NOON)
    expect(res.outcome).toBe('existing')
    expect(calls()).toHaveLength(1)
    expect(res.body.dynamic_variables).toMatchObject({ ntv_call_id: 'c-out2', ntv_call_direction: 'outbound' })
  })

  it('an older outbound call to the same person does not swallow a real inbound call', async () => {
    seed({ calls: [{ id: 'c-old', org_id: ORG, agent_id: 'agent_1', phone_number_id: 'num_1', twilio_call_sid: 'CA_old', direction: 'outbound', status: 'ringing', routing: { mode: 'native' }, from_number: OURS, to_number: CALLER, elevenlabs_conversation_id: 'conv_old', created_at: new Date(NOON - 5 * 60_000).toISOString() }] })
    const res = await handleInitiation(req(), log, NOON)
    expect(res.outcome).toBe('created')
    expect(res.body.dynamic_variables.ntv_call_direction).toBe('inbound')
  })
})

describe('failure modes answer fast with placeholders', () => {
  it('a database error', async () => {
    db = { from: () => { throw new Error('db down') } }
    const res = await handleInitiation(req(), log, NOON)
    expect(res.outcome).toBe('error')
    expect(res.body.dynamic_variables.ntv_call_id).toBe('unknown')
  })

  it('the deadline', async () => {
    const hanging = { then: () => undefined }
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'is']) builder[m] = () => builder
    builder.maybeSingle = () => hanging
    db = { from: () => builder as never }
    const res = await handleInitiation(req(), log, NOON, 20)
    expect(res.outcome).toBe('deadline')
    expect(res.body.dynamic_variables.secret__ntv_call_token).toBe('none')
  })
})
