import { describe, expect, it } from 'vitest'
import { canonicalTimeZone, supportedTimeZones, timeZoneOffsetLabel } from './timezone'

describe('canonicalTimeZone', () => {
  it('accepts canonical IANA zones and UTC', () => {
    expect(canonicalTimeZone('Europe/Bucharest')).toBe('Europe/Bucharest')
    expect(canonicalTimeZone('America/New_York')).toBe('America/New_York')
    expect(canonicalTimeZone('UTC')).toBe('UTC')
    expect(canonicalTimeZone(' Europe/London ')).toBe('Europe/London')
  })

  it('rejects unknown zones, offsets and non-strings', () => {
    expect(canonicalTimeZone('Mars/Olympus')).toBeNull()
    expect(canonicalTimeZone('')).toBeNull()
    expect(canonicalTimeZone('+03:00')).toBeNull()
    expect(canonicalTimeZone(42)).toBeNull()
    expect(canonicalTimeZone('Europe/Bucharest'.repeat(10))).toBeNull()
  })

  it('lists zones including UTC and labels offsets', () => {
    const zones = supportedTimeZones()
    expect(zones).toContain('UTC')
    expect(zones).toContain('Europe/Bucharest')
    expect(timeZoneOffsetLabel('Europe/Bucharest', new Date('2026-01-15T12:00:00Z'))).toBe('GMT+02:00')
    expect(timeZoneOffsetLabel('Europe/Bucharest', new Date('2026-07-15T12:00:00Z'))).toBe('GMT+03:00')
  })
})
