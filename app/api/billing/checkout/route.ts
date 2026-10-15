import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import {
  RequestError,
  apiError,
  assertSameOrigin,
  errorResponse,
  parseJsonBody,
  requestErrorResponse,
} from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { ensurePlanPriceId } from '@/lib/stripe/store-prices'
import {
  findPlanSubscriptions,
  planChangeTiming,
  releasePendingChange,
  resumeParams,
  scheduleChangeAtRenewal,
  type PlanChangeTiming,
} from '@/lib/stripe/plan-subscription'
import { applyUpgradeMinutes, usagePeriodElapsed } from '@/lib/billing/plan-change-minutes'
import { PLANS, PLAN_NOT_AVAILABLE_MESSAGE, SELF_SERVE_PLANS, isPlan, planAllowedFor } from '@/types'
import type { BillingInterval, BusinessType, Plan } from '@/types'

// The self-serve paid tiers of both families (types/index.ts SELF_SERVE_PLANS:
// Starter, Growth, Pro, Business, Scale and the three listed store plans).
// Enterprise ('custom') and Store Enterprise are sales-led; the trial has no
// checkout.
const CheckoutSchema = z.object({
  plan: z.enum(SELF_SERVE_PLANS),
  interval: z.enum(['month', 'year']).optional(),
})

const PAYMENT_DECLINED_MESSAGE =
  'Your payment method was declined, so your plan was not changed. Update your payment method in the billing portal and try again.'

const PAYMENT_DUE_MESSAGE =
  'Your current subscription has a payment due. Pay the open invoice or update your card in the billing portal (Manage subscription), then choose a plan again.'

/** When the switch takes effect: now, or when the paid period ends (the renewal). */
type Effective = 'now' | 'renewal'

function isCardDeclined(err: unknown): boolean {
  const e = err as { type?: unknown; rawType?: unknown; statusCode?: unknown } | null
  return !!e && (e.type === 'StripeCardError' || e.rawType === 'card_error' || e.statusCode === 402)
}

/** What the plan's Stripe price bills per interval, in US cents (ensurePlanPriceId only returns a price that matches it). */
function planAmountCents(plan: Plan, interval: BillingInterval): number {
  const cfg = PLANS[plan]
  return Math.round((interval === 'year' ? cfg.price_annual : cfg.price_monthly) * 100)
}

function intervalOf(subscription: Stripe.Subscription): BillingInterval | null {
  const interval = subscription.items.data[0]?.price.recurring?.interval
  return interval === 'month' || interval === 'year' ? interval : null
}

interface OrgBilling {
  plan: string | null
  minutes_limit: number | null
  usage_period_start: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  business_type: BusinessType | null
}

