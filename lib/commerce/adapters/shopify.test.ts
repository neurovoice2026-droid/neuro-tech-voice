import crypto from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { Logger } from '@/lib/observability/logger'
import { jsonResponse, timeoutError } from '@/tests/helpers/fetch'
import { NO_CAPABILITIES, type CommerceCapabilities } from '../types'
import { ConnectionError, type AdapterConnection, type RawWebhookRequest } from './types'
import { SHOPIFY_API_VERSION, ShopifySecretsSchema, createShopifyAdapter, shopifyAdapter } from './shopify'

const SHOP = 'my-shop.myshopify.com'
const TOKEN = 'shpat_test_fixture_not_a_real_token_ZZ'
const CLIENT_SECRET = 'shpss_client_secret_0123456789abcdef'
const WEBHOOK_URL = 'https://app.example.com/api/commerce/webhooks/shopify/conn-1/pub-abc'
const publicLookup = async () => ['93.184.216.34']
const appConfig = () => ({ clientId: 'client-id', clientSecret: CLIENT_SECRET, scopes: 'read_orders,read_customers,read_products,read_checkouts', apiVersion: '2026-07' })

interface CapturedLog {
  lines: Array<{ level: string; event: string; fields: unknown }>
  log: Logger
}

function captureLogger(): CapturedLog {
  const lines: CapturedLog['lines'] = []
  const log: Logger = {
    context: {},
    debug: (event, fields) => void lines.push({ level: 'debug', event, fields }),
    info: (event, fields) => void lines.push({ level: 'info', event, fields }),
    warn: (event, fields) => void lines.push({ level: 'warn', event, fields }),
    error: (event, err, fields) => void lines.push({ level: 'error', event, fields: { err, ...(fields ?? {}) } }),
    child: () => log,
  }
  return { lines, log }
}

type Handler = (operation: string, variables: Record<string, unknown>, body: string) => Response | Promise<Response>

/** A fake Admin API: routes by the GraphQL operation name and records every request. */
function fakeShopify(handler: Handler) {
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? init.body : ''
    const parsed = body ? (JSON.parse(body) as { query: string; variables: Record<string, unknown> }) : { query: '', variables: {} }
    const operation = parsed.query.match(/^\s*(?:query|mutation)\s+(\w+)/)?.[1] ?? 'unknown'
    return handler(operation, parsed.variables ?? {}, body)
  })
  const adapter = createShopifyAdapter({ fetchImpl: fetchImpl as unknown as typeof fetch, lookup: publicLookup, appConfig })
  return { fetchImpl, adapter }
}

const gql = (data: unknown, extra: Record<string, unknown> = {}) => jsonResponse({ data, extensions: { cost: { requestedQueryCost: 10, actualQueryCost: 5, throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 1990, restoreRate: 100 } } }, ...extra })

const SHOP_DATA = {
  shop: { name: 'Magazinul Meu', myshopifyDomain: SHOP, currencyCode: 'RON', ianaTimezone: 'Europe/Bucharest', primaryDomain: { host: 'www.magazinul-meu.ro' }, shopAddress: { countryCodeV2: 'RO' }, billingAddress: { countryCodeV2: 'RO' } },
  currentAppInstallation: { accessScopes: [{ handle: 'read_orders' }, { handle: 'read_customers' }, { handle: 'read_products' }, { handle: 'read_checkouts' }] },
}

const PROBE_ORDERS = {
  orders: { nodes: [{ id: 'gid://shopify/Order/1', email: 'a@b.ro', phone: null, shippingAddress: { phone: '0722 123 456', address1: 'Str. Lalelelor 3' }, billingAddress: null, customer: null }] },
}

const ORDER_NODE = {
  id: 'gid://shopify/Order/5001',
  legacyResourceId: '5001',
  name: '#1042',
  createdAt: '2026-10-10T08:00:00Z',
  updatedAt: '2026-10-11T09:30:00Z',
  processedAt: '2026-10-10T08:00:00Z',
  cancelledAt: null,
  closedAt: null,
  displayFinancialStatus: 'PENDING',
  displayFulfillmentStatus: 'UNFULFILLED',
  paymentGatewayNames: ['Plata ramburs (COD)'],
  currencyCode: 'RON',
  test: false,
  email: 'ion@example.ro',
  phone: null,
  totalPriceSet: { shopMoney: { amount: '249.90', currencyCode: 'RON' } },
  customer: { id: 'gid://shopify/Customer/77', firstName: 'Ion', lastName: 'Popescu', defaultPhoneNumber: { phoneNumber: '+40722000111' } },
  shippingAddress: { name: 'Ion Popescu', firstName: 'Ion', lastName: 'Popescu', phone: '0722 123 456', address1: 'Str. Lalelelor 3', city: 'Cluj-Napoca', countryCodeV2: 'RO' },
  billingAddress: { name: 'Ion Popescu', phone: '0733 999 888', countryCodeV2: 'RO' },
  lineItems: {
    nodes: [
      { id: 'gid://shopify/LineItem/1', title: 'Tricou', name: 'Tricou - M', quantity: 2, currentQuantity: 2, sku: 'TRI-M', product: { id: 'gid://shopify/Product/300' }, originalUnitPriceSet: { shopMoney: { amount: '99.95', currencyCode: 'RON' } }, discountedTotalSet: { shopMoney: { amount: '199.90', currencyCode: 'RON' } } },
      { id: 'gid://shopify/LineItem/2', title: 'Șapcă', name: 'Șapcă', quantity: 1, currentQuantity: 0, sku: null, product: null, originalUnitPriceSet: { shopMoney: { amount: '50.00', currencyCode: 'RON' } }, discountedTotalSet: { shopMoney: { amount: '0.00', currencyCode: 'RON' } } },
    ],
    pageInfo: { hasNextPage: false },
  },
}

function connection(overrides: Partial<AdapterConnection> = {}, capabilities: Partial<CommerceCapabilities> = {}): AdapterConnection {
  return {
    id: 'conn-1',
    orgId: 'org-1',
    platform: 'shopify',
    storeUrl: `https://${SHOP}`,
    storeDomain: SHOP,
    secrets: { access_token: TOKEN, scope: 'read_orders,read_customers,read_products' },
    capabilities: { ...NO_CAPABILITIES, products: true, customers: true, orders: true, webhooks: true, abandoned_carts: true, customer_phone: true, ...capabilities },
    webhookRegistrations: [],
    webhookUrl: WEBHOOK_URL,
    ...overrides,
  }
}

function expectNoSecret(...texts: Array<string | undefined | null>) {
  for (const text of texts) {
    if (!text) continue
    expect(text).not.toContain(TOKEN)
    expect(text).not.toContain(CLIENT_SECRET)
  }
}

describe('ShopifySecretsSchema', () => {
  it('accepts an access token with optional scopes and rejects junk', () => {
    expect(ShopifySecretsSchema.safeParse({ access_token: TOKEN, scope: 'read_orders' }).success).toBe(true)
    expect(ShopifySecretsSchema.safeParse({ access_token: TOKEN }).success).toBe(true)
    expect(ShopifySecretsSchema.safeParse({ access_token: 'short' }).success).toBe(false)
    expect(ShopifySecretsSchema.safeParse({ access_token: 'has spaces in it' }).success).toBe(false)
    expect(ShopifySecretsSchema.safeParse({}).success).toBe(false)
  })

  it('pins the API version and exposes a default instance', () => {
    expect(SHOPIFY_API_VERSION).toMatch(/^\d{4}-(01|04|07|10)$/)
    expect(shopifyAdapter.platform).toBe('shopify')
  })
})

