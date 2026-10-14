// Romanian labels of the e-commerce vertical, in one place so a run, an order
// or a connection reads the same in the overview, the tables, the call sheet
// and the toasts. Every map is typed as a total Record of its union (the
// compiler refuses a missing key) and the test in tests/commerce-ui-labels
// guards the copy itself (no empty label, diacritics intact).
//
// Client-safe: types and strings only (the script variable names come from
// lib/commerce/prompt.ts, which is pure and client-safe too).

import type { StatusTone } from '@/components/shared/StatusChip'
import { SCRIPT_VARIABLES as SCRIPT_VARIABLE_NAMES, type ScriptVariable } from '@/lib/commerce/prompt'
import type {
  AutomationType,
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

// ─── Runs ─────────────────────────────────────────────────────────────────────

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  eligible: 'Eligibil',
  scheduled: 'Programat',
  calling: 'În apel',
  completed: 'Finalizat',
  suppressed: 'Suprimat',
  skipped: 'Omis',
  failed: 'Eșuat',
  retry_waiting: 'Reîncercare',
  cancelled: 'Anulat',
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
  confirmed: 'Confirmată',
  not_confirmed: 'Neconfirmată',
  callback_requested: 'Revenire cerută',
  voicemail: 'Mesagerie vocală',
  no_answer: 'Fără răspuns',
  opted_out: 'Nu mai suna',
  failed: 'Eșuat',
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
  draft: 'Neconfigurat',
  connecting: 'Se conectează',
  active: 'Conectat',
  degraded: 'Conectat cu probleme',
  disconnected: 'Deconectat',
  error: 'Eroare',
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
  idle: 'Nicio sincronizare în curs',
  pending: 'Sincronizare în așteptare',
  running: 'Sincronizare în curs',
  succeeded: 'Sincronizare reușită',
  failed: 'Sincronizare eșuată',
  cancelled: 'Sincronizare anulată',
}

export const SYNC_KIND_LABEL: Record<SyncJobKind, string> = {
  initial: 'inițială',
  incremental: 'incrementală',
  manual: 'manuală',
  recovery: 'de recuperare',
}

export const SYNC_RESOURCE_LABEL: Record<SyncResource | 'all', string> = {
  all: 'toate datele',
  products: 'produse',
  customers: 'clienți',
  orders: 'comenzi',
  carts: 'coșuri',
}

// ─── Automations ──────────────────────────────────────────────────────────────

export const AUTOMATION_TYPE_LABEL: Record<AutomationType, string> = {
  cod_confirmation: 'Confirmare ramburs',
  abandoned_cart: 'Coș abandonat',
  order_follow_up: 'Urmărire comandă',
}

export const AUTOMATION_TYPE_DESCRIPTION: Record<AutomationType, string> = {
  cod_confirmation: 'Sună clientul după o comandă cu plata la livrare și confirmă comanda înainte de expediere.',
  abandoned_cart: 'Sună clientul care a lăsat un coș cu telefon de contact și îl ajută să finalizeze comanda.',
  order_follow_up: 'Sună clientul după ce comanda ajunge la statusul ales și verifică dacă totul este în ordine.',
}

/** Why PUT /api/commerce/automations/[type] { enabled: true } answered 409, in the merchant's words. */
export const ENABLE_BLOCKED_REASON: Record<string, { message: string; href: string | null; action: string | null }> = {
  no_consent: {
    message: 'Confirmă mai întâi acordul clienților pentru apeluri, în pagina Automatizări.',
    href: '/magazin/automatizari',
    action: 'Deschide automatizările',
  },
  unavailable: {
    message: 'Platforma magazinului nu oferă datele necesare acestei automatizări.',
    href: '/magazin/conexiuni',
    action: 'Vezi conexiunea',
  },
  agent_inactive: {
    message: 'Agentul este oprit. Pornește-l din pagina Agent înainte de a activa automatizarea.',
    href: '/agent',
    action: 'Deschide agentul',
  },
  no_phone_number: {
    message: 'Magazinul nu are un număr de telefon activ pentru apeluri.',
    href: '/phone',
    action: 'Adaugă un număr',
  },
  encryption_not_configured: {
    message: 'Platforma nu are configurată criptarea datelor magazinului. Contactează echipa de suport.',
    href: null,
    action: null,
  },
  connection_inactive: {
    message: 'Conexiunea cu magazinul nu este activă. Reconectează magazinul mai întâi.',
    href: '/magazin/conexiuni',
    action: 'Vezi conexiunea',
  },
}

/** The consent the merchant confirms before any automation may call (exact wording, kept with the automation). */
export const CONSENT_TEXT =
  'Confirm că am temei legal și acordul clienților pentru a fi contactați telefonic de magazin, inclusiv prin asistent AI, și că voi respecta cererile de a nu mai fi sunați.'

/**
 * What each typed script variable resolves to, as the help box documents it.
 * Total over the server's list (lib/commerce/prompt.ts SCRIPT_VARIABLES): a
 * variable the server accepts and the default scripts use must be documented
 * here, or the form would reject the default script.
 */
