import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/elevenlabs/client', () => ({
  isConfigured: vi.fn(() => true),
  subscription: vi.fn(),
  agents: { create: vi.fn(), get: vi.fn(), update: vi.fn(), delete: vi.fn(), list: vi.fn() },
}))
vi.mock('@/lib/cartesia/client', () => ({
  isConfigured: vi.fn(() => true),
  ping: vi.fn(),
  agents: { create: vi.fn(), get: vi.fn(), update: vi.fn(), delete: vi.fn(), list: vi.fn(), attachWebhook: vi.fn() },
  voices: { get: vi.fn(), list: vi.fn() },
}))
vi.mock('@/lib/voice-providers/platform-resources', () => ({ tryPlatformResource: vi.fn(), forgetPlatformResource: vi.fn() }))
vi.mock('@/lib/voice-providers/platform-tools', () => ({
  TRANSFER_TOOL_DEGRADED: { code: 'transfer_tool_unavailable', message: 'transfer unavailable' },
  ensurePlatformTool: vi.fn(),
  storedPlatformToolId: vi.fn(),
  invalidatePlatformToolMemo: vi.fn(),
}))
vi.mock('@/lib/elevenlabs/llm-selection', () => ({ effectiveAgentLlm: vi.fn(async () => ({ llm: 'gpt-5.4-mini', reasoningEffort: null })) }))
vi.mock('@/lib/voice-providers/webhook-health', () => ({ resolvePostCallWebhookId: vi.fn(async () => null) }))

import type { SupabaseClient } from '@supabase/supabase-js'
import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { createLogger } from '@/lib/observability/logger'
import { memoryDb } from '@/tests/helpers/memory-db'
import { makeAgentSpec } from '@/tests/helpers/agent-spec'
import { tryPlatformResource } from './platform-resources'
import { ensurePlatformTool, invalidatePlatformToolMemo, storedPlatformToolId } from './platform-tools'
import { composeSystemPrompt } from './prompt'
import { BUSINESS_TOOLS_DEGRADED, loadBusinessTools, resolveBusinessToolIds, withAttachedBusinessTools } from './business-tools'
import { cartesiaLifecycle, elevenLabsLifecycle } from './adapters'
import { ProviderError } from './errors'
import type { AgentSpec, BusinessToolsSpec } from './types'

const log = createLogger({ component: 'test' })
const IDS: Record<string, string> = {
  'elevenlabs.transfer_tool': 'tool_transfer_1',
  'elevenlabs.tool.check_availability': 'tool_avail_1',
  'elevenlabs.tool.book_appointment': 'tool_book_1',
  'elevenlabs.tool.take_message': 'tool_msg_1',
}

function specWith(tools: BusinessToolsSpec, over: Partial<AgentSpec> = {}): AgentSpec {
  const base = makeAgentSpec(over)
  const promptInput = {
    system_prompt: 'You answer for a clinic.',
    language: 'en',
    callContext: 'variables' as const,
    bookingMode: tools.booking ? ('tools' as const) : tools.bookingEnabled ? ('take_message' as const) : null,
    takeMessageTool: tools.takeMessage,
  }
  return { ...base, businessTools: tools, promptInput, systemPrompt: composeSystemPrompt(promptInput) }
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(ensurePlatformTool).mockReset().mockImplementation(async (key) => ({ key, toolId: IDS[key], action: 'cached' }))
  vi.mocked(storedPlatformToolId).mockReset().mockImplementation(async (key) => IDS[key] ?? null)
  vi.mocked(invalidatePlatformToolMemo).mockReset()
  vi.mocked(tryPlatformResource).mockReset().mockResolvedValue(null)
})

