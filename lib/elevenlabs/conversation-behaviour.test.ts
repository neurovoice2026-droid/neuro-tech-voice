import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildElevenLabsAgentBody, type PlatformResources } from './agent-config'
import {
  DTMF_INPUT_SETTINGS,
  additionalLanguagesOf,
  asrKeywords,
  dataCollectionProperty,
  interruptionIgnoreTerms,
  languagePresets,
  softTimeoutConfig,
} from './conversation-behaviour'
import { makeAgentSpec } from '@/tests/helpers/agent-spec'
import type { AgentSpec, ConversationSettings } from '@/lib/voice-providers/types'
import { DATA_COLLECTION_OUTCOME_VALUES } from '@/lib/voice-providers/types'
import { AGENT_LANGUAGE_CODES } from '@/lib/voice/languages'
import { BACKCHANNEL_TERMS, MAX_DURATION_MESSAGES, SOFT_TIMEOUT_MESSAGES } from '@/lib/voice/conversation-phrases'

function at(value: unknown, path: string): unknown {
  let cur: unknown = value
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

const PLATFORM: PlatformResources = { transferToolId: null, postCallWebhookId: null }

function spec(conv: Partial<ConversationSettings> = {}, overrides: Partial<AgentSpec> = {}): AgentSpec {
  const base = makeAgentSpec(overrides)
  return { ...base, conversation: { ...base.conversation, ...conv } }
}

function build(conv: Partial<ConversationSettings> = {}, overrides: Partial<AgentSpec> = {}, runtime = {}) {
  return buildElevenLabsAgentBody(spec(conv, overrides), PLATFORM, runtime)
}

const GREETINGS = {
  ro: 'Bună ziua, ați sunat la Smile Clinic. Vă informez că sunt un asistent virtual cu inteligență artificială. Cu ce vă pot ajuta?',
  en: 'Thank you for calling Smile Clinic. This is an AI assistant. How can I help?',
  de: 'Guten Tag, hier ist Smile Clinic. Sie sprechen mit dem KI-Assistenten. Wie kann ich Ihnen helfen?',
  hu: 'not a supported language',
}

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', '')
  vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', '')
  vi.stubEnv('ELEVENLABS_TEXT_NORMALISATION', '')
})

describe('ASR', () => {
  it('pins the provider and boosts the business name plus the tenant keywords (deduplicated, cleaned)', () => {
    const body = build({ asr_keywords: ['Dr. Ionescu', 'smile clinic', ' albire   dentară ', 'Str. Eminescu'] })
    expect(at(body, 'conversation_config.asr')).toEqual({
      quality: 'high',
      provider: 'scribe_realtime',
      user_input_audio_format: 'ulaw_8000',
      keywords: ['Smile Clinic', 'Dr. Ionescu', 'albire dentară', 'Str. Eminescu'],
    })
  })

  it('drops control characters and over-long terms, caps the list at 50', () => {
    const many = Array.from({ length: 80 }, (_, i) => `term ${i}`)
    const kws = asrKeywords({ orgName: 'Acme\u0000Dental', conversation: { ...makeAgentSpec().conversation, asr_keywords: ['x'.repeat(51), ...many] } })
    expect(kws[0]).toBe('Acme Dental')
    expect(kws).not.toContain('x'.repeat(51))
    expect(kws).toHaveLength(50)
  })

  it('caps the business name at 50 characters (unchanged behaviour)', () => {
    expect(asrKeywords({ orgName: 'N'.repeat(70), conversation: makeAgentSpec().conversation })).toEqual(['N'.repeat(50)])
  })
})

