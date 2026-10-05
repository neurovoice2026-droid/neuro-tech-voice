import { describe, expect, it } from 'vitest'
import { E164_REGEX, countryCallingCode, isE164, maskPhone, normalizeE164 } from './e164'

describe('isE164', () => {
  it('accepts + and 7–15 digits without a leading zero', () => {
    expect(isE164('+40712345678')).toBe(true)
    expect(isE164('+14155550123')).toBe(true)
    expect(isE164('+1234567')).toBe(true) // 7 digits
    expect(isE164('+123456789012345')).toBe(true) // 15 digits
  })

  it('rejects everything else', () => {
    for (const bad of ['40712345678', '+0712345678', '+123456', '+1234567890123456', '+40 712 345 678', '+40-712', '', ' +40712345678']) {
      expect(isE164(bad), bad).toBe(false)
    }
    expect(isE164(undefined as unknown as string)).toBe(false)
    expect(isE164(40712345678 as unknown as string)).toBe(false)
  })

  it('matches the exported regex', () => {
    expect(E164_REGEX.test('+40712345678')).toBe(true)
    expect(E164_REGEX.test('+0712345678')).toBe(false)
  })
})

describe('normalizeE164', () => {
  it('strips spaces, dashes, dots and parentheses', () => {
    expect(normalizeE164('+40 712-345 678')).toBe('+40712345678')
    expect(normalizeE164('+1 (415) 555.0123')).toBe('+14155550123')
    expect(normalizeE164('  +40712345678  ')).toBe('+40712345678')
  })

  it('converts the 00 international prefix to +', () => {
    expect(normalizeE164('0040 (712) 345678')).toBe('+40712345678')
    expect(normalizeE164('0044 20 7946 0958')).toBe('+442079460958')
  })

  it('rejects national formats instead of guessing a country', () => {
    expect(normalizeE164('0712345678')).toBeNull()
    expect(normalizeE164('712345678')).toBeNull()
  })

  it('rejects invalid lengths, letters and non-strings', () => {
    expect(normalizeE164('+40 712')).toBeNull()
    expect(normalizeE164('+40712345678901234')).toBeNull()
    expect(normalizeE164('+40712ABC678')).toBeNull()
    expect(normalizeE164('')).toBeNull()
    expect(normalizeE164(null as unknown as string)).toBeNull()
    expect(normalizeE164(12345 as unknown as string)).toBeNull()
  })

  it('is idempotent on valid E.164', () => {
    const once = normalizeE164('+40 712 345 678')
    expect(once).not.toBeNull()
    expect(normalizeE164(once as string)).toBe(once)
  })
})

describe('countryCallingCode', () => {
  it('handles one-, two- and three-digit calling codes', () => {
    expect(countryCallingCode('+14155550123')).toBe('1')
    expect(countryCallingCode('+74951234567')).toBe('7')
    expect(countryCallingCode('+40712345678')).toBe('40')
    expect(countryCallingCode('+442079460958')).toBe('44')
    expect(countryCallingCode('+351912345678')).toBe('351')
    expect(countryCallingCode('+373 22 123456'.replace(/\s/g, ''))).toBe('373')
  })

  it('returns null for non-E.164 input', () => {
    expect(countryCallingCode('0712345678')).toBeNull()
  })
})

function digitsOf(s: string): string {
  return s.replace(/\D/g, '')
}

describe('maskPhone', () => {
  it('keeps the country code, first national digit and last three digits', () => {
    expect(maskPhone('+40712345123')).toBe('+40 7** *** 123')
    expect(maskPhone('+14155550123')).toBe('+1 4 *** *** 123')
    expect(maskPhone('+442079460958')).toBe('+44 2 *** *** 958')
  })

  it('reveals only the last two digits of very short national numbers', () => {
    // +351 + 4 national digits = 7 digits total.
    expect(maskPhone('+3511234')).toBe('+351 **34')
  })

  it('never echoes a non-E.164 value, only its tail', () => {
    expect(maskPhone('0712345678')).toBe('***678')
    expect(maskPhone('call me at 0712 345 678')).toBe('***678')
    expect(maskPhone('12345')).toBe('***')
    expect(maskPhone('anonymous')).toBe('***')
    expect(maskPhone('')).toBe('***')
    expect(maskPhone(undefined as unknown as string)).toBe('***')
  })

  it('never reveals more than the calling code, the first national digit and the last three digits', () => {
    const numbers = ['+40712345123', '+14155550123', '+442079460958', '+351912345678', '+861381234567890', '+33612345678', '+491701234567']
    for (const n of numbers) {
      const masked = maskPhone(n)
      const cc = countryCallingCode(n) as string
      const national = n.slice(1 + cc.length)
      // Visible digits: calling code + 1 leading national digit + last 3.
      expect(digitsOf(masked), n).toBe(cc + national[0] + national.slice(-3))
      // The hidden middle never appears.
      const hidden = national.slice(1, -3)
      expect(masked.includes(hidden), n).toBe(false)
      // Length is preserved (one * per hidden digit).
      expect(masked.split('*').length - 1, n).toBe(hidden.length)
    }
  })
})
