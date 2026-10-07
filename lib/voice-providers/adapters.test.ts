import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/elevenlabs/client', () => ({
  isConfigured: vi.fn(),
  subscription: vi.fn(),
  agents: { create: vi.fn(), get: vi.fn(), update: vi.fn(), delete: vi.fn(), list: vi.fn() },
}))
vi.mock('@/lib/cartesia/client', () => ({
  isConfigured: vi.fn(),
  ping: vi.fn(),
  agents: { create: vi.fn(), get: vi.fn(), update: vi.fn(), delete: vi.fn(), list: vi.fn(), attachWebhook: vi.fn() },
  voices: { get: vi.fn(), list: vi.fn() },
}))
vi.mock('@/lib/voice-providers/platform-resources', () => ({
  tryPlatformResource: vi.fn(),
}))
vi.mock('@/lib/voice-providers/platform-tools', () => ({
  TRANSFER_TOOL_DEGRADED: { code: 'transfer_tool_unavailable', message: 'Human transfer is unavailable on calls to your app-routed numbers right now.' },
  ensurePlatformTool: vi.fn(),
  storedPlatformToolId: vi.fn(),
  invalidatePlatformToolMemo: vi.fn(),
}))
vi.mock('@/lib/elevenlabs/llm-selection', () => ({
  effectiveAgentLlm: vi.fn(),
}))

import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { tryPlatformResource } from './platform-resources'
import { ensurePlatformTool, invalidatePlatformToolMemo, storedPlatformToolId } from './platform-tools'
import { composeSystemPrompt, type ComposePromptInput } from './prompt'
import { effectiveAgentLlm, type LlmSelection } from '@/lib/elevenlabs/llm-selection'
import { cartesiaLifecycle, elevenLabsLifecycle, lifecycleFor, resetPiiRedactionMemo, resolveFallbackVoice } from './adapters'
import { ProviderError } from './errors'
import { makeAgentSpec } from '@/tests/helpers/agent-spec'

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0)

function pe(system: 'elevenlabs' | 'cartesia', code: ProviderError['code'], operation = 'op'): ProviderError {
  return new ProviderError({ system, code, operation })
}

function voice(id: string, name: string, status?: string): ct.CartesiaVoice {
  return { id, name, ...(status ? { status } : {}) }
}

function page(data: ct.CartesiaVoice[]) {
  return { data, has_more: false }
}

