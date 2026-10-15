import 'server-only'
// Auto top-up (off by default, set on the billing page): when an organization's
// total minutes (included left + prepaid extra) drop below the owner's
// threshold, the chosen minute pack is charged off-session to the saved
// payment method through a Stripe invoice, so the usual invoice.paid path
// (SmartBill fiscal invoice + payment e-mail) applies to it too.
//   • at most one attempt per organization per AUTO_TOPUP_COOLDOWN_SECONDS
//     (claim_auto_topup, a DB claim: concurrent call webhooks and the cron
//     sweep never charge twice);
//   • every Stripe write carries an idempotency key derived from the org id
//     and the claim timestamp;
//   • success: credit_minute_purchase (idempotent on the invoice id; the
//     invoice.paid webhook credits the same invoice again as a no-op);
//   • payment failure (a declined card, a bank asking to confirm, no saved
//     card, an invoice left unpaid): the open invoice is voided, a 'failed'
//     minute_purchases row is recorded, auto top-up is turned off with the
//     reason stored and the owner is e-mailed. It is never retried
//     automatically;
//   • Stripe unavailable (5xx, network, rate limit, our own API key): no
//     payment was refused, so nothing is recorded against the owner and auto
//     top-up stays on; an unpaid invoice is still voided, and the claim
//     cooldown makes the next try wait AUTO_TOPUP_COOLDOWN_SECONDS;
//   • one pack always clears the threshold: a threshold above the pack size
//     acts as the pack size (the settings API refuses saving one), so a single
//     charge per depletion, never a charge every cooldown until the threshold
//     is reached.
// Callers: call-store (after a call's usage is recorded) and the maintenance
// cron (sweepAutoTopUps). Neither lets a failure here fail its own work.

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { sendEmail } from '@/lib/email/client'
import { autoTopUpFailedEmail } from '@/lib/email/templates'
import { isMinutePack, minutesCapacity, packQuote, type MinutePack } from './minute-packs'
import { autoTopUpThreshold, canBuyMinutes } from './minutes-summary'

/** One attempt per organization per this many seconds (claim_auto_topup). */
export const AUTO_TOPUP_COOLDOWN_SECONDS = 600

/** Organizations the cron sweep looks at per run. */
const SWEEP_LIMIT = 100

/** Minute packs are priced in US dollars, like the plans. */
const CURRENCY = 'usd'

const ORG_COLUMNS =
  'id, user_id, plan, minutes_used, minutes_limit, extra_minutes_balance, auto_topup_enabled, auto_topup_pack, auto_topup_threshold, auto_topup_last_attempt_at, stripe_customer_id, stripe_subscription_id, deletion_requested_at'

interface TopUpOrg {
  id: string
  user_id: string | null
  plan: string | null
  minutes_used: number | null
  minutes_limit: number | null
  extra_minutes_balance: number | null
  auto_topup_enabled: boolean | null
  auto_topup_pack: number | null
  auto_topup_threshold: number | null
  auto_topup_last_attempt_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  deletion_requested_at?: string | null
}

export type AutoTopUpSkipReason =
  | 'not_configured'
  | 'org_not_found'
  | 'disabled'
  | 'not_available'
  | 'invalid_pack'
  | 'above_threshold'
  | 'cooldown'
  /** Stripe could not be reached or answered with a server error: tried again after the cooldown, auto top-up stays on. */
  | 'stripe_unavailable'

export type AutoTopUpResult =
  | { status: 'skipped'; reason: AutoTopUpSkipReason }
  /** Paid and credited (or already credited by the invoice.paid webhook). */
  | { status: 'credited'; minutes: MinutePack; amountCents: number; invoiceId: string; balanceAfter: number | null }
  /** Paid, but the credit write failed: the invoice.paid webhook credits it (idempotent on the invoice id). */
  | { status: 'paid'; minutes: MinutePack; amountCents: number; invoiceId: string }
  | { status: 'failed'; minutes: MinutePack; reason: string }

export interface AutoTopUpDeps {
  stripe?: Stripe
}

