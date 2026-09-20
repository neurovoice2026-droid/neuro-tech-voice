import { describe, expect, it } from 'vitest'
import { AGENT_LANGUAGES } from '@/lib/agent-languages'
import {
  DEFAULT_CARTESIA_VOICES,
  ELEVENLABS_FALLBACK_VOICES,
  defaultCartesiaVoice,
  elevenLabsFallbackVoice,
} from './voice-map'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const APP_LANGUAGES = ['en', 'ro', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'nl', 'ja', 'ko', 'zh', 'ar', 'hi']

describe('DEFAULT_CARTESIA_VOICES', () => {
  it('covers exactly the 14 agent languages', () => {
    expect(Object.keys(DEFAULT_CARTESIA_VOICES).sort()).toEqual([...APP_LANGUAGES].sort())
    expect(AGENT_LANGUAGES.map((l) => l.value).sort()).toEqual([...APP_LANGUAGES].sort())
  })

  it.each(APP_LANGUAGES)('%s has a feminine and a masculine voice', (language) => {
    const voices = DEFAULT_CARTESIA_VOICES[language]
    expect(voices.feminine.gender).toBe('feminine')
    expect(voices.masculine.gender).toBe('masculine')
    for (const voice of [voices.feminine, voices.masculine]) {
      expect(voice.voice_id).toMatch(UUID)
      expect(voice.name.trim()).not.toBe('')
    }
    expect(voices.feminine.voice_id).not.toBe(voices.masculine.voice_id)
  })

  it('never reuses a voice across languages', () => {
    const ids = Object.values(DEFAULT_CARTESIA_VOICES).flatMap((v) => [v.feminine.voice_id, v.masculine.voice_id])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps the docs-recommended English agent voices', () => {
    expect(DEFAULT_CARTESIA_VOICES.en.feminine).toEqual({
      voice_id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4',
      name: 'Skylar',
      gender: 'feminine',
    })
    expect(DEFAULT_CARTESIA_VOICES.en.masculine.voice_id).toBe('47c38ca4-5f35-497b-b1a3-415245fb35e1')
  })
})

describe('defaultCartesiaVoice', () => {
  it('picks by language and gender, feminine by default', () => {
    expect(defaultCartesiaVoice('ro').name).toBe('Andrada')
    expect(defaultCartesiaVoice('ro', 'masculine').name).toBe('Andrei')
    expect(defaultCartesiaVoice('ro', null).gender).toBe('feminine')
    expect(defaultCartesiaVoice('de', 'feminine').name).toBe('Alina')
  })

  it('normalises locales and falls back to English', () => {
    expect(defaultCartesiaVoice('pt-BR').voice_id).toBe(DEFAULT_CARTESIA_VOICES.pt.feminine.voice_id)
    expect(defaultCartesiaVoice(' ZH_cn ', 'masculine').voice_id).toBe(DEFAULT_CARTESIA_VOICES.zh.masculine.voice_id)
    expect(defaultCartesiaVoice('sv')).toBe(DEFAULT_CARTESIA_VOICES.en.feminine)
    expect(defaultCartesiaVoice('')).toBe(DEFAULT_CARTESIA_VOICES.en.feminine)
    expect(defaultCartesiaVoice('constructor')).toBe(DEFAULT_CARTESIA_VOICES.en.feminine)
  })
})

describe('ElevenLabs fallback voices', () => {
  it('has one premade voice per gender', () => {
    expect(ELEVENLABS_FALLBACK_VOICES.feminine).toMatchObject({ voice_id: '21m00Tcm4TlvDq8ikWAM', gender: 'feminine' })
    expect(ELEVENLABS_FALLBACK_VOICES.masculine).toMatchObject({ voice_id: 'pNInz6obpgDQGcFmaJgB', gender: 'masculine' })
  })

  it('maps gender, with neutral and unknown going feminine', () => {
    expect(elevenLabsFallbackVoice('masculine').name).toBe('Adam')
    expect(elevenLabsFallbackVoice('feminine').name).toBe('Rachel')
    expect(elevenLabsFallbackVoice('gender_neutral').name).toBe('Rachel')
    expect(elevenLabsFallbackVoice(null).name).toBe('Rachel')
    expect(elevenLabsFallbackVoice().name).toBe('Rachel')
  })
})