function selection(over: Partial<LlmSelection> = {}): LlmSelection {
  return { llm: 'gpt-5.4-mini', configured: 'gpt-5.4-mini', reason: 'ok', replacement: null, fallbackPercentage: null, providerDeprecationDate: null, reasoningEffort: null, ...over }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('CARTESIA_FALLBACK_VOICES', '')
  vi.mocked(tryPlatformResource).mockResolvedValue(null)
  vi.mocked(ensurePlatformTool).mockReset().mockResolvedValue({ key: 'elevenlabs.transfer_tool', toolId: 'tool_transfer_1', action: 'cached' })
  vi.mocked(storedPlatformToolId).mockReset().mockResolvedValue('tool_transfer_1')
  vi.mocked(invalidatePlatformToolMemo).mockReset()
  vi.mocked(effectiveAgentLlm).mockResolvedValue(selection())
  resetPiiRedactionMemo()
  vi.mocked(el.isConfigured).mockReturnValue(true)
  vi.mocked(ct.isConfigured).mockReturnValue(true)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('lifecycleFor', () => {
  it('returns the adapter for each provider', () => {
    expect(lifecycleFor('elevenlabs')).toBe(elevenLabsLifecycle)
    expect(lifecycleFor('cartesia')).toBe(cartesiaLifecycle)
    expect(elevenLabsLifecycle.provider).toBe('elevenlabs')
    expect(cartesiaLifecycle.provider).toBe('cartesia')
  })
})

describe('elevenLabsLifecycle.update: LLM reasoning effort', () => {
  it('sends the reasoning effort resolved from the LLM catalogue, and nothing when there is none', async () => {
    vi.mocked(el.agents.update).mockResolvedValue({ agent_id: 'agent_1', name: 'x', conversation_config: {} })
    vi.mocked(effectiveAgentLlm).mockResolvedValueOnce(selection({ reasoningEffort: 'minimal' }))
    await elevenLabsLifecycle.update('agent_1', makeAgentSpec())
    const sent = vi.mocked(el.agents.update).mock.calls[0][1] as { conversation_config: { agent: { prompt: Record<string, unknown> } } }
    expect(sent.conversation_config.agent.prompt.reasoning_effort).toBe('minimal')

    await elevenLabsLifecycle.update('agent_1', makeAgentSpec())
    const second = vi.mocked(el.agents.update).mock.calls[1][1] as { conversation_config: { agent: { prompt: Record<string, unknown> } } }
    expect(second.conversation_config.agent.prompt).not.toHaveProperty('reasoning_effort')
  })

  it('the config hash includes it (a newly supported level is pushed)', async () => {
    const without = await elevenLabsLifecycle.hash(makeAgentSpec())
    vi.mocked(effectiveAgentLlm).mockResolvedValueOnce(selection({ reasoningEffort: 'low' }))
    expect(await elevenLabsLifecycle.hash(makeAgentSpec())).not.toBe(without)
  })

  it('sends the LLM the catalogue check selected (platform default when the configured one is unavailable)', async () => {
    vi.mocked(el.agents.update).mockResolvedValue({ agent_id: 'agent_1', name: 'x', conversation_config: {} })
    vi.mocked(effectiveAgentLlm).mockResolvedValue(selection({ llm: 'gpt-5.4-mini', configured: 'gpt-4o', reason: 'deprecated' }))
    const res = await elevenLabsLifecycle.update('agent_1', makeAgentSpec())
    const sent = vi.mocked(el.agents.update).mock.calls[0][1] as { conversation_config: { agent: { prompt: Record<string, unknown> } } }
    expect(sent.conversation_config.agent.prompt.llm).toBe('gpt-5.4-mini')
    expect(res.details.llm).toBe('gpt-5.4-mini')
  })
})

describe('elevenLabsLifecycle.update: versioning, privacy and read-back', () => {
  const remote = (over: Record<string, unknown> = {}) => ({ agent_id: 'agent_1', name: 'x', version_id: 'v2', conversation_config: { tts: { voice_id: 'el-voice-123', model_id: 'eleven_flash_v2' } }, ...over }) as unknown as el.ELAgent

  it('describes the version with the revision and platform version, never tenant data', async () => {
    vi.mocked(el.agents.update).mockResolvedValue(remote())
    await elevenLabsLifecycle.update('agent_1', makeAgentSpec({ revision: 7 }))
    const sent = vi.mocked(el.agents.update).mock.calls[0][1] as { version_description: string }
    expect(sent.version_description).toMatch(/^ntv r7 p\d+$/)
  })

  it('applies a stricter privacy to stored conversations once, without changing the config hash', async () => {
    vi.mocked(el.agents.update).mockResolvedValue(remote())
    const spec = makeAgentSpec({ privacy: { record_audio: false, retention_days: 30 } })
    const once = await elevenLabsLifecycle.update('agent_1', spec, { applyPrivacyToExisting: true })
    const steady = await elevenLabsLifecycle.update('agent_1', spec)
    const [first, second] = vi.mocked(el.agents.update).mock.calls.map((c) => c[1] as { platform_settings: { privacy: Record<string, unknown> } })
    expect(first.platform_settings.privacy.apply_to_existing_conversations).toBe(true)
    expect(second.platform_settings.privacy.apply_to_existing_conversations).toBe(false)
    expect(once.configHash).toBe(steady.configHash)
    expect(once.details.privacy_applied).toEqual({ record_audio: false, retention_days: 30 })
    expect(once.details).toHaveProperty('privacy_retroactive_at')
    expect(steady.details).not.toHaveProperty('privacy_retroactive_at')
  })

  it('retries once without transcript redaction when the workspace rejects it, and remembers that', async () => {
    const rejected = new ProviderError({ system: 'elevenlabs', code: 'permission', operation: 'agents.update', detail: 'feature_not_available - Conversation history redaction requires an enterprise plan' })
    vi.mocked(el.agents.update).mockRejectedValueOnce(rejected).mockResolvedValue(remote())
    const res = await elevenLabsLifecycle.update('agent_1', makeAgentSpec())
    const calls = vi.mocked(el.agents.update).mock.calls.map((c) => c[1] as { platform_settings: { privacy: Record<string, unknown> } })
    expect(calls).toHaveLength(2)
    expect(calls[0].platform_settings.privacy).toHaveProperty('conversation_history_redaction')
    expect(calls[1].platform_settings.privacy).not.toHaveProperty('conversation_history_redaction')
    expect(res.details.pii_redaction).toBe('rejected')
    // Next sync on this instance: no doomed first attempt.
    await elevenLabsLifecycle.update('agent_1', makeAgentSpec())
    expect(vi.mocked(el.agents.update).mock.calls).toHaveLength(3)
    // The hash stays that of the intended body (no re-sync loop).
    expect(res.configHash).toBe(await elevenLabsLifecycle.hash(makeAgentSpec()))
  })

  it('does not retry other failures', async () => {
    vi.mocked(el.agents.update).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'validation', operation: 'agents.update', detail: 'invalid_parameters - bad voice' }))
    await expect(elevenLabsLifecycle.update('agent_1', makeAgentSpec())).rejects.toMatchObject({ code: 'validation' })
    expect(vi.mocked(el.agents.update).mock.calls).toHaveLength(1)
  })

  it('flags analysis_items and stale map keys from the PATCH response', async () => {
    vi.mocked(el.agents.update).mockResolvedValue(
      remote({
        platform_settings: { analysis_items: { items: [] }, data_collection: { caller_name: {}, old_field: {} } },
        conversation_config: { tts: {}, agent: { dynamic_variables: { dynamic_variable_placeholders: { ntv_call_id: 'unknown', removed_var: 'x' } } } },
      }),
    )
    const res = await elevenLabsLifecycle.update('agent_1', makeAgentSpec())
    expect(res.details.analysis_items_migrated).toBe(true)
    expect(res.details.stale_keys).toMatchObject({ data_collection: ['old_field'], dynamic_variable_placeholders: ['removed_var'] })
    vi.mocked(el.agents.update).mockResolvedValue(remote({ platform_settings: { analysis_items: null } }))
    expect((await elevenLabsLifecycle.update('agent_1', makeAgentSpec())).details.analysis_items_migrated).toBe(false)
  })
})

