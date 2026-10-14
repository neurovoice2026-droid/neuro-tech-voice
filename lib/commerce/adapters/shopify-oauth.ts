import 'server-only'
// Shopify OAuth helpers (pure: no database, no logger) plus the error
// translation the Shopify adapter shares with them.
//
// We are a non-embedded custom app, so we use the authorization code grant:
// "Standalone apps, running outside the Shopify admin, use this grant to
// exchange an authorization code for an access token"; embedded apps use
// token exchange / managed installation instead (we have no ID token).
// Verified against the official docs on 2026-10-13:
//   https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
//   https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange
//   https://shopify.dev/changelog/expiring-offline-access-tokens-required-for-all-public-apps-as-of-january-1-2027
//     (custom apps and apps created in the Dev Dashboard / admin are exempt
//     from expiring offline tokens, so no `expiring=1` and no refresh flow)
//
// Flow:
//   1. GET https://{shop}/admin/oauth/authorize?client_id&scope&redirect_uri&state
//   2. callback ?code&hmac&shop&state&timestamp(&host): HMAC-SHA256 (hex) with
//      the client secret over the alphabetically sorted `key=value` pairs
//      joined by `&`, `hmac` removed; constant-time comparison.
//   3. POST https://{shop}/admin/oauth/access_token {client_id, client_secret,
//      code} → {access_token, scope}.
// Every request to a shop goes through safeFetch (SSRF guard, no redirects).

import crypto from 'node:crypto'
import { z } from 'zod'
import { StoreHttpError, UnsafeUrlError, safeFetch } from '../safe-fetch'
import { ConnectionError, type ConnectionFailureCode } from './types'

/**
 * The documented shop pattern (`^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$`)
 * after lower-casing, anchored at both ends: an unanchored pattern would
 * accept `shop.myshopify.com.attacker.example`. The label length is capped
 * at the DNS limit so a pathological input cannot build a huge URL.
 */
const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]{0,62}\.myshopify\.com$/

export function isValidShopDomain(shop: string): boolean {
  return typeof shop === 'string' && SHOP_DOMAIN_RE.test(shop.trim().toLowerCase())
}

/**
 * The canonical `*.myshopify.com` host of what the merchant typed: a bare
 * domain, a domain with a path, or a full https URL. Null when it is not a
 * Shopify shop domain (custom storefront domains are rejected on purpose:
 * OAuth and the Admin API only work on the myshopify.com host).
 */
export function normalizeShopDomain(raw: string): string | null {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return null
  let host = value
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(value)) {
    if (!URL.canParse(value)) return null
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    host = url.hostname
  } else {
    host = value.split('/')[0]
  }
  host = host.replace(/\.$/, '')
  return SHOP_DOMAIN_RE.test(host) ? host : null
}

export interface InstallUrlInput {
  shop: string
  clientId: string
  /** Comma-separated scopes (SHOPIFY_SCOPES). */
  scopes: string
  redirectUri: string
  /** Random nonce stored server-side and compared on the callback (CSRF). */
  state: string
}

/** The merchant-facing authorize URL. Throws when the shop is not a valid myshopify.com host. */
export function buildInstallUrl(input: InstallUrlInput): string {
  const shop = normalizeShopDomain(input.shop)
  if (!shop) throw new ConnectionError('invalid_url', RO_MESSAGES.invalid_url, false, 'install url: invalid shop domain')
  if (!input.clientId || !input.redirectUri || !input.state) throw new ConnectionError('not_configured', RO_MESSAGES.not_configured, false, 'install url: missing app configuration')
  const url = new URL(`https://${shop}/admin/oauth/authorize`)
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('scope', normalizeScopes(input.scopes).join(','))
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('state', input.state)
  return url.toString()
}

/** Comma/space separated scope handles (read_orders, write_products…), trimmed, de-duplicated, in a stable order. */
export function normalizeScopes(scopes: string): string[] {
  const out = new Set<string>()
  for (const part of (scopes ?? '').split(/[\s,]+/)) {
    const s = part.trim().toLowerCase()
    if (s.length <= 64 && /^[a-z]+(_[a-z0-9]+)+$/.test(s)) out.add(s)
  }
  return [...out]
}

export type OAuthCallbackFailure = 'missing_hmac' | 'bad_hmac' | 'invalid_shop' | 'missing_state' | 'missing_code'

export type OAuthCallbackResult =
  | { ok: true; shop: string; code: string; state: string; timestamp: number | null }
  | { ok: false; reason: OAuthCallbackFailure }

