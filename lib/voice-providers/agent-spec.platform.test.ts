import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb } from '@/tests/helpers/memory-db'

vi.mock('server-only', () => ({}))

import { buildAgentSpec, type AgentRow } from './agent-spec'
import { buildElevenLabsAgentBody } from '@/lib/elevenlabs/agent-config'

// Platform-owned parts of the spec (slice A2): plan limits, routing modes,
// pause state, opening hours and the stripping of platform variables from
// tenant text.

const ORG = '11111111-1111-4111-8111-111111111111'
const AGENT = '22222222-2222-4222-8222-222222222222'

function agentRow(over: Partial<Record<keyof AgentRow, unknown>> = {}): AgentRow {
  return {
    id: AGENT, org_id: ORG, name: 'A', language: 'en', system_prompt: null, first_message: null, fallback_message: null, voice_id: null,
    fallback_voice_id: null, is_active: true, metadata: {}, conversation_settings: {}, transfer_settings: {}, analysis_settings: {},
    privacy_settings: {}, voice_settings: {}, dynamic_variables: {}, after_hours: {}, working_hours: {}, config_revision: 4,
    primary_provider: 'elevenlabs', fallback_provider: 'cartesia', ...over,
  } as unknown as AgentRow
}

function db(numbers: Array<{ routing_mode: string }>, plan: string | null = 'pro') {
  return memoryDb({
    organizations: [{ id: ORG, name: 'Acme', timezone: 'Europe/Bucharest', plan }],
    phone_numbers: numbers.map((n, i) => ({ id: `n${i}`, org_id: ORG, ...n })),
    knowledge_documents: [],
    knowledge_crawls: [],
  })
}

beforeEach(() => {
  for (const k of ['ELEVENLABS_CONCURRENCY_PRO', 'ELEVENLABS_DAILY_CALL_LIMIT', 'ELEVENLABS_BURSTING']) vi.stubEnv(k, '')
})

describe('buildAgentSpec — platform settings', () => {
  it('derives call limits from the org plan (unknown plan = trial)', async () => {
    expect((await buildAgentSpec(db([], 'pro') as never, agentRow())).callLimits).toEqual({ concurrency: 4, daily: 500, bursting: true })
    expect((await buildAgentSpec(db([], null) as never, agentRow())).callLimits.concurrency).toBe(2)
  })

  it('routing modes: none → app-routed; native only; mixed', async () => {
    expect(await buildAgentSpec(db([]) as never, agentRow())).toMatchObject({ appRouted: true, hasNativeNumbers: false })
    expect(await buildAgentSpec(db([{ routing_mode: 'native_elevenlabs' }]) as never, agentRow())).toMatchObject({ appRouted: false, hasNativeNumbers: true })
    const mixed = await buildAgentSpec(db([{ routing_mode: 'native_elevenlabs' }, { routing_mode: 'app_routed' }]) as never, agentRow({ transfer_settings: { enabled: true, number: '+40712345678', condition: 'Billing questions', label: 'Desk' } }))
    expect(mixed).toMatchObject({ appRouted: true, hasNativeNumbers: true })
    // Both tools, and the prompt routes between them; the condition reaches the prompt.
    expect(mixed.systemPrompt).toContain('{{ntv_routing_mode}}')
    expect(mixed.systemPrompt).toContain('this business condition applies: "Billing questions"')
    expect(mixed.fallbackSystemPrompt).toContain('"Billing questions"')
    expect(mixed.fallbackSystemPrompt).not.toContain('ntv_routing_mode')
  })

  it('carries the pause state', async () => {
    expect((await buildAgentSpec(db([]) as never, agentRow({ is_active: false }))).active).toBe(false)
    expect((await buildAgentSpec(db([]) as never, agentRow())).active).toBe(true)
  })

  it('opening hours (after-hours rule on) reach the prompt and make the native placeholder "unknown"', async () => {
    const spec = await buildAgentSpec(
      db([{ routing_mode: 'native_elevenlabs' }]) as never,
      agentRow({ after_hours: { enabled: true, mode: 'message' }, working_hours: { monday: { start: '09:00', end: '17:00', enabled: true } } }),
    )
    expect(spec.openingHours).toContain('Monday 09:00-17:00')
    expect(spec.systemPrompt).toContain('If {{after_hours}} is "unknown"')
    const body = buildElevenLabsAgentBody(spec, { transferToolId: null, postCallWebhookId: null })
    const vars = (body.conversation_config.agent as { dynamic_variables: { dynamic_variable_placeholders: Record<string, string> } }).dynamic_variables.dynamic_variable_placeholders
    expect(vars.after_hours).toBe('unknown')
  })

  it('strips platform variables from tenant text stored before the API rejected them', async () => {
    const spec = await buildAgentSpec(
      db([]) as never,
      agentRow({
        system_prompt: 'Be nice. Token: {{ntv_call_token}} {{ secret__ntv_call_token }} History: {{system__conversation_history}} Time: {{system__time}}',
        first_message: 'Hello {{ntv_call_id}}',
        fallback_message: 'Sorry {{system__conversation_id}}',
        conversation_settings: { voicemail_message: 'Call {{ntv_call_token}} back' },
        dynamic_variables: { city: 'Cluj', leak: '{{ntv_call_token}}' },
      }),
    )
    for (const text of [spec.systemPrompt, spec.fallbackSystemPrompt, spec.firstMessage, JSON.stringify(spec.dynamicVariables), String(spec.conversation.voicemail_message)]) {
      expect(text).not.toMatch(/ntv_call_token|ntv_call_id|secret__|system__conversation/)
    }
    expect(spec.systemPrompt).toContain('{{system__time}}')
    expect(spec.dynamicVariables).toEqual({ city: 'Cluj' })
  })
})
