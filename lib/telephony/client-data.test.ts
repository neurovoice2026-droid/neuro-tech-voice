// The shared conversation_initiation_client_data builder (register-call,
// native outbound-call, initiation webhook), the plan-minutes allowance and
// the override allow-list in force at the provider.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildClientData, conversationOverride, endUserId, platformVariables, UNAVAILABLE_MAX_DURATION_S, type ClientDataInput } from './client-data'
import { callAllowance, MIN_CAPPED_CALL_SECONDS } from './quota'
import { verifyCallToken } from './tokens'
import { allowedOverridePaths, clientOverridesDetail, overridesInForce, OVERRIDE_FIRST_MESSAGE, OVERRIDE_MAX_DURATION } from '@/lib/elevenlabs/client-overrides'
import { PLATFORM_AGENT_CONFIG_VERSION, buildElevenLabsAgentBody } from '@/lib/elevenlabs/agent-config'
import { makeAgentSpec } from '@/tests/helpers/agent-spec'
import { AI_DISCLOSURE, RECORDING_NOTICE, UNAVAILABLE_MESSAGE } from '@/lib/voice/greetings'

const CALL_ID = '3f2b6c1e-8a4d-4f7b-9c2e-1d5a6b7c8d9e'
const ORG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const BOTH = new Set([OVERRIDE_FIRST_MESSAGE, OVERRIDE_MAX_DURATION])

function input(over: Partial<ClientDataInput> = {}): ClientDataInput {
  return {
    callId: CALL_ID,
    orgId: ORG,
    direction: 'inbound',
    routingMode: 'native',
    afterHours: false,
    businessName: 'Smile Clinic',
    agent: { name: 'Ana', language: 'ro', recordingNotice: false, maxDurationSeconds: 900 },
    endUserNumber: '+40712345678',
    ...over,
  }
}

beforeEach(() => {
  vi.stubEnv('VOICE_TOKEN_SECRET', 'voice-token-secret-0123456789abcdef-xyz')
})

describe('platform variables', () => {
  it('carries every platform variable with real values and two distinct signed tokens', () => {
    const vars = platformVariables(input({ afterHours: true, direction: 'outbound', routingMode: 'app_routed' }))
    expect(vars).toMatchObject({ ntv_call_id: CALL_ID, after_hours: 'true', business_name: 'Smile Clinic', ntv_call_direction: 'outbound', ntv_routing_mode: 'app_routed' })
    expect(verifyCallToken(vars.ntv_call_token, 'transfer')).toBe(CALL_ID)
    expect(verifyCallToken(vars.secret__ntv_call_token, 'tool')).toBe(CALL_ID)
    expect(verifyCallToken(vars.ntv_call_token, 'tool')).toBeNull()
  })

  it('without a call row: the placeholders, never a token', () => {
    const vars = platformVariables(input({ callId: null }))
    expect(vars.ntv_call_id).toBe('unknown')
    expect(vars.ntv_call_token).toBe('none')
    expect(vars.secret__ntv_call_token).toBe('none')
  })

  it('tenant variables come first and can never override a platform key', () => {
    const data = buildClientData(input({ tenantVariables: { city: 'Cluj', ntv_call_id: 'spoofed', after_hours: 'true' } }))
    expect(data.dynamic_variables).toMatchObject({ city: 'Cluj', ntv_call_id: CALL_ID, after_hours: 'false' })
  })
})

describe('user_id (the end caller, never the organization)', () => {
  it('is an opaque per-organization id of the other party', () => {
    const id = endUserId(ORG, '+40712345678')
    expect(id).toMatch(/^ntvu_[0-9a-f]{32}$/)
    expect(id).not.toContain('712345678')
    expect(endUserId(ORG, '+40 712 345 678')).toBe(id)
    expect(endUserId('bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee', '+40712345678')).not.toBe(id)
    expect(buildClientData(input()).user_id).toBe(id)
    expect(buildClientData(input()).user_id).not.toBe(ORG)
  })

  it('is left out for an anonymous caller', () => {
    expect(endUserId(ORG, 'anonymous')).toBeNull()
    expect(buildClientData(input({ endUserNumber: null }))).not.toHaveProperty('user_id')
  })
})

