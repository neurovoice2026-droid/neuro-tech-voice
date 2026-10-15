import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getStripeClient, isStripeMissingResource, planFromPriceId, resolvePlanFromPrice } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitInvoiceForStripePayment } from '@/lib/smartbill/emit'
import { sendEmail } from '@/lib/email/client'
import { paymentSuccessEmail, paymentFailedEmail } from '@/lib/email/templates'
import { provisionPhoneNumber } from '@/lib/phone/provision'
import { RELEASABLE_NUMBER_COLUMNS, releaseNumberEverywhere, type ReleasableNumber } from '@/lib/phone/release'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { maskPhone } from '@/lib/phone/e164'
import { isMinutePack } from '@/lib/billing/minute-packs'
import { includedMinutesFor } from '@/lib/billing/stripe-trial'
import { PLANS, isPlan } from '@/types'
import type { BillingInterval, Plan } from '@/types'

// Stripe webhook — must be public (no auth) and is authenticated via the
// Stripe signature instead. Reconciles subscription state into our DB:
//   • plan subscriptions (Checkout mode 'subscription', subscription events)
//     set the plan, its included minutes and the billing interval of its
//     price (organizations.billing_interval, migration 028); a paid renewal
//     or a new subscription (invoice.paid, billing_reason subscription_cycle /
//     subscription_create) starts a new usage period (minutes_used back to 0,
//     start_usage_period, idempotent per period start). An annual plan's
//     months in between are started by the maintenance cron
//     (roll_annual_usage_periods, lib/billing/usage-periods.ts);
//   • extra-minute packs (metadata.type 'minute_pack') are credited through
//     credit_minute_purchase, idempotent on the Checkout session id (bought
//     on the billing page) or the invoice id (auto top-up); a one-time
//     payment never changes the plan;
//   • every paid invoice emits the SmartBill fiscal invoice and the payment
//     e-mail;
//   • customer.subscription.created / updated apply the subscription as
//     Stripe has it now (retrieved again: events arrive out of order), and
//     taking the plan away (an inactive status, a deletion, an untagged
//     price) or renewing the minutes only follows the organization's
//     recorded plan subscription (organizations.stripe_subscription_id), or
//     any while none is recorded: an old or second subscription never puts a
//     paying organization on the trial.

