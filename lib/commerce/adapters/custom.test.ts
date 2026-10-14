import crypto from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { Logger } from '@/lib/observability/logger'
import { jsonResponse, timeoutError } from '@/tests/helpers/fetch'
import type { CommerceCapabilities } from '../types'
import { ConnectionError, type AdapterConnection, type VerifiedCommerceEvent } from './types'
import {
  CUSTOM_CONNECTOR_CONTRACT,
  CUSTOM_CONTRACT_VERSION,
  CUSTOM_PAGE_SIZE,
  CUSTOM_POLLING_MINUTES,
  CUSTOM_WEBHOOK_TOPICS,
  CustomOrderSchema,
  CustomSecretsSchema,
  NOTE_CARTS_POLLED,
  NOTE_NO_CARTS,
  NOTE_NO_CUSTOMERS,
  NOTE_NO_PRODUCTS,
  NOTE_NO_WEBHOOK_SECRET,
  NOTE_WEBHOOKS_MANUAL,
  NOTE_WEBHOOKS_NOT_SENT,
  authHeadersFor,
  canonicalBaseUrl,
  createCustomAdapter,
  customAdapter,
  normalizeCustomOrder,
  payloadHashOf,
} from './custom'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TOKEN = 'tok_live_0123456789abcdefghijklmnopqrstuv'
const API_KEY = 'apikey-test-fixture-not-a-real-key-ZZ'
const BASIC = 'ntv-user:S3cret-Pa55word'
const WEBHOOK_SECRET = 'whsec-custom-test-0123456789abcdef'
const SECRET_VALUES = [TOKEN, API_KEY, BASIC, WEBHOOK_SECRET, Buffer.from(BASIC).toString('base64')]
const BASE = 'https://api.shop.example.ro/ntv'
const WEBHOOK_URL = 'https://app.example.com/api/commerce/webhooks/custom/abc'
const NOW_MS = Date.parse('2026-10-13T08:00:00Z')
const NOW_S = Math.floor(NOW_MS / 1000)
const publicLookup = async () => ['93.184.216.34']
const privateLookup = async () => ['10.0.0.5']

type Handler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>

/** A fetch whose routes are keyed by "METHOD /path" (query string ignored); unknown routes answer 404 JSON. */
function apiFetch(routes: Record<string, Handler>) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = (init?.method ?? 'GET').toUpperCase()
    const handler = routes[`${method} ${url.pathname}`]
    if (!handler) return jsonResponse({ error: 'not found' }, 404)
    return handler(url, init)
  })
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

const HEALTH = {
  ok: true,
  contract_version: '1',
  store: { name: 'Magazinul Meu', currency: 'ron', country: 'ro', timezone: 'Europe/Bucharest', language: 'ro' },
  capabilities: { orders: true, customers: true, products: true, carts: true, webhooks: true },
}

const ORDER_1001 = {
  id: 'ord_1001',
  number: '1001',
  created_at: '2026-10-13T07:30:00+03:00',
  updated_at: '2026-10-13T07:45:00Z',
  status: 'processing',
  financial_status: 'pending',
  fulfillment_status: 'unfulfilled',
  payment_method: 'ramburs_fan',
  payment_method_title: 'Plata ramburs (FAN Courier)',
  is_cod: true,
  currency: 'RON',
  total: '189.90',
  customer: { id: 'cus_7', name: 'Andreea Popescu', phone: '0722 123 456', email: 'andreea@example.com', country: 'RO' },
  shipping: { city: 'Cluj-Napoca', country: 'RO', summary: 'Str. Exemplu 1, Cluj-Napoca' },
  items: [
    { id: 'li_1', product_id: 'p_1', sku: 'TS-M', name: 'Tricou bumbac (M)', quantity: 1, unit_price: 89.9, total: 89.9 },
    { id: 'li_2', product_id: 'p_2', sku: 'SO', name: 'Șosete sport', quantity: 2, unit_price: 50, total: 100 },
  ],
  internal_note: 'ignored by the contract',
}

const CUSTOMER_7 = { id: 'cus_7', email: 'andreea@example.com', first_name: 'Andreea', last_name: 'Popescu', phone: '+40722123456', country: 'RO', marketing_consent: true, call_consent: null, orders_count: 3, total_spent: '640.5', created_at: '2026-01-05T10:00:00Z', updated_at: '2026-10-13T07:45:00Z' }
const PRODUCT_1 = { id: 'p_1', sku: 'TS-M', name: 'Tricou bumbac (M)', status: 'active', price: 89.9, currency: 'RON', stock_status: 'in_stock', stock_quantity: 12, url: 'https://shop.example.ro/p/tricou-m', updated_at: '2026-10-12T09:00:00Z' }
const CART_9 = { id: 'cart_9', customer: { id: 'cus_7', name: 'Andreea Popescu', phone: '0722 123 456', email: 'andreea@example.com', country: 'RO' }, items: [{ name: 'Tricou bumbac (M)', quantity: 1 }], total: 89.9, currency: 'RON', status: 'abandoned', abandoned_at: '2026-10-13T07:00:00Z', updated_at: '2026-10-13T07:00:00Z' }

/** A store whose /health declares every capability, so the connection test probes all four list endpoints. */
const healthyRoutes: Record<string, Handler> = {
  'GET /ntv/health': () => jsonResponse(HEALTH),
  'GET /ntv/orders': () => jsonResponse({ items: [ORDER_1001], next_cursor: null }),
  'GET /ntv/customers': () => jsonResponse({ items: [CUSTOMER_7], next_cursor: null }),
  'GET /ntv/products': () => jsonResponse({ items: [PRODUCT_1], next_cursor: null }),
  'GET /ntv/carts': () => jsonResponse({ items: [], next_cursor: null }),
}

function connection(overrides: Partial<AdapterConnection> = {}): AdapterConnection {
  const capabilities: CommerceCapabilities = { products: true, customers: true, orders: true, webhooks: true, abandoned_carts: true, customer_phone: true, polling_minutes: null, notes: [NOTE_WEBHOOKS_MANUAL] }
  return {
    id: 'conn-1',
    orgId: 'org-1',
    platform: 'custom',
    storeUrl: BASE,
    storeDomain: 'api.shop.example.ro',
    secrets: { auth_scheme: 'bearer', auth_token: TOKEN, webhook_secret: WEBHOOK_SECRET },
    capabilities,
    webhookRegistrations: [],
    webhookUrl: WEBHOOK_URL,
    ...overrides,
  }
}

