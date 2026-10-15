import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import type { Plan, PlanConfig } from '@/types'
import { PLANS } from '@/types'
import { countryCallingCode, normalizeE164 } from '@/lib/phone/e164'

// ─── Tailwind class merge ─────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Duration formatting ──────────────────────────────────────────────────────
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

// ─── Phone number formatting ──────────────────────────────────────────────────
/**
 * Digit groups of a national number for countries without a rule of their
 * own: threes from the left, ending on a four rather than a lone digit, and on
 * two fours rather than a pair (9 → 3 3 3, 10 → 3 3 4, 8 → 4 4).
 */
function genericGroups(n: number): number[] {
  if (n <= 4) return [n]
  const tail = n % 3 === 1 ? [4] : n % 3 === 2 ? (n >= 8 ? [4, 4] : [2]) : []
  const head = n - tail.reduce((a, b) => a + b, 0)
  return [...Array<number>(head / 3).fill(3), ...tail]
}

/** How a country's national number is grouped; null = genericGroups. */
function nationalGroups(cc: string, national: string): number[] | null {
  const n = national.length
  // Romania: mobiles and most landlines 3 3 3, Bucharest (21x / 31x) 2 3 4.
  if (cc === '40' && n === 9) return /^[23]1/.test(national) ? [2, 3, 4] : [3, 3, 3]
  // UK: mobiles and most 01 numbers 4 6, London-style 02 numbers 2 4 4, 03 / 08 / 09 and the
  // big cities' three-digit 011x / 01x1 codes (0121 Birmingham, 0161 Manchester) 3 3 4.
  if (cc === '44' && n === 10) {
    if (national[0] === '2') return [2, 4, 4]
    if (/^1(1|\d1)/.test(national)) return [3, 3, 4]
    if (national[0] === '7' || national[0] === '1') return [4, 6]
    return [3, 3, 4]
  }
  return null
}

/**
 * E.164 → readable international form: +14155551234 → +1 (415) 555-1234,
 * +40723000027 → +40 723 000 027, +447700900123 → +44 7700 900123; any other
 * country gets its calling code and the national number in groups. Anything
 * that is not an international number (a masked "+40 7** *** 027", a national
 * "0723 000 027", a SIP id) is returned as it came.
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const [, area, prefix, line] = cleaned.match(/^1(\d{3})(\d{3})(\d{4})$/) ?? []
    if (area) return `+1 (${area}) ${prefix}-${line}`
  }
  const e164 = normalizeE164(phone)
  const cc = e164 ? countryCallingCode(e164) : null
  if (!e164 || !cc) return phone
  const national = e164.slice(1 + cc.length)
  const groups: string[] = []
  let at = 0
  for (const size of nationalGroups(cc, national) ?? genericGroups(national.length)) {
    groups.push(national.slice(at, at + size))
    at += size
  }
  return `+${cc} ${groups.join(' ')}`
}

// ─── Date formatting ──────────────────────────────────────────────────────────
export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

// ─── Sentiment color ──────────────────────────────────────────────────────────
export function getSentimentColor(sentiment: string | null): string {
  switch (sentiment) {
    case 'positive':
      return 'text-green-500'
    case 'negative':
      return 'text-red-500'
    case 'neutral':
    default:
      return 'text-yellow-500'
  }
}

// ─── File size formatting ─────────────────────────────────────────────────────
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Plan limits ──────────────────────────────────────────────────────────────
export function getPlanLimits(plan: Plan): PlanConfig {
  return PLANS[plan]
}
