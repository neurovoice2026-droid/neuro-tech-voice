import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getStripeClient, planFromPriceId } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitInvoiceForStripePayment } from '@/lib/smartbill/emit'
import { sendEmail } from '@/lib/email/client'
import { paymentSuccessEmail, paymentFailedEmail } from '@/lib/email/templates'
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
        await downgradeToTrial(supabase, event.data.object as Stripe.Subscription)
        break
      }
      case 'invoice.paid': {
        // A subscription payment cleared → emit the SmartBill fiscal invoice,
        // then email the customer a confirmation.
        const invoice = event.data.object as Stripe.Invoice
        await emitInvoiceForStripePayment(supabase, invoice)
        await sendPaymentSuccess(supabase, invoice)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
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

async function sendPaymentSuccess(supabase: SupabaseClient, invoice: Stripe.Invoice) {
  if (!invoice.customer_email) return

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

  // The Stripe line item exposes the price under `price` (older) or
  // `pricing.price_details.price` (newer) — read defensively.
  const line = invoice.lines?.data?.[0] as unknown as {
    price?: { id?: string }
    pricing?: { price_details?: { price?: string } }
  } | undefined
  const priceId = line?.price?.id ?? line?.pricing?.price_details?.price
  const plan = planFromPriceId(priceId)

  await sendEmail({
    to: invoice.customer_email,
    ...paymentSuccessEmail({
      amount: (invoice.amount_paid ?? 0) / 100,
      currency: invoice.currency ?? 'usd',
      planName: plan ? PLANS[plan].name : undefined,
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

async function applySubscription(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription,
  fallbackOrgId?: string
) {
  const customerId = customerIdOf(subscription)
  const orgId = subscription.metadata?.org_id ?? fallbackOrgId
  const priceId = subscription.items.data[0]?.price.id
  const active = subscription.status === 'active' || subscription.status === 'trialing'
  const plan: Plan = active ? planFromPriceId(priceId) ?? 'trial' : 'trial'

  await updateOrg(supabase, orgId, customerId, {
    plan,
    minutes_limit: PLANS[plan].minutes_limit,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    // Payment/trial started → the paid onboarding path is now complete.
    ...(active ? { onboarding_completed: true } : {}),
  })
}

async function downgradeToTrial(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
) {
  const customerId = customerIdOf(subscription)
  await updateOrg(supabase, subscription.metadata?.org_id, customerId, {
    plan: 'trial',
    minutes_limit: PLANS.trial.minutes_limit,
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