/** The minutes-pack metadata stamped on an auto top-up invoice (read by the billing webhook). */
export function autoTopUpMetadata(orgId: string, minutes: MinutePack, plan: string): Record<string, string> {
  return { type: 'minute_pack', source: 'auto_topup', org_id: orgId, minutes: String(minutes), plan }
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

/**
 * The payment method an off-session charge may use: the plan subscription's
 * default payment method (Checkout sets it), else the customer's invoice
 * default. Null when neither is saved. Stripe API errors are thrown.
 */
export async function resolveDefaultPaymentMethod(
  stripe: Stripe,
  ids: { customerId: string; subscriptionId: string | null },
): Promise<string | null> {
  if (ids.subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(ids.subscriptionId)
    const fromSubscription = idOf(subscription.default_payment_method)
    if (fromSubscription) return fromSubscription
  }
  const customer = await stripe.customers.retrieve(ids.customerId)
  if ((customer as Stripe.DeletedCustomer).deleted) return null
  return idOf((customer as Stripe.Customer).invoice_settings?.default_payment_method)
}

function paymentIntentOf(invoice: Stripe.Invoice): string | null {
  for (const payment of invoice.payments?.data ?? []) {
    const id = idOf(payment.payment?.payment_intent)
    if (id) return id
  }
  return null
}

const MAX_FAILURE_LENGTH = 300

/**
 * A short, customer-safe reason. Card errors carry Stripe's own message,
 * written for the cardholder (never card data); anything else gets a generic
 * sentence (the full error goes to the log only).
 */
export function autoTopUpFailureMessage(err: unknown): string {
  const e = (err ?? {}) as { type?: unknown; rawType?: unknown; code?: unknown; message?: unknown }
  if (e.code === 'invoice_payment_intent_requires_action' || e.code === 'authentication_required') {
    return 'Your bank asked to confirm this payment, which cannot be done automatically. Buy minutes from the billing page instead.'
  }
  if ((e.type === 'StripeCardError' || e.rawType === 'card_error') && typeof e.message === 'string' && e.message.trim()) {
    return e.message.trim().slice(0, MAX_FAILURE_LENGTH)
  }
  return 'The payment could not be completed.'
}

class TopUpFailure extends Error {
  constructor(readonly reason: string) {
    super(reason)
    this.name = 'TopUpFailure'
  }
}

/**
 * Whether an error from the charge says something about the owner's payment
 * ('payment': turn auto top-up off and tell the owner) or only that Stripe
 * could not answer ('transient': try again after the cooldown). Payment: a
 * card error, a bank asking to confirm, no saved card or an unpaid invoice
 * (TopUpFailure), and an invalid request (a detached card, a deleted
 * customer: the owner has to act). Everything else is transient: Stripe's
 * 5xx (StripeAPIError), network failures and timeouts
 * (StripeConnectionError), rate limits and idempotency conflicts (429 / 409),
 * our own API key or permissions, and any error that is not Stripe's.
 */
export function topUpFailureKind(err: unknown): 'payment' | 'transient' {
  if (err instanceof TopUpFailure) return 'payment'
  const e = (err ?? {}) as { type?: unknown; rawType?: unknown; code?: unknown; statusCode?: unknown }
  if (e.type === 'StripeCardError' || e.rawType === 'card_error') return 'payment'
  if (e.code === 'authentication_required' || e.code === 'invoice_payment_intent_requires_action') return 'payment'
  if (e.type === 'StripeInvalidRequestError' || e.rawType === 'invalid_request_error') {
    return e.statusCode === 409 || e.statusCode === 429 ? 'transient' : 'payment'
  }
  return 'transient'
}

/**
 * The threshold the charge decision uses: the owner's (default 50), never
 * above the pack size, so one pack always brings the minutes back above it.
 */
export function effectiveAutoTopUpThreshold(threshold: number | null | undefined, pack: number | null | undefined): number {
  const chosen = autoTopUpThreshold(threshold)
  return isMinutePack(pack) ? Math.min(chosen, pack) : chosen
}

async function readOrg(db: SupabaseClient, orgId: string): Promise<TopUpOrg | null> {
  const { data, error } = await db.from('organizations').select(ORG_COLUMNS).eq('id', orgId).maybeSingle()
  if (error) throw new Error(`organizations auto top-up read failed: ${error.message}`)
  return (data as TopUpOrg | null) ?? null
}

/** Why this organization would not be topped up now, or null when it should be. */
function skipReason(org: TopUpOrg, now: number, opts: { checkCooldown: boolean }): AutoTopUpSkipReason | null {
  if (org.auto_topup_enabled !== true) return 'disabled'
  if (org.deletion_requested_at || !canBuyMinutes(org.plan) || !org.stripe_customer_id || !org.stripe_subscription_id) return 'not_available'
  if (!isMinutePack(org.auto_topup_pack)) return 'invalid_pack'
  if (minutesCapacity(org).total >= effectiveAutoTopUpThreshold(org.auto_topup_threshold, org.auto_topup_pack)) return 'above_threshold'
  if (opts.checkCooldown && org.auto_topup_last_attempt_at) {
    const last = Date.parse(org.auto_topup_last_attempt_at)
    if (Number.isFinite(last) && now - last < AUTO_TOPUP_COOLDOWN_SECONDS * 1000) return 'cooldown'
  }
  return null
}

/**
 * Charges the organization's auto top-up pack when its total minutes are
 * below the threshold. Never throws for a payment problem (that is a
 * 'failed' result); a database read error is thrown to the caller, which
 * treats the whole step as best-effort.
 */
export async function maybeAutoTopUp(db: SupabaseClient, orgId: string, log: Logger, deps: AutoTopUpDeps = {}): Promise<AutoTopUpResult> {
  const org = await readOrg(db, orgId)
  if (!org) return { status: 'skipped', reason: 'org_not_found' }
  // The DB claim enforces the cooldown; it is not pre-checked here.
  const skip = skipReason(org, Date.now(), { checkCooldown: false })
  if (skip) return { status: 'skipped', reason: skip }
  if (!deps.stripe && !isStripeConfigured()) return { status: 'skipped', reason: 'not_configured' }

  const pack = org.auto_topup_pack as MinutePack
  const plan = org.plan as string
  const quote = packQuote(plan, pack)
  if (!quote) return { status: 'skipped', reason: 'not_available' }

  const { data: claimed, error: claimErr } = await db.rpc('claim_auto_topup', { p_org_id: orgId, p_cooldown_seconds: AUTO_TOPUP_COOLDOWN_SECONDS })
  if (claimErr) throw new Error(`claim_auto_topup failed: ${claimErr.message}`)
  if (claimed !== true) return { status: 'skipped', reason: 'cooldown' }

  const l = log.child({ orgId, component: 'auto_topup' })
  const stripe = deps.stripe ?? getStripeClient()
  const customerId = org.stripe_customer_id as string
  const claimedAt = await claimTimestamp(db, orgId)
  const key = `ntv_topup_${orgId}_${claimedAt}`
  const metadata = autoTopUpMetadata(orgId, pack, plan)
  const description = `${pack.toLocaleString('en-US')} extra minutes`
  let invoiceId: string | null = null

  try {
    const paymentMethod = await resolveDefaultPaymentMethod(stripe, { customerId, subscriptionId: org.stripe_subscription_id })
    if (!paymentMethod) throw new TopUpFailure('No saved payment method was found. Add a card in the billing portal.')
    const invoice = await stripe.invoices.create(
      {
        customer: customerId,
        collection_method: 'charge_automatically',
        // Collected right below, off-session; Stripe never retries it on its own.
        auto_advance: false,
        pending_invoice_items_behavior: 'exclude',
        currency: CURRENCY,
        default_payment_method: paymentMethod,
        description: `Auto top-up: ${description}`,
        metadata,
      },
      { idempotencyKey: `${key}_invoice` },
    )
    invoiceId = invoice.id
    await stripe.invoiceItems.create(
      { customer: customerId, invoice: invoice.id, amount: quote.amount_cents, currency: CURRENCY, description, metadata },
      { idempotencyKey: `${key}_item` },
    )
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id, { auto_advance: false }, { idempotencyKey: `${key}_finalize` })
    const paid =
      finalized.status === 'paid'
        ? finalized
        : await stripe.invoices.pay(invoice.id, { off_session: true, payment_method: paymentMethod, expand: ['payments'] }, { idempotencyKey: `${key}_pay` })
    if (paid.status !== 'paid') throw new TopUpFailure('The payment could not be completed.')
    return await credit(db, l, orgId, pack, paid)
  } catch (err) {
    // A lost response may hide a payment that went through: ask Stripe before calling it a failure.
    if (invoiceId) {
      const settled = await retrieveQuietly(stripe, invoiceId, l)
      if (settled?.status === 'paid') return await credit(db, l, orgId, pack, settled)
      if (settled) await discardInvoice(stripe, settled, l)
    }
    if (topUpFailureKind(err) === 'transient') {
      // Nothing was refused: no failed purchase, no e-mail, auto top-up stays on (next try after the cooldown).
      const e = (err ?? {}) as { type?: unknown; statusCode?: unknown }
      l.warn('auto_topup.stripe_unavailable', {
        minutes: pack,
        invoiceId,
        errorType: typeof e.type === 'string' ? e.type : err instanceof Error ? err.name : 'unknown',
        statusCode: typeof e.statusCode === 'number' ? e.statusCode : null,
      })
      return { status: 'skipped', reason: 'stripe_unavailable' }
    }
    const reason = err instanceof TopUpFailure ? err.reason : autoTopUpFailureMessage(err)
    l.error('auto_topup.charge_failed', err, { minutes: pack, invoiceId })
    await recordFailure(db, l, org, { pack, amountCents: quote.amount_cents, invoiceId, reason })
    return { status: 'failed', minutes: pack, reason }
  }
}

