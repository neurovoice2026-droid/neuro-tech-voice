import { describe, expect, it } from 'vitest'
import {
  AGENT_LIMITS,
  agentPatchSchema,
  agentToggleSchema,
  agentVoiceSchema,
  normalizeWebsite,
  onboardingCompleteSchema,
  patchAffectsProviders,
} from './schemas'

const BEHAVIOR = {
  allow_interruptions: true,
  auto_end_call: true,
  auto_end_silence_seconds: 10,
  max_call_duration_enabled: false,
  max_call_duration_minutes: 30,
  record_calls: true,
  voicemail_detection: true,
}

describe('agentPatchSchema', () => {
  it('accepts every editable field and normalises empty text to null', () => {
    const result = agentPatchSchema.parse({
      name: '  Mara ',
      language: 'ro',
      system_prompt: '',
      first_message: '   ',
      fallback_message: 'Scuze, puteți repeta?',
      tone: 'empathetic',
      cartesia_voice_id: '34acfaee-c556-41ee-a5f6-c687fb20357c',
      cartesia_voice_name: 'Andrada',
      voice_speed: 0.9,
      voice_emotion: 'calm',
      keyterms: ['Zenit', 'Invisalign'],
      lead_fields: [{ key: 'budget', label: 'Budget', question: 'What budget do you have in mind?', required: false }],
      recording_notice: true,
      working_hours: { monday: { start: '09:00', end: '17:00', enabled: true } },
      is_active: true,
      metadata: {
        behavior_settings: BEHAVIOR,
        outside_hours: { type: 'message', message: 'We are closed.', notify_email: '' },
        holiday_mode: { enabled: true, from: '2026-12-24', to: '2026-12-26', message: 'Happy holidays.' },
        not_in_documents_message: '',
      },
    })
    expect(result.name).toBe('Mara')
    expect(result.system_prompt).toBeNull()
    expect(result.first_message).toBeNull()
    expect(result.metadata?.not_in_documents_message).toBeNull()
  })

  it('enforces the length limits', () => {
    expect(agentPatchSchema.safeParse({ system_prompt: 'x'.repeat(AGENT_LIMITS.systemPrompt + 1) }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ first_message: 'x'.repeat(AGENT_LIMITS.firstMessage + 1) }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ fallback_message: 'x'.repeat(AGENT_LIMITS.fallbackMessage + 1) }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ keyterms: Array.from({ length: 101 }, (_, i) => `term${i}`) }).success).toBe(false)
    const field = { key: 'k', label: 'L', question: 'Q?', required: false }
    expect(agentPatchSchema.safeParse({ lead_fields: Array.from({ length: 13 }, (_, i) => ({ ...field, key: `k${i}` })) }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('rejects unknown top-level fields and server-owned columns', () => {
    expect(agentPatchSchema.safeParse({ cartesia_agent_id: 'agent_x' }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ provider_sync: {} }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ pipeline_mode_override: 'elevenlabs' }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ org_id: 'someone-else' }).success).toBe(false)
  })

  it('drops unknown metadata keys that older screens send back', () => {
    const result = agentPatchSchema.parse({ metadata: { personality: 'Friendly', voice_map: { x: 1 }, behavior_settings: BEHAVIOR } })
    expect(result.metadata).toEqual({ personality: 'Friendly', behavior_settings: BEHAVIOR })
  })

  it('validates enums, ranges and cross-field rules', () => {
    expect(agentPatchSchema.safeParse({ language: 'tr' }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ tone: 'educational' }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ voice_speed: 1.6 }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ voice_emotion: 'Calm Down!' }).success).toBe(false)
    // The TTS WebSocket only knows five emotions; others would fail every sentence of a live call.
    expect(agentPatchSchema.safeParse({ voice_emotion: 'excited' }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ voice_emotion: 'sad' }).success).toBe(true)
    expect(agentPatchSchema.safeParse({ voice_emotion: null }).success).toBe(true)
    expect(agentPatchSchema.safeParse({ cartesia_voice_id: '../voices' }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ working_hours: { monday: { start: '18:00', end: '09:00', enabled: true } } }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ working_hours: { monday: { start: '18:00', end: '09:00', enabled: false } } }).success).toBe(true)
    expect(agentPatchSchema.safeParse({ working_hours: { someday: { start: '09:00', end: '10:00', enabled: true } } }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ metadata: { behavior_settings: { ...BEHAVIOR, auto_end_silence_seconds: 2 } } }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ metadata: { holiday_mode: { enabled: true, from: '2026-12-26', to: '2026-12-24', message: '' } } }).success).toBe(false)
    expect(agentPatchSchema.safeParse({ metadata: { outside_hours: { type: 'message', message: '', notify_email: 'not-an-email' } } }).success).toBe(false)
    const duplicate = { key: 'budget', label: 'Budget', question: 'Budget?', required: false }
    expect(agentPatchSchema.safeParse({ lead_fields: [duplicate, duplicate] }).success).toBe(false)
  })
})

