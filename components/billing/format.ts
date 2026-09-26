// Formatting shared by the billing components (server and client). Dates are
// shown in the organisation's time zone so server-rendered text matches what
// the owner sees on their own calendar.

export function formatUsd(amount: number, opts: { cents?: boolean } = {}): string {
  const cents = opts.cents ?? !Number.isInteger(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(amount)
}

export function formatMoney(amount: number, currency: string | null | undefined): string {
  const code = (currency || 'USD').toUpperCase()
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${code}`
  }
}

export function formatRate(perMinute: number): string {
  return `$${perMinute.toFixed(2)}/min`
}

export function formatMinutes(minutes: number): string {
  return `${new Intl.NumberFormat('en-US').format(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

/** "Oct 3, 2026" in the given IANA zone; falls back to UTC for unknown zones. */
export function formatDay(iso: string | null | undefined, timeZone: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timeZone || 'UTC' }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date)
  }
}
