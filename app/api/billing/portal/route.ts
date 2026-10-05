import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, apiError, assertSameOrigin, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'

// Authenticated billing portal — manage payment method, invoices, cancellation.
// No request body is read.
export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'billing.portal' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })

    if (!isStripeConfigured()) {
      return apiError('not_configured', 'Billing is not configured', 503, { requestId })
    }

    const { data: billing, error } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', org.id)
      .single()
    if (error) throw new Error(`organizations read failed: ${error.message}`)

    const customerId = billing.stripe_customer_id as string | null
    if (!customerId) {
      return apiError('precondition_failed', 'No billing account yet', 400, { requestId })
    }

    const stripe = getStripeClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/billing`,
      })
      return NextResponse.json({ url: session.url })
    } catch (err) {
      log.error('billing.portal_session_failed', err)
      return apiError('internal', 'Failed to open billing portal', 500, { requestId })
    }
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'billing.portal_failed', requestId)
  }
}
