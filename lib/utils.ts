import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { countryCallingCode, isE164 } from '@/lib/phone/e164'
import type { Plan, PlanConfig } from '@/types'
import { PLANS } from '@/types'

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
/** Digits in groups of three, ending on a group of three or four: 364401234 → "364 401 234". */
function groupDigits(digits: string): string {
  const groups: string[] = []
  let rest = digits
  while (rest.length > 4) {
    const take = rest.length === 8 ? 4 : 3
    groups.push(rest.slice(0, take))
    rest = rest.slice(take)
  }
  groups.push(rest)
  return groups.join(' ')
}

export function formatPhoneNumber(phone: string): string {
  // E.164 → readable: +14155551234 → +1 (415) 555-1234
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const [, area, prefix, line] = cleaned.match(/^1(\d{3})(\d{3})(\d{4})$/) ?? []
    if (area) return `+1 (${area}) ${prefix}-${line}`
  }
  // Other countries: calling code, then the national number in readable groups
  // (+40364401234 → +40 364 401 234). Anything that isn't E.164 is shown as typed.
  const e164 = phone.trim()
  const code = isE164(e164) ? countryCallingCode(e164) : null
  if (!code) return phone
  return `+${code} ${groupDigits(e164.slice(1 + code.length))}`
}

// ─── Date formatting ──────────────────────────────────────────────────────────
// Intl instead of date-fns: this module is in almost every page's bundle.
const DATE_TIME = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** "Sep 17, 2026 3:05 PM" in the viewer's time zone. */
export function formatDate(date: string | Date): string {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of DATE_TIME.formatToParts(new Date(date))) parts[part.type] = part.value
  return `${parts.month} ${parts.day}, ${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`
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
