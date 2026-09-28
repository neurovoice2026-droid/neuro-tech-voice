import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agent } from '@/types'
import type { CartesiaTool } from '@/lib/cartesia/types'
import { RECORDING_NOTICE, mentionsAiDisclosure } from '@/lib/voice/greetings'
import { TOOL_DEFINITIONS, toCartesiaClientTool, type ToolCapabilities } from '@/lib/voice/tools/definitions'
import { DEFAULT_CARTESIA_VOICES } from '@/lib/voice/voice-map'
import type { AgentSyncContext, SyncOrg } from './context'

const kvStore = vi.hoisted(() => new Map<string, unknown>())
vi.mock('@/lib/kv', () => ({
  kvGet: async (key: string) => (kvStore.has(key) ? kvStore.get(key) : null),
  kvSet: async (key: string, value: unknown) => {
    kvStore.set(key, value)
  },
  kvDel: async (key: string) => {
    kvStore.delete(key)
  },
  kvIncr: async (key: string) => {
    const next = ((kvStore.get(key) as number | undefined) ?? 0) + 1
    kvStore.set(key, next)
    return next
  },
}))

const api = vi.hoisted(() => ({
  toolsList: vi.fn(),
  toolsCreate: vi.fn(),
  toolsUpdate: vi.fn(),
  models: vi.fn(),
  agentsList: vi.fn(),
  agentsCreate: vi.fn(),
  agentsUpdate: vi.fn(),
  voicesGet: vi.fn(),
}))

vi.mock('@/lib/cartesia/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cartesia/client')>()
  return {
    ...actual,
    cartesia: {
      ...actual.cartesia,
      voices: { ...actual.cartesia.voices, get: api.voicesGet },
      agents: {
        ...actual.cartesia.agents,
        list: api.agentsList,
        create: api.agentsCreate,
        update: api.agentsUpdate,
        models: api.models,
        tools: { ...actual.cartesia.agents.tools, list: api.toolsList, create: api.toolsCreate, update: api.toolsUpdate },
      },
    },
  }
})

const {
  MANAGED_TOOL_NAMES,
  buildCartesiaAgentConfig,
  cartesiaSyncHash,
  clientToolDiffers,
  describeCartesiaSyncError,
  ensureClientTools,
  managedModeNote,
  syncCartesiaAgent,
} = await import('./cartesia-agent')
const { CartesiaError } = await import('@/lib/cartesia/client')

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    org_id: '22222222-2222-4222-8222-222222222222',
    elevenlabs_agent_id: null,
    cartesia_agent_id: null,
    name: 'Mara',
    voice_id: null,
    voice_name: null,
    cartesia_voice_id: 'voice-custom-1',
    cartesia_voice_name: 'Nova',
    language: 'en',
    system_prompt: 'You answer calls for a dental clinic.',
    first_message: null,
    is_active: true,
    working_hours: {},
    fallback_message: null,
    tone: 'friendly',
    voice_speed: null,
    voice_emotion: null,
    keyterms: ['Zenith Dental', ' zenith dental ', 'Invisalign'],
    lead_fields: [],
    recording_notice: false,
    pipeline_mode_override: null,
    provider_sync: {},
    metadata: {},
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

const ORG: SyncOrg = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Zenith Dental',
  timezone: 'Europe/Bucharest',
  plan: 'starter',
  sms_enabled: true,
  onboarding_completed: true,
}

const NO_TOOLS: ToolCapabilities = { calendar: false, knowledge: false, sms: false, transfer: false, take_message: false, waitlist: false, lead_fields: false }

function ctx(capabilities: Partial<ToolCapabilities> = {}): AgentSyncContext {
  return { capabilities: { ...NO_TOOLS, ...capabilities }, services: [], contactsSummary: null }
}

function allToolIds(): Record<string, string> {
  return Object.fromEntries(MANAGED_TOOL_NAMES.map((name) => [name, `agent_tool_${name}`]))
}

