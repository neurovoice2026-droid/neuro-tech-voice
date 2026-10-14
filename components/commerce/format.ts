// Romanian number, money and time formatting for the Magazin section. Pure
// and client-safe; every function accepts the nullable DTO fields as they
// come and answers "—" rather than throwing on a value it cannot read.

const LOCALE = 'ro-RO'

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toLocaleString(LOCALE)
}

/** "1.234,50 RON"; an unknown currency code falls back to "1234.50 XYZ", no currency to the bare number. */
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—'
  if (!currency) return amount.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, currencyDisplay: 'code' }).format(amount)
  } catch (err) {
    // A code Intl does not know (RangeError): show the number and the code as given.
    if (err instanceof RangeError) return `${amount.toFixed(2)} ${currency}`
    throw err
  }
}

function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isFinite(date.getTime()) ? date : null
}

/** "13 oct. 2026, 14:05" in the viewer's zone (the DTO timestamps are instants). */
export function formatDateTime(iso: string | null | undefined): string {
  const date = parseIso(iso)
  if (!date) return '—'
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

/** "13 oct. 2026". */
export function formatDate(iso: string | null | undefined): string {
  const date = parseIso(iso)
  if (!date) return '—'
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

/**
 * Compact "time ago" for sync times and run activity: "chiar acum",
 * "acum 5 min", "acum 2 h", "acum 3 zile", then the date from a week on.
 * Always rounds down, like the dashboard's relativeTime.
 */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  const date = parseIso(iso)
  if (!date) return '—'
  const minutes = Math.floor(Math.max(0, now - date.getTime()) / 60_000)
  if (minutes < 1) return 'chiar acum'
  if (minutes < 60) return `acum ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `acum ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? 'acum o zi' : `acum ${days} zile`
  return formatDate(iso)
}

/** "15 minute", "1 oră", "2 ore 30 minute" for delays and retry intervals. */
export function formatMinutes(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) return '—'
  if (minutes === 0) return 'imediat'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const parts: string[] = []
  if (h > 0) parts.push(h === 1 ? '1 oră' : `${h} ore`)
  if (m > 0) parts.push(m === 1 ? '1 minut' : `${m} minute`)
  return parts.join(' ')
}

/** "+40 7** *** 123" stays exactly as the DTO gives it; null reads as a dash. */
export function maskedOrDash(value: string | null | undefined): string {
  return value && value.trim() ? value : '—'
}
