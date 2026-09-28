// Time zone options for the company step: every IANA zone the browser knows,
// grouped by region and labelled with the city and its current UTC offset.

import { isValidTimeZone } from './onboarding-state'

export interface TimeZoneOption {
  id: string
  /** "Bucharest" */
  city: string
  /** "GMT+3" (current offset, so daylight saving is reflected). */
  offset: string
  label: string
}

export interface TimeZoneGroup {
  region: string
  zones: TimeZoneOption[]
}

// Used only by runtimes without Intl.supportedValuesOf (older Safari).
const FALLBACK_ZONES = [
  'UTC',
  'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris', 'Europe/Brussels',
  'Europe/Amsterdam', 'Europe/Berlin', 'Europe/Rome', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Prague',
  'Europe/Budapest', 'Europe/Bucharest', 'Europe/Chisinau', 'Europe/Sofia', 'Europe/Athens', 'Europe/Istanbul',
  'Europe/Kyiv', 'Europe/Helsinki', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen', 'Europe/Zurich',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles',
  'America/Anchorage', 'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Bogota',
  'America/Lima', 'America/Santiago', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
  'Pacific/Honolulu', 'Pacific/Auckland',
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Casablanca',
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Jerusalem', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok',
  'Asia/Jakarta', 'Asia/Singapore', 'Asia/Manila', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Taipei',
  'Asia/Seoul', 'Asia/Tokyo',
  'Australia/Perth', 'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Sydney',
]

const REGION_LABELS: Record<string, string> = {
  Africa: 'Africa',
  America: 'Americas',
  Antarctica: 'Antarctica',
  Arctic: 'Arctic',
  Asia: 'Asia',
  Atlantic: 'Atlantic',
  Australia: 'Australia',
  Europe: 'Europe',
  Indian: 'Indian Ocean',
  Pacific: 'Pacific',
}

const REGION_ORDER = ['UTC', 'Europe', 'Americas', 'Asia', 'Africa', 'Australia', 'Pacific', 'Atlantic', 'Indian Ocean', 'Arctic', 'Antarctica', 'Other']

export function supportedTimeZones(): string[] {
  try {
    const list = Intl.supportedValuesOf('timeZone')
    if (list.length > 0) return list.includes('UTC') ? list : ['UTC', ...list]
  } catch {
    // Not available in this runtime: use the built-in list.
  }
  return FALLBACK_ZONES
}

/** "GMT+3", "GMT-4:30", "GMT" for the given moment. */
export function utcOffsetLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')
    return part?.value ?? 'GMT'
  } catch {
    return 'GMT'
  }
}

/** "America/Argentina/Buenos_Aires" → "Buenos Aires (Argentina)". */
export function cityLabel(timeZone: string): string {
  const parts = timeZone.split('/')
  if (parts.length === 1) return timeZone === 'UTC' ? 'Coordinated Universal Time' : timeZone.replace(/_/g, ' ')
  const city = parts[parts.length - 1].replace(/_/g, ' ')
  const middle = parts.slice(1, -1).map((p) => p.replace(/_/g, ' '))
  return middle.length > 0 ? `${city} (${middle.join(', ')})` : city
}

export function timeZoneOption(id: string, at: Date = new Date()): TimeZoneOption {
  const city = cityLabel(id)
  const offset = utcOffsetLabel(id, at)
  return { id, city, offset, label: `${city} · ${offset}` }
}

/** Grouped options; `current` is always included even when the runtime lists it under another name. */
export function timeZoneGroups(current: string | null, at: Date = new Date()): TimeZoneGroup[] {
  const ids = new Set(supportedTimeZones())
  if (current && isValidTimeZone(current)) ids.add(current)

  const groups = new Map<string, TimeZoneOption[]>()
  for (const id of ids) {
    const prefix = id.includes('/') ? id.split('/')[0] : id === 'UTC' ? 'UTC' : 'Other'
    const region = prefix === 'UTC' || prefix === 'Other' ? prefix : REGION_LABELS[prefix] ?? 'Other'
    const list = groups.get(region) ?? []
    list.push(timeZoneOption(id, at))
    groups.set(region, list)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b))
    .map(([region, zones]) => ({ region, zones: zones.sort((a, b) => a.city.localeCompare(b.city)) }))
}
