import { describe, expect, it } from 'vitest'
import { compileKeyword, findKeywordMatch, keywordListIssue, parseKeywords, MAX_KEYWORDS } from './keywords'

const turns = (...messages: [role: 'agent' | 'user', message: string][]) => messages.map(([role, message]) => ({ role, message }))

describe('parseKeywords', () => {
  it('splits on commas, semicolons and new lines, trims and dedupes case-insensitively', () => {
    expect(parseKeywords(' pricing, Refund ;\nrefund,  call   back ,')).toEqual(['pricing', 'Refund', 'call back'])
  })

  it('handles empty and missing input', () => {
    expect(parseKeywords('')).toEqual([])
    expect(parseKeywords(' , ; ')).toEqual([])
    expect(parseKeywords(undefined)).toEqual([])
    expect(parseKeywords(null)).toEqual([])
  })

  it('caps the number of keywords', () => {
    const many = Array.from({ length: 15 }, (_, i) => `word${i}`).join(',')
    expect(parseKeywords(many)).toHaveLength(MAX_KEYWORDS)
  })
})

describe('compileKeyword', () => {
  it('ignores case', () => {
    expect(compileKeyword('Emergency').test('THIS IS AN EMERGENCY!')).toBe(true)
  })

  it('matches whole words only', () => {
    const cancel = compileKeyword('cancel')
    expect(cancel.test('I want to cancel.')).toBe(true)
    expect(cancel.test('cancel')).toBe(true)
    expect(cancel.test('(cancel)')).toBe(true)
    expect(cancel.test('what is the cancellation policy')).toBe(false)
    expect(cancel.test('precancel')).toBe(false)
    expect(cancel.test('cancel2')).toBe(false)
  })

  it('matches phrases across any whitespace', () => {
    const phrase = compileKeyword('call back')
    expect(phrase.test('Please call  back tomorrow')).toBe(true)
    expect(phrase.test('please call\nback')).toBe(true)
    expect(phrase.test('callback')).toBe(false)
  })

  it('treats regex characters literally', () => {
    expect(compileKeyword('$100').test('it costs $100 total')).toBe(true)
    expect(compileKeyword('c++').test('we use c++ daily')).toBe(true)
    expect(compileKeyword('a.b').test('axb')).toBe(false)
  })

  describe('Romanian', () => {
    it('matches accented speech when the keyword is typed without diacritics', () => {
      expect(compileKeyword('urgenta').test('Este o urgență, vă rog!')).toBe(true)
      expect(compileKeyword('programare').test('Aș dori o programare.')).toBe(true)
      expect(compileKeyword('sedinta').test('Ședința de mâine')).toBe(true)
    })

    it('requires the diacritics when the keyword has them', () => {
      expect(compileKeyword('urgență').test('Este o urgență')).toBe(true)
      expect(compileKeyword('urgență').test('Este o urgenta')).toBe(false)
    })

    it('treats cedilla ş/ţ and comma-below ș/ț as the same letter', () => {
      expect(compileKeyword('ședință').test('Am o şedinţă mâine')).toBe(true)
      expect(compileKeyword('şedinţă').test('Am o ședință mâine')).toBe(true)
    })

    it('does not match inside a longer Romanian word', () => {
      expect(compileKeyword('anulare').test('anularea programării')).toBe(false)
      expect(compileKeyword('anulare').test('vreau anulare')).toBe(true)
      // "ă" after the keyword is a letter, so it is not a word boundary.
      expect(compileKeyword('cas').test('o casă mare')).toBe(false)
    })

    it('keeps diacritics as letters when checking boundaries', () => {
      expect(compileKeyword('mâine').test('ne vedem mâine.')).toBe(true)
      expect(compileKeyword('mâine').test('ne vedem mâinele')).toBe(false)
    })
  })

  it('matches scripts without word spaces anywhere in the text', () => {
    expect(compileKeyword('予約').test('明日の予約をキャンセルしたいです')).toBe(true)
    expect(compileKeyword('预约').test('我想取消预约')).toBe(true)
  })

  it('never matches an empty keyword', () => {
    expect(compileKeyword('   ').test('anything')).toBe(false)
  })
})

describe('findKeywordMatch', () => {
  it('searches both caller and agent turns, turn by turn', () => {
    expect(findKeywordMatch(turns(['agent', 'Hello'], ['user', 'I have a leak, it is an emergency']), ['emergency'])).toEqual({
      keyword: 'emergency',
      role: 'user',
      turn_index: 1,
    })
    expect(findKeywordMatch(turns(['agent', 'Is this an emergency?'], ['user', 'No']), ['emergency'])).toMatchObject({ role: 'agent' })
  })

  it('does not join a phrase across two turns', () => {
    expect(findKeywordMatch(turns(['user', 'please call'], ['agent', 'back soon']), ['call back'])).toBeNull()
  })

  it('returns null without keywords or transcript', () => {
    expect(findKeywordMatch([], ['x'])).toBeNull()
    expect(findKeywordMatch(turns(['user', 'x']), [])).toBeNull()
  })
})

describe('keywordListIssue', () => {
  it('accepts a normal list', () => {
    expect(keywordListIssue('emergency, cancel my appointment; urgență')).toBeNull()
  })

  it('asks for a keyword when the list is empty', () => {
    expect(keywordListIssue('')).toBe('Enter the word or phrase to listen for')
    expect(keywordListIssue(' , ; ')).toBe('Enter the word or phrase to listen for')
    expect(keywordListIssue(undefined)).toBe('Enter the word or phrase to listen for')
  })

  it('refuses entries that would be cut short instead of trimming them silently', () => {
    expect(keywordListIssue(`ok, ${'a'.repeat(61)}`)).toMatch(/under 60 characters/)
  })

  it('refuses more than the maximum number of distinct keywords', () => {
    const eleven = Array.from({ length: MAX_KEYWORDS + 1 }, (_, i) => `word${i}`).join(', ')
    expect(keywordListIssue(eleven)).toMatch(/at most 10/)
    // Duplicates (any case, ş/ș variants) don't count twice.
    const withDuplicates = [...Array.from({ length: MAX_KEYWORDS }, (_, i) => `word${i}`), 'WORD0', 'Word1'].join(', ')
    expect(keywordListIssue(withDuplicates)).toBeNull()
  })
})
