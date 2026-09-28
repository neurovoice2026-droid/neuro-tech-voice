import { describe, expect, it } from 'vitest'
import { callerPhoneOf, capUtf8, lastFour, MAX_RESULT_BYTES, spokenDateTime } from '@/lib/voice/tools/runtime'

describe('capUtf8', () => {
  it('leaves short results alone', () => {
    expect(capUtf8('ok')).toBe('ok')
  })

  it('caps at 4 KiB of UTF-8 without splitting characters', () => {
    const text = 'ă'.repeat(5000) // 2 bytes each
    const capped = capUtf8(text)
    expect(new TextEncoder().encode(capped).length).toBeLessThanOrEqual(MAX_RESULT_BYTES)
    expect(capped.endsWith('…[truncated]')).toBe(true)
    expect(capped).not.toContain('�')
    const emoji = capUtf8('😀'.repeat(2000), 100)
    expect(new TextEncoder().encode(emoji).length).toBeLessThanOrEqual(100)
    expect(emoji.startsWith('😀')).toBe(true)
  })
})

describe('callerPhoneOf', () => {
  it('is the caller on inbound calls and the dialled person on outbound calls', () => {
    expect(callerPhoneOf({ direction: 'inbound', from_number: '+40712345678', to_number: '+40219999999', caller_number: null })).toBe('+40712345678')
    expect(callerPhoneOf({ direction: 'outbound', from_number: '+40219999999', to_number: '+40712345678', caller_number: null })).toBe('+40712345678')
    expect(callerPhoneOf({ direction: 'inbound', from_number: null, to_number: null, caller_number: '+40712345678' })).toBe('+40712345678')
  })

  it('ignores withheld and malformed numbers', () => {
    expect(callerPhoneOf({ direction: 'inbound', from_number: 'anonymous', to_number: null, caller_number: null })).toBeNull()
    expect(callerPhoneOf({ direction: 'inbound', from_number: null, to_number: null, caller_number: null })).toBeNull()
  })
})

describe('spoken helpers', () => {
  it('formats dates for the model in the business zone', () => {
    expect(spokenDateTime('2026-09-23T11:30:00Z', 'Europe/Bucharest')).toMatch(/^Wednesday,? 23 September 2026,? (at )?14:30$/)
  })

  it('reads only the last four digits', () => {
    expect(lastFour('+40712345678')).toBe('5678')
    expect(lastFour(null)).toBeNull()
  })
})
