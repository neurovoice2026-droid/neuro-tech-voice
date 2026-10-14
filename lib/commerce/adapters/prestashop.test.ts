import crypto from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { Logger } from '@/lib/observability/logger'
import { timeoutError } from '@/tests/helpers/fetch'
import type { CommerceCapabilities } from '../types'
import { ConnectionError, type AdapterConnection } from './types'
import {
  CUSTOMERS_PAGE_SIZE,
  EMPTY_SHOP_CONTEXT,
  NOTE_NO_CARTS,
  NOTE_NO_COUNTRIES,
  NOTE_NO_STOCK,
  NOTE_NO_WEBHOOKS,
  ORDERS_PAGE_SIZE,
  PRESTASHOP_API_VERSION,
  PRESTASHOP_POLLING_MINUTES,
  PRODUCTS_PAGE_SIZE,
  PrestaShopSecretsSchema,
  canonicalStoreUrl,
  createPrestaShopAdapter,
  isCashOnDelivery,
  isoToShopDate,
  langValue,
  mapOrderState,
  normalizePrestaShopOrder,
  parseResourceListing,
  payloadHashOf,
  prestaShopAdapter,
  shopDateToIso,
  validTimezone,
  webserviceErrorCodes,
  type OrderStateInfo,
} from './prestashop'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'
const KEY_B64 = Buffer.from(`${KEY}:`).toString('base64')
const STORE = 'https://shop.example.ro'
const WEBHOOK_URL = 'https://app.example.com/api/commerce/webhooks/prestashop/abc'
const publicLookup = async () => ['93.184.216.34']

function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function xmlRes(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/xml;charset=utf-8', ...headers } })
}

/** The documented JSON error envelope. */
function wsError(status: number, code: number, message: string): Response {
  return jsonRes({ errors: [{ code, message }] }, status)
}

type Handler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>

/** A fetch whose routes are keyed by "METHOD /path" (query string ignored); unknown routes answer like a bare PHP site (HTML 404). */
function storeFetch(routes: Record<string, Handler>) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = (init?.method ?? 'GET').toUpperCase()
    const handler = routes[`${method} ${url.pathname}`]
    if (!handler) return new Response('<!DOCTYPE html><html><body>Not Found</body></html>', { status: 404, headers: { 'content-type': 'text/html' } })
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

const ALL_RESOURCES = ['addresses', 'configurations', 'countries', 'currencies', 'customers', 'languages', 'order_details', 'order_states', 'orders', 'products', 'stock_availables']

