// Agent body changes of slice C: the conversation initiation webhook on
// agents with native numbers (and its explicit removal otherwise), the
// override allow-list, and the native transfer options.
import { describe, expect, it } from 'vitest'
import { PLATFORM_AGENT_CONFIG_VERSION, buildElevenLabsAgentBody, configHash, type PlatformResources } from './agent-config'
import { makeAgentSpec } from '@/tests/helpers/agent-spec'
import type { AgentSpec } from '@/lib/voice-providers/types'

const INITIATION = { url: 'https://voice.example.com/api/elevenlabs/initiation', secretId: 'sec_tool_key_1' }
const PLATFORM: PlatformResources = { transferToolId: 'tool_transfer_1', postCallWebhookId: 'wh_postcall_1', initiationWebhook: INITIATION }
const TRANSFER = { enabled: true, number: '+40712345678', condition: 'Caller asks for billing', label: 'Billing' }

function at(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
}
const build = (over: Partial<AgentSpec> = {}, platform: PlatformResources = PLATFORM) => buildElevenLabsAgentBody(makeAgentSpec(over), platform)

describe('conversation initiation webhook', () => {
  it('agents with native numbers fetch their per-call data from our webhook (secret header by reference)', () => {
    const body = build({ appRouted: false, hasNativeNumbers: true })
    expect(at(body, 'platform_settings.workspace_overrides.conversation_initiation_client_data_webhook')).toEqual({
      url: INITIATION.url,
      request_headers: { 'X-NTV-Tool-Key': { secret_id: 'sec_tool_key_1' } },
    })
    expect(at(body, 'platform_settings.overrides.enable_conversation_initiation_client_data_from_webhook')).toBe(true)
    // The post-call webhook block is unchanged next to it.
    expect(at(body, 'platform_settings.workspace_overrides.webhooks.post_call_webhook_id')).toBe('wh_postcall_1')
  })

  it('mixed orgs get it too; app-routed-only orgs have the flag off and no webhook key (body unchanged otherwise)', () => {
    expect(at(build({ appRouted: true, hasNativeNumbers: true }), 'platform_settings.overrides.enable_conversation_initiation_client_data_from_webhook')).toBe(true)
    const appOnly = build({ appRouted: true, hasNativeNumbers: false })
    expect(at(appOnly, 'platform_settings.workspace_overrides')).not.toHaveProperty('conversation_initiation_client_data_webhook')
    expect(at(appOnly, 'platform_settings.overrides.enable_conversation_initiation_client_data_from_webhook')).toBe(false)
  })

  it('without a configured webhook (no secret / no HTTPS URL) native agents keep the placeholders; an earlier webhook is cleared', () => {
    const body = build({ appRouted: false, hasNativeNumbers: true }, { ...PLATFORM, initiationWebhook: null })
    expect(at(body, 'platform_settings.workspace_overrides.conversation_initiation_client_data_webhook')).toBeNull()
    expect(at(body, 'platform_settings.overrides.enable_conversation_initiation_client_data_from_webhook')).toBe(false)
    const bare = build({ appRouted: false, hasNativeNumbers: true }, { transferToolId: null, postCallWebhookId: null, initiationWebhook: null })
    expect(at(bare, 'platform_settings.workspace_overrides')).toEqual({ conversation_initiation_client_data_webhook: null })
  })

  it('a paused agent keeps it (the webhook answers "unavailable")', () => {
    const body = build({ appRouted: false, hasNativeNumbers: true, active: false })
    expect(at(body, 'platform_settings.overrides.enable_conversation_initiation_client_data_from_webhook')).toBe(true)
  })

  it('never allows prompt, LLM, tool or voice overrides', () => {
    const allowed = at(build({ appRouted: false, hasNativeNumbers: true }), 'platform_settings.overrides.conversation_config_override')
    expect(allowed).toEqual({ agent: { first_message: true }, conversation: { max_duration_seconds: true } })
  })

  it('bumps the platform version so the rollout pushes it to existing agents', async () => {
    expect(PLATFORM_AGENT_CONFIG_VERSION).toBeGreaterThanOrEqual(3)
    const a = await configHash(build({ appRouted: false, hasNativeNumbers: true }))
    const b = await configHash(build({ appRouted: false, hasNativeNumbers: true }, { ...PLATFORM, initiationWebhook: { ...INITIATION, secretId: 'sec_2' } }))
    expect(a).not.toBe(b)
  })
})

describe('native transfer options', () => {
  const transfers = (over: Partial<AgentSpec['transfer']>) =>
    at(build({ appRouted: false, hasNativeNumbers: true, transfer: { ...TRANSFER, ...over } }), 'conversation_config.agent.prompt.built_in_tools.transfer_to_number.params.transfers') as Array<Record<string, unknown>>

  it('default: conference, no post-dial digits (unchanged body)', () => {
    expect(transfers({})[0]).toEqual({ transfer_destination: { type: 'phone', phone_number: '+40712345678' }, condition: 'Caller asks for billing', transfer_type: 'conference' })
  })

  it('extension → static post_dial_digits; blind transfer when chosen', () => {
    expect(transfers({ extension: 'ww123#', transfer_type: 'blind' })[0]).toMatchObject({ transfer_type: 'blind', post_dial_digits: { type: 'static', value: 'ww123#' } })
  })
})