export const SCRIPT_VARIABLE_DESCRIPTION: Record<ScriptVariable, string> = {
  store_name: 'Numele magazinului (din profil sau „Numele brandului” de mai jos).',
  order_number: 'Numărul comenzii sau referința coșului.',
  items_summary: 'Produsele din comandă, pe scurt („2 × Tricou alb, 1 × Șapcă”).',
  order_total: 'Totalul comenzii, cu moneda.',
  customer_name: 'Numele clientului, așa cum apare în comandă.',
  delivery_city: 'Orașul de livrare din comandă (gol pentru un coș fără adresă).',
  agent_name: 'Numele agentului, așa cum este setat în pagina Agent.',
  call_reason: 'Motivul apelului: cod_confirmation, abandoned_cart sau order_follow_up.',
}

/** The variables a script template may use, in the server's order, with their descriptions. */
export const SCRIPT_VARIABLES: ReadonlyArray<{ name: ScriptVariable; description: string }> = SCRIPT_VARIABLE_NAMES.map((name) => ({
  name,
  description: SCRIPT_VARIABLE_DESCRIPTION[name],
}))

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: 'Luni',
  tuesday: 'Marți',
  wednesday: 'Miercuri',
  thursday: 'Joi',
  friday: 'Vineri',
  saturday: 'Sâmbătă',
  sunday: 'Duminică',
}

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  monday: 'Lu',
  tuesday: 'Ma',
  wednesday: 'Mi',
  thursday: 'Jo',
  friday: 'Vi',
  saturday: 'Sâ',
  sunday: 'Du',
}

export const TONE_LABEL: Record<'formal' | 'friendly', string> = {
  formal: 'Formal',
  friendly: 'Prietenos',
}

// ─── Records ──────────────────────────────────────────────────────────────────

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'În așteptare',
  processing: 'În procesare',
  on_hold: 'Suspendată',
  completed: 'Finalizată',
  cancelled: 'Anulată',
  refunded: 'Rambursată',
  failed: 'Eșuată',
  draft: 'Ciornă',
  unknown: 'Necunoscută',
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
  pending: 'Plată în așteptare',
  authorized: 'Plată autorizată',
  paid: 'Plătită',
  partially_paid: 'Plătită parțial',
  partially_refunded: 'Rambursată parțial',
  refunded: 'Rambursată',
  voided: 'Plată anulată',
  unknown: 'Plată necunoscută',
}

export const FULFILLMENT_STATUS_LABEL: Record<FulfillmentStatus, string> = {
  unfulfilled: 'Neexpediată',
  partial: 'Expediată parțial',
  fulfilled: 'Expediată',
  cancelled: 'Expediere anulată',
  unknown: 'Expediere necunoscută',
}

/** Order statuses an order follow-up may wait for (OrderStatus plus the shipped state). */
export const FOLLOW_UP_STATUS_LABEL: Record<OrderStatus | 'fulfilled', string> = {
  ...ORDER_STATUS_LABEL,
  fulfilled: 'Expediată',
}

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  active: 'Activ',
  draft: 'Ciornă',
  archived: 'Arhivat',
  unknown: 'Necunoscut',
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  in_stock: 'În stoc',
  out_of_stock: 'Stoc epuizat',
  on_backorder: 'La comandă',
  unknown: 'Stoc necunoscut',
}

export const STOCK_STATUS_TONE: Record<StockStatus, StatusTone> = {
  in_stock: 'success',
  out_of_stock: 'danger',
  on_backorder: 'warning',
  unknown: 'muted',
}

export const SUPPRESSION_SOURCE_LABEL: Record<SuppressionSource, string> = {
  customer_opt_out: 'Clientul a cerut',
  operator: 'Operator',
  provider: 'Platforma magazinului',
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
  return readLabel(AUTOMATION_TYPE_LABEL, value) ?? 'Automatizare'
}

export function orderStatusLabel(value: string | null | undefined): string {
  return readLabel(ORDER_STATUS_LABEL, value) ?? ORDER_STATUS_LABEL.unknown
}

export function stockStatusLabel(value: string | null | undefined): string {
  return readLabel(STOCK_STATUS_LABEL, value) ?? STOCK_STATUS_LABEL.unknown
}

export function suppressionSourceLabel(value: string | null | undefined): string {
  return readLabel(SUPPRESSION_SOURCE_LABEL, value) ?? 'Necunoscută'
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

/** "Apel automat · Confirmare ramburs · Comanda #1234 · Confirmată" (the call sheet's one-line summary). */
export function runSummaryLine(run: { automation_type: string; reference: string; outcome: string | null; status: string }): string {
  const result = runOutcomeLabel(run.outcome) ?? runStatusLabel(run.status)
  return ['Apel automat', automationTypeLabel(run.automation_type), `Comanda #${run.reference}`, result].join(' · ')
}