function rootXml(readable: string[] = ALL_RESOURCES, shopName = 'Magazinul &amp; Co'): string {
  const entries = readable
    .map(
      (name) => `<${name} xlink:href="${STORE}/api/${name}" get="true" put="false" post="false" patch="false" delete="false" head="true">
<description><![CDATA[${name}]]></description>
<schema xlink:href="${STORE}/api/${name}?schema=blank" type="blank"/>
<schema xlink:href="${STORE}/api/${name}?schema=synopsis" type="synopsis"/>
</${name}>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<api shopName="${shopName}">\n${entries}\n</api>\n</prestashop>\n`
}

/** Translated field as the Webservice renders it with two active languages. */
function i18n(en: string, ro: string) {
  return [
    { id: '1', value: en },
    { id: '2', value: ro },
  ]
}

const ORDER_STATES = [
  { id: '1', name: i18n('Awaiting check payment', 'În așteptarea plății prin cec'), template: i18n('cheque', 'cheque'), paid: '0', shipped: '0', logable: '0', deleted: '0', module_name: 'ps_checkpayment' },
  { id: '2', name: i18n('Payment accepted', 'Plată acceptată'), template: i18n('payment', 'payment'), paid: '1', shipped: '0', logable: '1', deleted: '0', module_name: '' },
  { id: '3', name: i18n('Processing in progress', 'În curs de procesare'), template: i18n('preparation', 'preparation'), paid: '1', shipped: '0', logable: '1', deleted: '0', module_name: '' },
  { id: '4', name: i18n('Shipped', 'Expediat'), template: i18n('shipped', 'shipped'), paid: '1', shipped: '1', logable: '1', deleted: '0', module_name: '' },
  { id: '5', name: i18n('Delivered', 'Livrat'), template: i18n('', ''), paid: '1', shipped: '1', logable: '1', deleted: '0', module_name: '' },
  { id: '6', name: i18n('Canceled', 'Anulat'), template: i18n('order_canceled', 'order_canceled'), paid: '0', shipped: '0', logable: '0', deleted: '0', module_name: '' },
  { id: '7', name: i18n('Refunded', 'Rambursat'), template: i18n('refund', 'refund'), paid: '0', shipped: '0', logable: '0', deleted: '0', module_name: '' },
  { id: '8', name: i18n('Payment error', 'Eroare de plată'), template: i18n('payment_error', 'payment_error'), paid: '0', shipped: '0', logable: '0', deleted: '0', module_name: '' },
  { id: '12', name: i18n('On backorder (not paid)', 'Comandă în așteptare (neplătită)'), template: i18n('outofstock', 'outofstock'), paid: '0', shipped: '0', logable: '0', deleted: '0', module_name: '' },
  { id: '13', name: i18n('Awaiting Cash On Delivery validation', 'În așteptarea validării plății ramburs'), template: i18n('cashondelivery', 'cashondelivery'), paid: '0', shipped: '0', logable: '0', deleted: '0', module_name: 'ps_cashondelivery' },
]

const CONFIGURATIONS = [
  { id: '1', name: 'PS_SHOP_NAME', value: 'Magazinul Meu', id_shop: '', id_shop_group: '' },
  { id: '2', name: 'PS_TIMEZONE', value: 'Europe/Bucharest', id_shop: '', id_shop_group: '' },
  { id: '3', name: 'PS_LANG_DEFAULT', value: '2', id_shop: '', id_shop_group: '' },
  { id: '4', name: 'PS_CURRENCY_DEFAULT', value: '1', id_shop: '', id_shop_group: '' },
  { id: '5', name: 'PS_COUNTRY_DEFAULT', value: '36', id_shop: '', id_shop_group: '' },
  { id: '6', name: 'PS_ORDER_OUT_OF_STOCK', value: '0', id_shop: '', id_shop_group: '' },
]

const ORDER_42 = {
  id: '42',
  id_address_delivery: '7',
  id_address_invoice: '7',
  id_cart: '90',
  id_currency: '1',
  id_lang: '2',
  id_customer: '11',
  id_carrier: '2',
  current_state: '13',
  module: 'ps_cashondelivery',
  invoice_number: '0',
  invoice_date: '0000-00-00 00:00:00',
  delivery_number: '0',
  delivery_date: '0000-00-00 00:00:00',
  valid: '0',
  date_add: '2026-03-01 12:20:30',
  date_upd: '2026-03-02 08:00:00',
  shipping_number: '',
  note: '',
  id_shop_group: '1',
  id_shop: '1',
  secure_key: 'abc',
  payment: 'Plata ramburs (COD)',
  recyclable: '0',
  gift: '0',
  gift_message: '',
  mobile_theme: '0',
  total_discounts: '0.000000',
  total_paid: '159.900000',
  total_paid_tax_incl: '159.900000',
  total_paid_tax_excl: '134.370000',
  total_paid_real: '0.000000',
  total_products: '144.900000',
  total_products_wt: '144.900000',
  total_shipping: '15.000000',
  conversion_rate: '1.000000',
  reference: 'XKBKNABJK',
  associations: {
    order_rows: [
      { id: '501', product_id: '21', product_attribute_id: '0', product_quantity: '2', product_name: 'Cană', product_reference: 'CANA-01', product_price: '49.950000', unit_price_tax_incl: '59.440500', unit_price_tax_excl: '49.950000' },
    ],
  },
}

const ORDER_43 = {
  ...ORDER_42,
  id: '43',
  id_address_delivery: '8',
  id_customer: '12',
  id_currency: '2',
  current_state: '4',
  module: 'ps_wirepayment',
  payment: 'Transfer bancar',
  valid: '1',
  reference: 'YYBKNABJK',
  total_paid_tax_incl: '80.000000',
  date_add: '2026-07-01 12:00:00',
  date_upd: '2026-07-01 12:00:00',
  associations: { order_rows: [] },
}

const ORDER_DETAILS = [
  { id: '501', id_order: '42', product_id: '21', product_attribute_id: '0', product_name: 'Cană', product_quantity: '2', product_reference: 'CANA-01', product_price: '49.950000', unit_price_tax_incl: '59.440500', total_price_tax_incl: '118.881000' },
  { id: '502', id_order: '42', product_id: '22', product_attribute_id: '120', product_name: 'Tricou - Mărime : M', product_quantity: '1', product_reference: 'TR-M', product_price: '21.850000', unit_price_tax_incl: '26.001500', total_price_tax_incl: '26.001500' },
  { id: '503', id_order: '43', product_id: '23', product_attribute_id: '0', product_name: 'Poster', product_quantity: '1', product_reference: '', product_price: '67.226891', unit_price_tax_incl: '80.000000', total_price_tax_incl: '80.000000' },
]

const ADDRESSES = [
  { id: '7', id_customer: '11', id_country: '36', firstname: 'Ana', lastname: 'Pop', company: '', address1: 'Str. Lungă 1', address2: 'ap. 3', postcode: '400001', city: 'Cluj-Napoca', phone: '0264 123 456', phone_mobile: '0722 123 456', deleted: '0', date_upd: '2026-02-01 10:00:00' },
  { id: '8', id_customer: '12', id_country: '8', firstname: 'Max', lastname: 'Müller', company: 'GmbH', address1: 'Hauptstr. 5', address2: '', postcode: '10115', city: 'Berlin', phone: '', phone_mobile: '', deleted: '0', date_upd: '2026-02-01 10:00:00' },
]

const CUSTOMERS = [
  { id: '11', id_lang: '2', firstname: 'Ana', lastname: 'Pop', email: 'ana@example.com', company: '', newsletter: '1', optin: '0', active: '1', deleted: '0', is_guest: '0', date_add: '2025-12-24 09:30:00', date_upd: '2026-01-05 10:00:00' },
  { id: '12', id_lang: '1', firstname: 'Max', lastname: 'Müller', email: 'max@example.de', company: 'GmbH', newsletter: '0', optin: '0', active: '1', deleted: '0', is_guest: '1', date_add: '2026-01-10 09:30:00', date_upd: '2026-01-10 09:30:00' },
]

/** The keyset cursor of a list request (filter[id]=>[N]), 0 from the start. */
function afterIdOf(url: URL): number {
  return Number(/^>\[(\d+)\]$/.exec(url.searchParams.get('filter[id]') ?? '')?.[1] ?? 0)
}

function healthyRoutes(overrides: Record<string, Handler> = {}): Record<string, Handler> {
  return {
    'GET /api/': () => xmlRes(rootXml(), 200, { 'psws-version': '8.2.1' }),
    'GET /api/configurations': () => jsonRes({ configurations: CONFIGURATIONS }),
    'GET /api/currencies': () => jsonRes({ currencies: [{ id: '1', iso_code: 'RON' }, { id: '2', iso_code: 'EUR' }] }),
    'GET /api/countries': () => jsonRes({ countries: [{ id: '36', iso_code: 'RO' }, { id: '8', iso_code: 'DE' }] }),
    'GET /api/languages': () => jsonRes({ languages: [{ id: '1', iso_code: 'en' }, { id: '2', iso_code: 'ro' }] }),
    'GET /api/order_states': () => jsonRes({ order_states: ORDER_STATES }),
    'GET /api/orders': (url) => {
      const idFilter = url.searchParams.get('filter[id]') ?? ''
      const exact = /^\[(\d+)\]$/.exec(idFilter)?.[1]
      if (exact) {
        const found = [ORDER_42, ORDER_43].filter((o) => o.id === exact)
        return found.length ? jsonRes({ orders: found }) : jsonRes([])
      }
      const page = [ORDER_42, ORDER_43].filter((o) => Number(o.id) > Number(afterIdOf(url)))
      return page.length ? jsonRes({ orders: page }) : jsonRes([])
    },
    'GET /api/order_details': (url) => {
      const ids = (url.searchParams.get('filter[id_order]') ?? '').replace(/[[\]]/g, '').split('|')
      return jsonRes({ order_details: ORDER_DETAILS.filter((d) => ids.includes(d.id_order)) })
    },
    'GET /api/addresses': (url) => {
      const ids = (url.searchParams.get('filter[id]') ?? '').replace(/[[\]]/g, '').split('|')
      const customerIds = (url.searchParams.get('filter[id_customer]') ?? '').replace(/[[\]]/g, '').split('|')
      return jsonRes({ addresses: ADDRESSES.filter((a) => ids.includes(a.id) || customerIds.includes(a.id_customer)) })
    },
    'GET /api/customers': (url) => {
      const ids = (url.searchParams.get('filter[id]') ?? '').replace(/[[\]]/g, '').split('|')
      if (url.searchParams.get('filter[id]')) return jsonRes({ customers: CUSTOMERS.filter((c) => ids.includes(c.id)) })
      return jsonRes({ customers: CUSTOMERS })
    },
    ...overrides,
  }
}

function connection(overrides: Partial<AdapterConnection> = {}): AdapterConnection {
  const capabilities: CommerceCapabilities = {
    products: true,
    customers: true,
    orders: true,
    webhooks: false,
    abandoned_carts: false,
    customer_phone: true,
    polling_minutes: PRESTASHOP_POLLING_MINUTES,
    notes: [NOTE_NO_WEBHOOKS, NOTE_NO_CARTS],
  }
  return {
    id: 'conn-1',
    orgId: 'org-1',
    platform: 'prestashop',
    storeUrl: STORE,
    storeDomain: 'shop.example.ro',
    secrets: { webservice_key: KEY },
    capabilities,
    webhookRegistrations: [],
    webhookUrl: WEBHOOK_URL,
    ...overrides,
  }
}

function adapterWith(routes: Record<string, Handler>, now?: () => number) {
  const fetchImpl = storeFetch(routes)
  const adapter = createPrestaShopAdapter({ fetchImpl, lookup: publicLookup, now })
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
  expect(text).not.toContain(KEY)
  expect(text).not.toContain(KEY_B64)
}

function expectNoSecretInError(err: ConnectionError) {
  expectNoSecret({ message: err.message, publicMessage: err.publicMessage, code: err.code })
}

const checkpoint0 = { cursor: null, modifiedAfter: null, pages: 0 }

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PrestaShopSecretsSchema', () => {
  it('accepts a 32-character key and trims it', () => {
    expect(PrestaShopSecretsSchema.parse({ webservice_key: ` ${KEY} ` })).toEqual({ webservice_key: KEY })
  })
  it('rejects keys of another length or with separators', () => {
    expect(PrestaShopSecretsSchema.safeParse({ webservice_key: 'short' }).success).toBe(false)
    expect(PrestaShopSecretsSchema.safeParse({ webservice_key: `${KEY}X` }).success).toBe(false)
    expect(PrestaShopSecretsSchema.safeParse({ webservice_key: KEY.replace('A', ':') }).success).toBe(false)
    expect(PrestaShopSecretsSchema.safeParse({}).success).toBe(false)
  })
  it('pins the API reference and the platform', () => {
    expect(PRESTASHOP_API_VERSION).toBe('webservice-8')
    expect(prestaShopAdapter.platform).toBe('prestashop')
  })
})

