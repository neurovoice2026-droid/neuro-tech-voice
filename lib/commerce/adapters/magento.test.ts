import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { Logger } from '@/lib/observability/logger'
import type { CommerceCapabilities } from '../types'
import { ConnectionError, type AdapterConnection, type VerifiedCommerceEvent } from './types'
import {
  MAGENTO_API_VERSION,
  MAGENTO_INCREMENTAL_OVERLAP_MS,
  MAGENTO_PAGE_SIZE,
  MAGENTO_POLLING_MINUTES,
  MagentoSecretsSchema,
  NOTE_NO_CARTS,
  NOTE_NO_CUSTOMERS,
  NOTE_NO_LIST_STOCK,
  NOTE_NO_PRODUCTS,
  NOTE_NO_STORE_CONFIG,
  NOTE_NO_WEBHOOKS,
  canonicalStoreUrl,
  createMagentoAdapter,
  isMagentoCodPayment,
  isoFromMagento,
  magentoAdapter,
  magentoDateTime,
  magentoOAuthHeader,
  normalizeMagentoCustomer,
  normalizeMagentoOrder,
  normalizeMagentoProduct,
  searchQuery,
} from './magento'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TOKEN = 'k7m2p9q4r1s8t5u3v6w0x2y4z7a1b3c5'
const CONSUMER_KEY = 'ck1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o'
const CONSUMER_SECRET = 'cs9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l'
const TOKEN_SECRET = 'ts5f4e3d2c1b0a9z8y7x6w5v4u3t2s1r'
const NONCE = 'n0123456789abcdef0123456789abcde'
const TIMESTAMP = 1_760_000_000
const SECRET_VALUES = [TOKEN, CONSUMER_SECRET, TOKEN_SECRET]
const STORE = 'https://shop.example.ro'
const WEBHOOK_URL = 'https://app.example.com/api/commerce/webhooks/conn-1/abc'
const publicLookup = async () => ['93.184.216.34']

function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function textRes(body: string, status = 200, contentType = 'text/plain'): Response {
  return new Response(body, { status, headers: { 'content-type': contentType } })
}

/** The documented 401 body of an unknown token or a missing ACL resource. */
function unauthorized(resources: string): Response {
  return jsonRes({ message: "The consumer isn't authorized to access %resources.", parameters: { resources } }, 401)
}

type Handler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>

/** A fetch whose routes are keyed by "METHOD /path" (query string ignored); unknown routes answer like Magento's router. */
function storeFetch(routes: Record<string, Handler>) {
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = (init?.method ?? 'GET').toUpperCase()
    const handler = routes[`${method} ${url.pathname}`]
    if (!handler) return jsonRes({ message: 'Request does not match any route.' }, 404)
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

const STORE_CONFIG = {
  id: 1,
  code: 'default',
  website_id: 1,
  locale: 'ro_RO',
  base_currency_code: 'RON',
  default_display_currency_code: 'RON',
  timezone: 'Europe/Bucharest',
  weight_unit: 'kgs',
  base_url: 'https://shop.example.ro/',
  base_link_url: 'https://shop.example.ro/',
  base_static_url: 'https://shop.example.ro/static/version1/',
  base_media_url: 'https://shop.example.ro/media/',
  secure_base_url: 'https://shop.example.ro/',
}

const ORDER_42 = {
  entity_id: 42,
  increment_id: '000001042',
  state: 'new',
  status: 'pending',
  grand_total: 159.9,
  base_grand_total: 159.9,
  total_paid: null,
  total_refunded: null,
  total_due: 159.9,
  order_currency_code: 'RON',
  created_at: '2026-03-01 10:20:30',
  updated_at: '2026-03-02 08:00:00',
  customer_id: 7,
  customer_is_guest: 0,
  customer_email: 'ana@example.com',
  customer_firstname: 'Ana',
  customer_lastname: 'Pop',
  shipping_description: 'Flat Rate - Fixed',
  billing_address: { entity_id: 84, address_type: 'billing', firstname: 'Ana', lastname: 'Pop', street: ['Str. Lungă 1'], city: 'Cluj-Napoca', country_id: 'RO', postcode: '400001', telephone: '0722 123 456', email: 'ana@example.com' },
  payment: { method: 'cashondelivery', additional_information: ['Plata ramburs', ''], amount_ordered: 159.9 },
  items: [
    { item_id: 1, parent_item_id: null, product_id: 11, product_type: 'configurable', sku: 'TR-M', name: 'Tricou', qty_ordered: 1, qty_shipped: 0, qty_canceled: 0, price: 60, row_total: 60 },
    { item_id: 2, parent_item_id: 1, product_id: 13, product_type: 'simple', sku: 'TR-M', name: 'Tricou-M', qty_ordered: 1, qty_shipped: 0, price: 0, row_total: 0 },
    { item_id: 3, parent_item_id: null, product_id: 12, product_type: 'simple', sku: 'CANA-01', name: 'Cană', qty_ordered: 2, qty_shipped: 0, qty_canceled: 0, price: 49.95, row_total: 99.9 },
  ],
  extension_attributes: {
    shipping_assignments: [
      {
        shipping: {
          address: { entity_id: 83, address_type: 'shipping', firstname: 'Ana', lastname: 'Pop', street: ['Str. Scurtă 2', 'ap. 3'], city: 'Cluj-Napoca', country_id: 'RO', postcode: '400002', telephone: '+40 733 000 111' },
          method: 'flatrate_flatrate',
        },
        items: [],
      },
    ],
  },
}

const PRODUCT_5 = {
  id: 5,
  sku: 'CANA-01',
  name: 'Cană',
  attribute_set_id: 4,
  price: 49.95,
  status: 1,
  visibility: 4,
  type_id: 'simple',
  created_at: '2025-01-01 00:00:00',
  updated_at: '2026-03-02 08:00:00',
  extension_attributes: { website_ids: [1], category_links: [] },
  custom_attributes: [{ attribute_code: 'url_key', value: 'cana' }],
}

const PRODUCT_5_WITH_STOCK = {
  ...PRODUCT_5,
  extension_attributes: { website_ids: [1], stock_item: { item_id: 5, product_id: 5, stock_id: 1, qty: 3, is_in_stock: true, manage_stock: true, use_config_manage_stock: true, backorders: 0 } },
}

const CUSTOMER_7 = {
  id: 7,
  group_id: 1,
  default_billing: '9',
  default_shipping: '10',
  created_at: '2025-01-01 00:00:00',
  updated_at: '2026-02-01 00:00:00',
  email: 'ana@example.com',
  firstname: 'Ana',
  lastname: 'Pop',
  store_id: 1,
  website_id: 1,
  addresses: [
    { id: 10, customer_id: 7, country_id: 'RO', street: ['Str. Scurtă 2'], telephone: '+40 733 000 111', city: 'Cluj-Napoca', firstname: 'Ana', lastname: 'Pop', default_shipping: true },
    { id: 9, customer_id: 7, country_id: 'RO', street: ['Str. Lungă 1'], telephone: '0722123456', city: 'Cluj-Napoca', firstname: 'Ana', lastname: 'Pop', default_billing: true },
  ],
  extension_attributes: { is_subscribed: false },
}

const healthyRoutes: Record<string, Handler> = {
  'GET /rest/V1/store/storeConfigs': () => jsonRes([STORE_CONFIG]),
  'GET /rest/V1/store/storeViews': () =>
    jsonRes([
      { id: 0, code: 'admin', name: 'Admin', website_id: 0, store_group_id: 0, is_active: 1 },
      { id: 1, code: 'default', name: 'Magazinul Meu', website_id: 1, store_group_id: 1, is_active: 1 },
    ]),
  'GET /rest/V1/orders': () => jsonRes({ items: [ORDER_42], search_criteria: { page_size: 1, current_page: 1 }, total_count: 1 }),
  'GET /rest/V1/products': () => jsonRes({ items: [PRODUCT_5_WITH_STOCK], search_criteria: {}, total_count: 1 }),
  'GET /rest/V1/customers/search': () => jsonRes({ items: [CUSTOMER_7], search_criteria: {}, total_count: 1 }),
  'GET /magento_version': () => textRes('Magento/2.4 (Community)'),
}

const OAUTH_SECRETS = { access_token: TOKEN, consumer_key: CONSUMER_KEY, consumer_secret: CONSUMER_SECRET, access_token_secret: TOKEN_SECRET }

function connection(overrides: Partial<AdapterConnection> = {}): AdapterConnection {
  const capabilities: CommerceCapabilities = {
    products: true,
    customers: true,
    orders: true,
    webhooks: false,
    abandoned_carts: false,
    customer_phone: true,
    polling_minutes: MAGENTO_POLLING_MINUTES,
    notes: [NOTE_NO_WEBHOOKS, NOTE_NO_CARTS],
  }
  return {
    id: 'conn-1',
    orgId: 'org-1',
    platform: 'magento',
    storeUrl: STORE,
    storeDomain: 'shop.example.ro',
    secrets: { access_token: TOKEN },
    capabilities,
    webhookRegistrations: [],
    webhookUrl: WEBHOOK_URL,
    ...overrides,
  }
}

function rawRequest(body: string, headers: Record<string, string>) {
  return { headers: new Headers(headers), rawBody: new TextEncoder().encode(body), url: new URL(WEBHOOK_URL) }
}

function adapterWith(routes: Record<string, Handler>, extra: { nonce?: () => string; now?: () => number } = {}) {
  const fetchImpl = storeFetch(routes)
  const adapter = createMagentoAdapter({ fetchImpl, lookup: publicLookup, ...extra })
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

/** The Authorization header of a mocked fetch call, as a map of OAuth parameters (values rawurldecoded like Magento does). */
function oauthParamsOf(call: Parameters<typeof fetch>): Record<string, string> {
  const header = new Headers(call[1]?.headers).get('authorization') ?? ''
  expect(header.startsWith('OAuth ')).toBe(true)
  const out: Record<string, string> = {}
  for (const part of header.slice(6).split(', ')) {
    const [name, quoted] = part.split('=')
    out[decodeURIComponent(name)] = decodeURIComponent(quoted.replace(/^"|"$/g, ''))
  }
  return out
}

/** Reference HMAC-SHA256 of a hand-written base string (the test never reuses the adapter's encoder). */
function referenceSignature(baseString: string): string {
  return createHmac('sha256', `${CONSUMER_SECRET}&${TOKEN_SECRET}`).update(baseString).digest('base64')
}

const input = { storeUrl: STORE, secrets: { access_token: TOKEN } }
const EMPTY_CHECKPOINT = { cursor: null, modifiedAfter: null, pages: 0 }

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MagentoSecretsSchema', () => {
  it('accepts a bearer-shaped access token and trims it', () => {
    expect(MagentoSecretsSchema.parse({ access_token: ` ${TOKEN} ` })).toEqual({ access_token: TOKEN })
  })
  it('accepts the four OAuth 1.0a credentials together, treating blank optional fields as absent', () => {
    expect(MagentoSecretsSchema.parse(OAUTH_SECRETS)).toEqual(OAUTH_SECRETS)
    expect(MagentoSecretsSchema.parse({ access_token: TOKEN, consumer_key: '', consumer_secret: '  ', access_token_secret: undefined })).toEqual({ access_token: TOKEN })
  })
  it('rejects short, empty or oddly shaped tokens and an incomplete OAuth set', () => {
    expect(MagentoSecretsSchema.safeParse({ access_token: 'short' }).success).toBe(false)
    expect(MagentoSecretsSchema.safeParse({ access_token: '' }).success).toBe(false)
    expect(MagentoSecretsSchema.safeParse({ access_token: 'has spaces inside the token value' }).success).toBe(false)
    expect(MagentoSecretsSchema.safeParse({}).success).toBe(false)
    expect(MagentoSecretsSchema.safeParse({ access_token: TOKEN, consumer_key: CONSUMER_KEY }).success).toBe(false)
    expect(MagentoSecretsSchema.safeParse({ access_token: TOKEN, consumer_key: CONSUMER_KEY, consumer_secret: CONSUMER_SECRET }).success).toBe(false)
    expect(MagentoSecretsSchema.safeParse({ ...OAUTH_SECRETS, consumer_secret: 'bad secret' }).success).toBe(false)
  })
  it('pins the REST API version, the page size, the overlap and the platform', () => {
    expect(MAGENTO_API_VERSION).toBe('V1')
    expect(MAGENTO_PAGE_SIZE).toBe(100)
    expect(MAGENTO_INCREMENTAL_OVERLAP_MS).toBe(600_000)
    expect(magentoAdapter.platform).toBe('magento')
  })
})

