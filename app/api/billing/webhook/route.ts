import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getStripeClient, planFromPriceId } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANS } from '@/types'
import type { Plan } from '@/types'

// Stripe webhook — must be public (no auth) and is authenticated via the
// Stripe signature instead. Reconciles subscription state into our DB.
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
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await applySubscription(supabase, subscription, session.metadata?.org_id)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await applySubscription(supabase, event.data.object as Stripe.Subscription)
        break
      }
      case 'customer.subscription.deleted': {
        await downgradeToFree(supabase, event.data.object as Stripe.Subscription)
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

function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id
}

async function applySubscription(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription,
  fallbackOrgId?: string
) {
  const customerId = customerIdOf(subscription)
  const orgId = subscription.metadata?.org_id ?? fallbackOrgId
  const priceId = subscription.items.data[0]?.price.id
  const active = subscription.status === 'active' || subscription.status === 'trialing'
  const plan: Plan = active ? planFromPriceId(priceId) ?? 'free' : 'free'

  await updateOrg(supabase, orgId, customerId, {
    plan,
    minutes_limit: PLANS[plan].minutes_limit,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
  })
}

async function downgradeToFree(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
) {
  const customerId = customerIdOf(subscription)
  await updateOrg(supabase, subscription.metadata?.org_id, customerId, {
    plan: 'free',
    minutes_limit: PLANS.free.minutes_limit,
    stripe_subscription_id: null,
  })
}

async function updateOrg(
  supabase: SupabaseClient,
  orgId: string | undefined,
  customerId: string | undefined,
  update: Record<string, unknown>
) {
  // Prefer the explicit org_id we stamped into Stripe metadata; fall back to
  // matching on the Stripe customer id, which is stored at checkout time.
  const column = orgId ? 'id' : 'stripe_customer_id'
  const value = orgId ?? customerId
  if (!value) {
    console.warn('Stripe webhook: cannot resolve organization (no org_id or customer id)')
    return
  }

  const { error } = await supabase.from('organizations').update(update).eq(column, value)
  if (error) {
    console.error('Stripe webhook: failed to update organization:', error.message)
  }
}