/** The claim timestamp just written by claim_auto_topup (ms), for the idempotency keys. */
async function claimTimestamp(db: SupabaseClient, orgId: string): Promise<number> {
  const { data, error } = await db.from('organizations').select('auto_topup_last_attempt_at').eq('id', orgId).maybeSingle()
  const at = !error && data?.auto_topup_last_attempt_at ? Date.parse(data.auto_topup_last_attempt_at as string) : NaN
  return Number.isFinite(at) ? at : Date.now()
}

async function retrieveQuietly(stripe: Stripe, invoiceId: string, log: Logger): Promise<Stripe.Invoice | null> {
  try {
    return await stripe.invoices.retrieve(invoiceId, { expand: ['payments'] })
  } catch (err) {
    log.warn('auto_topup.invoice_recheck_failed', { invoiceId, error: err instanceof Error ? err.message.slice(0, 200) : 'unknown' })
    return null
  }
}

/** An unpaid top-up invoice must never be collected later: void it (open) or delete it (draft). */
async function discardInvoice(stripe: Stripe, invoice: Stripe.Invoice, log: Logger): Promise<void> {
  try {
    if (invoice.status === 'open') await stripe.invoices.voidInvoice(invoice.id)
    else if (invoice.status === 'draft') await stripe.invoices.del(invoice.id)
  } catch (err) {
    log.error('auto_topup.invoice_discard_failed', err, { invoiceId: invoice.id, invoiceStatus: invoice.status })
  }
}

