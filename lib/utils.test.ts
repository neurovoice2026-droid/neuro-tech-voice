import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { formatDate, formatPhoneNumber } from './utils'

describe('formatPhoneNumber', () => {
  it('keeps the North American format', () => {
    expect(formatPhoneNumber('+14155551234')).toBe('+1 (415) 555-1234')
  })

  it('groups numbers from other countries after the calling code (UI R1)', () => {
    expect(formatPhoneNumber('+40364401234')).toBe('+40 364 401 234')
    expect(formatPhoneNumber('+442071838750')).toBe('+44 207 183 8750')
    expect(formatPhoneNumber('+4915112345678')).toBe('+49 151 1234 5678')
    expect(formatPhoneNumber('+4512345678')).toBe('+45 1234 5678')
    expect(formatPhoneNumber('+35312345678')).toBe('+353 1234 5678')
  })

  it('shows anything that isn’t E.164 as it was typed', () => {
    expect(formatPhoneNumber('anonymous')).toBe('anonymous')
    expect(formatPhoneNumber('0712 345 678')).toBe('0712 345 678')
  })
})

describe('formatDate', () => {
  it('matches the previous date-fns output', () => {
    for (const iso of ['2026-09-17T15:05:00Z', '2026-01-01T00:00:00Z', '2026-12-31T12:59:59Z', '2026-03-09T09:07:00']) {
      expect(formatDate(iso)).toBe(format(new Date(iso), 'MMM d, yyyy h:mm a'))
    }
    expect(formatDate(new Date('2026-07-04T23:30:00'))).toBe(format(new Date('2026-07-04T23:30:00'), 'MMM d, yyyy h:mm a'))
  })
})