describe('elevenLabsLifecycle.delete', () => {
  it('deletes the external agent', async () => {
    vi.mocked(el.agents.delete).mockResolvedValue(undefined)
    await expect(elevenLabsLifecycle.delete('agent_1')).resolves.toBeUndefined()
    expect(el.agents.delete).toHaveBeenCalledWith('agent_1')
  })

  it('treats not_found as success (idempotent delete)', async () => {
    vi.mocked(el.agents.delete).mockRejectedValue(pe('elevenlabs', 'not_found', 'agents.delete'))
    await expect(elevenLabsLifecycle.delete('agent_gone')).resolves.toBeUndefined()
  })

  it('propagates every other failure', async () => {
    vi.mocked(el.agents.delete).mockRejectedValue(pe('elevenlabs', 'upstream', 'agents.delete'))
    await expect(elevenLabsLifecycle.delete('agent_1')).rejects.toMatchObject({ code: 'upstream' })
    vi.mocked(el.agents.delete).mockRejectedValue(new Error('boom'))
    await expect(elevenLabsLifecycle.delete('agent_1')).rejects.toThrow('boom')
  })
})

describe('cartesiaLifecycle.delete', () => {
  it('treats not_found as success and propagates other failures', async () => {
    vi.mocked(ct.agents.delete).mockRejectedValueOnce(pe('cartesia', 'not_found'))
    await expect(cartesiaLifecycle.delete('ct_gone')).resolves.toBeUndefined()
    vi.mocked(ct.agents.delete).mockRejectedValueOnce(pe('cartesia', 'auth'))
    await expect(cartesiaLifecycle.delete('ct_1')).rejects.toMatchObject({ code: 'auth' })
  })
})