/**
 * Verifies the OAuth callback query. The HMAC covers every parameter except
 * `hmac` (and the legacy `signature`), sorted by key, as `key=value` pairs
 * joined with `&` (the official sample does not URL-encode the values), hex
 * encoded, keyed with the client secret. The state is only checked for
 * presence here: the caller compares it with the nonce it stored.
 */
export function verifyOAuthCallback(query: URLSearchParams, clientSecret: string): OAuthCallbackResult {
  const given = query.get('hmac')
  if (!given || !/^[0-9a-f]{64}$/i.test(given)) return { ok: false, reason: 'missing_hmac' }
  const pairs: Array<[string, string]> = []
  for (const [key, value] of query.entries()) {
    if (key === 'hmac' || key === 'signature') continue
    pairs.push([key, value])
  }
  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const message = pairs.map(([k, v]) => `${k}=${v}`).join('&')
  const expected = crypto.createHmac('sha256', clientSecret).update(message).digest()
  const provided = Buffer.from(given, 'hex')
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return { ok: false, reason: 'bad_hmac' }
  const shop = normalizeShopDomain(query.get('shop') ?? '')
  if (!shop) return { ok: false, reason: 'invalid_shop' }
  const state = (query.get('state') ?? '').trim()
  if (!state) return { ok: false, reason: 'missing_state' }
  const code = (query.get('code') ?? '').trim()
  if (!code) return { ok: false, reason: 'missing_code' }
  const ts = Number(query.get('timestamp'))
  return { ok: true, shop, code, state, timestamp: Number.isFinite(ts) && ts > 0 ? ts : null }
}

export interface ExchangeAccessTokenInput {
  shop: string
  clientId: string
  clientSecret: string
  code: string
  fetchImpl?: typeof fetch
  lookup?: (hostname: string) => Promise<string[]>
}

export interface ShopifyAccessToken {
  accessToken: string
  /** Granted scopes as Shopify returned them (comma-separated); may differ from what was requested. */
  scope: string
  /** Seconds until expiry when Shopify issued an expiring token; null for the non-expiring tokens custom apps receive. */
  expiresIn: number | null
}

const AccessTokenResponseSchema = z.object({
  access_token: z.string().min(1).max(4096),
  scope: z.string().max(4000).optional(),
  expires_in: z.number().positive().optional(),
})

/**
 * Exchanges the authorization code for an offline access token. The token
 * never reaches a log or an error message: on failure only the HTTP status
 * is kept as detail.
 */
export async function exchangeAccessToken(input: ExchangeAccessTokenInput): Promise<ShopifyAccessToken> {
  const shop = normalizeShopDomain(input.shop)
  if (!shop) throw new ConnectionError('invalid_url', RO_MESSAGES.invalid_url, false, 'token exchange: invalid shop domain')
  if (!input.clientId || !input.clientSecret) throw new ConnectionError('not_configured', RO_MESSAGES.not_configured, false, 'token exchange: app not configured')
  if (!input.code) throw new ConnectionError('unauthorized', RO_MESSAGES.oauth_code, false, 'token exchange: missing code')
  let res
  try {
    res = await safeFetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: input.clientId, client_secret: input.clientSecret, code: input.code }),
      fetchImpl: input.fetchImpl,
      lookup: input.lookup,
    })
  } catch (err) {
    throw translateStoreError(err, 'token exchange')
  }
  if (res.status !== 200) {
    // Shopify answers 400/401 for a used, expired or foreign code: the
    // merchant has to restart the install, so it is an "unauthorized" input.
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new ConnectionError('unauthorized', RO_MESSAGES.oauth_code, false, `token exchange: http ${res.status}`)
    }
    throw errorForHttpStatus(res.status, 'token exchange', looksLikeHtml(res.text))
  }
  const parsed = AccessTokenResponseSchema.safeParse(res.json)
  if (!parsed.success) throw new ConnectionError('invalid_response', RO_MESSAGES.invalid_response, false, 'token exchange: unexpected body shape')
  return { accessToken: parsed.data.access_token, scope: parsed.data.scope ?? '', expiresIn: parsed.data.expires_in ?? null }
}

// ─── Error translation shared with the adapter ──────────────────────────────

