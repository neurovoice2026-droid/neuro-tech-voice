import { describe, expect, it } from 'vitest'
import { cityLabel, supportedTimeZones, timeZoneGroups, timeZoneOption, utcOffsetLabel } from './timezones'

describe('time zone options', () => {
  it('lists UTC and real zones', () => {
    const zones = supportedTimeZones()
    expect(zones).toContain('UTC')
    expect(zones).toContain('Europe/Bucharest')
  })

  it('labels cities and offsets', () => {
    expect(cityLabel('America/Argentina/Buenos_Aires')).toBe('Buenos Aires (Argentina)')
    expect(cityLabel('Europe/Bucharest')).toBe('Bucharest')
    expect(cityLabel('UTC')).toBe('Coordinated Universal Time')
    const winter = new Date('2026-01-15T12:00:00Z')
    const summer = new Date('2026-07-15T12:00:00Z')
    expect(utcOffsetLabel('Europe/Bucharest', winter)).toBe('GMT+2')
    expect(utcOffsetLabel('Europe/Bucharest', summer)).toBe('GMT+3')
    expect(utcOffsetLabel('Not/AZone', summer)).toBe('GMT')
    expect(timeZoneOption('Asia/Kolkata', summer).label).toBe('Kolkata · GMT+5:30')
  })

  it('groups by region with UTC and Europe first and keeps the current zone', () => {
    const groups = timeZoneGroups('Europe/Bucharest')
    expect(groups[0].region).toBe('UTC')
    expect(groups[1].region).toBe('Europe')
    const all = groups.flatMap((g) => g.zones.map((z) => z.id))
    expect(all).toContain('Europe/Bucharest')
    expect(new Set(all).size).toBe(all.length)
    for (const group of groups) {
      const cities = group.zones.map((z) => z.city)
      expect([...cities].sort((a, b) => a.localeCompare(b))).toEqual(cities)
    }
  })
})
