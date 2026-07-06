import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getStripeClient, planFromPriceId } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitInvoiceForStripePayment } from '@/lib/smartbill/emit'
import { sendEmail } from '@/lib/email/client'
import { paymentSuccessEmail, paymentFailedEmail } from '@/lib/email/templates'
import { provisionPhoneNumber } from '@/lib/phone/provision'
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

        if (session.metadata?.type === 'phone_number') {
          await provisionPurchasedNumber(supabase, session)
          break
        }

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
        const subscription = event.data.object as Stripe.Subscription
        if (subscription.metadata?.type === 'phone_number') {
          await releasePhoneNumber(supabase, subscription)
        } else {
          await downgradeToTrial(supabase, subscription)
        }
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
    console.error(
      `PAID BUT NOT PROVISIONED: phone number ${number} for org ${orgId} (checkout session ${session.id}). ` +
      `Customer has been charged. Needs manual follow-up.`,
      err
    )
  }
}

// Phone-number subscriptions are cancelled for various reasons: the Customer
// deliberately released the number, or Stripe gave up retrying after repeated
// payment failures. Either way, nobody's paying for it anymore, so it's
// deactivated here rather than left silently costing us Twilio's monthly fee
// forever. Left in the DB (not deleted) so call history stays intact.
async function releasePhoneNumber(supabase: SupabaseClient, subscription: Stripe.Subscription) {
  const { data: phone } = await supabase
    .from('phone_numbers')
    .select('id, number')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (!phone) {
    console.warn(`Phone number subscription ${subscription.id} cancelled but no matching number found.`)
    return
  }

  const { error } = await supabase
    .from('phone_numbers')
    .update({ is_active: false })
    .eq('id', phone.id)

  if (error) {
    console.error(`Failed to deactivate phone number ${phone.number} after subscription cancellation:`, error.message)
  }
}

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
  // Phone number subscriptions are a completely separate concern from the
  // org's plan (each number is its own subscription - see app/api/phone/checkout).
  // Provisioning already happened off checkout.session.completed; there's
  // nothing to sync here on creation/update, and treating its price as a plan
  // price would wrongly reset the org to trial.
  if (subscription.metadata?.type === 'phone_number') return

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
