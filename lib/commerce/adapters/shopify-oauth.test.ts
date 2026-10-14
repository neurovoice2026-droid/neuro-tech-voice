import crypto from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { jsonResponse, timeoutError } from '@/tests/helpers/fetch'
import { ConnectionError } from './types'
import {
  buildInstallUrl,
  errorForHttpStatus,
  exchangeAccessToken,
  isValidShopDomain,
  normalizeScopes,
  normalizeShopDomain,
  translateStoreError,
  verifyOAuthCallback,
} from './shopify-oauth'
import { StoreHttpError, UnsafeUrlError } from '../safe-fetch'

const SECRET = 'shpss_test_client_secret_0123456789'
const CLIENT_ID = 'client-id-abc'
const TOKEN = 'shpat_secret_access_token_9f8e7d6c5b4a'
const publicLookup = async () => ['93.184.216.34']

function signedQuery(params: Record<string, string>, secret = SECRET): URLSearchParams {
  const message = Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex')
  return new URLSearchParams({ ...params, hmac })
}

describe('shop domain validation', () => {
  it('accepts only anchored *.myshopify.com hosts, case-insensitively', () => {
    expect(isValidShopDomain('my-shop.myshopify.com')).toBe(true)
    expect(isValidShopDomain('My-Shop.MYSHOPIFY.com')).toBe(true)
    expect(isValidShopDomain('shop1.myshopify.com')).toBe(true)
    expect(isValidShopDomain('exampleshop.myshopify.com.attacker.example')).toBe(false)
    expect(isValidShopDomain('attacker.example/exampleshop.myshopify.com')).toBe(false)
    expect(isValidShopDomain('-shop.myshopify.com')).toBe(false)
    expect(isValidShopDomain('shop.myshopify.co')).toBe(false)
    expect(isValidShopDomain('shop.example.com')).toBe(false)
    expect(isValidShopDomain('')).toBe(false)
    expect(isValidShopDomain('a.b.myshopify.com')).toBe(false)
  })

  it('normalizes what the merchant typed to the canonical host', () => {
    expect(normalizeShopDomain(' My-Shop.myshopify.com ')).toBe('my-shop.myshopify.com')
    expect(normalizeShopDomain('https://my-shop.myshopify.com/admin')).toBe('my-shop.myshopify.com')
    expect(normalizeShopDomain('my-shop.myshopify.com/admin/apps')).toBe('my-shop.myshopify.com')
    expect(normalizeShopDomain('http://my-shop.myshopify.com')).toBeNull()
    expect(normalizeShopDomain('https://user:pw@my-shop.myshopify.com')).toBeNull()
    expect(normalizeShopDomain('https://www.my-store.ro')).toBeNull()
    expect(normalizeShopDomain('my-shop')).toBeNull()
  })
})

