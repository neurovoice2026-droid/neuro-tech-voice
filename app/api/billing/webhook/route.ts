import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { handleRoute, jsonError, readBodyText } from '@/lib/api/http'
import { env } from '@/lib/env'
import { kvDel, kvGet, kvIncr, kvSet } from '@/lib/kv'
import { getStripeClient, isStripeWebhookConfigured } from '@/lib/stripe/client'
import {
  applySubscription,
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
} from './handlers'

// Stripe webhook: public (proxy lets it through) and authenticated by the
// Stripe signature over the raw body. Each event is processed once: a KV lock
// stops concurrent deliveries of the same event, and a "done" marker (48 h,
// longer than Stripe's quick retries) acknowledges redeliveries without
// repeating side effects such as buying a phone number.

export const runtime = 'nodejs'
// Provisioning a number or refunding a failed one takes a few Stripe/Twilio round trips.
export const maxDuration = 60

const MAX_EVENT_BYTES = 2 * 1024 * 1024
const DONE_TTL_SECONDS = 48 * 60 * 60
const LOCK_TTL_SECONDS = 5 * 60

async function dispatch(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await handleCheckoutCompleted(event.data.object)
      return
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      // Phone number subscriptions don't touch the plan; provisioning runs off checkout.
      if (event.data.object.metadata?.type === 'phone_number') return
      await applySubscription(event.data.object.id, { orgId: event.data.object.metadata?.org_id })
      return
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object)
      return
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object)
      return
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object)
      return
    default:
      return
  }
}

export const POST = handleRoute(async (req: NextRequest) => {
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET
  if (!isStripeWebhookConfigured() || !webhookSecret) {
    return jsonError(503, 'not_configured', 'The billing webhook is not configured.')
  }
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return jsonError(400, 'missing_signature', 'Missing Stripe signature.')
  }

  const rawBody = await readBodyText(req, MAX_EVENT_BYTES)
  let event: Stripe.Event
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    console.warn('[billing] webhook signature verification failed', error instanceof Error ? error.message : error)
    return jsonError(400, 'invalid_signature', 'Invalid Stripe signature.')
  }

  const doneKey = `stripe-event:${event.id}:done`
  const lockKey = `stripe-event:${event.id}:lock`
  if (await kvGet<boolean>(doneKey)) {
    return NextResponse.json({ received: true, duplicate: true })
  }
  if ((await kvIncr(lockKey, LOCK_TTL_SECONDS)) > 1) {
    // Another delivery of this event is being processed; a non-2xx makes Stripe retry later.
    return jsonError(409, 'in_progress', 'This event is already being processed.')
  }

  try {
    await dispatch(event)
  } catch (error) {
    await kvDel(lockKey)
    console.error('[billing] webhook handler failed', event.type, event.id, error instanceof Error ? error.message : error)
    return jsonError(500, 'handler_error', 'The event could not be processed. Stripe will retry it.')
  }

  await kvSet(doneKey, true, DONE_TTL_SECONDS)
  return NextResponse.json({ received: true })
})
