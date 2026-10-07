// Router changes of slice C: register-call client data from the shared
// builder (recording notice on outbound greetings, opaque end-user id), the
// trial-minutes gate, and the transfer options on every human transfer
// (extension as sendDigits, warm-transfer whisper on app-routed transfers).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeCall } from '@/tests/helpers/fake-db'
import { findOne, parseXml } from '@/tests/helpers/xml'
import { RECORDING_NOTICE, UNAVAILABLE_MESSAGE } from '@/lib/voice/greetings'
import { verifyCallToken } from './tokens'

const CALL_ID = '3f2b6c1e-8a4d-4f7b-9c2e-1d5a6b7c8d9e'
const ORG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

const registerCall = vi.fn()
vi.mock('@/lib/elevenlabs/client', () => ({ twilio: { registerCall: (...a: unknown[]) => registerCall(...a) } }))
const twilioUpdate = vi.fn()
vi.mock('@/lib/twilio/client', () => ({ getTwilioClient: () => ({ calls: () => ({ update: (...a: unknown[]) => twilioUpdate(...a) }) }) }))

let callRow: Record<string, unknown> = {}
const updates: Array<Record<string, unknown>> = []
const db = fakeDb((c: FakeCall) => {
  if (c.table !== 'calls') return { data: null, error: null }
  if (c.op === 'update') {
    updates.push(c.payload as Record<string, unknown>)
    if (typeof c.filters.find(([, col]) => col === '')?.[2] === 'string') return { data: [{ id: CALL_ID }], error: null }
    return { data: null, error: null }
  }
  return { data: structuredClone(callRow), error: null }
})
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))

const ctx = {
  db,
  number: { id: 'num_1', org_id: ORG, agent_id: 'agent_1', number: '+40312345678', is_active: true, routing_mode: 'app_routed', supports_inbound: true, supports_outbound: true, cartesia_phone_number_id: null },
  org: { id: ORG, name: 'Smile Clinic', timezone: 'Europe/Bucharest', voice_fallback_enabled: true, usage: { plan: 'starter', minutes_used: 0, minutes_limit: 150 } as Record<string, unknown> },
  agent: {
    id: 'agent_1', name: 'Ana', is_active: true, language: 'ro', primary: 'elevenlabs', fallback: null, maxDurationSeconds: 900,
    transferNumber: '+40799000111', transferEnabled: true, recordingNotice: true, transferDigits: 'ww12' as string | null, transferWhisper: true,
  },
  externalIds: { elevenlabs: 'el_agent_1' },
  elevenLabsOverrides: new Set(['agent.first_message']),
  routingInput: {},
}
vi.mock('./context', () => ({
  findNumber: async () => ctx.number,
  numberById: async () => ctx.number,
  loadRoutingContext: async () => ctx,
}))
vi.mock('@/lib/voice-providers/routing', () => ({
  planRouting: () => ({ kind: 'connect', candidates: [{ provider: 'elevenlabs', role: 'primary', probe: false }], skipped: [], afterHoursContext: false }),
  outboundRoutingInput: (x: unknown) => x,
}))
vi.mock('@/lib/observability/telemetry', () => ({ emitProviderEvent: () => {}, deferBackground: () => {} }))
vi.mock('@/lib/voice-providers/circuit-registry', () => ({ peek: async () => ({ state: 'closed' }), reportOutcome: async () => {}, tripCircuit: async () => {} }))

import { handleRefer, routeInboundCall, routeOutboundConnect, transferLiveCall } from './router'

const TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://x"/></Connect></Response>'

beforeEach(() => {
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://voice.example.com')
  vi.stubEnv('VOICE_TOKEN_SECRET', 'voice-token-secret-0123456789abcdef-xyz')
  registerCall.mockReset().mockResolvedValue(TWIML)
  twilioUpdate.mockReset().mockResolvedValue({})
  updates.length = 0
  ctx.org.usage = { plan: 'starter', minutes_used: 0, minutes_limit: 150 }
  ctx.elevenLabsOverrides = new Set(['agent.first_message'])
  callRow = {
    id: CALL_ID, org_id: ORG, agent_id: 'agent_1', phone_number_id: 'num_1', direction: 'inbound', status: 'in-progress', provider: 'elevenlabs',
    from_number: '+40712345678', to_number: '+40312345678', caller_number: '+40712345678', routing: { attempts: [] }, outcome: null, twilio_call_sid: 'CA_live_1',
  }
})

type RegisterParams = { conversation_initiation_client_data: { user_id?: string; dynamic_variables: Record<string, string>; conversation_config_override?: Record<string, { first_message?: string; max_duration_seconds?: number }> } }

