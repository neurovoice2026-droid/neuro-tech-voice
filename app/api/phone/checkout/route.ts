import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseJson, zE164, zUuid } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { appUrl, isStripeConfigured, isTwilioConfigured } from '@/lib/env'
import { PHONE_NUMBER_MONTHLY_PRICE_USD } from '@/lib/phone/pricing'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { getStripeClient } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTwilioClient, isTwilioNotFound, twilioErrorInfo } from '@/lib/twilio/client'
import { isPhoneCountry } from '@/lib/twilio/countries'

// Starts the monthly Stripe subscription for one number the customer picked.
// It is a separate subscription (metadata.type = 'phone_number'), not an item
// on the plan subscription, so the billing webhook can tell them apart: after
// the first payment it buys the number (lib/twilio/numbers.ts
// provisionPhoneNumber) and cancelling the subscription releases it.
// Before charging anything we make sure the number is still available.

export const runtime = 'nodejs'

const BodySchema = z.object({
  number: zE164,
  country: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(isPhoneCountry, 'Numbers from this country aren’t offered yet'),
  agent_id: zUuid.optional(),
})

/** Double-clicks within this window reuse the same Checkout session. */
const IDEMPOTENCY_WINDOW_SECONDS = 30 * 60

export const POST = handleRoute(async (req: NextRequest) => {
  const ctx = await requireOrgContext()
  const body = await parseJson(req, BodySchema)
  await enforceRateLimit(RATE_LIMITS.checkout, ctx.user.id)
  if (!isStripeConfigured() || !isTwilioConfigured()) {
    throw new ApiError(503, 'not_configured', 'Buying numbers isn’t available right now. Please try again later or contact support.')
  }

  if (body.agent_id) {
    const { data: agent } = await ctx.supabase
      .from('agents')
      .select('id')
      .eq('id', body.agent_id)
      .eq('org_id', ctx.org.id)
      .maybeSingle()
    if (!agent) throw new ApiError(404, 'agent_not_found', 'That agent doesn’t exist.')
  }

  const admin = createAdminClient()
  const { data: owned, error: ownedError } = await admin
    .from('phone_numbers')
    .select('id, org_id')
    .eq('number', body.number)
    .maybeSingle()
  if (ownedError) {
    console.error('[telephony] checkout ownership check failed', ownedError.code, ownedError.message)
    throw new ApiError(500, 'internal_error', 'We couldn’t check this number. Please try again.')
  }
  if (owned) {
    const mine = (owned as { org_id: string }).org_id === ctx.org.id
    throw new ApiError(409, 'number_taken', mine ? 'You already own this number.' : 'This number is no longer available. Please pick another one.')
  }

  // Still available, and still instantly provisionable (no address requirement)?
  try {
    const matches = await getTwilioClient()
      .availablePhoneNumbers(body.country)
      .local.list({ contains: body.number, limit: 5 })
    const available = matches.find((n) => n.phoneNumber === body.number && n.addressRequirements === 'none')
    if (!available) {
      throw new ApiError(409, 'number_unavailable', 'That number was just taken. Please search again and pick another one.')
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (isTwilioNotFound(error)) {
      throw new ApiError(409, 'number_unavailable', 'That number was just taken. Please search again and pick another one.')
    }
    const info = twilioErrorInfo(error)
    console.error('[telephony] checkout availability check failed', info.status, info.code, info.message)
    throw new ApiError(502, 'availability_check_failed', 'We couldn’t confirm the number is still available. Please try again.')
  }

  const stripe = getStripeClient()
  let customerId = ctx.org.stripe_customer_id
  try {
    if (!customerId) {
      // Same parameters as the plan checkout (app/api/billing/checkout): Stripe
      // rejects a reused idempotency key whose parameters differ.
      const customer = await stripe.customers.create(
        { email: ctx.user.email ?? undefined, name: ctx.org.name ?? undefined, metadata: { org_id: ctx.org.id, user_id: ctx.user.id } },
        { idempotencyKey: `customer:${ctx.org.id}` }
      )
      customerId = customer.id
      // stripe_customer_id is protected from browser sessions after migration 011.
      const { error } = await admin
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', ctx.org.id)
        .is('stripe_customer_id', null)
      if (error) console.error('[telephony] storing stripe_customer_id failed', error.code, error.message)
    }

    const metadata: Record<string, string> = {
      type: 'phone_number',
      org_id: ctx.org.id,
      number: body.number,
      country: body.country,
      ...(body.agent_id ? { agent_id: body.agent_id } : {}),
    }
    const window = Math.floor(Date.now() / 1000 / IDEMPOTENCY_WINDOW_SECONDS)
    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: 'subscription',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(PHONE_NUMBER_MONTHLY_PRICE_USD * 100),
              recurring: { interval: 'month' },
              product_data: { name: `Phone number ${body.number}`, description: 'Monthly phone number fee' },
            },
            quantity: 1,
          },
        ],
        success_url: `${appUrl()}/phone?purchased=1`,
        cancel_url: `${appUrl()}/phone?canceled=1`,
        // On the session (checkout.session.completed) and copied onto the
        // subscription (customer.subscription.* events only carry that).
        metadata,
        subscription_data: { metadata },
      },
      { idempotencyKey: `phone-checkout:${ctx.org.id}:${body.number}:${body.agent_id ?? ''}:${window}` }
    )
    if (!session.url) throw new Error('Stripe returned a session without a URL')
    return noStore(Response.json({ url: session.url }))
  } catch (error) {
    const code = (error as { code?: string; type?: string } | null)?.code ?? (error as { type?: string } | null)?.type
    console.error('[telephony] phone checkout failed', code ?? (error instanceof Error ? error.message : error))
    throw new ApiError(502, 'checkout_failed', 'We couldn’t open the checkout page. Please try again in a moment.')
  }
})
