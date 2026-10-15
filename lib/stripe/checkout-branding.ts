import 'server-only'
// Stripe-hosted Checkout dressed like the site, kept simple at the owner's
// request: white page, the brand violet on the pay button, Inter (the site's
// body face), rounded corners, and the name NeuroVoice alone in the header.
// Given only display_name, Checkout puts a generic shop glyph before the name,
// so the name is sent as the logo too: "NeuroVoice" set in Inter, ink on
// transparent (public/brand/checkout-logo.png, 112px tall; Checkout draws a
// logo 28px tall, so the text shows at 16px), and with a logo Checkout shows
// the logo alone. Passed per session (branding_settings), so it does not
// depend on the account's Dashboard branding; a field left out falls back to
// the Dashboard's value. Invoices and receipts keep the Dashboard branding
// (Stripe's rule).
//
// The logo is a URL Stripe fetches (through its image proxy, when the page
// loads; the session create does not check it), so it is sent only when
// NEXT_PUBLIC_APP_URL is https (never from a dev box); without it the header
// is the glyph and display_name.
//
// STRIPE_CHECKOUT_BRANDING=off sends no branding at all. A session Stripe
// refuses because of a branding field is created again without branding: the
// buyer still pays, on the Dashboard's look. These calls carry no idempotency
// key and a refused create makes nothing, so the retry cannot double anything.

import type Stripe from 'stripe'
import type { Logger } from '@/lib/observability/logger'

/** The name in the Checkout header, as the site's wordmark spells it (NEUROVOICE). */
export const CHECKOUT_DISPLAY_NAME = 'NeuroVoice'

/** The same name as an image (public/brand/checkout-logo.png): the header logo. */
export const CHECKOUT_LOGO_PATH = '/brand/checkout-logo.png'

type Branding = NonNullable<Stripe.Checkout.SessionCreateParams['branding_settings']>

/** The origin of NEXT_PUBLIC_APP_URL when it is https, else null (Stripe cannot fetch from a dev box). */
function httpsAppOrigin(): string | null {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim()
  if (!URL.canParse(raw)) return null
  const url = new URL(raw)
  return url.protocol === 'https:' ? url.origin : null
}

/** The branding_settings every Checkout Session gets, or undefined when switched off. */
export function checkoutBranding(): Branding | undefined {
  if ((process.env.STRIPE_CHECKOUT_BRANDING ?? '').trim().toLowerCase() === 'off') return undefined
  const branding: Branding = {
    display_name: CHECKOUT_DISPLAY_NAME,
    background_color: '#ffffff', // --background
    button_color: '#551a89', // --brand: white on it is 11:1
    border_style: 'rounded', // --radius 0.75rem
    font_family: 'inter', // the site's body face; covers every Latin locale Checkout picks (ro included)
  }
  const origin = httpsAppOrigin()
  if (origin) branding.logo = { type: 'url', url: `${origin}${CHECKOUT_LOGO_PATH}` }
  return branding
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
