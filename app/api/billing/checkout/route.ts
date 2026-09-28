import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseJson } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { appUrl } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  basePlanItem,
  findOveragePrice,
  getStripeClient,
  isPaidSubscriptionStatus,
  isStripeConfigured,
  meteredItems,
  planLineItems,
  priceIdFor,
} from '@/lib/stripe/client'
import { PLANS } from '@/types'

// Starts a plan purchase from the dashboard. Without a live subscription it
// opens Stripe Checkout; with one it changes that subscription in place
// (prorated) so nobody ends up paying for two plans at once.

export const runtime = 'nodejs'

const bodySchema = z.object({
  plan: z.enum(['starter', 'pro', 'business']),
  interval: z.enum(['month', 'year']).default('month'),
  /** Set by the confirmation dialog; a live subscription is never changed without it. */
  confirm_change: z.boolean().default(false),
})

function providerError(action: string, error: unknown): ApiError {
  console.error('[billing]', action, error instanceof Error ? error.message : error)
  return new ApiError(
    502,
    'payment_provider_error',
    'We couldn’t reach our payment provider. Please try again in a moment.'
  )
}

async function changeExistingPlan(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  input: { orgId: string; plan: 'starter' | 'pro' | 'business'; interval: 'month' | 'year'; priceId: string }
): Promise<Response> {
  const base = basePlanItem(subscription)
  if (!base) {
    throw new ApiError(409, 'plan_change_unavailable', 'We couldn’t change this subscription automatically. Please use Manage billing or contact support.')
  }
  if (base.price.id === input.priceId) {
    throw new ApiError(409, 'already_on_plan', 'You’re already on this plan.')
  }

  const items: Stripe.SubscriptionUpdateParams.Item[] = [{ id: base.id, price: input.priceId, quantity: 1 }]
  const overage = await findOveragePrice(input.plan, input.interval)
  const metered = meteredItems(subscription)
  for (const item of metered) {
    if (!overage || item.price.id !== overage.id) items.push({ id: item.id, deleted: true })
  }
  if (overage && !metered.some((item) => item.price.id === overage.id)) items.push({ price: overage.id })

  try {
    await stripe.subscriptions.update(subscription.id, {
      items,
      proration_behavior: 'create_prorations',
      metadata: { ...subscription.metadata, org_id: input.orgId },
    })
  } catch (error) {
    throw providerError('plan change failed', error)
  }
  // The customer.subscription.updated webhook applies the new plan and minutes.
  return noStore(NextResponse.json({ updated: true, plan: input.plan, interval: input.interval }))
}

/** The customer's paying plan subscription (never a phone number's), if any. */
async function findPlanSubscription(
  stripe: Stripe,
  customerId: string | null,
  knownSubscriptionId: string | null
): Promise<Stripe.Subscription | null> {
  if (!customerId && !knownSubscriptionId) return null
  try {
    if (customerId) {
      const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 })
      const paying = list.data.filter(
        (sub) => sub.metadata?.type !== 'phone_number' && isPaidSubscriptionStatus(sub.status)
      )
      return paying.find((sub) => sub.id === knownSubscriptionId) ?? paying[0] ?? null
    }
    const sub = await stripe.subscriptions.retrieve(knownSubscriptionId as string)
    return sub.metadata?.type !== 'phone_number' && isPaidSubscriptionStatus(sub.status) ? sub : null
  } catch (error) {
    // A subscription deleted in Stripe just means a fresh checkout.
    if ((error as { statusCode?: number }).statusCode === 404) return null
    throw providerError('subscription lookup failed', error)
  }
}

export const POST = handleRoute(async (req: NextRequest) => {
  const { user, org } = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.checkout, user.id)
  const { plan, interval, confirm_change: confirmChange } = await parseJson(req, bodySchema)

  if (org.plan === 'custom') {
    // Custom contracts carry their own prices and minutes; a self-serve checkout would overwrite them.
    throw new ApiError(409, 'custom_plan', 'Custom plans are changed with our team. Please contact us to change your plan.')
  }
  if (!isStripeConfigured()) {
    throw new ApiError(503, 'not_configured', 'Online payments are not set up yet. Please contact support to change your plan.')
  }
  const priceId = priceIdFor(plan, interval)
  if (!priceId) {
    const cycle = interval === 'year' ? 'annual' : 'monthly'
    throw new ApiError(400, 'price_unavailable', `The ${PLANS[plan].name} plan isn’t available with ${cycle} billing yet.`)
  }

  const stripe = getStripeClient()

  // Change the live plan subscription in place when there is one. Stripe is
  // asked directly, so a webhook that hasn't landed yet can't lead to a second
  // subscription.
  const current = await findPlanSubscription(stripe, org.stripe_customer_id, org.stripe_subscription_id)
  if (current) {
    if (!confirmChange) {
      // The page didn't know about this subscription yet: ask the owner to confirm the proration first.
      throw new ApiError(409, 'confirmation_required', 'Please confirm the plan change.')
    }
    return changeExistingPlan(stripe, current, { orgId: org.id, plan, interval, priceId })
  }

  let customerId = org.stripe_customer_id
  if (!customerId) {
    try {
      const customer = await stripe.customers.create(
        { email: user.email ?? undefined, name: org.name ?? undefined, metadata: { org_id: org.id, user_id: user.id } },
        { idempotencyKey: `customer:${org.id}` }
      )
      customerId = customer.id
    } catch (error) {
      throw providerError('customer create failed', error)
    }
    // stripe_customer_id is a protected column: only the service role may write it.
    const { error } = await createAdminClient()
      .from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', org.id)
    if (error) {
      console.error('[billing] saving stripe_customer_id failed', org.id, error.message)
      throw new ApiError(500, 'internal_error', 'We couldn’t start checkout. Please try again.')
    }
  }

  const lineItems = await planLineItems(plan, interval)
  if (!lineItems) {
    throw new ApiError(400, 'price_unavailable', `The ${PLANS[plan].name} plan isn’t available right now.`)
  }

  const base = appUrl()
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: lineItems,
      success_url: `${base}/billing?checkout=success`,
      cancel_url: `${base}/billing?checkout=canceled`,
      allow_promotion_codes: true,
      // Billing address + fiscal code (CUI) so the SmartBill invoice emitted on
      // payment has the data Romanian B2B invoicing requires.
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      metadata: { org_id: org.id },
      subscription_data: { metadata: { org_id: org.id } },
    })
    if (!session.url) throw new Error('checkout session has no url')
    return noStore(NextResponse.json({ url: session.url }))
  } catch (error) {
    throw providerError('checkout session create failed', error)
  }
})