function sign(body: Uint8Array | string, secret = WEBHOOK_SECRET): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
}

function rawRequest(body: string, headers: Record<string, string>) {
  return { headers: new Headers(headers), rawBody: new TextEncoder().encode(body), url: new URL(WEBHOOK_URL) }
}

function deliveryHeaders(body: string, over: Record<string, string> = {}) {
  return { 'x-ntv-signature': sign(body), 'x-ntv-event-id': 'evt_001', 'x-ntv-topic': 'order.created', 'x-ntv-timestamp': String(NOW_S - 30), 'content-type': 'application/json', ...over }
}

function adapterWith(routes: Record<string, Handler>, lookup = publicLookup) {
  const fetchImpl = apiFetch(routes)
  const adapter = createCustomAdapter({ fetchImpl, lookup, now: () => NOW_MS })
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
}

function expectCleanError(err: ConnectionError) {
  expectNoSecret(err.message)
  expectNoSecret(err.publicMessage)
  expectNoSecret(err.stack ?? '')
}

const bearerSecrets = { auth_scheme: 'bearer', auth_token: TOKEN, webhook_secret: WEBHOOK_SECRET, auth_header_name: '' }

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CustomSecretsSchema', () => {
  it('accepts the three schemes and drops empty optional fields', () => {
    expect(CustomSecretsSchema.parse(bearerSecrets)).toEqual({ auth_scheme: 'bearer', auth_token: TOKEN, webhook_secret: WEBHOOK_SECRET })
    expect(CustomSecretsSchema.parse({ auth_scheme: 'api_key_header', auth_header_name: 'X-API-Key', auth_token: ` ${API_KEY} `, webhook_secret: '' })).toEqual({ auth_scheme: 'api_key_header', auth_header_name: 'X-API-Key', auth_token: API_KEY })
    expect(CustomSecretsSchema.parse({ auth_scheme: 'basic', auth_token: BASIC })).toEqual({ auth_scheme: 'basic', auth_token: BASIC })
  })
  it('requires a header name for api_key_header and refuses names that shadow the request', () => {
    expect(CustomSecretsSchema.safeParse({ auth_scheme: 'api_key_header', auth_token: API_KEY }).success).toBe(false)
    for (const name of ['Authorization', 'cookie', 'HOST', 'Content-Type', 'Accept']) {
      expect(CustomSecretsSchema.safeParse({ auth_scheme: 'api_key_header', auth_header_name: name, auth_token: API_KEY }).success).toBe(false)
    }
    expect(CustomSecretsSchema.safeParse({ auth_scheme: 'api_key_header', auth_header_name: 'X API Key', auth_token: API_KEY }).success).toBe(false)
  })
  it('rejects tokens that could inject headers, over-long tokens, basic without a colon and short webhook secrets', () => {
    expect(CustomSecretsSchema.safeParse({ auth_scheme: 'bearer', auth_token: 'abc\r\nx-injected: 1' }).success).toBe(false)
    expect(CustomSecretsSchema.safeParse({ auth_scheme: 'bearer', auth_token: 'a'.repeat(2001) }).success).toBe(false)
    expect(CustomSecretsSchema.safeParse({ auth_scheme: 'bearer', auth_token: '' }).success).toBe(false)
    expect(CustomSecretsSchema.safeParse({ auth_scheme: 'basic', auth_token: 'nocolon' }).success).toBe(false)
    expect(CustomSecretsSchema.safeParse({ auth_scheme: 'bearer', auth_token: TOKEN, webhook_secret: 'short' }).success).toBe(false)
    expect(CustomSecretsSchema.safeParse({ auth_scheme: 'digest', auth_token: TOKEN }).success).toBe(false)
  })
  it('builds one credential header per scheme', () => {
    expect(authHeadersFor({ auth_scheme: 'bearer', auth_token: TOKEN })).toEqual({ authorization: `Bearer ${TOKEN}` })
    expect(authHeadersFor({ auth_scheme: 'bearer', auth_token: `Bearer ${TOKEN}` })).toEqual({ authorization: `Bearer ${TOKEN}` })
    expect(authHeadersFor({ auth_scheme: 'api_key_header', auth_header_name: 'X-API-Key', auth_token: API_KEY })).toEqual({ 'x-api-key': API_KEY })
    expect(authHeadersFor({ auth_scheme: 'basic', auth_token: BASIC })).toEqual({ authorization: `Basic ${Buffer.from(BASIC).toString('base64')}` })
  })
  it('pins the contract version and the catalogue of the contract', () => {
    expect(CUSTOM_CONTRACT_VERSION).toBe('1')
    expect(CUSTOM_CONNECTOR_CONTRACT.version).toBe('1')
    expect(Object.keys(CUSTOM_CONNECTOR_CONTRACT.endpoints)).toEqual(['health', 'orders', 'customers', 'products', 'carts', 'order', 'customer', 'product'])
    expect(CUSTOM_CONNECTOR_CONTRACT.webhooks.headers['x-ntv-topic']).toBe(CUSTOM_WEBHOOK_TOPICS.join(' | '))
    expect(customAdapter.platform).toBe('custom')
  })
})

describe('canonicalBaseUrl', () => {
  it('lower-cases the host, keeps the API root path, strips the query and trailing slashes', () => {
    expect(canonicalBaseUrl('https://API.Shop.Example.RO/ntv/?x=1#f')).toEqual({ storeUrl: BASE, storeDomain: 'api.shop.example.ro' })
    expect(canonicalBaseUrl('api.shop.example.ro').storeUrl).toBe('https://api.shop.example.ro')
    expect(canonicalBaseUrl('https://api.shop.example.ro:8443/v1/').storeUrl).toBe('https://api.shop.example.ro:8443/v1')
  })
  it('refuses http, embedded credentials and garbage', () => {
    expect(() => canonicalBaseUrl('http://api.shop.example.ro')).toThrow(ConnectionError)
    expect(() => canonicalBaseUrl('https://u:p@api.shop.example.ro')).toThrow(/credentials/)
    expect(() => canonicalBaseUrl('')).toThrow(ConnectionError)
  })
})

