import Stripe from 'stripe'
import { PLANS } from '@/types'
import type { Plan } from '@/types'

let _stripe: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-03-25.dahlia',
    })
  }
  return _stripe
}

/** True when a real Stripe secret key is configured (i.e. not the placeholder). */
export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY
  return !!key && key.startsWith('sk_')
}

/** Map a Stripe price ID back to our internal plan tier. */
export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null
  const entries = Object.entries(PLANS) as [Plan, { stripe_price_id: string }][]
  for (const [plan, cfg] of entries) {
    if (cfg.stripe_price_id && cfg.stripe_price_id === priceId) return plan
  }
  return null
}
