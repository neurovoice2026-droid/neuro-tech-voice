import { describe, expect, it } from 'vitest'
import { AGENT_TONES } from '@/types'
import { greetingFor } from '@/lib/voice/greetings'
import {
  ONBOARDING_STORE_VERSION,
  TONE_VALUES,
  buildCompletionBody,
  createOnboardingDefaults,
  firstIncompleteStep,
  isGreetingCustomized,
  isValidTimeZone,
  isValidWebsite,
  migrateOnboardingState,
  normalizeWebsite,
  resolveGreeting,
  resolveResumeStep,
  resolveSystemPrompt,
  sanitizeOnboardingData,
  suggestedSystemPrompt,
  voiceMatchesLanguage,
  type OnboardingData,
} from './onboarding-state'

function completeDraft(overrides: Partial<OnboardingData> = {}): OnboardingData {
  const base = createOnboardingDefaults('Europe/Bucharest')
  return {
    ...base,
    orgId: 'org-1',
    company: {
      name: 'Acme Dental',
      industry: 'healthcare',
      website: 'acme.example.com',
      description: 'A family dental clinic in the city centre.',
      timezone: 'Europe/Bucharest',
    },
    agent: {
      name: 'Ana',
      language: 'ro',
      tone: 'friendly',
      first_message: 'Bună ziua, sunteți la Acme Dental. Cu ce vă pot ajuta?',
      system_prompt: 'You are the receptionist.',
    },
    voice: { cartesia_voice_id: 'voice-1', cartesia_voice_name: 'Andrada', preview_url: null, gender: 'feminine' },
    voiceLanguage: 'ro',
    ...overrides,
  }
}

describe('store migration from the v1 shape', () => {
  const v1 = {
    currentStep: 3,
    isLoading: true,
    company: { name: 'Acme', industry: 'retail', website: 'https://acme.test', description: 'We sell things to people.' },
    agent: {
      name: 'Max',
      language: 'de',
      system_prompt: '',
      first_message: 'Hallo! Wie kann ich helfen?',
      personality: 'energetic',
    },
    voice: { voice_id: '21m00Tcm4TlvDq8ikWAM', voice_name: 'Rachel', preview_url: 'https://example.com/p.mp3' },
    plan: 'pro',
  }

  it('is a newer version than the unpersisted v1 store', () => {
    expect(ONBOARDING_STORE_VERSION).toBeGreaterThan(1)
  })

  it('maps personality to tone and fills the new company timezone', () => {
    const migrated = migrateOnboardingState(v1, 1)
    expect(migrated.agent.tone).toBe('energetic')
    expect(migrated.agent).not.toHaveProperty('personality')
    expect(isValidTimeZone(migrated.company.timezone)).toBe(true)
    expect(migrated.company.name).toBe('Acme')
    expect(migrated.plan).toBe('pro')
    expect(migrated.currentStep).toBe(3)
    expect(migrated).not.toHaveProperty('isLoading')
  })

  it('drops the ElevenLabs voice so the owner picks a Cartesia voice', () => {
    const migrated = migrateOnboardingState(v1, 1)
    expect(migrated.voice).toEqual({ cartesia_voice_id: '', cartesia_voice_name: '', preview_url: null, gender: null })
    expect(migrated.voiceLanguage).toBeNull()
  })

  it('keeps a greeting the owner already had', () => {
    const migrated = migrateOnboardingState(v1, 1)
    expect(migrated.agent.first_message).toBe('Hallo! Wie kann ich helfen?')
    expect(migrated.edited.first_message).toBe(true)
  })

  it('treats an untouched generated prompt as not edited', () => {
    const company = { name: 'Acme', industry: 'retail', description: 'We sell things to people.' }
    const migrated = migrateOnboardingState(
      { ...v1, agent: { ...v1.agent, system_prompt: suggestedSystemPrompt(company) } },
      1
    )
    expect(migrated.edited.system_prompt).toBe(false)
    const edited = migrateOnboardingState({ ...v1, agent: { ...v1.agent, system_prompt: 'My own rules.' } }, 1)
    expect(edited.edited.system_prompt).toBe(true)
  })

  it('maps unknown or legacy tones to professional', () => {
    expect(migrateOnboardingState({ agent: { personality: 'educational' } }, 1).agent.tone).toBe('professional')
    expect(migrateOnboardingState({ agent: { personality: 'grumpy' } }, 1).agent.tone).toBe('professional')
  })
})