describe('validateConnection', () => {
  it('proves access with /health and the first order, reads store facts and keeps the secrets out of URLs and logs', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes)
    const { log, calls } = fakeLogger()
    const store = await adapter.validateConnection({ storeUrl: 'https://API.shop.example.ro/ntv/', secrets: bearerSecrets }, log)
    expect(store).toMatchObject({ storeUrl: BASE, storeDomain: 'api.shop.example.ro', displayName: 'Magazinul Meu', currency: 'RON', countryCode: 'RO', timezone: 'Europe/Bucharest', language: 'ro', platformVersion: '1' })
    expect(store.capabilities).toEqual({ products: true, customers: true, orders: true, webhooks: true, abandoned_carts: true, customer_phone: true, polling_minutes: null, notes: [NOTE_WEBHOOKS_MANUAL] })
    expect(store.secrets).toEqual({ auth_scheme: 'bearer', auth_token: TOKEN, webhook_secret: WEBHOOK_SECRET })

    // /health, then one probe per declared list endpoint: a capability is evidence from the real API.
    expect(fetchImpl.mock.calls.map((c) => String(c[0]))).toEqual([`${BASE}/health`, `${BASE}/orders?limit=1`, `${BASE}/customers?limit=1`, `${BASE}/products?limit=1`, `${BASE}/carts?limit=1`])
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${TOKEN}`)
      expect(init).toMatchObject({ method: 'GET', redirect: 'manual' })
      expectNoSecret(String(url))
    }
    expectNoSecret(calls)
    expect(calls).toContainEqual(expect.objectContaining({ event: 'custom.validate.ok', fields: expect.objectContaining({ authScheme: 'bearer', webhooks: true, samples: { orders: 1, customers: 1, products: 1, carts: 0 } }) }))
  })

  it('probes only the resources /health declares and blocks the connection when a declared endpoint is missing or breaks the contract', async () => {
    const { log } = fakeLogger()
    const health = (capabilities: Record<string, boolean>) => () => jsonResponse({ ...HEALTH, capabilities })

    // Not declared → not probed (a 404 there is irrelevant).
    const ordersOnly = adapterWith({ 'GET /ntv/health': health({ orders: true }), 'GET /ntv/orders': healthyRoutes['GET /ntv/orders'] })
    await ordersOnly.adapter.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, log)
    expect(ordersOnly.fetchImpl.mock.calls.map((c) => new URL(String(c[0])).pathname)).toEqual(['/ntv/health', '/ntv/orders'])

    // Declared but missing → the message names the endpoint and the flag that promised it; nothing is "connected" on the store's word alone.
    const missing = adapterWith({ ...healthyRoutes, 'GET /ntv/customers': () => jsonResponse({ error: 'not found' }, 404) }).adapter
    const err = await failure(missing.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, log))
    expect(err).toMatchObject({ code: 'invalid_response', retryable: false })
    expect(err.publicMessage).toContain('GET /customers')
    expect(err.publicMessage).toContain('capabilities.customers=true')
    expectCleanError(err)

    // Declared and answering, but the first record breaks the contract → the field path is named, the value is not echoed.
    const broken = adapterWith({ ...healthyRoutes, 'GET /ntv/carts': () => jsonResponse({ items: [{ ...CART_9, status: 'lost-' + TOKEN }], next_cursor: null }) }).adapter
    const bad = await failure(broken.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, log))
    expect(bad.code).toBe('invalid_response')
    expect(bad.publicMessage).toContain('GET /carts')
    expect(bad.publicMessage).toContain('status')
    expectCleanError(bad)

    // A declared endpoint that rate-limits or fails server-side is retryable; one that refuses the token is not.
    const limited = adapterWith({ ...healthyRoutes, 'GET /ntv/products': () => jsonResponse({ error: 'slow' }, 429) }).adapter
    expect(await failure(limited.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, log))).toMatchObject({ code: 'rate_limited', retryable: true })
    const down = adapterWith({ ...healthyRoutes, 'GET /ntv/products': () => jsonResponse({ error: 'boom' }, 502) }).adapter
    expect(await failure(down.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, log))).toMatchObject({ code: 'unreachable', retryable: true })
    const forbidden = adapterWith({ ...healthyRoutes, 'GET /ntv/products': () => jsonResponse({ error: 'scope' }, 403) }).adapter
    expect(await failure(forbidden.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, log))).toMatchObject({ code: 'forbidden', retryable: false })
  })

  it('sends the API key in the merchant-named header and Basic as base64(user:password)', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes)
    const { log } = fakeLogger()
    const keyed = await adapter.validateConnection({ storeUrl: BASE, secrets: { auth_scheme: 'api_key_header', auth_header_name: 'X-API-Key', auth_token: API_KEY } }, log)
    expect(keyed.secrets).toEqual({ auth_scheme: 'api_key_header', auth_header_name: 'X-API-Key', auth_token: API_KEY })
    const keyedCalls = fetchImpl.mock.calls.length
    for (const call of fetchImpl.mock.calls) {
      expect(new Headers(call[1]?.headers).get('x-api-key')).toBe(API_KEY)
      expect(new Headers(call[1]?.headers).get('authorization')).toBeNull()
    }
    await adapter.validateConnection({ storeUrl: BASE, secrets: { auth_scheme: 'basic', auth_token: BASIC } }, log)
    for (const call of fetchImpl.mock.calls.slice(keyedCalls)) {
      expect(new Headers(call[1]?.headers).get('authorization')).toBe(`Basic ${Buffer.from(BASIC).toString('base64')}`)
      expect(new Headers(call[1]?.headers).get('x-api-key')).toBeNull()
    }
  })

  it('reports capabilities from /health and explains every false value', async () => {
    const { log } = fakeLogger()
    const withHealth = (capabilities: Record<string, boolean>) => adapterWith({ ...healthyRoutes, 'GET /ntv/health': () => jsonResponse({ ...HEALTH, capabilities }) }).adapter

    const noSecret = await withHealth({ orders: true, customers: true, products: true, carts: true, webhooks: true }).validateConnection({ storeUrl: BASE, secrets: { auth_scheme: 'bearer', auth_token: TOKEN } }, log)
    expect(noSecret.capabilities).toMatchObject({ webhooks: false, abandoned_carts: true, polling_minutes: CUSTOM_POLLING_MINUTES, notes: [NOTE_NO_WEBHOOK_SECRET, NOTE_CARTS_POLLED] })
    expect(noSecret.secrets).toEqual({ auth_scheme: 'bearer', auth_token: TOKEN })

    const apiSilent = await withHealth({ orders: true, customers: false, products: false, carts: false, webhooks: false }).validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, log)
    expect(apiSilent.capabilities).toEqual({ products: false, customers: false, orders: true, webhooks: false, abandoned_carts: false, customer_phone: true, polling_minutes: CUSTOM_POLLING_MINUTES, notes: [NOTE_WEBHOOKS_NOT_SENT, NOTE_NO_CARTS, NOTE_NO_PRODUCTS, NOTE_NO_CUSTOMERS] })

    const noOrders = await failure(withHealth({ orders: false, customers: true, products: true, carts: false, webhooks: false }).validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, log))
    expect(noOrders.code).toBe('invalid_response')
    expect(noOrders.publicMessage).toContain('capabilities.orders=false')
  })

  it('tolerates a /health without store facts and an empty first page of orders', async () => {
    const { adapter } = adapterWith({ 'GET /ntv/health': () => jsonResponse({ ok: true, contract_version: '1', capabilities: { orders: true } }), 'GET /ntv/orders': () => jsonResponse({ items: [], next_cursor: null }) })
    const store = await adapter.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, fakeLogger().log)
    expect(store).toMatchObject({ displayName: null, currency: null, countryCode: null, timezone: null, language: null })
    expect(store.capabilities).toMatchObject({ orders: true, products: false, customers: false, webhooks: false, abandoned_carts: false })
  })

  it.each([
    ['unauthorized', () => jsonResponse({ error: 'bad token' }, 401), false],
    ['forbidden', () => jsonResponse({ error: 'no scope' }, 403), false],
    ['not_a_store', () => jsonResponse({ error: 'nope' }, 404), false],
    ['not_a_store', () => new Response('<!doctype html><html><body>Login</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }), false],
    ['rate_limited', () => jsonResponse({ error: 'slow down' }, 429), true],
    ['unreachable', () => jsonResponse({ error: 'boom' }, 503), true],
    ['invalid_response', () => new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }), false],
    ['invalid_response', () => jsonResponse({ ok: false, contract_version: '1' }), true],
    ['api_version_unsupported', () => jsonResponse({ ...HEALTH, contract_version: '2' }), false],
    ['api_version_unsupported', () => jsonResponse({ ...HEALTH, contract_version: undefined }), false],
    ['invalid_response', () => jsonResponse({ ...HEALTH, capabilities: { orders: 'yes' } }), false],
    ['redirect', () => new Response(null, { status: 301, headers: { location: 'https://www.shop.example.ro/ntv/health' } }), false],
  ] as const)('classifies a /health answer as %s', async (code, handler, retryable) => {
    const { adapter } = adapterWith({ ...healthyRoutes, 'GET /ntv/health': handler })
    const err = await failure(adapter.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, fakeLogger().log))
    expect(err.code).toBe(code)
    expect(err.retryable).toBe(retryable)
    expect(err.publicMessage).toMatch(/[ăâîșț]|API|magazin/i)
    expectCleanError(err)
  })

  it('maps a timeout, a network failure, a blocked address and a bad URL', async () => {
    const timeout = adapterWith({ ...healthyRoutes, 'GET /ntv/health': () => Promise.reject(timeoutError()) }).adapter
    const t = await failure(timeout.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, fakeLogger().log))
    expect(t).toMatchObject({ code: 'timeout', retryable: true })

    const network = adapterWith({ ...healthyRoutes, 'GET /ntv/health': () => Promise.reject(new TypeError('fetch failed')) }).adapter
    const n = await failure(network.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, fakeLogger().log))
    expect(n).toMatchObject({ code: 'unreachable', retryable: true })

    const { adapter: blocked, fetchImpl } = adapterWith(healthyRoutes, privateLookup)
    const b = await failure(blocked.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, fakeLogger().log))
    expect(b.code).toBe('ssrf_blocked')
    expect(fetchImpl).not.toHaveBeenCalled()

    const literal = await failure(blocked.validateConnection({ storeUrl: 'https://169.254.169.254/latest', secrets: bearerSecrets }, fakeLogger().log))
    expect(literal.code).toBe('ssrf_blocked')
    const bad = await failure(blocked.validateConnection({ storeUrl: 'https://api.shop.example.ro:8080/ntv', secrets: bearerSecrets }, fakeLogger().log))
    expect(bad.code).toBe('invalid_url')
    for (const err of [t, n, b, literal, bad]) expectCleanError(err)
  })

  it('rejects malformed secrets before any request, without echoing them', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes)
    const err = await failure(adapter.validateConnection({ storeUrl: BASE, secrets: { auth_scheme: 'api_key_header', auth_token: API_KEY } }, fakeLogger().log))
    expect(err.code).toBe('unauthorized')
    expect(err.message).toContain('auth_header_name')
    expectCleanError(err)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails when the orders probe is refused or the first order breaks the contract, naming the field', async () => {
    const refused = adapterWith({ ...healthyRoutes, 'GET /ntv/orders': () => jsonResponse({ error: 'no' }, 401) }).adapter
    expect((await failure(refused.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, fakeLogger().log))).code).toBe('unauthorized')

    const broken = adapterWith({ ...healthyRoutes, 'GET /ntv/orders': () => jsonResponse({ items: [{ ...ORDER_1001, status: 'shipped', total: 'free' }], next_cursor: null }) }).adapter
    const err = await failure(broken.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, fakeLogger().log))
    expect(err.code).toBe('invalid_response')
    expect(err.publicMessage).toContain('status')
    expect(err.publicMessage).not.toContain('shipped')
    expectCleanError(err)

    const noEnvelope = adapterWith({ ...healthyRoutes, 'GET /ntv/orders': () => jsonResponse([ORDER_1001]) }).adapter
    expect((await failure(noEnvelope.validateConnection({ storeUrl: BASE, secrets: bearerSecrets }, fakeLogger().log))).code).toBe('invalid_response')
  })
})

describe('normalizers', () => {
  it('normalizes an order with items, statuses, numbers, ISO dates, the raw phone and a stable payload hash', () => {
    const order = normalizeCustomOrder(ORDER_1001)!
    expect(order).toMatchObject({
      externalId: 'ord_1001',
      orderNumber: '1001',
      customerExternalId: 'cus_7',
      contactName: 'Andreea Popescu',
      contactPhoneRaw: '0722 123 456',
      contactEmail: 'andreea@example.com',
      shippingCity: 'Cluj-Napoca',
      shippingCountry: 'RO',
      shippingSummary: 'Str. Exemplu 1, Cluj-Napoca',
      status: 'processing',
      financialStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      // is_cod=true is authoritative: the mirrored method id is the conventional "cod" (the core's COD detection
      // reads paymentMethod/paymentMethodTitle), and the merchant's own id survives in metadata.
      paymentMethod: 'cod',
      paymentMethodTitle: 'Plata ramburs (FAN Courier)',
      currency: 'RON',
      total: 189.9,
      providerCreatedAt: '2026-10-13T04:30:00.000Z',
      providerUpdatedAt: '2026-10-13T07:45:00.000Z',
      metadata: { is_cod: true, payment_method: 'ramburs_fan', customer_country: 'RO' },
    })
    expect(order.items).toEqual([
      { externalId: 'li_1', productExternalId: 'p_1', sku: 'TS-M', name: 'Tricou bumbac (M)', quantity: 1, unitPrice: 89.9, total: 89.9 },
      { externalId: 'li_2', productExternalId: 'p_2', sku: 'SO', name: 'Șosete sport', quantity: 2, unitPrice: 50, total: 100 },
    ])
    expect(order.payloadHash).toBe(crypto.createHash('sha256').update(JSON.stringify(sortDeep(ORDER_1001))).digest('hex'))
    // The hash depends on the content, not on the key order of the merchant's JSON.
    expect(payloadHashOf({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(payloadHashOf({ a: [{ c: 3, d: 2 }], b: 1 }))
  })
  it('keeps the merchant payment method unless is_cod=true overrides it', () => {
    // is_cod=false or absent: the method id/title pass through untouched (the core's heuristics and the merchant's COD list decide).
    expect(normalizeCustomOrder({ ...ORDER_1001, is_cod: false, payment_method: 'card_online', payment_method_title: 'Card online' })).toMatchObject({ paymentMethod: 'card_online', paymentMethodTitle: 'Card online', metadata: { is_cod: false, payment_method: 'card_online' } })
    const { is_cod: _unused, ...withoutFlag } = ORDER_1001
    void _unused
    expect(normalizeCustomOrder(withoutFlag)).toMatchObject({ paymentMethod: 'ramburs_fan', metadata: { is_cod: null, payment_method: 'ramburs_fan' } })
    // is_cod=true without any method id: "cod" is synthesized, nothing else is invented.
    expect(normalizeCustomOrder({ ...withoutFlag, is_cod: true, payment_method: '', payment_method_title: null })).toMatchObject({ paymentMethod: 'cod', paymentMethodTitle: null, metadata: { is_cod: true, payment_method: null } })
    expect(normalizeCustomOrder({ ...ORDER_1001, is_cod: 'yes' })).toBeNull()
  })
  it('is lenient on optional fields and strict on required ones', () => {
    const minimal = normalizeCustomOrder({ id: 42, created_at: '2026-10-13T07:30:00Z', updated_at: '2026-10-13T07:30:00Z', status: 'pending', currency: 'eur', total: 10, is_cod: true })
    expect(minimal).toMatchObject({ externalId: '42', orderNumber: '42', financialStatus: 'unknown', fulfillmentStatus: 'unknown', paymentMethod: 'cod', paymentMethodTitle: null, currency: 'EUR', total: 10, items: [], contactPhoneRaw: null, shippingCountry: null })
    expect(normalizeCustomOrder({ ...ORDER_1001, id: 'has space' })).toBeNull()
    expect(normalizeCustomOrder({ ...ORDER_1001, status: 'shipped' })).toBeNull()
    expect(normalizeCustomOrder({ ...ORDER_1001, updated_at: 'yesterday' })).toBeNull()
    expect(normalizeCustomOrder({ ...ORDER_1001, currency: 'LEUL' })).toBeNull()
    expect(normalizeCustomOrder({ ...ORDER_1001, items: 'none' })).toBeNull()
    expect(normalizeCustomOrder('garbage')).toBeNull()
    expect(CustomOrderSchema.safeParse({ ...ORDER_1001, items: Array.from({ length: 201 }, (_, i) => ({ id: `li_${i}`, name: 'x' })) }).success).toBe(false)
  })
})

describe('syncPage', () => {
  it('reads one page of orders with the contract cursor and reports done on the last page', async () => {
    const pages: Record<string, unknown> = {
      first: { items: [ORDER_1001, { ...ORDER_1001, id: 'ord_1002', number: '1002' }], next_cursor: 'c2' },
      c2: { items: [{ ...ORDER_1001, id: 'ord_1003', number: '1003' }], next_cursor: null },
    }
    const { adapter, fetchImpl } = adapterWith({ 'GET /ntv/orders': (url) => jsonResponse(pages[url.searchParams.get('cursor') ?? 'first']) })
    const { log, calls } = fakeLogger()
    const first = await adapter.syncPage(connection(), 'orders', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', log)
    expect(first.orders?.map((o) => o.externalId)).toEqual(['ord_1001', 'ord_1002'])
    expect(first).toMatchObject({ resource: 'orders', done: false, checkpoint: { cursor: 'c2', modifiedAfter: null, pages: 1 } })
    const url1 = new URL(String(fetchImpl.mock.calls[0][0]))
    expect(url1.pathname).toBe('/ntv/orders')
    expect(url1.searchParams.get('limit')).toBe(String(CUSTOM_PAGE_SIZE))
    expect(url1.searchParams.has('cursor')).toBe(false)
    expect(url1.searchParams.has('modified_after')).toBe(false)

    const second = await adapter.syncPage(connection(), 'orders', first.checkpoint, 'initial', log)
    expect(second.orders?.map((o) => o.externalId)).toEqual(['ord_1003'])
    expect(second).toMatchObject({ done: true, checkpoint: { cursor: null, pages: 2 } })
    expect(new URL(String(fetchImpl.mock.calls[1][0])).searchParams.get('cursor')).toBe('c2')
    expectNoSecret(calls)
    expect(calls).toContainEqual(expect.objectContaining({ event: 'custom.sync.page', fields: expect.objectContaining({ resource: 'orders', count: 1, skipped: 0, done: true }) }))
  })

  it('sends modified_after on every page of an incremental sync and never on an initial one', async () => {
    const { adapter, fetchImpl } = adapterWith({ 'GET /ntv/customers': () => jsonResponse({ items: [CUSTOMER_7], next_cursor: null }) })
    const checkpoint = { cursor: 'c5', modifiedAfter: '2026-10-12T22:00:00+02:00', pages: 3 }
    const batch = await adapter.syncPage(connection(), 'customers', checkpoint, 'incremental', fakeLogger().log)
    const url = new URL(String(fetchImpl.mock.calls[0][0]))
    expect(url.searchParams.get('modified_after')).toBe('2026-10-12T20:00:00.000Z')
    expect(url.searchParams.get('cursor')).toBe('c5')
    expect(batch.checkpoint).toEqual({ cursor: null, modifiedAfter: '2026-10-12T22:00:00+02:00', pages: 4 })
    expect(batch.customers).toEqual([
      expect.objectContaining({ externalId: 'cus_7', email: 'andreea@example.com', firstName: 'Andreea', lastName: 'Popescu', phoneRaw: '+40722123456', countryCode: 'RO', marketingConsent: true, callConsent: null, ordersCount: 3, totalSpent: 640.5, providerCreatedAt: '2026-01-05T10:00:00.000Z', providerUpdatedAt: '2026-10-13T07:45:00.000Z' }),
    ])
    await adapter.syncPage(connection(), 'customers', checkpoint, 'initial', fakeLogger().log)
    expect(new URL(String(fetchImpl.mock.calls[1][0])).searchParams.has('modified_after')).toBe(false)
  })

  it('normalizes products and carts', async () => {
    const { adapter } = adapterWith({
      'GET /ntv/products': () => jsonResponse({ items: [PRODUCT_1, { id: 'p_2', name: 'Fără detalii', updated_at: '2026-10-12T09:00:00Z' }], next_cursor: null }),
      'GET /ntv/carts': () => jsonResponse({ items: [CART_9], next_cursor: null }),
    })
    const products = await adapter.syncPage(connection(), 'products', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', fakeLogger().log)
    expect(products.products).toEqual([
      expect.objectContaining({ externalId: 'p_1', sku: 'TS-M', name: 'Tricou bumbac (M)', status: 'active', price: 89.9, currency: 'RON', stockStatus: 'in_stock', stockQuantity: 12, url: 'https://shop.example.ro/p/tricou-m', providerUpdatedAt: '2026-10-12T09:00:00.000Z' }),
      expect.objectContaining({ externalId: 'p_2', sku: null, status: 'unknown', price: null, stockStatus: 'unknown', stockQuantity: null, url: null }),
    ])
    const carts = await adapter.syncPage(connection(), 'carts', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', fakeLogger().log)
    expect(carts.carts).toEqual([
      expect.objectContaining({ externalId: 'cart_9', customerExternalId: 'cus_7', contactName: 'Andreea Popescu', contactPhoneRaw: '0722 123 456', contactEmail: 'andreea@example.com', status: 'abandoned', currency: 'RON', total: 89.9, items: [{ name: 'Tricou bumbac (M)', quantity: 1 }], abandonedAt: '2026-10-13T07:00:00.000Z', recoveredOrderExternalId: null, metadata: expect.objectContaining({ country: 'RO' }) }),
    ])
    expect(carts.done).toBe(true)
  })

  it('skips records that break the contract, logs the field path only, and refuses a page that violates the limits', async () => {
    const { adapter } = adapterWith({ 'GET /ntv/orders': () => jsonResponse({ items: [ORDER_1001, { ...ORDER_1001, id: 'ord_bad', total: 'gratis-' + TOKEN }], next_cursor: null }) })
    const { log, calls } = fakeLogger()
    const batch = await adapter.syncPage(connection(), 'orders', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', log)
    expect(batch.orders?.map((o) => o.externalId)).toEqual(['ord_1001'])
    const warn = calls.find((c) => (c as { event: string }).event === 'custom.sync.page_with_invalid_records') as { fields: Record<string, unknown> }
    expect(warn.fields).toMatchObject({ skipped: 1, count: 2, firstIssue: expect.stringContaining('total') })
    expectNoSecret(calls)

    const tooMany = adapterWith({ 'GET /ntv/orders': () => jsonResponse({ items: Array.from({ length: 101 }, (_, i) => ({ ...ORDER_1001, id: `o${i}` })), next_cursor: null }) }).adapter
    expect((await failure(tooMany.syncPage(connection(), 'orders', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', log))).code).toBe('invalid_response')

    const stuck = adapterWith({ 'GET /ntv/orders': () => jsonResponse({ items: [], next_cursor: 'c2' }) }).adapter
    const err = await failure(stuck.syncPage(connection(), 'orders', { cursor: 'c2', modifiedAfter: null, pages: 1 }, 'initial', log))
    expect(err.code).toBe('invalid_response')
    expect(err.message).toContain('did not advance')
  })

  it('maps list failures to connection errors and skips resources the API does not expose', async () => {
    const { adapter, fetchImpl } = adapterWith({ 'GET /ntv/orders': () => jsonResponse({ error: 'expired' }, 401) })
    const { log } = fakeLogger()
    const err = await failure(adapter.syncPage(connection(), 'orders', { cursor: null, modifiedAfter: null, pages: 0 }, 'initial', log))
    expect(err.code).toBe('unauthorized')
    expectCleanError(err)

    const caps = { ...connection().capabilities, products: false, abandoned_carts: false }
    const products = await adapter.syncPage(connection({ capabilities: caps }), 'products', { cursor: 'x', modifiedAfter: null, pages: 2 }, 'initial', log)
    expect(products).toEqual({ resource: 'products', products: [], checkpoint: { cursor: null, modifiedAfter: null, pages: 2 }, done: true })
    const carts = await adapter.syncPage(connection({ capabilities: caps }), 'carts', { cursor: null, modifiedAfter: null, pages: 0 }, 'incremental', log)
    expect(carts).toMatchObject({ resource: 'carts', carts: [], done: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('verifyWebhook', () => {
  const { adapter } = adapterWith({})
  const body = JSON.stringify({ data: ORDER_1001 })

  it('accepts a delivery signed over the exact bytes and reads the event id, topic and resource id', async () => {
    const result = await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body)), connection())
    expect(result).toEqual({ ok: true, topic: 'order.created', deliveryId: 'evt_001', externalResourceId: 'ord_1001', payload: { data: expect.objectContaining({ id: 'ord_1001' }) } })
  })

  it('rejects a signature computed over a different serialization of the same JSON', async () => {
    const pretty = JSON.stringify({ data: ORDER_1001 }, null, 2)
    expect(JSON.parse(pretty)).toEqual(JSON.parse(body))
    const result = await adapter.verifyWebhook(rawRequest(pretty, deliveryHeaders(body)), connection())
    expect(result).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    // Same JSON value with `id` serialized last: different bytes, so the signature must not match.
    const { id, ...rest } = ORDER_1001
    const reordered = JSON.stringify({ data: { ...rest, id } })
    expect(reordered).not.toBe(body)
    expect(JSON.parse(reordered)).toEqual(JSON.parse(body))
    expect(await adapter.verifyWebhook(rawRequest(reordered, deliveryHeaders(body)), connection())).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
  })

  it('rejects a missing, malformed, wrong-secret or tampered signature', async () => {
    const conn = connection()
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-signature': '' })), conn)).toEqual({ ok: false, reason: 'missing_signature', status: 401 })
    const noHeader = deliveryHeaders(body)
    delete (noHeader as Record<string, string>)['x-ntv-signature']
    expect(await adapter.verifyWebhook(rawRequest(body, noHeader), conn)).toEqual({ ok: false, reason: 'missing_signature', status: 401 })
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-signature': 'md5=abc' })), conn)).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-signature': 'sha256=' + 'ab'.repeat(16) })), conn)).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-signature': sign(body, 'another-secret-of-sixteen-chars') })), conn)).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    expect(await adapter.verifyWebhook(rawRequest(body.replace('189.90', '1.00'), deliveryHeaders(body)), conn)).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    // Upper-case hex is the same signature.
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-signature': sign(body).toUpperCase().replace('SHA256', 'sha256') })), conn)).toMatchObject({ ok: true })
  })

  it('answers not_supported without a webhook secret and never throws', async () => {
    const noSecret = connection({ secrets: { auth_scheme: 'bearer', auth_token: TOKEN } })
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body)), noSecret)).toEqual({ ok: false, reason: 'not_supported', status: 400 })
    const broken = connection({ secrets: { auth_scheme: 'bearer' } })
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body)), broken)).toEqual({ ok: false, reason: 'not_supported', status: 400 })
    expect(await adapter.verifyWebhook({ headers: new Headers(), rawBody: new Uint8Array(), url: new URL(WEBHOOK_URL) }, connection())).toEqual({ ok: false, reason: 'missing_signature', status: 401 })
  })

  it('limits replays with the timestamp window', async () => {
    const conn = connection()
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-timestamp': String(NOW_S - 301) })), conn)).toEqual({ ok: false, reason: 'malformed', status: 400 })
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-timestamp': String(NOW_S + 301) })), conn)).toEqual({ ok: false, reason: 'malformed', status: 400 })
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-timestamp': String(NOW_S + 299) })), conn)).toMatchObject({ ok: true })
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-timestamp': '' })), conn)).toEqual({ ok: false, reason: 'malformed', status: 400 })
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-timestamp': '2026-10-13T08:00:00Z' })), conn)).toEqual({ ok: false, reason: 'malformed', status: 400 })
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-timestamp': String(NOW_MS) })), conn)).toEqual({ ok: false, reason: 'malformed', status: 400 })
  })

  it('rejects unknown topics and bodies that are not { data: object }', async () => {
    const conn = connection()
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-topic': 'orders/create' })), conn)).toEqual({ ok: false, reason: 'unknown_topic', status: 400 })
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-topic': '' })), conn)).toEqual({ ok: false, reason: 'unknown_topic', status: 400 })
    const text = 'not json'
    expect(await adapter.verifyWebhook(rawRequest(text, deliveryHeaders(text)), conn)).toEqual({ ok: false, reason: 'malformed', status: 400 })
    const list = JSON.stringify([ORDER_1001])
    expect(await adapter.verifyWebhook(rawRequest(list, deliveryHeaders(list)), conn)).toEqual({ ok: false, reason: 'malformed', status: 400 })
    const bare = JSON.stringify(ORDER_1001)
    expect(await adapter.verifyWebhook(rawRequest(bare, deliveryHeaders(bare)), conn)).toEqual({ ok: false, reason: 'malformed', status: 400 })
  })

  it('rejects a signed record that does not follow the topic contract, so the merchant gets a 400 instead of a silently ignored event', async () => {
    const conn = connection()
    const noId = JSON.stringify({ data: { number: '1' } })
    expect(await adapter.verifyWebhook(rawRequest(noId, deliveryHeaders(noId)), conn)).toEqual({ ok: false, reason: 'malformed', status: 400 })
    const badStatus = JSON.stringify({ data: { ...ORDER_1001, status: 'shipped' } })
    expect(await adapter.verifyWebhook(rawRequest(badStatus, deliveryHeaders(badStatus)), conn)).toEqual({ ok: false, reason: 'malformed', status: 400 })
    // The record shape follows the topic: an order sent as cart.updated is not a cart.
    expect(await adapter.verifyWebhook(rawRequest(body, deliveryHeaders(body, { 'x-ntv-topic': 'cart.updated' })), conn)).toEqual({ ok: false, reason: 'malformed', status: 400 })
    const cart = JSON.stringify({ data: CART_9 })
    expect(await adapter.verifyWebhook(rawRequest(cart, deliveryHeaders(cart, { 'x-ntv-topic': 'Cart.Updated' })), conn)).toMatchObject({ ok: true, topic: 'cart.updated', externalResourceId: 'cart_9' })
    // An unusable event id is dropped (the route then dedupes on the body hash); an integer id is stringified.
    const intId = JSON.stringify({ data: { ...ORDER_1001, id: 42 } })
    expect(await adapter.verifyWebhook(rawRequest(intId, deliveryHeaders(intId, { 'x-ntv-event-id': 'bad id!' })), conn)).toMatchObject({ ok: true, deliveryId: null, externalResourceId: '42' })
  })

  it('checks the signature before anything else, so the timestamp window is not an unauthenticated oracle', async () => {
    const stale = deliveryHeaders(body, { 'x-ntv-timestamp': String(NOW_S - 9999), 'x-ntv-topic': 'nope', 'x-ntv-signature': sign(body, 'another-secret-of-sixteen-chars') })
    expect(await adapter.verifyWebhook(rawRequest(body, stale), connection())).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    // The HMAC runs over the bytes as received: a signature over the decoded text of a body with a BOM does not match.
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(body)])
    expect(await adapter.verifyWebhook({ headers: new Headers(deliveryHeaders(body)), rawBody: bom, url: new URL(WEBHOOK_URL) }, connection())).toEqual({ ok: false, reason: 'bad_signature', status: 401 })
    expect(await adapter.verifyWebhook({ headers: new Headers(deliveryHeaders(body, { 'x-ntv-signature': sign(bom) })), rawBody: bom, url: new URL(WEBHOOK_URL) }, connection())).toMatchObject({ ok: true, externalResourceId: 'ord_1001' })
  })
})

describe('normalizeEvent', () => {
  const { adapter } = adapterWith({})
  const event = (topic: string, data: unknown): VerifiedCommerceEvent => ({ ok: true, topic, deliveryId: 'evt', externalResourceId: null, payload: { data } })

  it('maps every topic through the record normalizers', () => {
    expect(adapter.normalizeEvent(event('order.created', ORDER_1001), connection())).toEqual([{ kind: 'order.created', order: expect.objectContaining({ externalId: 'ord_1001', contactPhoneRaw: '0722 123 456' }) }])
    expect(adapter.normalizeEvent(event('order.updated', ORDER_1001), connection())).toEqual([{ kind: 'order.updated', order: expect.objectContaining({ externalId: 'ord_1001' }) }])
    expect(adapter.normalizeEvent(event('product.updated', PRODUCT_1), connection())).toEqual([{ kind: 'product.updated', product: expect.objectContaining({ externalId: 'p_1' }) }])
    expect(adapter.normalizeEvent(event('customer.updated', CUSTOMER_7), connection())).toEqual([{ kind: 'customer.updated', customer: expect.objectContaining({ externalId: 'cus_7' }) }])
    expect(adapter.normalizeEvent(event('cart.updated', CART_9), connection())).toEqual([{ kind: 'cart.updated', cart: expect.objectContaining({ externalId: 'cart_9', status: 'abandoned' }) }])
  })
  it('ignores malformed data and topics it does not know', () => {
    expect(adapter.normalizeEvent(event('order.created', { id: 'x' }), connection())).toEqual([{ kind: 'ignored', reason: 'malformed_payload:order' }])
    expect(adapter.normalizeEvent(event('cart.updated', { ...CART_9, status: 'lost' }), connection())).toEqual([{ kind: 'ignored', reason: 'malformed_payload:cart' }])
    expect(adapter.normalizeEvent({ ...event('order.deleted', ORDER_1001), payload: null }, connection())).toEqual([{ kind: 'ignored', reason: 'unhandled_topic:order.deleted' }])
  })
})

describe('webhook registration and single reads', () => {
  it('cannot register anything: it keeps manual registrations and needs a webhook URL', async () => {
    const { adapter, fetchImpl } = adapterWith({})
    const { log, calls } = fakeLogger()
    expect(await adapter.registerWebhooks(connection(), log)).toEqual([])
    const manual = [{ topic: 'cart.updated', externalId: 'merchant', source: 'manual' as const }]
    expect(await adapter.registerWebhooks(connection({ webhookRegistrations: [...manual, { topic: 'order.created', externalId: '9', source: 'api' }] }), log)).toEqual(manual)
    const err = await failure(adapter.registerWebhooks(connection({ webhookUrl: null }), log))
    expect(err.code).toBe('not_configured')
    await adapter.unregisterWebhooks(connection(), log)
    expect(fetchImpl).not.toHaveBeenCalled()
    expectNoSecret(calls)
  })

  it('reads one record through the optional /{resource}/{id} endpoint and treats 404/501 as absent', async () => {
    const { adapter, fetchImpl } = adapterWith({
      'GET /ntv/orders/ord_1001': () => jsonResponse({ item: ORDER_1001 }),
      'GET /ntv/products/p_1': () => jsonResponse({ error: 'not implemented' }, 501),
      'GET /ntv/customers/cus_7': () => jsonResponse(CUSTOMER_7),
    })
    const { log } = fakeLogger()
    expect(await adapter.fetchOrder(connection(), 'ord_1001', log)).toMatchObject({ externalId: 'ord_1001', total: 189.9 })
    expect(await adapter.fetchOrder(connection(), 'ord_missing', log)).toBeNull()
    expect(await adapter.fetchProduct(connection(), 'p_1', log)).toBeNull()
    expect((await failure(adapter.fetchCustomer(connection(), 'cus_7', log))).code).toBe('invalid_response')
    // Ids that would change the route never reach the wire: a slash, a query, or the dot segments the URL parser folds away.
    for (const id of ['../health', '..', '.', 'x?y', 'x#y', 'a b', '']) expect(await adapter.fetchOrder(connection(), id, log)).toBeNull()
    expect(fetchImpl.mock.calls.map((c) => new URL(String(c[0])).pathname)).toEqual(['/ntv/orders/ord_1001', '/ntv/orders/ord_missing', '/ntv/products/p_1', '/ntv/customers/cus_7'])
    // A resource /health did not expose is never requested either.
    expect(await adapter.fetchProduct(connection({ capabilities: { ...connection().capabilities, products: false } }), 'p_1', log)).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(await adapter.fetchOrder(connection(), 'a..b', log)).toBeNull()
    expect(new URL(String(fetchImpl.mock.calls[4][0])).pathname).toBe('/ntv/orders/a..b')
  })

  it('reports stored capabilities without I/O and derives the polling cadence', () => {
    const { adapter, fetchImpl } = adapterWith({})
    const stored = connection().capabilities
    expect(adapter.getCapabilities({ capabilities: stored, webhookRegistrations: [] })).toEqual(stored)
    expect(adapter.getCapabilities({ capabilities: { ...stored, webhooks: false, polling_minutes: null }, webhookRegistrations: [] })).toMatchObject({ webhooks: false, polling_minutes: CUSTOM_POLLING_MINUTES })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = sortDeep((value as Record<string, unknown>)[key])
    return out
  }
  return value
}