describe('conversation_config_override', () => {
  it('inbound calls keep the agent greeting (no override)', () => {
    expect(conversationOverride(input())).toBeNull()
    expect(buildClientData(input())).not.toHaveProperty('conversation_config_override')
  })

  it('outbound calls open with the outbound greeting, the AI disclosure and the recording notice when enabled', () => {
    const on = conversationOverride(input({ direction: 'outbound', agent: { name: 'Ana', language: 'ro', recordingNotice: true, maxDurationSeconds: 900 } }))
    const first = (on?.agent as { first_message: string }).first_message
    expect(first).toContain('Smile Clinic')
    expect(first).toContain(RECORDING_NOTICE.ro)
    const off = (conversationOverride(input({ direction: 'outbound' }))?.agent as { first_message: string }).first_message
    expect(off).not.toContain(RECORDING_NOTICE.ro)
    // The outbound greeting already discloses the AI in its own words.
    expect(off.toLowerCase()).toMatch(/inteligen/)
    expect(AI_DISCLOSURE.ro).toBeTruthy()
  })

  it('a refused call opens with the unavailable line and is cut short, where allowed', () => {
    expect(conversationOverride(input({ unavailable: true, allowedOverrides: BOTH }))).toEqual({
      agent: { first_message: UNAVAILABLE_MESSAGE.ro },
      conversation: { max_duration_seconds: UNAVAILABLE_MAX_DURATION_S },
    })
    // An agent still on the previous allow-list: first message only.
    expect(conversationOverride(input({ unavailable: true }))).toEqual({ agent: { first_message: UNAVAILABLE_MESSAGE.ro } })
  })

  it('caps a trial call to the minutes left, only when shorter than the agent limit and allowed', () => {
    expect(conversationOverride(input({ capSeconds: 120, allowedOverrides: BOTH }))).toEqual({ conversation: { max_duration_seconds: 120 } })
    expect(conversationOverride(input({ capSeconds: 120 }))).toBeNull()
    expect(conversationOverride(input({ capSeconds: 5000, allowedOverrides: BOTH }))).toBeNull()
    expect(conversationOverride(input({ capSeconds: null, allowedOverrides: BOTH }))).toBeNull()
  })

  it('never overrides anything outside the allow-list', () => {
    const o = conversationOverride(input({ direction: 'outbound', capSeconds: 60, allowedOverrides: new Set() }))
    expect(o).toBeNull()
  })
})

describe('plan minutes', () => {
  it('paid plans (overage) are never refused or capped', () => {
    expect(callAllowance({ plan: 'starter', minutes_used: 999, minutes_limit: 150 })).toEqual({ allowed: true, capSeconds: null })
  })

  it('a trial is capped to the minutes left and refused once they are used', () => {
    expect(callAllowance({ plan: 'trial', minutes_used: 10, minutes_limit: 30 })).toEqual({ allowed: true, capSeconds: 1200 })
    expect(callAllowance({ plan: 'trial', minutes_used: 29.5, minutes_limit: 30 })).toEqual({ allowed: true, capSeconds: MIN_CAPPED_CALL_SECONDS })
    expect(callAllowance({ plan: 'trial', minutes_used: 30, minutes_limit: 30 })).toEqual({ allowed: false, capSeconds: 0 })
  })

  it('fails open on unknown plans, missing limits and when turned off', () => {
    expect(callAllowance({ plan: 'free', minutes_used: 99, minutes_limit: 10 }).allowed).toBe(true)
    expect(callAllowance({ plan: 'trial', minutes_used: 99, minutes_limit: null }).allowed).toBe(true)
    expect(callAllowance(null).allowed).toBe(true)
    vi.stubEnv('VOICE_TRIAL_MINUTES_ENFORCED', 'false')
    expect(callAllowance({ plan: 'trial', minutes_used: 30, minutes_limit: 30 }).allowed).toBe(true)
  })
})

describe('override allow-list in force', () => {
  it('reads the paths from the body the sync pushed', () => {
    const body = buildElevenLabsAgentBody(makeAgentSpec(), { transferToolId: null, postCallWebhookId: null })
    expect(allowedOverridePaths(body)).toEqual([OVERRIDE_FIRST_MESSAGE, OVERRIDE_MAX_DURATION, 'conversation.text_only'])
    expect(clientOverridesDetail(body)).toEqual({ version: PLATFORM_AGENT_CONFIG_VERSION, paths: [OVERRIDE_FIRST_MESSAGE, OVERRIDE_MAX_DURATION, 'conversation.text_only'] })
  })

  it('trusts the stored paths only while they match the platform version of the last sync', () => {
    const detail = { version: PLATFORM_AGENT_CONFIG_VERSION, paths: [OVERRIDE_FIRST_MESSAGE, OVERRIDE_MAX_DURATION] }
    expect(overridesInForce({ platform_version: PLATFORM_AGENT_CONFIG_VERSION, client_overrides: detail })).toEqual(BOTH)
    // An older deployment re-synced the agent (platform_version moved, this key did not).
    expect(overridesInForce({ platform_version: PLATFORM_AGENT_CONFIG_VERSION - 1, client_overrides: detail })).toEqual(new Set([OVERRIDE_FIRST_MESSAGE]))
    expect(overridesInForce({ platform_version: 2 })).toEqual(new Set([OVERRIDE_FIRST_MESSAGE]))
    expect(overridesInForce(null)).toEqual(new Set([OVERRIDE_FIRST_MESSAGE]))
  })
})