async function credit(db: SupabaseClient, log: Logger, orgId: string, pack: MinutePack, invoice: Stripe.Invoice): Promise<AutoTopUpResult> {
  const amountCents = invoice.amount_paid ?? 0
  const { data, error } = await db.rpc('credit_minute_purchase', {
    p_org_id: orgId,
    p_minutes: pack,
    p_amount_cents: amountCents,
    p_currency: invoice.currency ?? CURRENCY,
    p_source: 'auto_topup',
    p_checkout_session_id: null,
    p_invoice_id: invoice.id,
    p_payment_intent_id: paymentIntentOf(invoice),
  })
  if (error) {
    // The money is collected: the invoice.paid webhook credits the same invoice.
    log.error('auto_topup.credit_deferred_to_webhook', new Error(error.message), { invoiceId: invoice.id, minutes: pack })
    return { status: 'paid', minutes: pack, amountCents, invoiceId: invoice.id }
  }
  const row = (Array.isArray(data) ? data[0] : data) as { credited?: boolean; balance_after?: number | null } | null
  log.info('auto_topup.credited', { invoiceId: invoice.id, minutes: pack, newlyCredited: row?.credited ?? null })
  return { status: 'credited', minutes: pack, amountCents, invoiceId: invoice.id, balanceAfter: row?.balance_after ?? null }
}