describe('sanitizeOnboardingData', () => {
  it('returns defaults for garbage', () => {
    for (const raw of [null, undefined, 42, 'x', [], { company: 'nope', agent: 7 }]) {
      const data = sanitizeOnboardingData(raw, 'UTC')
      expect(data).toEqual(createOnboardingDefaults('UTC'))
    }
  })

  it('clamps the step, rejects unknown plans, languages and zones', () => {
    const data = sanitizeOnboardingData(
      {
        currentStep: 99,
        plan: 'platinum',
        agent: { language: 'klingon', tone: 'casual' },
        company: { timezone: 'Mars/Olympus' },
        voice: { cartesia_voice_id: 'v', gender: 'robot' },
      },
      'UTC'
    )
    expect(data.currentStep).toBe(4)
    expect(data.plan).toBe('starter')
    expect(data.agent.language).toBe('en')
    expect(data.agent.tone).toBe('casual')
    expect(data.company.timezone).toBe('UTC')
    expect(data.voice.gender).toBeNull()
  })

  it('round-trips a valid v2 draft unchanged', () => {
    const draft = { ...completeDraft(), edited: { first_message: true, system_prompt: true }, annual: true }
    expect(sanitizeOnboardingData(JSON.parse(JSON.stringify(draft)), 'UTC')).toEqual(draft)
  })
})

describe('voiceMatchesLanguage', () => {
  it('flags a voice picked for another language', () => {
    expect(voiceMatchesLanguage(completeDraft())).toBe(true)
    expect(voiceMatchesLanguage(completeDraft({ agent: { ...completeDraft().agent, language: 'en' } }))).toBe(false)
  })

  it('keeps a voice whose language is unknown, and has nothing to check without a voice', () => {
    expect(voiceMatchesLanguage(completeDraft({ voiceLanguage: null, agent: { ...completeDraft().agent, language: 'en' } }))).toBe(true)
    const noVoice = createOnboardingDefaults('UTC')
    expect(voiceMatchesLanguage({ ...noVoice, voiceLanguage: 'de' })).toBe(true)
  })

  it('survives storage and is dropped together with a missing voice', () => {
    expect(sanitizeOnboardingData({ voice: { cartesia_voice_id: 'v1' }, voiceLanguage: 'ro' }, 'UTC').voiceLanguage).toBe('ro')
    expect(sanitizeOnboardingData({ voice: { cartesia_voice_id: '' }, voiceLanguage: 'ro' }, 'UTC').voiceLanguage).toBeNull()
    expect(sanitizeOnboardingData({ voice: { cartesia_voice_id: 'v1' }, voiceLanguage: 42 }, 'UTC').voiceLanguage).toBeNull()
  })
})

describe('tone values', () => {
  it('matches AGENT_TONES', () => {
    expect([...TONE_VALUES].sort()).toEqual([...AGENT_TONES].sort())
  })
})

describe('greeting regeneration rule', () => {
  const ctx = { language: 'en', tone: 'professional' as const, company: 'Acme', agentName: 'Sam' }

  it('generates with greetingFor when the owner has not edited it', () => {
    const next = resolveGreeting({ ...ctx, tone: 'friendly', current: greetingFor(ctx), edited: false })
    expect(next).toEqual({ text: greetingFor({ ...ctx, tone: 'friendly' }), edited: false })
  })

  it('follows a language change', () => {
    const next = resolveGreeting({ ...ctx, language: 'ro', current: greetingFor(ctx), edited: false })
    expect(next.text).toBe(greetingFor({ ...ctx, language: 'ro' }))
    expect(next.text).not.toBe(greetingFor(ctx))
  })

  it("keeps the owner's own words", () => {
    const next = resolveGreeting({ ...ctx, tone: 'energetic', current: 'Hi, Acme here!', edited: true })
    expect(next).toEqual({ text: 'Hi, Acme here!', edited: true })
  })

  it('regenerates an edited greeting the owner cleared', () => {
    const next = resolveGreeting({ ...ctx, current: '   ', edited: true })
    expect(next).toEqual({ text: greetingFor(ctx), edited: false })
  })

  it('counts typing as an edit only when the text differs from the suggestion', () => {
    expect(isGreetingCustomized(greetingFor(ctx), ctx)).toBe(false)
    expect(isGreetingCustomized(`  ${greetingFor(ctx).replace(/ /g, '  ')} `, ctx)).toBe(false)
    expect(isGreetingCustomized('', ctx)).toBe(false)
    expect(isGreetingCustomized('Hello from Acme, how can I help?', ctx)).toBe(true)
  })
})