describe('canonicalStoreUrl', () => {
  it('lower-cases the host, strips a pasted API root, the query and trailing slashes, keeps a sub-directory', () => {
    expect(canonicalStoreUrl('https://Shop.Example.RO/api/orders?x=1')).toEqual({ storeUrl: STORE, storeDomain: 'shop.example.ro' })
    expect(canonicalStoreUrl('https://shop.example.ro/magazin/').storeUrl).toBe(`${STORE}/magazin`)
    expect(canonicalStoreUrl('shop.example.ro').storeUrl).toBe(STORE)
  })
  it('refuses http and embedded credentials', () => {
    expect(() => canonicalStoreUrl('http://shop.example.ro')).toThrow(ConnectionError)
    expect(() => canonicalStoreUrl(`https://${KEY}:@shop.example.ro`)).toThrow(/credentials/)
    expect(() => canonicalStoreUrl('')).toThrow(ConnectionError)
  })
})

describe('parseResourceListing', () => {
  it('reads the readable resources and the decoded shop name', () => {
    const listing = parseResourceListing(rootXml(['orders', 'customers'], 'Magazinul &amp; Co &quot;X&quot;'))
    expect(listing).toEqual({ shopName: 'Magazinul & Co "X"', readable: new Set(['orders', 'customers']) })
  })
  it('ignores resources without a GET right and refuses other documents', () => {
    const xml = rootXml(['orders']).replace('get="true"', 'get="false"')
    expect(parseResourceListing(xml)?.readable.size).toBe(0)
    expect(parseResourceListing('<prestashop><orders><order><id>1</id></order></orders></prestashop>')).toBeNull()
    expect(parseResourceListing('<html></html>')).toBeNull()
  })
})

describe('webserviceErrorCodes', () => {
  it('reads the JSON and the XML envelopes', () => {
    expect(webserviceErrorCodes({ json: { errors: [{ code: 26, message: 'x' }, { code: '21', message: 'y' }] }, text: '' })).toEqual([26, 21])
    expect(webserviceErrorCodes({ json: undefined, text: '<prestashop><errors><error><code><![CDATA[22]]></code><message><![CDATA[disabled]]></message></error></errors></prestashop>' })).toEqual([22])
    expect(webserviceErrorCodes({ json: [], text: '[]' })).toEqual([])
  })
})

describe('shop dates', () => {
  it('converts shop wall-clock dates with the PS_TIMEZONE zone (winter and summer time)', () => {
    expect(shopDateToIso('2026-03-01 12:20:30', 'Europe/Bucharest')).toBe('2026-03-01T10:20:30.000Z')
    expect(shopDateToIso('2026-07-01 12:00:00', 'Europe/Bucharest')).toBe('2026-07-01T09:00:00.000Z')
    expect(shopDateToIso('2026-03-01 12:20:30', null)).toBe('2026-03-01T12:20:30.000Z')
    expect(shopDateToIso('0000-00-00 00:00:00', 'Europe/Bucharest')).toBeNull()
    expect(shopDateToIso('', 'Europe/Bucharest')).toBeNull()
  })
  it('formats filter values in the shop zone and round-trips', () => {
    expect(isoToShopDate('2026-03-01T10:20:30.000Z', 'Europe/Bucharest')).toBe('2026-03-01 12:20:30')
    expect(isoToShopDate('2026-07-01T09:00:00Z', 'Europe/Bucharest')).toBe('2026-07-01 12:00:00')
    expect(isoToShopDate('2026-03-01T10:20:30.000Z', null)).toBe('2026-03-01 10:20:30')
    // Round trips across the two 2026 DST switches of Europe/Bucharest (29 March, 25 October).
    for (const iso of ['2026-03-28T23:30:00.000Z', '2026-03-29T01:30:00.000Z', '2026-10-24T22:30:00.000Z', '2026-10-25T02:30:00.000Z']) {
      expect(shopDateToIso(isoToShopDate(iso, 'Europe/Bucharest'), 'Europe/Bucharest')).toBe(iso)
    }
    // A wall-clock time that happens twice (clocks go back at 04:00 EEST) resolves to the later instant.
    expect(shopDateToIso('2026-10-25 03:30:00', 'Europe/Bucharest')).toBe('2026-10-25T01:30:00.000Z')
  })
  it('accepts only zones Intl knows', () => {
    expect(validTimezone('Europe/Bucharest')).toBe('Europe/Bucharest')
    expect(validTimezone('UTC')).toBe('UTC')
    expect(validTimezone('Mars/Olympus')).toBeNull()
    expect(validTimezone('../etc')).toBeNull()
    expect(validTimezone(null)).toBeNull()
  })
})

describe('langValue', () => {
  it('prefers the default language, then the first translation, and accepts plain strings', () => {
    expect(langValue(i18n('Mug', 'Cană'), '2')).toBe('Cană')
    expect(langValue(i18n('Mug', 'Cană'), '9')).toBe('Mug')
    expect(langValue([{ id: 1, value: '' }, { id: 2, value: 'Cană' }], '1')).toBe('Cană')
    expect(langValue('Mug', '2')).toBe('Mug')
    expect(langValue(null, '2')).toBeNull()
  })
})

