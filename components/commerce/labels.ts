// Merchant-facing labels of the e-commerce vertical, in one place so a run,
// an order or a connection reads the same in the overview, the tables, the
// call sheet and the toasts. Every map is typed as a total Record of its
// union (the compiler refuses a missing key) and the test in
// tests/commerce-ui-labels guards the copy itself (no empty label, English
// only, sentence case).
//
// Client-safe: types and strings only (the script variable names come from
// lib/commerce/prompt.ts, the consent wording from
// lib/commerce/automations/config.ts and the out-of-minutes choice from
// lib/billing/upgrade.ts, all pure and client-safe).

import type { StatusTone } from '@/components/shared/StatusChip'
import { SCRIPT_VARIABLES as SCRIPT_VARIABLE_NAMES, type ScriptVariable } from '@/lib/commerce/prompt'
import type {
  AutomationType,
  CommerceProblemCode,
  ConnectionStatus,
  CustomerListDto,
  FinancialStatus,
  FulfillmentStatus,
  OrderStatus,
  ProductStatus,
  RunOutcome,
  RunStatus,
  StockStatus,
  SyncJobKind,
  SyncJobStatus,
  SyncResource,
} from '@/lib/commerce/types'
import type { Weekday } from '@/lib/scheduling/time'
import { outOfMinutesActions, outOfMinutesChoice, type OutOfMinutesAction } from '@/lib/billing/upgrade'
import type { BusinessType } from '@/types'

// ─── Value lists (for filters and the totality tests) ─────────────────────────

export const RUN_STATUSES: readonly RunStatus[] = [
  'eligible', 'scheduled', 'calling', 'completed', 'suppressed', 'skipped', 'failed', 'retry_waiting', 'cancelled',
]
export const RUN_OUTCOMES: readonly RunOutcome[] = [
  'confirmed', 'not_confirmed', 'callback_requested', 'voicemail', 'no_answer', 'opted_out', 'failed',
]
export const CONNECTION_STATUSES: readonly ConnectionStatus[] = [
  'draft', 'connecting', 'active', 'degraded', 'disconnected', 'error',
]
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending', 'processing', 'on_hold', 'completed', 'cancelled', 'refunded', 'failed', 'draft', 'unknown',
]
export const FINANCIAL_STATUSES: readonly FinancialStatus[] = [
  'pending', 'authorized', 'paid', 'partially_paid', 'partially_refunded', 'refunded', 'voided', 'unknown',
]
export const FULFILLMENT_STATUSES: readonly FulfillmentStatus[] = ['unfulfilled', 'partial', 'fulfilled', 'cancelled', 'unknown']
export const PRODUCT_STATUSES: readonly ProductStatus[] = ['active', 'draft', 'archived', 'unknown']
export const STOCK_STATUSES: readonly StockStatus[] = ['in_stock', 'out_of_stock', 'on_backorder', 'unknown']
export const SYNC_STATUSES: readonly (SyncJobStatus | 'idle')[] = ['idle', 'pending', 'running', 'succeeded', 'failed', 'cancelled']

export type SuppressionSource = NonNullable<CustomerListDto['do_not_call_source']>
export const SUPPRESSION_SOURCES: readonly SuppressionSource[] = ['customer_opt_out', 'operator', 'provider']

/** Runs a person may still cancel (POST /api/commerce/runs/[id]/cancel accepts only these). */
export const CANCELLABLE_RUN_STATUSES: readonly RunStatus[] = ['eligible', 'scheduled', 'retry_waiting']

/**
 * Runs whose eligibility_reason the runs table prints under the status: why
 * one was held back (suppressed), is waiting (scheduled, e.g. for minutes:
 * lib/commerce/automations/dispatch.ts MINUTES_WAIT_REASON) or was skipped
 * (e.g. out of minutes for 24 hours, MINUTES_SKIP_REASON).
 */
export const RUN_REASON_STATUSES: readonly RunStatus[] = ['suppressed', 'scheduled', 'skipped']

/** The reason printed under a run's status in the runs table, or null. */
export function runStatusReason(run: { status: RunStatus; eligibility_reason: string | null }): string | null {
  const reason = run.eligibility_reason?.trim()
  return reason && RUN_REASON_STATUSES.includes(run.status) ? reason : null
}

// ─── Store section paths (one place, so a renamed route never leaves a dead link) ──

export const STORE_PATHS = {
  overview: '/store',
  connections: '/store/connections',
  orders: '/store/orders',
  customers: '/store/customers',
  products: '/store/products',
  automations: '/store/automations',
  doNotCall: '/store/do-not-call',
  settings: '/store/settings',
} as const