describe('canonicalStoreUrl', () => {
  it('lower-cases the host, strips a pasted REST root, the query and trailing slashes, keeps a sub-directory or index.php', () => {
    expect(canonicalStoreUrl('https://Shop.Example.RO/rest/V1/?x=1')).toEqual({ storeUrl: STORE, storeDomain: 'shop.example.ro' })
    expect(canonicalStoreUrl('https://shop.example.ro/rest/default/V1/').storeUrl).toBe(STORE)
    expect(canonicalStoreUrl('https://shop.example.ro/rest/all/V1/orders').storeUrl).toBe(STORE)
    expect(canonicalStoreUrl('https://shop.example.ro/REST/V1').storeUrl).toBe(STORE)
    expect(canonicalStoreUrl('https://shop.example.ro/index.php/rest/V1').storeUrl).toBe(`${STORE}/index.php`)
    expect(canonicalStoreUrl('https://shop.example.ro/magazin/').storeUrl).toBe(`${STORE}/magazin`)
    expect(canonicalStoreUrl('https://shop.example.ro/restaurant').storeUrl).toBe(`${STORE}/restaurant`)
    expect(canonicalStoreUrl('shop.example.ro').storeUrl).toBe(STORE)
  })
  it('refuses http and embedded credentials', () => {
    expect(() => canonicalStoreUrl('http://shop.example.ro')).toThrow(ConnectionError)
    expect(() => canonicalStoreUrl('https://u:p@shop.example.ro')).toThrow(/credentials/)
    expect(() => canonicalStoreUrl('')).toThrow(ConnectionError)
  })
})

describe('searchQuery and dates', () => {
  it('encodes paging, sorting and ANDed filters in the documented searchCriteria syntax', () => {
    expect(searchQuery({ pageSize: 100, currentPage: 3, sort: { field: 'entity_id', direction: 'ASC' }, filters: [{ field: 'updated_at', value: '2026-03-01 10:00:00', condition: 'gt' }] })).toEqual({
      'searchCriteria[pageSize]': '100',
      'searchCriteria[currentPage]': '3',
      'searchCriteria[sortOrders][0][field]': 'entity_id',
      'searchCriteria[sortOrders][0][direction]': 'ASC',
      'searchCriteria[filter_groups][0][filters][0][field]': 'updated_at',
      'searchCriteria[filter_groups][0][filters][0][value]': '2026-03-01 10:00:00',
      'searchCriteria[filter_groups][0][filters][0][condition_type]': 'gt',
    })
  })
  it('treats Magento timestamps as UTC and formats filters the same way', () => {
    expect(isoFromMagento('2026-03-01 10:20:30')).toBe('2026-03-01T10:20:30.000Z')
    expect(isoFromMagento('2026-03-01T10:20:30+02:00')).toBe('2026-03-01T08:20:30.000Z')
    expect(isoFromMagento('')).toBeNull()
    expect(isoFromMagento('nope')).toBeNull()
    expect(magentoDateTime('2026-03-01T10:00:00.000Z')).toBe('2026-03-01 10:00:00')
    expect(magentoDateTime('2026-03-01T12:00:00+02:00')).toBe('2026-03-01 10:00:00')
    expect(magentoDateTime('garbage')).toBeNull()
  })
})

