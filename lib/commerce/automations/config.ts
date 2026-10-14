// Automation configuration and script schemas (client-safe: zod only).
// Defaults are conservative: calls only inside 09:00–20:00 local time on
// weekdays and Saturday, one dial plus one retry, 50 calls a day per
// automation, one call per customer per day, abandoned carts never earlier
// than 30 minutes after the event.

import { z } from 'zod'
import { E164_REGEX } from '@/lib/phone/e164'
import { WEEKDAYS, isValidTimeZone, parseClock } from '@/lib/scheduling/time'
import { DEFAULT_SCRIPTS, SCRIPT_VARIABLES, unknownScriptVariables } from '../prompt'
import type { AutomationConfig, AutomationScript, AutomationType, CommerceCapabilities } from '../types'

// Bumped whenever CONSENT_TEXT changes: the version is stored with the
// confirmation, so a stored '2026-10-v1' still names the earlier wording.
export const CONSENT_VERSION = '2026-10-v2'
export const CONSENT_TEXT =
  'I confirm that I have a lawful basis and my customers’ consent to be contacted by phone by the store, including through an AI assistant, and that I will honor every request not to be called again.'

export const DEFAULT_COD_METHODS = ['cod', 'cashondelivery', 'cash_on_delivery', 'ps_cashondelivery', 'Cash on Delivery', 'Ramburs', 'Plata la livrare']

export const ABANDONED_CART_MIN_DELAY_MINUTES = 30

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format')

export const CallWindowSchema = z
  .object({
    start: clock,
    end: clock,
    days: z.array(z.enum(WEEKDAYS)).min(1, 'Choose at least one day').max(7),
  })
  .refine((w) => (parseClock(w.start) ?? 0) < (parseClock(w.end) ?? 0), 'Start time must be before end time')

export const AutomationConfigSchema = z.object({
  delay_minutes: z.number().int().min(0).max(7 * 24 * 60),
  call_window: CallWindowSchema,
  timezone: z.string().trim().max(64).refine((v) => isValidTimeZone(v), 'Unknown time zone').nullable(),
  daily_cap: z.number().int().min(1).max(2000),
  per_customer_daily_cap: z.number().int().min(1).max(5),
  max_attempts: z.number().int().min(1).max(4),
  retry_minutes: z.number().int().min(15).max(3 * 24 * 60),
  cod_payment_methods: z.array(z.string().trim().min(1).max(60)).max(20),
  follow_up_status: z.enum(['pending', 'processing', 'on_hold', 'completed', 'cancelled', 'refunded', 'failed', 'draft', 'unknown', 'fulfilled']),
  min_order_total: z.number().min(0).max(1_000_000).nullable(),
})

export const AutomationScriptSchema = z.object({
  template: z
    .string()
    .trim()
    .min(20, 'The script must be at least 20 characters')
    .max(4000)
    .refine((t) => unknownScriptVariables(t).length === 0, `Only the variables ${SCRIPT_VARIABLES.map((v) => `{{${v}}}`).join(', ')} are allowed`),
  tone: z.enum(['formal', 'friendly']),
  brand_name: z.string().trim().max(100).nullable(),
  transfer_number: z.string().trim().regex(E164_REGEX, 'Use the international format, e.g. +40712345678').nullable(),
  return_policy_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => URL.canParse(v) && new URL(v).protocol === 'https:', 'The URL must start with https://')
    .nullable(),
})

export function defaultConfig(type: AutomationType): AutomationConfig {
  return {
    delay_minutes: type === 'cod_confirmation' ? 15 : type === 'abandoned_cart' ? 60 : 24 * 60,
    call_window: { start: '09:00', end: '20:00', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] },
    timezone: null,
    daily_cap: 50,
    per_customer_daily_cap: 1,
    max_attempts: 2,
    retry_minutes: 120,
    cod_payment_methods: [...DEFAULT_COD_METHODS],
    follow_up_status: 'fulfilled',
    min_order_total: null,
  }
}

export function defaultScript(type: AutomationType, brandName: string | null = null): AutomationScript {
  return { template: DEFAULT_SCRIPTS[type], tone: 'friendly', brand_name: brandName, transfer_number: null, return_policy_url: null }
}

/** Reads stored config leniently (field by field) over the type's defaults; abandoned carts keep the minimum delay. */
export function readAutomationConfig(type: AutomationType, raw: unknown): AutomationConfig {
  const base = defaultConfig(type)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const merged = { ...base, ...(raw as Record<string, unknown>) }
  const parsed = AutomationConfigSchema.safeParse(merged)
  const out: AutomationConfig = parsed.success ? parsed.data : { ...base }
  if (!parsed.success) {
    for (const key of Object.keys(base) as Array<keyof AutomationConfig>) {
      const one = AutomationConfigSchema.safeParse({ ...base, [key]: merged[key] })
      if (one.success) (out as unknown as Record<string, unknown>)[key] = one.data[key]
    }
  }
  if (type === 'abandoned_cart' && out.delay_minutes < ABANDONED_CART_MIN_DELAY_MINUTES) out.delay_minutes = ABANDONED_CART_MIN_DELAY_MINUTES
  return out
}

export function readAutomationScript(type: AutomationType, raw: unknown, brandName: string | null = null): AutomationScript {
  const base = defaultScript(type, brandName)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const merged = { ...base, ...(raw as Record<string, unknown>) }
  const parsed = AutomationScriptSchema.safeParse(merged)
  if (parsed.success) return parsed.data
  const out: AutomationScript = { ...base }
  for (const key of Object.keys(base) as Array<keyof AutomationScript>) {
    const one = AutomationScriptSchema.safeParse({ ...base, [key]: merged[key] })
    if (one.success) (out as unknown as Record<string, unknown>)[key] = one.data[key]
  }
  return out
}

/** Whether a platform connection can feed this automation at all (never shown as available otherwise). */
export function automationAvailability(type: AutomationType, caps: CommerceCapabilities): { available: boolean; reason: string | null } {
  if (!caps.orders && type !== 'abandoned_cart') return { available: false, reason: 'The connection cannot read orders.' }
  if (!caps.customer_phone) return { available: false, reason: 'The platform does not provide customer phone numbers for this connection.' }
  if (type === 'abandoned_cart' && !caps.abandoned_carts) {
    // The adapter's own note about carts wins: it names what the merchant can do about it.
    return { available: false, reason: caps.notes.find((n) => /\bcarts?\b/i.test(n)) ?? 'The platform does not send abandoned-cart events with the customer phone number.' }
  }
  return { available: true, reason: null }
}