/** The automations page opened on one template (`?type=` is read by AutomationsPage). */
export function automationHref(type: AutomationType | string): string {
  return `${STORE_PATHS.automations}?type=${encodeURIComponent(type)}`
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  eligible: 'Eligible',
  scheduled: 'Scheduled',
  calling: 'Calling',
  completed: 'Completed',
  suppressed: 'Suppressed',
  skipped: 'Skipped',
  failed: 'Failed',
  retry_waiting: 'Retrying',
  cancelled: 'Canceled',
}

export const RUN_STATUS_TONE: Record<RunStatus, StatusTone> = {
  eligible: 'neutral',
  scheduled: 'info',
  calling: 'info',
  completed: 'success',
  suppressed: 'muted',
  skipped: 'muted',
  failed: 'danger',
  retry_waiting: 'warning',
  cancelled: 'muted',
}

export const RUN_OUTCOME_LABEL: Record<RunOutcome, string> = {
  confirmed: 'Confirmed',
  not_confirmed: 'Not confirmed',
  callback_requested: 'Callback requested',
  voicemail: 'Voicemail',
  no_answer: 'No answer',
  opted_out: 'Opted out',
  failed: 'Failed',
}

export const RUN_OUTCOME_TONE: Record<RunOutcome, StatusTone> = {
  confirmed: 'success',
  not_confirmed: 'warning',
  callback_requested: 'info',
  voicemail: 'muted',
  no_answer: 'muted',
  opted_out: 'danger',
  failed: 'danger',
}

// ─── Connections ──────────────────────────────────────────────────────────────

export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  draft: 'Not set up',
  connecting: 'Connecting',
  active: 'Connected',
  degraded: 'Connected with issues',
  disconnected: 'Disconnected',
  error: 'Error',
}

export const CONNECTION_STATUS_TONE: Record<ConnectionStatus, StatusTone> = {
  draft: 'muted',
  connecting: 'info',
  active: 'success',
  degraded: 'warning',
  disconnected: 'muted',
  error: 'danger',
}

export const SYNC_STATUS_LABEL: Record<SyncJobStatus | 'idle', string> = {
  idle: 'No sync in progress',
  pending: 'Sync queued',
  running: 'Sync in progress',
  succeeded: 'Sync succeeded',
  failed: 'Sync failed',
  cancelled: 'Sync canceled',
}

export const SYNC_KIND_LABEL: Record<SyncJobKind, string> = {
  initial: 'initial',
  incremental: 'incremental',
  manual: 'manual',
  recovery: 'recovery',
}

export const SYNC_RESOURCE_LABEL: Record<SyncResource | 'all', string> = {
  all: 'all data',
  products: 'products',
  customers: 'customers',
  orders: 'orders',
  carts: 'carts',
}

/**
 * The failure codes the Shopify callback appends to its return URL
 * (lib/commerce/shopify-state.ts OAUTH_ERROR_CODES), in the merchant's words.
 * The onboarding step and the Connections page show the same line.
 */
export const OAUTH_ERRORS: Record<string, string> = {
  access_denied: 'The app install was declined in Shopify. You can try again whenever you are ready.',
  invalid_shop: 'The store domain is not a valid myshopify.com domain.',
  state_mismatch: 'The install session expired. Start the connection again.',
  hmac_invalid: 'The response from Shopify could not be verified. Start the connection again.',
  not_configured: 'The Shopify app is not configured on this platform. Contact support.',
  token_exchange_failed: 'Shopify did not issue an access token. Try again.',
  unreachable: 'Shopify did not respond. Check the store domain and try again in a moment.',
}

/** The line for a callback code; an unknown code is shown shortened, never echoed at length. */
export function oauthErrorMessage(code: string): string {
  return OAUTH_ERRORS[code] ?? `The Shopify connection failed (code: ${code.slice(0, 40)}).`
}

// ─── Automations ──────────────────────────────────────────────────────────────

export const AUTOMATION_TYPE_LABEL: Record<AutomationType, string> = {
  cod_confirmation: 'COD confirmation',
  abandoned_cart: 'Abandoned cart',
  order_follow_up: 'Order follow-up',
}

export const AUTOMATION_TYPE_DESCRIPTION: Record<AutomationType, string> = {
  cod_confirmation: 'Calls the customer after a cash-on-delivery order and confirms it before it ships.',
  abandoned_cart: 'Calls a customer who left a cart with a contact phone number and helps them complete the order.',
  order_follow_up: 'Calls the customer once the order reaches the status you choose and checks that everything is in order.',
}

/**
 * Where a refused enable sends the merchant, by the 409's details.reason of
 * PUT /api/commerce/automations/[type]. The toast's text is the route's own
 * message (one wording, in the onboarding and the dashboard alike); this map
 * only adds the page that fixes it.
 */