describe('elevenLabsLifecycle.health', () => {
  it('reports not configured without calling the provider', async () => {
    vi.mocked(el.isConfigured).mockReturnValue(false)
    const h = await elevenLabsLifecycle.health()
    expect(h).toEqual({ provider: 'elevenlabs', configured: false, ok: false, latencyMs: null, errorCode: 'not_configured', checkedAt: new Date(NOW).toISOString() })
    expect(el.subscription).not.toHaveBeenCalled()
  })

  it('is ok when the subscription probe succeeds', async () => {
    vi.mocked(el.subscription).mockResolvedValue({ tier: 'pro' })
    const h = await elevenLabsLifecycle.health()
    expect(h).toMatchObject({ provider: 'elevenlabs', configured: true, ok: true, errorCode: null, checkedAt: new Date(NOW).toISOString() })
    expect(typeof h.latencyMs).toBe('number')
    expect(el.agents.list).not.toHaveBeenCalled()
  })

  it('falls back to an agents probe when the key cannot read /v1/user (auth)', async () => {
    vi.mocked(el.subscription).mockRejectedValue(pe('elevenlabs', 'auth', 'user.subscription'))
    vi.mocked(el.agents.list).mockResolvedValue({ agents: [] })
    const h = await elevenLabsLifecycle.health()
    expect(h).toMatchObject({ ok: true, errorCode: null })
    expect(el.agents.list).toHaveBeenCalledWith({ page_size: 1 })
  })

  it('also falls back when the key lacks the user scope (403 insufficient_permissions → permission)', async () => {
    vi.mocked(el.subscription).mockRejectedValue(pe('elevenlabs', 'permission', 'user.subscription'))
    vi.mocked(el.agents.list).mockResolvedValue({ agents: [] })
    expect(await elevenLabsLifecycle.health()).toMatchObject({ ok: true, errorCode: null })
  })

  it('fails with the probe error code when the agents probe also fails', async () => {
    vi.mocked(el.subscription).mockRejectedValue(pe('elevenlabs', 'auth'))
    vi.mocked(el.agents.list).mockRejectedValue(pe('elevenlabs', 'auth'))
    expect(await elevenLabsLifecycle.health()).toMatchObject({ configured: true, ok: false, errorCode: 'auth' })
  })

  it('reports the failure code for a provider outage without the agents probe', async () => {
    vi.mocked(el.subscription).mockRejectedValue(pe('elevenlabs', 'upstream'))
    expect(await elevenLabsLifecycle.health()).toMatchObject({ configured: true, ok: false, errorCode: 'upstream' })
    expect(el.agents.list).not.toHaveBeenCalled()
  })

  it('reports unknown for non-provider errors', async () => {
    vi.mocked(el.subscription).mockRejectedValue(new TypeError('weird'))
    expect(await elevenLabsLifecycle.health()).toMatchObject({ ok: false, errorCode: 'unknown' })
  })
})

describe('cartesiaLifecycle.health', () => {
  it('reports not configured without pinging', async () => {
    vi.mocked(ct.isConfigured).mockReturnValue(false)
    expect(await cartesiaLifecycle.health()).toMatchObject({ provider: 'cartesia', configured: false, ok: false, errorCode: 'not_configured', latencyMs: null })
    expect(ct.ping).not.toHaveBeenCalled()
  })

  it('is ok when the ping succeeds and failed with the code otherwise', async () => {
    vi.mocked(ct.ping).mockResolvedValueOnce({ data: [] })
    expect(await cartesiaLifecycle.health()).toMatchObject({ provider: 'cartesia', configured: true, ok: true, errorCode: null })
    vi.mocked(ct.ping).mockRejectedValueOnce(pe('cartesia', 'timeout'))
    expect(await cartesiaLifecycle.health()).toMatchObject({ provider: 'cartesia', configured: true, ok: false, errorCode: 'timeout' })
  })
})

