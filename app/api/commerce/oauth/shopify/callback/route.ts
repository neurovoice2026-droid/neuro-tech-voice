// GET /api/commerce/oauth/shopify/callback — Shopify sends the owner back
// with code/hmac/shop/state. The HMAC (client secret) and the state cookie
// are checked, the code is exchanged for an offline token, and the
// connection is created through the same path as every other platform
// (validated, encrypted, webhooks, first import). Errors go back to the
// page as ?commerce_error=<code>; tokens never appear in a URL or a log.
import { NextResponse } from 'next/server'
import { RequestError } from '@/lib/api/http'
import { commerceRoute, requireCommerceOrg } from '@/lib/commerce/api'
import { exchangeAccessToken, verifyOAuthCallback } from '@/lib/commerce/adapters/shopify-oauth'
import { shopifyAppConfig } from '@/lib/commerce/config'
import { connectStore } from '@/lib/commerce/connections'
import { SHOPIFY_STATE_COOKIE, oauthReturnUrl, parseShopifyState, type ShopifyOAuthState } from '@/lib/commerce/shopify-state'

const MAX_SKEW_S = 5 * 60

function cookieValue(request: Request): ShopifyOAuthState | null {
  const raw = request.headers.get('cookie') ?? ''
  const m = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SHOPIFY_STATE_COOKIE}=`))
  if (!m) return null
  return parseShopifyState(decodeURIComponent(m.slice(SHOPIFY_STATE_COOKIE.length + 1)))
}

export async function GET(request: Request) {
  return commerceRoute(request, 'oauth.shopify.callback', async (log) => {
    const cookie = cookieValue(request)
    const returnKey = cookie?.returnKey ?? null
    const back = (outcome: { ok: true } | { ok: false; code: string }) => {
      const res = NextResponse.redirect(new URL(oauthReturnUrl(returnKey, outcome), request.url))
      res.cookies.set(SHOPIFY_STATE_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' })
      return res
    }
    const ctx = await requireCommerceOrg(log)
    const app = shopifyAppConfig()
    if (!app) return back({ ok: false, code: 'not_configured' })
    const params = new URL(request.url).searchParams
    if (params.get('error')) return back({ ok: false, code: 'access_denied' })
    const verified = verifyOAuthCallback(params, app.clientSecret)
    if (!verified.ok) {
      log.warn('commerce.oauth.shopify.rejected', { reason: verified.reason })
      return back({ ok: false, code: 'hmac_invalid' })
    }
    if (!cookie || cookie.nonce !== verified.state || cookie.shop !== verified.shop) {
      log.warn('commerce.oauth.shopify.state_mismatch')
      return back({ ok: false, code: 'state_mismatch' })
    }
    if (verified.timestamp && Math.abs(Date.now() / 1000 - verified.timestamp) > MAX_SKEW_S) return back({ ok: false, code: 'state_mismatch' })
    let token
    try {
      token = await exchangeAccessToken({ shop: verified.shop, clientId: app.clientId, clientSecret: app.clientSecret, code: verified.code })
    } catch (err) {
      log.warn('commerce.oauth.shopify.exchange_failed', { code: err instanceof Error ? err.name : 'unknown' })
      return back({ ok: false, code: 'token_exchange_failed' })
    }
    try {
      await connectStore(ctx.db, { orgId: ctx.org.id, userId: ctx.user.id, platform: 'shopify', storeUrl: `https://${verified.shop}`, displayName: null, secrets: { access_token: token.accessToken, scope: token.scope } }, ctx.log)
    } catch (err) {
      const reason = err instanceof RequestError ? ((err.details as { reason?: string } | undefined)?.reason ?? err.code) : 'connect_failed'
      log.warn('commerce.oauth.shopify.connect_failed', { reason })
      return back({ ok: false, code: String(reason) })
    }
    return back({ ok: true })
  })
}
