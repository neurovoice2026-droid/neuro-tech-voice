// Date and time formatting for the inbox, always in an explicit time zone so
// the owner sees business-local times whatever the browser's zone is.

function safeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone })
    return timeZone
  } catch {
    return 'UTC'
  }
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: safeZone(timeZone),
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: safeZone(timeZone), hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/** "Tuesday, 16 September 2026" in the zone. */
export function formatDayHeading(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: safeZone(timeZone),
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

/** Stable per-day key (YYYY-MM-DD) in the zone, for grouping. */
export function dayKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** "5 minutes ago", "yesterday", falling back to a date after a week. */
export function formatRelative(iso: string, timeZone: string, now: Date = new Date()): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diffSeconds)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (abs < 45) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(diffSeconds / 3600), 'hour')
  if (abs < 7 * 86_400) return rtf.format(Math.round(diffSeconds / 86_400), 'day')
  return formatDateTime(iso, timeZone)
}

/** Phone numbers are shown exactly as stored (E.164): grouping rules differ per country. */
export function displayPhone(value: string | null | undefined): string {
  return value?.trim() ?? ''
}
