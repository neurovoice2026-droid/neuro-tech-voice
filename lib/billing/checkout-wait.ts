// Waiting for Stripe's webhook after a successful Checkout. The plan is
// applied by the webhook, usually within seconds of the redirect back, so
// the page polls GET /api/billing/status briefly instead of showing the old
// plan (a trial) as if nothing happened. Pure and client-safe.

import type { Plan } from '@/types'

export const CHECKOUT_POLL_INTERVAL_MS = 2_000
/** After this the page stops waiting and says confirmation is taking longer than usual. */
export const CHECKOUT_POLL_TIMEOUT_MS = 45_000

export interface BillingStatus {
  plan: Plan
  onboarding_completed: boolean
}

export type CheckoutWait = 'waiting' | 'applied' | 'timed_out'

export function parseBillingStatus(body: unknown): BillingStatus | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (typeof b.plan !== 'string' || typeof b.onboarding_completed !== 'boolean') return null
  return { plan: b.plan as Plan, onboarding_completed: b.onboarding_completed }
}

/**
 * Onboarding checkout: done once the webhook finished onboarding (it sets the
 * plan at the same time). Billing checkout: done once the plan differs from
 * the one the page loaded with.
 */
export function checkoutWaitState(input: {
  flow: 'onboarding' | 'billing'
  initialPlan: Plan
  status: BillingStatus | null
  elapsedMs: number
}): CheckoutWait {
  const { status } = input
  const applied = status !== null && (input.flow === 'onboarding' ? status.onboarding_completed : status.plan !== input.initialPlan)
  if (applied) return 'applied'
  return input.elapsedMs >= CHECKOUT_POLL_TIMEOUT_MS ? 'timed_out' : 'waiting'
}