describe('OAuth 1.0a signing', () => {
  const auth = { consumerKey: CONSUMER_KEY, consumerSecret: CONSUMER_SECRET, token: TOKEN, tokenSecret: TOKEN_SECRET }

  it('signs a request without a query exactly as Magento rebuilds the base string', () => {
    const paramString = `oauth_consumer_key=${CONSUMER_KEY}&oauth_nonce=${NONCE}&oauth_signature_method=HMAC-SHA256&oauth_timestamp=${TIMESTAMP}&oauth_token=${TOKEN}&oauth_version=1.0`
    const baseString = `GET&https%3A%2F%2Fshop.example.ro%2Frest%2FV1%2Fstore%2FstoreConfigs&${encodeURIComponent(paramString)}`
    const signature = referenceSignature(baseString)
    expect(magentoOAuthHeader(auth, 'get', `${STORE}/rest/V1/store/storeConfigs`, [], NONCE, TIMESTAMP)).toBe(
      `OAuth oauth_consumer_key="${CONSUMER_KEY}", oauth_nonce="${NONCE}", oauth_signature_method="HMAC-SHA256", oauth_timestamp="${TIMESTAMP}", oauth_token="${TOKEN}", oauth_version="1.0", oauth_signature="${encodeURIComponent(signature)}"`,
    )
  })

  it('folds the query string pairs into the signed parameters, sorted by key, percent-encoded as rawurlencode does', () => {
    const query = [
      ['searchCriteria[pageSize]', '100'],
      ['searchCriteria[filter_groups][0][filters][0][value]', '2026-03-01 09:50:00'],
      ['searchCriteria[filter_groups][0][filters][0][field]', 'updated_at'],
    ] as const
    // ksort order: oauth_* < searchCriteria[filter_groups]...[field] < ...[value] < searchCriteria[pageSize]; a space is %20, [ ] are %5B %5D.
    const paramString = [
      `oauth_consumer_key=${CONSUMER_KEY}`,
      `oauth_nonce=${NONCE}`,
      'oauth_signature_method=HMAC-SHA256',
      `oauth_timestamp=${TIMESTAMP}`,
      `oauth_token=${TOKEN}`,
      'oauth_version=1.0',
      'searchCriteria%5Bfilter_groups%5D%5B0%5D%5Bfilters%5D%5B0%5D%5Bfield%5D=updated_at',
      'searchCriteria%5Bfilter_groups%5D%5B0%5D%5Bfilters%5D%5B0%5D%5Bvalue%5D=2026-03-01%2009%3A50%3A00',
      'searchCriteria%5BpageSize%5D=100',
    ].join('&')
    const baseString = `GET&https%3A%2F%2Fshop.example.ro%3A8443%2Findex.php%2Frest%2FV1%2Forders&${encodeURIComponent(paramString)}`
    const header = magentoOAuthHeader(auth, 'GET', 'https://shop.example.ro:8443/index.php/rest/V1/orders', query, NONCE, TIMESTAMP)
    expect(header).toContain(`oauth_signature="${encodeURIComponent(referenceSignature(baseString))}"`)
    // The RFC 3986 set: ! ' ( ) * are encoded too (PHP rawurlencode), ~ is not.
    const odd = { ...auth, tokenSecret: "s~!*'()" }
    const oddHeader = magentoOAuthHeader(odd, 'GET', `${STORE}/rest/V1/orders`, [['q', "a b~!*'()"]], NONCE, TIMESTAMP)
    const oddBase = `GET&https%3A%2F%2Fshop.example.ro%2Frest%2FV1%2Forders&${encodeURIComponent(`oauth_consumer_key=${CONSUMER_KEY}&oauth_nonce=${NONCE}&oauth_signature_method=HMAC-SHA256&oauth_timestamp=${TIMESTAMP}&oauth_token=${TOKEN}&oauth_version=1.0&q=a%20b~%21%2A%27%28%29`)}`
    const oddSignature = createHmac('sha256', `${CONSUMER_SECRET}&s~%21%2A%27%28%29`).update(oddBase).digest('base64')
    expect(oddHeader).toContain(`oauth_signature="${encodeURIComponent(oddSignature)}"`)
  })
})

