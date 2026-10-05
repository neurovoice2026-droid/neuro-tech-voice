import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_LLM,
  TTS_CONVERSATIONAL_MODELS,
  agentLlm,
  isDeprecatedTts,
  previewTtsModel,
  ragEmbeddingModel,
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

  it('honours a valid English override', () => {
    vi.stubEnv('ELEVENLABS_TTS_MODEL_EN', '  eleven_multilingual_v2 ')
    expect(ttsModelFor('en')).toBe('eleven_multilingual_v2')
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
})

describe('previewTtsModel', () => {
  it('uses flash models (never turbo)', () => {
    expect(previewTtsModel('en')).toBe('eleven_flash_v2')
    expect(previewTtsModel(null)).toBe('eleven_flash_v2')
    expect(previewTtsModel('ro')).toBe('eleven_flash_v2_5')
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
