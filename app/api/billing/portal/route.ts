import { NextResponse, type NextRequest } from 'next/server'
import { ApiError, handleRoute, noStore } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { appUrl } from '@/lib/env'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'

// Opens the Stripe customer portal: payment method, receipts, cancellation.

export const runtime = 'nodejs'

export const POST = handleRoute(async (_req: NextRequest) => {
  const { user, org } = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, user.id)

  if (!isStripeConfigured()) {
    throw new ApiError(503, 'not_configured', 'Online payments are not set up yet. Please contact support for billing changes.')
  }
  if (!org.stripe_customer_id) {
    throw new ApiError(409, 'no_billing_account', 'You don’t have a billing account yet. Choose a plan to create one.')
  }

  try {
    const session = await getStripeClient().billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appUrl()}/billing`,
    })
    return noStore(NextResponse.json({ url: session.url }))
  } catch (error) {
    console.error('[billing] portal session create failed', org.id, error instanceof Error ? error.message : error)
    throw new ApiError(502, 'payment_provider_error', 'We couldn’t open the billing portal. Please try again in a moment.')
  }
})