// Authenticated checkout — lets an existing user change or buy a plan from
// the dashboard. An organization that already has a live plan subscription
// (active or trialing) changes it in place (lib/stripe/plan-subscription.ts):
// an upgrade on the same billing interval right away, with the prorated
// difference charged now and the minutes for the rest of the period
// prorated too; a downgrade or a billing-interval change at the end of the
// paid period (a subscription schedule), with nothing refunded and the
// current plan kept until then; anything during a Stripe trial right away.
// One whose plan subscription has a payment due gets 409 (pay it first: a
// new Checkout would bill a second plan subscription). Everyone else gets a
// Stripe Checkout for a new subscription. The billing webhook syncs the
// plan and its minutes from the subscription.
export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'billing.checkout' })
  try {
    assertSameOrigin(request)
    const { supabase, user, org } = await requireOrg()
    log = log.child({ orgId: org.id })

    if (!isStripeConfigured()) {
      return apiError('not_configured', 'Billing is not configured', 503, { requestId })
    }

    const { plan, interval } = await parseJsonBody(request, CheckoutSchema)
    const billingInterval: BillingInterval = interval === 'year' ? 'year' : 'month'

    const { data, error: billingErr } = await supabase
      .from('organizations')
      .select('plan, minutes_limit, usage_period_start, stripe_customer_id, stripe_subscription_id, business_type')
      .eq('id', org.id)
      .single()
    if (billingErr) throw new Error(`organizations read failed: ${billingErr.message}`)
    const billing = data as OrgBilling

    // An online store may only hold a store plan, every other organization only
    // a service plan: the row decides, never the client.
    const businessType = billing.business_type ?? null
    if (!planAllowedFor(plan, businessType)) {
      return apiError('plan_not_available', PLAN_NOT_AVAILABLE_MESSAGE, 409, {
        requestId,
        details: { reason: 'plan_not_available', plan, business_type: businessType },
      })
    }

    // Every self-serve plan's price is resolved the same way: an env pin only
    // while Stripe bills exactly what PLANS says, else the app's own price
    // (found or created by lookup key). A price whose amount differs from
    // PLANS is never charged, and none is needed in the env.
    let priceId: string
    try {
      priceId = await ensurePlanPriceId(plan, billingInterval)
    } catch (err) {
      log.error('billing.plan_price_failed', err, { plan, interval: billingInterval })
      return apiError('internal', 'Failed to create checkout session', 500, { requestId })
    }

    const stripe = getStripeClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // ── The organization's plan subscription, as Stripe has it ────────────
    let subs: Awaited<ReturnType<typeof findPlanSubscriptions>>
    try {
      subs = await findPlanSubscriptions(stripe, {
        orgId: org.id,
        customerId: billing.stripe_customer_id ?? null,
        recordedId: billing.stripe_subscription_id ?? null,
      })
    } catch (err) {
      // Opening a Checkout on an unanswered question could create a second subscription.
      log.error('billing.subscription_lookup_failed', err)
      return apiError('internal', 'Could not check your current subscription. Please try again.', 500, { requestId })
    }

    if (subs.live) {
      return await switchPlan({ stripe, current: subs.live, orgId: org.id, plan, interval: billingInterval, priceId, billing, log, requestId })
    }

    if (subs.due) {
      log.warn('billing.checkout_payment_due', { subscriptionId: subs.due.id, status: subs.due.status })
      return apiError('precondition_failed', PAYMENT_DUE_MESSAGE, 409, {
        requestId,
        details: { reason: 'subscription_payment_due' },
      })
    }

    // ── No plan subscription yet: a Stripe Checkout for a new one ─────────
    try {
      let customerId = billing.stripe_customer_id
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { org_id: org.id, user_id: user.id },
        })
        customerId = customer.id
        // stripe_customer_id is platform-managed (guard trigger): service role, scoped to this org.
        const { error } = await createAdminClient()
          .from('organizations')
          .update({ stripe_customer_id: customerId })
          .eq('id', org.id)
        if (error) throw new Error(`stripe_customer_id write failed: ${error.message}`)
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/billing?success=true`,
        cancel_url: `${appUrl}/billing?canceled=true`,
        allow_promotion_codes: true,
        // Collect the buyer's billing address + fiscal code (CUI) so the SmartBill
        // invoice emitted on payment has the data Romanian B2B invoicing requires.
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        customer_update: { address: 'auto', name: 'auto' },
        metadata: { org_id: org.id, ntv_plan: plan },
        // ntv_plan on the subscription is the webhook's second signal for the
        // plan, after the price id (the price itself carries it too).
        subscription_data: { metadata: { org_id: org.id, ntv_plan: plan } },
      })

      return NextResponse.json({ url: session.url })
    } catch (err) {
      log.error('billing.checkout_session_failed', err)
      return apiError('internal', 'Failed to create checkout session', 500, { requestId })
    }
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'billing.checkout_failed', requestId)
  }
}

/**
 * Changes the live plan subscription (see the route comment). Answers
 * `{ updated: true, plan, effective, effective_at }`: effective 'now' (the
 * webhook applies the plan in a moment) or 'renewal' (the current plan stays
 * until effective_at, an ISO date). Price ids are never logged: they can be
 * the env-pinned STRIPE_*_PRICE_ID values.
 */
async function switchPlan(args: {
  stripe: Stripe
  current: Stripe.Subscription
  orgId: string
  plan: Plan
  interval: BillingInterval
  priceId: string
  billing: OrgBilling
  log: Logger
  requestId: string
}): Promise<NextResponse> {
  const { stripe, current, orgId, plan, interval, priceId, billing, log, requestId } = args
  const item = current.items.data[0]
  const fromPlan = isPlan(billing.plan) ? billing.plan : null
  const fromInterval = intervalOf(current)
  const timing: PlanChangeTiming = planChangeTiming(current, { priceId, interval, unitAmountCents: planAmountCents(plan, interval) })
  const resume = resumeParams(current)
  const metadata = { org_id: orgId, ntv_plan: plan }
  const logFields = { fromPlan, toPlan: plan, fromInterval, toInterval: interval, timing, subscriptionId: current.id }
  const answer = (effective: Effective, effectiveAt: number | null) =>
    NextResponse.json({ updated: true, plan, effective, effective_at: effectiveAt ? new Date(effectiveAt * 1000).toISOString() : null })

  try {
    if (timing === 'unchanged') {
      // The plan it already pays for: a pending change is canceled, a subscription set to end is resumed.
      const released = await releasePendingChange(stripe, current)
      const resumed = Object.keys(resume).length > 0
      if (resumed) await stripe.subscriptions.update(current.id, resume)
      log.info(released || resumed ? 'billing.plan_kept' : 'billing.plan_unchanged', { ...logFields, releasedPending: released, resumed })
      return answer('now', null)
    }

    if (timing === 'at_renewal') {
      // Resumed first: a subscription set to end cannot take a scheduled change.
      const resumed = Object.keys(resume).length > 0
      if (resumed) await stripe.subscriptions.update(current.id, resume)
      const effectiveAt = await scheduleChangeAtRenewal(stripe, current, { priceId, interval, metadata })
      log.info('billing.plan_change_scheduled', { ...logFields, resumed, effectiveAt: new Date(effectiveAt * 1000).toISOString() })
      return answer('renewal', effectiveAt)
    }

    // Right away (an upgrade, or anything during a trial): a pending change is replaced by this one.
    const released = await releasePendingChange(stripe, current)
    await stripe.subscriptions.update(current.id, {
      items: [{ id: item.id, price: priceId }],
      ...(timing === 'now_upgrade'
        ? {
            // The difference for the rest of the period is invoiced and paid now; a declined card changes nothing.
            proration_behavior: 'always_invoice' as const,
            payment_behavior: 'error_if_incomplete' as const,
          }
        : { proration_behavior: 'none' as const }),
      // Stripe merges metadata keys; ntv_plan is the webhook's last-resort plan signal.
      metadata,
      ...resume,
    })
    log.info('billing.plan_switched', { ...logFields, releasedPending: released, resumed: Object.keys(resume).length > 0 })
  } catch (err) {
    if (isCardDeclined(err)) {
      log.warn('billing.plan_switch_declined', logFields)
      return apiError('precondition_failed', PAYMENT_DECLINED_MESSAGE, 402, {
        requestId,
        details: { reason: 'payment_declined' },
      })
    }
    log.error('billing.plan_switch_failed', err, logFields)
    return apiError('internal', 'Failed to change the plan', 500, { requestId })
  }

  if (timing === 'now_upgrade') {
    // Paid for the rest of the period only: the minutes follow (lib/billing/plan-change-minutes.ts).
    const elapsed = usagePeriodElapsed({
      periodStart: item.current_period_start,
      periodEnd: item.current_period_end,
      interval: fromInterval,
      usagePeriodStart: billing.usage_period_start ?? null,
      now: Date.now(),
    })
    const oldLimit = Number(billing.minutes_limit ?? (fromPlan ? PLANS[fromPlan].minutes_limit : 0))
    const applied = await applyUpgradeMinutes(createAdminClient(), orgId, { oldLimit, newLimit: PLANS[plan].minutes_limit, elapsed }, log)
    if (!applied) log.error('billing.upgrade_minutes_not_prorated', null, logFields)
  }
  return answer('now', null)
}
