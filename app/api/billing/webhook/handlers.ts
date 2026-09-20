import 'server-only'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { zUuid } from '@/lib/api/http'
import { isE164 } from '@/lib/phone/e164'
import {
  basePlanItem,
  getStripeClient,
  isPaidSubscriptionStatus,
  planFromPriceId,
  planIntervalFromPriceId,
  stripeId,
  subscriptionEndAction,
} from '@/lib/stripe/client'
import { applyUsagePeriod, periodFromSubscription } from '@/lib/billing/usage'
import { emitInvoiceForStripePayment } from '@/lib/smartbill/emit'
import { sendEmail } from '@/lib/email/client'
import { paymentFailedEmail, paymentSuccessEmail, phoneNumberRefundEmail } from '@/lib/email/templates'
import { provisionPhoneNumber, releasePhoneNumber } from '@/lib/twilio/numbers'
import { resyncOrgAgentsAfterResponse } from '@/lib/voice/sync'
import { kvGet, kvSet } from '@/lib/kv'
import { PLANS, type BillingInterval, type Plan } from '@/types'

// Stripe event handlers. Every write goes through the service-role client with
// an explicit org filter. Handlers throw on failures worth a Stripe retry
// (database errors) and return quietly for events that will never apply
// (unknown org, someone else's subscription).

interface OrgRow {
  id: string
  user_id: string
  plan: Plan
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  usage_period_start: string | null
  usage_period_end: string | null
}

const ORG_COLUMNS = 'id, user_id, plan, stripe_customer_id, stripe_subscription_id, usage_period_start, usage_period_end'

function isPhoneNumberSubscription(metadata: Stripe.Metadata | null | undefined): boolean {
  return metadata?.type === 'phone_number'
}

async function findOrg(ref: { orgId?: string | null; subscriptionId?: string | null; customerId?: string | null }): Promise<OrgRow | null> {
  const admin = createAdminClient()
  const lookups: [column: string, value: string | null | undefined][] = [
    ['id', ref.orgId && zUuid.safeParse(ref.orgId).success ? ref.orgId : null],
    ['stripe_subscription_id', ref.subscriptionId],
    ['stripe_customer_id', ref.customerId],
  ]
  for (const [column, value] of lookups) {
    if (!value) continue
    const { data, error } = await admin.from('organizations').select(ORG_COLUMNS).eq(column, value).limit(1).maybeSingle()
    if (error) throw new Error(`organization lookup failed: ${error.message}`)
    if (data) return data as unknown as OrgRow
  }
  return null
}

async function ownerEmail(userId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().auth.admin.getUserById(userId)
  if (error) {
    console.error('[billing] owner lookup failed', userId, error.message)
    return null
  }
  return data.user?.email ?? null
}

async function updateOrg(orgId: string, update: Record<string, unknown>): Promise<void> {
  const { error } = await createAdminClient().from('organizations').update(update).eq('id', orgId)
  if (error) throw new Error(`organization update failed: ${error.message}`)
}

// ─── Plan subscriptions ──────────────────────────────────────────────────────

/**
 * Mirrors a plan subscription onto the org: plan, interval, included minutes,
 * Stripe ids and the usage period. Reads the subscription fresh from Stripe
 * so an out-of-order event can't apply an older state.
 */
export async function applySubscription(subscriptionId: string, hints: { orgId?: string | null } = {}): Promise<void> {
  const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId)
  if (isPhoneNumberSubscription(subscription.metadata)) return

  const customerId = stripeId(subscription.customer)
  const org = await findOrg({
    orgId: subscription.metadata?.org_id ?? hints.orgId,
    subscriptionId: subscription.id,
    customerId,
  })
  if (!org) {
    console.error('[billing] subscription has no matching organization', subscription.id)
    return
  }

  if (!isPaidSubscriptionStatus(subscription.status)) {
    // incomplete = the first payment is still being confirmed; a later event settles it.
    if (subscription.status === 'incomplete') return
    await downgradeToTrial(org, subscription.id)
    return
  }

  const item = basePlanItem(subscription)
  const mapped = planIntervalFromPriceId(item?.price.id)
  if (!item || !mapped) {
    // A price we don't know (a sales-made custom price, a retired price): never
    // downgrade a paying customer because of configuration; keep the plan.
    console.error('[billing] subscription price does not match a plan; plan left unchanged', subscription.id, item?.price.id ?? 'no items')
    if (org.stripe_subscription_id && org.stripe_subscription_id !== subscription.id) {
      // Don't let an unrecognised subscription replace the one the org pays its plan with.
      return
    }
    await updateOrg(org.id, { stripe_customer_id: customerId ?? org.stripe_customer_id, stripe_subscription_id: subscription.id })
    return
  }

  const interval: BillingInterval = item.price.recurring?.interval === 'year' ? 'year' : mapped.interval
  await updateOrg(org.id, {
    plan: mapped.plan,
    billing_interval: interval,
    minutes_limit: PLANS[mapped.plan].minutes_limit,
    stripe_customer_id: customerId ?? org.stripe_customer_id,
    stripe_subscription_id: subscription.id,
    trial_ends_at: null,
    // Payment (or the Stripe trial) started, so the paid onboarding path is complete.
    onboarding_completed: true,
  })

  const now = new Date()
  const fromStripe = periodFromSubscription(subscription, now, now)
  if (fromStripe) await applyUsagePeriod(org, fromStripe.period)
  // The plan decides the managed agent's tools and recording notice.
  if (org.plan !== mapped.plan) await resyncOrgAgentsAfterResponse(org.id, 'a plan change')
}