describe('turn-taking', () => {
  it('pins spelling patience, keeps speech during protected turns and uses only the explicit ignore list', () => {
    const turn = at(build(), 'conversation_config.turn') as Record<string, unknown>
    expect(turn).toMatchObject({
      mode: 'turn',
      turn_timeout: 7,
      silence_end_call_timeout: 20,
      turn_eagerness: 'normal',
      spelling_patience: 'auto',
      interruption_ignore_term_languages: [],
      merge_with_default_ignore_terms: false,
      transcribe_on_disabled_interruptions: true,
    })
    expect(turn.interruption_ignore_terms).toEqual(expect.arrayContaining(['mhm', 'okay', 'uh-huh']))
  })

  it('ignores Romanian backchannels for a Romanian agent, plus those of its additional languages', () => {
    const ro = interruptionIgnoreTerms(spec({}, { language: 'ro' }))
    expect(ro).toEqual(expect.arrayContaining(['da', 'aha', 'mhm', 'ok', 'bine', 'sigur', 'înțeleg', 'așa']))
    expect(ro).not.toContain('nu')
    const bilingual = interruptionIgnoreTerms(spec({ additional_languages: ['en'] }, { language: 'ro' }))
    expect(bilingual).toEqual(expect.arrayContaining(['da', 'yeah']))
    // Case-insensitive duplicates ('ok', 'okay', 'mhm' exist in both lists) are sent once.
    expect(new Set(bilingual.map((t) => t.toLowerCase())).size).toBe(bilingual.length)
  })

  it('sends no ignore terms when barge-in is off or the tenant turned the option off', () => {
    expect(interruptionIgnoreTerms(spec({ allow_interruptions: false }))).toEqual([])
    expect(interruptionIgnoreTerms(spec({ ignore_backchannels: false }))).toEqual([])
  })

  it('soft timeout: 3 s, localized fillers, at most 2 per reply, randomized, never before the caller spoke', () => {
    expect(softTimeoutConfig(spec({}, { language: 'ro' }))).toEqual({
      timeout_seconds: 3,
      message: 'Un moment, vă rog.',
      additional_soft_timeout_messages: ['Imediat, verific acum.', 'Vă mulțumesc pentru răbdare.', 'Încă o clipă, vă rog.'],
      use_llm_generated_message: false,
      randomize_fillers: true,
      max_soft_timeouts_per_generation: 2,
      disable_until_first_user_message: true,
    })
    expect(at(build(), 'conversation_config.turn.soft_timeout_config.message')).toBe('One moment, please.')
  })

  it('soft timeout off sends -1 (spec: disabled)', () => {
    expect(softTimeoutConfig(spec({ soft_timeout_fillers: false })).timeout_seconds).toBe(-1)
  })
})

describe('agent block', () => {
  it('protects the first message (AI disclosure) and says a localized closing line at the duration cap', () => {
    const body = build({}, { language: 'ro' })
    expect(at(body, 'conversation_config.agent.disable_first_message_interruptions')).toBe(true)
    expect(at(body, 'conversation_config.agent.max_conversation_duration_message')).toBe(MAX_DURATION_MESSAGES.ro)
  })

  it('pins ignore_default_personality and keeps the reasoning summary off', () => {
    const prompt = at(build(), 'conversation_config.agent.prompt') as Record<string, unknown>
    expect(prompt.ignore_default_personality).toBe(true)
    expect(prompt.enable_reasoning_summary).toBe(false)
    expect(prompt.timezone).toBe('Europe/Bucharest')
  })

  it('sends reasoning_effort only when the LLM catalogue resolved one', () => {
    expect(at(build(), 'conversation_config.agent.prompt')).not.toHaveProperty('reasoning_effort')
    expect(at(build({}, {}, { reasoningEffort: null }), 'conversation_config.agent.prompt')).not.toHaveProperty('reasoning_effort')
    expect(at(build({}, {}, { reasoningEffort: 'minimal' }), 'conversation_config.agent.prompt.reasoning_effort')).toBe('minimal')
  })
})

describe('VAD and keypad input', () => {
  it('sends background voice detection from the tenant switch (off by default)', () => {
    expect(at(build(), 'conversation_config.vad')).toEqual({ background_voice_detection: false })
    expect(at(build({ background_voice_detection: true }), 'conversation_config.vad')).toEqual({ background_voice_detection: true })
  })

  it('collects keypad digits with the platform settings', () => {
    expect(at(build(), 'conversation_config.conversation.dtmf_input_settings')).toEqual({ dtmf_input_timeout: 3, hash_terminator: true, redact_input: false })
    expect(DTMF_INPUT_SETTINGS.dtmf_input_timeout).toBeGreaterThanOrEqual(0.5)
    expect(DTMF_INPUT_SETTINGS.dtmf_input_timeout).toBeLessThanOrEqual(10)
  })
})