describe('validateConnection', () => {
  it('reads the shop and its scopes, probes protected data and reports capabilities', async () => {
    const { adapter, fetchImpl } = fakeShopify((op) => {
      if (op === 'ShopifyValidateShop') return gql(SHOP_DATA)
      if (op === 'ShopifyProbeOrders') return gql(PROBE_ORDERS)
      throw new Error(`unexpected ${op}`)
    })
    const { log, lines } = captureLogger()
    const store = await adapter.validateConnection({ storeUrl: 'https://My-Shop.myshopify.com/admin', secrets: { access_token: TOKEN, scope: 'read_orders' } }, log)
    expect(store).toMatchObject({
      storeUrl: `https://${SHOP}`,
      storeDomain: SHOP,
      displayName: 'Magazinul Meu',
      currency: 'RON',
      countryCode: 'RO',
      timezone: 'Europe/Bucharest',
      platformVersion: SHOPIFY_API_VERSION,
      secrets: { access_token: TOKEN, scope: 'read_orders,read_customers,read_products,read_checkouts' },
    })
    expect(store.capabilities).toMatchObject({ products: true, customers: true, orders: true, webhooks: true, abandoned_carts: true, customer_phone: true, polling_minutes: null })
    expect(store.capabilities.notes.join(' ')).toMatch(/read_all_orders/)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://${SHOP}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`)
    expect(new Headers(init.headers).get('x-shopify-access-token')).toBe(TOKEN)
    expect(init.redirect).toBe('manual')
    expectNoSecret(JSON.stringify(lines))
  })

  it('uses an operator API version override only when it is well-formed', async () => {
    const calls: string[] = []
    const run = async (override: string | undefined) => {
      const fetchImpl = vi.fn(async (input: string | URL | Request) => {
        calls.push(String(input))
        return gql(SHOP_DATA)
      })
      const adapter = createShopifyAdapter({ fetchImpl: fetchImpl as unknown as typeof fetch, lookup: publicLookup, appConfig, apiVersionOverride: () => override })
      await adapter.validateConnection({ storeUrl: SHOP, secrets: { access_token: TOKEN } }, captureLogger().log)
    }
    await run('2027-01')
    expect(calls.at(-1)).toContain('/admin/api/2027-01/graphql.json')
    await run('latest')
    expect(calls.at(-1)).toContain(`/admin/api/${SHOPIFY_API_VERSION}/graphql.json`)
  })

  it('reports customer_phone false when Shopify redacts protected fields', async () => {
    const { adapter } = fakeShopify((op) => {
      if (op === 'ShopifyValidateShop') return gql(SHOP_DATA)
      return gql(
        { orders: { nodes: [{ id: 'gid://shopify/Order/1', email: null, phone: null, shippingAddress: { phone: null, address1: null }, billingAddress: null, customer: { defaultPhoneNumber: null, defaultEmailAddress: null } }] } },
        { errors: [{ message: 'This app is not approved to access the Customer object. See https://partners.shopify.com/1/apps/2/customer_data for more details.', path: ['orders', 'nodes', 0, 'phone'] }] },
      )
    })
    const store = await adapter.validateConnection({ storeUrl: SHOP, secrets: { access_token: TOKEN } }, captureLogger().log)
    expect(store.capabilities).toMatchObject({ orders: true, customer_phone: false, abandoned_carts: false, webhooks: true })
    expect(store.capabilities.notes.some((n) => /protejate/.test(n))).toBe(true)
  })

  it('reports customer_phone false when every protected field is null on every recent order', async () => {
    const { adapter } = fakeShopify((op) => {
      if (op === 'ShopifyValidateShop') return gql(SHOP_DATA)
      return gql({ orders: { nodes: [{ id: 'gid://shopify/Order/1', email: null, phone: null, shippingAddress: { phone: null, address1: null }, billingAddress: { phone: null }, customer: null }] } })
    })
    const store = await adapter.validateConnection({ storeUrl: SHOP, secrets: { access_token: TOKEN } }, captureLogger().log)
    expect(store.capabilities.customer_phone).toBe(false)
  })

  it('judges protected data on the customers when the shop has no orders yet', async () => {
    const ops: string[] = []
    const run = async (customers: unknown) => {
      const { adapter } = fakeShopify((op) => {
        ops.push(op)
        if (op === 'ShopifyValidateShop') return gql(SHOP_DATA)
        if (op === 'ShopifyProbeOrders') return gql({ orders: { nodes: [] } })
        if (op === 'ShopifyProbeCustomers') return gql({ customers: { nodes: customers } })
        throw new Error(`unexpected ${op}`)
      })
      return adapter.validateConnection({ storeUrl: SHOP, secrets: { access_token: TOKEN } }, captureLogger().log)
    }
    const readable = await run([{ id: 'gid://shopify/Customer/1', defaultPhoneNumber: { phoneNumber: '+40722000111' }, defaultEmailAddress: null, defaultAddress: null }])
    expect(ops).toEqual(['ShopifyValidateShop', 'ShopifyProbeOrders', 'ShopifyProbeCustomers'])
    expect(readable.capabilities).toMatchObject({ customer_phone: true, abandoned_carts: true })
    expect(readable.capabilities.notes.some((n) => /nu are încă/.test(n))).toBe(false)
    const redacted = await run([{ id: 'gid://shopify/Customer/1', defaultPhoneNumber: null, defaultEmailAddress: null, defaultAddress: { phone: null, address1: null } }])
    expect(redacted.capabilities).toMatchObject({ customer_phone: false, abandoned_carts: false })
    const empty = await run([])
    expect(empty.capabilities.customer_phone).toBe(true)
    expect(empty.capabilities.notes.some((n) => /nu are încă/.test(n))).toBe(true)
  })

  it('does not request the deprecated Shop.billingAddress field', async () => {
    let query = ''
    const { adapter } = fakeShopify((op, _variables, body) => {
      if (op === 'ShopifyValidateShop') query = (JSON.parse(body) as { query: string }).query
      return gql(op === 'ShopifyValidateShop' ? SHOP_DATA : PROBE_ORDERS)
    })
    const store = await adapter.validateConnection({ storeUrl: SHOP, secrets: { access_token: TOKEN } }, captureLogger().log)
    expect(query).toContain('shopAddress { countryCodeV2 }')
    expect(query).not.toContain('billingAddress')
    expect(store.countryCode).toBe('RO')
  })

  it('derives capabilities from the granted scopes', async () => {
    const { adapter } = fakeShopify((op) => {
      if (op === 'ShopifyValidateShop') return gql({ ...SHOP_DATA, currentAppInstallation: { accessScopes: [{ handle: 'read_products' }] } })
      throw new Error(`unexpected ${op}`)
    })
    const store = await adapter.validateConnection({ storeUrl: SHOP, secrets: { access_token: TOKEN } }, captureLogger().log)
    expect(store.capabilities).toMatchObject({ products: true, customers: false, orders: false, webhooks: true, abandoned_carts: false, customer_phone: false })
    expect(store.capabilities.notes.join(' ')).toMatch(/read_orders/)
    expect(store.capabilities.notes.join(' ')).toMatch(/read_customers/)
  })

  it('rejects a non-Shopify domain and a malformed token before any request', async () => {
    const { adapter, fetchImpl } = fakeShopify(() => gql(SHOP_DATA))
    await expect(adapter.validateConnection({ storeUrl: 'https://shop.example.com', secrets: { access_token: TOKEN } }, captureLogger().log)).rejects.toMatchObject({ code: 'invalid_url' })
    await expect(adapter.validateConnection({ storeUrl: SHOP, secrets: { access_token: '' } }, captureLogger().log)).rejects.toMatchObject({ code: 'unauthorized' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('maps every failure class without leaking the token in errors or logs', async () => {
    const cases: Array<[Handler, string, boolean]> = [
      [() => jsonResponse({ errors: `[API] Invalid API key or access token ${TOKEN}` }, 401), 'unauthorized', false],
      [() => jsonResponse({ errors: 'Forbidden' }, 403), 'forbidden', false],
      [() => jsonResponse({ errors: 'Payment Required' }, 402), 'forbidden', false],
      [() => new Response('<!DOCTYPE html><html><head><title>Not found</title></head></html>', { status: 404, headers: { 'content-type': 'text/html' } }), 'not_a_store', false],
      [() => new Response('<html><body>Password protected</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }), 'not_a_store', false],
      [() => jsonResponse({ errors: 'Locked' }, 423), 'forbidden', false],
      [() => jsonResponse({ errors: 'Too many requests' }, 429), 'rate_limited', true],
      [() => jsonResponse({ errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }] }), 'rate_limited', true],
      [() => jsonResponse({ errors: [{ message: 'Access denied for shop field.', extensions: { code: 'ACCESS_DENIED' } }], data: { shop: null } }), 'forbidden', false],
      [() => jsonResponse({ errors: [{ message: "Field 'shopAddress' doesn't exist on type 'Shop'", extensions: { code: 'undefinedField', typeName: 'Shop', fieldName: 'shopAddress' } }] }), 'api_version_unsupported', false],
      [() => jsonResponse({ errors: [{ message: 'Internal error', extensions: { code: 'INTERNAL_SERVER_ERROR' } }], data: null }), 'unreachable', true],
      [() => jsonResponse({ errors: 'Service unavailable' }, 503), 'unreachable', true],
      [() => { throw timeoutError() }, 'timeout', true],
      [() => new Response(null, { status: 301, headers: { location: `https://${SHOP}/admin` } }), 'redirect', false],
      [() => { throw new TypeError('fetch failed') }, 'unreachable', true],
      [() => new Response('not json at all', { status: 200, headers: { 'content-type': 'text/plain' } }), 'invalid_response', false],
    ]
    for (const [handler, code, retryable] of cases) {
      const { adapter } = fakeShopify(handler)
      const { log, lines } = captureLogger()
      let thrown: unknown
      try {
        await adapter.validateConnection({ storeUrl: SHOP, secrets: { access_token: TOKEN } }, log)
      } catch (err) {
        thrown = err
      }
      expect(thrown, code).toBeInstanceOf(ConnectionError)
      const error = thrown as ConnectionError
      expect(error.code, code).toBe(code)
      expect(error.retryable, code).toBe(retryable)
      expect(error.publicMessage, code).not.toMatch(/Invalid API key|html|Throttled/)
      expectNoSecret(error.message, error.publicMessage, JSON.stringify(lines))
    }
  })

  it('refuses a shop host that resolves to a private address', async () => {
    const fetchImpl = vi.fn(async () => gql(SHOP_DATA))
    const adapter = createShopifyAdapter({ fetchImpl: fetchImpl as unknown as typeof fetch, lookup: async () => ['169.254.169.254'], appConfig })
    await expect(adapter.validateConnection({ storeUrl: SHOP, secrets: { access_token: TOKEN } }, captureLogger().log)).rejects.toMatchObject({ code: 'ssrf_blocked' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('getCapabilities', () => {
  it('returns a copy of the stored capabilities', () => {
    const conn = connection()
    const caps = shopifyAdapter.getCapabilities(conn)
    expect(caps).toEqual(conn.capabilities)
    expect(caps.notes).not.toBe(conn.capabilities.notes)
  })
})

describe('syncPage', () => {
  it('fetches one page of orders with the platform cursor and normalizes them', async () => {
    const seen: Array<Record<string, unknown>> = []
    const { adapter } = fakeShopify((op, variables) => {
      expect(op).toBe('ShopifyOrdersPage')
      seen.push(variables)
      return gql({ orders: { nodes: [ORDER_NODE], pageInfo: { hasNextPage: true, endCursor: 'cursor-2' } } })
    })
    const batch = await adapter.syncPage(connection(), 'orders', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', captureLogger().log)
    expect(seen[0]).toMatchObject({ first: 10, after: null, query: null, reverse: true })
    expect(batch.done).toBe(false)
    expect(batch.checkpoint).toEqual({ cursor: 'cursor-2', modifiedAfter: null, pages: 1 })
    expect(batch.orders).toHaveLength(1)
    const order = batch.orders![0]
    expect(order).toMatchObject({
      externalId: '5001',
      orderNumber: '#1042',
      customerExternalId: '77',
      contactName: 'Ion Popescu',
      contactPhoneRaw: '0722 123 456',
      contactEmail: 'ion@example.ro',
      shippingCity: 'Cluj-Napoca',
      shippingCountry: 'RO',
      shippingSummary: 'Str. Lalelelor 3, Cluj-Napoca',
      status: 'processing',
      financialStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      paymentMethod: 'cash_on_delivery',
      paymentMethodTitle: 'Plata ramburs (COD)',
      currency: 'RON',
      total: 249.9,
      providerCreatedAt: '2026-10-10T08:00:00.000Z',
      providerUpdatedAt: '2026-10-11T09:30:00.000Z',
    })
    expect(order.items).toEqual([{ externalId: '1', productExternalId: '300', sku: 'TRI-M', name: 'Tricou - M', quantity: 2, unitPrice: 99.95, total: 199.9 }])
    expect(order.payloadHash).toMatch(/^[0-9a-f]{64}$/)
    expect(order.metadata).toMatchObject({ is_cod: true, source: 'graphql', gid: 'gid://shopify/Order/5001' })
  })

  it('passes the incremental watermark as an updated_at filter, oldest first, and stops on the last page', async () => {
    const seen: Array<Record<string, unknown>> = []
    const { adapter } = fakeShopify((op, variables) => {
      seen.push(variables)
      return gql({ orders: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } })
    })
    const batch = await adapter.syncPage(connection(), 'orders', { cursor: 'cursor-9', modifiedAfter: '2026-10-01T10:20:30.123Z', pages: 3 }, 'incremental', captureLogger().log)
    expect(seen[0]).toMatchObject({ after: 'cursor-9', query: "updated_at:>'2026-10-01T10:20:30Z'", reverse: false })
    expect(batch).toMatchObject({ done: true, orders: [], checkpoint: { cursor: 'cursor-9', modifiedAfter: '2026-10-01T10:20:30.123Z', pages: 4 } })
  })

  it('refuses a page that claims more results without a new cursor instead of looping on it', async () => {
    const stuck = fakeShopify(() => gql({ orders: { nodes: [ORDER_NODE], pageInfo: { hasNextPage: true, endCursor: null } } }))
    await expect(stuck.adapter.syncPage(connection(), 'orders', { cursor: 'cursor-1', modifiedAfter: null, pages: 1 }, 'initial', captureLogger().log)).rejects.toMatchObject({ code: 'invalid_response', retryable: false })
    const same = fakeShopify(() => gql({ products: { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'cursor-1' } } }))
    await expect(same.adapter.syncPage(connection(), 'products', { cursor: 'cursor-1', modifiedAfter: null, pages: 1 }, 'initial', captureLogger().log)).rejects.toMatchObject({ code: 'invalid_response' })
    // The last page may legitimately come without a cursor: the checkpoint keeps the previous one and the pass is done.
    const last = fakeShopify(() => gql({ customers: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } }))
    await expect(last.adapter.syncPage(connection(), 'customers', { cursor: 'cursor-1', modifiedAfter: null, pages: 1 }, 'initial', captureLogger().log)).resolves.toMatchObject({ done: true, checkpoint: { cursor: 'cursor-1', pages: 2 } })
  })

  it('does not mistake online wallets for cash on delivery and knows the Romanian labels', async () => {
    const variants = [
      { ...ORDER_NODE, paymentGatewayNames: ['Cash App Pay'] },
      { ...ORDER_NODE, id: 'gid://shopify/Order/2', legacyResourceId: '2', paymentGatewayNames: ['cashfree'] },
      { ...ORDER_NODE, id: 'gid://shopify/Order/3', legacyResourceId: '3', paymentGatewayNames: ['Plată la livrare'] },
      { ...ORDER_NODE, id: 'gid://shopify/Order/4', legacyResourceId: '4', paymentGatewayNames: ['shopify_payments', 'Cash on Delivery (COD)'] },
      { ...ORDER_NODE, id: 'gid://shopify/Order/5', legacyResourceId: '5', paymentGatewayNames: ['Cash'] },
    ]
    const { adapter } = fakeShopify(() => gql({ orders: { nodes: variants, pageInfo: { hasNextPage: false, endCursor: 'c' } } }))
    const { orders } = await adapter.syncPage(connection(), 'orders', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', captureLogger().log)
    expect(orders!.map((o) => [o.paymentMethod, o.paymentMethodTitle, o.metadata?.is_cod])).toEqual([
      ['Cash App Pay', 'Cash App Pay', false],
      ['cashfree', 'cashfree', false],
      ['cash_on_delivery', 'Plată la livrare', true],
      ['cash_on_delivery', 'Cash on Delivery (COD)', true],
      ['cash_on_delivery', 'Cash', true],
    ])
  })

  it('maps order statuses: cancelled, closed, paid/fulfilled, refunded, online gateways', async () => {
    const variants = [
      { ...ORDER_NODE, cancelledAt: '2026-10-12T00:00:00Z', displayFinancialStatus: 'VOIDED', displayFulfillmentStatus: 'RESTOCKED' },
      { ...ORDER_NODE, id: 'gid://shopify/Order/2', legacyResourceId: '2', closedAt: '2026-10-12T00:00:00Z', displayFinancialStatus: 'PAID', displayFulfillmentStatus: 'FULFILLED', paymentGatewayNames: ['shopify_payments'] },
      { ...ORDER_NODE, id: 'gid://shopify/Order/3', legacyResourceId: '3', displayFinancialStatus: 'PARTIALLY_REFUNDED', displayFulfillmentStatus: 'PARTIALLY_FULFILLED', paymentGatewayNames: ['cash_on_delivery'] },
      { ...ORDER_NODE, id: 'gid://shopify/Order/4', legacyResourceId: '4', displayFinancialStatus: 'EXPIRED', displayFulfillmentStatus: 'IN_PROGRESS', paymentGatewayNames: [] },
      { ...ORDER_NODE, id: 'gid://shopify/Order/5', legacyResourceId: '5', displayFinancialStatus: 'SOMETHING_NEW', displayFulfillmentStatus: 'FULFILLMENT_NOT_REQUIRED', paymentGatewayNames: ['Numerar la livrare'] },
    ]
    const { adapter } = fakeShopify(() => gql({ orders: { nodes: variants, pageInfo: { hasNextPage: false, endCursor: 'c' } } }))
    const { orders } = await adapter.syncPage(connection(), 'orders', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', captureLogger().log)
    expect(orders!.map((o) => [o.status, o.financialStatus, o.fulfillmentStatus, o.paymentMethod])).toEqual([
      ['cancelled', 'voided', 'cancelled', 'cash_on_delivery'],
      ['completed', 'paid', 'fulfilled', 'shopify_payments'],
      ['processing', 'partially_refunded', 'partial', 'cash_on_delivery'],
      ['processing', 'voided', 'unfulfilled', null],
      ['processing', 'unknown', 'fulfilled', 'cash_on_delivery'],
    ])
  })

  it('normalizes customers with the non-deprecated contact fields', async () => {
    const { adapter } = fakeShopify((op, variables) => {
      expect(op).toBe('ShopifyCustomersPage')
      expect(variables).toMatchObject({ first: 50 })
      return gql({
        customers: {
          nodes: [
            {
              id: 'gid://shopify/Customer/77',
              legacyResourceId: '77',
              firstName: 'Ion',
              lastName: 'Popescu',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-10-01T00:00:00Z',
              numberOfOrders: '3',
              defaultEmailAddress: { emailAddress: 'ion@example.ro', marketingState: 'SUBSCRIBED' },
              defaultPhoneNumber: { phoneNumber: '+40722000111', smsMarketingConsent: { state: 'NEVER_SUBSCRIBED' } },
              defaultAddress: { phone: '0722 000 111', countryCodeV2: 'RO' },
              amountSpent: { amount: '1234.50', currencyCode: 'RON' },
            },
            { id: 'gid://shopify/Customer/78', legacyResourceId: '78', firstName: null, lastName: null, defaultEmailAddress: null, defaultPhoneNumber: null, defaultAddress: { phone: '0733 1', countryCodeV2: 'MD' }, amountSpent: null, numberOfOrders: '0' },
          ],
          pageInfo: { hasNextPage: false, endCursor: 'c1' },
        },
      })
    })
    const batch = await adapter.syncPage(connection(), 'customers', { cursor: null, modifiedAfter: null, pages: 0 }, 'incremental', captureLogger().log)
    expect(batch.done).toBe(true)
    expect(batch.customers![0]).toMatchObject({ externalId: '77', email: 'ion@example.ro', firstName: 'Ion', lastName: 'Popescu', phoneRaw: '+40722000111', countryCode: 'RO', marketingConsent: true, callConsent: null, ordersCount: 3, totalSpent: 1234.5 })
    expect(batch.customers![1]).toMatchObject({ externalId: '78', email: null, phoneRaw: '0733 1', countryCode: 'MD', marketingConsent: null, ordersCount: 0, totalSpent: null })
  })

  it('normalizes products with stock derived from inventory tracking', async () => {
    const node = (id: string, extra: Record<string, unknown>) => ({
      id: `gid://shopify/Product/${id}`,
      legacyResourceId: id,
      title: `Produs ${id}`,
      handle: `produs-${id}`,
      status: 'ACTIVE',
      onlineStoreUrl: `https://www.magazinul-meu.ro/products/produs-${id}`,
      updatedAt: '2026-10-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      totalInventory: 5,
      tracksInventory: true,
      hasOnlyDefaultVariant: true,
      priceRangeV2: { minVariantPrice: { amount: '19.99', currencyCode: 'RON' } },
      variants: { nodes: [{ id: 'gid://shopify/ProductVariant/1', sku: `SKU-${id}`, price: '19.99', inventoryQuantity: 5, inventoryPolicy: 'DENY' }] },
      ...extra,
    })
    const { adapter } = fakeShopify(() =>
      gql({
        products: {
          nodes: [node('1', {}), node('2', { totalInventory: 0, status: 'DRAFT' }), node('3', { totalInventory: 0, status: 'ARCHIVED', variants: { nodes: [{ id: 'v', sku: null, price: '1', inventoryQuantity: 0, inventoryPolicy: 'CONTINUE' }] } }), node('4', { tracksInventory: false, totalInventory: 0, status: 'UNLISTED' })],
          pageInfo: { hasNextPage: false, endCursor: 'p' },
        },
      }),
    )
    const { products } = await adapter.syncPage(connection(), 'products', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', captureLogger().log)
    expect(products![0]).toMatchObject({ externalId: '1', sku: 'SKU-1', name: 'Produs 1', status: 'active', price: 19.99, currency: 'RON', stockStatus: 'in_stock', stockQuantity: 5, url: 'https://www.magazinul-meu.ro/products/produs-1' })
    expect(products!.map((p) => [p.status, p.stockStatus, p.stockQuantity])).toEqual([
      ['active', 'in_stock', 5],
      ['draft', 'out_of_stock', 0],
      ['archived', 'on_backorder', 0],
      ['active', 'in_stock', null],
    ])
  })

  it('reads abandoned checkouts newest-first and keys carts by the checkout token', async () => {
    const seen: Array<Record<string, unknown>> = []
    const { adapter } = fakeShopify((op, variables) => {
      expect(op).toBe('ShopifyCheckoutsPage')
      seen.push(variables)
      return gql({
        abandonedCheckouts: {
          nodes: [
            {
              id: 'gid://shopify/AbandonedCheckout/9001',
              name: '#9001',
              abandonedCheckoutUrl: `https://${SHOP}/12345/checkouts/0123456789abcdef0123456789abcdef/recover?key=x`,
              createdAt: '2026-10-11T10:00:00Z',
              updatedAt: '2026-10-11T10:15:00Z',
              completedAt: null,
              customer: { id: 'gid://shopify/Customer/77', firstName: 'Ion', lastName: 'Popescu', defaultPhoneNumber: { phoneNumber: '+40722000111' }, defaultEmailAddress: { emailAddress: 'ion@example.ro' } },
              shippingAddress: { name: null, firstName: 'Ion', lastName: 'Popescu', phone: '0722 123 456', city: 'Cluj-Napoca', countryCodeV2: 'RO' },
              billingAddress: null,
              totalPriceSet: { shopMoney: { amount: '120.00', currencyCode: 'RON' } },
              lineItems: { nodes: [{ id: 'gid://shopify/AbandonedCheckoutLineItem/1', title: 'Tricou', quantity: 2, sku: 'TRI-M' }] },
            },
            { id: 'gid://shopify/AbandonedCheckout/9002', name: '#9002', abandonedCheckoutUrl: 'https://x/checkouts/zz/recover', createdAt: '2026-10-10T10:00:00Z', updatedAt: '2026-10-10T10:00:00Z', completedAt: '2026-10-10T11:00:00Z', customer: null, shippingAddress: null, billingAddress: null, totalPriceSet: { shopMoney: { amount: '10.00', currencyCode: 'RON' } }, lineItems: { nodes: [] } },
          ],
          pageInfo: { hasNextPage: false, endCursor: 'k' },
        },
      })
    })
    const batch = await adapter.syncPage(connection(), 'carts', { cursor: null, modifiedAfter: '2026-10-01T00:00:00Z', pages: 0 }, 'incremental', captureLogger().log)
    expect(seen[0]).toMatchObject({ first: 30, after: null, query: "updated_at:>'2026-10-01T00:00:00Z'" })
    expect(batch.carts![0]).toMatchObject({
      externalId: '0123456789abcdef0123456789abcdef',
      customerExternalId: '77',
      contactName: 'Ion Popescu',
      contactPhoneRaw: '0722 123 456',
      contactEmail: 'ion@example.ro',
      status: 'abandoned',
      currency: 'RON',
      total: 120,
      items: [{ name: 'Tricou', quantity: 2 }],
      abandonedAt: '2026-10-11T10:15:00.000Z',
      providerUpdatedAt: '2026-10-11T10:15:00.000Z',
    })
    expect(batch.carts![1]).toMatchObject({ externalId: '9002', status: 'recovered', abandonedAt: null, contactPhoneRaw: null })
  })

  it('returns an empty, finished cart batch when the connection has no abandoned-cart access', async () => {
    const { adapter, fetchImpl } = fakeShopify(() => gql({}))
    const batch = await adapter.syncPage(connection({}, { abandoned_carts: false }), 'carts', { cursor: null, modifiedAfter: null, pages: 2 }, 'initial', captureLogger().log)
    expect(batch).toEqual({ resource: 'carts', carts: [], checkpoint: { cursor: null, modifiedAfter: null, pages: 3 }, done: true })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('surfaces throttling as a retryable rate limit and missing scopes as forbidden', async () => {
    const throttled = fakeShopify(() => jsonResponse({ errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }], extensions: { cost: { requestedQueryCost: 942, actualQueryCost: null, throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 10, restoreRate: 50 } } } }))
    await expect(throttled.adapter.syncPage(connection(), 'orders', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', captureLogger().log)).rejects.toMatchObject({ code: 'rate_limited', retryable: true })
    const denied = fakeShopify(() => jsonResponse({ data: { customers: null }, errors: [{ message: 'Access denied for customers field. Required access: `read_customers` access scope.', extensions: { code: 'ACCESS_DENIED' } }] }))
    await expect(denied.adapter.syncPage(connection(), 'customers', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', captureLogger().log)).rejects.toMatchObject({ code: 'forbidden', retryable: false })
  })
})

describe('fetchOrder / fetchCustomer / fetchProduct', () => {
  it('reads one record by numeric id or gid and returns null when it is gone', async () => {
    const ids: unknown[] = []
    const { adapter } = fakeShopify((op, variables) => {
      ids.push(variables.id)
      if (op === 'ShopifyOrder') return gql({ order: variables.id === 'gid://shopify/Order/5001' ? ORDER_NODE : null })
      if (op === 'ShopifyCustomer') return gql({ customer: null })
      if (op === 'ShopifyProduct') return gql({ product: null })
      throw new Error(op)
    })
    const log = captureLogger().log
    expect(await adapter.fetchOrder(connection(), '5001', log)).toMatchObject({ externalId: '5001', orderNumber: '#1042' })
    expect(await adapter.fetchOrder(connection(), 'gid://shopify/Order/6', log)).toBeNull()
    expect(await adapter.fetchOrder(connection(), 'not an id', log)).toBeNull()
    // A gid of another type never reaches Shopify (it would query the wrong object and surface as an error).
    expect(await adapter.fetchOrder(connection(), 'gid://shopify/Customer/77', log)).toBeNull()
    expect(await adapter.fetchProduct(connection(), 'gid://shopify/ProductVariant/400', log)).toBeNull()
    expect(await adapter.fetchCustomer(connection(), '77', log)).toBeNull()
    expect(await adapter.fetchProduct(connection(), '300', log)).toBeNull()
    expect(ids).toEqual(['gid://shopify/Order/5001', 'gid://shopify/Order/6', 'gid://shopify/Customer/77', 'gid://shopify/Product/300'])
  })
})

describe('registerWebhooks / unregisterWebhooks', () => {
  it('reuses subscriptions already pointing at our URL, creates the missing ones and removes stale ones', async () => {
    const created: unknown[] = []
    const deleted: unknown[] = []
    const { adapter } = fakeShopify((op, variables) => {
      if (op === 'ShopifyWebhookSubscriptions') {
        return gql({
          webhookSubscriptions: {
            nodes: [
              { id: 'gid://shopify/WebhookSubscription/1', topic: 'ORDERS_CREATE', uri: WEBHOOK_URL },
              { id: 'gid://shopify/WebhookSubscription/2', topic: 'ORDERS_CREATE', uri: 'https://other.example.com/hook' },
              { id: 'gid://shopify/WebhookSubscription/3', topic: 'CHECKOUTS_CREATE', uri: WEBHOOK_URL },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        })
      }
      if (op === 'ShopifyWebhookCreate') {
        created.push(variables)
        return gql({ webhookSubscriptionCreate: { webhookSubscription: { id: `gid://shopify/WebhookSubscription/new-${variables.topic}`, topic: variables.topic, uri: WEBHOOK_URL }, userErrors: [] } })
      }
      if (op === 'ShopifyWebhookDelete') {
        deleted.push(variables.id)
        return gql({ webhookSubscriptionDelete: { deletedWebhookSubscriptionId: variables.id, userErrors: [] } })
      }
      throw new Error(op)
    })
    const registrations = await adapter.registerWebhooks(connection({}, { abandoned_carts: false }), captureLogger().log)
    expect(registrations).toEqual([
      { topic: 'orders/create', externalId: 'gid://shopify/WebhookSubscription/1', source: 'api' },
      { topic: 'orders/updated', externalId: 'gid://shopify/WebhookSubscription/new-ORDERS_UPDATED', source: 'api' },
      { topic: 'orders/cancelled', externalId: 'gid://shopify/WebhookSubscription/new-ORDERS_CANCELLED', source: 'api' },
      { topic: 'products/update', externalId: 'gid://shopify/WebhookSubscription/new-PRODUCTS_UPDATE', source: 'api' },
      { topic: 'customers/update', externalId: 'gid://shopify/WebhookSubscription/new-CUSTOMERS_UPDATE', source: 'api' },
    ])
    expect(created.map((c) => (c as { topic: string }).topic)).toEqual(['ORDERS_UPDATED', 'ORDERS_CANCELLED', 'PRODUCTS_UPDATE', 'CUSTOMERS_UPDATE'])
    expect(created[0]).toEqual({ topic: 'ORDERS_UPDATED', webhookSubscription: { uri: WEBHOOK_URL } })
    expect(deleted).toEqual(['gid://shopify/WebhookSubscription/3'])
  })

  it('subscribes to checkouts topics only when abandoned carts are available, and needs a webhook URL and app config', async () => {
    const created: string[] = []
    const { adapter } = fakeShopify((op, variables) => {
      if (op === 'ShopifyWebhookSubscriptions') return gql({ webhookSubscriptions: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } })
      if (op === 'ShopifyWebhookCreate') {
        created.push(variables.topic as string)
        return gql({ webhookSubscriptionCreate: { webhookSubscription: { id: `gid://shopify/WebhookSubscription/${created.length}`, topic: variables.topic, uri: WEBHOOK_URL }, userErrors: [] } })
      }
      throw new Error(op)
    })
    const registrations = await adapter.registerWebhooks(connection(), captureLogger().log)
    expect(created).toEqual(['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED', 'PRODUCTS_UPDATE', 'CUSTOMERS_UPDATE', 'CHECKOUTS_CREATE', 'CHECKOUTS_UPDATE'])
    expect(registrations.map((r) => r.topic)).toContain('checkouts/update')
    await expect(adapter.registerWebhooks(connection({ webhookUrl: null }), captureLogger().log)).rejects.toMatchObject({ code: 'not_configured' })
    const unconfigured = createShopifyAdapter({ fetchImpl: vi.fn() as unknown as typeof fetch, lookup: publicLookup, appConfig: () => null })
    await expect(unconfigured.registerWebhooks(connection(), captureLogger().log)).rejects.toMatchObject({ code: 'not_configured' })
  })

  it('reports a refused subscription with a Romanian message and no secret', async () => {
    const { adapter } = fakeShopify((op) => {
      if (op === 'ShopifyWebhookSubscriptions') return gql({ webhookSubscriptions: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } })
      return gql({ webhookSubscriptionCreate: { webhookSubscription: null, userErrors: [{ field: ['topic'], message: 'Topic is not allowed for this app' }] } })
    })
    const { log, lines } = captureLogger()
    let thrown: unknown
    try {
      await adapter.registerWebhooks(connection(), log)
    } catch (err) {
      thrown = err
    }
    expect(thrown).toMatchObject({ code: 'invalid_response', publicMessage: expect.stringMatching(/webhook/) })
    expectNoSecret((thrown as Error).message, JSON.stringify(lines))
  })

  it('deletes our registrations and tolerates ones that are already gone', async () => {
    const deleted: unknown[] = []
    const { adapter } = fakeShopify((op, variables) => {
      expect(op).toBe('ShopifyWebhookDelete')
      deleted.push(variables.id)
      if (variables.id === 'gid://shopify/WebhookSubscription/gone') return gql({ webhookSubscriptionDelete: { deletedWebhookSubscriptionId: null, userErrors: [{ field: ['id'], message: 'Webhook subscription does not exist' }] } })
      return gql({ webhookSubscriptionDelete: { deletedWebhookSubscriptionId: variables.id, userErrors: [] } })
    })
    const conn = connection({
      webhookRegistrations: [
        { topic: 'orders/create', externalId: 'gid://shopify/WebhookSubscription/1', source: 'api' },
        { topic: 'orders/updated', externalId: 'gid://shopify/WebhookSubscription/gone', source: 'api' },
        { topic: 'orders/paid', externalId: 'manual-1', source: 'manual' },
      ],
    })
    await expect(adapter.unregisterWebhooks(conn, captureLogger().log)).resolves.toBeUndefined()
    expect(deleted).toEqual(['gid://shopify/WebhookSubscription/1', 'gid://shopify/WebhookSubscription/gone'])
    const gone = fakeShopify(() => new Response('<html>Not Found</html>', { status: 404, headers: { 'content-type': 'text/html' } }))
    await expect(gone.adapter.unregisterWebhooks(conn, captureLogger().log)).resolves.toBeUndefined()
    const revoked = fakeShopify(() => jsonResponse({ errors: 'Invalid token' }, 401))
    await expect(revoked.adapter.unregisterWebhooks(conn, captureLogger().log)).rejects.toMatchObject({ code: 'unauthorized' })
  })
})

const ORDER_PAYLOAD = {
  id: 5001,
  admin_graphql_api_id: 'gid://shopify/Order/5001',
  name: '#1042',
  order_number: 1042,
  email: 'ion@example.ro',
  phone: null,
  financial_status: 'pending',
  fulfillment_status: null,
  cancelled_at: null,
  closed_at: null,
  created_at: '2026-10-10T11:00:00+03:00',
  updated_at: '2026-10-10T11:05:00+03:00',
  currency: 'RON',
  total_price: '249.90',
  payment_gateway_names: ['Cash on Delivery (COD)'],
  customer: { id: 77, email: 'ion@example.ro', first_name: 'Ion', last_name: 'Popescu', phone: '+40722000111' },
  shipping_address: { first_name: 'Ion', last_name: 'Popescu', name: 'Ion Popescu', phone: '0722 123 456', address1: 'Str. Lalelelor 3', city: 'Cluj-Napoca', country_code: 'RO' },
  billing_address: { phone: '0733 999 888', country_code: 'RO' },
  line_items: [
    { id: 1, title: 'Tricou', name: 'Tricou - M', quantity: 2, sku: 'TRI-M', price: '99.95', product_id: 300, variant_id: 400, discount_allocations: [{ amount: '10.00' }] },
    { id: 2, title: 'Șapcă', name: 'Șapcă', quantity: 1, current_quantity: 0, sku: null, price: '50.00', product_id: null, variant_id: null },
  ],
}

function signedRequest(body: string | Uint8Array, headers: Record<string, string>, secret = CLIENT_SECRET): RawWebhookRequest {
  const rawBody = typeof body === 'string' ? new TextEncoder().encode(body) : body
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  return {
    headers: new Headers({ 'x-shopify-hmac-sha256': hmac, 'x-shopify-topic': 'orders/create', 'x-shopify-shop-domain': SHOP, 'x-shopify-webhook-id': 'wh-1', 'x-shopify-event-id': 'ev-1', 'x-shopify-api-version': SHOPIFY_API_VERSION, ...headers }),
    rawBody,
    url: new URL(WEBHOOK_URL),
  }
}

describe('verifyWebhook', () => {
  const { adapter } = fakeShopify(() => gql({}))

  it('accepts a delivery whose base64 HMAC matches the exact raw bytes', async () => {
    const body = JSON.stringify(ORDER_PAYLOAD)
    const result = await adapter.verifyWebhook(signedRequest(body, {}), connection())
    expect(result).toMatchObject({ ok: true, topic: 'orders/create', deliveryId: 'wh-1', externalResourceId: '5001' })
    expect((result as { payload: unknown }).payload).toEqual(ORDER_PAYLOAD)
  })

  it('rejects a signature computed over a different byte sequence of the same JSON', async () => {
    const compact = JSON.stringify(ORDER_PAYLOAD)
    const pretty = JSON.stringify(ORDER_PAYLOAD, null, 2)
    const signedForPretty = signedRequest(pretty, {})
    const swapped: RawWebhookRequest = { ...signedForPretty, rawBody: new TextEncoder().encode(compact) }
    expect(await adapter.verifyWebhook(swapped, connection())).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    // Same JSON value, same secret: only the byte sequence differs, so the raw bytes are what is signed.
    expect(await adapter.verifyWebhook(signedForPretty, connection())).toMatchObject({ ok: true })
    expect(await adapter.verifyWebhook(signedRequest(compact, {}, 'wrong-secret'), connection())).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    expect(await adapter.verifyWebhook(signedRequest(compact, { 'x-shopify-hmac-sha256': 'AAAA' }), connection())).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
  })

  it('rejects a missing signature, an unknown topic, another shop and a non-JSON body, never throwing', async () => {
    const body = JSON.stringify(ORDER_PAYLOAD)
    const missing = signedRequest(body, {})
    missing.headers.delete('x-shopify-hmac-sha256')
    expect(await adapter.verifyWebhook(missing, connection())).toEqual({ ok: false, reason: 'missing_signature', status: 401 })
    expect(await adapter.verifyWebhook(signedRequest(body, { 'x-shopify-topic': 'orders/paid' }), connection())).toEqual({ ok: false, reason: 'unknown_topic', status: 400 })
    expect(await adapter.verifyWebhook(signedRequest(body, { 'x-shopify-shop-domain': 'other.myshopify.com' }), connection())).toEqual({ ok: false, reason: 'malformed', status: 400 })
    expect(await adapter.verifyWebhook(signedRequest('not json', {}), connection())).toEqual({ ok: false, reason: 'malformed', status: 400 })
    expect(await adapter.verifyWebhook(signedRequest('[1,2]', {}), connection())).toEqual({ ok: false, reason: 'malformed', status: 400 })
    expect(await adapter.verifyWebhook(signedRequest(new Uint8Array([0xff, 0xfe, 0x7b]), {}), connection())).toEqual({ ok: false, reason: 'malformed', status: 400 })
  })

  it('falls back to the event id when the webhook id is missing and keys checkouts by token', async () => {
    const noWebhookId = signedRequest(JSON.stringify(ORDER_PAYLOAD), {})
    noWebhookId.headers.delete('x-shopify-webhook-id')
    expect(await adapter.verifyWebhook(noWebhookId, connection())).toMatchObject({ ok: true, deliveryId: 'ev-1' })
    const checkout = signedRequest(JSON.stringify({ token: 'ABCDEF0123456789abcdef0123456789', abandoned_checkout_url: 'https://x/1/checkouts/abcdef0123456789abcdef0123456789/recover' }), { 'x-shopify-topic': 'checkouts/update' })
    expect(await adapter.verifyWebhook(checkout, connection())).toMatchObject({ ok: true, topic: 'checkouts/update', externalResourceId: 'abcdef0123456789abcdef0123456789' })
  })

  it('cannot verify without the app configuration', async () => {
    const unconfigured = createShopifyAdapter({ fetchImpl: vi.fn() as unknown as typeof fetch, lookup: publicLookup, appConfig: () => null })
    expect(await unconfigured.verifyWebhook(signedRequest(JSON.stringify(ORDER_PAYLOAD), {}), connection())).toEqual({ ok: false, reason: 'not_supported', status: 400 })
  })
})

describe('normalizeEvent', () => {
  const { adapter } = fakeShopify(() => gql({}))
  const verified = (topic: string, payload: unknown) => ({ ok: true as const, topic, deliveryId: 'wh', externalResourceId: null, payload })

  it('maps order topics to created/updated/deleted events with the normalized order', () => {
    const [created] = adapter.normalizeEvent(verified('orders/create', ORDER_PAYLOAD), connection())
    expect(created.kind).toBe('order.created')
    if (created.kind !== 'order.created') throw new Error('kind')
    expect(created.order).toMatchObject({
      externalId: '5001',
      orderNumber: '#1042',
      customerExternalId: '77',
      contactName: 'Ion Popescu',
      contactPhoneRaw: '0722 123 456',
      contactEmail: 'ion@example.ro',
      shippingCountry: 'RO',
      status: 'processing',
      financialStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      paymentMethod: 'cash_on_delivery',
      paymentMethodTitle: 'Cash on Delivery (COD)',
      currency: 'RON',
      total: 249.9,
      providerCreatedAt: '2026-10-10T08:00:00.000Z',
      providerUpdatedAt: '2026-10-10T08:05:00.000Z',
    })
    expect(created.order.items).toEqual([{ externalId: '1', productExternalId: '300', sku: 'TRI-M', name: 'Tricou - M', quantity: 2, unitPrice: 99.95, total: 189.9 }])
    expect(created.order.payloadHash).toMatch(/^[0-9a-f]{64}$/)
    expect(adapter.normalizeEvent(verified('orders/updated', { ...ORDER_PAYLOAD, financial_status: 'paid', fulfillment_status: 'fulfilled', closed_at: '2026-10-12T00:00:00Z' }), connection())[0]).toMatchObject({ kind: 'order.updated', order: { status: 'completed', financialStatus: 'paid', fulfillmentStatus: 'fulfilled' } })
    expect(adapter.normalizeEvent(verified('orders/cancelled', { ...ORDER_PAYLOAD, cancelled_at: '2026-10-12T00:00:00Z', financial_status: 'voided', fulfillment_status: 'restocked' }), connection())[0]).toMatchObject({ kind: 'order.updated', order: { status: 'cancelled', financialStatus: 'voided', fulfillmentStatus: 'cancelled' } })
    expect(adapter.normalizeEvent(verified('orders/delete', { id: 5001 }), connection())).toEqual([{ kind: 'order.deleted', externalId: '5001' }])
  })

  it('keeps the same payload hash for the same record regardless of key order', () => {
    const a = adapter.normalizeEvent(verified('orders/create', ORDER_PAYLOAD), connection())[0]
    const reordered = Object.fromEntries(Object.entries(ORDER_PAYLOAD).reverse())
    const b = adapter.normalizeEvent(verified('orders/create', reordered), connection())[0]
    if (a.kind !== 'order.created' || b.kind !== 'order.created') throw new Error('kind')
    expect(a.order.payloadHash).toBe(b.order.payloadHash)
    const c = adapter.normalizeEvent(verified('orders/create', { ...ORDER_PAYLOAD, total_price: '1.00' }), connection())[0]
    if (c.kind !== 'order.created') throw new Error('kind')
    expect(c.order.payloadHash).not.toBe(a.order.payloadHash)
  })

  it('maps customers, products and checkouts, and ignores what it cannot mirror', () => {
    const [customer] = adapter.normalizeEvent(
      verified('customers/update', { id: 77, admin_graphql_api_id: 'gid://shopify/Customer/77', email: 'ion@example.ro', first_name: 'Ion', last_name: 'Popescu', phone: null, default_address: { country_code: 'RO', phone: '0722 123 456' }, orders_count: 2, total_spent: '300.00', currency: 'RON', email_marketing_consent: { state: 'subscribed' }, sms_marketing_consent: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', state: 'enabled' }),
      connection(),
    )
    expect(customer).toMatchObject({ kind: 'customer.updated', customer: { externalId: '77', phoneRaw: '0722 123 456', countryCode: 'RO', marketingConsent: true, ordersCount: 2, totalSpent: 300 } })

    const [product] = adapter.normalizeEvent(
      verified('products/update', { id: 300, admin_graphql_api_id: 'gid://shopify/Product/300', title: 'Tricou', handle: 'tricou', status: 'active', updated_at: '2026-10-01T00:00:00Z', variants: [{ id: 400, sku: 'TRI-M', price: '99.95', inventory_quantity: 0, inventory_policy: 'continue' }, { id: 401, sku: 'TRI-L', price: '89.95', inventory_quantity: 0, inventory_policy: 'deny' }] }),
      connection(),
    )
    expect(product).toMatchObject({ kind: 'product.updated', product: { externalId: '300', sku: 'TRI-M', name: 'Tricou', status: 'active', price: 89.95, stockStatus: 'on_backorder', stockQuantity: 0, url: `https://${SHOP}/products/tricou` } })
    expect(adapter.normalizeEvent(verified('products/delete', { id: 300 }), connection())).toEqual([{ kind: 'product.deleted', externalId: '300' }])

    const [cart] = adapter.normalizeEvent(
      verified('checkouts/create', {
        token: 'abcdef0123456789abcdef0123456789',
        abandoned_checkout_url: `https://${SHOP}/1/checkouts/abcdef0123456789abcdef0123456789/recover`,
        completed_at: null,
        created_at: '2026-10-11T10:00:00Z',
        updated_at: '2026-10-11T10:20:00Z',
        email: 'ion@example.ro',
        phone: null,
        total_price: '120.00',
        currency: 'RON',
        name: '#9001',
        customer: { id: 77, phone: '+40722000111', email: 'ion@example.ro', first_name: 'Ion', last_name: 'Popescu' },
        shipping_address: { phone: '0722 123 456', country_code: 'RO', first_name: 'Ion', last_name: 'Popescu' },
        billing_address: null,
        line_items: [{ title: 'Tricou', quantity: 2, price: '60.00', sku: 'TRI-M', product_id: 300, variant_id: 400 }],
      }),
      connection(),
    )
    expect(cart).toMatchObject({
      kind: 'cart.updated',
      cart: { externalId: 'abcdef0123456789abcdef0123456789', customerExternalId: '77', contactName: 'Ion Popescu', contactPhoneRaw: '0722 123 456', contactEmail: 'ion@example.ro', status: 'abandoned', currency: 'RON', total: 120, items: [{ name: 'Tricou', quantity: 2 }], abandonedAt: '2026-10-11T10:20:00.000Z' },
    })
    expect(adapter.normalizeEvent(verified('checkouts/update', { token: 'abcdef0123456789abcdef0123456789', completed_at: '2026-10-11T11:00:00Z', abandoned_checkout_url: 'https://x/1/checkouts/abcdef0123456789abcdef0123456789/recover' }), connection())[0]).toMatchObject({ kind: 'cart.updated', cart: { status: 'recovered', abandonedAt: null } })
    expect(adapter.normalizeEvent(verified('checkouts/delete', { token: 'x' }), connection())[0].kind).toBe('ignored')
    expect(adapter.normalizeEvent(verified('orders/create', { name: 'no id' }), connection())[0].kind).toBe('ignored')
    expect(adapter.normalizeEvent(verified('orders/create', 'junk'), connection())[0].kind).toBe('ignored')
    expect(adapter.normalizeEvent(verified('shop/update', {}), connection())[0].kind).toBe('ignored')
  })
})
