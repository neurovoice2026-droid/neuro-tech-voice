import { describe, expect, it } from 'vitest'
import { formatCount, formatMinutes, formatMoney, maskedOrDash, relativeTime } from '@/components/commerce/format'

describe('commerce formatting', () => {
  it('formats money in Romanian with the ISO code, and survives unknown codes', () => {
    expect(formatMoney(1234.5, 'RON')).toMatch(/1\.234,50\s*RON/)
    expect(formatMoney(null, 'RON')).toBe('—')
    expect(formatMoney(12, null)).toBe('12,00')
    expect(formatMoney(12, 'NOPE')).toBe('12.00 NOPE')
  })

  it('counts and dashes', () => {
    expect(formatCount(1234)).toBe('1.234')
    expect(formatCount(null)).toBe('—')
    expect(maskedOrDash('+40 7** *** 123')).toBe('+40 7** *** 123')
    expect(maskedOrDash(null)).toBe('—')
    expect(maskedOrDash('  ')).toBe('—')
  })

  it('relative time rounds down in Romanian and falls back to the date after a week', () => {
    const now = Date.parse('2026-10-13T12:00:00Z')
    expect(relativeTime('2026-10-13T11:59:40Z', now)).toBe('chiar acum')
    expect(relativeTime('2026-10-13T11:55:00Z', now)).toBe('acum 5 min')
    expect(relativeTime('2026-10-13T09:30:00Z', now)).toBe('acum 2 h')
    expect(relativeTime('2026-10-12T09:30:00Z', now)).toBe('acum o zi')
    expect(relativeTime('2026-10-10T09:30:00Z', now)).toBe('acum 3 zile')
    expect(relativeTime('2026-09-01T09:30:00Z', now)).toMatch(/2026/)
    expect(relativeTime(null, now)).toBe('—')
    expect(relativeTime('not a date', now)).toBe('—')
  })

  it('spells out minutes', () => {
    expect(formatMinutes(0)).toBe('imediat')
    expect(formatMinutes(1)).toBe('1 minut')
    expect(formatMinutes(15)).toBe('15 minute')
    expect(formatMinutes(60)).toBe('1 oră')
    expect(formatMinutes(150)).toBe('2 ore 30 minute')
    expect(formatMinutes(null)).toBe('—')
  })
})
