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
    .number({ error: 'Enter a whole number' })
    .int('Enter a whole number')
    .min(min, `At least ${min}`)
    .max(max, `At most ${max}`)

const httpsUrlOrEmpty = z
  .string()
  .trim()
  .max(500, 'At most 500 characters')
  .refine((v) => v === '' || (URL.canParse(v) && new URL(v).protocol === 'https:'), 'The address must start with https://')

export function automationFormSchema(type: AutomationType) {
  return z
    .object({
      delay_minutes: integer(...AUTOMATION_LIMITS.delay_minutes),
      window_start: z.string().regex(CLOCK, 'The start time looks like 09:00'),
      window_end: z.string().regex(CLOCK, 'The end time looks like 18:00'),
      days: z.array(z.enum(WEEKDAYS)).min(1, 'Choose at least one day'),
      /** '' = the organization's time zone. */
      timezone: z.string().trim().max(64),
      daily_cap: integer(...AUTOMATION_LIMITS.daily_cap),
      per_customer_daily_cap: integer(...AUTOMATION_LIMITS.per_customer_daily_cap),
      max_attempts: integer(...AUTOMATION_LIMITS.max_attempts),
      retry_minutes: integer(...AUTOMATION_LIMITS.retry_minutes),
      cod_payment_methods: z
        .array(z.string().trim().min(1).max(AUTOMATION_LIMITS.cod_method_max_length, `At most ${AUTOMATION_LIMITS.cod_method_max_length} characters`))
        .max(AUTOMATION_LIMITS.cod_methods_max, `At most ${AUTOMATION_LIMITS.cod_methods_max} payment methods`),
      follow_up_status: z.enum(FOLLOW_UP_STATUSES),
      /** Text so an empty field reads as "any total" rather than NaN. */
      min_order_total: z
        .string()
        .trim()
        .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Enter a positive amount or leave it empty'),
      template: z.string().trim().min(20, 'The script needs at least 20 characters').max(4_000, 'At most 4000 characters'),
      tone: z.enum(['formal', 'friendly']),
      brand_name: z.string().trim().max(100, 'At most 100 characters'),
      transfer_number: z
        .string()
        .trim()
        .refine((v) => v === '' || E164_REGEX.test(v), 'Use the international format, for example +40712345678'),
      return_policy_url: httpsUrlOrEmpty,
    })
    .superRefine((values, ctx) => {
      // Same rule as the server's CallWindowSchema: the window ends after it starts (no overnight windows).
      if (!((parseClock(values.window_start) ?? 0) < (parseClock(values.window_end) ?? 0))) {
        ctx.addIssue({ code: 'custom', path: ['window_end'], message: 'The start time must be before the end time' })
      }
      if (type === 'abandoned_cart' && values.delay_minutes < ABANDONED_CART_MIN_DELAY) {
        ctx.addIssue({ code: 'custom', path: ['delay_minutes'], message: `Abandoned carts are called after at least ${ABANDONED_CART_MIN_DELAY} minutes` })
      }
      if (type === 'cod_confirmation' && values.cod_payment_methods.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['cod_payment_methods'], message: 'Add at least one payment method that means cash on delivery' })
      }
      for (const name of unknownTemplateVariables(values.template)) {
        ctx.addIssue({ code: 'custom', path: ['template'], message: `The variable {{${name}}} does not exist; use the ones listed in the help box` })
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

/** Shown on a field whose server issue carried no usable message. */
export const GENERIC_FIELD_ERROR = 'This value is not accepted'

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
    out.push({ field, message: typeof message === 'string' && message.trim() ? message.trim() : GENERIC_FIELD_ERROR })
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
