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
import { PHONE_NUMBER_MONTHLY_PRICE_USD } from '@/lib/phone/pricing'
import { maskPhone, normalizeE164 } from '@/lib/phone/e164'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PhoneCheckoutSchema = z.object({
  number: z
    .string()
    .max(32)
    .transform((value, ctx) => {
      const e164 = normalizeE164(value)
      if (!e164) {
        ctx.addIssue({ code: 'custom', message: 'Use the international format, e.g. +40712345678' })
        return z.NEVER
      }
      return e164
    }),
  country: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/, 'Use a two-letter country code')
    .optional(),
  agent_id: z.string().regex(UUID_RE, 'Invalid agent id').optional(),
})

// Starts a recurring monthly Stripe subscription for a specific phone number
// the Customer picked from search results - its own dedicated subscription,
// not an item on the org's plan subscription, so the webhook can tell them
// apart (see app/api/billing/webhook's applySubscription early-return on
// metadata.type === 'phone_number', and the subscription.deleted handling
// that releases the number if this subscription is ever cancelled). The
// number is only actually purchased from Twilio and bound to the org's
// agent after the first payment succeeds - see checkout.session.completed there.
export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'phone.checkout' })
  try {
    assertSameOrigin(request)
    const { supabase, user, org } = await requireOrg()
    log = log.child({ orgId: org.id })

    if (!isStripeConfigured()) {
      return apiError('not_configured', 'Billing is not configured', 503, { requestId })
    }

    const { number, country, agent_id } = await parseJsonBody(request, PhoneCheckoutSchema)

    // The browser-provided agent id must be this org's agent (RLS-bounded read).
    if (agent_id) {
      const { data: ownAgent, error } = await supabase
        .from('agents')
        .select('id')
        .eq('id', agent_id)
        .eq('org_id', org.id)
        .maybeSingle()
      if (error) throw new Error(`agents read failed: ${error.message}`)
      if (!ownAgent) return apiError('not_found', 'Agent not found', 404, { requestId })
    }

    const { data: billing, error: billingErr } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', org.id)
      .single()
    if (billingErr) throw new Error(`organizations read failed: ${billingErr.message}`)

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

      const metadata = {
        type: 'phone_number',
        org_id: org.id,
        number,
        country: country ?? 'US',
        ...(agent_id ? { agent_id } : {}),
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(PHONE_NUMBER_MONTHLY_PRICE_USD * 100),
              recurring: { interval: 'month' },
              product_data: {
                name: `Phone number ${number}`,
                description: 'Monthly phone number fee',
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${appUrl}/phone?purchased=true`,
        cancel_url: `${appUrl}/phone?canceled=true`,
        // Set on both: the session's own metadata (read in checkout.session.completed)
        // and subscription_data.metadata, which Stripe copies onto the actual
        // Subscription object - needed so customer.subscription.* events (which
        // only carry the Subscription, not the originating session) can also
        // tell this apart from a plan subscription.
        metadata,
        subscription_data: { metadata },
      })

      log.info('phone.checkout_created', { number: maskPhone(number) })
      return NextResponse.json({ url: session.url })
    } catch (err) {
      log.error('phone.checkout_session_failed', err)
      return apiError('internal', 'Failed to create checkout session', 500, { requestId })
    }
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'phone.checkout_failed', requestId)
  }
}
