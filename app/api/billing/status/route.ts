import { NextResponse } from 'next/server'
import { requireOrgContext } from '@/lib/api/auth'
import { handleRoute, noStore } from '@/lib/api/http'

// GET /api/billing/status → { plan, onboarding_completed }
// Polled for a few seconds after Stripe Checkout returns, until the billing
// webhook has applied the plan (lib/billing/checkout-wait.ts). Reads the
// organisation fresh on every request.

export const runtime = 'nodejs'

export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  return noStore(NextResponse.json({ plan: ctx.org.plan, onboarding_completed: ctx.org.onboarding_completed === true }))
})
