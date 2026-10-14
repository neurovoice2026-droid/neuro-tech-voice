// The Shopify OAuth state cookie: `<nonce>.<returnKey>.<shop>`. The nonce is
// base64url and the return key is a fixed word, so neither contains a dot;
// the shop domain (x.myshopify.com) does, which is why the value is split on
// the first two dots only and the remainder is the shop.
export type ShopifyOAuthState = { nonce: string; returnKey: string; shop: string }

export function encodeShopifyState(state: ShopifyOAuthState): string {
  if (state.nonce.includes('.') || state.returnKey.includes('.')) throw new Error('nonce and return key must not contain dots')
  return `${state.nonce}.${state.returnKey}.${state.shop}`
}

export function parseShopifyState(value: string | null | undefined): ShopifyOAuthState | null {
  if (!value) return null
  const first = value.indexOf('.')
  if (first <= 0) return null
  const second = value.indexOf('.', first + 1)
  if (second <= first + 1 || second >= value.length - 1) return null
  const nonce = value.slice(0, first)
  const returnKey = value.slice(first + 1, second)
  const shop = value.slice(second + 1)
  if (!/^[A-Za-z0-9_-]+$/.test(nonce) || !/^[a-z]+$/.test(returnKey) || !/^[a-z0-9][a-z0-9.-]*$/i.test(shop)) return null
  return { nonce, returnKey, shop }
}

export const SHOPIFY_STATE_COOKIE = 'ntv_shopify_oauth'

export type ShopifyReturnKey = 'onboarding' | 'magazin'

/** The page that started the install (allow-listed; never a user-supplied path). */
export function returnKeyOf(raw: string | null | undefined): ShopifyReturnKey {
  return raw === 'onboarding' ? 'onboarding' : 'magazin'
}

export function returnPathOf(key: string | null | undefined): string {
  return returnKeyOf(key) === 'onboarding' ? '/onboarding' : '/magazin/conexiuni'
}

/**
 * Failure codes in the words the two return pages understand
 * (components/onboarding/commerce/copy.ts OAUTH_ERRORS and
 * components/commerce/ConnectionsPage.tsx); a store-validation reason from
 * connectStore passes through unchanged and is shown as a generic failure.
 */
export const OAUTH_ERROR_CODES = ['access_denied', 'invalid_shop', 'state_mismatch', 'hmac_invalid', 'not_configured', 'token_exchange_failed', 'unreachable'] as const
export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number]

export type OAuthOutcome = { ok: true } | { ok: false; code: OAuthErrorCode | string }

/**
 * Path + query the owner is sent back to. The onboarding step reads
 * `?commerce=connected` / `?commerce_error=`; the Magazin connections page
 * reads `?connected=1` / `?error=`.
 */
export function oauthReturnUrl(key: string | null | undefined, outcome: OAuthOutcome): string {
  const path = returnPathOf(key)
  const onboarding = returnKeyOf(key) === 'onboarding'
  if (outcome.ok) return onboarding ? `${path}?commerce=connected` : `${path}?connected=1`
  const code = outcome.code.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40) || 'unknown'
  return onboarding ? `${path}?commerce_error=${code}` : `${path}?error=${code}`
}