describe('buildInstallUrl', () => {
  it('builds the documented authorize URL with every parameter encoded', () => {
    const url = new URL(buildInstallUrl({ shop: 'My-Shop.myshopify.com', clientId: CLIENT_ID, scopes: 'read_orders, read_customers,read_orders', redirectUri: 'https://app.example.com/api/commerce/shopify/callback?x=1', state: 'nonce-123' }))
    expect(url.origin).toBe('https://my-shop.myshopify.com')
    expect(url.pathname).toBe('/admin/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID)
    expect(url.searchParams.get('scope')).toBe('read_orders,read_customers')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/api/commerce/shopify/callback?x=1')
    expect(url.searchParams.get('state')).toBe('nonce-123')
  })

  it('refuses a non-Shopify domain and a missing app configuration', () => {
    expect(() => buildInstallUrl({ shop: 'evil.example.com', clientId: CLIENT_ID, scopes: 'read_orders', redirectUri: 'https://app.example.com/cb', state: 's' })).toThrow(ConnectionError)
    expect(() => buildInstallUrl({ shop: 'shop.myshopify.com', clientId: '', scopes: 'read_orders', redirectUri: 'https://app.example.com/cb', state: 's' })).toThrowError(expect.objectContaining({ code: 'not_configured' }))
  })

  it('normalizes scope lists', () => {
    expect(normalizeScopes(' read_orders ,read_customers\nread_products,read_orders, bad scope!')).toEqual(['read_orders', 'read_customers', 'read_products'])
  })
})

describe('verifyOAuthCallback', () => {
  const params = { code: 'abc123code', shop: 'my-shop.myshopify.com', state: 'nonce-1', timestamp: '1760000000', host: 'bXktc2hvcC5teXNob3BpZnkuY29tL2FkbWlu' }

  it('accepts a correctly signed callback', () => {
    const result = verifyOAuthCallback(signedQuery(params), SECRET)
    expect(result).toEqual({ ok: true, shop: 'my-shop.myshopify.com', code: 'abc123code', state: 'nonce-1', timestamp: 1760000000 })
  })

  it('rejects a tampered parameter, a wrong secret, a missing or malformed hmac', () => {
    const tampered = signedQuery(params)
    tampered.set('shop', 'other-shop.myshopify.com')
    expect(verifyOAuthCallback(tampered, SECRET)).toEqual({ ok: false, reason: 'bad_hmac' })
    expect(verifyOAuthCallback(signedQuery(params, 'another-secret'), SECRET)).toEqual({ ok: false, reason: 'bad_hmac' })
    expect(verifyOAuthCallback(new URLSearchParams(params), SECRET)).toEqual({ ok: false, reason: 'missing_hmac' })
    const short = new URLSearchParams({ ...params, hmac: 'abcd' })
    expect(verifyOAuthCallback(short, SECRET)).toEqual({ ok: false, reason: 'missing_hmac' })
  })

  it('ignores the legacy signature parameter and requires shop, state and code', () => {
    const withSignature = signedQuery(params)
    withSignature.set('signature', 'legacy')
    expect(verifyOAuthCallback(withSignature, SECRET)).toMatchObject({ ok: true })
    expect(verifyOAuthCallback(signedQuery({ ...params, shop: 'evil.example.com' }), SECRET)).toEqual({ ok: false, reason: 'invalid_shop' })
    expect(verifyOAuthCallback(signedQuery({ ...params, state: '' }), SECRET)).toEqual({ ok: false, reason: 'missing_state' })
    expect(verifyOAuthCallback(signedQuery({ ...params, code: '' }), SECRET)).toEqual({ ok: false, reason: 'missing_code' })
  })
})

describe('exchangeAccessToken', () => {
  it('posts the code to the shop and returns the token and scopes', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ access_token: TOKEN, scope: 'read_orders,read_customers' }))
    const result = await exchangeAccessToken({ shop: 'My-Shop.myshopify.com', clientId: CLIENT_ID, clientSecret: SECRET, code: 'code-1', fetchImpl: fetchImpl as unknown as typeof fetch, lookup: publicLookup })
    expect(result).toEqual({ accessToken: TOKEN, scope: 'read_orders,read_customers', expiresIn: null })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://my-shop.myshopify.com/admin/oauth/access_token')
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('manual')
    expect(JSON.parse(init.body as string)).toEqual({ client_id: CLIENT_ID, client_secret: SECRET, code: 'code-1' })
  })

  it('keeps an expiring token expiry when Shopify sends one', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ access_token: TOKEN, scope: 'read_orders', expires_in: 3600, refresh_token: 'r' }))
    const result = await exchangeAccessToken({ shop: 'my-shop.myshopify.com', clientId: CLIENT_ID, clientSecret: SECRET, code: 'code-1', fetchImpl: fetchImpl as unknown as typeof fetch, lookup: publicLookup })
    expect(result.expiresIn).toBe(3600)
  })

  it('maps a rejected code, a missing shop, timeouts and bad bodies without leaking anything', async () => {
    const cases: Array<[() => Promise<Response>, string]> = [
      [async () => jsonResponse({ error: 'invalid_request', error_description: `bad code ${TOKEN}` }, 400), 'unauthorized'],
      [async () => jsonResponse({ errors: 'Unauthorized' }, 401), 'unauthorized'],
      [async () => new Response('<!doctype html><html><body>Not found</body></html>', { status: 404, headers: { 'content-type': 'text/html' } }), 'not_a_store'],
      [async () => jsonResponse({}, 429), 'rate_limited'],
      [async () => jsonResponse({ errors: 'boom' }, 502), 'unreachable'],
      [async () => { throw timeoutError() }, 'timeout'],
      [async () => new Response(null, { status: 302, headers: { location: 'https://elsewhere.example.com' } }), 'redirect'],
      [async () => { throw new TypeError('fetch failed') }, 'unreachable'],
      [async () => jsonResponse({ scope: 'read_orders' }), 'invalid_response'],
    ]
    for (const [impl, code] of cases) {
      const fetchImpl = vi.fn(impl)
      let thrown: unknown
      try {
        await exchangeAccessToken({ shop: 'my-shop.myshopify.com', clientId: CLIENT_ID, clientSecret: SECRET, code: 'code-1', fetchImpl: fetchImpl as unknown as typeof fetch, lookup: publicLookup })
      } catch (err) {
        thrown = err
      }
      expect(thrown, code).toBeInstanceOf(ConnectionError)
      const error = thrown as ConnectionError
      expect(error.code, code).toBe(code)
      expect(error.publicMessage).toMatch(/[ăâîșț]|Shopify|magazin/i)
      for (const text of [error.message, error.publicMessage]) {
        expect(text).not.toContain(TOKEN)
        expect(text).not.toContain(SECRET)
        expect(text).not.toContain('bad code')
      }
    }
  })

  it('never contacts a host that is not a myshopify.com shop or that resolves privately', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ access_token: TOKEN }))
    await expect(exchangeAccessToken({ shop: 'shop.example.com', clientId: CLIENT_ID, clientSecret: SECRET, code: 'c', fetchImpl: fetchImpl as unknown as typeof fetch, lookup: publicLookup })).rejects.toMatchObject({ code: 'invalid_url' })
    await expect(exchangeAccessToken({ shop: 'shop.myshopify.com', clientId: CLIENT_ID, clientSecret: SECRET, code: 'c', fetchImpl: fetchImpl as unknown as typeof fetch, lookup: async () => ['10.0.0.9'] })).rejects.toMatchObject({ code: 'ssrf_blocked' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('error translation', () => {
  it('maps HTTP statuses to connection failure codes', () => {
    expect(errorForHttpStatus(401, 'op').code).toBe('unauthorized')
    expect(errorForHttpStatus(402, 'op').code).toBe('forbidden')
    expect(errorForHttpStatus(403, 'op').code).toBe('forbidden')
    expect(errorForHttpStatus(404, 'op').code).toBe('not_a_store')
    expect(errorForHttpStatus(423, 'op').code).toBe('forbidden')
    expect(errorForHttpStatus(429, 'op')).toMatchObject({ code: 'rate_limited', retryable: true })
    expect(errorForHttpStatus(503, 'op')).toMatchObject({ code: 'unreachable', retryable: true })
    expect(errorForHttpStatus(200, 'op', true).code).toBe('not_a_store')
    expect(errorForHttpStatus(418, 'op').code).toBe('invalid_response')
  })

  it('maps transport and URL failures', () => {
    expect(translateStoreError(new UnsafeUrlError('only https is allowed'), 'op').code).toBe('invalid_url')
    expect(translateStoreError(new UnsafeUrlError('host resolves to a private or reserved address'), 'op').code).toBe('ssrf_blocked')
    expect(translateStoreError(new StoreHttpError('timeout', 'x'), 'op')).toMatchObject({ code: 'timeout', retryable: true })
    expect(translateStoreError(new StoreHttpError('network', 'x'), 'op')).toMatchObject({ code: 'unreachable', retryable: true })
    expect(translateStoreError(new StoreHttpError('redirect', 'x', 301), 'op').code).toBe('redirect')
    expect(translateStoreError(new StoreHttpError('too_large', 'x'), 'op').code).toBe('invalid_response')
    const unexpected = translateStoreError(new RangeError(`contains ${TOKEN}`), 'op')
    expect(unexpected.code).toBe('invalid_response')
    expect(unexpected.message).not.toContain(TOKEN)
    const passthrough = new ConnectionError('forbidden', 'x', false)
    expect(translateStoreError(passthrough, 'op')).toBe(passthrough)
  })
})