describe('system prompt regeneration rule', () => {
  const company = { name: 'Acme', description: 'We fix boilers across the county.', industry: 'technology' }

  it('follows an industry change when untouched', () => {
    const before = suggestedSystemPrompt(company)
    const next = resolveSystemPrompt({ ...company, industry: 'healthcare', current: before, edited: false })
    expect(next.text).toBe(suggestedSystemPrompt({ ...company, industry: 'healthcare' }))
    expect(next.edited).toBe(false)
  })

  it('keeps edited instructions', () => {
    expect(resolveSystemPrompt({ ...company, current: 'Custom', edited: true })).toEqual({ text: 'Custom', edited: true })
  })
})

describe('resolveResumeStep', () => {
  it('never skips past an incomplete step', () => {
    const empty = createOnboardingDefaults('UTC')
    expect(resolveResumeStep({ ...empty, currentStep: 4 }, { serverStep: 4, hasDraft: false })).toBe(1)
    const noVoice = completeDraft({ voice: createOnboardingDefaults('UTC').voice, currentStep: 4 })
    expect(resolveResumeStep(noVoice, { serverStep: 1, hasDraft: true })).toBe(3)
  })

  it("prefers this tab's draft over the server step", () => {
    expect(resolveResumeStep(completeDraft({ currentStep: 2 }), { serverStep: 4, hasDraft: true })).toBe(2)
  })

  it('uses the server step without a draft (cancelled checkout)', () => {
    expect(resolveResumeStep(completeDraft({ currentStep: 1 }), { serverStep: 4, hasDraft: false })).toBe(4)
  })
})

describe('firstIncompleteStep', () => {
  it('reports the first missing piece', () => {
    expect(firstIncompleteStep(completeDraft())).toBeNull()
    expect(firstIncompleteStep(completeDraft({ company: { ...completeDraft().company, description: 'short' } }))).toBe(1)
    expect(firstIncompleteStep(completeDraft({ agent: { ...completeDraft().agent, first_message: 'Hi' } }))).toBe(2)
  })
})

describe('website helpers', () => {
  it('accepts bare domains and rejects junk', () => {
    expect(isValidWebsite('')).toBe(true)
    expect(isValidWebsite('acme.com')).toBe(true)
    expect(isValidWebsite('www.acme.co.uk')).toBe(true)
    expect(isValidWebsite('https://acme.com/about')).toBe(true)
    expect(isValidWebsite('acme')).toBe(false)
    expect(isValidWebsite('not a site')).toBe(false)
    expect(normalizeWebsite(' acme.com ')).toBe('https://acme.com')
    expect(normalizeWebsite('http://acme.com')).toBe('http://acme.com')
  })
})

describe('buildCompletionBody', () => {
  it('matches the contract shape exactly', () => {
    const body = buildCompletionBody({ ...completeDraft(), plan: 'pro', annual: true })
    expect(body).toEqual({
      plan: 'pro',
      annual: true,
      company: {
        name: 'Acme Dental',
        industry: 'healthcare',
        website: 'https://acme.example.com',
        description: 'A family dental clinic in the city centre.',
        timezone: 'Europe/Bucharest',
      },
      agent: {
        name: 'Ana',
        language: 'ro',
        system_prompt: 'You are the receptionist.',
        first_message: 'Bună ziua, sunteți la Acme Dental. Cu ce vă pot ajuta?',
        tone: 'friendly',
      },
      voice: { cartesia_voice_id: 'voice-1', cartesia_voice_name: 'Andrada', gender: 'feminine' },
    })
  })
})
