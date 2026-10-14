import crypto from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { Logger } from '@/lib/observability/logger'
import type { CommerceCapabilities } from '../types'
import { ConnectionError, type AdapterConnection, type VerifiedCommerceEvent } from './types'
import {
  CART_TOPIC,
  NOTE_NO_CART_SOURCE,
  NOTE_NO_STORE_INFO,
  NOTE_NO_WEBHOOK_PERMISSION,
  NOTE_READ_ONLY_KEY,
  WOOCOMMERCE_API_VERSION,
  WooCommerceSecretsSchema,
  canonicalStoreUrl,
  createWooCommerceAdapter,
  normalizeWooOrder,
  wooCommerceAdapter,
} from './woocommerce'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CK = 'ck_0123456789abcdef0123456789abcdef01234567'
const CS = 'cs_fedcba9876543210fedcba9876543210fedcba98'
const WEBHOOK_SECRET = 'whsec-test-secret-value-0123456789'
const SECRET_VALUES = [CK, CS, WEBHOOK_SECRET]
const STORE = 'https://shop.example.ro'
const WEBHOOK_URL = 'https://app.example.com/api/commerce/webhooks/conn-1/abc'
const publicLookup = async () => ['93.184.216.34']

function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

type Handler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>

/** A fetch whose routes are keyed by "METHOD /path" (query string ignored); unknown routes answer like a bare WordPress (rest_no_route). */
function storeFetch(routes: Record<string, Handler>) {
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = (init?.method ?? 'GET').toUpperCase()
    const handler = routes[`${method} ${url.pathname}`]
    if (!handler) return jsonRes({ code: 'rest_no_route', message: 'No route was found matching the URL and request method.', data: { status: 404 } }, 404)
    return handler(url, init)
  })
  return fetchImpl
}

function fakeLogger() {
  const calls: unknown[] = []
  const log: Logger = {
    context: {},
    debug: (event, fields) => calls.push({ level: 'debug', event, fields }),
    info: (event, fields) => calls.push({ level: 'info', event, fields }),
    warn: (event, fields) => calls.push({ level: 'warn', event, fields }),
    error: (event, err, fields) => calls.push({ level: 'error', event, err: err instanceof Error ? err.message : err, fields }),
    child: () => log,
  }
  return { log, calls }
}

const healthyRoutes: Record<string, Handler> = {
  'GET /wp-json/wc/v3/system_status': () =>
    jsonRes({ environment: { home_url: STORE, site_url: STORE, version: '9.9.0', wp_version: '6.8', language: 'ro_RO', default_timezone: 'UTC' }, settings: { currency: 'RON', api_enabled: true } }),
  'GET /wp-json/wc/v3/settings/general/woocommerce_default_country': () => jsonRes({ id: 'woocommerce_default_country', value: 'RO:B', type: 'select', group_id: 'general' }),
  'GET /wp-json/': () => jsonRes({ name: 'Magazinul Meu', description: '', url: STORE, home: STORE, gmt_offset: 2, timezone_string: 'Europe/Bucharest', namespaces: ['wp/v2', 'wc/v3'] }),
  'POST /wp-json/wc/v3/webhooks': () => jsonRes({ code: 'rest_missing_callback_param', message: 'Missing parameter(s): topic, delivery_url', data: { status: 400, params: ['topic', 'delivery_url'] } }, 400),
}

const ORDER_42 = {
  id: 42,
  number: '1042',
  status: 'on-hold',
  currency: 'RON',
  date_created: '2026-03-01T12:20:30',
  date_created_gmt: '2026-03-01T10:20:30',
  date_modified_gmt: '2026-03-02T08:00:00',
  date_paid_gmt: null,
  customer_id: 7,
  payment_method: 'cod',
  payment_method_title: 'Plata ramburs',
  total: '159.90',
  created_via: 'checkout',
  billing: { first_name: 'Ana', last_name: 'Pop', address_1: 'Str. Lungă 1', city: 'Cluj-Napoca', country: 'RO', email: 'ana@example.com', phone: '0722 123 456' },
  shipping: { first_name: 'Ana', last_name: 'Pop', address_1: 'Str. Scurtă 2', address_2: 'ap. 3', city: 'Cluj-Napoca', country: 'RO' },
  line_items: [
    { id: 1, name: 'Cană', product_id: 11, variation_id: 0, quantity: 2, sku: 'CANA-01', price: 49.95, total: '99.90' },
    { id: 2, name: 'Tricou', product_id: 12, variation_id: 120, quantity: 1, sku: 'TR-M', price: 60, total: '60.00' },
  ],
  _links: { self: [{ href: `${STORE}/wp-json/wc/v3/orders/42` }] },
}

function connection(overrides: Partial<AdapterConnection> = {}): AdapterConnection {
  const capabilities: CommerceCapabilities = { products: true, customers: true, orders: true, webhooks: true, abandoned_carts: false, customer_phone: true, polling_minutes: null, notes: [NOTE_NO_CART_SOURCE] }
  return {
    id: 'conn-1',
    orgId: 'org-1',
    platform: 'woocommerce',
    storeUrl: STORE,
    storeDomain: 'shop.example.ro',
    secrets: { consumer_key: CK, consumer_secret: CS, webhook_secret: WEBHOOK_SECRET },
    capabilities,
    webhookRegistrations: [],
    webhookUrl: WEBHOOK_URL,
    ...overrides,
  }
}

function sign(body: Uint8Array | string, secret = WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64')
}

function rawRequest(body: string, headers: Record<string, string>) {
  return { headers: new Headers(headers), rawBody: new TextEncoder().encode(body), url: new URL(WEBHOOK_URL) }
}

function adapterWith(routes: Record<string, Handler>) {
  const fetchImpl = storeFetch(routes)
  const adapter = createWooCommerceAdapter({ fetchImpl, lookup: publicLookup, randomSecret: () => WEBHOOK_SECRET })
  return { adapter, fetchImpl }
}

async function failure(promise: Promise<unknown>): Promise<ConnectionError> {
  try {
    await promise
  } catch (err) {
    if (err instanceof ConnectionError) return err
    throw err
  }
  throw new Error('expected a ConnectionError')
}

