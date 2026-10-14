// GET /api/commerce/oauth/shopify/start?shop=<x.myshopify.com>&return_to=onboarding|magazin
// Sends the signed-in store owner to Shopify's authorize page. CSRF: a random
// nonce in `state`, echoed back and compared with an httpOnly cookie that also
// remembers where to return. The app credentials come from the environment.
import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { commerceRoute, requireCommerceOrg } from '@/lib/commerce/api'
import { buildInstallUrl, normalizeShopDomain } from '@/lib/commerce/adapters/shopify-oauth'
import { commercePublicBaseUrl, shopifyAppConfig } from '@/lib/commerce/config'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { SHOPIFY_STATE_COOKIE, encodeShopifyState, oauthReturnUrl, returnKeyOf } from '@/lib/commerce/shopify-state'

export async function GET(request: Request) {
  return commerceRoute(request, 'oauth.shopify.start', async (log) => {
    const ctx = await requireCommerceOrg(log)
    const url = new URL(request.url)
    const returnKey = returnKeyOf(url.searchParams.get('return_to'))
    const back = (code: string) => NextResponse.redirect(new URL(oauthReturnUrl(returnKey, { ok: false, code }), request.url))
    const app = shopifyAppConfig()
    const base = commercePublicBaseUrl()
    if (!app || !base) {
      log.warn('commerce.oauth.shopify.not_configured')
      return back('not_configured')
    }
    const shop = normalizeShopDomain(url.searchParams.get('shop') ?? '')
    if (!shop) return back('invalid_shop')
    await enforceRateLimit(RATE_LIMITS.commerceConnect, ctx.org.id, 'Prea multe încercări de conectare.')
    const nonce = randomBytes(24).toString('base64url')
    const res = NextResponse.redirect(buildInstallUrl({ shop, clientId: app.clientId, scopes: app.scopes, redirectUri: `${base}/api/commerce/oauth/shopify/callback`, state: nonce }))
    res.cookies.set(SHOPIFY_STATE_COOKIE, encodeShopifyState({ nonce, returnKey, shop }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/' })
    return res
  })
}
