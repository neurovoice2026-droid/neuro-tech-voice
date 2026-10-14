import { describe, expect, it } from 'vitest'
import { PLATFORM_CATALOG, PLATFORM_ORDER, platformName } from './platforms'

// The catalog is merchant-facing copy (cards, connect forms, instructions):
// it must stay English like the rest of the dashboard, keep its machine keys
// (field keys, docs links) and never leak a Romanian leftover.
const ROMANIAN = /[ăâîșțĂÂÎȘȚ]/

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

describe('platform catalog', () => {
  it('lists every platform once, in the display order', () => {
    expect([...PLATFORM_ORDER].sort()).toEqual(Object.keys(PLATFORM_CATALOG).sort())
    for (const id of PLATFORM_ORDER) expect(PLATFORM_CATALOG[id].id).toBe(id)
  })

  it('keeps the merchant copy in English with no blank line and the docs links intact', () => {
    for (const platform of Object.values(PLATFORM_CATALOG)) {
      for (const text of strings(platform)) {
        expect(text.trim().length, `${platform.id}: ${text}`).toBeGreaterThan(0)
        expect(text, `${platform.id}: ${text}`).not.toMatch(ROMANIAN)
      }
      expect(platform.docsUrl).toMatch(/^https:\/\//)
      expect(platform.reads.length).toBeGreaterThan(0)
      expect(platform.instructions.length).toBeGreaterThan(0)
    }
    expect(PLATFORM_CATALOG.custom.name).toBe('Custom store (API)')
    expect(PLATFORM_CATALOG.woocommerce.fields.find((f) => f.key === 'store_url')).toMatchObject({ label: 'Store URL', type: 'url', required: true })
  })

  it('keeps the connect-form keys the API accepts', () => {
    expect(PLATFORM_CATALOG.woocommerce.fields.map((f) => f.key)).toEqual(['store_url', 'consumer_key', 'consumer_secret'])
    expect(PLATFORM_CATALOG.shopify.fields.map((f) => f.key)).toEqual(['shop_domain'])
    expect(PLATFORM_CATALOG.magento.fields.map((f) => f.key)).toEqual(['store_url', 'access_token', 'consumer_key', 'consumer_secret', 'access_token_secret'])
    expect(PLATFORM_CATALOG.prestashop.fields.map((f) => f.key)).toEqual(['store_url', 'webservice_key'])
    expect(PLATFORM_CATALOG.custom.fields.map((f) => f.key)).toEqual(['store_url', 'auth_scheme', 'auth_header_name', 'auth_token', 'webhook_secret'])
    expect(PLATFORM_CATALOG.custom.fields.find((f) => f.key === 'auth_scheme')?.options?.map((o) => o.value)).toEqual(['bearer', 'api_key_header', 'basic'])
  })

  it('names a platform in English and falls back to "Store" for an unknown one', () => {
    expect(platformName('shopify')).toBe('Shopify')
    expect(platformName('custom')).toBe('Custom store (API)')
    expect(platformName(null)).toBe('Store')
    expect(platformName('toString')).toBe('Store')
  })
})
