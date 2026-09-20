import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { Agent, WorkingHours } from '@/types'
import { AI_DISCLOSURE, APOLOGY_MESSAGE, RECORDING_NOTICE, greetingFor, mentionsAiDisclosure } from './greetings'
import { composeCallContext, composeSystemPrompt, defaultFallbackMessage } from './prompt'
import { sttConfigFor } from './languages'
import { toolsFor, type ToolCapabilities } from './tools/definitions'
import { defaultCartesiaVoice, elevenLabsFallbackVoice } from './voice-map'
import { behaviorFor, buildSessionConfig, summarizeWorkingHours, type SessionBuildInput } from './session'

const HOURS: WorkingHours = {
  monday: { start: '09:00', end: '18:00', enabled: true },
  tuesday: { start: '09:00', end: '18:00', enabled: true },
  wednesday: { start: '09:00', end: '18:00', enabled: true },
  thursday: { start: '09:00', end: '18:00', enabled: true },
  friday: { start: '09:00', end: '17:00', enabled: true },
  saturday: { start: '10:00', end: '14:00', enabled: false },
  sunday: { start: '10:00', end: '14:00', enabled: false },
}

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    org_id: 'org-1',
    elevenlabs_agent_id: 'el-agent-1',
    cartesia_agent_id: 'ag_123',
    name: 'Mara',
    voice_id: 'el-voice-1',
    voice_name: 'Rachel',
    cartesia_voice_id: 'cartesia-voice-1',
    cartesia_voice_name: 'Skylar',
    language: 'en',
    system_prompt: 'You answer calls for a dental clinic.',
    first_message: null,
    is_active: true,
    working_hours: HOURS,
    fallback_message: null,
    tone: 'friendly',
    voice_speed: null,
    voice_emotion: null,
    keyterms: ['Zenith Dental', 'Invisalign'],
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

const CAPS: ToolCapabilities = { calendar: true, knowledge: true, sms: false, transfer: false, take_message: true, waitlist: false, lead_fields: false }
const NOW = new Date('2026-09-17T11:05:00Z')

