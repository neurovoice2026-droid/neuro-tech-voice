import { describe, expect, it } from 'vitest'
import { encodeShopifyState, parseShopifyState } from './shopify-state'

describe('Shopify OAuth state cookie', () => {
  it('round-trips a shop domain that contains dots', () => {
    const encoded = encodeShopifyState({ nonce: 'abc_DEF-123', returnKey: 'onboarding', shop: 'my-test.myshopify.com' })
    expect(parseShopifyState(encoded)).toEqual({ nonce: 'abc_DEF-123', returnKey: 'onboarding', shop: 'my-test.myshopify.com' })
  })

  it('rejects malformed values instead of guessing', () => {
    expect(parseShopifyState(null)).toBeNull()
    expect(parseShopifyState('')).toBeNull()
    expect(parseShopifyState('nonce-only')).toBeNull()
    expect(parseShopifyState('nonce.store')).toBeNull()
    expect(parseShopifyState('nonce.store.')).toBeNull()
    expect(parseShopifyState('.store.shop.myshopify.com')).toBeNull()
    expect(parseShopifyState('nonce..shop.myshopify.com')).toBeNull()
    expect(parseShopifyState('no nce.store.shop.myshopify.com')).toBeNull()
  })

  it('refuses to encode parts that would break the separator', () => {
    expect(() => encodeShopifyState({ nonce: 'a.b', returnKey: 'store', shop: 'x.myshopify.com' })).toThrow()
  })
})

describe('Shopify OAuth return URL', () => {
  it('speaks the onboarding step vocabulary', async () => {
    const { oauthReturnUrl } = await import('./shopify-state')
    expect(oauthReturnUrl('onboarding', { ok: true })).toBe('/onboarding?commerce=connected')
    expect(oauthReturnUrl('onboarding', { ok: false, code: 'state_mismatch' })).toBe('/onboarding?commerce_error=state_mismatch')
  })

  it('speaks the Store connections page vocabulary and never a user-supplied path', async () => {
    const { oauthReturnUrl, returnKeyOf, returnPathOf, STORE_CONNECTIONS_PATH } = await import('./shopify-state')
    expect(STORE_CONNECTIONS_PATH).toBe('/store/connections')
    expect(oauthReturnUrl('store', { ok: true })).toBe('/store/connections?connected=1')
    expect(oauthReturnUrl(null, { ok: false, code: 'not_configured' })).toBe('/store/connections?error=not_configured')
    expect(oauthReturnUrl('https://evil.example', { ok: true })).toBe('/store/connections?connected=1')
    expect(returnPathOf('../admin')).toBe('/store/connections')
    // The pre-rename key still lands on the Store section (a cookie written before the deploy).
    expect(returnKeyOf('magazin')).toBe('store')
    expect(returnPathOf('magazin')).toBe('/store/connections')
  })

  it('sanitises failure codes before they reach a URL', async () => {
    const { oauthReturnUrl } = await import('./shopify-state')
    expect(oauthReturnUrl('store', { ok: false, code: 'Not a store!/<script>' })).toBe('/store/connections?error=not_a_store___script_')
    expect(oauthReturnUrl('store', { ok: false, code: '' })).toBe('/store/connections?error=unknown')
  })
})
