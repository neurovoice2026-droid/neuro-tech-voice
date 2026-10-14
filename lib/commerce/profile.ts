// The store profile kept on organizations.commerce_profile (migration 024):
// what the store onboarding asks beyond the organization name, and what the
// agent prompt and the automation scripts read. Client-safe (zod only).

import { z } from 'zod'
import { E164_REGEX } from '@/lib/phone/e164'

export const COMMERCE_TONES = ['formal', 'friendly'] as const
export type CommerceTone = (typeof COMMERCE_TONES)[number]

const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || (URL.canParse(v) && /^https?:$/.test(new URL(v).protocol)), 'Adresa trebuie să înceapă cu https://')

export const CommerceProfileSchema = z.object({
  display_name: z.string().trim().min(2, 'Numele magazinului are cel puțin 2 caractere').max(100),
  website: url.optional().default(''),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Țara este un cod ISO de două litere'),
  timezone: z.string().trim().min(1).max(64),
  language: z.string().trim().min(2).max(10),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Moneda este un cod ISO de trei litere'),
  tone: z.enum(COMMERCE_TONES).default('friendly'),
  transfer_number: z.string().trim().regex(E164_REGEX, 'Număr în format internațional, ex. +40712345678').nullable().default(null),
  return_policy_url: url.nullable().default(null),
})

export type CommerceProfile = z.infer<typeof CommerceProfileSchema>

export const DEFAULT_COMMERCE_PROFILE: CommerceProfile = {
  display_name: '',
  website: '',
  country: 'RO',
  timezone: 'Europe/Bucharest',
  language: 'ro',
  currency: 'RON',
  tone: 'friendly',
  transfer_number: null,
  return_policy_url: null,
}

/** Reads a stored profile leniently: a bad field falls back to its default, the rest is kept. */
export function readCommerceProfile(raw: unknown): CommerceProfile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_COMMERCE_PROFILE }
  const merged = { ...DEFAULT_COMMERCE_PROFILE, ...(raw as Record<string, unknown>) }
  const parsed = CommerceProfileSchema.safeParse(merged)
  if (parsed.success) return parsed.data
  const out: Record<string, unknown> = { ...DEFAULT_COMMERCE_PROFILE }
  for (const key of Object.keys(DEFAULT_COMMERCE_PROFILE) as Array<keyof CommerceProfile>) {
    const one = CommerceProfileSchema.safeParse({ ...DEFAULT_COMMERCE_PROFILE, display_name: 'xx', [key]: merged[key] })
    if (one.success) out[key] = one.data[key]
  }
  return out as CommerceProfile
}