/** Subscription ended for good: back to an expired trial, so calls stop until they pick a plan again. */
async function downgradeToTrial(org: OrgRow, subscriptionId: string): Promise<void> {
  const action = subscriptionEndAction(org, subscriptionId)
  if (action === 'ignore') {
    // A replaced subscription, or an upgrade attempt that never got paid while
    // the org is still on its free trial: nothing about the org changes.
    console.info('[billing] ignoring the end of a subscription that is not the org’s current plan', org.id, subscriptionId)
    return
  }
  if (action === 'clear') {
    await updateOrg(org.id, { stripe_subscription_id: null, billing_interval: null })
    return
  }
  await updateOrg(org.id, {
    plan: 'trial',
    minutes_limit: PLANS.trial.minutes_limit,
    stripe_subscription_id: null,
    billing_interval: null,
    trial_ends_at: new Date().toISOString(),
  })
  if (org.plan !== 'trial') await resyncOrgAgentsAfterResponse(org.id, 'a plan change')
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  if (isPhoneNumberSubscription(subscription.metadata)) {
    await releaseNumberForSubscription(subscription.id)
    return
  }
  const org = await findOrg({
    orgId: subscription.metadata?.org_id,
    subscriptionId: subscription.id,
    customerId: stripeId(subscription.customer),
  })
  if (!org) {
    console.warn('[billing] deleted subscription has no matching organization', subscription.id)
    return
  }
  await downgradeToTrial(org, subscription.id)
}

// ─── Invoices ────────────────────────────────────────────────────────────────

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return stripeId(invoice.parent?.subscription_details?.subscription)
}

function invoicePlanName(invoice: Stripe.Invoice): string | undefined {
  for (const line of invoice.lines?.data ?? []) {
    const plan = planFromPriceId(stripeId(line.pricing?.price_details?.price))
    if (plan) return PLANS[plan].name
  }
  return undefined
}

async function invoiceRecipient(invoice: Stripe.Invoice): Promise<string | null> {
  if (invoice.customer_email) return invoice.customer_email
  const org = await findOrg({ customerId: stripeId(invoice.customer) })
  return org ? ownerEmail(org.user_id) : null
}

export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const admin = createAdminClient()

  // A renewal starts a new usage period (the cron covers annual plans' monthly
  // renewals). First, so an invoicing hiccup can't hold back the owner's minutes.
  const subscriptionId = invoiceSubscriptionId(invoice)
  if (
    invoice.billing_reason === 'subscription_cycle' &&
    subscriptionId &&
    !isPhoneNumberSubscription(invoice.parent?.subscription_details?.metadata)
  ) {
    await applySubscription(subscriptionId)
  }

  // A number that couldn't be provisioned was refunded in full: no fiscal
  // invoice and no "payment received" email for that payment.
  if (invoice.id && (await kvGet<boolean>(refundedInvoiceKey(invoice.id)))) {
    console.info('[billing] skipping the invoice of a refunded phone number payment', invoice.id)
    return
  }

  // Fiscal invoice: idempotent on the Stripe invoice id, so retries are safe.
  await emitInvoiceForStripePayment(admin, invoice)

  const to = await invoiceRecipient(invoice)
  if (!to || (invoice.amount_paid ?? 0) <= 0) return

  let invoiceNumber: string | null = null
  let invoiceUrl: string | null = null
  if (invoice.id) {
    const { data, error } = await admin
      .from('invoices')
      .select('smartbill_series, smartbill_number, pdf_url, status')
      .eq('stripe_invoice_id', invoice.id)
      .maybeSingle()
    if (error) console.error('[billing] invoice lookup failed', invoice.id, error.message)
    if (data?.status === 'issued' && data.smartbill_number) {
      invoiceNumber = `${data.smartbill_series ?? ''}${data.smartbill_number}`
      invoiceUrl = data.pdf_url ?? null
    }
  }

  await sendEmail({
    to,
    ...paymentSuccessEmail({
      amount: invoice.amount_paid / 100,
      currency: invoice.currency ?? 'usd',
      planName: invoicePlanName(invoice),
      invoiceNumber,
      invoiceUrl: invoiceUrl ?? invoice.hosted_invoice_url ?? null,
    }),
  })
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const to = await invoiceRecipient(invoice)
  if (!to) {
    console.warn('[billing] payment failed but no recipient found', invoice.id)
    return
  }
  await sendEmail({
    to,
    ...paymentFailedEmail({ amount: (invoice.amount_due ?? 0) / 100, currency: invoice.currency ?? undefined }),
  })
}