function expectNoSecret(value: unknown) {
  const text = JSON.stringify(value) ?? String(value)
  for (const secret of SECRET_VALUES) expect(text).not.toContain(secret)
  expect(text).not.toContain(Buffer.from(`${CK}:${CS}`).toString('base64'))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WooCommerceSecretsSchema', () => {
  it('accepts the documented key shapes and trims them', () => {
    const parsed = WooCommerceSecretsSchema.parse({ consumer_key: ` ${CK} `, consumer_secret: CS })
    expect(parsed).toEqual({ consumer_key: CK, consumer_secret: CS })
  })
  it('rejects keys without the ck_/cs_ prefixes', () => {
    expect(WooCommerceSecretsSchema.safeParse({ consumer_key: 'abc', consumer_secret: CS }).success).toBe(false)
    expect(WooCommerceSecretsSchema.safeParse({ consumer_key: CK, consumer_secret: 'ck_wrongprefix0000' }).success).toBe(false)
  })
  it('pins the REST API namespace', () => {
    expect(WOOCOMMERCE_API_VERSION).toBe('wc/v3')
    expect(wooCommerceAdapter.platform).toBe('woocommerce')
  })
})

describe('canonicalStoreUrl', () => {
  it('lower-cases the host, strips a pasted API root, the query and trailing slashes, keeps a sub-directory', () => {
    expect(canonicalStoreUrl('https://Shop.Example.RO/wp-json/wc/v3/?x=1')).toEqual({ storeUrl: 'https://shop.example.ro', storeDomain: 'shop.example.ro' })
    expect(canonicalStoreUrl('https://shop.example.ro/magazin/').storeUrl).toBe('https://shop.example.ro/magazin')
    expect(canonicalStoreUrl('shop.example.ro').storeUrl).toBe('https://shop.example.ro')
  })
  it('refuses http and embedded credentials', () => {
    expect(() => canonicalStoreUrl('http://shop.example.ro')).toThrow(ConnectionError)
    expect(() => canonicalStoreUrl('https://u:p@shop.example.ro')).toThrow(/credentials/)
    expect(() => canonicalStoreUrl('')).toThrow(ConnectionError)
  })
})

