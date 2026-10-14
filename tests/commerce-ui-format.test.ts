import { describe, expect, it } from 'vitest'
import { formatCount, formatDate, formatDateTime, formatMinutes, formatMoney, maskedOrDash, relativeTime } from '@/components/commerce/format'

describe('commerce formatting', () => {
  it('formats money in en-US with the ISO code, and survives unknown codes', () => {
    // Intl's en-US currency-code layout: code first, then the grouped amount.
    expect(formatMoney(1234.5, 'RON')).toMatch(/^RON\s*1,234\.50$/)
    expect(formatMoney(99, 'USD')).toMatch(/^USD\s*99\.00$/)
    expect(formatMoney(null, 'RON')).toBe('—')
    expect(formatMoney(12, null)).toBe('12.00')
    expect(formatMoney(12, 'NOPE')).toBe('12.00 NOPE')
  })

  it('counts and dashes', () => {
    expect(formatCount(1234)).toBe('1,234')
    expect(formatCount(null)).toBe('—')
    expect(maskedOrDash('+40 7** *** 123')).toBe('+40 7** *** 123')
    expect(maskedOrDash(null)).toBe('—')
    expect(maskedOrDash('  ')).toBe('—')
  })

  it('writes dates with English month names and a 24-hour clock', () => {
    // The viewer's zone is whatever the test runner has; the day and the month name are what matter.
    expect(formatDate('2026-10-13T12:00:00Z')).toMatch(/^Oct \d{1,2}, 2026$/)
    expect(formatDateTime('2026-10-13T12:00:00Z')).toMatch(/^Oct \d{1,2}, 2026, \d{2}:\d{2}$/)
    expect(formatDateTime('2026-10-13T12:00:00Z')).not.toMatch(/AM|PM/)
    expect(formatDate(null)).toBe('—')
    expect(formatDateTime('not a date')).toBe('—')
  })

  it('relative time rounds down in English and falls back to the date after a week', () => {
    const now = Date.parse('2026-10-13T12:00:00Z')
    expect(relativeTime('2026-10-13T11:59:40Z', now)).toBe('just now')
    expect(relativeTime('2026-10-13T11:55:00Z', now)).toBe('5 min ago')
    expect(relativeTime('2026-10-13T09:30:00Z', now)).toBe('2 h ago')
    expect(relativeTime('2026-10-12T09:30:00Z', now)).toBe('1 day ago')
    expect(relativeTime('2026-10-10T09:30:00Z', now)).toBe('3 days ago')
    expect(relativeTime('2026-09-01T09:30:00Z', now)).toMatch(/^Sep \d{1,2}, 2026$/)
    expect(relativeTime(null, now)).toBe('—')
    expect(relativeTime('not a date', now)).toBe('—')
  })

  it('spells out minutes', () => {
    expect(formatMinutes(0)).toBe('immediately')
    expect(formatMinutes(1)).toBe('1 minute')
    expect(formatMinutes(15)).toBe('15 minutes')
    expect(formatMinutes(60)).toBe('1 hour')
    expect(formatMinutes(150)).toBe('2 hours 30 minutes')
    expect(formatMinutes(null)).toBe('—')
  })
})
