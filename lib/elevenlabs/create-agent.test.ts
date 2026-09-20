import { describe, expect, it } from 'vitest'
import type { Agent } from '@/types'
import { mentionsAiDisclosure } from '@/lib/voice/greetings'
import { ELEVENLABS_FALLBACK_VOICES } from '@/lib/voice/voice-map'
import type { AgentSyncContext, SyncOrg } from '@/lib/voice/sync/context'
import { buildElevenLabsStandbyConfig, escapeElevenLabsVariables, STANDBY_OVERRIDES, TTS_MODEL } from './create-agent'

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    org_id: 'org-1',
    elevenlabs_agent_id: null,
    cartesia_agent_id: null,
    name: 'Mara',
    voice_id: null,
    voice_name: null,
    cartesia_voice_id: null,
    cartesia_voice_name: null,
    language: 'ro',
    system_prompt: 'Greet {{first_name}} warmly. Use {{ company }} in the answer.',
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

const ORG: SyncOrg = { id: 'org-1', name: 'Clinica Zenit', timezone: 'Europe/Bucharest', plan: 'starter', sms_enabled: true, onboarding_completed: true }
const CTX: AgentSyncContext = {
  capabilities: { calendar: true, knowledge: true, sms: true, transfer: true, take_message: true, waitlist: true, lead_fields: false },
  services: [{ name: 'Consultație', duration_minutes: 30 }],
  contactsSummary: '- Ana (Receptie); can take transferred calls',
}

describe('escapeElevenLabsVariables', () => {
  it('breaks up dynamic-variable braces and leaves single braces alone', () => {
    expect(escapeElevenLabsVariables('Hi {{name}}, {price} }}')).toBe('Hi { {name} }, {price} } }')
    expect(escapeElevenLabsVariables('no braces')).toBe('no braces')
  })
})

describe('buildElevenLabsStandbyConfig', () => {
  it('uses μ-law 8 kHz both ways, Flash v2.5 and the per-call overrides', () => {
    const config = buildElevenLabsStandbyConfig({ agent: agent(), org: ORG, ctx: CTX })
    expect(TTS_MODEL).toBe('eleven_flash_v2_5')
    expect(config.conversation_config.asr).toEqual({ user_input_audio_format: 'ulaw_8000' })
    expect(config.conversation_config.tts).toMatchObject({ model_id: 'eleven_flash_v2_5', agent_output_audio_format: 'ulaw_8000' })
    expect(config.platform_settings?.overrides).toEqual(STANDBY_OVERRIDES)
    expect(STANDBY_OVERRIDES.conversation_config_override).toEqual({
      agent: { prompt: { prompt: true }, first_message: true, language: true },
      tts: { voice_id: true },
    })
    expect(config.conversation_config.agent.language).toBe('ro')
    expect(config.name).toBe('Clinica Zenit - Mara')
  })

  it('escapes customer braces and carries no tool rules', () => {
    const { prompt, first_message } = buildElevenLabsStandbyConfig({ agent: agent(), org: ORG, ctx: CTX }).conversation_config.agent
    expect(prompt?.prompt).toContain('{ {first_name} }')
    expect(prompt?.prompt).not.toMatch(/\{\{|\}\}/)
    expect(prompt?.prompt).not.toContain('check_availability')
    expect(prompt?.prompt).not.toContain('search_knowledge')
    expect(prompt?.prompt).toContain('Consultație')
    expect(mentionsAiDisclosure(first_message ?? '')).toBe(true)
  })

  it('picks the saved ElevenLabs voice, else a fallback matching the Cartesia voice gender', () => {
    expect(buildElevenLabsStandbyConfig({ agent: agent({ voice_id: 'el-voice-9' }), org: ORG, ctx: CTX, voiceGender: 'masculine' }).conversation_config.tts?.voice_id).toBe('el-voice-9')
    expect(buildElevenLabsStandbyConfig({ agent: agent(), org: ORG, ctx: CTX, voiceGender: 'masculine' }).conversation_config.tts?.voice_id).toBe(ELEVENLABS_FALLBACK_VOICES.masculine.voice_id)
    expect(buildElevenLabsStandbyConfig({ agent: agent(), org: ORG, ctx: CTX, voiceGender: null }).conversation_config.tts?.voice_id).toBe(ELEVENLABS_FALLBACK_VOICES.feminine.voice_id)
    // Once a Cartesia voice is picked it decides; its clone twin wins.
    expect(buildElevenLabsStandbyConfig({ agent: agent({ voice_id: 'el-voice-9', cartesia_voice_id: 'c-1' }), org: ORG, ctx: CTX, voiceGender: 'masculine' }).conversation_config.tts?.voice_id).toBe(ELEVENLABS_FALLBACK_VOICES.masculine.voice_id)
    expect(buildElevenLabsStandbyConfig({ agent: agent({ cartesia_voice_id: 'c-1' }), org: ORG, ctx: { ...CTX, elevenLabsTwinVoiceId: 'el-twin' } }).conversation_config.tts?.voice_id).toBe('el-twin')
  })

  it('keeps ElevenLabs recordings only when the call would be recorded', () => {
    expect(buildElevenLabsStandbyConfig({ agent: agent(), org: ORG, ctx: CTX }).platform_settings?.privacy).toEqual({ record_voice: false })
    expect(buildElevenLabsStandbyConfig({ agent: agent(), org: { ...ORG, plan: 'pro' }, ctx: CTX }).platform_settings?.privacy).toEqual({ record_voice: true })
    const off = agent({ metadata: { behavior_settings: { record_calls: false } } as Agent['metadata'] })
    expect(buildElevenLabsStandbyConfig({ agent: off, org: { ...ORG, plan: 'pro' }, ctx: CTX }).platform_settings?.privacy).toEqual({ record_voice: false })
  })
})
