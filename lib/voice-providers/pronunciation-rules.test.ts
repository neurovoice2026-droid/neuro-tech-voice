import { describe, expect, it } from 'vitest'
import {
  PRONUNCIATION_LIMITS,
  PronunciationRulesSchema,
  diffRules,
  locatorBody,
  pronunciationLocatorOf,
  readPronunciation,
  toAliasRules,
} from './pronunciation-rules'

const rule = (term: string, say_as: string, extra: Record<string, unknown> = {}) => ({ term, say_as, ...extra })

describe('PronunciationRulesSchema', () => {
  it('cleans text, applies defaults (case-insensitive, word boundaries) and keeps Romanian diacritics', () => {
    const parsed = PronunciationRulesSchema.parse([rule('  Ștefan\u0000  cel   Mare ', 'Ștefan cel Mare'), rule('ACME', 'acmi', { case_sensitive: true })])
    expect(parsed).toEqual([
      { term: 'Ștefan cel Mare', say_as: 'Ștefan cel Mare', case_sensitive: false, word_boundaries: true },
      { term: 'ACME', say_as: 'acmi', case_sensitive: true, word_boundaries: true },
    ])
  })

  it('rejects empty, too long, unsupported characters, duplicates (case-insensitive) and too many rules', () => {
    expect(PronunciationRulesSchema.safeParse([rule('', 'x')]).success).toBe(false)
    expect(PronunciationRulesSchema.safeParse([rule('a'.repeat(65), 'x')]).success).toBe(false)
    expect(PronunciationRulesSchema.safeParse([rule('x', 'y'.repeat(129))]).success).toBe(false)
    expect(PronunciationRulesSchema.safeParse([rule('<script>', 'x')]).success).toBe(false)
    expect(PronunciationRulesSchema.safeParse([rule('Acme', 'a'), rule('ACME', 'b')]).success).toBe(false)
    expect(PronunciationRulesSchema.safeParse([{ term: 'a', say_as: 'b', type: 'phoneme' }]).success).toBe(false)
    const many = Array.from({ length: PRONUNCIATION_LIMITS.maxRules + 1 }, (_, i) => rule(`w${i}`, 'x'))
    expect(PronunciationRulesSchema.safeParse(many).success).toBe(false)
    expect(PronunciationRulesSchema.safeParse(many.slice(1)).success).toBe(true)
  })
})

describe('stored state and locator', () => {
  const state = { dictionary_id: 'dict_abc123', version_id: 'ver_abc123', rules: [{ term: 'A', say_as: 'ei', case_sensitive: false, word_boundaries: true }] }

  it('reads a valid state; anything else is null and never reaches the provider', () => {
    expect(readPronunciation(state)).toMatchObject(state)
    expect(readPronunciation(null)).toBeNull()
    expect(readPronunciation({ ...state, dictionary_id: 'bad id!' })).toBeNull()
    expect(readPronunciation('x')).toBeNull()
  })

  it('locator only with rules', () => {
    expect(pronunciationLocatorOf(state)).toEqual({ dictionaryId: 'dict_abc123', versionId: 'ver_abc123' })
    expect(pronunciationLocatorOf({ ...state, rules: [] })).toBeNull()
    expect(locatorBody({ dictionaryId: 'd1d1', versionId: 'v1v1' })).toEqual({ pronunciation_dictionary_id: 'd1d1', version_id: 'v1v1' })
  })

  it('maps to alias rules of the spec', () => {
    expect(toAliasRules([{ term: 'ACME', say_as: 'acmi', case_sensitive: true, word_boundaries: false }])).toEqual([
      { type: 'alias', string_to_replace: 'ACME', alias: 'acmi', case_sensitive: true, word_boundaries: false },
    ])
  })
})

describe('diffRules', () => {
  const r = (term: string, say_as: string, case_sensitive = false) => ({ term, say_as, case_sensitive, word_boundaries: true })
  it('upserts new and changed rules, removes dropped terms', () => {
    const prev = [r('A', '1'), r('B', '2'), r('C', '3')]
    const next = [r('A', '1'), r('B', 'two'), r('D', '4'), r('C', '3', true)]
    expect(diffRules(prev, next)).toEqual({ upserts: [r('B', 'two'), r('D', '4'), r('C', '3', true)], removed: [] })
    expect(diffRules(prev, [r('A', '1')])).toEqual({ upserts: [], removed: ['B', 'C'] })
    expect(diffRules([r('acme', 'x')], [r('Acme', 'x')])).toEqual({ upserts: [r('Acme', 'x')], removed: ['acme'] })
  })
})
