// IANA time zone validation shared by the settings API and the time zone
// picker. Client-safe.

let cachedZones: Set<string> | null = null

/** Every canonical zone the runtime knows (Intl.supportedValuesOf), plus UTC. */
export function supportedTimeZones(): string[] {
  return [...zoneSet()].sort()
}

function zoneSet(): Set<string> {
  if (cachedZones) return cachedZones
  let zones: string[] = []
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = []
  }
  cachedZones = new Set([...zones, 'UTC'])
  return cachedZones
}

/**
 * The canonical spelling of a zone the runtime supports, or null. Aliases are
 * resolved ("Europe/Kiev" → "Europe/Kyiv") so what we store is what
 * Intl.supportedValuesOf lists.
 */
export function canonicalTimeZone(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const input = value.trim()
  if (!input || input.length > 64) return null
  const zones = zoneSet()
  if (zones.has(input)) return input
  try {
    const resolved = new Intl.DateTimeFormat('en-US', { timeZone: input }).resolvedOptions().timeZone
    if (zones.has(resolved)) return resolved
    // Etc/UTC, Etc/GMT and friends resolve to themselves; treat them as UTC.
    if (/^(Etc\/)?(UTC|GMT|UCT|Zulu|Universal)$/i.test(resolved)) return 'UTC'
  } catch {
    return null
  }
  return null
}

/** "GMT+03:00" for a zone at a given instant; "GMT" for UTC. */
export function timeZoneOffsetLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value
    return part ?? 'GMT'
  } catch {
    return 'GMT'
  }
}
