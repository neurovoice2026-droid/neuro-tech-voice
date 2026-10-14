import { describe, expect, it } from 'vitest'
import { encodeShopifyState, parseShopifyState } from './shopify-state'

describe('Shopify OAuth state cookie', () => {
  it('round-trips a shop domain that contains dots', () => {
    const encoded = encodeShopifyState({ nonce: 'abc_DEF-123', returnKey: 'onboarding', shop: 'magazin-test.myshopify.com' })
    expect(parseShopifyState(encoded)).toEqual({ nonce: 'abc_DEF-123', returnKey: 'onboarding', shop: 'magazin-test.myshopify.com' })
  })

  it('rejects malformed values instead of guessing', () => {
    expect(parseShopifyState(null)).toBeNull()
    expect(parseShopifyState('')).toBeNull()
    expect(parseShopifyState('nonce-only')).toBeNull()
    expect(parseShopifyState('nonce.magazin')).toBeNull()
    expect(parseShopifyState('nonce.magazin.')).toBeNull()
    expect(parseShopifyState('.magazin.shop.myshopify.com')).toBeNull()
    expect(parseShopifyState('nonce..shop.myshopify.com')).toBeNull()
    expect(parseShopifyState('no nce.magazin.shop.myshopify.com')).toBeNull()
  })

  it('refuses to encode parts that would break the separator', () => {
    expect(() => encodeShopifyState({ nonce: 'a.b', returnKey: 'magazin', shop: 'x.myshopify.com' })).toThrow()
  })
})

describe('Shopify OAuth return URL', () => {
  it('speaks the onboarding step vocabulary', async () => {
    const { oauthReturnUrl } = await import('./shopify-state')
    expect(oauthReturnUrl('onboarding', { ok: true })).toBe('/onboarding?commerce=connected')
    expect(oauthReturnUrl('onboarding', { ok: false, code: 'state_mismatch' })).toBe('/onboarding?commerce_error=state_mismatch')
  })

  it('speaks the Magazin connections page vocabulary and never a user-supplied path', async () => {
    const { oauthReturnUrl, returnPathOf } = await import('./shopify-state')
    expect(oauthReturnUrl('magazin', { ok: true })).toBe('/magazin/conexiuni?connected=1')
    expect(oauthReturnUrl(null, { ok: false, code: 'not_configured' })).toBe('/magazin/conexiuni?error=not_configured')
    expect(oauthReturnUrl('https://evil.example', { ok: true })).toBe('/magazin/conexiuni?connected=1')
    expect(returnPathOf('../admin')).toBe('/magazin/conexiuni')
  })

  it('sanitises failure codes before they reach a URL', async () => {
    const { oauthReturnUrl } = await import('./shopify-state')
    expect(oauthReturnUrl('magazin', { ok: false, code: 'Not a store!/<script>' })).toBe('/magazin/conexiuni?error=not_a_store___script_')
    expect(oauthReturnUrl('magazin', { ok: false, code: '' })).toBe('/magazin/conexiuni?error=unknown')
  })
})
