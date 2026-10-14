// The automation configuration form: its zod schema, how an AutomationDto
// becomes form values and how form values become the PUT body. Pure and
// client-safe; unit-tested in tests/commerce-ui-schemas.

import { z } from 'zod'
import { AutomationConfigSchema } from '@/lib/commerce/automations/config'
import { unknownScriptVariables } from '@/lib/commerce/prompt'
import type { AutomationConfig, AutomationDto, AutomationScript, AutomationType, OrderStatus } from '@/lib/commerce/types'
import { E164_REGEX } from '@/lib/phone/e164'
import { WEEKDAYS, type Weekday, parseClock } from '@/lib/scheduling/time'
import { ORDER_STATUSES } from './labels'

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

/** Abandoned carts are called no sooner than this (the customer may still be checking out). */
export const ABANDONED_CART_MIN_DELAY = 30

const FOLLOW_UP_STATUSES = [...ORDER_STATUSES, 'fulfilled'] as const

/**
 * The numeric bounds and text lengths of the form, read from the server's
 * AutomationConfigSchema so the form never accepts a value the PUT rejects
 * (the inputs' min/max/maxLength use the same numbers).
 */
const CONFIG_SHAPE = AutomationConfigSchema.shape
function numberBounds(schema: { minValue: number | null; maxValue: number | null }, fallback: readonly [number, number]): readonly [number, number] {
  return [schema.minValue ?? fallback[0], schema.maxValue ?? fallback[1]]
}
export const AUTOMATION_LIMITS = {
  delay_minutes: numberBounds(CONFIG_SHAPE.delay_minutes, [0, 10_080]),
  daily_cap: numberBounds(CONFIG_SHAPE.daily_cap, [1, 2_000]),
  per_customer_daily_cap: numberBounds(CONFIG_SHAPE.per_customer_daily_cap, [1, 5]),
  max_attempts: numberBounds(CONFIG_SHAPE.max_attempts, [1, 4]),
  retry_minutes: numberBounds(CONFIG_SHAPE.retry_minutes, [15, 4_320]),
  cod_method_max_length: CONFIG_SHAPE.cod_payment_methods.element.maxLength ?? 60,
  cod_methods_max: 20,
} as const

const integer = (min: number, max: number) =>
  z
    .number({ error: 'Introdu un număr întreg' })
    .int('Introdu un număr întreg')
    .min(min, `Cel puțin ${min}`)
    .max(max, `Cel mult ${max}`)

const httpsUrlOrEmpty = z
  .string()
  .trim()
  .max(500, 'Cel mult 500 de caractere')
  .refine((v) => v === '' || (URL.canParse(v) && new URL(v).protocol === 'https:'), 'Adresa trebuie să înceapă cu https://')

export function automationFormSchema(type: AutomationType) {
  return z
    .object({
      delay_minutes: integer(...AUTOMATION_LIMITS.delay_minutes),
      window_start: z.string().regex(CLOCK, 'Ora de început este de forma 09:00'),
      window_end: z.string().regex(CLOCK, 'Ora de sfârșit este de forma 18:00'),
      days: z.array(z.enum(WEEKDAYS)).min(1, 'Alege cel puțin o zi'),
      /** '' = the organization's time zone. */
      timezone: z.string().trim().max(64),
      daily_cap: integer(...AUTOMATION_LIMITS.daily_cap),
      per_customer_daily_cap: integer(...AUTOMATION_LIMITS.per_customer_daily_cap),
      max_attempts: integer(...AUTOMATION_LIMITS.max_attempts),
      retry_minutes: integer(...AUTOMATION_LIMITS.retry_minutes),
      cod_payment_methods: z
        .array(z.string().trim().min(1).max(AUTOMATION_LIMITS.cod_method_max_length, `Cel mult ${AUTOMATION_LIMITS.cod_method_max_length} de caractere`))
        .max(AUTOMATION_LIMITS.cod_methods_max, `Cel mult ${AUTOMATION_LIMITS.cod_methods_max} de metode`),
      follow_up_status: z.enum(FOLLOW_UP_STATUSES),
      /** Text so an empty field reads as "any total" rather than NaN. */
      min_order_total: z
        .string()
        .trim()
        .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Introdu o sumă pozitivă sau lasă gol'),
      template: z.string().trim().min(20, 'Scriptul are cel puțin 20 de caractere').max(4_000, 'Cel mult 4000 de caractere'),
      tone: z.enum(['formal', 'friendly']),
      brand_name: z.string().trim().max(100, 'Cel mult 100 de caractere'),
      transfer_number: z
        .string()
        .trim()
        .refine((v) => v === '' || E164_REGEX.test(v), 'Număr în format internațional, de exemplu +40712345678'),
      return_policy_url: httpsUrlOrEmpty,
    })
    .superRefine((values, ctx) => {
      // Same rule as the server's CallWindowSchema: the window ends after it starts (no overnight windows).
      if (!((parseClock(values.window_start) ?? 0) < (parseClock(values.window_end) ?? 0))) {
        ctx.addIssue({ code: 'custom', path: ['window_end'], message: 'Ora de început trebuie să fie înaintea orei de sfârșit' })
      }
      if (type === 'abandoned_cart' && values.delay_minutes < ABANDONED_CART_MIN_DELAY) {
        ctx.addIssue({ code: 'custom', path: ['delay_minutes'], message: `Coșurile abandonate se sună după cel puțin ${ABANDONED_CART_MIN_DELAY} de minute` })
      }
      if (type === 'cod_confirmation' && values.cod_payment_methods.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['cod_payment_methods'], message: 'Adaugă cel puțin o metodă de plată care înseamnă ramburs' })
      }
      for (const name of unknownTemplateVariables(values.template)) {
        ctx.addIssue({ code: 'custom', path: ['template'], message: `Variabila {{${name}}} nu există; folosește-le pe cele din caseta de ajutor` })
      }
    })
}

