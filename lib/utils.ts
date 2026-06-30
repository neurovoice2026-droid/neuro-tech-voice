import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
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
export function formatPhoneNumber(phone: string): string {
  // E.164 → readable: +14155551234 → +1 (415) 555-1234
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const [, area, prefix, line] = cleaned.match(/^1(\d{3})(\d{3})(\d{4})$/) ?? []
    if (area) return `+1 (${area}) ${prefix}-${line}`
  }
  // Fallback: just return with a space after country code
  return phone
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