describe('mapOrderState', () => {
  const state = (over: Partial<OrderStateInfo>): OrderStateInfo => ({ id: '1', name: null, template: null, paid: false, shipped: false, logable: false, deleted: false, ...over })
  it('maps the default states by template, flags and name', () => {
    expect(mapOrderState(state({ name: 'Anulat', template: 'order_canceled' }))).toEqual({ status: 'cancelled', financialStatus: 'voided', fulfillmentStatus: 'cancelled' })
    expect(mapOrderState(state({ name: 'Rambursat', template: 'refund' }))).toEqual({ status: 'refunded', financialStatus: 'refunded', fulfillmentStatus: 'unfulfilled' })
    expect(mapOrderState(state({ name: 'Eroare de plată', template: 'payment_error' }))).toEqual({ status: 'failed', financialStatus: 'pending', fulfillmentStatus: 'unfulfilled' })
    expect(mapOrderState(state({ name: 'Livrat', template: '', paid: true, shipped: true, logable: true }))).toEqual({ status: 'completed', financialStatus: 'paid', fulfillmentStatus: 'fulfilled' })
    expect(mapOrderState(state({ name: 'Expediat', template: 'shipped', paid: true, shipped: true, logable: true }))).toEqual({ status: 'processing', financialStatus: 'paid', fulfillmentStatus: 'fulfilled' })
    expect(mapOrderState(state({ name: 'Plată acceptată', template: 'payment', paid: true, logable: true }))).toEqual({ status: 'processing', financialStatus: 'paid', fulfillmentStatus: 'unfulfilled' })
    expect(mapOrderState(state({ name: 'Comandă în așteptare (neplătită)', template: 'outofstock' }))).toEqual({ status: 'on_hold', financialStatus: 'pending', fulfillmentStatus: 'unfulfilled' })
    expect(mapOrderState(state({ name: 'În așteptarea validării plății ramburs', template: 'cashondelivery' }))).toEqual({ status: 'pending', financialStatus: 'pending', fulfillmentStatus: 'unfulfilled' })
    expect(mapOrderState(null)).toEqual({ status: 'unknown', financialStatus: 'unknown', fulfillmentStatus: 'unknown' })
  })
  it('recognises a custom cancelled state by name only', () => {
    expect(mapOrderState(state({ name: 'Comandă anulată de client', template: 'custom' })).status).toBe('cancelled')
  })
  it('recognises the delivered state in the supported languages, accents included, but not "to deliver" states', () => {
    for (const name of ['Delivered', 'Livrat', 'Livrată', 'Livré', 'Livrée', 'Zugestellt', 'Consegnato', 'Entregado']) {
      expect(mapOrderState(state({ name, paid: true, shipped: true })), name).toEqual({ status: 'completed', financialStatus: 'paid', fulfillmentStatus: 'fulfilled' })
    }
    for (const name of ['À livrer', 'En cours de livraison', 'În curs de livrare', 'Out for delivery']) {
      expect(mapOrderState(state({ name, paid: true, shipped: true })).status, name).toBe('processing')
    }
  })
})

describe('isCashOnDelivery', () => {
  it('recognises the module and the usual titles, not unrelated gateways', () => {
    expect(isCashOnDelivery('ps_cashondelivery', 'Cash on delivery (COD)')).toBe(true)
    expect(isCashOnDelivery('custompay', 'Plata ramburs la curier')).toBe(true)
    expect(isCashOnDelivery('ps_wirepayment', 'Transfer bancar')).toBe(false)
    expect(isCashOnDelivery('codapay', 'Card')).toBe(false)
  })
})