describe('resolveFallbackVoice', () => {
  it('1) uses the agent’s explicit choice when the voice exists at Cartesia and is a public voice', async () => {
    vi.stubEnv('CARTESIA_FALLBACK_VOICES', JSON.stringify({ en: 'mapped-voice-en-01' }))
    vi.mocked(ct.voices.get).mockResolvedValue({ ...voice('cartesia-voice-456', 'Chosen'), is_owner: false })
    const res = await resolveFallbackVoice(makeAgentSpec({ fallbackVoiceId: 'cartesia-voice-456' }))
    expect(res).toEqual({ voiceId: 'cartesia-voice-456', source: 'agent' })
    expect(ct.voices.get).toHaveBeenCalledWith('cartesia-voice-456')
    expect(ct.voices.list).not.toHaveBeenCalled()
  })

  it('1b) ignores a stored choice that is a private (non-public, unmapped) voice and uses the platform map', async () => {
    vi.stubEnv('CARTESIA_FALLBACK_VOICES', JSON.stringify({ en: 'mapped-voice-en-01' }))
    vi.mocked(ct.voices.get).mockResolvedValue({ ...voice('private-voice-789', 'Private'), is_owner: true })
    const res = await resolveFallbackVoice(makeAgentSpec({ fallbackVoiceId: 'private-voice-789' }))
    expect(res).toEqual({ voiceId: 'mapped-voice-en-01', source: 'platform_map' })
  })

  it('2) falls through to the CARTESIA_FALLBACK_VOICES map for the agent language', async () => {
    vi.stubEnv('CARTESIA_FALLBACK_VOICES', JSON.stringify({ en: 'mapped-voice-en-01', ro: 'mapped-voice-ro-01' }))
    const res = await resolveFallbackVoice(makeAgentSpec({ fallbackVoiceId: null, language: 'ro' }))
    expect(res).toEqual({ voiceId: 'mapped-voice-ro-01', source: 'platform_map' })
    expect(ct.voices.get).not.toHaveBeenCalled()
    expect(ct.voices.list).not.toHaveBeenCalled()
  })

  it('2) uses the platform map when the explicit voice lookup returns no id', async () => {
    vi.stubEnv('CARTESIA_FALLBACK_VOICES', JSON.stringify({ en: 'mapped-voice-en-01' }))
    vi.mocked(ct.voices.get).mockResolvedValue({ id: '', name: '' })
    const res = await resolveFallbackVoice(makeAgentSpec({ fallbackVoiceId: 'cartesia-voice-456' }))
    expect(res).toEqual({ voiceId: 'mapped-voice-en-01', source: 'platform_map' })
  })

  it('2) ignores invalid map entries and invalid JSON', async () => {
    vi.stubEnv('CARTESIA_FALLBACK_VOICES', JSON.stringify({ en: 'bad id!' }))
    vi.mocked(ct.voices.list).mockResolvedValue(page([voice('auto-voice-1', 'Zoe')]))
    expect(await resolveFallbackVoice(makeAgentSpec({ fallbackVoiceId: null }))).toEqual({ voiceId: 'auto-voice-1', source: 'auto' })
    vi.stubEnv('CARTESIA_FALLBACK_VOICES', '{not json')
    expect(await resolveFallbackVoice(makeAgentSpec({ fallbackVoiceId: null }))).toEqual({ voiceId: 'auto-voice-1', source: 'auto' })
  })

  it('3) picks the first active feminine voice by name for the agent language', async () => {
    vi.mocked(ct.voices.list).mockResolvedValue(page([
      voice('v-zoe', 'Zoe'),
      voice('v-amy-inactive', 'Amy', 'deprecated'),
      voice('v-bella', 'Bella', 'active'),
      voice('v-carla', 'Carla'),
    ]))
    const res = await resolveFallbackVoice(makeAgentSpec({ fallbackVoiceId: null, language: 'en' }))
    expect(res).toEqual({ voiceId: 'v-bella', source: 'auto' })
    expect(ct.voices.list).toHaveBeenCalledTimes(1)
    expect(ct.voices.list).toHaveBeenCalledWith({ language: 'en', gender: 'feminine', limit: 20 })
  })

  it('3) tries the other gender when the preferred one has no active voice', async () => {
    vi.mocked(ct.voices.list)
      .mockResolvedValueOnce(page([voice('v-old', 'Old', 'inactive')]))
      .mockResolvedValueOnce(page([voice('v-mark', 'Mark'), voice('v-adam', 'Adam')]))
    const res = await resolveFallbackVoice(makeAgentSpec({ fallbackVoiceId: null, language: 'de' }))
    expect(res).toEqual({ voiceId: 'v-adam', source: 'auto' })
    expect(vi.mocked(ct.voices.list).mock.calls.map((c) => c[0].gender)).toEqual(['feminine', 'masculine'])
  })

  it('3) honours a preferred masculine gender first', async () => {
    vi.mocked(ct.voices.list).mockResolvedValueOnce(page([voice('v-mark', 'Mark')]))
    const res = await resolveFallbackVoice(makeAgentSpec({ fallbackVoiceId: null }), 'masculine')
    expect(res).toEqual({ voiceId: 'v-mark', source: 'auto' })
    expect(ct.voices.list).toHaveBeenCalledWith({ language: 'en', gender: 'masculine', limit: 20 })
  })

  it('throws a validation error with a safe message when the language has no voice', async () => {
    vi.mocked(ct.voices.list).mockResolvedValue(page([]))
    const err = await resolveFallbackVoice(makeAgentSpec({ fallbackVoiceId: null, language: 'xx' })).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderError)
    expect(err).toMatchObject({ system: 'cartesia', code: 'validation', safeMessage: 'No fallback voice is available for this language.' })
    expect(ct.voices.list).toHaveBeenCalledTimes(2)
  })

  it('does not silently swap the chosen voice when Cartesia is unreachable', async () => {
    vi.stubEnv('CARTESIA_FALLBACK_VOICES', JSON.stringify({ en: 'mapped-voice-en-01' }))
    vi.mocked(ct.voices.get).mockRejectedValue(pe('cartesia', 'upstream', 'voices.get'))
    await expect(resolveFallbackVoice(makeAgentSpec({ fallbackVoiceId: 'cartesia-voice-456' }))).rejects.toMatchObject({ code: 'upstream' })
  })
})

