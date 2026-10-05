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

import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { tryPlatformResource } from './platform-resources'
import { cartesiaLifecycle, elevenLabsLifecycle, lifecycleFor, resolveFallbackVoice } from './adapters'
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('CARTESIA_FALLBACK_VOICES', '')
  vi.mocked(tryPlatformResource).mockResolvedValue(null)
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
  it('1) uses the agent’s explicit choice when the voice exists at Cartesia', async () => {
    vi.stubEnv('CARTESIA_FALLBACK_VOICES', JSON.stringify({ en: 'mapped-voice-en-01' }))
    vi.mocked(ct.voices.get).mockResolvedValue(voice('cartesia-voice-456', 'Chosen'))
    const res = await resolveFallbackVoice(makeAgentSpec({ fallbackVoiceId: 'cartesia-voice-456' }))
    expect(res).toEqual({ voiceId: 'cartesia-voice-456', source: 'agent' })
    expect(ct.voices.get).toHaveBeenCalledWith('cartesia-voice-456')
    expect(ct.voices.list).not.toHaveBeenCalled()
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
