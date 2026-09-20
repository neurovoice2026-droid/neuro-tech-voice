import { describe, expect, it } from 'vitest'
import { countryCallingCode, isE164, maskPhone, normalizeE164 } from './e164'

describe('isE164', () => {
  it('accepts well-formed numbers', () => {
    expect(isE164('+40712345678')).toBe(true)
    expect(isE164('+14155550123')).toBe(true)
    expect(isE164('+3531234')).toBe(true)
    expect(isE164('+123456789012345')).toBe(true)
  })

  it('rejects malformed numbers', () => {
    expect(isE164('40712345678')).toBe(false)
    expect(isE164('+0712345678')).toBe(false)
    expect(isE164('+40 712 345 678')).toBe(false)
    expect(isE164('+12345')).toBe(false)
    expect(isE164('+1234567890123456')).toBe(false)
    expect(isE164('')).toBe(false)
    expect(isE164(undefined as unknown as string)).toBe(false)
  })
})

describe('normalizeE164', () => {
  it('strips formatting characters', () => {
    expect(normalizeE164(' +40 712-345 678 ')).toBe('+40712345678')
    expect(normalizeE164('+1 (415) 555-0123')).toBe('+14155550123')
    expect(normalizeE164('+40.712.345.678')).toBe('+40712345678')
  })

  it('turns a 00 international prefix into +', () => {
    expect(normalizeE164('0040 712 345 678')).toBe('+40712345678')
  })

  it('rejects national formats and garbage', () => {
    expect(normalizeE164('0712 345 678')).toBeNull()
    expect(normalizeE164('712345678')).toBeNull()
    expect(normalizeE164('+40 abc')).toBeNull()
    expect(normalizeE164('+0040712345678')).toBeNull()
    expect(normalizeE164('')).toBeNull()
    expect(normalizeE164(null as unknown as string)).toBeNull()
  })
})

describe('countryCallingCode', () => {
  it('handles 1-, 2- and 3-digit codes', () => {
    expect(countryCallingCode('+14155550123')).toBe('1')
    expect(countryCallingCode('+74951234567')).toBe('7')
    expect(countryCallingCode('+40712345678')).toBe('40')
    expect(countryCallingCode('+447911123456')).toBe('44')
    expect(countryCallingCode('+353861234567')).toBe('353')
    expect(countryCallingCode('+373691234567')).toBe('373')
    expect(countryCallingCode('nope')).toBeNull()
  })
})

describe('maskPhone', () => {
  it('matches the documented format', () => {
    expect(maskPhone('+40712345123')).toBe('+40 7** *** 123')
  })

  it('keeps the country code, first national digit and last three digits', () => {
    expect(maskPhone('+14155550123')).toBe('+1 4 *** *** 123')
    expect(maskPhone('+353861234567')).toBe('+353 8** *** 567')
  })

  it('masks short national numbers down to the last two digits', () => {
    expect(maskPhone('+3531234')).toBe('+353 **34')
  })

  it('never echoes invalid input', () => {
    expect(maskPhone('0712 345 678')).toBe('***678')
    expect(maskPhone('abc')).toBe('***')
  })
})