describe('loadBusinessTools', () => {
  it('booking needs the setting AND an active Google Calendar connection with a token', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'id')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret')
    const agent = { id: 'agent-1', org_id: 'org-1' }
    const db = memoryDb({
      agents: [{ id: 'agent-1', org_id: 'org-1', booking_settings: { enabled: true }, message_settings: { enabled: true } }],
      integrations: [{ org_id: 'org-1', type: 'google_calendar', is_active: true, google_refresh_token: 'rt' }],
    })
    expect(await loadBusinessTools(db as unknown as SupabaseClient, agent, log)).toEqual({ bookingEnabled: true, booking: true, takeMessage: true })
    db.tables.integrations[0].google_refresh_token = null
    expect(await loadBusinessTools(db as unknown as SupabaseClient, agent, log)).toEqual({ bookingEnabled: true, booking: false, takeMessage: true })
    // Another org's connection never counts.
    db.tables.integrations = [{ org_id: 'org-2', type: 'google_calendar', is_active: true, google_refresh_token: 'rt' }]
    expect((await loadBusinessTools(db as unknown as SupabaseClient, agent, log)).booking).toBe(false)
    vi.unstubAllEnvs()
  })

  it('missing columns (migration 018 not applied) read as everything off', async () => {
    const db = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: '42703', message: 'column does not exist' } }) }) }) }),
      }),
    } as unknown as SupabaseClient
    expect(await loadBusinessTools(db, { id: 'a', org_id: 'o' }, log)).toEqual({ bookingEnabled: false, booking: false, takeMessage: false })
  })
})

describe('resolveBusinessToolIds / withAttachedBusinessTools', () => {
  it('attaches booking (both tools) and take_message in a stable order', async () => {
    const res = await resolveBusinessToolIds(specWith({ bookingEnabled: true, booking: true, takeMessage: true }), 'write', log)
    expect(res).toEqual({ ids: ['tool_avail_1', 'tool_book_1', 'tool_msg_1'], booking: true, takeMessage: true, degraded: null })
  })

  it('a paused agent carries none; hash mode never creates', async () => {
    expect((await resolveBusinessToolIds(specWith({ bookingEnabled: true, booking: true, takeMessage: true }, { active: false }), 'write', log)).ids).toEqual([])
    vi.mocked(storedPlatformToolId).mockResolvedValue(null)
    const hashed = await resolveBusinessToolIds(specWith({ bookingEnabled: true, booking: true, takeMessage: false }), 'hash', log)
    expect(hashed).toMatchObject({ ids: [], booking: false })
    expect(ensurePlatformTool).not.toHaveBeenCalled()
  })

  it('a tool that cannot be obtained is left out (booking needs both), reported degraded, and the prompt falls back to taking a message', async () => {
    vi.mocked(ensurePlatformTool).mockImplementation(async (key) => {
      if (key === 'elevenlabs.tool.book_appointment') throw new ProviderError({ system: 'elevenlabs', code: 'validation', operation: 'tools.create' })
      return { key, toolId: IDS[key], action: 'cached' }
    })
    const spec = specWith({ bookingEnabled: true, booking: true, takeMessage: true })
    const res = await resolveBusinessToolIds(spec, 'write', log)
    expect(res).toEqual({ ids: ['tool_msg_1'], booking: false, takeMessage: true, degraded: BUSINESS_TOOLS_DEGRADED })
    const effective = withAttachedBusinessTools(spec, res)
    expect(effective.systemPrompt).not.toContain('call book_appointment')
    expect(effective.systemPrompt).toContain('you cannot see the calendar or book appointments')
    expect(effective.promptInput?.bookingMode).toBe('take_message')
  })
})