describe('validateConnection', () => {
  it('proves access with the store configs and an orders read, reads store facts and probes the optional resources', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes)
    const { log, calls } = fakeLogger()
    const store = await adapter.validateConnection({ storeUrl: 'https://Shop.Example.RO/rest/V1/', secrets: { access_token: TOKEN } }, log)
    expect(store).toMatchObject({
      storeUrl: STORE,
      storeDomain: 'shop.example.ro',
      displayName: 'Magazinul Meu',
      currency: 'RON',
      countryCode: 'RO',
      timezone: 'Europe/Bucharest',
      language: 'ro-RO',
      platformVersion: 'Magento/2.4 (Community)',
    })
    expect(store.capabilities).toEqual({
      products: true,
      customers: true,
      orders: true,
      webhooks: false,
      abandoned_carts: false,
      customer_phone: true,
      polling_minutes: 15,
      notes: [NOTE_NO_WEBHOOKS, NOTE_NO_CARTS],
    })
    expect(store.secrets).toEqual({ access_token: TOKEN })

    const first = fetchImpl.mock.calls[0]
    expect(String(first[0])).toBe(`${STORE}/rest/V1/store/storeConfigs`)
    const headers = new Headers(first[1]?.headers)
    expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`)
    expect(first[1]).toMatchObject({ method: 'GET', redirect: 'manual' })
    const orders = fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/rest/V1/orders')!
    expect(new URL(String(orders[0])).searchParams.get('searchCriteria[pageSize]')).toBe('1')
    // The public version route gets no credential.
    const version = fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/magento_version')!
    expect(new Headers(version[1]?.headers).get('authorization')).toBeNull()
    // No request ever carries the token in its URL; no log line either.
    for (const call of fetchImpl.mock.calls) expectNoSecret(String(call[0]))
    expectNoSecret(calls)
    expect(store.storeUrl.endsWith('/')).toBe(false)
  })

  it('signs every authenticated request with OAuth 1.0a when the four credentials are given, with a fresh nonce each time', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes, { nonce: () => NONCE, now: () => TIMESTAMP * 1000 })
    const { log, calls } = fakeLogger()
    const store = await adapter.validateConnection({ storeUrl: STORE, secrets: OAUTH_SECRETS }, log)
    expect(store.secrets).toEqual(OAUTH_SECRETS)
    expect(store.capabilities.orders).toBe(true)
    const configs = fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/rest/V1/store/storeConfigs')!
    const params = oauthParamsOf(configs)
    expect(params).toMatchObject({ oauth_consumer_key: CONSUMER_KEY, oauth_nonce: NONCE, oauth_signature_method: 'HMAC-SHA256', oauth_timestamp: String(TIMESTAMP), oauth_token: TOKEN, oauth_version: '1.0' })
    const configBase = `GET&https%3A%2F%2Fshop.example.ro%2Frest%2FV1%2Fstore%2FstoreConfigs&${encodeURIComponent(`oauth_consumer_key=${CONSUMER_KEY}&oauth_nonce=${NONCE}&oauth_signature_method=HMAC-SHA256&oauth_timestamp=${TIMESTAMP}&oauth_token=${TOKEN}&oauth_version=1.0`)}`
    expect(params.oauth_signature).toBe(referenceSignature(configBase))
    // The orders probe signs its query (pageSize, currentPage) too, sorted after the oauth_* keys.
    const orders = fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/rest/V1/orders')!
    expect(String(orders[0])).toBe(`${STORE}/rest/V1/orders?searchCriteria%5BpageSize%5D=1&searchCriteria%5BcurrentPage%5D=1`)
    const ordersBase = `GET&https%3A%2F%2Fshop.example.ro%2Frest%2FV1%2Forders&${encodeURIComponent(`oauth_consumer_key=${CONSUMER_KEY}&oauth_nonce=${NONCE}&oauth_signature_method=HMAC-SHA256&oauth_timestamp=${TIMESTAMP}&oauth_token=${TOKEN}&oauth_version=1.0&searchCriteria%5BcurrentPage%5D=1&searchCriteria%5BpageSize%5D=1`)}`
    expect(oauthParamsOf(orders).oauth_signature).toBe(referenceSignature(ordersBase))
    // The public version route stays anonymous; no URL and no log line carries a secret.
    const version = fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/magento_version')!
    expect(new Headers(version[1]?.headers).get('authorization')).toBeNull()
    for (const call of fetchImpl.mock.calls) expectNoSecret(String(call[0]))
    expectNoSecret(calls)
    expect(calls.find((c) => (c as { event: string }).event === 'magento.validate.ok')).toMatchObject({ fields: expect.objectContaining({ auth: 'oauth' }) })

    // Without a pinned nonce every request gets its own 32-character nonce and the current time.
    const live = adapterWith(healthyRoutes)
    await live.adapter.validateConnection({ storeUrl: STORE, secrets: OAUTH_SECRETS }, fakeLogger().log)
    const nonces = live.fetchImpl.mock.calls.filter((c) => new URL(String(c[0])).pathname !== '/magento_version').map((c) => oauthParamsOf(c).oauth_nonce)
    expect(nonces).toHaveLength(5)
    expect(new Set(nonces).size).toBe(5)
    for (const nonce of nonces) expect(nonce).toMatch(/^[0-9a-f]{32}$/)
    const ts = Number(oauthParamsOf(live.fetchImpl.mock.calls[0]).oauth_timestamp)
    expect(Math.abs(ts - Date.now() / 1000)).toBeLessThan(60)
  })

  it('still connects when the token cannot read the store configuration (or it is empty), noting the missing facts', async () => {
    const { adapter, fetchImpl } = adapterWith({ ...healthyRoutes, 'GET /rest/V1/store/storeConfigs': () => unauthorized('Magento_Backend::store') })
    const { log, calls } = fakeLogger()
    const store = await adapter.validateConnection(input, log)
    expect(store).toMatchObject({ currency: null, timezone: null, language: null, countryCode: null, displayName: null })
    expect(store.capabilities.orders).toBe(true)
    expect(store.capabilities.notes).toEqual([NOTE_NO_STORE_CONFIG, NOTE_NO_WEBHOOKS, NOTE_NO_CARTS])
    expect(fetchImpl.mock.calls.some((c) => new URL(String(c[0])).pathname === '/rest/V1/store/storeViews')).toBe(false)
    expectNoSecret(calls)

    const empty = adapterWith({ ...healthyRoutes, 'GET /rest/V1/store/storeConfigs': () => jsonRes([]) })
    const bare = await empty.adapter.validateConnection(input, fakeLogger().log)
    expect(bare.capabilities.notes).toEqual([NOTE_NO_STORE_CONFIG, NOTE_NO_WEBHOOKS, NOTE_NO_CARTS])
    expect(bare.currency).toBeNull()
  })

  it('maps a refused token to unauthorized without leaking it anywhere', async () => {
    const { adapter } = adapterWith({
      'GET /rest/V1/store/storeConfigs': () => unauthorized('Magento_Backend::store'),
      'GET /rest/V1/orders': () => jsonRes({ message: `The consumer isn't authorized to access %resources. token=${TOKEN}`, parameters: { resources: 'Magento_Sales::actions_view' } }, 401),
    })
    const { log, calls } = fakeLogger()
    const err = await failure(adapter.validateConnection(input, log))
    expect(err.code).toBe('unauthorized')
    expect(err.retryable).toBe(false)
    expect(err.publicMessage).toMatch(/Access Token/)
    expect(err.message).toBe('magento orders.probe: HTTP 401 (Magento_Sales::actions_view)')
    expectNoSecret({ message: err.message, publicMessage: err.publicMessage, stack: err.stack })
    expectNoSecret(calls)
  })

  it('treats a 401 on orders as unauthorized even after a 200 on the store configs (anonymous on some stores), naming every cause', async () => {
    // An invalid token is a guest to Magento; with "Allow Anonymous Guest Access" the configs answer 200 to anyone.
    const { adapter } = adapterWith({ ...healthyRoutes, 'GET /rest/V1/orders': () => unauthorized('Magento_Sales::actions_view') })
    const err = await failure(adapter.validateConnection(input, fakeLogger().log))
    expect(err.code).toBe('unauthorized')
    expect(err.message).toBe('magento orders.probe: HTTP 401 (Magento_Sales::actions_view)')
    expect(err.publicMessage).toMatch(/Sales → Operations → Orders/)
    expect(err.publicMessage).toMatch(/standalone Bearer tokens/)
    expect(err.publicMessage).toMatch(/Consumer Key/)
    // With OAuth credentials the Bearer setting is irrelevant: the message speaks of the signature.
    const signed = adapterWith({ ...healthyRoutes, 'GET /rest/V1/orders': () => unauthorized('Magento_Sales::actions_view') })
    const s = await failure(signed.adapter.validateConnection({ storeUrl: STORE, secrets: OAUTH_SECRETS }, fakeLogger().log))
    expect(s.code).toBe('unauthorized')
    expect(s.publicMessage).toMatch(/OAuth signature/)
    expect(s.publicMessage).not.toMatch(/standalone Bearer/)
    expectNoSecret({ message: s.message, publicMessage: s.publicMessage })
    // A 403 on the store configs alone is tolerated (orders decide); a 403 on orders is forbidden.
    const forbidden = adapterWith({ ...healthyRoutes, 'GET /rest/V1/store/storeConfigs': () => jsonRes({ message: 'no' }, 403), 'GET /rest/V1/orders': () => jsonRes({ message: 'no' }, 403) })
    const f = await failure(forbidden.adapter.validateConnection(input, fakeLogger().log))
    expect(f.code).toBe('forbidden')
    expect(f.message).toBe('magento orders.probe: HTTP 403')
    const tolerated = adapterWith({ ...healthyRoutes, 'GET /rest/V1/store/storeConfigs': () => jsonRes({ message: 'no' }, 403) })
    expect((await tolerated.adapter.validateConnection(input, fakeLogger().log)).capabilities.notes).toContain(NOTE_NO_STORE_CONFIG)
  })

  it('maps 404 and HTML to not_a_store, 429 to rate_limited, 5xx to unreachable, non-JSON 200 to invalid_response', async () => {
    const bare = adapterWith({})
    const notStore = await failure(bare.adapter.validateConnection(input, fakeLogger().log))
    expect(notStore.code).toBe('not_a_store')
    expect(notStore.message).toBe('magento store_configs: HTTP 404')

    const html = adapterWith({ 'GET /rest/V1/store/storeConfigs': () => textRes('<!DOCTYPE html><html><body>Login</body></html>', 200, 'text/html') })
    expect((await failure(html.adapter.validateConnection(input, fakeLogger().log))).code).toBe('not_a_store')

    const limited = adapterWith({ 'GET /rest/V1/store/storeConfigs': () => jsonRes({ message: 'Too Many Requests' }, 429) })
    const rate = await failure(limited.adapter.validateConnection(input, fakeLogger().log))
    expect(rate.code).toBe('rate_limited')
    expect(rate.retryable).toBe(true)

    const down = adapterWith({ 'GET /rest/V1/store/storeConfigs': () => textRes('Bad gateway', 502) })
    const unreachable = await failure(down.adapter.validateConnection(input, fakeLogger().log))
    expect(unreachable.code).toBe('unreachable')
    expect(unreachable.retryable).toBe(true)

    // A maintenance or rate-limit page is HTML too: still a transient, retryable failure, never "not a store".
    const maintenance = adapterWith({ 'GET /rest/V1/store/storeConfigs': () => textRes('<!DOCTYPE html><html><body>Service Unavailable</body></html>', 503, 'text/html') })
    const m = await failure(maintenance.adapter.validateConnection(input, fakeLogger().log))
    expect(m.code).toBe('unreachable')
    expect(m.retryable).toBe(true)
    const challenge = adapterWith({ 'GET /rest/V1/store/storeConfigs': () => textRes('<html><body>Rate limited</body></html>', 429, 'text/html') })
    expect((await failure(challenge.adapter.validateConnection(input, fakeLogger().log))).code).toBe('rate_limited')

    const garbage = adapterWith({ 'GET /rest/V1/store/storeConfigs': () => textRes('ok', 200) })
    expect((await failure(garbage.adapter.validateConnection(input, fakeLogger().log))).code).toBe('invalid_response')
    const notArray = adapterWith({ ...healthyRoutes, 'GET /rest/V1/orders': () => jsonRes({ nope: true }) })
    expect((await failure(notArray.adapter.validateConnection(input, fakeLogger().log))).code).toBe('invalid_response')
  })

  it('maps timeouts, redirects, network failures, http and private hosts', async () => {
    const timeout = createMagentoAdapter({ fetchImpl: vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError') }) as unknown as typeof fetch, lookup: publicLookup })
    const t = await failure(timeout.validateConnection(input, fakeLogger().log))
    expect(t.code).toBe('timeout')
    expect(t.retryable).toBe(true)

    const redirect = createMagentoAdapter({ fetchImpl: vi.fn(async () => new Response(null, { status: 301, headers: { location: 'https://www.shop.example.ro/' } })) as unknown as typeof fetch, lookup: publicLookup })
    const r = await failure(redirect.validateConnection(input, fakeLogger().log))
    expect(r.code).toBe('redirect')
    expect(r.retryable).toBe(false)

    const network = createMagentoAdapter({ fetchImpl: vi.fn(async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch, lookup: publicLookup })
    expect((await failure(network.validateConnection(input, fakeLogger().log))).code).toBe('unreachable')

    const { adapter, fetchImpl } = adapterWith(healthyRoutes)
    expect((await failure(adapter.validateConnection({ ...input, storeUrl: 'http://shop.example.ro' }, fakeLogger().log))).code).toBe('invalid_url')
    expect(fetchImpl).not.toHaveBeenCalled()

    const privateHost = createMagentoAdapter({ fetchImpl, lookup: async () => ['10.0.0.8'] })
    expect((await failure(privateHost.validateConnection(input, fakeLogger().log))).code).toBe('ssrf_blocked')
    expect((await failure(privateHost.validateConnection({ ...input, storeUrl: 'https://169.254.169.254/' }, fakeLogger().log))).code).toBe('ssrf_blocked')
    expect(fetchImpl).not.toHaveBeenCalled()

    const unresolved = createMagentoAdapter({ fetchImpl, lookup: async () => [] })
    expect((await failure(unresolved.validateConnection(input, fakeLogger().log))).code).toBe('unreachable')
  })

  it('rejects malformed or incomplete credentials before any request', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes)
    const err = await failure(adapter.validateConnection({ storeUrl: STORE, secrets: { access_token: 'nope' } }, fakeLogger().log))
    expect(err.code).toBe('unauthorized')
    expectNoSecret({ message: err.message, publicMessage: err.publicMessage })
    const partial = await failure(adapter.validateConnection({ storeUrl: STORE, secrets: { access_token: TOKEN, consumer_key: CONSUMER_KEY } }, fakeLogger().log))
    expect(partial.code).toBe('unauthorized')
    expect(partial.message).toBe('magento secrets: invalid shape')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports products and customers as unavailable when the token lacks their resources, and notes a list without stock', async () => {
    const { adapter } = adapterWith({
      ...healthyRoutes,
      'GET /rest/V1/products': () => unauthorized('Magento_Catalog::products'),
      'GET /rest/V1/customers/search': () => jsonRes({ message: 'forbidden' }, 403),
    })
    const store = await adapter.validateConnection(input, fakeLogger().log)
    expect(store.capabilities).toMatchObject({ orders: true, products: false, customers: false })
    expect(store.capabilities.notes).toEqual([NOTE_NO_PRODUCTS, NOTE_NO_CUSTOMERS, NOTE_NO_WEBHOOKS, NOTE_NO_CARTS])

    const noStock = adapterWith({ ...healthyRoutes, 'GET /rest/V1/products': () => jsonRes({ items: [PRODUCT_5], total_count: 1 }) })
    const listed = await noStock.adapter.validateConnection(input, fakeLogger().log)
    expect(listed.capabilities.products).toBe(true)
    expect(listed.capabilities.notes).toEqual([NOTE_NO_LIST_STOCK, NOTE_NO_WEBHOOKS, NOTE_NO_CARTS])

    // A server error on an optional probe is not silently turned into "unavailable".
    const broken = adapterWith({ ...healthyRoutes, 'GET /rest/V1/customers/search': () => textRes('Bad gateway', 502) })
    expect((await failure(broken.adapter.validateConnection(input, fakeLogger().log))).code).toBe('unreachable')
  })

  it('survives an unavailable version route or store view listing', async () => {
    const { adapter } = adapterWith({
      ...healthyRoutes,
      'GET /magento_version': () => new Response(null, { status: 302, headers: { location: `${STORE}/` } }),
      'GET /rest/V1/store/storeViews': () => unauthorized('Magento_Backend::store'),
    })
    const { log, calls } = fakeLogger()
    const store = await adapter.validateConnection(input, log)
    expect(store.platformVersion).toBeNull()
    expect(store.displayName).toBeNull()
    expect(store.currency).toBe('RON')
    expect(calls.some((c) => (c as { event: string }).event === 'magento.validate.version_unavailable')).toBe(true)
    expect(calls.some((c) => (c as { event: string }).event === 'magento.validate.store_views_unavailable')).toBe(true)
  })
})