describe('findByLocalAgent', () => {
  it('ElevenLabs: lists by the agent tag and keeps only exact tag matches', async () => {
    const localId = '11111111-2222-4333-8444-555555555555'
    vi.mocked(el.agents.list).mockResolvedValue({
      agents: [
        { agent_id: 'a1', name: 'x', tags: ['ntv', `ntv-agent:${localId}`] },
        { agent_id: 'a2', name: 'y', tags: ['ntv', 'ntv-agent:other'] },
        { agent_id: 'a3', name: 'z' },
      ],
    })
    expect(await elevenLabsLifecycle.findByLocalAgent(localId)).toEqual(['a1'])
    expect(el.agents.list).toHaveBeenCalledWith({ tags: [`ntv-agent:${localId}`], page_size: 10 })
  })

  it('Cartesia: searches by marker and keeps only exact description matches', async () => {
    vi.mocked(ct.agents.list).mockResolvedValue({
      data: [
        { id: 'c1', name: 'x', description: 'ntv-agent:loc_1' },
        { id: 'c2', name: 'y', description: 'ntv-agent:loc_10' },
        { id: 'c3', name: 'z', description: null },
      ],
      has_more: false,
    })
    expect(await cartesiaLifecycle.findByLocalAgent('loc_1')).toEqual(['c1'])
    expect(ct.agents.list).toHaveBeenCalledWith({ q: 'ntv-agent:loc_1', limit: 20 })
  })
})