async function recordFailure(
  db: SupabaseClient,
  log: Logger,
  org: TopUpOrg,
  failure: { pack: MinutePack; amountCents: number; invoiceId: string | null; reason: string },
): Promise<void> {
  const nowIso = new Date().toISOString()
  const { error: insertErr } = await db.from('minute_purchases').insert({
    org_id: org.id,
    minutes: failure.pack,
    amount_cents: failure.amountCents,
    currency: CURRENCY,
    source: 'auto_topup',
    status: 'failed',
    stripe_invoice_id: failure.invoiceId,
    failure_message: failure.reason,
  })
  if (insertErr) log.error('auto_topup.failure_record_failed', new Error(insertErr.message))
  // Turned off so nothing charges the card again until the owner turns it back on.
  const { error: updateErr } = await db
    .from('organizations')
    .update({ auto_topup_enabled: false, auto_topup_failed_at: nowIso, auto_topup_failure: failure.reason })
    .eq('id', org.id)
  if (updateErr) log.error('auto_topup.disable_failed', new Error(updateErr.message))
  await emailOwner(db, log, org, failure)
}

async function emailOwner(db: SupabaseClient, log: Logger, org: TopUpOrg, failure: { pack: MinutePack; amountCents: number; reason: string }): Promise<void> {
  if (!org.user_id) return
  try {
    const { data, error } = await db.auth.admin.getUserById(org.user_id)
    if (error) throw new Error(error.message)
    const email = data?.user?.email
    if (!email) return
    await sendEmail({
      to: email,
      ...autoTopUpFailedEmail({ minutes: failure.pack, amount: failure.amountCents / 100, currency: CURRENCY, reason: failure.reason }),
    })
  } catch (err) {
    log.error('auto_topup.failure_email_failed', err)
  }
}

export interface AutoTopUpSweepReport {
  checked: number
  attempted: number
  credited: number
  failed: number
  deferred: number
}

/**
 * Cron step: tops up every organization with auto top-up on whose minutes
 * are below its threshold (e.g. the owner turned it on while already low, or
 * the attempt after a call could not run). Stops at the deadline; the rest
 * waits for the next run.
 */
export async function sweepAutoTopUps(db: SupabaseClient, log: Logger, deadline: number, deps: AutoTopUpDeps = {}): Promise<AutoTopUpSweepReport> {
  const report: AutoTopUpSweepReport = { checked: 0, attempted: 0, credited: 0, failed: 0, deferred: 0 }
  if (!deps.stripe && !isStripeConfigured()) return report
  const { data, error } = await db
    .from('organizations')
    .select(ORG_COLUMNS)
    .eq('auto_topup_enabled', true)
    .not('stripe_subscription_id', 'is', null)
    .order('auto_topup_last_attempt_at', { ascending: true, nullsFirst: true })
    .limit(SWEEP_LIMIT)
  if (error) throw new Error(`organizations auto top-up scan failed: ${error.message}`)
  for (const org of (data ?? []) as TopUpOrg[]) {
    report.checked += 1
    if (skipReason(org, Date.now(), { checkCooldown: true })) continue
    if (Date.now() >= deadline) {
      report.deferred += 1
      continue
    }
    try {
      const res = await maybeAutoTopUp(db, org.id, log, deps)
      if (res.status === 'skipped') continue
      report.attempted += 1
      if (res.status === 'failed') report.failed += 1
      else report.credited += 1
    } catch (err) {
      log.error('auto_topup.sweep_org_failed', err, { orgId: org.id })
    }
  }
  return report
}
