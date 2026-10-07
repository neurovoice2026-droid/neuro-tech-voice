import { describe, expect, it, vi } from 'vitest'
import {
  AGENT_TTS_MODELS,
  DEFAULT_LLM,
  TTS_CONVERSATIONAL_MODELS,
  agentLlm,
  chooseReasoningEffort,
  isAgentTtsModel,
  isDeprecatedTts,
  previewTtsModel,
  ragEmbeddingModel,
  supportsExpressiveMode,
  textNormalisationType,
  ttsModelFor,
} from './models'

describe('ttsModelFor', () => {
  it('uses eleven_flash_v2 for English and eleven_flash_v2_5 for every other language by default', () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', '')
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', '')
    expect(ttsModelFor('en')).toBe('eleven_flash_v2')
    expect(ttsModelFor('EN')).toBe('eleven_flash_v2')
    expect(ttsModelFor(null)).toBe('eleven_flash_v2')
    expect(ttsModelFor(undefined)).toBe('eleven_flash_v2')
    for (const lang of ['ro', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'nl', 'ja', 'ko', 'zh', 'ar', 'hi']) {
      expect(ttsModelFor(lang), lang).toBe('eleven_flash_v2_5')
    }
  })

  it('never returns the deprecated eleven_turbo_v2_5 (env value is mapped to its replacement)', () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_turbo_v2_5')
    expect(ttsModelFor('ro')).toBe('eleven_flash_v2_5')
    vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', 'eleven_turbo_v2_5')
    expect(ttsModelFor('en')).toBe('eleven_flash_v2_5')
  })

  it('maps the deprecated English turbo model to flash', () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', 'eleven_turbo_v2')
    expect(ttsModelFor('en')).toBe('eleven_flash_v2')
  })

  it('honours a valid English override from the agent allow-list', () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', '  eleven_v4_turbo ')
    expect(ttsModelFor('en')).toBe('eleven_v4_turbo')
  })

  it('refuses spec models outside the real-time allow-list (high-fidelity models)', () => {
    for (const model of ['eleven_multilingual_v2', 'eleven_v4']) {
      vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', model)
      vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', model)
      expect(ttsModelFor('en'), model).toBe('eleven_flash_v2')
      expect(ttsModelFor('ro'), model).toBe('eleven_flash_v2_5')
    }
  })

  it('honours a valid multilingual override', () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_v3_conversational')
    expect(ttsModelFor('ro')).toBe('eleven_v3_conversational')
    expect(ttsModelFor('en')).not.toBe('eleven_v3_conversational')
  })

  it('never lets an English-only model leak to other languages', () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_flash_v2')
    expect(ttsModelFor('ro')).toBe('eleven_flash_v2_5')
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_turbo_v2')
    expect(ttsModelFor('de')).toBe('eleven_flash_v2_5')
  })

  it('ignores unknown env values instead of sending them to the API', () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', 'eleven_made_up_v9')
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'not-a-model')
    expect(ttsModelFor('en')).toBe('eleven_flash_v2')
    expect(ttsModelFor('ro')).toBe('eleven_flash_v2_5')
  })

  it('always returns one of the conversational models', () => {
    for (const env of ['', 'eleven_turbo_v2', 'eleven_turbo_v2_5', 'eleven_v4', 'junk']) {
      vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', env)
      vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', env)
      for (const lang of ['en', 'ro']) {
        const m = ttsModelFor(lang)
        expect(TTS_CONVERSATIONAL_MODELS).toContain(m)
        expect(isDeprecatedTts(m), `${env}/${lang}`).toBe(false)
      }
    }
  })
})

describe('isDeprecatedTts', () => {
  it('flags only the deprecated turbo models', () => {
    expect(isDeprecatedTts('eleven_turbo_v2_5')).toBe(true)
    expect(isDeprecatedTts('eleven_turbo_v2')).toBe(true)
    expect(isDeprecatedTts('eleven_flash_v2_5')).toBe(false)
    expect(isDeprecatedTts('eleven_flash_v2')).toBe(false)
    expect(isDeprecatedTts('eleven_multilingual_v2')).toBe(false)
    expect(isDeprecatedTts('')).toBe(false)
    expect(isDeprecatedTts(null)).toBe(false)
    expect(isDeprecatedTts(undefined)).toBe(false)
  })

  it('does not treat Object.prototype keys as deprecated models', () => {
    expect(isDeprecatedTts('constructor')).toBe(false)
    expect(isDeprecatedTts('toString')).toBe(false)
  })
})

describe('ragEmbeddingModel', () => {
  it('uses the English model for English and the multilingual one otherwise', () => {
    expect(ragEmbeddingModel('en')).toBe('e5_mistral_7b_instruct')
    expect(ragEmbeddingModel(null)).toBe('e5_mistral_7b_instruct')
    expect(ragEmbeddingModel(undefined)).toBe('e5_mistral_7b_instruct')
    expect(ragEmbeddingModel('ro')).toBe('multilingual_e5_large_instruct')
    expect(ragEmbeddingModel('ja')).toBe('multilingual_e5_large_instruct')
  })

  it('switches to the multilingual model when any additional language is not English', () => {
    expect(ragEmbeddingModel('en', ['ro'])).toBe('multilingual_e5_large_instruct')
    expect(ragEmbeddingModel('en', [])).toBe('e5_mistral_7b_instruct')
    expect(ragEmbeddingModel('ro', ['en'])).toBe('multilingual_e5_large_instruct')
  })
})

