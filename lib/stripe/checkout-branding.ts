import 'server-only'
// Stripe-hosted Checkout dressed like the site, kept simple at the owner's
// request: white page, the brand violet on the pay button, Inter (the site's
// body face), rounded corners, and the name NeuroVoice written in the header,
// with no logo or icon image. Passed per session (branding_settings), so it
// does not depend on the account's Dashboard branding; a field left out falls
// back to the Dashboard's value (an icon or logo uploaded there would show
// next to the name). Invoices and receipts keep the Dashboard branding
// (Stripe's rule).
//
// STRIPE_CHECKOUT_BRANDING=off sends no branding at all. A session Stripe
// refuses because of a branding field is created again without branding: the
// buyer still pays, on the Dashboard's look. These calls carry no idempotency
// key and a refused create makes nothing, so the retry cannot double anything.

import type Stripe from 'stripe'
import type { Logger } from '@/lib/observability/logger'

/** The name in the Checkout header, as the site's wordmark spells it (NEUROVOICE). */
export const CHECKOUT_DISPLAY_NAME = 'NeuroVoice'

type Branding = NonNullable<Stripe.Checkout.SessionCreateParams['branding_settings']>

/** The branding_settings every Checkout Session gets, or undefined when switched off. */
export function checkoutBranding(): Branding | undefined {
  if ((process.env.STRIPE_CHECKOUT_BRANDING ?? '').trim().toLowerCase() === 'off') return undefined
  return {
    display_name: CHECKOUT_DISPLAY_NAME,
    background_color: '#ffffff', // --background
    button_color: '#551a89', // --brand: white on it is 11:1
    border_style: 'rounded', // --radius 0.75rem
    font_family: 'inter', // the site's body face; covers every Latin locale Checkout picks (ro included)
  }
}

/** Stripe refused the request because of one of the branding_settings fields. */
function isBrandingRejection(err: unknown): err is { param: string; code?: unknown } {
  const e = err as { type?: unknown; param?: unknown } | null
  return e?.type === 'StripeInvalidRequestError' && typeof e.param === 'string' && e.param.startsWith('branding_settings')
}

/**
 * stripe.checkout.sessions.create with the site's branding. A branding field
 * Stripe refuses never costs the sale: the session is created again without
 * branding and the refusal is logged (field name and code only). Any other
 * error is the caller's, unchanged.
 */
export async function createBrandedCheckoutSession(
  stripe: Stripe,
  params: Stripe.Checkout.SessionCreateParams,
  log: Logger
): Promise<Stripe.Checkout.Session> {
  const branding_settings = checkoutBranding()
  if (!branding_settings) return stripe.checkout.sessions.create(params)
  try {
    return await stripe.checkout.sessions.create({ ...params, branding_settings })
  } catch (err) {
    if (!isBrandingRejection(err)) throw err
    log.warn('stripe.checkout_branding_rejected', {
      param: err.param.slice(0, 80),
      code: typeof err.code === 'string' ? err.code.slice(0, 60) : null,
    })
    return stripe.checkout.sessions.create(params)
  }
}