/** Merchant-facing Romanian messages: never a secret, a token or a provider body. */
export const RO_MESSAGES: Record<ConnectionFailureCode | 'oauth_code' | 'frozen' | 'locked' | 'webhook_url' | 'webhook_refused' | 'secrets_shape', string> = {
  invalid_url: 'Domeniul magazinului nu este valid. Folosește domeniul de forma magazin.myshopify.com.',
  ssrf_blocked: 'Adresa magazinului nu este permisă.',
  unreachable: 'Magazinul Shopify nu poate fi contactat momentan. Încearcă din nou în câteva minute.',
  unauthorized: 'Shopify a respins token-ul de acces. Reconectează magazinul.',
  forbidden: 'Shopify nu permite accesul aplicației la acest magazin (permisiuni lipsă sau magazin restricționat).',
  not_a_store: 'Adresa nu corespunde unui magazin Shopify activ.',
  api_version_unsupported: 'Versiunea API Shopify folosită nu mai este suportată. Contactează suportul.',
  rate_limited: 'Shopify limitează temporar cererile. Încearcă din nou în câteva secunde.',
  timeout: 'Magazinul Shopify nu a răspuns la timp. Încearcă din nou.',
  redirect: 'Shopify a răspuns cu o redirecționare. Folosește domeniul myshopify.com al magazinului.',
  invalid_response: 'Shopify a trimis un răspuns neașteptat. Încearcă din nou sau contactează suportul.',
  not_configured: 'Aplicația Shopify nu este configurată pe platformă.',
  oauth_code: 'Codul de autorizare Shopify nu este valid sau a expirat. Reia conectarea din pagina magazinului.',
  frozen: 'Magazinul Shopify este suspendat (plată restantă). Reia conectarea după ce magazinul este reactivat.',
  locked: 'Magazinul Shopify este blocat de Shopify. Contactează suportul Shopify.',
  webhook_url: 'Adresa publică pentru webhook-uri nu este configurată pe platformă.',
  webhook_refused: 'Shopify a refuzat înregistrarea webhook-urilor. Verifică permisiunile aplicației și încearcă din nou.',
  secrets_shape: 'Token-ul de acces Shopify lipsește sau are un format greșit. Reconectează magazinul.',
}

export function looksLikeHtml(text: string): boolean {
  return /^\s*(<!doctype\s+html|<html|<head|<body)/i.test(text)
}

/** HTTP status → ConnectionError (https://shopify.dev/docs/api/usage/response-codes, 2026-10-13). */
export function errorForHttpStatus(status: number, operation: string, html = false): ConnectionError {
  const detail = `${operation}: http ${status}`
  if (status === 401) return new ConnectionError('unauthorized', RO_MESSAGES.unauthorized, false, detail)
  if (status === 402) return new ConnectionError('forbidden', RO_MESSAGES.frozen, false, detail)
  if (status === 403) return new ConnectionError('forbidden', RO_MESSAGES.forbidden, false, detail)
  if (status === 404 || status === 410) return new ConnectionError('not_a_store', RO_MESSAGES.not_a_store, false, detail)
  if (status === 423) return new ConnectionError('forbidden', RO_MESSAGES.locked, false, detail)
  if (status === 429) return new ConnectionError('rate_limited', RO_MESSAGES.rate_limited, true, detail)
  if (status >= 500) return new ConnectionError('unreachable', RO_MESSAGES.unreachable, true, detail)
  if (html) return new ConnectionError('not_a_store', RO_MESSAGES.not_a_store, false, `${detail} (html body)`)
  return new ConnectionError('invalid_response', RO_MESSAGES.invalid_response, false, detail)
}

const URL_SHAPE_REASON = /not a URL|only https|credentials in the URL|port .* is not allowed|empty host|host name is not valid/

/** Anything thrown around a safeFetch call → ConnectionError (never carries a body or a token). */
export function translateStoreError(err: unknown, operation: string): ConnectionError {
  if (err instanceof ConnectionError) return err
  if (err instanceof UnsafeUrlError) {
    const code: ConnectionFailureCode = URL_SHAPE_REASON.test(err.reason) ? 'invalid_url' : 'ssrf_blocked'
    return new ConnectionError(code, RO_MESSAGES[code], false, `${operation}: ${err.reason}`)
  }
  if (err instanceof StoreHttpError) {
    switch (err.code) {
      case 'timeout':
        return new ConnectionError('timeout', RO_MESSAGES.timeout, true, `${operation}: timeout`)
      case 'network':
        return new ConnectionError('unreachable', RO_MESSAGES.unreachable, true, `${operation}: network`)
      case 'redirect':
        return new ConnectionError('redirect', RO_MESSAGES.redirect, false, `${operation}: redirect ${err.status ?? ''}`.trim())
      case 'too_large':
        return new ConnectionError('invalid_response', RO_MESSAGES.invalid_response, false, `${operation}: response too large`)
      case 'http':
        return errorForHttpStatus(err.status ?? 0, operation)
    }
  }
  // A failure we did not anticipate (a bug, an exotic runtime error): keep the
  // class name for the logs, never the message, which could echo request data.
  const name = err instanceof Error ? err.name : typeof err
  return new ConnectionError('invalid_response', RO_MESSAGES.invalid_response, false, `${operation}: unexpected ${name}`)
}
