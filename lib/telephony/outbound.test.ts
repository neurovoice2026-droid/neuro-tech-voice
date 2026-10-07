// Outbound calls (slice C): native outcomes (success, rejection, null
// conversation id, timeout), the outbound greeting with the recording notice,
// the ring timeout, the plan-minutes pre-check and the opaque user_id.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeCall } from '@/tests/helpers/fake-db'
import { ProviderError } from '@/lib/voice-providers/errors'
import { RequestError } from '@/lib/api/http'
import { RECORDING_NOTICE } from '@/lib/voice/greetings'

const CALL_ID = '3f2b6c1e-8a4d-4f7b-9c2e-1d5a6b7c8d9e'
const ORG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

const outboundCall = vi.fn()
vi.mock('@/lib/elevenlabs/client', () => ({ twilio: { outboundCall: (...a: unknown[]) => outboundCall(...a) } }))
const twilioCreate = vi.fn()
vi.mock('@/lib/twilio/client', () => ({ isTwilioConfigured: () => true, getTwilioClient: () => ({ calls: { create: (...a: unknown[]) => twilioCreate(...a) } }) }))

let routingMode: 'native_elevenlabs' | 'app_routed' = 'native_elevenlabs'
const updates: Array<Record<string, unknown>> = []
const inserts: Array<Record<string, unknown>> = []
const db = fakeDb((c: FakeCall) => {
  if (c.table === 'phone_numbers') {
    return {
      data: [{ id: 'num_1', org_id: ORG, number: '+40312345678', is_active: true, routing_mode: routingMode, supports_inbound: true, supports_outbound: true, elevenlabs_phone_number_id: 'phnum_1', cartesia_phone_number_id: null }],
      error: null,
    }
  }
  if (c.table === 'calls' && c.op === 'insert') {
    inserts.push(c.payload as Record<string, unknown>)
    return { data: { id: CALL_ID }, error: null }
  }
  if (c.table === 'calls' && c.op === 'update') updates.push(c.payload as Record<string, unknown>)
  return { data: null, error: null }
})
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))

const ctx = {
  db,
  number: { id: 'num_1', org_id: ORG, agent_id: 'agent_1', number: '+40312345678', is_active: true, routing_mode: 'native_elevenlabs', supports_inbound: true, supports_outbound: true, cartesia_phone_number_id: null },
  org: { id: ORG, name: 'Smile Clinic', timezone: 'Europe/Bucharest', voice_fallback_enabled: true, usage: { plan: 'starter', minutes_used: 0, minutes_limit: 150 } as { plan: string; minutes_used: number; minutes_limit: number } },
  agent: { id: 'agent_1', name: 'Ana', is_active: true, language: 'ro', primary: 'elevenlabs', fallback: null, maxDurationSeconds: 900, transferNumber: null, transferEnabled: false, recordingNotice: true },
  externalIds: { elevenlabs: 'el_agent_1' },
  elevenLabsOverrides: new Set(['agent.first_message', 'conversation.max_duration_seconds']),
  routingInput: {},
}
vi.mock('./context', () => ({ loadRoutingContext: async () => ctx }))
vi.mock('@/lib/voice-providers/routing', () => ({
  planRouting: () => ({ kind: 'connect', candidates: [{ provider: 'elevenlabs', role: 'primary', probe: false }], skipped: [], afterHoursContext: false }),
  outboundRoutingInput: (x: unknown) => x,
}))

import { startOutboundCall } from './outbound'

beforeEach(() => {
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://voice.example.com')
  vi.stubEnv('VOICE_TOKEN_SECRET', 'voice-token-secret-0123456789abcdef-xyz')
  routingMode = 'native_elevenlabs'
  updates.length = 0
  inserts.length = 0
  ctx.org.usage = { plan: 'starter', minutes_used: 0, minutes_limit: 150 }
  outboundCall.mockReset().mockResolvedValue({ success: true, message: 'ok', conversation_id: 'conv_1', callSid: 'CA1' })
  twilioCreate.mockReset().mockResolvedValue({ sid: 'CA_app_1' })
})

type OutboundParams = {
  telephony_call_config: { ringing_timeout_secs: number }
  conversation_initiation_client_data: { user_id?: string; dynamic_variables: Record<string, string>; conversation_config_override?: { agent?: { first_message?: string } } }
}

