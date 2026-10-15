// PUT /api/billing/minutes/auto-topup { enabled, pack, threshold } → the
// saved auto top-up settings (MinutesSummaryDto['auto_topup']).
// When the organization's total minutes drop below `threshold`, `pack` extra
// minutes are charged to the saved payment method (lib/billing/auto-topup.ts).
// Turning it on needs a paid plan billed through a Stripe subscription and a
// saved payment method (409 no_payment_method otherwise) and clears the last
// failure. Turning it off is always allowed. The columns are platform-managed
// (guard trigger), so the write uses the service role, scoped to this org.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, apiError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { AUTO_TOPUP_THRESHOLD, MINUTE_PACKS } from '@/lib/billing/minute-packs'
import { MINUTES_ORG_COLUMNS, autoTopUpDto, canBuyMinutes, loadMinutesOrg, type MinutesOrgRow } from '@/lib/billing/minutes-summary'
import { resolveDefaultPaymentMethod } from '@/lib/billing/auto-topup'

const Body = z.strictObject({
  enabled: z.boolean(),
  pack: z.literal(MINUTE_PACKS, { error: 'Choose a pack of 100, 500, 1,000 or 2,500 minutes.' }),
  threshold: z
    .number()
    .int()
    .min(AUTO_TOPUP_THRESHOLD.min, { error: `The threshold must be at least ${AUTO_TOPUP_THRESHOLD.min} minutes.` })
    .max(AUTO_TOPUP_THRESHOLD.max, { error: `The threshold can be at most ${AUTO_TOPUP_THRESHOLD.max} minutes.` }),
})

const THRESHOLD_ABOVE_PACK_MESSAGE =
  'The threshold cannot be larger than the pack, so one pack always brings your minutes back above it. Choose a bigger pack or a lower threshold.'

type Precondition = 'plan_required' | 'subscription_required' | 'payment_method_required'

const PRECONDITION_MESSAGES: Record<Precondition, string> = {
  plan_required: 'Auto top-up is available on paid plans. Choose a plan first.',
  subscription_required: 'Auto top-up needs an active plan subscription with a saved card. Contact us if your plan is billed another way.',
  payment_method_required: 'Add a card in the billing portal to turn on auto top-up.',
}

function noPaymentMethod(reason: Precondition, requestId: string): NextResponse {
  return NextResponse.json(
    { error: PRECONDITION_MESSAGES[reason], code: 'no_payment_method', request_id: requestId, details: { reason } },
    { status: 409 },
  )
}

export async function PUT(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'billing.minutes.auto_topup' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit(RATE_LIMITS.billingMinutesAutoTopUp, org.id, 'Too many changes. Please wait a few minutes.')
    const body = await parseJsonBody(request, Body, 4 * 1024)
    // One pack must bring the minutes back above the threshold; otherwise every
    // cooldown would charge another pack until it does.
    if (body.threshold > body.pack) {
      return apiError('invalid_request', THRESHOLD_ABOVE_PACK_MESSAGE, 400, { requestId, details: { reason: 'threshold_above_pack' } })
    }
    const current = await loadMinutesOrg(supabase, org.id)

    if (body.enabled) {
      if (!canBuyMinutes(current.plan)) return noPaymentMethod('plan_required', requestId)
      if (!current.stripe_customer_id || !current.stripe_subscription_id) return noPaymentMethod('subscription_required', requestId)
      if (!isStripeConfigured()) return apiError('not_configured', 'Billing is not configured', 503, { requestId })
      let paymentMethod: string | null
      try {
        paymentMethod = await resolveDefaultPaymentMethod(getStripeClient(), {
          customerId: current.stripe_customer_id,
          subscriptionId: current.stripe_subscription_id,
        })
      } catch (err) {
        log.error('billing.auto_topup_payment_method_check_failed', err)
        return apiError('provider_error', 'We could not check your saved payment method. Please try again.', 502, { requestId })
      }
      if (!paymentMethod) return noPaymentMethod('payment_method_required', requestId)
    }

    const { data, error } = await createAdminClient()
      .from('organizations')
      .update({
        auto_topup_enabled: body.enabled,
        auto_topup_pack: body.pack,
        auto_topup_threshold: body.threshold,
        // Turning it back on is the owner's answer to the last failure.
        ...(body.enabled ? { auto_topup_failed_at: null, auto_topup_failure: null } : {}),
      })
      .eq('id', org.id)
      .select(MINUTES_ORG_COLUMNS)
      .single()
    if (error) throw new Error(`organizations auto top-up write failed: ${error.message}`)
    log.info('billing.auto_topup_saved', { enabled: body.enabled, pack: body.pack, threshold: body.threshold })
    return NextResponse.json(autoTopUpDto(data as MinutesOrgRow))
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'billing.auto_topup_failed', requestId)
  }
}