export const ENABLE_BLOCKED_REASON: Record<string, { href: string | null; action: string | null }> = {
  no_consent: { href: STORE_PATHS.automations, action: 'Open automations' },
  unavailable: { href: STORE_PATHS.connections, action: 'View connection' },
  agent_inactive: { href: '/agent', action: 'Open agent' },
  no_phone_number: { href: '/phone', action: 'Add a number' },
  encryption_not_configured: { href: null, action: null },
  connection_inactive: { href: STORE_PATHS.connections, action: 'View connection' },
}

/**
 * The button of each overview problem (CommerceOverviewDto.problems; the
 * server gives the message and the page that fixes it). Out of minutes goes
 * to the billing page's Minutes section (/billing#minutes): buy a pack or
 * turn on auto top-up. Once the organization's plan is known, out of minutes
 * offers the two-way choice instead (problemActions).
 */
export const PROBLEM_ACTION_LABEL: Record<CommerceProblemCode, string> = {
  no_connection: 'Connect store',
  connection_error: 'View connection',
  credentials_expired: 'Reconnect',
  webhook_failure: 'View connection',
  sync_error: 'View connection',
  no_phone_number: 'Add a number',
  no_consent: 'Confirm consent',
  agent_inactive: 'Open agent',
  minutes_exhausted: 'Buy minutes',
  encryption_not_configured: 'Contact support',
}

/** One button of an overview problem: the out-of-minutes choice, or the page that fixes the problem. */
export interface ProblemAction {
  kind: OutOfMinutesAction['kind'] | 'fix'
  label: string
  href: string
  primary: boolean
}

/** The organization's plan, for the out-of-minutes choice (null while it is not loaded). */
export interface ProblemOrgPlan {
  plan: string | null
  business_type?: BusinessType | null
}

/**
 * The buttons of one overview problem. minutes_exhausted offers the same
 * choice as the dashboard banner and the "out of minutes" e-mail
 * (lib/billing/upgrade.ts): the next plan up of the store's family ("Talk to
 * us" for Store Enterprise) and "Buy 100 minutes for $Y" (not on the trial),
 * linking to /billing#plans and /billing?buy=100#minutes. Until the plan is
 * known, or for any other problem, the single button the server's href
 * points at; no button without an href.
 */
export function problemActions(problem: { code: CommerceProblemCode; href: string | null }, org?: ProblemOrgPlan | null): ProblemAction[] {
  if (problem.code === 'minutes_exhausted' && org) {
    const actions = outOfMinutesActions(outOfMinutesChoice(org.plan, org.business_type ?? null))
    if (actions.length > 0) return actions
  }
  if (!problem.href) return []
  return [{ kind: problem.code === 'minutes_exhausted' ? 'buy' : 'fix', label: PROBLEM_ACTION_LABEL[problem.code] ?? 'Fix', href: problem.href, primary: false }]
}

/**
 * The consent the merchant confirms before any automation may call: the
 * versioned wording the server records (CONSENT_VERSION), so the text shown
 * is exactly the text stored with the confirmation.
 */
export { CONSENT_TEXT } from '@/lib/commerce/automations/config'

/**
 * What each typed script variable resolves to, as the help box documents it.
 * Total over the server's list (lib/commerce/prompt.ts SCRIPT_VARIABLES): a
 * variable the server accepts and the default scripts use must be documented
 * here, or the form would reject the default script.
 */
export const SCRIPT_VARIABLE_DESCRIPTION: Record<ScriptVariable, string> = {
  store_name: 'The store name (from the profile, or the "Brand name" field below).',
  order_number: 'The order number or the cart reference.',
  items_summary: 'The order items, in short ("2 × White T-shirt, 1 × Cap").',
  order_total: 'The order total, with the currency.',
  customer_name: 'The customer name as it appears on the order.',
  delivery_city: 'The delivery city from the order (empty for a cart without an address).',
  agent_name: 'The agent name, as set on the Agent page.',
  call_reason: 'The reason for the call: cod_confirmation, abandoned_cart or order_follow_up.',
}

/** The variables a script template may use, in the server's order, with their descriptions. */
export const SCRIPT_VARIABLES: ReadonlyArray<{ name: ScriptVariable; description: string }> = SCRIPT_VARIABLE_NAMES.map((name) => ({
  name,
  description: SCRIPT_VARIABLE_DESCRIPTION[name],
}))

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

export const TONE_LABEL: Record<'formal' | 'friendly', string> = {
  formal: 'Formal',
  friendly: 'Friendly',
}

// ─── Records ──────────────────────────────────────────────────────────────────

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Canceled',
  refunded: 'Refunded',
  failed: 'Failed',
  draft: 'Draft',
  unknown: 'Unknown',
}