function input(overrides: Partial<SessionBuildInput> = {}): SessionBuildInput {
  return {
    call: { id: 'call-1', direction: 'inbound', is_test: false, from_number: '+40712345678', to_number: '+40219999999', twilio_call_sid: 'CA123' },
    channel: 'twilio',
    mode: 'cartesia_self',
    org: { id: 'org-1', name: 'Zenith Dental', timezone: 'Europe/Bucharest', plan: 'pro' },
    agent: agent(),
    capabilities: CAPS,
    businessHoursSummary: 'Monday to Friday 09:00 to 18:00',
    services: [{ name: 'Cleaning', duration_minutes: 30 }],
    contactsSummary: null,
    now: NOW,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('buildSessionConfig', () => {
  it('assembles a complete inbound self-run session', () => {
    vi.stubEnv('OPENAI_VOICE_MODEL', '')
    vi.stubEnv('CARTESIA_TTS_MODEL', '')
    const config = buildSessionConfig(input())
    const tools = toolsFor(CAPS, 'cartesia_self')

    expect(config).toMatchObject({
      session_id: 'call-1',
      call_id: 'call-1',
      org_id: 'org-1',
      agent_id: 'agent-1',
      mode: 'cartesia_self',
      channel: 'twilio',
      direction: 'inbound',
      is_test: false,
      from_number: '+40712345678',
      to_number: '+40219999999',
      twilio_call_sid: 'CA123',
      language: 'en',
      timezone: 'Europe/Bucharest',
      agent_name: 'Mara',
      business_name: 'Zenith Dental',
      fallback_message: defaultFallbackMessage('en'),
      apology_message: APOLOGY_MESSAGE.en,
      cartesia_agent_id: 'ag_123',
    })
    expect(config.instructions).toBe(
      composeSystemPrompt({
        system_prompt: 'You answer calls for a dental clinic.',
        language: 'en',
        fallback_message: defaultFallbackMessage('en'),
        tone: 'friendly',
        agent_name: 'Mara',
        business_name: 'Zenith Dental',
        lead_fields: [],
        contacts_summary: null,
        services: [{ name: 'Cleaning', duration_minutes: 30 }],
        tools: tools.map((t) => t.name),
      })
    )
    expect(config.call_context).toBe(
      composeCallContext({
        now: NOW,
        timezone: 'Europe/Bucharest',
        direction: 'inbound',
        caller_number: '+40712345678',
        business_hours_summary: 'Monday to Friday 09:00 to 18:00',
        is_test: false,
      })
    )
    // Generated greeting (already discloses) + recording notice, because Pro records by default.
    expect(greetingFor({ language: 'en', tone: 'friendly', company: 'Zenith Dental', agentName: 'Mara' })).toBe(
      "Hi, thanks for calling Zenith Dental! I'm Mara, the AI assistant here. What can I do for you?"
    )
    expect(config.initial_message).toBe(
      "Hi, thanks for calling Zenith Dental! I'm Mara, the AI assistant here. This call may be recorded for quality purposes. What can I do for you?"
    )
    expect(config.voice).toEqual({
      voice_id: 'cartesia-voice-1',
      tts_model: 'sonic-3.6-2026-08-27',
      language: 'en',
      speed: null,
      volume: null,
      emotion: 'content',
      pronunciation_dict_id: null,
    })
    expect(config.stt).toEqual(sttConfigFor('en', ['Zenith Dental', 'Invisalign']))
    expect(config.llm).toEqual({ model: 'gpt-5.6-luna', max_output_tokens: 400, reasoning_effort: 'none', max_tool_hops: 4 })
    expect(config.tools).toEqual(tools)
    expect(config.behavior).toEqual({
      allow_interruptions: true,
      silence_timeout_seconds: 10,
      max_duration_seconds: 3600,
      record: true,
      voicemail_detection: true,
    })
    expect(config.elevenlabs).toEqual({
      agent_id: 'el-agent-1',
      // The Cartesia voice decides; the legacy ElevenLabs voice only serves agents without one.
      voice_id: elevenLabsFallbackVoice(null).voice_id,
      prompt: composeSystemPrompt({
        system_prompt: 'You answer calls for a dental clinic.',
        language: 'en',
        fallback_message: defaultFallbackMessage('en'),
        tone: 'friendly',
        agent_name: 'Mara',
        business_name: 'Zenith Dental',
        lead_fields: [],
        contacts_summary: null,
        services: [{ name: 'Cleaning', duration_minutes: 30 }],
        tools: [],
      }),
      first_message: config.initial_message,
      language: 'en',
    })
    expect(config.elevenlabs.prompt).not.toContain('## Tools')
    expect(config.safety_identifier).toBe(createHash('sha256').update('org-1').digest('hex').slice(0, 32))
    expect(config.safety_identifier).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is stable for the same input', () => {
    expect(buildSessionConfig(input())).toEqual(buildSessionConfig(input()))
  })

  it('keeps instructions identical across calls, putting per-call data only in call_context', () => {
    const a = buildSessionConfig(input())
    const b = buildSessionConfig(input({
      call: { id: 'call-2', direction: 'inbound', is_test: true, from_number: '+15550001111', to_number: null, twilio_call_sid: null },
      now: new Date('2026-12-24T18:00:00Z'),
      channel: 'browser',
    }))
    expect(b.instructions).toBe(a.instructions)
    expect(b.call_context).not.toBe(a.call_context)
    expect(a.instructions).not.toContain('+40712345678')
  })

  it('matches the OpenAI client safety identifier', async () => {
    const { safetyIdentifier } = await import('@/lib/openai/client')
    expect(buildSessionConfig(input()).safety_identifier).toBe(safetyIdentifier('org-1'))
  })

  it('uses the same default models as the provider clients', async () => {
    vi.stubEnv('OPENAI_VOICE_MODEL', '')
    vi.stubEnv('CARTESIA_TTS_MODEL', 'your-tts-model')
    const { openAIVoiceModel } = await import('@/lib/openai/client')
    const { cartesiaTtsModel } = await import('@/lib/cartesia/client')
    const config = buildSessionConfig(input())
    expect(config.llm.model).toBe(openAIVoiceModel())
    expect(config.voice.tts_model).toBe(cartesiaTtsModel())
    expect(config.voice.tts_model).toBe('sonic-3.6-2026-08-27')
  })

  it('reads model overrides from the environment', () => {
    vi.stubEnv('OPENAI_VOICE_MODEL', 'gpt-5.6-terra')
    vi.stubEnv('CARTESIA_TTS_MODEL', 'sonic-3.6')
    const config = buildSessionConfig(input())
    expect(config.llm.model).toBe('gpt-5.6-terra')
    expect(config.voice.tts_model).toBe('sonic-3.6')
  })

  it('uses the clone twin or a same-gender ElevenLabs voice for the fallback, and the legacy voice only without a Cartesia voice', () => {
    expect(buildSessionConfig({ ...input(), elevenLabsVoiceId: 'el-twin' }).elevenlabs.voice_id).toBe('el-twin')
    expect(buildSessionConfig({ ...input(), voiceGender: 'masculine' }).elevenlabs.voice_id).toBe(elevenLabsFallbackVoice('masculine').voice_id)
    expect(buildSessionConfig(input({ agent: agent({ cartesia_voice_id: null }) })).elevenlabs.voice_id).toBe('el-voice-1')
  })

  it('passes the owner’s not-in-documents line into the instructions', () => {
    const config = buildSessionConfig(
      input({ agent: agent({ metadata: { not_in_documents_message: 'Please ask at the front desk.' } }), capabilities: { ...input().capabilities, knowledge: true } })
    )
    expect(config.instructions).toContain('say exactly: "Please ask at the front desk."')
  })

  it('falls back to the default Cartesia voice and ElevenLabs voice for the language', () => {
    const config = buildSessionConfig(input({ agent: agent({ language: 'ro', cartesia_voice_id: null, voice_id: null, tone: 'energetic' }) }))
    expect(config.voice.voice_id).toBe(defaultCartesiaVoice('ro').voice_id)
    expect(config.voice.speed).toBe(1.08)
    expect(config.voice.emotion).toBeNull()
    expect(config.elevenlabs.voice_id).toBe(elevenLabsFallbackVoice(null).voice_id)
    expect(config.stt.model).toBe('ink-whisper')
    expect(config.stt.keyterms).toEqual([])
  })

  it('discloses on a custom greeting and adds the recording notice when asked', () => {
    const config = buildSessionConfig(input({
      org: { id: 'org-1', name: 'Zenith Dental', timezone: 'Europe/Bucharest', plan: 'starter' },
      agent: agent({ first_message: 'Hi, Zenith Dental here. How can I help?', recording_notice: true }),
    }))
    expect(config.initial_message).toBe(`Hi, Zenith Dental here. ${AI_DISCLOSURE.en} ${RECORDING_NOTICE.en} How can I help?`)
    expect(config.elevenlabs.first_message).toBe(config.initial_message)
  })

  it("doesn't record (or announce recording) on plans without recordings", () => {
    const config = buildSessionConfig(input({ org: { id: 'org-1', name: 'Zenith Dental', timezone: 'UTC', plan: 'starter' } }))
    expect(config.behavior.record).toBe(false)
    expect(config.initial_message).not.toContain(RECORDING_NOTICE.en)
  })

  it('uses a short outbound greeting and the dialled number as the other party', () => {
    const config = buildSessionConfig(input({
      call: { id: 'call-3', direction: 'outbound', is_test: false, from_number: '+40219999999', to_number: '+40711111111', twilio_call_sid: 'CA9' },
      org: { id: 'org-1', name: 'Zenith Dental', timezone: 'UTC', plan: 'business' },
      agent: agent({ first_message: 'Thanks for calling Zenith Dental!', metadata: { behavior_settings: { record_calls: false } } }),
    }))
    expect(config.initial_message).toBe("Hello, this is Mara, an AI assistant. I'm calling on behalf of Zenith Dental. Is now a good time to talk?")
    expect(config.call_context).toContain("Caller's number: +40711111111.")
    expect(config.call_context).toContain('Direction: outbound.')
  })

  it('gives managed and ElevenLabs sessions no end_call tool', () => {
    expect(buildSessionConfig(input({ mode: 'cartesia_managed' })).tools.map((t) => t.name)).not.toContain('end_call')
    expect(buildSessionConfig(input({ mode: 'elevenlabs' })).tools.map((t) => t.name)).not.toContain('end_call')
    expect(buildSessionConfig(input()).tools.map((t) => t.name)).toContain('end_call')
  })

  it('normalises bad language, tone and time zone values', () => {
    const config = buildSessionConfig(input({
      org: { id: 'org-1', name: null, timezone: '', plan: 'trial' },
      agent: agent({ language: 'sv', tone: 'educational' as Agent['tone'], name: '  ' }),
    }))
    expect(config.language).toBe('en')
    expect(config.timezone).toBe('UTC')
    expect(config.business_name).toBe('')
    expect(config.agent_name).toBe('')
    expect(mentionsAiDisclosure(config.initial_message ?? '')).toBe(true)
    expect(config.instructions).toContain('Sound businesslike')
  })

  it('uses a custom fallback message everywhere', () => {
    const config = buildSessionConfig(input({ agent: agent({ fallback_message: ' Sorry, say that again? ' }) }))
    expect(config.fallback_message).toBe('Sorry, say that again?')
    expect(config.instructions).toContain('respond with exactly: "Sorry, say that again?"')
    expect(config.elevenlabs.prompt).toContain('respond with exactly: "Sorry, say that again?"')
  })
})

describe('behaviorFor', () => {
  it('uses the dashboard defaults when nothing is saved', () => {
    expect(behaviorFor(agent(), { isTest: false })).toEqual({
      allow_interruptions: true,
      silence_timeout_seconds: 10,
      max_duration_seconds: 3600,
      record: true,
      voicemail_detection: true,
    })
  })

  it('applies saved settings and clamps them', () => {
    const saved = agent({
      metadata: {
        behavior_settings: {
          allow_interruptions: false,
          auto_end_call: true,
          auto_end_silence_seconds: 2,
          max_call_duration_enabled: true,
          max_call_duration_minutes: '12',
          record_calls: false,
          voicemail_detection: false,
        },
      },
    })
    expect(behaviorFor(saved, { isTest: false })).toEqual({
      allow_interruptions: false,
      silence_timeout_seconds: 5,
      max_duration_seconds: 720,
      record: false,
      voicemail_detection: false,
    })
    const huge = agent({ metadata: { behavior_settings: { max_call_duration_enabled: true, max_call_duration_minutes: 600, auto_end_call: false } } })
    expect(behaviorFor(huge, { isTest: false })).toMatchObject({ max_duration_seconds: 3600, silence_timeout_seconds: null })
  })

  it('caps test calls at 180 seconds', () => {
    expect(behaviorFor(agent(), { isTest: true }).max_duration_seconds).toBe(180)
    const short = agent({ metadata: { behavior_settings: { max_call_duration_enabled: true, max_call_duration_minutes: 1 } } })
    expect(behaviorFor(short, { isTest: true }).max_duration_seconds).toBe(60)
  })

  it('ignores malformed settings', () => {
    const broken = agent({ metadata: { behavior_settings: 'yes' } })
    expect(behaviorFor(broken, { isTest: false })).toEqual(behaviorFor(agent(), { isTest: false }))
  })
})

describe('summarizeWorkingHours', () => {
  it('groups consecutive days with the same hours', () => {
    expect(summarizeWorkingHours(HOURS, 'Europe/Bucharest')).toBe(
      'Monday to Thursday 09:00 to 18:00; Friday 09:00 to 17:00; Saturday and Sunday closed (Europe/Bucharest time)'
    )
  })

  it('handles all-closed, empty and malformed hours', () => {
    const closed = Object.fromEntries(Object.entries(HOURS).map(([day, slot]) => [day, { ...slot, enabled: false }]))
    expect(summarizeWorkingHours(closed, 'UTC')).toBe('closed every day (UTC time)')
    const allDay = Object.fromEntries(Object.keys(HOURS).map((day) => [day, { start: '00:00', end: '23:59', enabled: true }]))
    expect(summarizeWorkingHours(allDay, 'UTC')).toBe('open 24 hours, every day (UTC time)')
    expect(summarizeWorkingHours({}, 'UTC')).toBe('not set')
    expect(summarizeWorkingHours(null as unknown as WorkingHours, 'UTC')).toBe('not set')
    const partial: WorkingHours = { monday: { start: '9am', end: '5pm', enabled: true }, tuesday: { start: '09:00', end: '17:00', enabled: true } }
    expect(summarizeWorkingHours(partial, 'UTC')).toBe(
      'Monday hours not set; Tuesday 09:00 to 17:00; Wednesday to Sunday hours not set (UTC time)'
    )
  })
})