export type AutomationFormValues = z.infer<ReturnType<typeof automationFormSchema>>

/** Variable names used in a template, in order of first use, without duplicates. */
export function templateVariables(template: string): string[] {
  const out: string[] = []
  for (const match of template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    if (!out.includes(match[1])) out.push(match[1])
  }
  return out
}

/** The server's own check (lib/commerce/prompt.ts), so the form and AutomationScriptSchema agree on the typed variables. */
export function unknownTemplateVariables(template: string): string[] {
  return unknownScriptVariables(template)
}

// ─── Server validation issues → form fields ──────────────────────────────────

/** The form field behind each path of the PUT body (`config.*`, `script.*`) a 400 may point at. */
const SERVER_FIELD: Record<string, keyof AutomationFormValues> = {
  'config.delay_minutes': 'delay_minutes',
  'config.call_window': 'window_end',
  'config.call_window.start': 'window_start',
  'config.call_window.end': 'window_end',
  'config.call_window.days': 'days',
  'config.timezone': 'timezone',
  'config.daily_cap': 'daily_cap',
  'config.per_customer_daily_cap': 'per_customer_daily_cap',
  'config.max_attempts': 'max_attempts',
  'config.retry_minutes': 'retry_minutes',
  'config.cod_payment_methods': 'cod_payment_methods',
  'config.follow_up_status': 'follow_up_status',
  'config.min_order_total': 'min_order_total',
  'script.template': 'template',
  'script.tone': 'tone',
  'script.brand_name': 'brand_name',
  'script.transfer_number': 'transfer_number',
  'script.return_policy_url': 'return_policy_url',
}

/** The form field a server issue path belongs to (`config.cod_payment_methods.3` → the list), or null when the form has none. */
export function formFieldForIssuePath(path: string): keyof AutomationFormValues | null {
  let key = path
  while (key) {
    const field = SERVER_FIELD[key]
    if (field) return field
    const dot = key.lastIndexOf('.')
    if (dot < 0) return null
    key = key.slice(0, dot)
  }
  return null
}

export interface ServerFieldError {
  field: keyof AutomationFormValues
  message: string
}

/**
 * Field errors from the `details` of a 400 (`[{ path, message }]`, lib/api/http.ts
 * parseJsonBody): one per form field, in the server's order; issues on paths the
 * form has no field for are left out (the caller falls back to a toast).
 */
export function serverFieldErrors(details: unknown): ServerFieldError[] {
  if (!Array.isArray(details)) return []
  const out: ServerFieldError[] = []
  const seen = new Set<keyof AutomationFormValues>()
  for (const item of details) {
    if (!item || typeof item !== 'object') continue
    const { path, message } = item as { path?: unknown; message?: unknown }
    if (typeof path !== 'string') continue
    const field = formFieldForIssuePath(path)
    if (!field || seen.has(field)) continue
    seen.add(field)
    out.push({ field, message: typeof message === 'string' && message.trim() ? message.trim() : 'Valoarea nu este acceptată' })
  }
  return out
}

function readDays(days: string[] | undefined): Weekday[] {
  const known = (days ?? []).filter((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(d))
  return known.length ? known : [...WEEKDAYS]
}

export function formValuesFrom(automation: AutomationDto): AutomationFormValues {
  const { config, script } = automation
  return {
    delay_minutes: config.delay_minutes,
    window_start: config.call_window?.start ?? '09:00',
    window_end: config.call_window?.end ?? '20:00',
    days: readDays(config.call_window?.days),
    timezone: config.timezone ?? '',
    daily_cap: config.daily_cap,
    per_customer_daily_cap: config.per_customer_daily_cap,
    max_attempts: config.max_attempts,
    retry_minutes: config.retry_minutes,
    cod_payment_methods: [...(config.cod_payment_methods ?? [])],
    follow_up_status: config.follow_up_status ?? 'processing',
    min_order_total: config.min_order_total === null || config.min_order_total === undefined ? '' : String(config.min_order_total),
    template: script.template ?? '',
    tone: script.tone ?? 'friendly',
    brand_name: script.brand_name ?? '',
    transfer_number: script.transfer_number ?? '',
    return_policy_url: script.return_policy_url ?? '',
  }
}

/** The PUT body parts. Only the fields a type uses are sent, so the other types' defaults stay untouched on the server. */
export function bodyFromValues(type: AutomationType, values: AutomationFormValues): { config: Partial<AutomationConfig>; script: Partial<AutomationScript> } {
  const config: Partial<AutomationConfig> = {
    delay_minutes: values.delay_minutes,
    call_window: { start: values.window_start, end: values.window_end, days: values.days },
    timezone: values.timezone || null,
    daily_cap: values.daily_cap,
    per_customer_daily_cap: values.per_customer_daily_cap,
    max_attempts: values.max_attempts,
    retry_minutes: values.retry_minutes,
  }
  if (type === 'cod_confirmation') config.cod_payment_methods = values.cod_payment_methods
  if (type === 'order_follow_up') config.follow_up_status = values.follow_up_status as OrderStatus | 'fulfilled'
  if (type === 'abandoned_cart') config.min_order_total = values.min_order_total === '' ? null : Number(values.min_order_total)
  const script: Partial<AutomationScript> = {
    template: values.template,
    tone: values.tone,
    brand_name: values.brand_name || null,
    transfer_number: values.transfer_number || null,
    return_policy_url: values.return_policy_url || null,
  }
  return { config, script }
}