describe('validateConnection', () => {
  it('proves the key on /api/, reads the shop facts and probes orders without ever sending the key in a URL', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes())
    const { log, calls } = fakeLogger()
    const store = await adapter.validateConnection({ storeUrl: 'https://Shop.Example.RO/api/', secrets: { webservice_key: KEY } }, log)
    expect(store).toMatchObject({
      storeUrl: STORE,
      storeDomain: 'shop.example.ro',
      displayName: 'Magazinul Meu',
      currency: 'RON',
      countryCode: 'RO',
      timezone: 'Europe/Bucharest',
      language: 'ro',
      platformVersion: '8.2.1',
      secrets: { webservice_key: KEY },
    })
    expect(store.capabilities).toEqual({
      products: true,
      customers: true,
      orders: true,
      webhooks: false,
      abandoned_carts: false,
      customer_phone: true,
      polling_minutes: PRESTASHOP_POLLING_MINUTES,
      notes: [NOTE_NO_WEBHOOKS, NOTE_NO_CARTS],
    })
    const first = fetchImpl.mock.calls[0]
    expect(String(first[0])).toBe(`${STORE}/api/`)
    const headers = new Headers(first[1]?.headers)
    expect(headers.get('authorization')).toBe(`Basic ${KEY_B64}`)
    expect(first[1]).toMatchObject({ method: 'GET', redirect: 'manual' })
    const probe = fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/api/orders')!
    const probeUrl = new URL(String(probe[0]))
    expect(probeUrl.searchParams.get('output_format')).toBe('JSON')
    expect(probeUrl.searchParams.get('display')).toBe('[id]')
    expect(probeUrl.searchParams.get('limit')).toBe('1')
    expect(new Headers(probe[1]?.headers).get('output-format')).toBe('JSON')
    const config = fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/api/configurations')!
    expect(new URL(String(config[0])).searchParams.get('filter[name]')).toBe('[PS_SHOP_NAME|PS_TIMEZONE|PS_LANG_DEFAULT|PS_CURRENCY_DEFAULT|PS_COUNTRY_DEFAULT|PS_ORDER_OUT_OF_STOCK]')
    for (const call of fetchImpl.mock.calls) expectNoSecret(String(call[0]))
    expectNoSecret(calls)
  })

  it('falls back to the listing shop name and UTC with notes when optional resources are not readable', async () => {
    const { adapter } = adapterWith(healthyRoutes({ 'GET /api/': () => xmlRes(rootXml(['orders', 'order_details', 'order_states', 'customers', 'addresses', 'products'])) }))
    const { log } = fakeLogger()
    const store = await adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, log)
    expect(store.displayName).toBe('Magazinul & Co')
    expect(store.timezone).toBeNull()
    expect(store.currency).toBeNull()
    expect(store.platformVersion).toBeNull()
    expect(store.capabilities.customer_phone).toBe(true)
    expect(store.capabilities.notes).toContain(NOTE_NO_STOCK)
    expect(store.capabilities.notes).toContain(NOTE_NO_COUNTRIES)
    expect(store.capabilities.notes).toContain(NOTE_NO_WEBHOOKS)
  })

  it('maps a bad key (401) to unauthorized without echoing the key', async () => {
    const { adapter } = adapterWith(healthyRoutes({ 'GET /api/': () => xmlRes('<?xml version="1.0"?><prestashop><errors><error><code><![CDATA[18]]></code><message><![CDATA[Invalid authentication key format]]></message></error></errors></prestashop>', 401) }))
    const err = await failure(adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(err.code).toBe('unauthorized')
    expect(err.retryable).toBe(false)
    expect(err.message).toBe('prestashop api.index: HTTP 401 (ws 18)')
    expectNoSecretInError(err)
  })

  it('maps a key without the required rights to forbidden, naming the resources', async () => {
    const { adapter } = adapterWith(healthyRoutes({ 'GET /api/': () => xmlRes(rootXml(['orders', 'customers', 'products'])) }))
    const err = await failure(adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(err.code).toBe('forbidden')
    expect(err.publicMessage).toContain('„order_details”')
    expect(err.publicMessage).toContain('„order_states”')
    expect(err.publicMessage).toContain('„addresses”')
    expectNoSecretInError(err)
  })

  it('maps the documented "resource not allowed with this key" answer (401, code 26) to forbidden', async () => {
    const { adapter } = adapterWith(healthyRoutes({ 'GET /api/order_states': () => wsError(401, 26, 'Resource of type "order_states" is not allowed with this authentication key') }))
    const err = await failure(adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(err.code).toBe('forbidden')
    expect(err.publicMessage).toContain('„order_states”')
    expect(err.message).toBe('prestashop order_states.list: HTTP 401 (ws 26)')
  })

  it('maps a disabled webservice (503, code 22) and a HTML 404 to not_a_store', async () => {
    const disabled = adapterWith(healthyRoutes({ 'GET /api/': () => wsError(503, 22, 'The PrestaShop webservice is disabled. Please activate it in the PrestaShop Back Office') }))
    const err = await failure(disabled.adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(err.code).toBe('not_a_store')
    expect(err.retryable).toBe(false)
    expect(err.publicMessage).toMatch(/dezactivat/)

    const notFound = adapterWith({})
    const err2 = await failure(notFound.adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(err2.code).toBe('not_a_store')

    const htmlOk = adapterWith({ 'GET /api/': () => new Response('<!DOCTYPE html><html><body>login</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }) })
    const err3 = await failure(htmlOk.adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(err3.code).toBe('not_a_store')
  })

  it('maps a timeout, a redirect, a server error, a rate limit and bad JSON', async () => {
    const timeout = adapterWith({ 'GET /api/': () => Promise.reject(timeoutError()) })
    const t = await failure(timeout.adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(t.code).toBe('timeout')
    expect(t.retryable).toBe(true)

    const redirect = adapterWith({ 'GET /api/': () => new Response(null, { status: 301, headers: { location: 'https://www.shop.example.ro/api/' } }) })
    const r = await failure(redirect.adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(r.code).toBe('redirect')

    const server = adapterWith(healthyRoutes({ 'GET /api/order_states': () => new Response('oops', { status: 500 }) }))
    const s = await failure(server.adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(s.code).toBe('unreachable')
    expect(s.retryable).toBe(true)

    const limited = adapterWith(healthyRoutes({ 'GET /api/': () => new Response('', { status: 429 }) }))
    const l = await failure(limited.adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(l.code).toBe('rate_limited')

    const broken = adapterWith(healthyRoutes({ 'GET /api/order_states': () => new Response('{"order_states": [', { status: 200, headers: { 'content-type': 'application/json' } }) }))
    const b = await failure(broken.adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(b.code).toBe('invalid_response')

    for (const err of [t, r, s, l, b]) expectNoSecretInError(err)
  })

  it('tells a firewall 403 from the multistore 403 (code 132) and retries an HTML 5xx page', async () => {
    const html = (status: number) => new Response('<!DOCTYPE html><html><body>blocked</body></html>', { status, headers: { 'content-type': 'text/html' } })
    const waf = adapterWith(healthyRoutes({ 'GET /api/': () => html(403) }))
    const w = await failure(waf.adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(w.code).toBe('forbidden')
    expect(w.retryable).toBe(false)
    expect(w.publicMessage).toMatch(/firewall/)
    expect(w.publicMessage).not.toMatch(/multi-magazin/)

    const shop = adapterWith(healthyRoutes({ 'GET /api/': () => wsError(403, 132, 'No permission for this key on this shop') }))
    const s = await failure(shop.adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(s.code).toBe('forbidden')
    expect(s.publicMessage).toMatch(/multi-magazin/)
    expect(s.message).toBe('prestashop api.index: HTTP 403 (ws 132)')

    const maintenance = adapterWith(healthyRoutes({ 'GET /api/orders': () => html(503) }))
    const m = await failure(maintenance.adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(m.code).toBe('unreachable')
    expect(m.retryable).toBe(true)
    for (const err of [w, s, m]) expectNoSecretInError(err)
  })

  it('refuses unsupported versions, private addresses and http URLs', async () => {
    const old = adapterWith(healthyRoutes({ 'GET /api/': () => xmlRes(rootXml(), 200, { 'psws-version': '1.6.1.24' }) }))
    const v = await failure(old.adapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(v.code).toBe('api_version_unsupported')

    const fetchImpl = storeFetch(healthyRoutes())
    const internal = createPrestaShopAdapter({ fetchImpl, lookup: async () => ['10.0.0.5'] })
    const p = await failure(internal.validateConnection({ storeUrl: STORE, secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(p.code).toBe('ssrf_blocked')
    expect(fetchImpl).not.toHaveBeenCalled()

    const h = await failure(prestaShopAdapter.validateConnection({ storeUrl: 'http://shop.example.ro', secrets: { webservice_key: KEY } }, fakeLogger().log))
    expect(h.code).toBe('invalid_url')

    const bad = await failure(prestaShopAdapter.validateConnection({ storeUrl: STORE, secrets: { webservice_key: 'nope' } }, fakeLogger().log))
    expect(bad.code).toBe('unauthorized')
    expect(bad.message).not.toContain('nope')
  })
})

describe('getCapabilities', () => {
  it('never reports webhooks or carts, whatever is stored', () => {
    const caps = prestaShopAdapter.getCapabilities(connection({ capabilities: { ...connection().capabilities, webhooks: true, abandoned_carts: true, polling_minutes: null } }))
    expect(caps.webhooks).toBe(false)
    expect(caps.abandoned_carts).toBe(false)
    expect(caps.polling_minutes).toBe(PRESTASHOP_POLLING_MINUTES)
  })
})

describe('syncPage: orders', () => {
  it('reads one page with its details, addresses and customers, normalizes and pages by offset', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes())
    const { log, calls } = fakeLogger()
    const batch = await adapter.syncPage(connection(), 'orders', checkpoint0, 'initial', log)
    expect(batch.done).toBe(true)
    expect(batch.checkpoint).toEqual({ cursor: null, modifiedAfter: null, pages: 1 })
    expect(batch.orders).toHaveLength(2)

    const [cod, wire] = batch.orders!
    expect(cod).toMatchObject({
      externalId: '42',
      orderNumber: 'XKBKNABJK',
      customerExternalId: '11',
      contactName: 'Ana Pop',
      contactPhoneRaw: '0722 123 456',
      contactEmail: 'ana@example.com',
      shippingCity: 'Cluj-Napoca',
      shippingCountry: 'RO',
      shippingSummary: 'Str. Lungă 1, ap. 3, Cluj-Napoca',
      status: 'pending',
      financialStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      paymentMethod: 'ps_cashondelivery',
      paymentMethodTitle: 'Plata ramburs (COD)',
      currency: 'RON',
      total: 159.9,
      providerCreatedAt: '2026-03-01T10:20:30.000Z',
      providerUpdatedAt: '2026-03-02T06:00:00.000Z',
      metadata: { provider_state: '13', state_name: 'În așteptarea validării plății ramburs', valid: false, is_cod: true, cart_id: '90', delivery_address_id: '7' },
    })
    expect(cod.items).toEqual([
      { externalId: '501', productExternalId: '21', sku: 'CANA-01', name: 'Cană', quantity: 2, unitPrice: 59.4405, total: 118.881 },
      { externalId: '502', productExternalId: '22', sku: 'TR-M', name: 'Tricou - Mărime : M', quantity: 1, unitPrice: 26.0015, total: 26.0015 },
    ])
    expect(cod.payloadHash).toBe(payloadHashOf({ order: ORDER_42, details: ORDER_DETAILS.filter((d) => d.id_order === '42'), address: ADDRESSES[0], customer: CUSTOMERS[0] }))
    expect(cod.payloadHash).toMatch(/^[0-9a-f]{64}$/)
    expect(wire).toMatchObject({
      externalId: '43',
      contactName: 'Max Müller',
      contactPhoneRaw: null,
      shippingCountry: 'DE',
      status: 'processing',
      financialStatus: 'paid',
      fulfillmentStatus: 'fulfilled',
      currency: 'EUR',
      total: 80,
      providerCreatedAt: '2026-07-01T09:00:00.000Z',
      metadata: { is_cod: false, valid: true },
    })
    expect(wire.items).toEqual([{ externalId: '503', productExternalId: '23', sku: null, name: 'Poster', quantity: 1, unitPrice: 80, total: 80 }])

    const pathnames = fetchImpl.mock.calls.map((c) => new URL(String(c[0])).pathname)
    expect(pathnames.filter((p) => p === '/api/orders')).toHaveLength(1)
    expect(pathnames.filter((p) => p === '/api/order_details')).toHaveLength(1)
    expect(pathnames.filter((p) => p === '/api/addresses')).toHaveLength(1)
    expect(pathnames.filter((p) => p === '/api/customers')).toHaveLength(1)
    const ordersUrl = new URL(String(fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/api/orders')![0]))
    expect(ordersUrl.searchParams.get('display')).toBe('full')
    expect(ordersUrl.searchParams.get('sort')).toBe('[id_ASC]')
    expect(ordersUrl.searchParams.get('limit')).toBe(String(ORDERS_PAGE_SIZE))
    expect(ordersUrl.searchParams.get('filter[id]')).toBeNull()
    expect(ordersUrl.searchParams.get('date')).toBeNull()
    expect(ordersUrl.searchParams.get('filter[date_upd]')).toBeNull()
    const detailsUrl = new URL(String(fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/api/order_details')![0]))
    expect(detailsUrl.searchParams.get('filter[id_order]')).toBe('[42|43]')
    const addressesUrl = new URL(String(fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/api/addresses')![0]))
    expect(addressesUrl.searchParams.get('filter[id]')).toBe('[7|8]')
    for (const call of fetchImpl.mock.calls) expectNoSecret(String(call[0]))
    expectNoSecret(calls)
    // Logs carry counts, never a phone, an e-mail or a name.
    expect(JSON.stringify(calls)).not.toMatch(/0722|ana@|Ana Pop/)
  })

  it('filters incrementally by date_upd in the shop zone (date=1) and continues after the last id of the page', async () => {
    const orders = Array.from({ length: ORDERS_PAGE_SIZE }, (_, i) => ({ ...ORDER_42, id: String(100 + i), associations: { order_rows: [] } }))
    const { adapter, fetchImpl } = adapterWith(
      healthyRoutes({
        'GET /api/orders': (url) => (afterIdOf(url) === 0 ? jsonRes({ orders }) : jsonRes({ orders: [{ ...ORDER_43, id: '200', associations: { order_rows: [] } }] })),
        'GET /api/order_details': () => jsonRes([]),
      }),
    )
    const { log } = fakeLogger()
    const first = await adapter.syncPage(connection(), 'orders', { cursor: null, modifiedAfter: '2026-03-01T10:20:30.000Z', pages: 3 }, 'incremental', log)
    expect(first.done).toBe(false)
    expect(first.checkpoint).toEqual({ cursor: '119', modifiedAfter: '2026-03-01T10:20:30.000Z', pages: 4 })
    expect(first.orders).toHaveLength(ORDERS_PAGE_SIZE)
    // No order_details rows: the order_rows association is the fallback (unit × quantity).
    expect(first.orders![0].items).toEqual([])
    const listUrl = new URL(String(fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/api/orders')![0]))
    expect(listUrl.searchParams.get('date')).toBe('1')
    // 10:20:30Z minus one second, in Europe/Bucharest (UTC+2 in March).
    expect(listUrl.searchParams.get('filter[date_upd]')).toBe('>[2026-03-01 12:20:29]')
    expect(listUrl.searchParams.get('sort')).toBe('[id_ASC]')

    const second = await adapter.syncPage(connection(), 'orders', first.checkpoint, 'incremental', log)
    expect(second.done).toBe(true)
    expect(second.checkpoint.cursor).toBeNull()
    expect(second.orders).toHaveLength(1)
    const secondUrl = new URL(String(fetchImpl.mock.calls.filter((c) => new URL(String(c[0])).pathname === '/api/orders').at(-1)![0]))
    // Keyset paging: never an offset, the page starts after the last id and keeps the date filter.
    expect(secondUrl.searchParams.get('limit')).toBe(String(ORDERS_PAGE_SIZE))
    expect(secondUrl.searchParams.get('filter[id]')).toBe('>[119]')
    expect(secondUrl.searchParams.get('filter[date_upd]')).toBe('>[2026-03-01 12:20:29]')
    expect(secondUrl.searchParams.get('date')).toBe('1')
    // The shop context (listing, configuration, states…) is cached across pages.
    expect(fetchImpl.mock.calls.filter((c) => new URL(String(c[0])).pathname === '/api/').length).toBe(1)
  })

  it('ends a pass whose full page does not move the cursor instead of looping', async () => {
    // A store that ignores filter[id] (or sort) answers the same full page forever.
    const orders = Array.from({ length: ORDERS_PAGE_SIZE }, (_, i) => ({ ...ORDER_42, id: String(100 + i), associations: { order_rows: [] } }))
    const { adapter, fetchImpl } = adapterWith(healthyRoutes({ 'GET /api/orders': () => jsonRes({ orders }), 'GET /api/order_details': () => jsonRes([]) }))
    const { log, calls } = fakeLogger()
    const first = await adapter.syncPage(connection(), 'orders', checkpoint0, 'initial', log)
    expect(first).toMatchObject({ done: false, checkpoint: { cursor: '119' } })
    const second = await adapter.syncPage(connection(), 'orders', first.checkpoint, 'initial', log)
    expect(second.done).toBe(true)
    expect(second.checkpoint.cursor).toBeNull()
    expect(fetchImpl.mock.calls.filter((c) => new URL(String(c[0])).pathname === '/api/orders')).toHaveLength(2)
    expect(calls.some((c) => (c as { event: string }).event === 'prestashop.sync.no_progress')).toBe(true)
    // A page without any usable id cannot move the cursor either.
    const broken = adapterWith(healthyRoutes({ 'GET /api/orders': () => jsonRes({ orders: orders.map((o) => ({ ...o, id: 'x' })) }), 'GET /api/order_details': () => jsonRes([]) }))
    const batch = await broken.adapter.syncPage(connection(), 'orders', checkpoint0, 'initial', fakeLogger().log)
    expect(batch).toMatchObject({ done: true, orders: [], checkpoint: { cursor: null } })
  })

  it('hashes the address and the customer with the order, so a corrected phone counts as a change', () => {
    const shop = { ...EMPTY_SHOP_CONTEXT, countries: new Map([['36', 'RO']]) }
    const base = normalizePrestaShopOrder(ORDER_42, shop, { details: ORDER_DETAILS.slice(0, 2), address: ADDRESSES[0], customer: CUSTOMERS[0] })!
    expect(base.payloadHash).toBe(payloadHashOf({ order: ORDER_42, details: ORDER_DETAILS.slice(0, 2), address: ADDRESSES[0], customer: CUSTOMERS[0] }))
    const fixedPhone = normalizePrestaShopOrder(ORDER_42, shop, { details: ORDER_DETAILS.slice(0, 2), address: { ...ADDRESSES[0], phone_mobile: '0733 999 999' }, customer: CUSTOMERS[0] })!
    expect(fixedPhone.contactPhoneRaw).toBe('0733 999 999')
    expect(fixedPhone.payloadHash).not.toBe(base.payloadHash)
    const sameAgain = normalizePrestaShopOrder(ORDER_42, shop, { details: ORDER_DETAILS.slice(0, 2), address: ADDRESSES[0], customer: CUSTOMERS[0] })!
    expect(sameAgain.payloadHash).toBe(base.payloadHash)
  })

  it('uses the order_rows association when order_details has no rows for an order', () => {
    const shop = { ...EMPTY_SHOP_CONTEXT, currencies: new Map([['1', 'RON']]) }
    const order = normalizePrestaShopOrder(ORDER_42, shop, { details: [], address: null, customer: null })
    expect(order?.items).toEqual([{ externalId: '501', productExternalId: '21', sku: 'CANA-01', name: 'Cană', quantity: 2, unitPrice: 59.4405, total: 118.881 }])
    expect(order?.status).toBe('unknown')
    expect(order?.contactPhoneRaw).toBeNull()
    expect(order?.providerCreatedAt).toBe('2026-03-01T12:20:30.000Z')
    expect(normalizePrestaShopOrder({ reference: 'X' }, shop, { details: [], address: null, customer: null })).toBeNull()
  })

  it('propagates a lost permission during a sync as forbidden', async () => {
    const { adapter } = adapterWith(healthyRoutes({ 'GET /api/order_details': () => wsError(401, 26, 'Resource of type "order_details" is not allowed with this authentication key') }))
    const err = await failure(adapter.syncPage(connection(), 'orders', checkpoint0, 'initial', fakeLogger().log))
    expect(err.code).toBe('forbidden')
    expect(err.publicMessage).toContain('„order_details”')
    expectNoSecretInError(err)
  })
})

describe('syncPage: customers and products', () => {
  it('reads customers with the phone of their latest non-deleted address and skips deleted accounts', async () => {
    const { adapter, fetchImpl } = adapterWith(
      healthyRoutes({
        'GET /api/customers': () => jsonRes({ customers: [...CUSTOMERS, { ...CUSTOMERS[0], id: '13', deleted: '1' }] }),
        'GET /api/addresses': () =>
          jsonRes({
            addresses: [
              { id: '7', id_customer: '11', id_country: '36', phone: '0264 123 456', phone_mobile: '', deleted: '0', date_upd: '2026-01-01 10:00:00' },
              { id: '9', id_customer: '11', id_country: '8', phone: '', phone_mobile: '+49 170 0000000', deleted: '0', date_upd: '2026-02-01 10:00:00' },
              { id: '10', id_customer: '11', id_country: '36', phone: '', phone_mobile: '0700 000 000', deleted: '1', date_upd: '2026-03-01 10:00:00' },
              { id: '8', id_customer: '12', id_country: '8', phone: '', phone_mobile: '', deleted: '0', date_upd: '2026-02-01 10:00:00' },
            ],
          }),
      }),
    )
    const { log, calls } = fakeLogger()
    const batch = await adapter.syncPage(connection(), 'customers', checkpoint0, 'initial', log)
    expect(batch.done).toBe(true)
    expect(batch.customers).toHaveLength(2)
    expect(batch.customers![0]).toMatchObject({
      externalId: '11',
      email: 'ana@example.com',
      firstName: 'Ana',
      lastName: 'Pop',
      phoneRaw: '+49 170 0000000',
      countryCode: 'DE',
      marketingConsent: true,
      callConsent: null,
      providerCreatedAt: '2025-12-24T07:30:00.000Z',
      providerUpdatedAt: '2026-01-05T08:00:00.000Z',
      metadata: { active: true, is_guest: false, phone_address_id: '9' },
    })
    expect(batch.customers![1]).toMatchObject({ externalId: '12', phoneRaw: null, countryCode: null, marketingConsent: false })
    const listUrl = new URL(String(fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/api/customers')![0]))
    expect(listUrl.searchParams.get('display')).not.toContain('passwd')
    expect(listUrl.searchParams.get('limit')).toBe(String(CUSTOMERS_PAGE_SIZE))
    expect(listUrl.searchParams.get('sort')).toBe('[id_ASC]')
    const addressesUrl = new URL(String(fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/api/addresses')![0]))
    expect(addressesUrl.searchParams.get('filter[id_customer]')).toBe('[11|12]')
    expect(JSON.stringify(calls)).not.toMatch(/0264|\+49|ana@/)
  })

  it('reads products with the default-language name and the product-level stock row', async () => {
    const { adapter, fetchImpl } = adapterWith(
      healthyRoutes({
        'GET /api/products': () =>
          jsonRes({
            products: [
              { id: '21', name: i18n('Mug', 'Cană'), reference: 'CANA-01', price: '49.950000', active: '1', date_add: '2026-01-01 00:00:00', date_upd: '2026-02-01 10:00:00' },
              { id: '22', name: 'Tricou', reference: '', price: '21.850000', active: '0', date_add: '2026-01-01 00:00:00', date_upd: '2026-02-01 10:00:00' },
              { id: '23', name: i18n('Poster', 'Poster'), reference: 'PST', price: '67.226891', active: '1', date_add: '2026-01-01 00:00:00', date_upd: '2026-02-01 10:00:00' },
            ],
          }),
        'GET /api/stock_availables': (url) => {
          expect(url.searchParams.get('filter[id_product]')).toBe('[21|22|23]')
          expect(url.searchParams.get('filter[id_product_attribute]')).toBe('[0]')
          return jsonRes({
            stock_availables: [
              { id: '1', id_product: '21', id_product_attribute: '0', quantity: '12', out_of_stock: '2' },
              { id: '2', id_product: '22', id_product_attribute: '0', quantity: '0', out_of_stock: '1' },
              { id: '3', id_product: '22', id_product_attribute: '120', quantity: '0', out_of_stock: '1' },
            ],
          })
        },
      }),
    )
    const batch = await adapter.syncPage(connection(), 'products', checkpoint0, 'initial', fakeLogger().log)
    expect(batch.done).toBe(true)
    expect(batch.products).toHaveLength(3)
    expect(batch.products![0]).toEqual({
      externalId: '21',
      sku: 'CANA-01',
      name: 'Cană',
      status: 'active',
      price: 49.95,
      currency: 'RON',
      stockStatus: 'in_stock',
      stockQuantity: 12,
      url: `${STORE}/index.php?controller=product&id_product=21`,
      providerUpdatedAt: '2026-02-01T08:00:00.000Z',
      metadata: { price_includes_tax: false, payload_hash: expect.stringMatching(/^[0-9a-f]{64}$/) },
    })
    expect(batch.products![1]).toMatchObject({ externalId: '22', sku: null, name: 'Tricou', status: 'draft', stockStatus: 'on_backorder', stockQuantity: 0 })
    expect(batch.products![2]).toMatchObject({ externalId: '23', stockStatus: 'unknown', stockQuantity: null })
    const listUrl = new URL(String(fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/api/products')![0]))
    expect(listUrl.searchParams.get('limit')).toBe(String(PRODUCTS_PAGE_SIZE))
    expect(listUrl.searchParams.get('display')).toBe('[id,name,reference,price,active,date_add,date_upd]')
  })

  it('reports stock as unknown without the stock_availables right and never asks for it', async () => {
    const readable = ALL_RESOURCES.filter((r) => r !== 'stock_availables')
    const { adapter, fetchImpl } = adapterWith(
      healthyRoutes({
        'GET /api/': () => xmlRes(rootXml(readable)),
        'GET /api/products': () => jsonRes({ products: [{ id: '21', name: 'Cană', reference: 'CANA-01', price: '49.950000', active: '1', date_add: '2026-01-01 00:00:00', date_upd: '2026-02-01 10:00:00' }] }),
      }),
    )
    const batch = await adapter.syncPage(connection(), 'products', checkpoint0, 'initial', fakeLogger().log)
    expect(batch.products![0].stockStatus).toBe('unknown')
    expect(fetchImpl.mock.calls.some((c) => new URL(String(c[0])).pathname === '/api/stock_availables')).toBe(false)
  })

  it('returns an empty, finished batch for carts and an empty page as done', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes({ 'GET /api/customers': () => jsonRes([]) }))
    const carts = await adapter.syncPage(connection(), 'carts', { cursor: '5', modifiedAfter: null, pages: 1 }, 'initial', fakeLogger().log)
    expect(carts).toEqual({ resource: 'carts', carts: [], checkpoint: { cursor: null, modifiedAfter: null, pages: 1 }, done: true })
    expect(fetchImpl).not.toHaveBeenCalled()
    const customers = await adapter.syncPage(connection(), 'customers', checkpoint0, 'initial', fakeLogger().log)
    expect(customers).toEqual({ resource: 'customers', customers: [], checkpoint: { cursor: null, modifiedAfter: null, pages: 1 }, done: true })
  })

  it('refreshes the cached shop context after its lifetime', async () => {
    let clock = 1_000_000
    const { adapter, fetchImpl } = adapterWith(healthyRoutes({ 'GET /api/products': () => jsonRes([]) }), () => clock)
    const { log } = fakeLogger()
    await adapter.syncPage(connection(), 'products', checkpoint0, 'initial', log)
    await adapter.syncPage(connection(), 'products', checkpoint0, 'initial', log)
    expect(fetchImpl.mock.calls.filter((c) => new URL(String(c[0])).pathname === '/api/').length).toBe(1)
    clock += 16 * 60_000
    await adapter.syncPage(connection(), 'products', checkpoint0, 'initial', log)
    expect(fetchImpl.mock.calls.filter((c) => new URL(String(c[0])).pathname === '/api/').length).toBe(2)
  })
})

describe('webhooks', () => {
  it('registers nothing, with or without a public URL, and unregisters without I/O', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes())
    const { log, calls } = fakeLogger()
    expect(await adapter.registerWebhooks(connection(), log)).toEqual([])
    expect(await adapter.registerWebhooks(connection({ webhookUrl: null }), log)).toEqual([])
    await expect(adapter.unregisterWebhooks(connection({ webhookRegistrations: [{ topic: 'orders', externalId: '1', source: 'manual' }] }), log)).resolves.toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
    expectNoSecret(calls)
  })

  it('refuses every delivery as not supported, even a well-formed signed one, and never throws', async () => {
    const body = JSON.stringify({ id: 42 })
    const signature = crypto.createHmac('sha256', KEY).update(body).digest('base64')
    const request = { headers: new Headers({ 'x-signature': signature, 'content-type': 'application/json' }), rawBody: new TextEncoder().encode(body), url: new URL(WEBHOOK_URL) }
    expect(await prestaShopAdapter.verifyWebhook(request, connection())).toEqual({ ok: false, reason: 'not_supported', status: 400 })
    const garbage = { headers: new Headers(), rawBody: new Uint8Array([0xff, 0xfe]), url: new URL(WEBHOOK_URL) }
    expect(await prestaShopAdapter.verifyWebhook(garbage, connection())).toEqual({ ok: false, reason: 'not_supported', status: 400 })
  })

  it('normalizes any event to ignored', () => {
    const events = prestaShopAdapter.normalizeEvent({ ok: true, topic: 'order.created', deliveryId: null, externalResourceId: '42', payload: ORDER_42 }, connection())
    expect(events).toEqual([{ kind: 'ignored', reason: 'webhooks_not_supported:order.created' }])
  })
})

describe('fetch helpers', () => {
  it('reads one order by id through the filtered list and returns null when it does not exist', async () => {
    const { adapter, fetchImpl } = adapterWith(healthyRoutes())
    const { log } = fakeLogger()
    const order = await adapter.fetchOrder(connection(), '42', log)
    expect(order).toMatchObject({ externalId: '42', contactPhoneRaw: '0722 123 456', items: expect.arrayContaining([expect.objectContaining({ externalId: '501' })]) })
    const url = new URL(String(fetchImpl.mock.calls.find((c) => new URL(String(c[0])).pathname === '/api/orders')![0]))
    expect(url.searchParams.get('filter[id]')).toBe('[42]')
    expect(url.searchParams.get('display')).toBe('full')
    expect(await adapter.fetchOrder(connection(), '999', log)).toBeNull()
    expect(await adapter.fetchOrder(connection(), 'abc', log)).toBeNull()
  })

  it('reads one customer and one product', async () => {
    const { adapter } = adapterWith(
      healthyRoutes({
        'GET /api/products': (url) => (url.searchParams.get('filter[id]') === '[21]' ? jsonRes({ products: [{ id: '21', name: 'Cană', reference: 'CANA-01', price: '49.950000', active: '1', date_add: '2026-01-01 00:00:00', date_upd: '2026-02-01 10:00:00' }] }) : jsonRes([])),
        'GET /api/stock_availables': () => jsonRes({ stock_availables: [{ id: '1', id_product: '21', id_product_attribute: '0', quantity: '3', out_of_stock: '0' }] }),
      }),
    )
    const { log } = fakeLogger()
    expect(await adapter.fetchCustomer(connection(), '11', log)).toMatchObject({ externalId: '11', phoneRaw: '0722 123 456', countryCode: 'RO' })
    expect(await adapter.fetchCustomer(connection(), '77', log)).toBeNull()
    expect(await adapter.fetchProduct(connection(), '21', log)).toMatchObject({ externalId: '21', stockStatus: 'in_stock', stockQuantity: 3 })
    expect(await adapter.fetchProduct(connection(), '22', log)).toBeNull()
  })

  it('refuses malformed stored secrets without echoing them', async () => {
    const err = await failure(prestaShopAdapter.fetchOrder(connection({ secrets: { webservice_key: 'bad-key' } }), '42', fakeLogger().log))
    expect(err.code).toBe('unauthorized')
    expect(err.message).not.toContain('bad-key')
  })
})