describe('register-call client data (shared builder)', () => {
  it('app-routed OUTBOUND: the greeting carries the recording notice the business enabled (bug: it was always off)', async () => {
    callRow = { ...callRow, direction: 'outbound', from_number: '+40312345678', to_number: '+40722222222' }
    await routeOutboundConnect(CALL_ID, { CallSid: 'CA_out_1' })
    const data = (registerCall.mock.calls[0][0] as RegisterParams).conversation_initiation_client_data
    expect(data.conversation_config_override?.agent?.first_message).toContain(RECORDING_NOTICE.ro)
    expect(data.dynamic_variables).toMatchObject({ ntv_call_direction: 'outbound', ntv_routing_mode: 'app_routed' })
  })

  it('user_id identifies the caller (opaque), never the organization', async () => {
    await routeInboundCall({ CallSid: 'CA0123', From: '+40712345678', To: '+40312345678' })
    const data = (registerCall.mock.calls[0][0] as RegisterParams).conversation_initiation_client_data
    expect(data.user_id).toMatch(/^ntvu_[0-9a-f]{32}$/)
    expect(data.user_id).not.toBe(ORG)
    expect(verifyCallToken(data.dynamic_variables.secret__ntv_call_token, 'tool')).toBe(CALL_ID)
    expect(data).not.toHaveProperty('conversation_config_override')
  })

  it('a trial call sends the duration cap only when the agent already allows that override', async () => {
    ctx.org.usage = { plan: 'trial', minutes_used: 28, minutes_limit: 30 }
    await routeInboundCall({ CallSid: 'CA0124', From: '+40712345678', To: '+40312345678' })
    expect((registerCall.mock.calls[0][0] as RegisterParams).conversation_initiation_client_data).not.toHaveProperty('conversation_config_override')
    ctx.elevenLabsOverrides = new Set(['agent.first_message', 'conversation.max_duration_seconds'])
    await routeInboundCall({ CallSid: 'CA0125', From: '+40712345678', To: '+40312345678' })
    expect((registerCall.mock.calls[1][0] as RegisterParams).conversation_initiation_client_data.conversation_config_override).toEqual({ conversation: { max_duration_seconds: 120 } })
  })

  it('a trial with no minutes left is answered with the unavailable line, without any provider', async () => {
    ctx.org.usage = { plan: 'trial', minutes_used: 30, minutes_limit: 30 }
    const twiml = await routeInboundCall({ CallSid: 'CA0126', From: '+40712345678', To: '+40312345678' })
    expect(registerCall).not.toHaveBeenCalled()
    expect(findOne(parseXml(twiml), 'Say').text).toBe(UNAVAILABLE_MESSAGE.ro)
    expect(updates.at(-1)).toMatchObject({ status: 'failed', routing_reason: 'quota_exhausted' })
  })
})

describe('human transfer options', () => {
  it('tool transfer: dials the extension and plays the whisper (signed whisper token) before bridging', async () => {
    const res = await transferLiveCall(CALL_ID, 'Wants a refund')
    expect(res.ok).toBe(true)
    const twiml = (twilioUpdate.mock.calls[0][0] as { twiml: string }).twiml
    const num = findOne(parseXml(twiml), 'Number')
    expect(num.text).toBe('+40799000111')
    expect(num.attrs.sendDigits).toBe('ww12')
    const url = new URL(num.attrs.url)
    expect(url.pathname).toBe('/api/telephony/twilio/whisper')
    expect(verifyCallToken(url.searchParams.get('t'), 'whisper')).toBe(CALL_ID)
    expect(verifyCallToken(url.searchParams.get('t'), 'dial_complete')).toBeNull()
  })

  it('no whisper and no extension when the business did not set them', async () => {
    ctx.agent.transferWhisper = false
    ctx.agent.transferDigits = null
    try {
      await transferLiveCall(CALL_ID, 'x')
      const num = findOne(parseXml((twilioUpdate.mock.calls[0][0] as { twiml: string }).twiml), 'Number')
      expect(num.attrs).toEqual({})
    } finally {
      ctx.agent.transferWhisper = true
      ctx.agent.transferDigits = 'ww12'
    }
  })

  it('Cartesia SIP REFER transfer gets the same extension and whisper', async () => {
    const twiml = await handleRefer(CALL_ID, { ReferTransferTarget: 'tel:+40799000111' })
    const num = findOne(parseXml(twiml), 'Number')
    expect(num.attrs.sendDigits).toBe('ww12')
    expect(num.attrs.url).toContain('/api/telephony/twilio/whisper?t=')
  })
})