/** metadata.type of a Checkout session / invoice that buys extra minutes. */
const MINUTE_PACK = 'minute_pack'

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Billing webhook not configured' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const rawBody = await request.text()
  const stripe = getStripeClient()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    // The error's type only: a StripeSignatureVerificationError carries the
    // whole event body (customer e-mails, addresses, tax ids) and the header.
    createLogger({ component: 'billing_webhook' }).warn('billing.webhook_signature_invalid', { errorType: errorTypeOf(err) })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const log = createLogger({ component: 'billing_webhook', eventType: event.type })

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.metadata?.type === MINUTE_PACK) {
          await creditMinutePackCheckout(supabase, session, log)
          break
        }
        // Only minute packs can be paid asynchronously (bank methods); plans and numbers are handled on completion.
        if (event.type === 'checkout.session.async_payment_succeeded') break

        if (session.metadata?.type === 'phone_number') {
          await provisionPurchasedNumber(supabase, session)
          break
        }

        // A one-time payment (mode 'payment') is never a plan subscription.
        if (session.mode !== 'subscription') break

        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await applySubscription(supabase, stripe, subscription, session.metadata?.org_id)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const snapshot = event.data.object as Stripe.Subscription
        if (snapshot.metadata?.type === 'phone_number') break
        // Stripe does not deliver events in order (two quick plan switches can
        // arrive C before B): apply the subscription as it is now, never the
        // event's snapshot.
        const current = await retrieveSubscription(stripe, snapshot.id)
        if (!current) {
          log.warn('billing.subscription_gone', { subscriptionId: snapshot.id })
          break
        }
        await applySubscription(supabase, stripe, current)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        if (subscription.metadata?.type === 'phone_number') {
          await releasePhoneNumber(supabase, subscription, log)
        } else {
          await downgradeToTrial(supabase, subscription)
        }
        break
      }
      case 'invoice.paid': {
        // A payment cleared → credit an auto top-up or start the plan's new
        // usage period, then emit the SmartBill fiscal invoice and email the
        // customer a confirmation (every paid invoice, one-time ones included).
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.metadata?.type === MINUTE_PACK) {
          // A pack bought through Checkout is credited from its session (the
          // invoice Checkout issues for it carries no source).
          if (invoice.metadata.source === 'auto_topup') await creditAutoTopUpInvoice(supabase, invoice, log)
        } else {
          await startUsagePeriodOnRenewal(supabase, invoice, log)
        }
        await emitInvoiceForStripePayment(supabase, invoice)
        await sendPaymentSuccess(supabase, stripe, invoice)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        // A failed auto top-up has its own e-mail (lib/billing/auto-topup.ts):
        // it turns auto top-up off, nothing to "keep your agent active" about.
        if (invoice.metadata?.type === MINUTE_PACK) break
        if (invoice.customer_email) {
          await sendEmail({
            to: invoice.customer_email,
            ...paymentFailedEmail({
              amount: (invoice.amount_due ?? 0) / 100,
              currency: invoice.currency ?? undefined,
            }),
          })
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error(`Stripe webhook handler error (${event.type}):`, err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A thrown value's Stripe error type (or class name), never its message or fields. */
function errorTypeOf(err: unknown): string {
  const type = (err as { type?: unknown } | null)?.type
  if (typeof type === 'string') return type
  return err instanceof Error ? err.name : typeof err
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

function firstRow<T>(data: unknown): T | null {
  return ((Array.isArray(data) ? data[0] : data) as T | undefined) ?? null
}

/** The subscription as Stripe has it now; null when it no longer exists. Other API errors are thrown (500, Stripe retries). */
async function retrieveSubscription(stripe: Stripe, id: string): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(id)
  } catch (err) {
    if (isStripeMissingResource(err)) return null
    throw err
  }
}

/**
 * A minute pack bought on the billing page. Credited only once Stripe says
 * the session is paid (an asynchronous payment method completes later, with
 * checkout.session.async_payment_succeeded); idempotent on the session id, so
 * both events and Stripe's retries credit it once. A database error answers
 * 500 so Stripe retries the delivery.
 */
async function creditMinutePackCheckout(supabase: SupabaseClient, session: Stripe.Checkout.Session, log: Logger) {
  if (session.payment_status !== 'paid') {
    log.info('billing.minute_pack_awaiting_payment', { checkoutSessionId: session.id, paymentStatus: session.payment_status })
    return
  }
  const orgId = session.metadata?.org_id
  const minutes = Number(session.metadata?.minutes)
  if (!orgId || !isMinutePack(minutes)) {
    // Paid, but not ours to interpret: needs a human (the session id finds it in Stripe).
    log.error('billing.minute_pack_metadata_invalid', null, { checkoutSessionId: session.id })
    return
  }
  const { data, error } = await supabase.rpc('credit_minute_purchase', {
    p_org_id: orgId,
    p_minutes: minutes,
    p_amount_cents: session.amount_total ?? 0,
    p_currency: session.currency ?? 'usd',
    p_source: 'checkout',
    p_checkout_session_id: session.id,
    p_invoice_id: idOf(session.invoice),
    p_payment_intent_id: idOf(session.payment_intent),
  })
  if (error) throw new Error(`credit_minute_purchase failed: ${error.message}`)
  const row = firstRow<{ credited?: boolean; balance_after?: number }>(data)
  log.info('billing.minute_pack_credited', { orgId, minutes, newlyCredited: row?.credited ?? null, checkoutSessionId: session.id })
}

/**
 * An auto top-up invoice was paid. lib/billing/auto-topup.ts credits it right
 * after charging; this is the safety net for a lost response or a failed
 * credit write (idempotent on the invoice id).
 */
async function creditAutoTopUpInvoice(supabase: SupabaseClient, invoice: Stripe.Invoice, log: Logger) {
  const orgId = invoice.metadata?.org_id
  const minutes = Number(invoice.metadata?.minutes)
  if (!orgId || !isMinutePack(minutes)) {
    log.error('billing.auto_topup_metadata_invalid', null, { invoiceId: invoice.id })
    return
  }
  const paymentIntent = (invoice.payments?.data ?? []).map((p) => idOf(p.payment?.payment_intent)).find(Boolean) ?? null
  const { data, error } = await supabase.rpc('credit_minute_purchase', {
    p_org_id: orgId,
    p_minutes: minutes,
    p_amount_cents: invoice.amount_paid ?? 0,
    p_currency: invoice.currency ?? 'usd',
    p_source: 'auto_topup',
    p_checkout_session_id: null,
    p_invoice_id: invoice.id,
    p_payment_intent_id: paymentIntent,
  })
  if (error) throw new Error(`credit_minute_purchase failed: ${error.message}`)
  const row = firstRow<{ credited?: boolean }>(data)
  log.info('billing.auto_topup_invoice_credited', { orgId, minutes, newlyCredited: row?.credited ?? null, invoiceId: invoice.id })
}

/** The start of the period a subscription invoice bills in full: its non-proration subscription lines' period start. */
function newPeriodLineStart(invoice: Stripe.Invoice): number | null {
  const lines = invoice.lines?.data ?? []
  const starts = lines
    .filter((l) => l.parent?.type === 'subscription_item_details' && l.parent.subscription_item_details?.proration !== true)
    .map((l) => l.period?.start)
    .filter((n): n is number => typeof n === 'number' && n > 0)
  return starts.length > 0 ? Math.max(...starts) : null
}

/** The billing period a subscription invoice opens: its (non-proration) subscription line's period start. */
function subscriptionPeriodStart(invoice: Stripe.Invoice): number | null {
  const fromLine = newPeriodLineStart(invoice)
  if (fromLine) return fromLine
  // A renewal invoice's own period is the one that just ended: it ends where the new one starts.
  return typeof invoice.period_end === 'number' && invoice.period_end > 0 ? invoice.period_end : null
}

/**
 * A plan subscription was renewed (subscription_cycle) or started
 * (subscription_create), or a plan change scheduled for the renewal took
 * effect (subscription_update with a full new-period line: the invoice the
 * subscription schedule's next phase opens; the prorated invoice of an
 * immediate upgrade has only proration lines and starts nothing): the
 * included minutes start over for the new period. Phone-number subscriptions
 * are not plans. The organization comes from the subscription's org_id, else
 * from the Stripe customer. Only the organization's recorded plan
 * subscription renews its minutes; another one counts only for its first
 * invoice (subscription_create, carrying the ntv_plan Checkout stamps, which
 * may arrive before customer.subscription.created records it) or while none
 * is recorded. A second, unrecorded subscription's renewals never reset the
 * minutes. Prepaid extra minutes are kept.
 */
async function startUsagePeriodOnRenewal(supabase: SupabaseClient, invoice: Stripe.Invoice, log: Logger) {
  const reason = invoice.billing_reason
  if (reason !== 'subscription_cycle' && reason !== 'subscription_create' && reason !== 'subscription_update') return
  if (reason === 'subscription_update' && !newPeriodLineStart(invoice)) return
  const details = invoice.parent?.subscription_details
  const subscriptionId = idOf(details?.subscription)
  if (!subscriptionId) return
  const meta = details?.metadata ?? {}
  if (meta.type === 'phone_number') return

  const customerId = idOf(invoice.customer)
  const column = meta.org_id ? 'id' : 'stripe_customer_id'
  const value = meta.org_id ?? customerId
  if (!value) {
    log.warn('billing.usage_period_org_unresolved', { invoiceId: invoice.id })
    return
  }
  const { data: org, error: orgErr } = await supabase.from('organizations').select('id, stripe_subscription_id').eq(column, value).maybeSingle()
  if (orgErr) throw new Error(`organizations read failed: ${orgErr.message}`)
  if (!org) {
    log.warn('billing.usage_period_org_unresolved', { invoiceId: invoice.id })
    return
  }
  const recorded = (org.stripe_subscription_id as string | null) ?? null
  if (recorded !== subscriptionId) {
    const tagged = isPlan(meta.ntv_plan)
    const firstInvoiceOfNew = reason === 'subscription_create' && tagged
    const noneRecorded = recorded === null && tagged && reason !== 'subscription_update'
    if (!firstInvoiceOfNew && !noneRecorded) {
      log.info('billing.usage_period_ignored', { invoiceId: invoice.id, billingReason: reason, subscriptionId })
      return
    }
  }

  const periodStart = subscriptionPeriodStart(invoice)
  if (!periodStart) {
    log.warn('billing.usage_period_start_missing', { invoiceId: invoice.id })
    return
  }
  const { data, error } = await supabase.rpc('start_usage_period', {
    p_org_id: org.id,
    p_period_start: new Date(periodStart * 1000).toISOString(),
  })
  if (error) throw new Error(`start_usage_period failed: ${error.message}`)
  log.info('billing.usage_period', { orgId: org.id, started: data === true, billingReason: invoice.billing_reason, invoiceId: invoice.id })
}

// The Customer has already paid by the time this runs (checkout.session.completed
// only fires on success) - if provisioning fails here the number was paid for but
// never delivered, so this logs loudly rather than failing silently. There's no
// automatic refund/retry yet, a failure here needs a human to look at the logs.
async function provisionPurchasedNumber(supabase: SupabaseClient, session: Stripe.Checkout.Session) {
  const { org_id: orgId, number, country, agent_id: agentId } = session.metadata ?? {}
  if (!orgId || !number) {
    console.error('Phone number checkout completed but metadata is missing org_id/number:', session.id)
    return
  }

  const stripeSubscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null

  try {
    await provisionPhoneNumber(supabase, { orgId, number, country, agentId, stripeSubscriptionId })
  } catch (err) {
    // provisionPhoneNumber is idempotent per number, so the error is rethrown:
    // the webhook answers 500 and Stripe retries the delivery (up to 3 days).
    createLogger({ component: 'billing_webhook', orgId }).error('billing.paid_but_not_provisioned', err, {
      number: maskPhone(number),
      checkoutSessionId: session.id,
    })
    throw err
  }
}

// Phone-number subscriptions are cancelled for various reasons: the Customer
// cancelled it in the Customer Portal, or Stripe gave up retrying after
// repeated payment failures. Either way nobody pays for the number any more,
// so it is released everywhere (lib/phone/release.ts: the provider imports,
// then Twilio, which stops its monthly fee) and its row is deleted, as a
// release from the dashboard (DELETE /api/phone/[id]) does; calls keep their
// history. A failed read, write or release answers 500 and Stripe delivers the
// event again; a repeated event, like the cancellation that follows a
// dashboard release, finds no row left and does nothing.
async function releasePhoneNumber(supabase: SupabaseClient, subscription: Stripe.Subscription, log: Logger) {
  const { data: phone, error } = await supabase
    .from('phone_numbers')
    .select(RELEASABLE_NUMBER_COLUMNS)
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()
  if (error) throw new Error(`phone_numbers read failed: ${error.message}`)

  if (!phone) {
    log.warn('billing.phone_subscription_without_number', { subscriptionId: subscription.id })
    return
  }

  const row = phone as unknown as ReleasableNumber
  const l = log.child({ orgId: row.org_id, phoneNumberId: row.id, number: maskPhone(row.number) })
  await releaseNumberEverywhere(supabase, row, l)
  l.info('billing.phone_number_released', { subscriptionId: subscription.id })
}

/**
 * The line an invoice is mostly for: the largest positive amount. An
 * immediate upgrade's prorated invoice lists the old plan's unused time (a
 * negative line) before the new plan's remaining time, so its first line
 * would name the plan being left.
 */
function principalLine(invoice: Stripe.Invoice): Stripe.InvoiceLineItem | undefined {
  const lines = invoice.lines?.data ?? []
  return lines.reduce<Stripe.InvoiceLineItem | undefined>(
    (best, line) => ((line.amount ?? 0) > (best?.amount ?? 0) ? line : best),
    undefined,
  ) ?? lines[0]
}

async function sendPaymentSuccess(supabase: SupabaseClient, stripe: Stripe, invoice: Stripe.Invoice) {
  if (!invoice.customer_email) return
  // Nothing was charged (the first invoice of a subscription's free days, or
  // one a credit balance covered): no "payment received" for 0.00.
  if ((invoice.amount_paid ?? 0) <= 0) return

  // Pull the SmartBill invoice we just emitted (if any) for the email.
  let invoiceNumber: string | null = null
  let invoiceUrl: string | null = null
  if (invoice.id) {
    const { data } = await supabase
      .from('invoices')
      .select('smartbill_series, smartbill_number, pdf_url, status')
      .eq('stripe_invoice_id', invoice.id)
      .maybeSingle()
    if (data?.status === 'issued' && data.smartbill_number) {
      invoiceNumber = `${data.smartbill_series ?? ''}${data.smartbill_number}`
      invoiceUrl = data.pdf_url ?? null
    }
  }

  // An extra-minute pack names what it bought; a plan payment names the plan.
  const packMinutes = invoice.metadata?.type === MINUTE_PACK ? Number(invoice.metadata.minutes) : NaN
  const itemDescription = isMinutePack(packMinutes) ? `${packMinutes.toLocaleString('en-US')} extra minutes` : undefined

  let plan: Plan | null = null
  if (!itemDescription) {
    // The Stripe line item exposes the price under `price` (older) or
    // `pricing.price_details.price` (newer) — read defensively.
    const line = principalLine(invoice) as unknown as {
      price?: { id?: string }
      pricing?: { price_details?: { price?: string | { id: string } } }
    } | undefined
    const priceId = line?.price?.id ?? idOf(line?.pricing?.price_details?.price)
    try {
      plan = await resolvePlanFromPrice(stripe, priceId)
    } catch (err) {
      // The receipt still goes out, only without the plan name.
      console.warn('Stripe webhook: could not resolve the plan for the payment email:', err instanceof Error ? err.message : err)
    }
  }

  await sendEmail({
    to: invoice.customer_email,
    ...paymentSuccessEmail({
      amount: (invoice.amount_paid ?? 0) / 100,
      currency: invoice.currency ?? 'usd',
      planName: plan ? PLANS[plan].name : undefined,
      itemDescription,
      invoiceNumber,
      invoiceUrl,
    }),
  })
}

function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id
}