describe('previewTtsModel', () => {
  it('uses flash models by default (never turbo)', () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', '')
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', '')
    expect(previewTtsModel('en')).toBe('eleven_flash_v2')
    expect(previewTtsModel(null)).toBe('eleven_flash_v2')
    expect(previewTtsModel('ro')).toBe('eleven_flash_v2_5')
  })

  it('follows the live agent model (env), with the plain-TTS sibling of a conversational-only model', () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_v4_turbo')
    expect(previewTtsModel('ro')).toBe('eleven_v4_turbo')
    vi.stubEnv('ELEVENLABS_TTS_MODEL_MULTILINGUAL', 'eleven_v3_conversational')
    expect(previewTtsModel('ro')).toBe('eleven_v3')
    vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', 'eleven_turbo_v2')
    expect(previewTtsModel('en')).toBe('eleven_flash_v2')
  })
})

describe('supportsExpressiveMode', () => {
  it('is true for the v3/v4 families only', () => {
    expect(supportsExpressiveMode('eleven_v3_conversational')).toBe(true)
    expect(supportsExpressiveMode('eleven_v4_turbo')).toBe(true)
    expect(supportsExpressiveMode('eleven_v4')).toBe(true)
    for (const m of ['eleven_flash_v2', 'eleven_flash_v2_5', 'eleven_multilingual_v2', '', null]) expect(supportsExpressiveMode(m), String(m)).toBe(false)
  })
})

describe('AGENT_TTS_MODELS', () => {
  it('is a subset of the spec enum without deprecated models', () => {
    for (const m of AGENT_TTS_MODELS) {
      expect(TTS_CONVERSATIONAL_MODELS).toContain(m)
      expect(isDeprecatedTts(m)).toBe(false)
      expect(isAgentTtsModel(m)).toBe(true)
    }
    expect(isAgentTtsModel('eleven_multilingual_v2')).toBe(false)
    expect(isAgentTtsModel(null)).toBe(false)
  })
})

describe('textNormalisationType', () => {
  it("defaults to 'elevenlabs' and accepts only the spec enum", () => {
    vi.stubEnv('ELEVENLABS_TEXT_NORMALISATION', '')
    expect(textNormalisationType()).toBe('elevenlabs')
    vi.stubEnv('ELEVENLABS_TEXT_NORMALISATION', ' system_prompt ')
    expect(textNormalisationType()).toBe('system_prompt')
    vi.stubEnv('ELEVENLABS_TEXT_NORMALISATION', 'SYSTEM_PROMPT')
    expect(textNormalisationType()).toBe('elevenlabs')
  })
})

describe('chooseReasoningEffort', () => {
  it('returns null when the model has no configurable reasoning', () => {
    expect(chooseReasoningEffort(null, '')).toBeNull()
    expect(chooseReasoningEffort([], '')).toBeNull()
    expect(chooseReasoningEffort(undefined, 'low')).toBeNull()
  })

  it('picks the lowest supported level by default', () => {
    expect(chooseReasoningEffort(['medium', 'low', 'high'], '')).toBe('low')
    expect(chooseReasoningEffort(['high', 'none', 'minimal'], undefined)).toBe('none')
    expect(chooseReasoningEffort(['minimal', 'low'], 'auto')).toBe('minimal')
  })

  it('honours a supported preference and ignores an unsupported or unknown one', () => {
    expect(chooseReasoningEffort(['minimal', 'low', 'medium'], 'medium')).toBe('medium')
    expect(chooseReasoningEffort(['minimal', 'low'], 'none')).toBe('minimal')
    expect(chooseReasoningEffort(['minimal', 'low'], 'turbo')).toBe('minimal')
  })

  it('ignores values outside the spec enum even if the catalogue lists them', () => {
    expect(chooseReasoningEffort(['ultra'], '')).toBeNull()
  })

  it('reads ELEVENLABS_REASONING_EFFORT when no preference is passed', () => {
    vi.stubEnv('ELEVENLABS_REASONING_EFFORT', 'low')
    expect(chooseReasoningEffort(['minimal', 'low'])).toBe('low')
  })
})

describe('agentLlm', () => {
  it('defaults when unset or empty', () => {
    vi.stubEnv('ELEVENLABS_LLM', '')
    expect(agentLlm()).toBe(DEFAULT_LLM)
  })

  it('uses a well-formed env value (trimmed)', () => {
    vi.stubEnv('ELEVENLABS_LLM', '  gemini-2.5-flash ')
    expect(agentLlm()).toBe('gemini-2.5-flash')
  })

  it('rejects malformed values', () => {
    for (const bad of ['gpt 4o', '-leading-dash', 'x', 'a'.repeat(65), 'model/with/slash']) {
      vi.stubEnv('ELEVENLABS_LLM', bad)
      expect(agentLlm(), bad).toBe(DEFAULT_LLM)
    }
  })
})