describe('language presets', () => {
  it('none by default: empty presets, no language detection, English RAG model', () => {
    const body = build()
    expect(at(body, 'conversation_config.language_presets')).toEqual({})
    expect(at(body, 'conversation_config.agent.prompt.built_in_tools.language_detection')).toBeNull()
    expect(at(body, 'conversation_config.agent.prompt.rag.embedding_model')).toBe('e5_mistral_7b_instruct')
  })

  it('one preset per additional language with its disclosed greeting, closing line, fillers and a TTS model that speaks it', () => {
    const body = build({ additional_languages: ['ro', 'de'] }, { language: 'en', languagePresetGreetings: GREETINGS })
    expect(at(body, 'conversation_config.language_presets.ro')).toEqual({
      overrides: {
        agent: { first_message: GREETINGS.ro, language: 'ro', max_conversation_duration_message: MAX_DURATION_MESSAGES.ro },
        tts: { model_id: 'eleven_flash_v2_5' },
        turn: { soft_timeout_config: { message: SOFT_TIMEOUT_MESSAGES.ro[0], additional_soft_timeout_messages: SOFT_TIMEOUT_MESSAGES.ro.slice(1) } },
      },
    })
    expect(at(body, 'conversation_config.language_presets.de.overrides.tts.model_id')).toBe('eleven_flash_v2_5')
    // English primary keeps flash_v2; a Romanian primary with an English preset uses flash_v2 for English.
    expect(at(body, 'conversation_config.tts.model_id')).toBe('eleven_flash_v2')
    const roPrimary = build({ additional_languages: ['en'] }, { language: 'ro', languagePresetGreetings: GREETINGS })
    expect(at(roPrimary, 'conversation_config.language_presets.en.overrides.tts.model_id')).toBe('eleven_flash_v2')
    expect(at(roPrimary, 'conversation_config.tts.model_id')).toBe('eleven_flash_v2_5')
  })

  it('enables language detection (only at conversation start) and the multilingual RAG model', () => {
    const body = build({ additional_languages: ['ro'] }, { language: 'en', languagePresetGreetings: GREETINGS })
    expect(at(body, 'conversation_config.agent.prompt.built_in_tools.language_detection')).toEqual({
      type: 'system',
      name: 'language_detection',
      description: '',
      params: { system_tool_type: 'language_detection', only_at_conversation_start: true },
    })
    expect(at(body, 'conversation_config.agent.prompt.rag.embedding_model')).toBe('multilingual_e5_large_instruct')
  })

  it('never builds a preset for the primary language, an unsupported code or beyond three languages', () => {
    const s = spec({ additional_languages: ['en', 'hu', 'ro', 'ro', 'de', 'fr', 'es'] }, { language: 'en', languagePresetGreetings: { ...GREETINGS, fr: 'Bonjour. Assistant virtuel.', es: 'Hola' } })
    expect(additionalLanguagesOf(s)).toEqual(['ro', 'de', 'fr'])
    expect(Object.keys(languagePresets(s))).toEqual(['ro', 'de', 'fr'])
  })

  it('skips a language whose disclosed greeting is missing (never a preset without the AI disclosure)', () => {
    const body = build({ additional_languages: ['ro', 'it'] }, { language: 'en', languagePresetGreetings: { ro: GREETINGS.ro } })
    expect(Object.keys(at(body, 'conversation_config.language_presets') as object)).toEqual(['ro'])
    const none = build({ additional_languages: ['it'] }, { language: 'en', languagePresetGreetings: {} })
    expect(at(none, 'conversation_config.language_presets')).toEqual({})
    expect(at(none, 'conversation_config.agent.prompt.built_in_tools.language_detection')).toBeNull()
  })
})

describe('data collection', () => {
  it("limits the platform 'outcome' field to its machine-safe values with the spec enum", () => {
    expect(dataCollectionProperty({ id: 'outcome', type: 'string', description: 'One of: …' })).toEqual({
      type: 'string',
      description: 'One of: …',
      enum: [...DATA_COLLECTION_OUTCOME_VALUES],
    })
    expect(DATA_COLLECTION_OUTCOME_VALUES).not.toContain('missed')
  })

  it('keeps every other field as type + description', () => {
    expect(dataCollectionProperty({ id: 'caller_name', type: 'string', description: 'Name' })).toEqual({ type: 'string', description: 'Name' })
    expect(dataCollectionProperty({ id: 'outcome', type: 'boolean', description: 'Done?' })).toEqual({ type: 'boolean', description: 'Done?' })
  })

  it('is what the body carries', () => {
    const body = build({}, { analysis: { success_criteria: [], data_collection: [{ id: 'outcome', type: 'string', description: 'x' }] } })
    expect(at(body, 'platform_settings.data_collection.outcome.enum')).toEqual([...DATA_COLLECTION_OUTCOME_VALUES])
  })
})

describe('localized phrases', () => {
  it('cover every agent language within the spec limits', () => {
    for (const lang of AGENT_LANGUAGE_CODES) {
      const fillers = SOFT_TIMEOUT_MESSAGES[lang]
      expect(fillers, lang).toBeDefined()
      expect(fillers.length, lang).toBeGreaterThanOrEqual(2)
      expect(fillers.length - 1, lang).toBeLessThanOrEqual(3)
      for (const f of fillers) {
        expect(f.length, `${lang}: ${f}`).toBeGreaterThanOrEqual(1)
        expect(f.length, `${lang}: ${f}`).toBeLessThanOrEqual(200)
      }
      expect(MAX_DURATION_MESSAGES[lang]?.length, lang).toBeGreaterThan(10)
      expect(BACKCHANNEL_TERMS[lang]?.length, lang).toBeGreaterThan(2)
    }
  })

  it('never treats a refusal or a request to stop as a backchannel', () => {
    const all = Object.values(BACKCHANNEL_TERMS).flat().map((t) => t.toLowerCase())
    for (const word of ['no', 'nu', 'stop', 'stai', 'wait', 'nein', 'non', 'nie', 'aspetta']) expect(all).not.toContain(word)
  })
})