describe('getCapabilities', () => {
  it('never reports webhooks or carts and keeps the polling cadence', () => {
    const base = connection()
    expect(magentoAdapter.getCapabilities(base)).toEqual(base.capabilities)
    const tampered = magentoAdapter.getCapabilities({ ...base, capabilities: { ...base.capabilities, webhooks: true, abandoned_carts: true, polling_minutes: null } })
    expect(tampered).toMatchObject({ webhooks: false, abandoned_carts: false, polling_minutes: 15 })
  })
})

describe('syncPage', () => {
  it('reads orders by entity_id keyset (entity_id > cursor, ASC, page 1), normalizes them and stops on a short page', async () => {
    const seen: URL[] = []
    const { adapter } = adapterWith({
      'GET /rest/V1/orders': (url) => {
        seen.push(url)
        const after = url.searchParams.get('searchCriteria[filter_groups][0][filters][0][value]')
        return after === null
          ? jsonRes({ items: Array.from({ length: 100 }, (_, i) => ({ ...ORDER_42, entity_id: 100 + i })), total_count: 101 })
          : jsonRes({ items: [{ ...ORDER_42, entity_id: 242 }, { increment_id: 'no-id' }], total_count: 101 })
      },
    })
    const { log, calls } = fakeLogger()
    const first = await adapter.syncPage(connection(), 'orders', EMPTY_CHECKPOINT, 'initial', log)
    expect(seen[0].searchParams.get('searchCriteria[pageSize]')).toBe('100')
    expect(seen[0].searchParams.get('searchCriteria[currentPage]')).toBe('1')
    expect(seen[0].searchParams.get('searchCriteria[sortOrders][0][field]')).toBe('entity_id')
    expect(seen[0].searchParams.get('searchCriteria[sortOrders][0][direction]')).toBe('ASC')
    expect([...seen[0].searchParams.keys()].some((k) => k.includes('filter_groups'))).toBe(false)
    expect(first.done).toBe(false)
    expect(first.checkpoint).toEqual({ cursor: '199', modifiedAfter: null, pages: 1 })
    expect(first.orders).toHaveLength(100)

    const second = await adapter.syncPage(connection(), 'orders', first.checkpoint, 'initial', log)
    expect(seen[1].searchParams.get('searchCriteria[currentPage]')).toBe('1')
    expect(seen[1].searchParams.get('searchCriteria[filter_groups][0][filters][0][field]')).toBe('entity_id')
    expect(seen[1].searchParams.get('searchCriteria[filter_groups][0][filters][0][value]')).toBe('199')
    expect(seen[1].searchParams.get('searchCriteria[filter_groups][0][filters][0][condition_type]')).toBe('gt')
    expect(second.done).toBe(true)
    expect(second.checkpoint).toEqual({ cursor: null, modifiedAfter: null, pages: 2 })
    expect(second.orders).toHaveLength(1)
    const order = second.orders![0]
    expect(order).toMatchObject({
      externalId: '242',
      orderNumber: '000001042',
      customerExternalId: '7',
      contactName: 'Ana Pop',
      contactPhoneRaw: '+40 733 000 111',
      contactEmail: 'ana@example.com',
      shippingCity: 'Cluj-Napoca',
      shippingCountry: 'RO',
      shippingSummary: 'Str. Scurtă 2, ap. 3, Cluj-Napoca',
      status: 'pending',
      financialStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      paymentMethod: 'cashondelivery',
      paymentMethodTitle: 'Plata ramburs',
      currency: 'RON',
      total: 159.9,
      providerCreatedAt: '2026-03-01T10:20:30.000Z',
      providerUpdatedAt: '2026-03-02T08:00:00.000Z',
    })
    expect(order.metadata).toMatchObject({ provider_state: 'new', provider_status: 'pending', customer_is_guest: false, shipping_method: 'flatrate_flatrate', cod_hint: true })
    // Only the top-level rows: the configurable parent (with the variant SKU and price) and the simple product.
    expect(order.items).toEqual([
      { externalId: '1', productExternalId: '11', sku: 'TR-M', name: 'Tricou', quantity: 1, unitPrice: 60, total: 60 },
      { externalId: '3', productExternalId: '12', sku: 'CANA-01', name: 'Cană', quantity: 2, unitPrice: 49.95, total: 99.9 },
    ])
    expect(order.payloadHash).toMatch(/^[0-9a-f]{64}$/)
    // The hash ignores key order and changes with the content.
    const reference = normalizeMagentoOrder(ORDER_42)!
    const reordered = Object.fromEntries(Object.entries(ORDER_42).reverse())
    expect(normalizeMagentoOrder(reordered)?.payloadHash).toBe(reference.payloadHash)
    expect(normalizeMagentoOrder({ ...ORDER_42, status: 'processing' })?.payloadHash).not.toBe(reference.payloadHash)
    expect(calls.find((c) => (c as { event: string }).event === 'magento.sync.page')).toMatchObject({ fields: expect.objectContaining({ after: null, count: 100, skipped: 0, totalCount: 101, done: false }) })
    expectNoSecret(calls)
  })

  it('ends a scan whose last page is full with one empty read, never depending on total_count', async () => {
    const seen: URL[] = []
    const { adapter, fetchImpl } = adapterWith({
      'GET /rest/V1/orders': (url) => {
        seen.push(url)
        const after = url.searchParams.get('searchCriteria[filter_groups][0][filters][0][value]')
        return after === null ? jsonRes({ items: Array.from({ length: 100 }, (_, i) => ({ ...ORDER_42, entity_id: 1 + i })) }) : jsonRes({ items: [], total_count: 100 })
      },
    })
    const first = await adapter.syncPage(connection(), 'orders', EMPTY_CHECKPOINT, 'initial', fakeLogger().log)
    expect(first.done).toBe(false)
    expect(first.checkpoint.cursor).toBe('100')
    const second = await adapter.syncPage(connection(), 'orders', first.checkpoint, 'initial', fakeLogger().log)
    expect(second.done).toBe(true)
    expect(second.checkpoint.cursor).toBeNull()
    expect(second.orders).toEqual([])
    expect(seen[1].searchParams.get('searchCriteria[filter_groups][0][filters][0][value]')).toBe('100')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('refuses to loop on a full page that does not advance the cursor (filter ignored, or records without ids)', async () => {
    const stuck = adapterWith({ 'GET /rest/V1/orders': () => jsonRes({ items: Array.from({ length: 100 }, () => ({ ...ORDER_42, entity_id: 5 })), total_count: 1000 }) })
    const first = await stuck.adapter.syncPage(connection(), 'orders', EMPTY_CHECKPOINT, 'initial', fakeLogger().log)
    expect(first.checkpoint.cursor).toBe('5')
    const err = await failure(stuck.adapter.syncPage(connection(), 'orders', first.checkpoint, 'initial', fakeLogger().log))
    expect(err.code).toBe('invalid_response')
    expect(err.message).toBe('magento orders.list: full page did not advance the entity_id cursor')
    const idless = adapterWith({ 'GET /rest/V1/products': () => jsonRes({ items: Array.from({ length: 100 }, () => ({ sku: 'X' })), total_count: 100 }) })
    expect((await failure(idless.adapter.syncPage(connection(), 'products', EMPTY_CHECKPOINT, 'initial', fakeLogger().log))).code).toBe('invalid_response')
    // An unreadable cursor restarts from the beginning (idempotent upserts) and says so.
    const { adapter } = adapterWith({ 'GET /rest/V1/orders': () => jsonRes({ items: [ORDER_42], total_count: 1 }) })
    const { log, calls } = fakeLogger()
    const batch = await adapter.syncPage(connection(), 'orders', { cursor: 'page-2', modifiedAfter: null, pages: 1 }, 'initial', log)
    expect(batch).toMatchObject({ done: true, checkpoint: { cursor: null, pages: 2 } })
    expect(calls.some((c) => (c as { event: string }).event === 'magento.sync.cursor_unreadable')).toBe(true)
  })

  it('maps order states, statuses, totals and shipped quantities to order, financial and fulfilment states', () => {
    const states = (raw: Record<string, unknown>) => {
      const o = normalizeMagentoOrder({ ...ORDER_42, ...raw })!
      return [o.status, o.financialStatus, o.fulfillmentStatus]
    }
    expect(states({ state: 'complete', status: 'complete', total_paid: 159.9 })).toEqual(['completed', 'paid', 'fulfilled'])
    expect(states({ state: 'closed', status: 'closed', total_paid: 159.9, total_refunded: 159.9 })).toEqual(['refunded', 'refunded', 'unfulfilled'])
    expect(states({ state: 'processing', status: 'processing', total_paid: 159.9, total_refunded: 60 })).toEqual(['processing', 'partially_refunded', 'unfulfilled'])
    expect(states({ state: 'processing', status: 'processing', total_paid: 100 })).toEqual(['processing', 'partially_paid', 'unfulfilled'])
    expect(states({ state: 'holded', status: 'holded' })).toEqual(['on_hold', 'pending', 'unfulfilled'])
    expect(states({ state: 'canceled', status: 'canceled' })).toEqual(['cancelled', 'voided', 'cancelled'])
    expect(states({ state: 'pending_payment', status: 'pending_payment' })).toEqual(['pending', 'pending', 'unfulfilled'])
    expect(states({ state: 'payment_review', status: 'fraud' })).toEqual(['on_hold', 'pending', 'unfulfilled'])
    expect(states({ state: 'processing', status: 'paypay_canceled_reversal' })[0]).toBe('processing')
    expect(states({ state: 'processing', status: 'paypal_canceled_reversal' })[0]).toBe('processing')
    expect(states({ state: 'new', status: 'received' })[0]).toBe('pending')
    expect(states({ state: 'new', status: 'rejected' })[0]).toBe('failed')
    // A gateway authorization that is not captured yet; a cancelled authorization is void.
    expect(states({ state: 'processing', status: 'processing', payment: { method: 'braintree', amount_authorized: 159.9 } })).toEqual(['processing', 'authorized', 'unfulfilled'])
    expect(states({ state: 'canceled', status: 'canceled', payment: { method: 'braintree', amount_authorized: 159.9 } })).toEqual(['cancelled', 'voided', 'cancelled'])
    // A custom status falls back to its state; an unknown state is unknown.
    expect(states({ state: 'processing', status: 'ambalat' })).toEqual(['processing', 'pending', 'unfulfilled'])
    expect(states({ state: 'custom_state', status: 'custom' })[0]).toBe('unknown')
    // Shipments: partial when some top-level quantity shipped, fulfilled when all of it did (children ignored).
    const shippedOne = { items: ORDER_42.items.map((i) => (i.item_id === 3 ? { ...i, qty_shipped: 2 } : i)) }
    expect(states({ state: 'processing', status: 'processing', total_paid: 159.9, ...shippedOne })).toEqual(['processing', 'paid', 'partial'])
    const shippedAll = { items: ORDER_42.items.map((i) => ({ ...i, qty_shipped: i.qty_ordered })) }
    expect(states({ state: 'processing', status: 'processing', ...shippedAll })).toEqual(['processing', 'pending', 'fulfilled'])
    // Guest orders have no customer; the billing phone and country are the fallback; a zero-total order without a payment stays pending.
    const guest = normalizeMagentoOrder({ ...ORDER_42, customer_id: 11, customer_is_guest: 1, extension_attributes: {} })!
    expect(guest).toMatchObject({ customerExternalId: null, contactPhoneRaw: '0722 123 456', shippingCountry: 'RO', shippingSummary: 'Str. Lungă 1, Cluj-Napoca' })
    expect(normalizeMagentoOrder({ ...ORDER_42, grand_total: 0, total_paid: 0, payment: { method: 'free' } })).toMatchObject({ financialStatus: 'pending', paymentMethod: 'free', paymentMethodTitle: null })
    expect(normalizeMagentoOrder({ increment_id: '1' })).toBeNull()
  })

  it('recognises cash on delivery by the Magento code and by COD-looking titles, not by substrings of other words', () => {
    expect(isMagentoCodPayment('cashondelivery', null)).toBe(true)
    expect(isMagentoCodPayment('checkmo', 'Plata ramburs la curier')).toBe(true)
    expect(isMagentoCodPayment('custom_cod', null)).toBe(true)
    expect(isMagentoCodPayment('cod', null)).toBe(true)
    expect(isMagentoCodPayment('checkmo', 'Cash on delivery')).toBe(true)
    expect(isMagentoCodPayment('banktransfer', 'Transfer bancar')).toBe(false)
    expect(isMagentoCodPayment('card', 'Card cu cashback')).toBe(false)
    expect(isMagentoCodPayment('voucher', 'Cod promoțional')).toBe(true)
    expect(isMagentoCodPayment('decodare', 'Decodare')).toBe(false)
    expect(isMagentoCodPayment(null, null)).toBe(false)
    expect(normalizeMagentoOrder({ ...ORDER_42, payment: { method: 'checkmo', additional_information: { method_title: 'Check / Money order' } } })).toMatchObject({ paymentMethodTitle: 'Check / Money order', metadata: expect.objectContaining({ cod_hint: false }) })
    expect(normalizeMagentoOrder({ ...ORDER_42, payment: { method: 'braintree', additional_information: ['5f1c2a9b3e4d5c6b7a8f9e0d1c2b3a4f', ''] } })).toMatchObject({ paymentMethodTitle: null })
  })

  it('filters incremental syncs with updated_at >= watermark − overlap in UTC database format, ANDed with the keyset cursor, for every resource', async () => {
    const seen: URL[] = []
    const { adapter } = adapterWith({
      'GET /rest/V1/orders': (url) => { seen.push(url); return jsonRes({ items: [], total_count: 0 }) },
      'GET /rest/V1/products': (url) => { seen.push(url); return jsonRes({ items: [PRODUCT_5_WITH_STOCK, { ...PRODUCT_5, id: 6, sku: 'CANA-02', status: 2 }], total_count: 2 }) },
      'GET /rest/V1/customers/search': (url) => { seen.push(url); return jsonRes({ items: [CUSTOMER_7], total_count: 1 }) },
    })
    const checkpoint = { cursor: null, modifiedAfter: '2026-03-01T12:00:00+02:00', pages: 3 }
    const orders = await adapter.syncPage(connection(), 'orders', checkpoint, 'incremental', fakeLogger().log)
    expect(seen[0].searchParams.get('searchCriteria[filter_groups][0][filters][0][field]')).toBe('updated_at')
    expect(seen[0].searchParams.get('searchCriteria[filter_groups][0][filters][0][value]')).toBe('2026-03-01 09:50:00')
    expect(seen[0].searchParams.get('searchCriteria[filter_groups][0][filters][0][condition_type]')).toBe('gteq')
    expect(seen[0].searchParams.has('searchCriteria[filter_groups][1][filters][0][field]')).toBe(false)
    expect(seen[0].searchParams.get('searchCriteria[sortOrders][0][field]')).toBe('entity_id')
    // The space in the timestamp travels as %20 (what Magento signs and decodes), never as +.
    expect(seen[0].search).toContain('2026-03-01%2009%3A50%3A00')
    expect(orders).toMatchObject({ done: true, orders: [], checkpoint: { cursor: null, modifiedAfter: '2026-03-01T12:00:00+02:00', pages: 4 } })

    const products = await adapter.syncPage(connection(), 'products', { ...checkpoint, cursor: '4' }, 'incremental', fakeLogger().log)
    expect(seen[1].pathname).toBe('/rest/V1/products')
    expect(seen[1].searchParams.get('searchCriteria[filter_groups][0][filters][0][value]')).toBe('2026-03-01 09:50:00')
    expect(seen[1].searchParams.get('searchCriteria[filter_groups][1][filters][0][field]')).toBe('entity_id')
    expect(seen[1].searchParams.get('searchCriteria[filter_groups][1][filters][0][value]')).toBe('4')
    expect(seen[1].searchParams.get('searchCriteria[filter_groups][1][filters][0][condition_type]')).toBe('gt')
    expect(seen[1].searchParams.get('searchCriteria[pageSize]')).toBe('100')
    expect(products.done).toBe(true)
    expect(products.checkpoint).toEqual({ cursor: null, modifiedAfter: '2026-03-01T12:00:00+02:00', pages: 4 })
    expect(products.products).toEqual([
      expect.objectContaining({ externalId: '5', sku: 'CANA-01', name: 'Cană', status: 'active', price: 49.95, currency: null, stockStatus: 'in_stock', stockQuantity: 3, url: null, providerUpdatedAt: '2026-03-02T08:00:00.000Z' }),
      expect.objectContaining({ externalId: '6', sku: 'CANA-02', status: 'archived', stockStatus: 'unknown', stockQuantity: null }),
    ])
    expect(products.products![0].metadata).toMatchObject({ type_id: 'simple', stock_known: true })
    expect(products.products![1].metadata).toMatchObject({ stock_known: false })

    const customers = await adapter.syncPage(connection(), 'customers', checkpoint, 'incremental', fakeLogger().log)
    expect(seen[2].pathname).toBe('/rest/V1/customers/search')
    expect(seen[2].searchParams.get('searchCriteria[filter_groups][0][filters][0][field]')).toBe('updated_at')
    expect(customers.done).toBe(true)
    expect(customers.customers).toEqual([
      expect.objectContaining({
        externalId: '7',
        email: 'ana@example.com',
        firstName: 'Ana',
        lastName: 'Pop',
        // The default billing address wins over the default shipping one, even though it is listed second.
        phoneRaw: '0722123456',
        countryCode: 'RO',
        marketingConsent: false,
        callConsent: null,
        ordersCount: null,
        totalSpent: null,
        providerCreatedAt: '2025-01-01T00:00:00.000Z',
        providerUpdatedAt: '2026-02-01T00:00:00.000Z',
      }),
    ])
    // An initial sync never filters by updated_at even when a watermark is present.
    const initial = adapterWith({ 'GET /rest/V1/orders': (url) => { seen.push(url); return jsonRes({ items: [], total_count: 0 }) } })
    await initial.adapter.syncPage(connection(), 'orders', checkpoint, 'initial', fakeLogger().log)
    expect([...seen[3].searchParams.keys()].some((k) => k.includes('filter_groups'))).toBe(false)
  })

  it('normalizes customers without a default address or any phone, and stock variants', () => {
    const noDefaults = normalizeMagentoCustomer({ ...CUSTOMER_7, extension_attributes: {}, addresses: [{ id: 1, country_id: 'de' }, { id: 2, country_id: 'RO', telephone: '0711' }] })!
    expect(noDefaults).toMatchObject({ phoneRaw: '0711', countryCode: 'RO', marketingConsent: null })
    expect(normalizeMagentoCustomer({ ...CUSTOMER_7, addresses: [{ id: 1, country_id: 'DE' }] })).toMatchObject({ phoneRaw: null, countryCode: 'DE' })
    expect(normalizeMagentoCustomer({ ...CUSTOMER_7, addresses: undefined })).toMatchObject({ phoneRaw: null, countryCode: null, metadata: expect.objectContaining({ addresses_count: 0 }) })
    expect(normalizeMagentoCustomer({ email: 'x@y.z' })).toBeNull()

    const stock = (item: Record<string, unknown>) => normalizeMagentoProduct({ ...PRODUCT_5, extension_attributes: { stock_item: item } })!
    expect(stock({ qty: 0, is_in_stock: false, manage_stock: true, backorders: 0 })).toMatchObject({ stockStatus: 'out_of_stock', stockQuantity: 0 })
    expect(stock({ qty: 0, is_in_stock: true, manage_stock: true, backorders: 1 })).toMatchObject({ stockStatus: 'on_backorder', stockQuantity: 0 })
    expect(stock({ qty: 0, is_in_stock: 1, manage_stock: false, backorders: 0 })).toMatchObject({ stockStatus: 'in_stock', stockQuantity: null })
    expect(stock({ qty: 2 })).toMatchObject({ stockStatus: 'unknown', stockQuantity: 2 })
    expect(normalizeMagentoProduct({ ...PRODUCT_5, status: 7 })?.status).toBe('unknown')
    expect(normalizeMagentoProduct({ sku: 'X' })).toBeNull()
  })

  it('never reads carts (no cart source in the REST API)', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes)
    const carts = await adapter.syncPage(connection(), 'carts', { cursor: '3', modifiedAfter: null, pages: 1 }, 'initial', fakeLogger().log)
    expect(carts).toEqual({ resource: 'carts', carts: [], checkpoint: { cursor: null, modifiedAfter: null, pages: 1 }, done: true })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('surfaces a revoked token, a disabled Bearer setting or a transient outage during sync as ConnectionErrors without the token', async () => {
    const { adapter } = adapterWith({ 'GET /rest/V1/orders': () => unauthorized('Magento_Sales::actions_view') })
    const err = await failure(adapter.syncPage(connection(), 'orders', EMPTY_CHECKPOINT, 'initial', fakeLogger().log))
    expect(err.code).toBe('unauthorized')
    expect(err.retryable).toBe(false)
    expectNoSecret({ message: err.message, publicMessage: err.publicMessage })
    const signed = adapterWith({ 'GET /rest/V1/orders': () => unauthorized('Magento_Sales::actions_view') })
    const s = await failure(signed.adapter.syncPage(connection({ secrets: OAUTH_SECRETS }), 'orders', EMPTY_CHECKPOINT, 'initial', fakeLogger().log))
    expect(s.code).toBe('unauthorized')
    expect(s.publicMessage).toMatch(/OAuth/)
    expectNoSecret({ message: s.message, publicMessage: s.publicMessage })
    const broken = adapterWith({ 'GET /rest/V1/orders': () => jsonRes({ items: 'nope' }) })
    expect((await failure(broken.adapter.syncPage(connection(), 'orders', EMPTY_CHECKPOINT, 'initial', fakeLogger().log))).code).toBe('invalid_response')
    const maintenance = adapterWith({ 'GET /rest/V1/orders': () => textRes('<html><body>Be right back</body></html>', 503, 'text/html') })
    const m = await failure(maintenance.adapter.syncPage(connection(), 'orders', EMPTY_CHECKPOINT, 'initial', fakeLogger().log))
    expect(m.code).toBe('unreachable')
    expect(m.retryable).toBe(true)
  })
})

describe('webhooks', () => {
  it('rejects every delivery as not supported, whatever the headers or body', async () => {
    const body = JSON.stringify(ORDER_42)
    expect(await magentoAdapter.verifyWebhook(rawRequest(body, { 'x-magento-signature': 'abc', 'content-type': 'application/json' }), connection())).toEqual({ ok: false, reason: 'not_supported', status: 400 })
    expect(await magentoAdapter.verifyWebhook(rawRequest('', {}), connection({ secrets: {} }))).toEqual({ ok: false, reason: 'not_supported', status: 400 })
  })

  it('registers nothing and never calls the store, with or without a webhook URL', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes)
    const { log, calls } = fakeLogger()
    expect(await adapter.registerWebhooks(connection(), log)).toEqual([])
    expect(await adapter.registerWebhooks(connection({ webhookUrl: null }), log)).toEqual([])
    await adapter.unregisterWebhooks(connection({ webhookRegistrations: [{ topic: 'order.created', externalId: '1', source: 'manual' }] }), log)
    expect(fetchImpl).not.toHaveBeenCalled()
    expectNoSecret(calls)
  })
})