/**
 * The plan a subscription pays for, read from its current price: the
 * env-pinned price ids first (no API call; a pin checkout no longer uses
 * because its amount is stale still names its plan, so a subscription sold
 * on it keeps resolving), then the price itself (metadata / lookup key of a
 * price the app created for any self-serve plan, Growth and Scale included).
 * The ntv_plan the checkout stamped on the subscription comes last: the
 * in-place plan switch updates it, but a Customer Portal switch or a
 * Dashboard edit does not, so trusting it first could keep the old plan's
 * allowance while invoicing the new one. Null for a price nobody tagged,
 * which resets the organization to the trial as before. The allowance
 * written is PLANS[plan].minutes_limit (at most STRIPE_TRIAL_MINUTES while
 * the subscription is in its free days, lib/billing/stripe-trial.ts).
 */
async function planOfSubscription(stripe: Stripe, subscription: Stripe.Subscription): Promise<Plan | null> {
  const priceId = subscription.items.data[0]?.price.id
  const mapped = planFromPriceId(priceId)
  if (mapped) return mapped
  const fromPrice = await resolvePlanFromPrice(stripe, priceId)
  if (fromPrice) return fromPrice
  const tagged = subscription.metadata?.ntv_plan
  return isPlan(tagged) ? tagged : null
}

