// Validation of the conversation settings added for the ElevenLabs
// conversation features (languages, ASR keywords, fillers, backchannels,
// skip turn, background voices) and of the voice tuning ranges.
import { describe, expect, it } from 'vitest'
import { ConversationSettingsSchema, VoiceTuningSchema, cleanKeyword, readConversationSettings, readVoiceTuning } from './settings'
import { DEFAULT_CONVERSATION_SETTINGS } from './types'

const base = DEFAULT_CONVERSATION_SETTINGS

describe('ConversationSettingsSchema: new fields', () => {
  it('has safe defaults (fillers, backchannels and skip turn on; no extra language; background filter off)', () => {
    expect(base).toMatchObject({
      additional_languages: [],
      asr_keywords: [],
      soft_timeout_fillers: true,
      ignore_backchannels: true,
      skip_turn: true,
      background_voice_detection: false,
    })
    expect(ConversationSettingsSchema.safeParse(base).success).toBe(true)
  })

  it('requires every field (the dashboard always sends the whole object)', () => {
    for (const key of ['additional_languages', 'asr_keywords', 'soft_timeout_fillers', 'ignore_backchannels', 'skip_turn', 'background_voice_detection']) {
      const rest = { ...base } as Record<string, unknown>
      delete rest[key]
      expect(ConversationSettingsSchema.safeParse(rest).success, key).toBe(false)
    }
  })

  it('accepts up to three supported, distinct additional languages', () => {
    expect(ConversationSettingsSchema.safeParse({ ...base, additional_languages: ['en', 'de', 'hu'] }).success).toBe(false)
    expect(ConversationSettingsSchema.safeParse({ ...base, additional_languages: ['en', 'en'] }).success).toBe(false)
    expect(ConversationSettingsSchema.safeParse({ ...base, additional_languages: ['en', 'de', 'fr', 'it'] }).success).toBe(false)
    expect(ConversationSettingsSchema.safeParse({ ...base, additional_languages: ['en', 'de', 'fr'] }).success).toBe(true)
  })

  it('cleans ASR keywords and enforces the limits', () => {
    const r = ConversationSettingsSchema.safeParse({ ...base, asr_keywords: ['  Dr.   Ionescu ', 'Str. Eminescu 12', 'B&B', 'Ștefan cel Mare'] })
    expect(r.success).toBe(true)
    expect(r.data?.asr_keywords).toEqual(['Dr. Ionescu', 'Str. Eminescu 12', 'B&B', 'Ștefan cel Mare'])
    for (const bad of [[''], ['   '], ['x'.repeat(51)], ['{{secret__token}}'], ['<script>'], ['Ana', 'ana']]) {
      expect(ConversationSettingsSchema.safeParse({ ...base, asr_keywords: bad }).success, JSON.stringify(bad)).toBe(false)
    }
    const thirty = Array.from({ length: 30 }, (_, i) => `kw${i}`)
    expect(ConversationSettingsSchema.safeParse({ ...base, asr_keywords: thirty }).success).toBe(true)
    expect(ConversationSettingsSchema.safeParse({ ...base, asr_keywords: [...thirty, 'one more'] }).success).toBe(false)
  })

  it('cleanKeyword replaces control characters and collapses whitespace', () => {
    expect(cleanKeyword('\tSmile\u0000  Clinic \n')).toBe('Smile Clinic')
  })
})

describe('readConversationSettings with the new fields', () => {
  it('fills defaults for agents saved before the fields existed', () => {
    expect(readConversationSettings({ allow_interruptions: false })).toEqual({ ...base, allow_interruptions: false })
  })

  it('resets only an invalid new field', () => {
    const out = readConversationSettings({ additional_languages: ['xx'], asr_keywords: ['Dr. Pop'], skip_turn: false })
    expect(out.additional_languages).toEqual([])
    expect(out.asr_keywords).toEqual(['Dr. Pop'])
    expect(out.skip_turn).toBe(false)
  })
})

describe('VoiceTuningSchema matches the spec ranges', () => {
  it('stability and similarity 0..1, speed 0.7..1.2, null = platform default', () => {
    expect(VoiceTuningSchema.safeParse({ stability: 0, similarity_boost: 1, speed: 0.7 }).success).toBe(true)
    expect(VoiceTuningSchema.safeParse({ stability: null, similarity_boost: null, speed: null }).success).toBe(true)
    expect(VoiceTuningSchema.safeParse({ stability: 1.01, similarity_boost: null, speed: null }).success).toBe(false)
    expect(VoiceTuningSchema.safeParse({ stability: null, similarity_boost: -0.1, speed: null }).success).toBe(false)
    expect(VoiceTuningSchema.safeParse({ stability: null, similarity_boost: null, speed: 0.69 }).success).toBe(false)
    expect(readVoiceTuning(null)).toEqual({ stability: null, similarity_boost: null, speed: null })
  })
})
