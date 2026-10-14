import { NextResponse } from 'next/server'
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
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { ensurePlanPriceId } from '@/lib/stripe/store-prices'
import { PLANS, PLAN_NOT_AVAILABLE_MESSAGE, planAllowedFor, stripePriceId } from '@/types'
import type { BillingInterval, BusinessType, Plan } from '@/types'

// The self-serve paid tiers of both families. Custom and Store Enterprise are
// sales-led; the trial has no checkout.
const SELF_SERVE_PLANS = ['starter', 'pro', 'business', 'store_starter', 'store_growth', 'store_scale'] as const satisfies readonly Plan[]

const CheckoutSchema = z.object({
  plan: z.enum(SELF_SERVE_PLANS),
  interval: z.enum(['month', 'year']).optional(),
})

// Authenticated checkout — lets an existing user upgrade from the dashboard.
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

    const { data: billing, error: billingErr } = await supabase
      .from('organizations')
      .select('stripe_customer_id, business_type')
      .eq('id', org.id)
      .single()
    if (billingErr) throw new Error(`organizations read failed: ${billingErr.message}`)

    // An online store may only hold a store plan, every other organization only
    // a service plan: the row decides, never the client.
    const businessType = (billing.business_type ?? null) as BusinessType | null
    if (!planAllowedFor(plan, businessType)) {
      return apiError('plan_not_available', PLAN_NOT_AVAILABLE_MESSAGE, 409, {
        requestId,
        details: { reason: 'plan_not_available', plan, business_type: businessType },
      })
    }

    // Service plans use the env-configured price ids; store plans are found or
    // created in Stripe by lookup key, so they need no manual setup.
    let priceId: string
    if (PLANS[plan].family === 'ecommerce') {
      try {
        priceId = await ensurePlanPriceId(plan, billingInterval)
      } catch (err) {
        log.error('billing.store_price_failed', err, { plan, interval: billingInterval })
        return apiError('internal', 'Failed to create checkout session', 500, { requestId })
      }
    } else {
      priceId = stripePriceId(plan, billingInterval)
      if (!priceId) {
        return apiError('invalid_request', `No Stripe price configured for ${plan} (${billingInterval})`, 400, { requestId })
      }
    }

    const stripe = getStripeClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    try {
      let customerId = billing.stripe_customer_id as string | null
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