/**
 * organizations.billing_interval of a plan subscription: the recurring
 * interval of its price ('month' or 'year'), null for anything else. On
 * 'year' the maintenance cron starts a new usage period every month, since
 * every plan card says "N minutes a month" and Stripe renews (and
 * start_usage_period resets) an annual subscription once a year.
 */
function billingIntervalOf(subscription: Stripe.Subscription): BillingInterval | null {
  const interval = subscription.items.data[0]?.price.recurring?.interval
  return interval === 'month' || interval === 'year' ? interval : null
}

async function applySubscription(
  supabase: SupabaseClient,
  stripe: Stripe,
  subscription: Stripe.Subscription,
  fallbackOrgId?: string
) {
  // Phone number subscriptions are a completely separate concern from the
  // org's plan (each number is its own subscription - see app/api/phone/checkout).
  // Provisioning already happened off checkout.session.completed; there's
  // nothing to sync here on creation/update, and treating its price as a plan
  // price would wrongly reset the org to trial.
  if (subscription.metadata?.type === 'phone_number') return

  const customerId = customerIdOf(subscription)
  const orgId = subscription.metadata?.org_id ?? fallbackOrgId
  const active = subscription.status === 'active' || subscription.status === 'trialing'
  const plan: Plan = active ? (await planOfSubscription(stripe, subscription)) ?? 'trial' : 'trial'

  await updateOrg(
    supabase,
    orgId,
    customerId,
    {
      plan,
      // During the Stripe free days (status 'trialing', nothing paid yet) at
      // most STRIPE_TRIAL_MINUTES; the plan's full allowance once it is active.
      minutes_limit: includedMinutesFor(plan, subscription.status),
      // Cleared with the plan: the trial has no billing period of its own.
      billing_interval: plan === 'trial' ? null : billingIntervalOf(subscription),
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      // Payment/trial started → the paid onboarding path is now complete.
      ...(active ? { onboarding_completed: true } : {}),
    },
    // Taking the plan away (past_due, unpaid, canceled, an untagged price) is
    // only for the organization's own plan subscription: an old or second
    // subscription must never put a paying organization on the trial.
    plan === 'trial' ? { onlySubscription: subscription.id } : {},
  )
}