// ─── Phone numbers ───────────────────────────────────────────────────────────

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== 'subscription') return
  // Delayed payment methods complete checkout before the money arrives; the
  // async_payment_succeeded event brings the session back once it has.
  if (session.payment_status === 'unpaid') return

  if (isPhoneNumberSubscription(session.metadata)) {
    await provisionPurchasedNumber(session)
    return
  }
  const subscriptionId = stripeId(session.subscription)
  if (subscriptionId) await applySubscription(subscriptionId, { orgId: session.metadata?.org_id })
}

async function provisionPurchasedNumber(session: Stripe.Checkout.Session): Promise<void> {
  const metadata = session.metadata ?? {}
  const orgId = metadata.org_id && zUuid.safeParse(metadata.org_id).success ? metadata.org_id : null
  const number = metadata.number ?? ''
  const country = /^[A-Z]{2}$/.test(metadata.country ?? '') ? (metadata.country as string) : 'US'
  const agentId = metadata.agent_id && zUuid.safeParse(metadata.agent_id).success ? metadata.agent_id : null
  const subscriptionId = stripeId(session.subscription)
  const admin = createAdminClient()

  if (orgId && subscriptionId) {
    // A retried event after a successful provision must not buy (or refund) twice.
    const { data, error } = await admin
      .from('phone_numbers')
      .select('id')
      .eq('org_id', orgId)
      .eq('stripe_subscription_id', subscriptionId)
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`phone number lookup failed: ${error.message}`)
    if (data) return
  }

  let failure: unknown = null
  if (!orgId || !isE164(number)) {
    failure = new Error('checkout metadata is missing a valid org_id or number')
  } else {
    try {
      await provisionPhoneNumber({ orgId, number, country, agentId, stripeSubscriptionId: subscriptionId })
      return
    } catch (error) {
      failure = error
    }
  }

  console.error(
    '[billing] PAID BUT NOT PROVISIONED: refunding and cancelling',
    { session: session.id, org: orgId, subscription: subscriptionId },
    failure instanceof Error ? failure.message : failure
  )
  const refund = await refundAndCancel(session, { orgId, number })

  // Nothing below may throw: a Stripe retry of this event would try to
  // provision the number again after the customer was refunded.
  try {
    const org = orgId ? await findOrg({ orgId }) : null
    const to = (org ? await ownerEmail(org.user_id) : null) ?? session.customer_details?.email ?? null
    if (!to) {
      console.error('[billing] refund email not sent: no recipient', session.id)
      return
    }
    const sent = await sendEmail({
      to,
      ...phoneNumberRefundEmail({
        number: isE164(number) ? number : 'your new number',
        amount: refund.amount,
        currency: refund.currency,
        refunded: refund.refunded,
        cancelled: refund.cancelled,
      }),
    })
    if (!sent) console.error('[billing] refund email not delivered', session.id)
  } catch (error) {
    console.error('[billing] refund email failed', session.id, error instanceof Error ? error.message : error)
  }
}

function refundedInvoiceKey(invoiceId: string): string {
  return `billing:refunded-invoice:${invoiceId}`
}