describe('cartesiaLifecycle.create', () => {
  it('creates the fallback agent with the resolved voice and attaches the call webhook', async () => {
    vi.stubEnv('CARTESIA_FALLBACK_VOICES', JSON.stringify({ en: 'mapped-voice-en-01' }))
    vi.mocked(tryPlatformResource).mockImplementation(async (key) => (key === 'cartesia.call_webhook' ? 'wh_1' : null))
    vi.mocked(ct.agents.create).mockResolvedValue({ id: 'ct_agent_1', name: 'x', description: null, config: {}, version_id: 'ver_1' })
    vi.mocked(ct.agents.attachWebhook).mockResolvedValue({})
    const spec = makeAgentSpec({ fallbackVoiceId: null })
    const synced = await cartesiaLifecycle.create(spec)
    expect(synced).toMatchObject({
      provider: 'cartesia',
      externalId: 'ct_agent_1',
      version: 'ver_1',
      appliedVoiceId: 'mapped-voice-en-01',
      details: { voice_source: 'platform_map', voice_id: 'mapped-voice-en-01', webhook_attached: true },
    })
    expect(synced.configHash).toMatch(/^[0-9a-f]{32}$/)
    const body = vi.mocked(ct.agents.create).mock.calls[0][0]
    expect(body.description).toBe(`ntv-agent:${spec.localAgentId}`)
    expect(body.config.audio.output.voice_id).toBe('mapped-voice-en-01')
    expect(ct.agents.attachWebhook).toHaveBeenCalledWith('ct_agent_1', 'wh_1')
  })
})

