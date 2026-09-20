// Merging what save_lead_details captured into calls.extracted, keyed so the
// dashboard, exports and workflows can read it. Answers the model put in
// `notes` as "question: answer" pairs are matched to the owner's own lead
// questions when possible. Pure.

import type { LeadField } from '@/types'
import { normalizeForMatch, similarity } from '@/lib/scheduling/text'

export interface LeadDetails {
  name: string | null
  email: string | null
  need: string | null
  budget: string | null
  timing: string | null
  notes: string | null
}

export const MAX_EXTRACTED_KEYS = 40
export const MAX_EXTRACTED_VALUE_CHARS = 500

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isPlausibleEmail(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value)
}

/** Spoken-style addresses ("ana at example dot com") and stray spaces → a plain address. */
export function normalizeSpokenEmail(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+(?:at|arobase|arroba|chiocciola|małpa|apenstaartje)\s+/g, '@')
    .replace(/\s+(?:dot|punct|punto|point|punkt|kropka|punt|ponto)\s+/g, '.')
    .replace(/\s+/g, '')
}

function clip(value: string): string {
  const chars = Array.from(value.trim())
  return chars.length <= MAX_EXTRACTED_VALUE_CHARS ? chars.join('') : chars.slice(0, MAX_EXTRACTED_VALUE_CHARS).join('')
}

function matchLeadField(label: string, fields: readonly LeadField[]): LeadField | null {
  const wanted = normalizeForMatch(label)
  if (!wanted) return null
  let best: { field: LeadField; score: number } | null = null
  for (const field of fields) {
    const candidates = [field.key.replace(/_/g, ' '), field.label, field.question].map((v) => normalizeForMatch(v)).filter(Boolean)
    for (const candidate of candidates) {
      const score = candidate === wanted ? 1 : similarity(candidate, wanted)
      if (score >= 0.8 && (!best || score > best.score)) best = { field, score }
    }
  }
  return best?.field ?? null
}

export interface LeadMergeResult {
  extracted: Record<string, string>
  saved: string[]
  invalidEmail: boolean
}

export function mergeLeadDetails(
  existing: Record<string, unknown> | null | undefined,
  details: LeadDetails,
  leadFields: readonly LeadField[]
): LeadMergeResult {
  const extracted: Record<string, string> = {}
  for (const [key, value] of Object.entries(existing ?? {})) {
    if (typeof value === 'string') extracted[key] = value
  }
  const saved: string[] = []
  const set = (key: string, value: string | null) => {
    if (value === null || !value.trim()) return
    if (!(key in extracted) && Object.keys(extracted).length >= MAX_EXTRACTED_KEYS) return
    extracted[key] = clip(value)
    if (!saved.includes(key)) saved.push(key)
  }

  let invalidEmail = false
  if (details.email) {
    const email = normalizeSpokenEmail(details.email)
    if (isPlausibleEmail(email)) set('email', email)
    else invalidEmail = true
  }
  set('name', details.name)
  set('need', details.need)
  set('budget', details.budget)
  set('timing', details.timing)

  if (details.notes) {
    const leftovers: string[] = []
    for (const part of details.notes.split(/[;\n]+/)) {
      const piece = part.trim()
      if (!piece) continue
      const colon = piece.indexOf(':')
      const field = colon > 0 ? matchLeadField(piece.slice(0, colon), leadFields) : null
      const answer = colon > 0 ? piece.slice(colon + 1).trim() : ''
      if (field && answer && !['name', 'email', 'need', 'budget', 'timing', 'notes'].includes(field.key)) set(field.key, answer)
      else leftovers.push(piece)
    }
    // The latest notes describe the lead as a whole, so they replace older ones.
    if (leftovers.length > 0) set('notes', leftovers.join('; '))
  }
  return { extracted, saved, invalidEmail }
}
