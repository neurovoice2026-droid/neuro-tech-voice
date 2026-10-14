// Shopify install helpers (pure, no React): the shop domain as the start
// route expects it, and the start URL the browser navigates to.

const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/

/** "magazin", "magazin.myshopify.com" or "https://magazin.myshopify.com/" → "magazin.myshopify.com"; null when not a shop domain. */
export function normalizeShopDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!value) return null
  if (!value.includes('.')) value = `${value}.myshopify.com`
  return SHOP_DOMAIN.test(value) ? value : null
}

/** The OAuth start route; the install comes back to /onboarding?commerce=… (return_to=onboarding). */
export function shopifyStartUrl(shop: string): string {
  const params = new URLSearchParams({ shop, return_to: 'onboarding' })
  return `/api/commerce/oauth/shopify/start?${params}`
}

export type OAuthReturn = { kind: 'connected' } | { kind: 'error'; code: string }

/**
 * What the Shopify install callback appended to /onboarding. The failure code is accepted
 * under both spellings the contract uses (`commerce_error`, `error`) and reduced to a short
 * token before it is shown or looked up.
 */
export function oauthReturnFrom(params: URLSearchParams): OAuthReturn | null {
  if (params.get('commerce') === 'connected') return { kind: 'connected' }
  const code = params.get('commerce_error') ?? params.get('error')
  if (code !== null) return { kind: 'error', code: code.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'unknown' }
  return null
}