describe('native outbound (POST /v1/convai/twilio/outbound-call)', () => {
  it('rings 30 s, opens with the outbound greeting carrying the recording notice, and identifies the callee (not the org)', async () => {
    const res = await startOutboundCall({ orgId: ORG, toNumber: '+40722222222', purpose: 'outbound' })
    expect(res).toEqual({ callId: CALL_ID, routingMode: 'native_elevenlabs', status: 'queued' })
    const params = outboundCall.mock.calls[0][0] as OutboundParams
    expect(params.telephony_call_config).toEqual({ ringing_timeout_secs: 30 })
    const data = params.conversation_initiation_client_data
    expect(data.conversation_config_override?.agent?.first_message).toContain(RECORDING_NOTICE.ro)
    expect(data.user_id).toMatch(/^ntvu_/)
    expect(data.user_id).not.toBe(ORG)
    expect(data.dynamic_variables).toMatchObject({ ntv_call_id: CALL_ID, ntv_routing_mode: 'native', ntv_call_direction: 'outbound' })
    expect(inserts[0].routing).toMatchObject({ mode: 'native', purpose: 'outbound' })
    expect(updates.at(-1)).toEqual({ provider_call_id: 'conv_1', elevenlabs_conversation_id: 'conv_1', twilio_call_sid: 'CA1' })
  })

  it('success=false: the row is failed with a clear reason and the user gets a 502', async () => {
    outboundCall.mockResolvedValueOnce({ success: false, message: 'Could not call +40722222222', conversation_id: null, callSid: null })
    const err = await startOutboundCall({ orgId: ORG, toNumber: '+40722222222', purpose: 'outbound' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RequestError)
    expect((err as RequestError).status).toBe(502)
    expect(updates.at(-1)).toMatchObject({ status: 'failed', lifecycle_rank: 30, failover_reason: 'elevenlabs:outbound_rejected' })
  })

  it('success with a null conversation id is not trackable: failed too', async () => {
    outboundCall.mockResolvedValueOnce({ success: true, message: 'ok', conversation_id: null, callSid: 'CA9' })
    await expect(startOutboundCall({ orgId: ORG, toNumber: '+40722222222', purpose: 'outbound' })).rejects.toBeInstanceOf(RequestError)
    expect(updates.at(-1)).toMatchObject({ status: 'failed', failover_reason: 'elevenlabs:outbound_rejected', twilio_call_sid: 'CA9' })
  })

  it('a timeout leaves the row ringing (the call may proceed) and answers "unconfirmed"', async () => {
    outboundCall.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', code: 'timeout', operation: 'twilio.outbound_call' }))
    const res = await startOutboundCall({ orgId: ORG, toNumber: '+40722222222', purpose: 'test' })
    expect(res.status).toBe('unconfirmed')
    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual({ routing: { attempts: [], purpose: 'test', mode: 'native', outbound_uncertain: true, outbound_error: 'timeout' } })
    expect(updates[0]).not.toHaveProperty('status')
  })

  it('a definite provider error marks the row failed and is rethrown', async () => {
    const e = new ProviderError({ system: 'elevenlabs', code: 'validation', operation: 'twilio.outbound_call', status: 422 })
    outboundCall.mockRejectedValueOnce(e)
    await expect(startOutboundCall({ orgId: ORG, toNumber: '+40722222222', purpose: 'outbound' })).rejects.toBe(e)
    expect(updates.at(-1)).toMatchObject({ status: 'failed', failover_reason: 'elevenlabs:outbound_failed' })
  })

  it('a trial with no minutes left places no call at all', async () => {
    ctx.org.usage = { plan: 'trial', minutes_used: 30, minutes_limit: 30 }
    const err = await startOutboundCall({ orgId: ORG, toNumber: '+40722222222', purpose: 'outbound' }).catch((x: unknown) => x)
    expect((err as RequestError).status).toBe(409)
    expect(outboundCall).not.toHaveBeenCalled()
    expect(inserts).toHaveLength(0)
  })

  it('a trial call is capped to the minutes left (override allowed by the agent)', async () => {
    ctx.org.usage = { plan: 'trial', minutes_used: 28, minutes_limit: 30 }
    await startOutboundCall({ orgId: ORG, toNumber: '+40722222222', purpose: 'outbound' })
    const data = (outboundCall.mock.calls[0][0] as { conversation_initiation_client_data: { conversation_config_override: { conversation?: { max_duration_seconds: number } } } }).conversation_initiation_client_data
    expect(data.conversation_config_override.conversation).toEqual({ max_duration_seconds: 120 })
  })
})

describe('app-routed outbound (Twilio dials)', () => {
  it('rings 30 s and limits the call to the trial minutes left', async () => {
    routingMode = 'app_routed'
    ctx.org.usage = { plan: 'trial', minutes_used: 28, minutes_limit: 30 }
    const res = await startOutboundCall({ orgId: ORG, toNumber: '+40722222222', purpose: 'outbound' })
    expect(res.routingMode).toBe('app_routed')
    const params = twilioCreate.mock.calls[0][0] as { timeout: number; timeLimit: number }
    expect(params.timeout).toBe(30)
    expect(params.timeLimit).toBe(120)
  })
})