/** Remembers a refunded first payment so invoice.paid (in either order) doesn't invoice it. */
async function noteRefundedInvoice(invoiceId: string | null): Promise<void> {
  if (!invoiceId) return
  try {
    await kvSet(refundedInvoiceKey(invoiceId), true, 60 * 24 * 60 * 60)
    // invoice.paid may already have been handled: a fiscal invoice then needs reversing in SmartBill.
    const { data } = await createAdminClient().from('invoices').select('status').eq('stripe_invoice_id', invoiceId).maybeSingle()
    if (data?.status === 'issued') {
      console.error('[billing] SMARTBILL REVERSAL NEEDED BY HAND: fiscal invoice issued for a refunded phone number payment', invoiceId)
    }
  } catch (error) {
    console.error('[billing] recording a refunded invoice failed', invoiceId, error instanceof Error ? error.message : error)
  }
}

interface RefundOutcome {
  refunded: boolean
  /** The number's subscription was cancelled (or there was none to cancel). */
  cancelled: boolean
  /** Major units. */
  amount: number | null
  currency: string | null
}

/** Refunds the first payment of a number that couldn't be provisioned and cancels its subscription. */
async function refundAndCancel(session: Stripe.Checkout.Session, ctx: { orgId: string | null; number: string }): Promise<RefundOutcome> {
  const stripe = getStripeClient()
  const outcome: RefundOutcome = { refunded: false, cancelled: true, amount: null, currency: session.currency ?? null }

  try {
    let paymentIntent: string | null = null
    let charge: string | null = null
    const invoiceId = stripeId(session.invoice)
    if (invoiceId) {
      const payments = await stripe.invoicePayments.list({ invoice: invoiceId, status: 'paid', limit: 10 })
      const payment = payments.data.find((p) => p.payment.payment_intent || p.payment.charge)
      paymentIntent = stripeId(payment?.payment.payment_intent)
      charge = stripeId(payment?.payment.charge)
    }
    paymentIntent = paymentIntent ?? stripeId(session.payment_intent)

    if (paymentIntent || charge) {
      const refund = await stripe.refunds.create(
        {
          ...(paymentIntent ? { payment_intent: paymentIntent } : { charge: charge as string }),
          reason: 'requested_by_customer',
          metadata: {
            type: 'phone_number_provisioning_failed',
            checkout_session: session.id,
            org_id: ctx.orgId ?? '',
            number: ctx.number,
          },
        },
        { idempotencyKey: `phone-number-refund:${session.id}` }
      )
      outcome.refunded = refund.status !== 'failed' && refund.status !== 'canceled'
      outcome.amount = refund.amount / 100
      outcome.currency = refund.currency
      if (outcome.refunded) await noteRefundedInvoice(invoiceId)
    } else if ((session.amount_total ?? 0) === 0) {
      // Nothing was charged (a 100 % coupon): cancelling is the whole remedy.
      outcome.refunded = true
      outcome.amount = 0
    } else {
      console.error('[billing] REFUND NEEDED BY HAND: no payment found for checkout', session.id)
    }
  } catch (error) {
    console.error('[billing] REFUND NEEDED BY HAND: automatic refund failed', session.id, error instanceof Error ? error.message : error)
  }

  const subscriptionId = stripeId(session.subscription)
  if (subscriptionId) {
    try {
      await stripe.subscriptions.cancel(
        subscriptionId,
        { prorate: false, invoice_now: false },
        { idempotencyKey: `phone-number-cancel:${subscriptionId}` }
      )
    } catch (error) {
      outcome.cancelled = false
      console.error('[billing] CANCEL NEEDED BY HAND: phone number subscription', subscriptionId, error instanceof Error ? error.message : error)
    }
  }
  return outcome
}

/**
 * A number's subscription ended (released by the owner, or Stripe gave up on
 * payments): release it from Twilio and remove the row through the telephony
 * helper. Call history keeps its rows (calls.phone_number_id is set null).
 */
async function releaseNumberForSubscription(subscriptionId: string): Promise<void> {
  const { data, error } = await createAdminClient()
    .from('phone_numbers')
    .select('id, org_id')
    .eq('stripe_subscription_id', subscriptionId)
  if (error) throw new Error(`phone number lookup failed: ${error.message}`)

  for (const phone of (data ?? []) as { id: string; org_id: string }[]) {
    const result = await releasePhoneNumber({ phoneNumberId: phone.id, orgId: phone.org_id, cancelSubscription: false })
    if (result.ok || result.code === 'not_found') {
      console.info('[billing] released phone number after its subscription ended', phone.id)
      continue
    }
    // Twilio keeps charging for a number that wasn't released: let Stripe retry the event.
    throw new Error(`phone number release failed (${result.code}): ${result.error}`)
  }
}