describe('agentVoiceSchema / agentToggleSchema', () => {
  it('accepts the documented bodies only', () => {
    expect(agentVoiceSchema.safeParse({ cartesia_voice_id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4' }).success).toBe(true)
    expect(agentVoiceSchema.safeParse({ voice_id: 'x' }).success).toBe(false)
    expect(agentToggleSchema.safeParse({ is_active: false }).success).toBe(true)
    expect(agentToggleSchema.safeParse({ is_active: 'yes' }).success).toBe(false)
  })
})

describe('patchAffectsProviders', () => {
  it('is true only for fields a provider agent uses', () => {
    expect(patchAffectsProviders(agentPatchSchema.parse({ system_prompt: 'Hi' }))).toBe(true)
    expect(patchAffectsProviders(agentPatchSchema.parse({ metadata: { behavior_settings: BEHAVIOR } }))).toBe(true)
    expect(patchAffectsProviders(agentPatchSchema.parse({ metadata: { personality: 'friendly' } }))).toBe(true)
    expect(patchAffectsProviders(agentPatchSchema.parse({ is_active: false }))).toBe(false)
    expect(patchAffectsProviders(agentPatchSchema.parse({ working_hours: { monday: { start: '09:00', end: '17:00', enabled: true } } }))).toBe(false)
    expect(patchAffectsProviders(agentPatchSchema.parse({ metadata: { holiday_mode: { enabled: false, from: '', to: '', message: '' } } }))).toBe(false)
  })
})

const ONBOARDING = {
  plan: 'trial',
  company: { name: 'Zenith Dental', industry: 'healthcare', website: 'zenith.example', description: '', timezone: 'Europe/Bucharest' },
  agent: { name: 'Mara', language: 'en', system_prompt: '', first_message: '', tone: 'friendly' },
  voice: { cartesia_voice_id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', cartesia_voice_name: 'Skylar', gender: 'feminine' },
}

describe('onboardingCompleteSchema', () => {
  it('parses the contract body with defaults', () => {
    const result = onboardingCompleteSchema.parse(ONBOARDING)
    expect(result.annual).toBe(false)
    expect(result.company.website).toBe('https://zenith.example')
    expect(result.company.description).toBeNull()
    expect(result.agent.system_prompt).toBeNull()
    expect(result.agent.first_message).toBeNull()
    expect(result.voice.cartesia_voice_id).toBe('db6b0ed5-d5d3-463d-ae85-518a07d3c2b4')
  })

  it('tolerates a voice that was never picked and a missing tone', () => {
    const result = onboardingCompleteSchema.parse({
      ...ONBOARDING,
      agent: { ...ONBOARDING.agent, tone: undefined },
      voice: { cartesia_voice_id: '', cartesia_voice_name: '', gender: null },
    })
    expect(result.agent.tone).toBe('professional')
    expect(result.voice).toEqual({ cartesia_voice_id: null, cartesia_voice_name: null, gender: null })
    expect(onboardingCompleteSchema.parse({ ...ONBOARDING, voice: undefined }).voice.cartesia_voice_id).toBeNull()
  })

  it('rejects invalid plans, time zones, websites and missing names', () => {
    expect(onboardingCompleteSchema.safeParse({ ...ONBOARDING, plan: 'enterprise' }).success).toBe(false)
    expect(onboardingCompleteSchema.safeParse({ ...ONBOARDING, company: { ...ONBOARDING.company, timezone: 'Mars/Olympus' } }).success).toBe(false)
    expect(onboardingCompleteSchema.safeParse({ ...ONBOARDING, company: { ...ONBOARDING.company, website: 'not a site' } }).success).toBe(false)
    expect(onboardingCompleteSchema.safeParse({ ...ONBOARDING, company: { ...ONBOARDING.company, name: ' ' } }).success).toBe(false)
    expect(onboardingCompleteSchema.safeParse({ ...ONBOARDING, agent: { ...ONBOARDING.agent, language: 'xx' } }).success).toBe(false)
  })
})

describe('normalizeWebsite', () => {
  it('adds https and trims the trailing slash', () => {
    expect(normalizeWebsite('acme.com')).toBe('https://acme.com')
    expect(normalizeWebsite('http://acme.com/')).toBe('http://acme.com')
    expect(normalizeWebsite('  ')).toBeNull()
  })
})