beforeEach(() => {
  kvStore.clear()
  for (const fn of Object.values(api)) fn.mockReset()
  vi.stubEnv('CARTESIA_API_KEY', 'sk_car_test')
  vi.stubEnv('CARTESIA_AGENT_MODEL', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('buildCartesiaAgentConfig', () => {
  it('builds the documented create body', () => {
    const body = buildCartesiaAgentConfig(agent(), ORG, ctx({ knowledge: true, take_message: true }), {
      toolIds: allToolIds(),
      fixedTemperature: false,
    })
    expect(body.name).toBe('Zenith Dental - Mara')
    expect(body.description).toBe(`org:${ORG.id} agent:${agent().id}`)
    expect(body.config.model).toEqual({ id: 'gpt-5.6-luna', max_output_tokens: 400, temperature: null })
    expect(body.config.language).toEqual({ primary: 'en' })
    expect(body.config.timezone).toBe('Europe/Bucharest')
    expect(body.config.audio?.input).toEqual({ noise_suppression: 'auto', keyterms: ['Zenith Dental', 'Invisalign'] })
    // Cartesia expands {{variables}} in keyterms (docs F7): braces from a pasted template are broken up.
    const braces = buildCartesiaAgentConfig(agent({ keyterms: ['{{Brand}}', 'Zenith'] }), ORG, ctx(), { toolIds: allToolIds() })
    expect(braces.config.audio?.input?.keyterms).toEqual(['{ {Brand} }', 'Zenith'])
    expect(body.config.audio?.output).toMatchObject({
      voice_id: 'voice-custom-1',
      volume: null,
      pronunciation_dictionary_id: null,
      background_sound: null,
    })
    // Transfers run through our client tool, so Cartesia's own transfer stays off.
    expect(body.config.system_tools).toEqual({ end_call: {}, send_dtmf: null, transfer_to_number: null })
  })

  it('references only the enabled tools, in definition order, never end_call', () => {
    const body = buildCartesiaAgentConfig(agent(), ORG, ctx({ knowledge: true, take_message: true, transfer: true }), {
      toolIds: allToolIds(),
    })
    expect(body.config.tools).toEqual([
      { id: 'agent_tool_get_call_context' },
      { id: 'agent_tool_search_knowledge' },
      { id: 'agent_tool_take_message' },
      { id: 'agent_tool_notify_team' },
      { id: 'agent_tool_transfer_call' },
    ])
    expect(body.config.instructions).toContain('search_knowledge')
    expect(body.config.instructions).not.toContain('check_availability')
  })

  it('refuses to drop a tool whose id is unknown', () => {
    expect(() =>
      buildCartesiaAgentConfig(agent(), ORG, ctx({ knowledge: true }), { toolIds: { get_call_context: 'agent_tool_x' } })
    ).toThrow(/search_knowledge/)
  })

  it('appends the managed-mode note with the ntv_ prefix and the call-context instruction', () => {
    const body = buildCartesiaAgentConfig(agent(), ORG, ctx({ knowledge: true }), { toolIds: allToolIds() })
    expect(body.config.instructions).toContain('# Phone system notes')
    expect(body.config.instructions).toContain('search_knowledge means the tool ntv_search_knowledge')
    expect(body.config.instructions).toContain('Call ntv_get_call_context at the start of the call')
    expect(managedModeNote(['get_call_context'])).toContain('get_call_context means the tool ntv_get_call_context')
  })

  it('opens with the AI disclosure, and the recording notice when calls are recorded on the plan', () => {
    const starter = buildCartesiaAgentConfig(agent(), ORG, ctx(), { toolIds: allToolIds() })
    expect(mentionsAiDisclosure(starter.config.initial_message ?? '')).toBe(true)
    expect(starter.config.initial_message).not.toContain(RECORDING_NOTICE.en)

    const pro = buildCartesiaAgentConfig(agent(), { ...ORG, plan: 'pro' }, ctx(), { toolIds: allToolIds() })
    expect(pro.config.initial_message).toContain(RECORDING_NOTICE.en)

    const custom = buildCartesiaAgentConfig(
      agent({ first_message: 'Thanks for calling Zenith Dental, this is the virtual assistant. How can I help?' }),
      ORG,
      ctx(),
      { toolIds: allToolIds() }
    )
    // Already says it's a virtual assistant: not disclosed twice.
    expect(custom.config.initial_message).toBe('Thanks for calling Zenith Dental, this is the virtual assistant. How can I help?')
  })

  it('applies tone speed and emotion for English voices only', () => {
    const english = buildCartesiaAgentConfig(agent({ tone: 'empathetic' }), ORG, ctx(), { toolIds: allToolIds() })
    expect(english.config.audio?.output).toMatchObject({ speed: 0.94, emotion: 'calm' })

    const romanian = buildCartesiaAgentConfig(agent({ tone: 'empathetic', language: 'ro' }), ORG, ctx(), { toolIds: allToolIds() })
    expect(romanian.config.audio?.output).toMatchObject({ speed: 0.94, emotion: null })
    expect(romanian.config.language).toEqual({ primary: 'ro' })

    const explicit = buildCartesiaAgentConfig(agent({ voice_speed: 1.2, voice_emotion: 'content' }), ORG, ctx(), { toolIds: allToolIds() })
    expect(explicit.config.audio?.output).toMatchObject({ speed: 1.2, emotion: 'content' })
  })

  it('sends no speed for Pro Voice Clones and falls back to the language default voice', () => {
    const pro = buildCartesiaAgentConfig(agent({ voice_speed: 1.2 }), ORG, ctx(), { toolIds: allToolIds(), voiceIsPro: true })
    expect(pro.config.audio?.output?.speed).toBeNull()

    const noVoice = buildCartesiaAgentConfig(agent({ cartesia_voice_id: null, language: 'ro' }), ORG, ctx(), { toolIds: allToolIds() })
    expect(noVoice.config.audio?.output?.voice_id).toBe(DEFAULT_CARTESIA_VOICES.ro.feminine.voice_id)

    const replaced = buildCartesiaAgentConfig(agent(), ORG, ctx(), { toolIds: allToolIds(), voiceIdOverride: 'voice-default' })
    expect(replaced.config.audio?.output?.voice_id).toBe('voice-default')
  })

  it('leaves temperature out for fixed-temperature or unknown models', () => {
    expect(buildCartesiaAgentConfig(agent(), ORG, ctx(), { toolIds: allToolIds(), fixedTemperature: true }).config.model).not.toHaveProperty('temperature')
    expect(buildCartesiaAgentConfig(agent(), ORG, ctx(), { toolIds: allToolIds() }).config.model).not.toHaveProperty('temperature')
  })

  it('breaks up owner-written {{…}} so Cartesia never reads them as dynamic variables', () => {
    const body = buildCartesiaAgentConfig(
      agent({ system_prompt: 'Greet {{first_name}} by name.', first_message: 'Hi {{caller}}, this is the AI assistant.' }),
      ORG,
      ctx(),
      { toolIds: allToolIds() }
    )
    expect(body.config.instructions).toContain('Greet { {first_name} } by name.')
    expect(body.config.instructions).not.toMatch(/\{\{|\}\}/)
    expect(body.config.initial_message).toBe('Hi { {caller} }, this is the AI assistant.')
  })

  it('keeps names within 64 characters and falls back to UTC for a bad time zone', () => {
    const body = buildCartesiaAgentConfig(
      agent({ name: 'Receptionist with an unusually long and descriptive name' }),
      { ...ORG, name: 'A Very Long Business Name For A Dental Group', timezone: 'Mars/Olympus' },
      ctx(),
      { toolIds: allToolIds() }
    )
    expect(Array.from(body.name).length).toBeLessThanOrEqual(64)
    expect(body.config.timezone).toBe('UTC')
  })
})

describe('cartesiaSyncHash', () => {
  it('is stable for the same inputs and independent of object key order', () => {
    const a = agent()
    const reordered = Object.fromEntries(Object.entries(a).reverse()) as unknown as Agent
    expect(cartesiaSyncHash(a, ORG, ctx({ knowledge: true }))).toBe(cartesiaSyncHash(reordered, { ...ORG }, ctx({ knowledge: true })))
  })

  it('changes when anything the provider sees changes', () => {
    const base = cartesiaSyncHash(agent(), ORG, ctx())
    expect(cartesiaSyncHash(agent({ system_prompt: 'Different.' }), ORG, ctx())).not.toBe(base)
    expect(cartesiaSyncHash(agent({ cartesia_voice_id: 'voice-2' }), ORG, ctx())).not.toBe(base)
    expect(cartesiaSyncHash(agent(), { ...ORG, timezone: 'UTC' }, ctx())).not.toBe(base)
    expect(cartesiaSyncHash(agent(), ORG, ctx({ calendar: true }))).not.toBe(base)
    vi.stubEnv('CARTESIA_AGENT_MODEL', 'gpt-5.4-mini')
    expect(cartesiaSyncHash(agent(), ORG, ctx())).not.toBe(base)
  })

  it('ignores fields providers never see', () => {
    const base = cartesiaSyncHash(agent(), ORG, ctx())
    expect(cartesiaSyncHash(agent({ is_active: false, updated_at: '2030-01-01T00:00:00Z', provider_sync: { cartesia: { status: 'error', synced_at: null, error: 'x' } } }), ORG, ctx())).toBe(base)
  })
})

function storedTool(name: string, overrides: Partial<CartesiaTool> = {}): CartesiaTool {
  const def = toCartesiaClientTool(TOOL_DEFINITIONS[name as keyof typeof TOOL_DEFINITIONS])
  return {
    ...def,
    id: `agent_tool_${name}`,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    response_timeout_secs: def.response_timeout_secs ?? 20,
    ...overrides,
  } as CartesiaTool
}

describe('clientToolDiffers', () => {
  it('ignores key order and treats missing optional fields as empty', () => {
    const desired = toCartesiaClientTool(TOOL_DEFINITIONS.check_availability)
    const reversedProps = Object.fromEntries(Object.entries(desired.parameters.properties ?? {}).reverse())
    const stored = storedTool('check_availability', {
      parameters: { type: 'object', required: [...(desired.parameters.required ?? [])].reverse(), properties: reversedProps },
    } as Partial<CartesiaTool>)
    expect(clientToolDiffers(stored, desired)).toBe(false)

    const empty = toCartesiaClientTool(TOOL_DEFINITIONS.get_call_context)
    expect(clientToolDiffers(storedTool('get_call_context', { parameters: { type: 'object', properties: {}, required: [] } } as Partial<CartesiaTool>), empty)).toBe(false)
  })

  it('detects changed descriptions, speech and parameters', () => {
    const desired = toCartesiaClientTool(TOOL_DEFINITIONS.search_knowledge)
    expect(clientToolDiffers(storedTool('search_knowledge', { description: 'old' }), desired)).toBe(true)
    expect(clientToolDiffers(storedTool('search_knowledge', { pre_tool_speech: 'auto' }), desired)).toBe(true)
    expect(
      clientToolDiffers(storedTool('search_knowledge', { parameters: { type: 'object', properties: {}, required: [] } } as Partial<CartesiaTool>), desired)
    ).toBe(true)
  })
})

describe('ensureClientTools', () => {
  it('creates missing tools, updates changed ones and caches the ids', async () => {
    api.toolsList.mockResolvedValue([
      storedTool('get_call_context'),
      storedTool('search_knowledge', { description: 'outdated' }),
    ])
    api.toolsCreate.mockImplementation(async (body: { name: string }) => ({ id: `created_${body.name}` }))
    api.toolsUpdate.mockResolvedValue({})

    const ids = await ensureClientTools()
    expect(ids.get_call_context).toBe('agent_tool_get_call_context')
    expect(ids.search_knowledge).toBe('agent_tool_search_knowledge')
    expect(ids.book_appointment).toBe('created_ntv_book_appointment')
    expect(ids).not.toHaveProperty('end_call')
    expect(api.toolsUpdate).toHaveBeenCalledTimes(1)
    expect(api.toolsCreate).toHaveBeenCalledTimes(MANAGED_TOOL_NAMES.length - 2)

    api.toolsList.mockClear()
    await ensureClientTools()
    expect(api.toolsList).not.toHaveBeenCalled()
  })
})

describe('syncCartesiaAgent', () => {
  function primeTools() {
    api.toolsList.mockResolvedValue(MANAGED_TOOL_NAMES.map((name) => storedTool(name)))
    api.models.mockResolvedValue([{ id: 'gpt-5.6-luna', fixed_temperature: null }])
  }

  it('reports disabled without Cartesia and makes no calls', async () => {
    vi.stubEnv('CARTESIA_API_KEY', '')
    const result = await syncCartesiaAgent({ agent: agent(), org: ORG, ctx: ctx() })
    expect(result.entry.status).toBe('disabled')
    expect(api.agentsCreate).not.toHaveBeenCalled()
  })

  it('skips the provider when the last successful sync had the same config', async () => {
    const hash = cartesiaSyncHash(agent(), ORG, ctx())
    const synced = agent({
      cartesia_agent_id: 'agent_existing',
      provider_sync: { cartesia: { status: 'pending', synced_at: '2026-09-16T00:00:00Z', error: null, hash, version_id: 'av_1' } },
    })
    const result = await syncCartesiaAgent({ agent: synced, org: ORG, ctx: ctx() })
    expect(result.entry).toMatchObject({ status: 'synced', hash, version_id: 'av_1' })
    expect(api.toolsList).not.toHaveBeenCalled()
    expect(api.agentsUpdate).not.toHaveBeenCalled()
  })

  it('adopts an agent created earlier but never recorded instead of creating a duplicate', async () => {
    primeTools()
    const body = buildCartesiaAgentConfig(agent(), ORG, ctx(), { toolIds: allToolIds() })
    api.agentsList.mockResolvedValue({ data: [{ id: 'agent_orphan', name: body.name, description: body.description }], has_more: false })
    api.agentsUpdate.mockResolvedValue({ id: 'agent_orphan', version: { id: 'av_2' } })

    const result = await syncCartesiaAgent({ agent: agent(), org: ORG, ctx: ctx(), voice: { id: 'voice-custom-1', name: 'Nova', gender: 'feminine', is_pro: false, is_owner: false } })
    expect(api.agentsCreate).not.toHaveBeenCalled()
    expect(api.agentsUpdate).toHaveBeenCalledWith('agent_orphan', expect.objectContaining({ name: body.name }))
    expect(result).toMatchObject({ cartesiaAgentId: 'agent_orphan', entry: { status: 'synced', error: null, version_id: 'av_2' } })
  })

  it('recreates the agent when the stored one was deleted upstream', async () => {
    primeTools()
    api.agentsUpdate.mockRejectedValueOnce(new CartesiaError({ status: 404, message: 'Agent not found' }))
    api.agentsList.mockResolvedValue({ data: [], has_more: false })
    api.agentsCreate.mockResolvedValue({ id: 'agent_new', version: { id: 'av_3' } })

    const result = await syncCartesiaAgent({ agent: agent({ cartesia_agent_id: 'agent_gone' }), org: ORG, ctx: ctx(), voice: null, force: true })
    expect(result.cartesiaAgentId).toBe('agent_new')
    // The chosen voice no longer exists: pushed with the default voice and flagged for the owner.
    expect(api.agentsCreate.mock.calls[0][0].config.audio.output.voice_id).toBe(DEFAULT_CARTESIA_VOICES.en.feminine.voice_id)
    expect(result.entry.status).toBe('error')
    expect(result.entry.error).toMatch(/no longer available/)
  })

  it('records a readable error and keeps the previous state when Cartesia rejects the update', async () => {
    primeTools()
    api.agentsUpdate.mockRejectedValue(new CartesiaError({ status: 503, message: 'upstream down' }))
    const previous = { status: 'synced' as const, synced_at: '2026-09-10T00:00:00Z', error: null, hash: 'old', version_id: 'av_0' }
    const result = await syncCartesiaAgent({
      agent: agent({ cartesia_agent_id: 'agent_existing', provider_sync: { cartesia: previous } }),
      org: ORG,
      ctx: ctx(),
      voice: { id: 'voice-custom-1', name: 'Nova', gender: null, is_pro: false, is_owner: false },
    })
    expect(result.cartesiaAgentId).toBe('agent_existing')
    expect(result.entry).toMatchObject({ status: 'error', synced_at: previous.synced_at, hash: 'old', version_id: 'av_0' })
    expect(result.entry.error).toMatch(/didn’t respond in time/)
    expect(result.entry.error).not.toContain('upstream down')
  })

  it('does not look the voice up again when the caller’s lookup already failed', async () => {
    primeTools()
    api.agentsUpdate.mockResolvedValue({ id: 'agent_existing', version: { id: 'av_4' } })
    const result = await syncCartesiaAgent({ agent: agent({ cartesia_agent_id: 'agent_existing' }), org: ORG, ctx: ctx(), voice: undefined })
    expect(api.voicesGet).not.toHaveBeenCalled()
    expect(result.entry).toMatchObject({ status: 'synced', version_id: 'av_4' })
  })

  it('looks the voice up itself when no facts are passed', async () => {
    primeTools()
    api.voicesGet.mockResolvedValue({ id: 'voice-custom-1', name: 'Nova', gender: 'feminine', is_pro: true, is_owner: false })
    api.agentsUpdate.mockResolvedValue({ id: 'agent_existing', version: { id: 'av_5' } })
    await syncCartesiaAgent({ agent: agent({ cartesia_agent_id: 'agent_existing', voice_speed: 1.2 }), org: ORG, ctx: ctx() })
    expect(api.voicesGet).toHaveBeenCalledTimes(1)
    // Pro clone: no speed.
    expect(api.agentsUpdate.mock.calls[0][1].config.audio.output.speed).toBeNull()
  })

  it('moves to the default voice when Cartesia rejects a voice the lookup thought existed', async () => {
    primeTools()
    api.agentsUpdate
      .mockRejectedValueOnce(new CartesiaError({ status: 400, errorCode: 'agent_voice_not_found', message: 'The voice was not found' }))
      .mockResolvedValueOnce({ id: 'agent_existing', version: { id: 'av_6' } })
    kvStore.set('cartesia:voice-facts:voice-custom-1', { id: 'voice-custom-1', name: 'Nova', gender: null, is_pro: false, is_owner: false })

    const result = await syncCartesiaAgent({
      agent: agent({ cartesia_agent_id: 'agent_existing' }),
      org: ORG,
      ctx: ctx(),
      voice: { id: 'voice-custom-1', name: 'Nova', gender: null, is_pro: false, is_owner: false },
    })
    expect(api.agentsUpdate).toHaveBeenCalledTimes(2)
    expect(api.agentsUpdate.mock.calls[1][1].config.audio.output.voice_id).toBe(DEFAULT_CARTESIA_VOICES.en.feminine.voice_id)
    expect(result.entry).toMatchObject({ status: 'error', version_id: 'av_6' })
    expect(result.entry.error).toMatch(/no longer available/)
    expect(kvStore.has('cartesia:voice-facts:voice-custom-1')).toBe(false)
  })

  it('refreshes stale tool ids once, then gives up with a readable error', async () => {
    primeTools()
    const toolGone = () => new CartesiaError({ status: 400, errorCode: 'agent_tool_not_found', message: 'tool gone' })
    api.agentsUpdate.mockRejectedValueOnce(toolGone()).mockRejectedValueOnce(toolGone())
    const result = await syncCartesiaAgent({
      agent: agent({ cartesia_agent_id: 'agent_existing' }),
      org: ORG,
      ctx: ctx(),
      voice: { id: 'voice-custom-1', name: 'Nova', gender: null, is_pro: false, is_owner: false },
    })
    expect(api.agentsUpdate).toHaveBeenCalledTimes(2)
    expect(api.toolsList).toHaveBeenCalledTimes(2)
    expect(result.entry.status).toBe('error')
    expect(result.entry.error).toMatch(/calling tool/)
  })

  it('stops with a clear message when the configured model is not offered', async () => {
    api.models.mockResolvedValue([{ id: 'gpt-5.4-mini', fixed_temperature: null }])
    const result = await syncCartesiaAgent({ agent: agent(), org: ORG, ctx: ctx(), force: true })
    expect(result.entry.status).toBe('error')
    expect(result.entry.error).toMatch(/AI model/)
    expect(api.agentsCreate).not.toHaveBeenCalled()
  })
})

describe('describeCartesiaSyncError', () => {
  it('never exposes upstream text', () => {
    const cases = [
      new CartesiaError({ status: 401, message: 'secret detail' }),
      new CartesiaError({ status: 400, errorCode: 'agent_voice_not_found', message: 'secret detail' }),
      new CartesiaError({ status: 400, errorCode: null, message: 'secret detail' }),
      new CartesiaError({ status: 0, errorCode: 'timeout', message: 'secret detail' }),
      new Error('secret detail'),
    ]
    for (const error of cases) expect(describeCartesiaSyncError(error)).not.toContain('secret')
  })
})