async function downgradeToTrial(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
) {
  const customerId = customerIdOf(subscription)
  // Only the organization's own plan subscription ending puts it on the trial
  // (an old one ending while a newer one bills must change nothing).
  await updateOrg(
    supabase,
    subscription.metadata?.org_id,
    customerId,
    {
      plan: 'trial',
      minutes_limit: PLANS.trial.minutes_limit,
      billing_interval: null,
      stripe_subscription_id: null,
    },
    { onlySubscription: subscription.id },
  )
}

/**
 * True when the update failed only because organizations.billing_interval
 * does not exist yet (migration 028 not applied: PostgREST PGRST204, or
 * Postgres 42703 undefined_column).
 */
function isMissingBillingIntervalColumn(error: { code?: string; message?: string }): boolean {
  return (error.code === 'PGRST204' || error.code === '42703') && (error.message ?? '').includes('billing_interval')
}

/** A Stripe subscription id, safe inside a PostgREST filter. */
const SUBSCRIPTION_ID = /^sub_[A-Za-z0-9_]+$/

async function updateOrg(
  supabase: SupabaseClient,
  orgId: string | undefined,
  customerId: string | undefined,
  update: Record<string, unknown>,
  opts: {
    /** Write only while the organization records this subscription (or none). */
    onlySubscription?: string
  } = {},
) {
  // Prefer the explicit org_id we stamped into Stripe metadata; fall back to
  // matching on the Stripe customer id, which is stored at checkout time.
  const column = orgId ? 'id' : 'stripe_customer_id'
  const value = orgId ?? customerId
  if (!value) {
    console.warn('Stripe webhook: cannot resolve organization (no org_id or customer id)')
    return
  }
  const guard = opts.onlySubscription
  if (guard !== undefined && !SUBSCRIPTION_ID.test(guard)) {
    console.warn('Stripe webhook: unexpected subscription id shape; organization left unchanged')
    return
  }
  // One conditional UPDATE: a concurrent switch to another subscription is never overwritten.
  // The ids it wrote come back, so a write that matched nothing is visible.
  const write = (payload: Record<string, unknown>) => {
    const q = supabase.from('organizations').update(payload).eq(column, value)
    return (guard ? q.or(`stripe_subscription_id.is.null,stripe_subscription_id.eq.${guard}`) : q).select('id')
  }

  let { data, error } = await write(update)
  if (error && 'billing_interval' in update && isMissingBillingIntervalColumn(error)) {
    // Deployed before migration 028: the plan and its minutes still apply,
    // only the monthly periods of an annual plan wait for the column.
    console.warn('Stripe webhook: organizations.billing_interval is missing (apply migration 028); updating without it')
    const withoutInterval = { ...update }
    delete withoutInterval.billing_interval
    ;({ data, error } = await write(withoutInterval))
  }
  if (error) {
    // Thrown, so the webhook answers 500 and Stripe retries the delivery (for
    // up to 3 days): a plan the database refuses (for example Growth or Scale
    // before migration 028 widens organizations_plan_check) is applied once
    // the cause is fixed, instead of billing a plan that is never granted.
    throw new Error(`organizations update failed: ${error.message}`)
  }
  if (!Array.isArray(data) || data.length === 0) {
    const written = update.stripe_subscription_id
    const subscriptionId = guard ?? (typeof written === 'string' ? written : undefined)
    await reportUnmatchedOrg(supabase, column, value, { orgId, customerId, subscriptionId, guarded: !!guard })
  }
}

/**
 * The update above matched no organization. Legitimate only when the
 * subscription guard left out an organization that records another
 * subscription; otherwise a paid subscription points at no organization (a
 * deleted one, a subscription made in the Dashboard) and a human has to
 * reconcile it: a warning with the Stripe and organization ids only.
 */
async function reportUnmatchedOrg(
  supabase: SupabaseClient,
  column: 'id' | 'stripe_customer_id',
  value: string,
  { orgId, customerId, subscriptionId, guarded }: { orgId: string | undefined; customerId: string | undefined; subscriptionId: string | undefined; guarded: boolean },
) {
  const log = createLogger({ component: 'billing_webhook' })
  const ids = { orgId: orgId ?? null, customerId: customerId ?? null, subscriptionId: subscriptionId ?? null }
  if (guarded) {
    const { data, error } = await supabase.from('organizations').select('id').eq(column, value).limit(1)
    if (error) {
      log.error('billing.org_lookup_failed', error, ids)
      return
    }
    if (Array.isArray(data) && data.length > 0) {
      log.info('billing.org_update_skipped_other_subscription', ids)
      return
    }
  }
  log.warn('billing.org_unmatched', ids)
}
