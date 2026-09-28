import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agent } from '@/types'
import type { AgentSyncContext, SyncOrg } from './context'

const el = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), remove: vi.fn() }))

vi.mock('@/lib/elevenlabs/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/elevenlabs/client')>()
  return { ...actual, agents: { ...actual.agents, create: el.create, update: el.update, delete: el.remove } }
})

const { deleteElevenLabsAgent, describeElevenLabsSyncError, elevenLabsSyncHash, syncElevenLabsStandby } = await import('./elevenlabs-standby')
const { ElevenLabsError } = await import('@/lib/elevenlabs/client')

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    org_id: 'org-1',
    elevenlabs_agent_id: null,
    cartesia_agent_id: null,
    name: 'Mara',
    voice_id: null,
    voice_name: null,
    cartesia_voice_id: 'voice-1',
    cartesia_voice_name: 'Nova',
    language: 'en',
    system_prompt: 'You answer calls for a dental clinic.',
    first_message: null,
    is_active: true,
    working_hours: {},
    fallback_message: null,
    tone: 'professional',
    voice_speed: null,
    voice_emotion: null,
    keyterms: [],
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

const ORG: SyncOrg = { id: 'org-1', name: 'Zenith Dental', timezone: 'UTC', plan: 'starter', sms_enabled: true, onboarding_completed: true }
const CTX: AgentSyncContext = {
  capabilities: { calendar: false, knowledge: false, sms: false, transfer: false, take_message: true, waitlist: false, lead_fields: false },
  services: [],
  contactsSummary: null,
}

