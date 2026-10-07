// The ntv_call_direction dynamic variable gates the voicemail_detection tool
// to outbound calls (prompt rule): every call start must carry it.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb } from '@/tests/helpers/fake-db'

const CALL_ID = '3f2b6c1e-8a4d-4f7b-9c2e-1d5a6b7c8d9e'
const ORG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

const registerCall = vi.fn()
const outboundCall = vi.fn()
vi.mock('@/lib/elevenlabs/client', () => ({
  twilio: { registerCall: (...a: unknown[]) => registerCall(...a), outboundCall: (...a: unknown[]) => outboundCall(...a) },
}))

const db = fakeDb((c) => {
  if (c.table === 'calls' && (c.op === 'insert' || c.op === 'select')) {
    return { data: { id: CALL_ID, org_id: ORG, direction: 'inbound', routing: { attempts: [] }, from_number: '+40712345678', to_number: '+40312345678' }, error: null }
  }
  if (c.table === 'phone_numbers') {
    return {
      data: [{ id: 'num_1', org_id: ORG, number: '+40312345678', is_active: true, routing_mode: 'native_elevenlabs', supports_inbound: true, supports_outbound: true, elevenlabs_phone_number_id: 'phnum_1' }],
      error: null,
    }
  }
  return { data: null, error: null }
})
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))

const routingContext = {
  db,
  number: { id: 'num_1', org_id: ORG, agent_id: 'agent_1', number: '+40312345678', is_active: true, routing_mode: 'app_routed', supports_inbound: true, supports_outbound: true, cartesia_phone_number_id: null },
  org: { id: ORG, name: 'Smile Clinic', timezone: 'Europe/Bucharest', voice_fallback_enabled: true },
  agent: { id: 'agent_1', name: 'Ana', is_active: true, language: 'ro', primary: 'elevenlabs', fallback: null, maxDurationSeconds: 900, transferNumber: null, transferEnabled: false },
  externalIds: { elevenlabs: 'el_agent_1' },
  routingInput: {},
}
vi.mock('./context', () => ({
  findNumber: async () => routingContext.number,
  numberById: async () => routingContext.number,
  loadRoutingContext: async () => routingContext,
}))
vi.mock('@/lib/voice-providers/routing', () => ({
  planRouting: () => ({ kind: 'connect', candidates: [{ provider: 'elevenlabs', role: 'primary', probe: false }], skipped: [], afterHoursContext: false }),
  outboundRoutingInput: () => ({}),
}))
vi.mock('@/lib/observability/telemetry', () => ({ emitProviderEvent: () => {}, deferBackground: () => {} }))
vi.mock('@/lib/voice-providers/circuit-registry', () => ({ peek: async () => ({ state: 'closed' }), reportOutcome: async () => {}, tripCircuit: async () => {} }))

import { routeInboundCall } from './router'
import { startOutboundCall } from './outbound'

beforeEach(() => {
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://voice.example.com')
  vi.stubEnv('VOICE_TOKEN_SECRET', 'voice-token-secret-0123456789abcdef-xyz')
  registerCall.mockReset().mockResolvedValue('<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://x"/></Connect></Response>')
  outboundCall.mockReset().mockResolvedValue({ success: true, message: 'ok', conversation_id: 'conv_1', callSid: 'CA1' })
})

describe('ntv_call_direction', () => {
  it("is 'inbound' on app-routed inbound calls (register-call client data)", async () => {
    await routeInboundCall({ CallSid: 'CA0123', From: '+40712345678', To: '+40312345678' })
    expect(registerCall).toHaveBeenCalledTimes(1)
    const params = registerCall.mock.calls[0][0] as { direction: string; conversation_initiation_client_data: { dynamic_variables: Record<string, unknown> } }
    expect(params.direction).toBe('inbound')
    expect(params.conversation_initiation_client_data.dynamic_variables.ntv_call_direction).toBe('inbound')
  })

  it("is 'outbound' on native outbound calls (outbound-call client data)", async () => {
    await startOutboundCall({ orgId: ORG, toNumber: '+40722222222', purpose: 'outbound' })
    expect(outboundCall).toHaveBeenCalledTimes(1)
    const params = outboundCall.mock.calls[0][0] as { conversation_initiation_client_data: { dynamic_variables: Record<string, unknown> } }
    expect(params.conversation_initiation_client_data.dynamic_variables.ntv_call_direction).toBe('outbound')
  })
})

describe('per-call token and routing mode (slice A2)', () => {
  it('register-call carries the signed token twice (plain for the tool body and matching, secret__ for headers) and routing app_routed', async () => {
    await routeInboundCall({ CallSid: 'CA0124', From: '+40712345678', To: '+40312345678' })
    const vars = (registerCall.mock.calls[0][0] as { conversation_initiation_client_data: { dynamic_variables: Record<string, string> } }).conversation_initiation_client_data.dynamic_variables
    expect(vars.ntv_call_token).toMatch(/^[\w-]+\.[\w-]+$/)
    expect(vars.secret__ntv_call_token).toBe(vars.ntv_call_token)
    expect(vars.ntv_routing_mode).toBe('app_routed')
  })

  it('native outbound calls carry the secret token and routing native', async () => {
    await startOutboundCall({ orgId: ORG, toNumber: '+40722222222', purpose: 'outbound' })
    const vars = (outboundCall.mock.calls[0][0] as { conversation_initiation_client_data: { dynamic_variables: Record<string, string> } }).conversation_initiation_client_data.dynamic_variables
    expect(vars.secret__ntv_call_token).toBe(vars.ntv_call_token)
    expect(vars.ntv_routing_mode).toBe('native')
  })

  it('a tenant call-limit rejection takes this call to the next path only (apology here, no fallback configured)', async () => {
    const { ProviderError } = await import('@/lib/voice-providers/errors')
    registerCall.mockRejectedValueOnce(new ProviderError({ system: 'elevenlabs', code: 'tenant_limited', operation: 'twilio.register_call', providerCode: 'daily_limit_exceeded' }))
    const twiml = await routeInboundCall({ CallSid: 'CA0125', From: '+40712345678', To: '+40312345678' })
    expect(twiml).toContain('<Say')
    expect(twiml).not.toContain('<Stream')
  })
})
