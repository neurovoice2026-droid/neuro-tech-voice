import { describe, expect, it } from 'vitest'
import { formatPhoneNumber } from '@/lib/utils'

// formatPhoneNumber is what every dashboard list, the call sheet, Agent status
// and the messages card print: E.164 in, a readable international form out.

describe('formatPhoneNumber', () => {
  it('keeps the North American style for +1 numbers', () => {
    expect(formatPhoneNumber('+14155551234')).toBe('+1 (415) 555-1234')
    expect(formatPhoneNumber('+1 (917) 555-0126')).toBe('+1 (917) 555-0126')
  })

  it('groups Romanian mobiles 3 3 3 and Bucharest landlines 2 3 4', () => {
    expect(formatPhoneNumber('+40723000027')).toBe('+40 723 000 027')
    expect(formatPhoneNumber('+40770000050')).toBe('+40 770 000 050')
    expect(formatPhoneNumber('+40212345678')).toBe('+40 21 234 5678')
    expect(formatPhoneNumber('+40264123456')).toBe('+40 264 123 456')
  })

  it('groups UK mobiles 4 6, 02 numbers 2 4 4 and 03 / 08 numbers 3 3 4', () => {
    expect(formatPhoneNumber('+447700900211')).toBe('+44 7700 900211')
    expect(formatPhoneNumber('+442079460018')).toBe('+44 20 7946 0018')
    expect(formatPhoneNumber('+448001234567')).toBe('+44 800 123 4567')
  })

  it('groups UK 01 numbers 4 6, but the big cities\' 011x / 01x1 codes 3 3 4', () => {
    expect(formatPhoneNumber('+441632960123')).toBe('+44 1632 960123')
    expect(formatPhoneNumber('+441214960000')).toBe('+44 121 496 0000')
    expect(formatPhoneNumber('+441134960000')).toBe('+44 113 496 0000')
    expect(formatPhoneNumber('+441614960000')).toBe('+44 161 496 0000')
  })

  it('gives other countries their calling code and the national number in threes, ending on a four', () => {
    expect(formatPhoneNumber('+33612345678')).toBe('+33 612 345 678')
    expect(formatPhoneNumber('+4915112345678')).toBe('+49 151 1234 5678')
    expect(formatPhoneNumber('+3725123456')).toBe('+372 512 3456')
    expect(formatPhoneNumber('+4512345678')).toBe('+45 1234 5678')
  })

  it('reads an already spaced or 00-prefixed international number the same way', () => {
    expect(formatPhoneNumber('+40 723-000 027')).toBe('+40 723 000 027')
    expect(formatPhoneNumber('0040723000027')).toBe('+40 723 000 027')
  })

  it('returns masked, national and non-phone values unchanged', () => {
    expect(formatPhoneNumber('+40 7** *** 027')).toBe('+40 7** *** 027')
    expect(formatPhoneNumber('0723 000 027')).toBe('0723 000 027')
    expect(formatPhoneNumber('client:web-session')).toBe('client:web-session')
    expect(formatPhoneNumber('')).toBe('')
  })
})