describe('normalizeEvent', () => {
  const verified = (topic: string, payload: unknown): VerifiedCommerceEvent => ({ ok: true, topic, deliveryId: 'd-1', externalResourceId: null, payload })

  it('maps the documented topics onto commerce events with the record normalizers', () => {
    const conn = connection()
    expect(magentoAdapter.normalizeEvent(verified('order.created', ORDER_42), conn)).toEqual([{ kind: 'order.created', order: expect.objectContaining({ externalId: '42', paymentMethod: 'cashondelivery' }) }])
    expect(magentoAdapter.normalizeEvent(verified('order.updated', ORDER_42), conn)[0].kind).toBe('order.updated')
    expect(magentoAdapter.normalizeEvent(verified('product.updated', PRODUCT_5_WITH_STOCK), conn)).toEqual([{ kind: 'product.updated', product: expect.objectContaining({ externalId: '5', stockStatus: 'in_stock' }) }])
    expect(magentoAdapter.normalizeEvent(verified('customer.updated', CUSTOMER_7), conn)).toEqual([{ kind: 'customer.updated', customer: expect.objectContaining({ externalId: '7', phoneRaw: '0722123456', countryCode: 'RO' }) }])
    expect(magentoAdapter.normalizeEvent(verified('order.created', { increment_id: 'x' }), conn)).toEqual([{ kind: 'ignored', reason: 'malformed_payload:order' }])
    expect(magentoAdapter.normalizeEvent(verified('product.updated', {}), conn)).toEqual([{ kind: 'ignored', reason: 'malformed_payload:product' }])
    expect(magentoAdapter.normalizeEvent(verified('customer.updated', {}), conn)).toEqual([{ kind: 'ignored', reason: 'malformed_payload:customer' }])
    expect(magentoAdapter.normalizeEvent(verified('cart.updated', { id: 1 }), conn)).toEqual([{ kind: 'ignored', reason: 'unhandled_topic:cart.updated' }])
  })
})