describe('validateConnection', () => {
  it('proves access with system_status, reads store facts and probes write access without creating anything', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes)
    const { log, calls } = fakeLogger()
    const store = await adapter.validateConnection({ storeUrl: 'https://Shop.Example.RO/wp-json/', secrets: { consumer_key: CK, consumer_secret: CS } }, log)
    expect(store).toMatchObject({
      storeUrl: STORE,
      storeDomain: 'shop.example.ro',
      displayName: 'Magazinul Meu',
      currency: 'RON',
      countryCode: 'RO',
      timezone: 'Europe/Bucharest',
      language: 'ro-RO',
      platformVersion: '9.9.0',
    })
    expect(store.capabilities).toEqual({ products: true, customers: true, orders: true, webhooks: true, abandoned_carts: false, customer_phone: true, polling_minutes: null, notes: [NOTE_NO_CART_SOURCE] })
    expect(store.secrets).toEqual({ consumer_key: CK, consumer_secret: CS, webhook_secret: WEBHOOK_SECRET })

    const first = fetchImpl.mock.calls[0]
    expect(String(first[0])).toBe(`${STORE}/wp-json/wc/v3/system_status`)
    const headers = new Headers(first[1]?.headers)
    expect(headers.get('authorization')).toBe(`Basic ${Buffer.from(`${CK}:${CS}`).toString('base64')}`)
    expect(first[1]).toMatchObject({ redirect: 'manual' })
    // The write probe is an empty POST: it can only produce a 400 (write key) or a 401 (read key).
    const probe = fetchImpl.mock.calls.find((c) => (c[1]?.method ?? 'GET') === 'POST')!
    expect(String(probe[0])).toBe(`${STORE}/wp-json/wc/v3/webhooks`)
    expect(probe[1]?.body).toBe('{}')
    // No request ever carries the keys in its URL.
    for (const call of fetchImpl.mock.calls) expectNoSecret(String(call[0]))
    expectNoSecret(calls)
    expect(store.storeUrl.endsWith('/')).toBe(false)
  })

  it('keeps an existing webhook secret and reports a read-only key as polling', async () => {
    const { adapter } = adapterWith({ ...healthyRoutes, 'POST /wp-json/wc/v3/webhooks': () => jsonRes({ code: 'woocommerce_rest_authentication_error', message: 'The API key provided does not have write permissions.', data: { status: 401 } }, 401) })
    const store = await adapter.validateConnection({ storeUrl: STORE, secrets: { consumer_key: CK, consumer_secret: CS, webhook_secret: 'keep-this-secret-please-0001' } }, fakeLogger().log)
    expect(store.capabilities.webhooks).toBe(false)
    expect(store.capabilities.polling_minutes).toBe(15)
    expect(store.capabilities.notes).toContain(NOTE_READ_ONLY_KEY)
    expect(store.secrets.webhook_secret).toBe('keep-this-secret-please-0001')
  })

  it('tells a write key whose user cannot manage webhooks (403 on the probe) apart from a read-only key', async () => {
    const { adapter } = adapterWith({ ...healthyRoutes, 'POST /wp-json/wc/v3/webhooks': () => jsonRes({ code: 'woocommerce_rest_cannot_create', message: 'Sorry, you are not allowed to create resources.', data: { status: 403 } }, 403) })
    const store = await adapter.validateConnection({ storeUrl: STORE, secrets: { consumer_key: CK, consumer_secret: CS } }, fakeLogger().log)
    expect(store.capabilities.webhooks).toBe(false)
    expect(store.capabilities.polling_minutes).toBe(15)
    expect(store.capabilities.notes).toContain(NOTE_NO_WEBHOOK_PERMISSION)
    expect(store.capabilities.notes).not.toContain(NOTE_READ_ONLY_KEY)
  })

  it('explains a 401 without an authentication error (key unknown or Authorization header dropped by the host)', async () => {
    const { adapter } = adapterWith({ 'GET /wp-json/wc/v3/system_status': () => jsonRes({ code: 'woocommerce_rest_cannot_view', message: 'Sorry, you cannot list resources.', data: { status: 401 } }, 401) })
    const err = await failure(adapter.validateConnection({ storeUrl: STORE, secrets: { consumer_key: CK, consumer_secret: CS } }, fakeLogger().log))
    expect(err.code).toBe('unauthorized')
    expect(err.retryable).toBe(false)
    expect(err.publicMessage).toMatch(/Authorization/)
    expect(err.message).toBe('woocommerce system_status: HTTP 401 (woocommerce_rest_cannot_view)')
    expectNoSecret({ message: err.message, publicMessage: err.publicMessage })
  })

  it('falls back to the orders endpoint when system_status is forbidden', async () => {
    const { adapter } = adapterWith({
      ...healthyRoutes,
      'GET /wp-json/wc/v3/system_status': () => jsonRes({ code: 'woocommerce_rest_cannot_view', message: 'Sorry, you cannot list resources.', data: { status: 403 } }, 403),
      'GET /wp-json/wc/v3/orders': () => jsonRes([ORDER_42], 200, { 'x-wp-total': '1', 'x-wp-totalpages': '1' }),
      'GET /wp-json/wc/v3/products': () => jsonRes([]),
      'GET /wp-json/wc/v3/customers': () => jsonRes({ code: 'woocommerce_rest_cannot_view', message: 'no', data: { status: 403 } }, 403),
    })
    const store = await adapter.validateConnection({ storeUrl: STORE, secrets: { consumer_key: CK, consumer_secret: CS } }, fakeLogger().log)
    expect(store.currency).toBeNull()
    expect(store.capabilities).toMatchObject({ orders: true, products: true, customers: false })
    expect(store.capabilities.notes).toContain(NOTE_NO_STORE_INFO)
  })

  it('maps 401 to unauthorized without leaking the keys anywhere', async () => {
    const { adapter } = adapterWith({ 'GET /wp-json/wc/v3/system_status': () => jsonRes({ code: 'woocommerce_rest_authentication_error', message: `Consumer secret is invalid. ${CS}`, data: { status: 401 } }, 401) })
    const { log, calls } = fakeLogger()
    const err = await failure(adapter.validateConnection({ storeUrl: STORE, secrets: { consumer_key: CK, consumer_secret: CS } }, log))
    expect(err.code).toBe('unauthorized')
    expect(err.retryable).toBe(false)
    expect(err.publicMessage).toMatch(/Consumer key/)
    expect(err.message).toBe('woocommerce system_status: HTTP 401 (woocommerce_rest_authentication_error)')
    expectNoSecret({ message: err.message, publicMessage: err.publicMessage, stack: err.stack })
    expectNoSecret(calls)
  })

  it('maps 403 on the fallback to forbidden, 404 and HTML to not_a_store, 429 to rate_limited, 5xx to unreachable', async () => {
    const forbidden = adapterWith({
      'GET /wp-json/wc/v3/system_status': () => jsonRes({ code: 'woocommerce_rest_cannot_view', data: { status: 403 } }, 403),
      'GET /wp-json/wc/v3/orders': () => jsonRes({ code: 'woocommerce_rest_cannot_view', data: { status: 403 } }, 403),
      'GET /wp-json/wc/v3/products': () => jsonRes([]),
      'GET /wp-json/wc/v3/customers': () => jsonRes([]),
    })
    expect((await failure(forbidden.adapter.validateConnection({ storeUrl: STORE, secrets: { consumer_key: CK, consumer_secret: CS } }, fakeLogger().log))).code).toBe('forbidden')

    const bareWordPress = adapterWith({})
    const notStore = await failure(bareWordPress.adapter.validateConnection({ storeUrl: STORE, secrets: { consumer_key: CK, consumer_secret: CS } }, fakeLogger().log))
    expect(notStore.code).toBe('not_a_store')
    expect(notStore.message).toContain('rest_no_route')

    const html = adapterWith({ 'GET /wp-json/wc/v3/system_status': () => new Response('<!DOCTYPE html><html><body>Login</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }) })
    expect((await failure(html.adapter.validateConnection({ storeUrl: STORE, secrets: { consumer_key: CK, consumer_secret: CS } }, fakeLogger().log))).code).toBe('not_a_store')

    const limited = adapterWith({ 'GET /wp-json/wc/v3/system_status': () => jsonRes({ code: 'too_many', data: { status: 429 } }, 429) })
    const rate = await failure(limited.adapter.validateConnection({ storeUrl: STORE, secrets: { consumer_key: CK, consumer_secret: CS } }, fakeLogger().log))
    expect(rate.code).toBe('rate_limited')
    expect(rate.retryable).toBe(true)

    const down = adapterWith({ 'GET /wp-json/wc/v3/system_status': () => new Response('Bad gateway', { status: 502 }) })
    expect((await failure(down.adapter.validateConnection({ storeUrl: STORE, secrets: { consumer_key: CK, consumer_secret: CS } }, fakeLogger().log))).code).toBe('unreachable')
  })

  it('maps timeouts, redirects, network failures, http and private hosts', async () => {
    const input = { storeUrl: STORE, secrets: { consumer_key: CK, consumer_secret: CS } }
    const timeout = createWooCommerceAdapter({ fetchImpl: vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError') }) as unknown as typeof fetch, lookup: publicLookup })
    const t = await failure(timeout.validateConnection(input, fakeLogger().log))
    expect(t.code).toBe('timeout')
    expect(t.retryable).toBe(true)

    const redirect = createWooCommerceAdapter({ fetchImpl: vi.fn(async () => new Response(null, { status: 301, headers: { location: 'https://www.shop.example.ro/' } })) as unknown as typeof fetch, lookup: publicLookup })
    expect((await failure(redirect.validateConnection(input, fakeLogger().log))).code).toBe('redirect')

    const network = createWooCommerceAdapter({ fetchImpl: vi.fn(async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch, lookup: publicLookup })
    expect((await failure(network.validateConnection(input, fakeLogger().log))).code).toBe('unreachable')

    const { adapter, fetchImpl } = adapterWith(healthyRoutes)
    expect((await failure(adapter.validateConnection({ ...input, storeUrl: 'http://shop.example.ro' }, fakeLogger().log))).code).toBe('invalid_url')
    expect(fetchImpl).not.toHaveBeenCalled()

    const privateHost = createWooCommerceAdapter({ fetchImpl, lookup: async () => ['10.0.0.8'] })
    expect((await failure(privateHost.validateConnection(input, fakeLogger().log))).code).toBe('ssrf_blocked')
    expect((await failure(privateHost.validateConnection({ ...input, storeUrl: 'https://169.254.169.254/' }, fakeLogger().log))).code).toBe('ssrf_blocked')
    expect(fetchImpl).not.toHaveBeenCalled()

    const unresolved = createWooCommerceAdapter({ fetchImpl, lookup: async () => [] })
    expect((await failure(unresolved.validateConnection(input, fakeLogger().log))).code).toBe('unreachable')
  })

  it('rejects malformed keys before any request', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes)
    const err = await failure(adapter.validateConnection({ storeUrl: STORE, secrets: { consumer_key: 'nope', consumer_secret: CS } }, fakeLogger().log))
    expect(err.code).toBe('unauthorized')
    expectNoSecret({ message: err.message, publicMessage: err.publicMessage })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('getCapabilities', () => {
  it('turns abandoned carts on only with a manual ntv.cart.updated registration', () => {
    const base = connection()
    const without = wooCommerceAdapter.getCapabilities(base)
    expect(without.abandoned_carts).toBe(false)
    expect(without.notes).toEqual([NOTE_NO_CART_SOURCE])
    const withPlugin = wooCommerceAdapter.getCapabilities({ ...base, webhookRegistrations: [{ topic: CART_TOPIC, externalId: '77', source: 'manual' }] })
    expect(withPlugin.abandoned_carts).toBe(true)
    expect(withPlugin.notes).toEqual([])
    const apiOnly = wooCommerceAdapter.getCapabilities({ ...base, webhookRegistrations: [{ topic: CART_TOPIC, externalId: '77', source: 'api' }] })
    expect(apiOnly.abandoned_carts).toBe(false)
  })
})

describe('syncPage', () => {
  it('reads one page of orders, normalizes them and advances the page cursor until X-WP-TotalPages', async () => {
    const seen: URL[] = []
    const { adapter } = adapterWith({
      'GET /wp-json/wc/v3/orders': (url) => {
        seen.push(url)
        const page = url.searchParams.get('page')
        return page === '1' ? jsonRes(Array.from({ length: 50 }, (_, i) => ({ ...ORDER_42, id: 100 + i })), 200, { 'x-wp-totalpages': '2' }) : jsonRes([ORDER_42, { no_id: true }], 200, { 'x-wp-totalpages': '2' })
      },
    })
    const { log, calls } = fakeLogger()
    const first = await adapter.syncPage(connection(), 'orders', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', log)
    expect(seen[0].searchParams.get('per_page')).toBe('50')
    expect(seen[0].searchParams.get('orderby')).toBe('id')
    expect(seen[0].searchParams.get('order')).toBe('asc')
    expect(seen[0].searchParams.get('status')).toBe('any')
    expect(seen[0].searchParams.has('modified_after')).toBe(false)
    expect(first.done).toBe(false)
    expect(first.checkpoint).toEqual({ cursor: '2', modifiedAfter: null, pages: 1 })
    expect(first.orders).toHaveLength(50)

    const second = await adapter.syncPage(connection(), 'orders', first.checkpoint, 'initial', log)
    expect(seen[1].searchParams.get('page')).toBe('2')
    expect(second.done).toBe(true)
    expect(second.checkpoint).toEqual({ cursor: null, modifiedAfter: null, pages: 2 })
    expect(second.orders).toHaveLength(1)
    const order = second.orders![0]
    expect(order).toMatchObject({
      externalId: '42',
      orderNumber: '1042',
      customerExternalId: '7',
      contactName: 'Ana Pop',
      contactPhoneRaw: '0722 123 456',
      contactEmail: 'ana@example.com',
      shippingCity: 'Cluj-Napoca',
      shippingCountry: 'RO',
      shippingSummary: 'Str. Scurtă 2, ap. 3, Cluj-Napoca',
      status: 'on_hold',
      financialStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      paymentMethod: 'cod',
      paymentMethodTitle: 'Plata ramburs',
      currency: 'RON',
      total: 159.9,
      providerCreatedAt: '2026-03-01T10:20:30.000Z',
      providerUpdatedAt: '2026-03-02T08:00:00.000Z',
    })
    expect(order.items).toEqual([
      { externalId: '1', productExternalId: '11', sku: 'CANA-01', name: 'Cană', quantity: 2, unitPrice: 49.95, total: 99.9 },
      { externalId: '2', productExternalId: '12', sku: 'TR-M', name: 'Tricou', quantity: 1, unitPrice: 60, total: 60 },
    ])
    expect(order.payloadHash).toMatch(/^[0-9a-f]{64}$/)
    // The hash ignores HAL links and key order, and changes with the content.
    const { _links: _ignored, ...bare } = ORDER_42
    expect(normalizeWooOrder({ ...bare, total: bare.total })?.payloadHash).toBe(order.payloadHash)
    expect(normalizeWooOrder({ ...bare, status: 'completed' })?.payloadHash).not.toBe(order.payloadHash)
    expectNoSecret(calls)
  })

  it('maps order statuses to order, financial and fulfilment states', () => {
    const paid = normalizeWooOrder({ ...ORDER_42, status: 'completed', date_paid_gmt: '2026-03-01T11:00:00' })!
    expect([paid.status, paid.financialStatus, paid.fulfillmentStatus]).toEqual(['completed', 'paid', 'fulfilled'])
    const refunded = normalizeWooOrder({ ...ORDER_42, status: 'refunded', date_paid_gmt: '2026-03-01T11:00:00' })!
    expect([refunded.status, refunded.financialStatus, refunded.fulfillmentStatus]).toEqual(['refunded', 'refunded', 'unfulfilled'])
    expect(normalizeWooOrder({ ...ORDER_42, status: 'checkout-draft' })?.status).toBe('draft')
    expect(normalizeWooOrder({ ...ORDER_42, status: 'wc-custom' })?.status).toBe('unknown')
    expect(normalizeWooOrder({ ...ORDER_42, customer_id: 0, billing: { phone: '' }, shipping: { phone: '+40 733 000 111', country: 'ro' } })).toMatchObject({ customerExternalId: null, contactPhoneRaw: '+40 733 000 111', shippingCountry: 'RO' })
    expect(normalizeWooOrder({ number: '1' })).toBeNull()
  })

  it('does not take date_paid as a payment for cash on delivery until the order is completed', () => {
    // WC_Order::maybe_set_date_paid() stamps date_paid when the COD gateway moves the order to processing at checkout.
    const codProcessing = normalizeWooOrder({ ...ORDER_42, status: 'processing', date_paid_gmt: '2026-03-01T10:20:31' })!
    expect([codProcessing.paymentMethod, codProcessing.status, codProcessing.financialStatus, codProcessing.fulfillmentStatus]).toEqual(['cod', 'processing', 'pending', 'unfulfilled'])
    expect(codProcessing.metadata?.date_paid).toBe('2026-03-01T10:20:31.000Z')
    expect(normalizeWooOrder({ ...ORDER_42, status: 'on-hold', date_paid_gmt: '2026-03-01T10:20:31' })?.financialStatus).toBe('pending')
    expect(normalizeWooOrder({ ...ORDER_42, status: 'completed', date_paid_gmt: '2026-03-01T10:20:31' })?.financialStatus).toBe('paid')
    expect(normalizeWooOrder({ ...ORDER_42, status: 'refunded', date_paid_gmt: '2026-03-01T10:20:31' })?.financialStatus).toBe('refunded')
    // A third-party COD gateway is recognised by its id or its title.
    expect(normalizeWooOrder({ ...ORDER_42, status: 'processing', date_paid_gmt: '2026-03-01T10:20:31', payment_method: 'fan_courier_cod', payment_method_title: 'Fan Courier' })?.financialStatus).toBe('pending')
    expect(normalizeWooOrder({ ...ORDER_42, status: 'processing', date_paid_gmt: '2026-03-01T10:20:31', payment_method: 'custom_gw', payment_method_title: 'Plata ramburs la curier' })?.financialStatus).toBe('pending')
    // Online payments keep the stamp as the payment.
    expect(normalizeWooOrder({ ...ORDER_42, status: 'processing', date_paid_gmt: '2026-03-01T10:20:31', payment_method: 'stripe', payment_method_title: 'Card' })?.financialStatus).toBe('paid')
    expect(normalizeWooOrder({ ...ORDER_42, status: 'processing', date_paid_gmt: null, payment_method: 'stripe', payment_method_title: 'Card' })?.financialStatus).toBe('pending')
  })

  it('uses modified_after with GMT dates, still ordered by id, for incremental order and product syncs', async () => {
    const seen: URL[] = []
    const { adapter } = adapterWith({
      'GET /wp-json/wc/v3/orders': (url) => { seen.push(url); return jsonRes([], 200, { 'x-wp-totalpages': '0' }) },
      'GET /wp-json/wc/v3/products': (url) => { seen.push(url); return jsonRes([{ id: 5, name: 'Cană', sku: 'C-1', status: 'publish', price: '49.95', stock_status: 'onbackorder', stock_quantity: 3, permalink: `${STORE}/produs/cana`, date_modified_gmt: '2026-03-02T08:00:00', type: 'simple' }], 200, { 'x-wp-totalpages': '1' }) },
    })
    const checkpoint = { cursor: null, modifiedAfter: '2026-03-01T10:00:00.000Z', pages: 3 }
    const orders = await adapter.syncPage(connection(), 'orders', checkpoint, 'incremental', fakeLogger().log)
    expect(seen[0].searchParams.get('modified_after')).toBe('2026-03-01T10:00:00.000Z')
    expect(seen[0].searchParams.get('dates_are_gmt')).toBe('true')
    // Offset pagination: ordering by a key that moves during the scan (modified) skips records; id never does.
    expect(seen[0].searchParams.get('orderby')).toBe('id')
    expect(seen[0].searchParams.get('order')).toBe('asc')
    expect(orders).toMatchObject({ done: true, orders: [], checkpoint: { cursor: null, modifiedAfter: '2026-03-01T10:00:00.000Z', pages: 4 } })

    const products = await adapter.syncPage(connection(), 'products', checkpoint, 'incremental', fakeLogger().log)
    expect(seen[1].searchParams.get('modified_after')).toBe('2026-03-01T10:00:00.000Z')
    expect(seen[1].searchParams.get('dates_are_gmt')).toBe('true')
    expect(seen[1].searchParams.get('orderby')).toBe('id')
    expect(seen[1].searchParams.get('per_page')).toBe('100')
    expect(products.done).toBe(true)
    expect(products.products).toEqual([
      expect.objectContaining({ externalId: '5', sku: 'C-1', name: 'Cană', status: 'active', price: 49.95, currency: null, stockStatus: 'on_backorder', stockQuantity: 3, url: `${STORE}/produs/cana`, providerUpdatedAt: '2026-03-02T08:00:00.000Z' }),
    ])
  })

  it('scans customers fully (no date filter in the API) and carts never (webhook-only)', async () => {
    const seen: URL[] = []
    const { adapter, fetchImpl } = adapterWith({
      'GET /wp-json/wc/v3/customers': (url) => {
        seen.push(url)
        return jsonRes([{ id: 7, email: 'ana@example.com', first_name: 'Ana', last_name: 'Pop', role: 'customer', is_paying_customer: true, date_created_gmt: '2025-01-01T00:00:00', date_modified_gmt: '2026-02-01T00:00:00', billing: { phone: '0722123456', country: 'RO' }, shipping: {} }], 200, { 'x-wp-totalpages': '1' })
      },
    })
    const batch = await adapter.syncPage(connection(), 'customers', { cursor: null, modifiedAfter: '2026-03-01T10:00:00.000Z', pages: 0 }, 'incremental', fakeLogger().log)
    expect(seen[0].searchParams.has('modified_after')).toBe(false)
    expect(seen[0].searchParams.get('role')).toBe('customer')
    expect(seen[0].searchParams.get('orderby')).toBe('id')
    expect(batch.done).toBe(true)
    expect(batch.customers).toEqual([
      expect.objectContaining({ externalId: '7', email: 'ana@example.com', firstName: 'Ana', lastName: 'Pop', phoneRaw: '0722123456', countryCode: 'RO', marketingConsent: null, ordersCount: null, providerUpdatedAt: '2026-02-01T00:00:00.000Z' }),
    ])
    const carts = await adapter.syncPage(connection(), 'carts', { cursor: '3', modifiedAfter: null, pages: 1 }, 'initial', fakeLogger().log)
    expect(carts).toEqual({ resource: 'carts', carts: [], checkpoint: { cursor: null, modifiedAfter: null, pages: 1 }, done: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('surfaces a revoked key during sync as a ConnectionError', async () => {
    const { adapter } = adapterWith({ 'GET /wp-json/wc/v3/orders': () => jsonRes({ code: 'woocommerce_rest_cannot_view', data: { status: 401 } }, 401) })
    const err = await failure(adapter.syncPage(connection(), 'orders', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', fakeLogger().log))
    expect(err.code).toBe('unauthorized')
    expectNoSecret({ message: err.message, publicMessage: err.publicMessage })
  })
})

describe('verifyWebhook', () => {
  const body = JSON.stringify(ORDER_42)
  const headersFor = (raw: string, extra: Record<string, string> = {}) => ({
    'x-wc-webhook-signature': sign(raw),
    'x-wc-webhook-topic': 'order.created',
    'x-wc-webhook-resource': 'order',
    'x-wc-webhook-event': 'created',
    'x-wc-webhook-id': '12',
    'x-wc-webhook-delivery-id': 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    'x-wc-webhook-source': `${STORE}/`,
    'user-agent': 'WooCommerce/9.9.0 Hookshot (WordPress/6.8)',
    'content-type': 'application/json',
    ...extra,
  })

  it('accepts a delivery signed over the exact bytes and exposes topic, delivery id and resource id', async () => {
    const result = await wooCommerceAdapter.verifyWebhook(rawRequest(body, headersFor(body)), connection())
    expect(result).toEqual({ ok: true, topic: 'order.created', deliveryId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', externalResourceId: '42', payload: ORDER_42 })
  })

  it('rejects the same JSON serialized differently, a wrong secret, a truncated or missing signature', async () => {
    const pretty = JSON.stringify(ORDER_42, null, 2)
    // Signature computed over the compact bytes, request carries the pretty bytes: same JSON, different bytes.
    expect(await wooCommerceAdapter.verifyWebhook(rawRequest(pretty, headersFor(body)), connection())).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    expect(await wooCommerceAdapter.verifyWebhook(rawRequest(body, headersFor(pretty)), connection())).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    expect(await wooCommerceAdapter.verifyWebhook(rawRequest(body, { ...headersFor(body), 'x-wc-webhook-signature': sign(body, 'another-secret-0123456789') }), connection())).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    expect(await wooCommerceAdapter.verifyWebhook(rawRequest(body, { ...headersFor(body), 'x-wc-webhook-signature': sign(body).slice(0, 20) }), connection())).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    expect(await wooCommerceAdapter.verifyWebhook(rawRequest(body, { ...headersFor(body), 'x-wc-webhook-signature': 'not base64!!' }), connection())).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    const { 'x-wc-webhook-signature': _dropped, ...unsigned } = headersFor(body)
    expect(await wooCommerceAdapter.verifyWebhook(rawRequest(body, unsigned), connection())).toEqual({ ok: false, reason: 'missing_signature', status: 401 })
  })

  it('acknowledges the unsigned creation ping only in its exact shape, and signed non-JSON bodies, as ignored', async () => {
    const ping = await wooCommerceAdapter.verifyWebhook(rawRequest('webhook_id=12', { 'user-agent': 'WooCommerce/9.9.0 Hookshot (WordPress/6.8)', 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' }), connection())
    expect(ping).toEqual({ ok: true, topic: 'ping', deliveryId: null, externalResourceId: null, payload: { webhook_id: '12' } })
    expect(wooCommerceAdapter.normalizeEvent(ping as VerifiedCommerceEvent, connection())).toEqual([{ kind: 'ignored', reason: 'ping' }])
    // Anything else unsigned is refused: a JSON body, a ping with extra fields, a ping with a topic header.
    expect((await wooCommerceAdapter.verifyWebhook(rawRequest('webhook_id=12&x=1', {}), connection())).ok).toBe(false)
    expect((await wooCommerceAdapter.verifyWebhook(rawRequest('webhook_id=12', { 'x-wc-webhook-topic': 'order.created' }), connection())).ok).toBe(false)
    expect((await wooCommerceAdapter.verifyWebhook(rawRequest('{"id":42}', {}), connection())).ok).toBe(false)

    const signedText = await wooCommerceAdapter.verifyWebhook(rawRequest('webhook_id=12', { 'x-wc-webhook-signature': sign('webhook_id=12') }), connection())
    expect(signedText).toMatchObject({ ok: true, topic: 'ping' })
    const signedGarbage = await wooCommerceAdapter.verifyWebhook(rawRequest('hello', { 'x-wc-webhook-signature': sign('hello'), 'x-wc-webhook-topic': 'order.created' }), connection())
    expect(signedGarbage).toMatchObject({ ok: true, topic: 'non_json' })
    expect(wooCommerceAdapter.normalizeEvent(signedGarbage as VerifiedCommerceEvent, connection())).toEqual([{ kind: 'ignored', reason: 'non_json' }])
  })

  it('needs a topic (header or body) and a stored webhook secret', async () => {
    const { 'x-wc-webhook-topic': _dropped, ...noTopic } = headersFor(body)
    expect(await wooCommerceAdapter.verifyWebhook(rawRequest(body, noTopic), connection())).toEqual({ ok: false, reason: 'unknown_topic', status: 400 })
    const cartBody = JSON.stringify({ topic: CART_TOPIC, cart_id: 'c-9', customer: { phone: '0722 000 111' }, items: [] })
    expect(await wooCommerceAdapter.verifyWebhook(rawRequest(cartBody, { 'x-wc-webhook-signature': sign(cartBody) }), connection())).toMatchObject({ ok: true, topic: CART_TOPIC, externalResourceId: 'c-9' })
    const noSecret = connection({ secrets: { consumer_key: CK, consumer_secret: CS } })
    expect(await wooCommerceAdapter.verifyWebhook(rawRequest(body, headersFor(body)), noSecret)).toEqual({ ok: false, reason: 'not_supported', status: 400 })
  })
})

describe('normalizeEvent', () => {
  const verified = (topic: string, payload: unknown): VerifiedCommerceEvent => ({ ok: true, topic, deliveryId: 'd-1', externalResourceId: null, payload })

  it('maps WooCommerce topics onto commerce events with the record normalizers', () => {
    const conn = connection()
    expect(wooCommerceAdapter.normalizeEvent(verified('order.created', ORDER_42), conn)).toEqual([{ kind: 'order.created', order: expect.objectContaining({ externalId: '42', paymentMethod: 'cod' }) }])
    expect(wooCommerceAdapter.normalizeEvent(verified('order.updated', ORDER_42), conn)[0].kind).toBe('order.updated')
    expect(wooCommerceAdapter.normalizeEvent(verified('order.restored', ORDER_42), conn)[0].kind).toBe('order.updated')
    expect(wooCommerceAdapter.normalizeEvent(verified('order.deleted', { id: 42 }), conn)).toEqual([{ kind: 'order.deleted', externalId: '42' }])
    expect(wooCommerceAdapter.normalizeEvent(verified('product.updated', { id: 5, name: 'Cană', status: 'private', stock_status: 'outofstock' }), conn)).toEqual([{ kind: 'product.updated', product: expect.objectContaining({ externalId: '5', status: 'archived', stockStatus: 'out_of_stock' }) }])
    expect(wooCommerceAdapter.normalizeEvent(verified('product.deleted', { id: 5 }), conn)).toEqual([{ kind: 'product.deleted', externalId: '5' }])
    expect(wooCommerceAdapter.normalizeEvent(verified('customer.updated', { id: 7, email: 'ana@example.com', billing: { phone: '0722123456', country: 'RO' } }), conn)).toEqual([{ kind: 'customer.updated', customer: expect.objectContaining({ externalId: '7', phoneRaw: '0722123456', countryCode: 'RO' }) }])
    expect(wooCommerceAdapter.normalizeEvent(verified('customer.created', { id: 8 }), conn)[0].kind).toBe('customer.updated')
    expect(wooCommerceAdapter.normalizeEvent(verified('customer.deleted', { id: 7 }), conn)).toEqual([{ kind: 'ignored', reason: 'unhandled_topic:customer.deleted' }])
    expect(wooCommerceAdapter.normalizeEvent(verified('coupon.created', { id: 1 }), conn)).toEqual([{ kind: 'ignored', reason: 'unhandled_topic:coupon.created' }])
    expect(wooCommerceAdapter.normalizeEvent(verified('order.created', { number: 'x' }), conn)).toEqual([{ kind: 'ignored', reason: 'malformed_payload:order' }])
  })

  it('maps the companion plugin cart payload', () => {
    const payload = {
      cart_id: 'c-9',
      customer: { id: 7, phone: '0722 000 111', email: 'ana@example.com', first_name: 'Ana', last_name: 'Pop', country: 'RO' },
      items: [{ name: 'Cană', quantity: 2 }, { name: '', quantity: 1 }, { quantity: 3 }],
      total: '99.90',
      currency: 'ron',
      abandoned_at: '2026-03-01T10:20:30Z',
      status: 'abandoned',
    }
    expect(wooCommerceAdapter.normalizeEvent(verified(CART_TOPIC, payload), connection())).toEqual([
      {
        kind: 'cart.updated',
        cart: {
          externalId: 'c-9',
          customerExternalId: '7',
          contactName: 'Ana Pop',
          contactPhoneRaw: '0722 000 111',
          contactEmail: 'ana@example.com',
          status: 'abandoned',
          currency: 'RON',
          total: 99.9,
          items: [{ name: 'Cană', quantity: 2 }],
          abandonedAt: '2026-03-01T10:20:30.000Z',
          recoveredOrderExternalId: null,
          providerUpdatedAt: '2026-03-01T10:20:30.000Z',
          metadata: { country: 'RO', payload_hash: expect.stringMatching(/^[0-9a-f]{64}$/) },
        },
      },
    ])
  })
})

describe('registerWebhooks / unregisterWebhooks', () => {
  const existing = [
    { id: 301, name: 'Neuro Tech Voice: order.created', status: 'disabled', topic: 'order.created', delivery_url: WEBHOOK_URL },
    { id: 302, name: 'Other service', status: 'active', topic: 'order.updated', delivery_url: 'https://other.example.com/hook' },
    { id: 303, name: 'Companion carts', status: 'active', topic: CART_TOPIC, delivery_url: `${WEBHOOK_URL}/` },
    // Still active from a previous connection: it carries the previous webhook secret, which the API never returns.
    { id: 305, name: 'Neuro Tech Voice: product.updated', status: 'active', topic: 'product.updated', delivery_url: WEBHOOK_URL },
  ]

  it('reuses its own webhooks with the current secret (re-activating disabled ones), creates the missing ones and reports companion registrations as manual', async () => {
    const posts: unknown[] = []
    const puts: Array<{ id: string; body: unknown }> = []
    let nextId = 400
    const put: Handler = (url, init) => {
      const id = url.pathname.split('/').pop()!
      puts.push({ id, body: JSON.parse(String(init?.body)) })
      return jsonRes({ id: Number(id), status: 'active' })
    }
    const { adapter, fetchImpl } = adapterWith({
      'GET /wp-json/wc/v3/webhooks': () => jsonRes(existing, 200, { 'x-wp-totalpages': '1' }),
      'POST /wp-json/wc/v3/webhooks': (_url, init) => {
        const body = JSON.parse(String(init?.body))
        posts.push(body)
        return jsonRes({ id: ++nextId, status: 'active', topic: body.topic, delivery_url: body.delivery_url }, 201)
      },
      'PUT /wp-json/wc/v3/webhooks/301': put,
      'PUT /wp-json/wc/v3/webhooks/305': put,
    })
    const { log, calls } = fakeLogger()
    const registrations = await adapter.registerWebhooks(connection({ webhookRegistrations: [{ topic: 'legacy.manual', externalId: '9', source: 'manual' }] }), log)
    expect(registrations).toEqual([
      { topic: 'order.created', externalId: '301', source: 'api' },
      { topic: 'order.updated', externalId: '401', source: 'api' },
      { topic: 'product.updated', externalId: '305', source: 'api' },
      { topic: 'customer.updated', externalId: '402', source: 'api' },
      { topic: 'legacy.manual', externalId: '9', source: 'manual' },
      { topic: CART_TOPIC, externalId: '303', source: 'manual' },
    ])
    // Both reused webhooks get the connection's current secret: a reconnect generates a new one and a webhook
    // left with the old secret would fail every signature until WooCommerce auto-disables it.
    expect(puts).toEqual([
      { id: '301', body: { status: 'active', secret: WEBHOOK_SECRET } },
      { id: '305', body: { status: 'active', secret: WEBHOOK_SECRET } },
    ])
    expect(posts).toEqual([
      { name: 'Neuro Tech Voice: order.updated', topic: 'order.updated', delivery_url: WEBHOOK_URL, secret: WEBHOOK_SECRET, status: 'active' },
      { name: 'Neuro Tech Voice: customer.updated', topic: 'customer.updated', delivery_url: WEBHOOK_URL, secret: WEBHOOK_SECRET, status: 'active' },
    ])
    // The foreign webhook (302) and the companion one (303) are never touched.
    expect(fetchImpl.mock.calls.some((c) => /webhooks\/30[23]/.test(String(c[0])))).toBe(false)
    for (const call of fetchImpl.mock.calls) expectNoSecret(String(call[0]))
    expectNoSecret(calls)
  })

  it('surfaces a secret refresh refused by the store as forbidden without leaking the secret', async () => {
    let nextId = 500
    const { adapter, fetchImpl } = adapterWith({
      'GET /wp-json/wc/v3/webhooks': () => jsonRes([existing[3]], 200, { 'x-wp-totalpages': '1' }),
      'POST /wp-json/wc/v3/webhooks': () => jsonRes({ id: ++nextId, status: 'active' }, 201),
      'PUT /wp-json/wc/v3/webhooks/305': () => jsonRes({ code: 'woocommerce_rest_authentication_error', message: `The API key provided does not have write permissions. ${WEBHOOK_SECRET}`, data: { status: 401 } }, 401),
    })
    const err = await failure(adapter.registerWebhooks(connection(), fakeLogger().log))
    expect(fetchImpl.mock.calls.some((c) => c[1]?.method === 'PUT')).toBe(true)
    expect(err.code).toBe('forbidden')
    expect(err.message).toBe('woocommerce webhooks.update: HTTP 401 (woocommerce_rest_authentication_error)')
    expectNoSecret({ message: err.message, publicMessage: err.publicMessage, stack: err.stack })
  })

  it('fails with not_configured without a public URL or a stored secret, and with forbidden on a read-only key', async () => {
    const { adapter } = adapterWith({
      'GET /wp-json/wc/v3/webhooks': () => jsonRes([], 200, { 'x-wp-totalpages': '0' }),
      'POST /wp-json/wc/v3/webhooks': () => jsonRes({ code: 'woocommerce_rest_authentication_error', message: 'The API key provided does not have write permissions.', data: { status: 401 } }, 401),
    })
    expect((await failure(adapter.registerWebhooks(connection({ webhookUrl: null }), fakeLogger().log))).code).toBe('not_configured')
    expect((await failure(adapter.registerWebhooks(connection({ secrets: { consumer_key: CK, consumer_secret: CS } }), fakeLogger().log))).code).toBe('not_configured')
    const readOnly = await failure(adapter.registerWebhooks(connection(), fakeLogger().log))
    expect(readOnly.code).toBe('forbidden')
    expectNoSecret({ message: readOnly.message, publicMessage: readOnly.publicMessage })
  })

  it('deletes its own webhooks with force=true, tolerates 404 and leaves manual ones alone', async () => {
    const deleted: string[] = []
    const { adapter } = adapterWith({
      'DELETE /wp-json/wc/v3/webhooks/301': (url) => { deleted.push(url.search); return jsonRes({ id: 301 }) },
      'DELETE /wp-json/wc/v3/webhooks/302': () => jsonRes({ code: 'woocommerce_rest_webhook_invalid_id', message: 'Invalid ID.', data: { status: 404 } }, 404),
    })
    const conn = connection({
      webhookRegistrations: [
        { topic: 'order.created', externalId: '301', source: 'api' },
        { topic: 'order.updated', externalId: '302', source: 'api' },
        { topic: CART_TOPIC, externalId: '303', source: 'manual' },
      ],
    })
    await expect(adapter.unregisterWebhooks(conn, fakeLogger().log)).resolves.toBeUndefined()
    expect(deleted).toEqual(['?force=true'])
  })
})

describe('fetchOrder / fetchCustomer / fetchProduct', () => {
  it('reads one record, returns null on 404 and refuses non-numeric ids without a request', async () => {
    const { adapter, fetchImpl } = adapterWith({
      'GET /wp-json/wc/v3/orders/42': () => jsonRes(ORDER_42),
      'GET /wp-json/wc/v3/customers/7': () => jsonRes({ id: 7, email: 'ana@example.com' }),
    })
    const { log } = fakeLogger()
    expect(await adapter.fetchOrder(connection(), '42', log)).toMatchObject({ externalId: '42', orderNumber: '1042' })
    expect(await adapter.fetchCustomer(connection(), '7', log)).toMatchObject({ externalId: '7', email: 'ana@example.com' })
    expect(await adapter.fetchProduct(connection(), '5', log)).toBeNull()
    expect(await adapter.fetchOrder(connection(), '../webhooks', log)).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})