describe('ElevenLabs adapter with business tools', () => {
  beforeEach(() => {
    vi.mocked(el.agents.update).mockReset().mockResolvedValue({ agent_id: 'el_1', version_id: 'v1', conversation_config: {} } as never)
  })

  it('sends the tool ids after the transfer tool and the offered-slots placeholder; details record what is attached', async () => {
    const spec = specWith({ bookingEnabled: true, booking: true, takeMessage: true }, { transfer: { enabled: true, number: '+40712345678', condition: null, label: null } })
    const synced = await elevenLabsLifecycle.update('el_1', spec)
    const body = vi.mocked(el.agents.update).mock.calls[0][1] as { conversation_config: { agent: { prompt: { tool_ids: string[]; prompt: string }; dynamic_variables: { dynamic_variable_placeholders: Record<string, unknown> } } } }
    expect(body.conversation_config.agent.prompt.tool_ids).toEqual(['tool_transfer_1', 'tool_avail_1', 'tool_book_1', 'tool_msg_1'])
    expect(body.conversation_config.agent.dynamic_variables.dynamic_variable_placeholders.ntv_offered_slots).toEqual([])
    expect(body.conversation_config.agent.prompt.prompt).toContain('call book_appointment')
    expect(synced.details.business_tools).toEqual({ booking: true, takeMessage: true })
    expect(synced.degraded).toBeNull()
  })

  it('a failed business tool degrades the sync (code business_tools_unavailable) but still writes the agent', async () => {
    vi.mocked(ensurePlatformTool).mockImplementation(async (key) => {
      if (key === 'elevenlabs.tool.take_message') throw new ProviderError({ system: 'elevenlabs', code: 'timeout', operation: 'tools.create' })
      return { key, toolId: IDS[key], action: 'cached' }
    })
    const spec = specWith({ bookingEnabled: false, booking: false, takeMessage: true })
    const synced = await elevenLabsLifecycle.update('el_1', spec)
    expect(synced.degraded).toEqual(BUSINESS_TOOLS_DEGRADED)
    const body = vi.mocked(el.agents.update).mock.calls[0][1] as { conversation_config: { agent: { prompt: { tool_ids: string[]; prompt: string } } } }
    expect(body.conversation_config.agent.prompt.tool_ids).toEqual([])
    expect(body.conversation_config.agent.prompt.prompt).not.toContain('take_message')
  })

  it('a failed agent write that referenced the tools forces them to be re-verified', async () => {
    vi.mocked(el.agents.update).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'validation', operation: 'agents.update' }))
    await expect(elevenLabsLifecycle.update('el_1', specWith({ bookingEnabled: true, booking: true, takeMessage: false }))).rejects.toBeInstanceOf(ProviderError)
    expect(invalidatePlatformToolMemo).toHaveBeenCalledWith('elevenlabs.tool.check_availability')
    expect(invalidatePlatformToolMemo).toHaveBeenCalledWith('elevenlabs.tool.take_message')
  })
})

describe('Cartesia fallback with take_message', () => {
  it('attaches the message tool next to the context tool when message taking is on', async () => {
    vi.mocked(tryPlatformResource).mockImplementation(async (key) => (key === 'cartesia.context_tool' ? 'ctx_tool' : key === 'cartesia.message_tool' ? 'msg_tool' : null))
    vi.mocked(ct.voices.get).mockResolvedValue({ id: 'voice_1', name: 'V', is_public: true } as never)
    vi.mocked(ct.agents.update).mockResolvedValue({ id: 'ct_1', config: {} } as never)
    vi.mocked(ct.agents.attachWebhook).mockResolvedValue(undefined as never)
    vi.stubEnv('CARTESIA_FALLBACK_VOICES', JSON.stringify({ en: 'voice-00000001' }))
    await cartesiaLifecycle.update('ct_1', specWith({ bookingEnabled: false, booking: false, takeMessage: true }))
    const config = (vi.mocked(ct.agents.update).mock.calls[0][1] as { config: { tools: Array<{ id: string }> } }).config
    expect(config.tools).toEqual([{ id: 'ctx_tool' }, { id: 'msg_tool' }])
    vi.mocked(ct.agents.update).mockClear()
    await cartesiaLifecycle.update('ct_1', specWith({ bookingEnabled: false, booking: false, takeMessage: false }))
    expect((vi.mocked(ct.agents.update).mock.calls[0][1] as { config: { tools: Array<{ id: string }> } }).config.tools).toEqual([{ id: 'ctx_tool' }])
    vi.unstubAllEnvs()
  })
})
