// POST /api/billing/minutes/checkout { minutes: 100 | 500 | 1000 | 2500 } →
// { url } of a Stripe Checkout session (mode 'payment') for one extra-minute
// pack at the plan's price (lib/billing/minute-packs.ts). The minutes are
// credited by the billing webhook once Stripe reports the session paid
// (checkout.session.completed / async_payment_succeeded, idempotent on the
// session id); Checkout also issues a Stripe invoice, so the usual invoice.paid
// path (SmartBill fiscal invoice + payment e-mail) applies. Paid plans only:
// the trial answers 409 minutes_not_available.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, apiError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { createBrandedCheckoutSession } from '@/lib/stripe/checkout-branding'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { MINUTE_PACKS, packQuote } from '@/lib/billing/minute-packs'

const Body = z.strictObject({
  minutes: z.literal(MINUTE_PACKS, { error: 'Choose a pack of 100, 500, 1,000 or 2,500 minutes.' }),
})

const MINUTES_NOT_AVAILABLE_MESSAGE = 'Extra minutes are available on paid plans. Choose a plan first, then buy minutes.'

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'billing.minutes.checkout' })
  try {
    assertSameOrigin(request)
    const { supabase, user, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit(RATE_LIMITS.billingMinutesCheckout, org.id, 'Too many checkout attempts. Please wait a few minutes.')

    if (!isStripeConfigured()) {
      return apiError('not_configured', 'Billing is not configured', 503, { requestId })
    }

    const { minutes } = await parseJsonBody(request, Body, 4 * 1024)

    const { data: billing, error: billingErr } = await supabase
      .from('organizations')
      .select('plan, stripe_customer_id')
      .eq('id', org.id)
      .single()
    if (billingErr) throw new Error(`organizations read failed: ${billingErr.message}`)

    // The price comes from the organization's plan as stored, never from the client.
    const plan = (billing.plan as string | null) ?? 'trial'
    const quote = packQuote(plan, minutes)
    if (!quote) {
      return NextResponse.json(
        { error: MINUTES_NOT_AVAILABLE_MESSAGE, code: 'minutes_not_available', request_id: requestId, details: { reason: 'minutes_not_available', plan } },
        { status: 409 },
      )
    }

    const stripe = getStripeClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    try {
      let customerId = billing.stripe_customer_id as string | null
      if (!customerId) {
        // A sales-led plan set up without Checkout may have no Stripe customer yet.
        const customer = await stripe.customers.create({ email: user.email, metadata: { org_id: org.id, user_id: user.id } })
        customerId = customer.id
        // stripe_customer_id is platform-managed (guard trigger): service role, scoped to this org.
        const { error } = await createAdminClient().from('organizations').update({ stripe_customer_id: customerId }).eq('id', org.id)
        if (error) throw new Error(`stripe_customer_id write failed: ${error.message}`)
      }

      const metadata = { type: 'minute_pack', org_id: org.id, minutes: String(minutes), plan }
      const session = await createBrandedCheckoutSession(stripe, {
        mode: 'payment',
        customer: customerId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: quote.amount_cents,
              // "1,000 extra minutes": the auto top-up invoice line and the payment e-mail say it the same way.
              product_data: { name: `${minutes.toLocaleString('en-US')} extra minutes` },
            },
          },
        ],
        // A Stripe invoice for the payment: invoice.paid then emits the SmartBill
        // fiscal invoice and the payment e-mail, like a plan payment.
        invoice_creation: { enabled: true, invoice_data: { metadata } },
        metadata,
        payment_intent_data: { metadata },
        // The buyer's billing address + fiscal code (CUI) for the SmartBill invoice.
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        customer_update: { address: 'auto', name: 'auto' },
        success_url: `${appUrl}/billing?minutes=success#minutes`,
        cancel_url: `${appUrl}/billing?minutes=canceled#minutes`,
      }, log)
      log.info('billing.minutes_checkout_created', { minutes, amountCents: quote.amount_cents })
      return NextResponse.json({ url: session.url })
    } catch (err) {
      log.error('billing.minutes_checkout_session_failed', err)
      return apiError('internal', 'Failed to create checkout session', 500, { requestId })
    }
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'billing.minutes_checkout_failed', requestId)
  }
}