describe('fetchOrder / fetchCustomer / fetchProduct', () => {
  it('reads one order or customer by id and answers null for a missing or malformed id', async () => {
    const { adapter, fetchImpl } = adapterWith({
      'GET /rest/V1/orders/42': () => jsonRes(ORDER_42),
      'GET /rest/V1/orders/43': () => jsonRes({ message: 'The entity that was requested doesn\'t exist. Verify the entity and try again.' }, 404),
      'GET /rest/V1/customers/7': () => jsonRes(CUSTOMER_7),
    })
    const { log, calls } = fakeLogger()
    expect(await adapter.fetchOrder(connection(), '42', log)).toMatchObject({ externalId: '42', orderNumber: '000001042' })
    expect(await adapter.fetchOrder(connection(), '43', log)).toBeNull()
    expect(await adapter.fetchCustomer(connection(), '7', log)).toMatchObject({ externalId: '7', phoneRaw: '0722123456' })
    expect(await adapter.fetchCustomer(connection(), '../admin', log)).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    const revoked = adapterWith({ 'GET /rest/V1/orders/42': () => unauthorized('Magento_Sales::actions_view') })
    expect((await failure(revoked.adapter.fetchOrder(connection(), '42', log))).code).toBe('unauthorized')
    expectNoSecret(calls)
  })

  it('signs single reads with OAuth when the connection holds the four credentials', async () => {
    const { adapter, fetchImpl } = adapterWith({ 'GET /rest/V1/orders/42': () => jsonRes(ORDER_42) }, { nonce: () => NONCE, now: () => TIMESTAMP * 1000 })
    expect(await adapter.fetchOrder(connection({ secrets: OAUTH_SECRETS }), '42', fakeLogger().log)).toMatchObject({ externalId: '42' })
    const base = `GET&https%3A%2F%2Fshop.example.ro%2Frest%2FV1%2Forders%2F42&${encodeURIComponent(`oauth_consumer_key=${CONSUMER_KEY}&oauth_nonce=${NONCE}&oauth_signature_method=HMAC-SHA256&oauth_timestamp=${TIMESTAMP}&oauth_token=${TOKEN}&oauth_version=1.0`)}`
    expect(oauthParamsOf(fetchImpl.mock.calls[0]).oauth_signature).toBe(referenceSignature(base))
    expectNoSecret(String(fetchImpl.mock.calls[0][0]))
  })

  it('resolves a product id through a search and reads the SKU route for the stock item', async () => {
    const seen: URL[] = []
    const { adapter } = adapterWith({
      'GET /rest/V1/products': (url) => { seen.push(url); return jsonRes({ items: [PRODUCT_5], total_count: 1 }) },
      'GET /rest/V1/products/CANA-01': (url) => { seen.push(url); return jsonRes(PRODUCT_5_WITH_STOCK) },
    })
    const product = await adapter.fetchProduct(connection(), '5', fakeLogger().log)
    expect(seen[0].searchParams.get('searchCriteria[filter_groups][0][filters][0][field]')).toBe('entity_id')
    expect(seen[0].searchParams.get('searchCriteria[filter_groups][0][filters][0][value]')).toBe('5')
    expect(seen[0].searchParams.get('searchCriteria[filter_groups][0][filters][0][condition_type]')).toBe('eq')
    expect(seen[1].pathname).toBe('/rest/V1/products/CANA-01')
    expect(product).toMatchObject({ externalId: '5', stockStatus: 'in_stock', stockQuantity: 3 })
  })

  it('keeps the listed product when the SKU route is unavailable or unaddressable, and answers null for an unknown or malformed id', async () => {
    const { adapter, fetchImpl } = adapterWith({
      'GET /rest/V1/products': (url) => {
        const id = url.searchParams.get('searchCriteria[filter_groups][0][filters][0][value]')
        if (id === '5') return jsonRes({ items: [{ ...PRODUCT_5, sku: 'A/B' }], total_count: 1 })
        if (id === '8') return jsonRes({ items: [{ ...PRODUCT_5, id: 8, sku: '..' }], total_count: 1 })
        return jsonRes({ items: [], total_count: 0 })
      },
    })
    const { log, calls } = fakeLogger()
    const listed = await adapter.fetchProduct(connection(), '5', log)
    expect(listed).toMatchObject({ externalId: '5', sku: 'A/B', stockStatus: 'unknown' })
    expect(fetchImpl.mock.calls.some((c) => new URL(String(c[0])).pathname === '/rest/V1/products/A%2FB')).toBe(true)
    expect(calls.some((c) => (c as { event: string }).event === 'magento.fetch.product_single_unavailable')).toBe(true)
    // A dot-segment SKU would address another route: the listing stands without a second request.
    const before = fetchImpl.mock.calls.length
    expect(await adapter.fetchProduct(connection(), '8', log)).toMatchObject({ externalId: '8', sku: '..' })
    expect(fetchImpl.mock.calls.length).toBe(before + 1)
    expect(await adapter.fetchProduct(connection(), '999', log)).toBeNull()
    expect(await adapter.fetchProduct(connection(), 'CANA-01', log)).toBeNull()
    expectNoSecret(calls)
  })
})