describe('elevenLabsLifecycle: platform transfer tool (slice B1)', () => {
  const TRANSFER = { enabled: true, number: '+40712345678', condition: 'Caller asks for billing', label: 'Billing' }
  const promptInput = (over: Partial<ComposePromptInput> = {}): ComposePromptInput => ({
    system_prompt: 'You answer calls for Smile Clinic.',
    language: 'en',
    transferEnabled: true,
    transferLabel: 'Billing',
    transferCondition: 'Caller asks for billing',
    callContext: 'variables',
    ...over,
  })
  const transferSpec = (over: Partial<ComposePromptInput> = {}, spec: Parameters<typeof makeAgentSpec>[0] = {}) => {
    const input = promptInput(over)
    return makeAgentSpec({ transfer: TRANSFER, appRouted: true, systemPrompt: composeSystemPrompt(input), promptInput: input, ...spec })
  }
  const promptOf = (call: unknown) => ((call as { conversation_config: { agent: { prompt: { prompt: string; tool_ids: string[]; built_in_tools: Record<string, unknown> } } } }).conversation_config.agent.prompt)
  const remote = { agent_id: 'agent_1', name: 'x', conversation_config: {} } as unknown as el.ELAgent

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(el.agents.update).mockReset().mockResolvedValue(remote)
    vi.mocked(el.agents.get).mockReset()
  })

  it('attaches the reconciled tool on app-routed agents with transfer configured', async () => {
    const res = await elevenLabsLifecycle.update('agent_1', transferSpec())
    expect(ensurePlatformTool).toHaveBeenCalledWith('elevenlabs.transfer_tool', { verify: 'cached' })
    const prompt = promptOf(vi.mocked(el.agents.update).mock.calls[0][1])
    expect(prompt.tool_ids).toEqual(['tool_transfer_1'])
    expect(prompt.prompt).toContain('Human handoff')
    expect(res.degraded).toBeNull()
    expect(res.details.app_transfer).toBe('attached')
  })

  it('a tool that cannot be obtained is not swallowed: no tool, no transfer promised, degraded result', async () => {
    vi.mocked(ensurePlatformTool).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'upstream', operation: 'tools.create' }))
    const res = await elevenLabsLifecycle.update('agent_1', transferSpec())
    const prompt = promptOf(vi.mocked(el.agents.update).mock.calls[0][1])
    expect(prompt.tool_ids).toEqual([])
    expect(prompt.prompt).not.toContain('Human handoff')
    expect(prompt.prompt).toContain('You cannot transfer calls')
    expect(res.degraded).toMatchObject({ code: 'transfer_tool_unavailable' })
    expect(res.details.app_transfer).toBe('unavailable')
    expect(console.error).toHaveBeenCalled()
  })

  it('mixed routing with the webhook tool down: native calls keep transfer_to_number, app-routed calls are not promised a transfer', async () => {
    vi.mocked(ensurePlatformTool).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_configured', operation: 'tools.ensure' }))
    await elevenLabsLifecycle.update('agent_1', transferSpec({ mixedTransferTools: true }, { hasNativeNumbers: true }))
    const prompt = promptOf(vi.mocked(el.agents.update).mock.calls[0][1])
    expect(prompt.tool_ids).toEqual([])
    expect(prompt.built_in_tools.transfer_to_number).not.toBeNull()
    expect(prompt.prompt).toContain('Human handoff')
    expect(prompt.prompt).toContain('transferring is not possible right now')
    expect(prompt.prompt).not.toContain('transfer with the transfer_to_human tool')
  })

  it('a spec without prompt inputs still gets an explicit override rule', async () => {
    vi.mocked(ensurePlatformTool).mockRejectedValue(new Error('boom'))
    await elevenLabsLifecycle.update('agent_1', makeAgentSpec({ transfer: TRANSFER, appRouted: true }))
    expect(promptOf(vi.mocked(el.agents.update).mock.calls[0][1]).prompt).toContain('transferring calls that arrive through the business line is not possible right now')
  })

  it('never obtains the tool when it is not needed (native only, transfer off, paused agent)', async () => {
    await elevenLabsLifecycle.update('agent_1', transferSpec({}, { appRouted: false, hasNativeNumbers: true }))
    await elevenLabsLifecycle.update('agent_1', transferSpec({}, { transfer: { ...TRANSFER, enabled: false } }))
    await elevenLabsLifecycle.update('agent_1', transferSpec({}, { active: false }))
    expect(ensurePlatformTool).not.toHaveBeenCalled()
    expect(storedPlatformToolId).not.toHaveBeenCalled()
  })

  it('hash() only reads the stored tool id: it never creates or reconciles a tool', async () => {
    const spec = transferSpec()
    const withTool = await elevenLabsLifecycle.hash(spec)
    expect(ensurePlatformTool).not.toHaveBeenCalled()
    expect(storedPlatformToolId).toHaveBeenCalledWith('elevenlabs.transfer_tool')
    // Same body as the write that attached the stored tool.
    const written = await elevenLabsLifecycle.update('agent_1', spec)
    expect(written.configHash).toBe(withTool)
    // No stored tool yet: the hash is that of the body without transfer (so the next sync pushes the tool).
    vi.mocked(storedPlatformToolId).mockResolvedValue(null)
    const without = await elevenLabsLifecycle.hash(spec)
    expect(without).not.toBe(withTool)
    vi.mocked(ensurePlatformTool).mockRejectedValue(new Error('down'))
    expect((await elevenLabsLifecycle.update('agent_1', spec)).configHash).toBe(without)
  })

  it('a 404 on PATCH agent while the agent exists (a referenced tool was deleted) is never treated as "agent missing"', async () => {
    vi.mocked(el.agents.update).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'agents.update' }))
    vi.mocked(el.agents.get).mockResolvedValue(remote)
    await expect(elevenLabsLifecycle.update('agent_1', transferSpec())).rejects.toMatchObject({ code: 'not_found', operation: 'agents.update_reference' })
    expect(el.agents.get).toHaveBeenCalledWith('agent_1', expect.anything())
    expect(invalidatePlatformToolMemo).toHaveBeenCalled()
  })

  it('a 404 on PATCH agent confirmed by GET is reported as the agent missing (the sync engine recreates it)', async () => {
    const original = new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'agents.update' })
    vi.mocked(el.agents.update).mockRejectedValue(original)
    vi.mocked(el.agents.get).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'agents.get' }))
    await expect(elevenLabsLifecycle.update('agent_1', transferSpec())).rejects.toBe(original)
  })

  it('an unconfirmable 404 (GET fails otherwise) is not reported as the agent missing', async () => {
    vi.mocked(el.agents.update).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'agents.update' }))
    vi.mocked(el.agents.get).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'upstream', operation: 'agents.get' }))
    await expect(elevenLabsLifecycle.update('agent_1', transferSpec())).rejects.toMatchObject({ code: 'upstream', operation: 'agents.get' })
  })

  it('a failed write with the tool attached forces a re-verification of the tool next time', async () => {
    vi.mocked(el.agents.update).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'validation', operation: 'agents.update' }))
    await expect(elevenLabsLifecycle.update('agent_1', transferSpec())).rejects.toMatchObject({ code: 'validation' })
    expect(invalidatePlatformToolMemo).toHaveBeenCalledWith('elevenlabs.transfer_tool')
  })
})
