// Copy tables of the store onboarding: the form's option lists, capability
// names and the lines of an automation card. Pure data, in English (the
// agent's own calls follow the store's language, see lib/commerce/prompt.ts).
// Whatever the dashboard shows too (statuses, the Shopify install errors,
// the automation names, the consent) comes from components/commerce/labels.ts
// so a row reads the same in the flow and in the Store section.

import { CONNECTION_STATUSES, CONNECTION_STATUS_LABEL, CONNECTION_STATUS_TONE } from '@/components/commerce/labels'
import type { StatusTone } from '@/components/shared/StatusChip'
import type { AutomationConfig, AutomationType, CommerceCapabilities, ConnectionStatus } from '@/lib/commerce/types'

// ─── Step 1 option lists ──────────────────────────────────────────────────────

export const COUNTRIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'RO', label: 'Romania' },
  { value: 'MD', label: 'Moldova' },
  { value: 'HU', label: 'Hungary' },
  { value: 'BG', label: 'Bulgaria' },
  { value: 'DE', label: 'Germany' },
  { value: 'AT', label: 'Austria' },
  { value: 'IT', label: 'Italy' },
  { value: 'ES', label: 'Spain' },
  { value: 'FR', label: 'France' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'IE', label: 'Ireland' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
  { value: 'PL', label: 'Poland' },
  { value: 'CZ', label: 'Czechia' },
  { value: 'SK', label: 'Slovakia' },
  { value: 'GR', label: 'Greece' },
  { value: 'PT', label: 'Portugal' },
  { value: 'SE', label: 'Sweden' },
  { value: 'DK', label: 'Denmark' },
  { value: 'NO', label: 'Norway' },
  { value: 'FI', label: 'Finland' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'TR', label: 'Turkey' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
]

export const TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'Europe/Bucharest', label: 'Europe/Bucharest (Romania)' },
  { value: 'Europe/Chisinau', label: 'Europe/Chisinau (Moldova)' },
  { value: 'Europe/Budapest', label: 'Europe/Budapest' },
  { value: 'Europe/Sofia', label: 'Europe/Sofia' },
  { value: 'Europe/Athens', label: 'Europe/Athens' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw' },
  { value: 'Europe/Prague', label: 'Europe/Prague' },
  { value: 'Europe/Vienna', label: 'Europe/Vienna' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin' },
  { value: 'Europe/Rome', label: 'Europe/Rome' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam' },
  { value: 'Europe/Brussels', label: 'Europe/Brussels' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich' },
  { value: 'Europe/Stockholm', label: 'Europe/Stockholm' },
  { value: 'Europe/Copenhagen', label: 'Europe/Copenhagen' },
  { value: 'Europe/Oslo', label: 'Europe/Oslo' },
  { value: 'Europe/Helsinki', label: 'Europe/Helsinki' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Dublin', label: 'Europe/Dublin' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'America/Chicago', label: 'America/Chicago' },
  { value: 'America/Denver', label: 'America/Denver' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
  { value: 'America/Toronto', label: 'America/Toronto' },
  { value: 'UTC', label: 'UTC' },
]

export const CURRENCIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'RON', label: 'RON – Romanian leu' },
  { value: 'EUR', label: 'EUR – euro' },
  { value: 'MDL', label: 'MDL – Moldovan leu' },
  { value: 'USD', label: 'USD – US dollar' },
  { value: 'GBP', label: 'GBP – pound sterling' },
  { value: 'HUF', label: 'HUF – Hungarian forint' },
  { value: 'BGN', label: 'BGN – Bulgarian lev' },
  { value: 'PLN', label: 'PLN – Polish złoty' },
  { value: 'CZK', label: 'CZK – Czech koruna' },
  { value: 'CHF', label: 'CHF – Swiss franc' },
]

// ─── Connections ──────────────────────────────────────────────────────────────

/** The dashboard's connection statuses with their chip tone: a connection reads the same in Step 3 and in Store → Connections. */
export const CONNECTION_STATUS = Object.fromEntries(
  CONNECTION_STATUSES.map((status) => [status, { label: CONNECTION_STATUS_LABEL[status], tone: CONNECTION_STATUS_TONE[status] }]),
) as Record<ConnectionStatus, { label: string; tone: StatusTone }>

export { SYNC_STATUS_LABEL as SYNC_STATUS } from '@/components/commerce/labels'

export const CAPABILITY_LABELS: ReadonlyArray<{ key: keyof Pick<CommerceCapabilities, 'orders' | 'customers' | 'products' | 'webhooks' | 'abandoned_carts' | 'customer_phone'>; label: string }> = [
  { key: 'orders', label: 'Orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'products', label: 'Products' },
  { key: 'customer_phone', label: 'Customer phone numbers' },
  { key: 'webhooks', label: 'Real-time events (webhooks)' },
  { key: 'abandoned_carts', label: 'Abandoned carts' },
]

/** The codes the Shopify callback may append as ?commerce_error=, in the words the Connections page shows too. */
export { OAUTH_ERRORS, oauthErrorMessage } from '@/components/commerce/labels'

// ─── Automations ──────────────────────────────────────────────────────────────

// The automation names and descriptions are the dashboard's
// (components/commerce/labels.ts AUTOMATION_TYPE_LABEL / AUTOMATION_TYPE_DESCRIPTION),
// and a refused enable shows the route's own message. The consent is the
// versioned wording the server records, so the merchant confirms exactly the
// text stored under CONSENT_VERSION.
export { CONSENT_TEXT } from '@/lib/commerce/automations/config'

const DAY_LABELS: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

export function formatDays(days: string[]): string {
  if (!days.length) return 'no days'
  return days.map((d) => DAY_LABELS[d.toLowerCase().slice(0, 3)] ?? d).join(', ')
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'pending',
  processing: 'processing',
  on_hold: 'on hold',
  completed: 'completed',
  fulfilled: 'fulfilled',
  cancelled: 'canceled',
  refunded: 'refunded',
  failed: 'failed',
  draft: 'draft',
  unknown: 'unknown',
}

const WITH_PHONE_NOT_SUPPRESSED = 'when the order has a valid phone number and it is not on the do-not-call list'

/** Trigger / contact-rule lines of an automation card, from its config. */
export function automationRules(type: AutomationType, config: AutomationConfig): { trigger: string; contact: string } {
  if (type === 'cod_confirmation') {
    const methods = config.cod_payment_methods.length ? config.cod_payment_methods.join(', ') : 'the cash-on-delivery methods the platform recognizes'
    return {
      trigger: `New cash-on-delivery order (${methods})`,
      contact: `The order’s customer, ${WITH_PHONE_NOT_SUPPRESSED}`,
    }
  }
  if (type === 'abandoned_cart') {
    const min = config.min_order_total !== null ? ` worth at least ${config.min_order_total}` : ''
    return {
      trigger: `Abandoned cart${min}, after ${formatMinutes(config.delay_minutes)}`,
      contact: 'The cart’s customer, when the phone number is known and it is not on the do-not-call list',
    }
  }
  return {
    trigger: `Order moves to the “${ORDER_STATUS_LABELS[config.follow_up_status] ?? config.follow_up_status}” status`,
    contact: `The order’s customer, ${WITH_PHONE_NOT_SUPPRESSED}`,
  }
}

// ─── Launch checklist ─────────────────────────────────────────────────────────

/**
 * Dashboard pages a checklist item may point to that are a step of this very flow. Before the
 * launch the dashboard redirects to /onboarding, so such an item is fixed by moving to its step;
 * every other page (phone number, billing…) is reachable only after the launch.
 */
const CHECKLIST_STEP_BY_PATH: ReadonlyArray<readonly [prefix: string, step: number]> = [
  ['/store/connections', 3],
  ['/store/automations', 4],
  ['/agent', 5],
]

export function checklistStepFor(href: string | null | undefined): number | null {
  if (!href) return null
  const path = href.split(/[?#]/)[0]
  const hit = CHECKLIST_STEP_BY_PATH.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))
  return hit ? hit[1] : null
}

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}
