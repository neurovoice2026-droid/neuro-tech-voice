import { describe, expect, it } from 'vitest'
import { normalizeStorePhone } from './phone'

describe('normalizeStorePhone', () => {
  it('keeps international numbers and resolves Romanian national formats', () => {
    expect(normalizeStorePhone('+40 722 123 456', 'RO')).toBe('+40722123456')
    expect(normalizeStorePhone('0040722123456', null)).toBe('+40722123456')
    expect(normalizeStorePhone('0722.123.456', 'RO')).toBe('+40722123456')
    expect(normalizeStorePhone('(0722) 123-456', 'ro')).toBe('+40722123456')
    expect(normalizeStorePhone('722123456', 'RO')).toBe('+40722123456')
    expect(normalizeStorePhone('Tel: 0722123456 ext. 12', 'RO')).toBe('+40722123456')
  })
  it('never guesses a country it does not know, and rejects junk', () => {
    expect(normalizeStorePhone('0722123456', null)).toBeNull()
    expect(normalizeStorePhone('0722123456', 'ZZ')).toBeNull()
    expect(normalizeStorePhone('12', 'RO')).toBeNull()
    expect(normalizeStorePhone('', 'RO')).toBeNull()
    expect(normalizeStorePhone(null, 'RO')).toBeNull()
    expect(normalizeStorePhone('n/a', 'RO')).toBeNull()
  })
  it('handles North American numbers without a trunk prefix', () => {
    expect(normalizeStorePhone('(415) 555-2671', 'US')).toBe('+14155552671')
    expect(normalizeStorePhone('1 415 555 2671', 'US')).toBe('+14155552671')
  })
})