beforeEach(() => {
  for (const fn of Object.values(el)) fn.mockReset()
  vi.stubEnv('ELEVENLABS_API_KEY', 'el-test-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('elevenLabsSyncHash', () => {
  it('is stable and tracks the voice source, not the resolved fallback voice', () => {
    const base = elevenLabsSyncHash(agent(), ORG, CTX)
    expect(elevenLabsSyncHash(agent(), { ...ORG }, CTX)).toBe(base)
    expect(elevenLabsSyncHash(agent({ cartesia_voice_id: 'voice-2' }), ORG, CTX)).not.toBe(base)
    // A legacy ElevenLabs voice only counts for agents without a Cartesia voice; a clone twin always does.
    expect(elevenLabsSyncHash(agent({ voice_id: 'el-voice' }), ORG, CTX)).toBe(base)
    expect(elevenLabsSyncHash(agent({ voice_id: 'el-voice', cartesia_voice_id: null }), ORG, CTX)).not.toBe(base)
    expect(elevenLabsSyncHash(agent(), ORG, { ...CTX, elevenLabsTwinVoiceId: 'el-twin' })).not.toBe(base)
    expect(elevenLabsSyncHash(agent({ first_message: 'Hello, this is the AI assistant.' }), ORG, CTX)).not.toBe(base)
    // Tools never reach the standby prompt.
    expect(elevenLabsSyncHash(agent(), ORG, { ...CTX, capabilities: { ...CTX.capabilities, calendar: true } })).toBe(base)
  })
})

describe('syncElevenLabsStandby', () => {
  it('is disabled without a key', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    const result = await syncElevenLabsStandby({ agent: agent(), org: ORG, ctx: CTX })
    expect(result.entry.status).toBe('disabled')
    expect(el.create).not.toHaveBeenCalled()
  })

  it('creates the standby once, then skips unchanged configs', async () => {
    el.create.mockResolvedValue({ agent_id: 'el_agent_1' })
    const first = await syncElevenLabsStandby({ agent: agent(), org: ORG, ctx: CTX, voiceGender: 'masculine' })
    expect(first.elevenLabsAgentId).toBe('el_agent_1')
    expect(first.entry).toMatchObject({ status: 'synced', error: null })
    expect(el.create.mock.calls[0][0].conversation_config.tts.agent_output_audio_format).toBe('ulaw_8000')

    const stored = agent({ elevenlabs_agent_id: 'el_agent_1', provider_sync: { elevenlabs: first.entry } })
    const second = await syncElevenLabsStandby({ agent: stored, org: ORG, ctx: CTX })
    expect(second.entry.status).toBe('synced')
    expect(el.update).not.toHaveBeenCalled()
    expect(el.create).toHaveBeenCalledTimes(1)
  })

  it('records no hash while the fallback voice gender is a guess, so the next sync pushes again', async () => {
    el.create.mockResolvedValue({ agent_id: 'el_agent_3' })
    const guessed = await syncElevenLabsStandby({ agent: agent(), org: ORG, ctx: CTX, voiceGender: null, voiceGenderResolved: false })
    expect(guessed.entry).toMatchObject({ status: 'synced', hash: null })

    el.update.mockResolvedValue({})
    const stored = agent({ elevenlabs_agent_id: 'el_agent_3', provider_sync: { elevenlabs: guessed.entry } })
    await syncElevenLabsStandby({ agent: stored, org: ORG, ctx: CTX, voiceGender: 'masculine', voiceGenderResolved: true })
    expect(el.update).toHaveBeenCalledTimes(1)

    // A clone twin doesn't depend on the lookup, and is the voice the standby uses.
    const twinCtx = { ...CTX, elevenLabsTwinVoiceId: 'el-twin' }
    const explicit = await syncElevenLabsStandby({ agent: agent(), org: ORG, ctx: twinCtx, voiceGenderResolved: false })
    expect(explicit.entry.hash).toBe(elevenLabsSyncHash(agent(), ORG, twinCtx))
    expect(el.create.mock.calls.at(-1)?.[0].conversation_config.tts.voice_id).toBe('el-twin')
  })

  it('patches an existing agent and recreates one deleted upstream', async () => {
    el.update.mockRejectedValueOnce(new ElevenLabsError(404, '{"detail":"not found"}', '/v1/convai/agents/el_gone', 'PATCH'))
    el.create.mockResolvedValue({ agent_id: 'el_agent_2' })
    const result = await syncElevenLabsStandby({ agent: agent({ elevenlabs_agent_id: 'el_gone' }), org: ORG, ctx: CTX, force: true })
    expect(el.update).toHaveBeenCalledWith('el_gone', expect.objectContaining({ platform_settings: expect.any(Object) }))
    expect(result.elevenLabsAgentId).toBe('el_agent_2')
  })

  it('keeps the agent id and reports a readable error on failure', async () => {
    el.update.mockRejectedValue(new ElevenLabsError(422, '{"detail":"secret upstream detail"}', '/v1/convai/agents/el_1', 'PATCH'))
    const result = await syncElevenLabsStandby({ agent: agent({ elevenlabs_agent_id: 'el_1' }), org: ORG, ctx: CTX, force: true })
    expect(result.elevenLabsAgentId).toBe('el_1')
    expect(result.entry.status).toBe('error')
    expect(result.entry.error).not.toContain('secret')
  })
})

describe('ElevenLabs errors', () => {
  it('never puts the upstream body in the message', () => {
    const error = new ElevenLabsError(500, 'internal secret', '/v1/convai/agents/x', 'PATCH')
    expect(error.message).toBe('ElevenLabs PATCH /v1/convai/agents/x failed (500)')
    expect(describeElevenLabsSyncError(error)).toMatch(/didn’t respond in time/)
    expect(describeElevenLabsSyncError(new ElevenLabsError(401, '', '/x'))).toMatch(/credentials/)
  })

  it('treats an already deleted agent as deleted', async () => {
    el.remove.mockRejectedValueOnce(new ElevenLabsError(404, '', '/v1/convai/agents/x', 'DELETE'))
    await expect(deleteElevenLabsAgent('x')).resolves.toBeUndefined()
    el.remove.mockRejectedValueOnce(new ElevenLabsError(500, '', '/v1/convai/agents/x', 'DELETE'))
    await expect(deleteElevenLabsAgent('x')).rejects.toBeInstanceOf(ElevenLabsError)
  })
})