export const ORDER_STATUS_TONE: Record<OrderStatus, StatusTone> = {
  pending: 'warning',
  processing: 'info',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'muted',
  refunded: 'muted',
  failed: 'danger',
  draft: 'muted',
  unknown: 'outline',
}

export const FINANCIAL_STATUS_LABEL: Record<FinancialStatus, string> = {
  pending: 'Payment pending',
  authorized: 'Payment authorized',
  paid: 'Paid',
  partially_paid: 'Partially paid',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
  voided: 'Payment voided',
  unknown: 'Payment unknown',
}

export const FULFILLMENT_STATUS_LABEL: Record<FulfillmentStatus, string> = {
  unfulfilled: 'Unfulfilled',
  partial: 'Partially fulfilled',
  fulfilled: 'Fulfilled',
  cancelled: 'Fulfillment canceled',
  unknown: 'Fulfillment unknown',
}

/** Order statuses an order follow-up may wait for (OrderStatus plus the shipped state). */
export const FOLLOW_UP_STATUS_LABEL: Record<OrderStatus | 'fulfilled', string> = {
  ...ORDER_STATUS_LABEL,
  fulfilled: 'Fulfilled',
}

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  active: 'Active',
  draft: 'Draft',
  archived: 'Archived',
  unknown: 'Unknown',
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  in_stock: 'In stock',
  out_of_stock: 'Out of stock',
  on_backorder: 'On backorder',
  unknown: 'Stock unknown',
}

export const STOCK_STATUS_TONE: Record<StockStatus, StatusTone> = {
  in_stock: 'success',
  out_of_stock: 'danger',
  on_backorder: 'warning',
  unknown: 'muted',
}

export const SUPPRESSION_SOURCE_LABEL: Record<SuppressionSource, string> = {
  customer_opt_out: 'Customer asked',
  operator: 'Operator',
  provider: 'Store platform',
}

// ─── Lenient readers (a value the UI does not know yet reads as itself, never as a blank) ──

function readLabel<K extends string>(map: Record<K, string>, value: string | null | undefined): string | null {
  if (!value) return null
  return Object.hasOwn(map, value) ? map[value as K] : value
}

export function runStatusLabel(value: string | null | undefined): string {
  return readLabel(RUN_STATUS_LABEL, value) ?? '—'
}

export function runOutcomeLabel(value: string | null | undefined): string | null {
  return readLabel(RUN_OUTCOME_LABEL, value)
}

export function connectionStatusLabel(value: string | null | undefined): string {
  return readLabel(CONNECTION_STATUS_LABEL, value) ?? CONNECTION_STATUS_LABEL.draft
}

export function automationTypeLabel(value: string | null | undefined): string {
  return readLabel(AUTOMATION_TYPE_LABEL, value) ?? 'Automation'
}

export function orderStatusLabel(value: string | null | undefined): string {
  return readLabel(ORDER_STATUS_LABEL, value) ?? ORDER_STATUS_LABEL.unknown
}

export function stockStatusLabel(value: string | null | undefined): string {
  return readLabel(STOCK_STATUS_LABEL, value) ?? STOCK_STATUS_LABEL.unknown
}

export function suppressionSourceLabel(value: string | null | undefined): string {
  return readLabel(SUPPRESSION_SOURCE_LABEL, value) ?? 'Unknown'
}

export function runStatusTone(value: string | null | undefined): StatusTone {
  return value && Object.hasOwn(RUN_STATUS_TONE, value) ? RUN_STATUS_TONE[value as RunStatus] : 'outline'
}

export function runOutcomeTone(value: string | null | undefined): StatusTone {
  return value && Object.hasOwn(RUN_OUTCOME_TONE, value) ? RUN_OUTCOME_TONE[value as RunOutcome] : 'outline'
}

export function connectionStatusTone(value: string | null | undefined): StatusTone {
  return value && Object.hasOwn(CONNECTION_STATUS_TONE, value) ? CONNECTION_STATUS_TONE[value as ConnectionStatus] : 'muted'
}

export function orderStatusTone(value: string | null | undefined): StatusTone {
  return value && Object.hasOwn(ORDER_STATUS_TONE, value) ? ORDER_STATUS_TONE[value as OrderStatus] : 'outline'
}

export function stockStatusTone(value: string | null | undefined): StatusTone {
  return value && Object.hasOwn(STOCK_STATUS_TONE, value) ? STOCK_STATUS_TONE[value as StockStatus] : 'muted'
}

/** "Automated call · COD confirmation · Order #1234 · Confirmed" (the call sheet's one-line summary). */
export function runSummaryLine(run: { automation_type: string; reference: string; outcome: string | null; status: string }): string {
  const result = runOutcomeLabel(run.outcome) ?? runStatusLabel(run.status)
  return ['Automated call', automationTypeLabel(run.automation_type), `Order #${run.reference}`, result].join(' · ')
}
