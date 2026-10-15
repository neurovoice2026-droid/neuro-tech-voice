// What a visitor came to sign up for, carried from the pricing section to
// the onboarding's first step. A store plan's "Start free" links to
// /register?intent=store; the register page keeps that in a cookie, and
// Step 0 of the onboarding pre-selects "Online store" from it. The cookie
// is a suggestion only: the business type is written once, by the owner's
// own click, through POST /api/onboarding/business-type. Pure and
// client-safe, so the browser and the server read the cookie the same way.

import type { BusinessType } from '@/types'
import { BUSINESS_INTENT_COOKIE } from '@/lib/commerce/business-type'

export { BUSINESS_INTENT_COOKIE }

/** The `?intent=` value the store plans sign up with. */
export const STORE_INTENT = 'store'

/** Thirty days: long enough to come back to a confirmation email, short enough to forget a visit. */
export const BUSINESS_INTENT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

const BUSINESS_TYPES: readonly BusinessType[] = ['services', 'ecommerce']

function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && BUSINESS_TYPES.includes(value as BusinessType)
}

/** The business type a sign-up link's `intent` names (`store` → ecommerce); anything else names none. */
export function businessTypeFromIntent(intent: string | string[] | null | undefined): BusinessType | null {
  const value = Array.isArray(intent) ? intent[0] : intent
  return value === STORE_INTENT ? 'ecommerce' : null
}

/**
 * The Set-Cookie / document.cookie string that remembers the intent: site
 * wide, thirty days, SameSite=Lax (it travels on the top-level navigation
 * back from Google sign-in), readable by the page (Step 0 reads it in the
 * browser). `Secure` on https only, or the browser drops it on localhost.
 */
export function businessIntentCookie(businessType: BusinessType, secure = false): string {
  const parts = [
    `${BUSINESS_INTENT_COOKIE}=${businessType}`,
    'Path=/',
    `Max-Age=${BUSINESS_INTENT_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

/** The same cookie, expired: written once the choice has been made. */
export function expiredBusinessIntentCookie(): string {
  return `${BUSINESS_INTENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

/** The intent a Cookie header (or document.cookie) carries, or null when it carries none or nonsense. */
export function readBusinessIntent(cookieHeader: string | null | undefined): BusinessType | null {
  if (!cookieHeader) return null
  for (const pair of cookieHeader.split(';')) {
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    if (pair.slice(0, eq).trim() !== BUSINESS_INTENT_COOKIE) continue
    let value = pair.slice(eq + 1).trim()
    try {
      value = decodeURIComponent(value)
    } catch (err) {
      // decodeURIComponent only throws URIError (a stray '%', a value never
      // percent-encoded by us): that value is judged as written.
      if (!(err instanceof URIError)) throw err
    }
    return isBusinessType(value) ? value : null
  }
  return null
}
