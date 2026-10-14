import 'server-only'
// WooCommerce adapter: REST API v3 (/wp-json/wc/v3) over HTTPS with the
// merchant's consumer key/secret as HTTP Basic credentials.
//
// Verified against the official documentation on 2026-10-13:
//   • https://woocommerce.github.io/woocommerce-rest-api-docs/ (WP REST API v3:
//     authentication, pagination headers X-WP-Total / X-WP-TotalPages, orders,
//     customers, products, webhooks, system status, setting options);
//   • https://developer.wordpress.org/rest-api/using-the-rest-api/pagination/
//     (per_page is capped at 100 by WordPress core);
//   • https://woocommerce.com/document/webhooks/ (statuses, auto-disable after
//     more than five consecutive non-2xx deliveries, secret);
//   • WooCommerce core source (trunk): includes/class-wc-webhook.php (delivery
//     headers, signature = base64(HMAC-SHA256(body, secret)), the unsigned
//     "webhook_id=<id>" ping sent on creation), includes/class-wc-rest-
//     authentication.php (read keys are refused with 401 on POST/PUT/DELETE
//     before the handler runs), rest-api/Controllers/Version3/class-wc-rest-
//     webhooks-controller.php (webhooks created on wc/v3 deliver wp_api_v3
//     payloads, the same shape the sync reads).
//
// What the platform offers and how this adapter uses it:
//   • orders and products accept `modified_after` (+ `dates_are_gmt`, both in
//     Controllers/Version3/class-wc-rest-crud-controller.php), so incremental
//     syncs are server-side filtered. Every scan is ordered by id: the API
//     paginates by offset, and ordering by a key that moves while the scan runs
//     (`modified`) makes a record that is edited mid-scan jump behind the cursor
//     and the one after it slide into an already-read page (skipped for good).
//     Ordered by id, an edit can only push records forward (re-read, upserted
//     again), never skip one; stores older than 5.8 ignore the filter instead
//     of refusing `orderby=modified` with 400;
//   • `date_paid` is not a payment proof: WC_Order::maybe_set_date_paid()
//     stamps it as soon as an order reaches `processing`, which the cash-on-
//     delivery gateway does at checkout (class-wc-gateway-cod.php), so COD
//     orders count as unpaid until they are completed;
//   • customers have no date filter at all (orderby: id | include | name |
//     registered_date), so every customer sync is a full scan ordered by id,
//     bounded by the worker's page budget; customer.updated webhooks carry the
//     real-time changes;
//   • abandoned carts do not exist in the standard REST API. They only arrive
//     from the documented companion plugin as a merchant-registered webhook
//     with topic `ntv.cart.updated` (same signature scheme, see CART_TOPIC);
//   • the API key's permission level is not readable from any endpoint; it is
//     probed at validation with a write request that cannot create anything.
//
// Secrets (consumer key/secret, webhook secret) never reach a log field, an
// error message or a URL: authentication travels in the Authorization header.

import crypto from 'node:crypto'
import { z } from 'zod'
import type { Logger } from '@/lib/observability/logger'
import { randomToken } from '../crypto'
import { StoreHttpError, UnsafeUrlError, safeFetch } from '../safe-fetch'
import type {
  CartStatus,
  CommerceCapabilities,
  CommerceEvent,
  FinancialStatus,
  FulfillmentStatus,
  NormalizedCart,
  NormalizedCustomer,
  NormalizedOrder,
  NormalizedOrderItem,
  NormalizedProduct,
  OrderStatus,
  ProductStatus,
  StockStatus,
  SyncResource,
} from '../types'
import {
  ConnectionError,
  type AdapterConnection,
  type CommerceAdapter,
  type ConnectInput,
  type ConnectionSecrets,
  type RawWebhookRequest,
  type SyncBatch,
  type SyncCheckpoint,
  type ValidatedStore,
  type VerificationFailure,
  type VerifiedCommerceEvent,
  type WebhookRegistration,
} from './types'

/**
 * REST API namespace this adapter speaks. v3 requires WooCommerce 3.5+ and
 * WordPress 4.4+ with pretty permalinks
 * (https://woocommerce.github.io/woocommerce-rest-api-docs/#introduction, read 2026-10-13).
 */
export const WOOCOMMERCE_API_VERSION = 'wc/v3'
const API_PATH = `/wp-json/${WOOCOMMERCE_API_VERSION}`
/** WordPress root index (site name, time zone); public, documented in WP core WP_REST_Server::get_index. */
const WP_ROOT_PATH = '/wp-json/'

/** WordPress core caps per_page at 100. Orders carry line items and plugin meta, so they get a smaller page. */
const PAGE_SIZE = 100
const ORDERS_PAGE_SIZE = 50
/** Listing pages read when looking for our own webhooks (a store with >1000 webhooks is not a real case). */
const WEBHOOK_LIST_PAGE_CAP = 10
const LIST_TIMEOUT_MS = 30_000
const LIST_MAX_BYTES = 8 * 1024 * 1024
/** Polling cadence reported when the key cannot register webhooks. */
const READ_ONLY_POLLING_MINUTES = 15

/** Core topics registered for every connection (wc_is_webhook_valid_topic accepts them). */
export const WOOCOMMERCE_WEBHOOK_TOPICS = ['order.created', 'order.updated', 'product.updated', 'customer.updated'] as const

/**
 * Topic of the companion plugin's cart webhook (registered by the merchant,
 * delivered by WooCommerce with the same X-WC-Webhook-* headers and signature).
 * Expected JSON body:
 *   { cart_id, customer: { phone, email, first_name, last_name, country?, id? },
 *     items: [{ name, quantity }], total, currency, abandoned_at, status,
 *     recovered_order_id?, updated_at? }
 * `status` is one of open | abandoned | recovered | expired.
 */
export const CART_TOPIC = 'ntv.cart.updated'

/** Merchant-facing notes (Romanian) stored in capabilities.notes. */
export const NOTE_READ_ONLY_KEY = 'Cheia are doar drepturi de citire: datele ajung prin sincronizare periodică.'
export const NOTE_NO_WEBHOOK_PERMISSION = 'Utilizatorul cheii nu poate administra webhook-uri WooCommerce: datele ajung prin sincronizare periodică.'
export const NOTE_WEBHOOKS_UNVERIFIED = 'Înregistrarea webhook-urilor nu a putut fi verificată: datele ajung prin sincronizare periodică.'
export const NOTE_NO_CART_SOURCE = 'Coșurile abandonate nu există în API-ul standard WooCommerce: apar doar după instalarea plugin-ului companion.'
export const NOTE_NO_STORE_INFO = 'Cheia nu poate citi starea magazinului (nume, monedă, țară): utilizatorul cheii nu administrează WooCommerce.'

/**
 * Connect-form secrets. WooCommerce issues `ck_` + 40 hex and `cs_` + 40 hex
 * (wc_rand_hash); the shape is checked loosely so a store with customised key
 * generation still connects. `webhook_secret` is generated at validation and
 * stored with the keys.
 */
export const WooCommerceSecretsSchema = z.object({
  consumer_key: z.string().trim().regex(/^ck_[A-Za-z0-9]{8,120}$/, 'Consumer key must start with ck_'),
  consumer_secret: z.string().trim().regex(/^cs_[A-Za-z0-9]{8,120}$/, 'Consumer secret must start with cs_'),
  webhook_secret: z.string().trim().min(16).max(200).optional(),
})
export type WooCommerceSecrets = z.infer<typeof WooCommerceSecretsSchema>

export interface WooCommerceAdapterDeps {
  fetchImpl?: typeof fetch
  /** DNS resolver handed to the SSRF guard (tests resolve to a public address). */
  lookup?: (hostname: string) => Promise<string[]>
  /** Generator of the webhook secret stored at validation. */
  randomSecret?: () => string
}

// ─── Store URL ────────────────────────────────────────────────────────────────

/**
 * Canonical base URL of the WordPress install: https, lower-case host, no
 * query/hash, no trailing slash. A pasted API root (…/wp-json/…) is reduced to
 * the install; a sub-directory install (https://host/shop) keeps its path
 * because the API lives under it.
 */
export function canonicalStoreUrl(raw: string): { storeUrl: string; storeDomain: string } {
  const text = raw.trim()
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
  } catch (err) {
    throw new ConnectionError('invalid_url', 'Adresa magazinului nu este validă.', false, `store url: ${err instanceof Error ? err.message : 'parse failed'}`)
  }
  if (url.protocol !== 'https:') throw new ConnectionError('invalid_url', 'Adresa magazinului trebuie să înceapă cu https://.', false, 'store url: not https')
  if (url.username || url.password) throw new ConnectionError('invalid_url', 'Adresa magazinului nu poate conține utilizator și parolă.', false, 'store url: credentials')
  let path = url.pathname.replace(/\/wp-json(\/.*)?$/, '').replace(/\/+$/, '')
  if (path === '/') path = ''
  const host = url.hostname.toLowerCase()
  const origin = `https://${host}${url.port ? `:${url.port}` : ''}`
  return { storeUrl: `${origin}${path}`, storeDomain: host }
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

interface WcContext {
  storeUrl: string
  /** Value of the Authorization header (Basic consumer_key:consumer_secret). */
  authorization: string
}

interface WcRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** Path under /wp-json/wc/v3 (api 'wc') or under /wp-json/ (api 'wp'). */
  path: string
  api?: 'wc' | 'wp'
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  timeoutMs?: number
  maxBytes?: number
}

interface WcResponse {
  status: number
  headers: Headers
  json: unknown
  text: string
}

function contextFor(storeUrl: string, secrets: WooCommerceSecrets): WcContext {
  return {
    storeUrl,
    authorization: `Basic ${Buffer.from(`${secrets.consumer_key}:${secrets.consumer_secret}`, 'utf8').toString('base64')}`,
  }
}

function parseSecrets(secrets: ConnectionSecrets): WooCommerceSecrets {
  const parsed = WooCommerceSecretsSchema.safeParse(secrets)
  if (!parsed.success) {
    throw new ConnectionError(
      'unauthorized',
      'Cheile API WooCommerce lipsesc sau au un format greșit (Consumer key începe cu ck_, Consumer secret cu cs_).',
      false,
      'woocommerce secrets: invalid shape',
    )
  }
  return parsed.data
}

/** The documented WooCommerce/WP error code of a JSON error body (a machine token, never the message). */
function errorCodeOf(json: unknown): string | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const code = (json as { code?: unknown }).code
  return typeof code === 'string' && /^[a-z0-9_.-]{1,80}$/i.test(code) ? code : null
}

function looksLikeHtml(res: WcResponse): boolean {
  return res.json === undefined && /^\s*<(!doctype|html|head|body|script|div)/i.test(res.text.slice(0, 512))
}

function unsafeUrlFailure(err: UnsafeUrlError): ConnectionError {
  const reason = err.reason
  if (/private or reserved|resolves to a private|local hosts/.test(reason)) {
    return new ConnectionError('ssrf_blocked', 'Adresa magazinului indică o rețea privată sau locală; este necesară o adresă publică.', false, `store url: ${reason}`)
  }
  if (/does not resolve/.test(reason)) return new ConnectionError('unreachable', 'Domeniul magazinului nu poate fi rezolvat (DNS).', true, `store url: ${reason}`)
  return new ConnectionError('invalid_url', 'Adresa magazinului nu este validă (doar https, fără port neobișnuit).', false, `store url: ${reason}`)
}

function transportFailure(err: StoreHttpError, operation: string): ConnectionError {
  switch (err.code) {
    case 'timeout':
      return new ConnectionError('timeout', 'Magazinul nu a răspuns la timp.', true, `woocommerce ${operation}: timeout`)
    case 'redirect':
      return new ConnectionError('redirect', 'Magazinul redirecționează către altă adresă; folosește adresa finală (https, cu sau fără www).', false, `woocommerce ${operation}: redirect ${err.status ?? ''}`.trim())
    case 'too_large':
      return new ConnectionError('invalid_response', 'Răspunsul magazinului este prea mare.', false, `woocommerce ${operation}: response too large`)
    case 'network':
    case 'http':
      return new ConnectionError('unreachable', 'Magazinul nu a putut fi contactat.', true, `woocommerce ${operation}: ${err.code}`)
  }
}

/** Classifies a non-2xx answer; `write` tells 401 apart (a read-only key is refused with 401 on writes). */
function httpFailure(res: WcResponse, operation: string, write = false): ConnectionError {
  const code = errorCodeOf(res.json)
  const detail = `woocommerce ${operation}: HTTP ${res.status}${code ? ` (${code})` : ''}`
  if (res.status === 401 && write) {
    return new ConnectionError('forbidden', 'Cheia API nu a fost acceptată pentru scriere: are nevoie de permisiuni Citire/Scriere și să nu fi fost revocată.', false, detail)
  }
  if (res.status === 401 && code && code !== 'woocommerce_rest_authentication_error') {
    // No authentication error at all (e.g. woocommerce_rest_cannot_view): WooCommerce never saw a usable
    // key. Either the consumer key does not exist (class-wc-rest-authentication.php answers nothing for an
    // unknown key) or the host dropped the Authorization header / is_ssl() is false behind a proxy.
    return new ConnectionError(
      'unauthorized',
      'Magazinul nu a recunoscut cheile API: Consumer key inexistent, sau serverul nu transmite antetul Authorization către WordPress (găzduire CGI/FastCGI ori HTTPS nedetectat în spatele unui proxy).',
      false,
      detail,
    )
  }
  if (res.status === 401) return new ConnectionError('unauthorized', 'Cheile API nu au fost acceptate de magazin. Verifică Consumer key și Consumer secret (permisiuni Citire/Scriere).', false, detail)
  if (res.status === 403) return new ConnectionError('forbidden', 'Cheia API nu are permisiunile necesare: utilizatorul cheii trebuie să poată administra WooCommerce.', false, detail)
  if (res.status === 404 || looksLikeHtml(res)) {
    return new ConnectionError('not_a_store', 'La această adresă nu răspunde API-ul REST WooCommerce. Verifică adresa și că permalink-urile „pretty” sunt active.', false, detail)
  }
  if (res.status === 429) return new ConnectionError('rate_limited', 'Magazinul limitează cererile; încearcă din nou în câteva minute.', true, detail)
  if (res.status >= 500) return new ConnectionError('unreachable', 'Magazinul a răspuns cu o eroare de server; încearcă din nou.', true, detail)
  return new ConnectionError('invalid_response', 'Magazinul a răspuns neașteptat.', false, detail)
}

function invalidResponse(operation: string, what: string): ConnectionError {
  return new ConnectionError('invalid_response', 'Răspunsul magazinului nu are formatul așteptat.', false, `woocommerce ${operation}: ${what}`)
}

async function wcRequest(deps: WooCommerceAdapterDeps, ctx: WcContext, operation: string, req: WcRequest): Promise<WcResponse> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (value !== undefined) params.set(key, String(value))
  }
  const base = req.api === 'wp' ? `${ctx.storeUrl}${WP_ROOT_PATH}` : `${ctx.storeUrl}${API_PATH}${req.path}`
  const search = params.toString()
  const url = search ? `${base}?${search}` : base
  const headers: Record<string, string> = { authorization: ctx.authorization }
  if (req.body !== undefined) headers['content-type'] = 'application/json'
  try {
    return await safeFetch(url, {
      method: req.method ?? 'GET',
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      timeoutMs: req.timeoutMs,
      maxBytes: req.maxBytes,
      fetchImpl: deps.fetchImpl,
      lookup: deps.lookup,
    })
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw unsafeUrlFailure(err)
    if (err instanceof StoreHttpError) throw transportFailure(err, operation)
    throw err
  }
}

// ─── Value helpers ────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>

function obj(value: unknown): Obj {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {}
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text : null
}

/** WooCommerce money fields are decimal strings ("59.90"); line item prices are numbers. */
function money(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function integer(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^-?\d{1,15}$/.test(value.trim())) return Number(value)
  return null
}

/** An external id as WooCommerce reports it (integer id, or a string id from the companion plugin). */
function externalIdOf(value: unknown): string | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return String(value)
  if (typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value.trim())) return value.trim()
  return null
}

/**
 * ISO string of a WooCommerce date. The `*_gmt` fields carry no offset
 * ("2026-03-01T10:20:30"), so one is appended; a value with an explicit
 * offset or Z is kept as given.
 */
function isoFromGmt(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`
  const ms = Date.parse(withZone)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/** ISO 3166-1 alpha-2 from a WooCommerce country field ("RO" or "RO:B" for country:state). */
function countryCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cc = value.trim().split(':')[0].toUpperCase()
  return /^[A-Z]{2}$/.test(cc) ? cc : null
}

function currencyCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : null
}

function fullName(first: unknown, last: unknown): string | null {
  const name = [nonEmpty(first), nonEmpty(last)].filter((v): v is string => !!v).join(' ')
  return name || null
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const source = value as Obj
    const out: Obj = {}
    for (const key of Object.keys(source).sort()) out[key] = sortKeys(source[key])
    return out
  }
  return value
}

/** sha256 of the stable JSON (sorted keys) of the source record without its HAL `_links`. */
export function payloadHashOf(record: Obj): string {
  const { _links: _ignored, ...rest } = record
  return crypto.createHash('sha256').update(JSON.stringify(sortKeys(rest))).digest('hex')
}

function pageOf(cursor: string | null): number {
  if (cursor && /^\d{1,7}$/.test(cursor)) return Math.max(1, Number(cursor))
  return 1
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

/**
 * Order status (wc-* post statuses as the REST API returns them, plus the
 * block-checkout draft) → OrderStatus. `trash` and extension statuses are
 * `unknown`: automations never act on them.
 */
const ORDER_STATUS: Record<string, OrderStatus> = {
  pending: 'pending',
  processing: 'processing',
  'on-hold': 'on_hold',
  completed: 'completed',
  cancelled: 'cancelled',
  refunded: 'refunded',
  failed: 'failed',
  'checkout-draft': 'draft',
}

const PRODUCT_STATUS: Record<string, ProductStatus> = {
  publish: 'active',
  draft: 'draft',
  pending: 'draft',
  // Private products are hidden from the shop (closest to archived).
  private: 'archived',
}

const STOCK_STATUS: Record<string, StockStatus> = {
  instock: 'in_stock',
  outofstock: 'out_of_stock',
  onbackorder: 'on_backorder',
}

const CART_STATUS: Record<string, CartStatus> = { open: 'open', abandoned: 'abandoned', recovered: 'recovered', expired: 'expired' }

/** Core gateway id of WooCommerce's cash-on-delivery gateway (class-wc-gateway-cod.php). */
const COD_GATEWAY_ID = 'cod'
/** Third-party COD gateways (Romanian couriers, "ramburs" plugins) are recognised by id or title. */
const COD_METHOD_RE = /\b(cod|ramburs|cash on delivery|cashondelivery|cash_on_delivery|numerar la livrare|plata la livrare)\b/i

function isCashOnDelivery(raw: Obj): boolean {
  const id = nonEmpty(raw.payment_method)?.toLowerCase() ?? ''
  if (id === COD_GATEWAY_ID) return true
  const title = nonEmpty(raw.payment_method_title) ?? ''
  // Gateway ids are snake/kebab case (fan_courier_cod, ps-cashondelivery): separators become word boundaries.
  return COD_METHOD_RE.test(id.replace(/[_-]+/g, ' ')) || COD_METHOD_RE.test(title)
}

/**
 * Financial status: WooCommerce has no separate payment state, so it is
 * derived: status refunded → refunded; date_paid set → paid; otherwise
 * pending (unpaid, failed, cancelled before payment).
 *
 * Cash on delivery is the exception. WC_Order::maybe_set_date_paid() stamps
 * date_paid when an order reaches the payment-complete status (`processing`),
 * and the COD gateway moves every order there at checkout before any money
 * changes hands, so for COD the stamp is not a payment: the order stays
 * `pending` until it is completed (delivered and collected). Without this the
 * cash-on-delivery confirmation automation would see every COD order as paid.
 */
function financialStatusOf(status: OrderStatus, raw: Obj): FinancialStatus {
  if (status === 'refunded') return 'refunded'
  const stamped = !!(nonEmpty(raw.date_paid_gmt) || nonEmpty(raw.date_paid))
  if (!stamped) return 'pending'
  if (isCashOnDelivery(raw) && status !== 'completed') return 'pending'
  return 'paid'
}

/** Fulfilment: WooCommerce marks shipment by moving the order to completed; everything else is unfulfilled. */
function fulfillmentStatusOf(status: OrderStatus): FulfillmentStatus {
  return status === 'completed' ? 'fulfilled' : 'unfulfilled'
}

function normalizeOrderItem(raw: unknown): NormalizedOrderItem | null {
  const item = obj(raw)
  const externalId = externalIdOf(item.id)
  if (!externalId) return null
  const productId = integer(item.product_id)
  return {
    externalId,
    // Variations are not mirrored (separate endpoint): the parent product id is the reference.
    productExternalId: productId && productId > 0 ? String(productId) : null,
    sku: nonEmpty(item.sku),
    name: nonEmpty(item.name) ?? `#${externalId}`,
    quantity: Math.max(0, integer(item.quantity) ?? 0),
    unitPrice: money(item.price),
    total: money(item.total),
  }
}

/** Normalizes a wc/v3 order (list item, single read or webhook payload). Null when it has no id. */
export function normalizeWooOrder(raw: unknown): NormalizedOrder | null {
  const order = obj(raw)
  const externalId = externalIdOf(order.id)
  if (!externalId) return null
  const billing = obj(order.billing)
  const shipping = obj(order.shipping)
  const status = ORDER_STATUS[String(order.status ?? '')] ?? 'unknown'
  const customerId = integer(order.customer_id)
  const shippingSource = nonEmpty(shipping.address_1) || nonEmpty(shipping.city) ? shipping : billing
  const summary = [nonEmpty(shippingSource.address_1), nonEmpty(shippingSource.address_2), nonEmpty(shippingSource.city)].filter((v): v is string => !!v).join(', ')
  const items = (Array.isArray(order.line_items) ? order.line_items : []).map(normalizeOrderItem).filter((i): i is NormalizedOrderItem => !!i)
  return {
    externalId,
    orderNumber: nonEmpty(order.number) ?? externalId,
    // customer_id 0 = guest checkout.
    customerExternalId: customerId && customerId > 0 ? String(customerId) : null,
    contactName: fullName(billing.first_name, billing.last_name) ?? fullName(shipping.first_name, shipping.last_name),
    // billing.phone is the documented field; shipping.phone exists on newer stores and is read when present.
    contactPhoneRaw: nonEmpty(billing.phone) ?? nonEmpty(shipping.phone),
    contactEmail: nonEmpty(billing.email),
    shippingCity: nonEmpty(shipping.city) ?? nonEmpty(billing.city),
    shippingCountry: countryCode(shipping.country) ?? countryCode(billing.country),
    shippingSummary: summary || null,
    status,
    financialStatus: financialStatusOf(status, order),
    fulfillmentStatus: fulfillmentStatusOf(status),
    // Gateway id ('cod' = cash on delivery) and its merchant-facing title.
    paymentMethod: nonEmpty(order.payment_method),
    paymentMethodTitle: nonEmpty(order.payment_method_title),
    currency: currencyCode(order.currency),
    total: money(order.total),
    items,
    providerCreatedAt: isoFromGmt(order.date_created_gmt) ?? isoFromGmt(order.date_created),
    providerUpdatedAt: isoFromGmt(order.date_modified_gmt) ?? isoFromGmt(order.date_modified),
    payloadHash: payloadHashOf(order),
    metadata: {
      provider_status: nonEmpty(order.status),
      billing_country: countryCode(billing.country),
      created_via: nonEmpty(order.created_via),
      date_paid: isoFromGmt(order.date_paid_gmt) ?? isoFromGmt(order.date_paid),
      date_completed: isoFromGmt(order.date_completed_gmt) ?? isoFromGmt(order.date_completed),
    },
  }
}

/** Normalizes a wc/v3 customer. v3 carries no orders_count / total_spent and no consent flags. */
export function normalizeWooCustomer(raw: unknown): NormalizedCustomer | null {
  const customer = obj(raw)
  const externalId = externalIdOf(customer.id)
  if (!externalId) return null
  const billing = obj(customer.billing)
  const shipping = obj(customer.shipping)
  return {
    externalId,
    email: nonEmpty(customer.email) ?? nonEmpty(billing.email),
    firstName: nonEmpty(customer.first_name) ?? nonEmpty(billing.first_name),
    lastName: nonEmpty(customer.last_name) ?? nonEmpty(billing.last_name),
    phoneRaw: nonEmpty(billing.phone) ?? nonEmpty(shipping.phone),
    countryCode: countryCode(billing.country) ?? countryCode(shipping.country),
    marketingConsent: null,
    callConsent: null,
    ordersCount: null,
    totalSpent: null,
    providerCreatedAt: isoFromGmt(customer.date_created_gmt) ?? isoFromGmt(customer.date_created),
    providerUpdatedAt: isoFromGmt(customer.date_modified_gmt) ?? isoFromGmt(customer.date_modified),
    metadata: {
      role: nonEmpty(customer.role),
      is_paying_customer: typeof customer.is_paying_customer === 'boolean' ? customer.is_paying_customer : null,
      payload_hash: payloadHashOf(customer),
    },
  }
}

/** Normalizes a wc/v3 product. Products carry no currency (the store currency is on the connection). */
export function normalizeWooProduct(raw: unknown): NormalizedProduct | null {
  const product = obj(raw)
  const externalId = externalIdOf(product.id)
  if (!externalId) return null
  const url = nonEmpty(product.permalink)
  return {
    externalId,
    sku: nonEmpty(product.sku),
    name: nonEmpty(product.name) ?? `#${externalId}`,
    status: PRODUCT_STATUS[String(product.status ?? '')] ?? 'unknown',
    price: money(product.price),
    currency: null,
    stockStatus: STOCK_STATUS[String(product.stock_status ?? '')] ?? 'unknown',
    stockQuantity: integer(product.stock_quantity),
    url: url && /^https?:\/\//i.test(url) ? url : null,
    providerUpdatedAt: isoFromGmt(product.date_modified_gmt) ?? isoFromGmt(product.date_modified),
    metadata: {
      type: nonEmpty(product.type),
      parent_id: integer(product.parent_id),
      manage_stock: typeof product.manage_stock === 'boolean' ? product.manage_stock : null,
      payload_hash: payloadHashOf(product),
    },
  }
}

/** Normalizes the companion plugin's cart payload (see CART_TOPIC). */
export function normalizeWooCart(raw: unknown): NormalizedCart | null {
  const cart = obj(raw)
  const externalId = externalIdOf(cart.cart_id) ?? externalIdOf(cart.id)
  if (!externalId) return null
  const customer = obj(cart.customer)
  const abandonedAt = isoFromGmt(cart.abandoned_at)
  const items = (Array.isArray(cart.items) ? cart.items : [])
    .map((entry) => {
      const item = obj(entry)
      const name = nonEmpty(item.name)
      return name ? { name, quantity: Math.max(1, integer(item.quantity) ?? 1) } : null
    })
    .filter((i): i is { name: string; quantity: number } => !!i)
  return {
    externalId,
    customerExternalId: externalIdOf(customer.id),
    contactName: fullName(customer.first_name, customer.last_name),
    contactPhoneRaw: nonEmpty(customer.phone),
    contactEmail: nonEmpty(customer.email),
    status: CART_STATUS[String(cart.status ?? '').toLowerCase()] ?? (abandonedAt ? 'abandoned' : 'open'),
    currency: currencyCode(cart.currency),
    total: money(cart.total),
    items,
    abandonedAt,
    recoveredOrderExternalId: externalIdOf(cart.recovered_order_id),
    providerUpdatedAt: isoFromGmt(cart.updated_at) ?? abandonedAt,
    metadata: { country: countryCode(customer.country), payload_hash: payloadHashOf(cart) },
  }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

interface WcWebhook {
  id: number
  topic: string
  status: string
  deliveryUrl: string
}

function parseWebhook(raw: unknown): WcWebhook | null {
  const w = obj(raw)
  const id = integer(w.id)
  const topic = nonEmpty(w.topic)
  const deliveryUrl = nonEmpty(w.delivery_url)
  if (!id || id <= 0 || !topic || !deliveryUrl) return null
  return { id, topic: topic.toLowerCase(), status: nonEmpty(w.status) ?? 'unknown', deliveryUrl }
}

function sameUrl(a: string, b: string): boolean {
  return a.replace(/\/+$/, '') === b.replace(/\/+$/, '')
}

const PING_BODY_RE = /^webhook_id=(\d{1,12})$/
const DELIVERY_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/
const TOPIC_RE = /^[a-z0-9_.-]{1,64}$/

function connectionContext(connection: Pick<AdapterConnection, 'storeUrl' | 'secrets'>): WcContext {
  return contextFor(canonicalStoreUrl(connection.storeUrl).storeUrl, parseSecrets(connection.secrets))
}

export function createWooCommerceAdapter(deps: WooCommerceAdapterDeps = {}): CommerceAdapter {
  const randomSecret = deps.randomSecret ?? (() => randomToken(32))

  /** Lists the store's webhooks that point at our delivery URL (bounded listing). */
  async function listOwnWebhooks(ctx: WcContext, deliveryUrl: string): Promise<WcWebhook[]> {
    const own: WcWebhook[] = []
    for (let page = 1; page <= WEBHOOK_LIST_PAGE_CAP; page++) {
      const res = await wcRequest(deps, ctx, 'webhooks.list', { path: '/webhooks', query: { per_page: PAGE_SIZE, page, status: 'all' } })
      if (res.status !== 200) throw httpFailure(res, 'webhooks.list')
      if (!Array.isArray(res.json)) throw invalidResponse('webhooks.list', 'not an array')
      for (const entry of res.json) {
        const webhook = parseWebhook(entry)
        if (webhook && sameUrl(webhook.deliveryUrl, deliveryUrl)) own.push(webhook)
      }
      const totalPages = integer(res.headers.get('x-wp-totalpages'))
      if (res.json.length < PAGE_SIZE || (totalPages !== null && page >= totalPages)) break
    }
    return own
  }

  /**
   * Whether the key may create webhooks. The permission level is not exposed
   * by any endpoint, so an empty POST /webhooks is sent: WooCommerce refuses
   * writes from a read-only key with 401 on rest_pre_dispatch, while a write
   * key reaches the handler, which rejects the missing topic/delivery_url with
   * 400 (nothing is created either way).
   */
  async function probeWriteAccess(ctx: WcContext, log: Logger): Promise<{ webhooks: boolean; note: string | null }> {
    const res = await wcRequest(deps, ctx, 'webhooks.probe', { method: 'POST', path: '/webhooks', body: {} })
    if (res.status === 400) return { webhooks: true, note: null }
    if (res.status === 401) {
      log.info('woocommerce.validate.read_only_key', { status: res.status, code: errorCodeOf(res.json) })
      return { webhooks: false, note: NOTE_READ_ONLY_KEY }
    }
    if (res.status === 403) {
      // The key may write, but its WordPress user cannot manage webhooks (woocommerce_rest_cannot_create).
      log.info('woocommerce.validate.no_webhook_permission', { status: res.status, code: errorCodeOf(res.json) })
      return { webhooks: false, note: NOTE_NO_WEBHOOK_PERMISSION }
    }
    log.warn('woocommerce.validate.webhook_probe_unexpected', { status: res.status, code: errorCodeOf(res.json) })
    return { webhooks: false, note: NOTE_WEBHOOKS_UNVERIFIED }
  }

  async function fetchOne<T>(connection: AdapterConnection, operation: string, path: string, externalId: string, normalize: (raw: unknown) => T | null, log: Logger): Promise<T | null> {
    if (!/^\d{1,15}$/.test(externalId)) {
      log.warn('woocommerce.fetch.invalid_id', { operation, storeDomain: connection.storeDomain })
      return null
    }
    const ctx = connectionContext(connection)
    const res = await wcRequest(deps, ctx, operation, { path: `${path}/${externalId}` })
    if (res.status === 404) return null
    if (res.status !== 200) throw httpFailure(res, operation)
    const record = normalize(res.json)
    if (!record) throw invalidResponse(operation, 'record without id')
    return record
  }

  return {
    platform: 'woocommerce',

    getCapabilities(connection) {
      const hasCartSource = connection.webhookRegistrations.some((r) => r.topic === CART_TOPIC && r.source === 'manual')
      const notes = connection.capabilities.notes.filter((n) => n !== NOTE_NO_CART_SOURCE)
      return { ...connection.capabilities, abandoned_carts: hasCartSource, notes: hasCartSource ? notes : [...notes, NOTE_NO_CART_SOURCE] }
    },

    async validateConnection(input: ConnectInput, log: Logger): Promise<ValidatedStore> {
      const secrets = parseSecrets(input.secrets)
      const { storeUrl, storeDomain } = canonicalStoreUrl(input.storeUrl)
      const ctx = contextFor(storeUrl, secrets)
      const notes: string[] = []
      let platformVersion: string | null = null
      let currency: string | null = null
      let language: string | null = null
      let countryCode_: string | null = null
      let products = true
      let customers = true
      let storeInfoReadable = false

      // Authenticated read that proves the key and the WooCommerce REST API at once.
      const status = await wcRequest(deps, ctx, 'system_status', { path: '/system_status' })
      if (status.status === 200 && !looksLikeHtml(status)) {
        const body = obj(status.json)
        if (!Object.keys(body).length) throw invalidResponse('system_status', 'not a JSON object')
        const environment = obj(body.environment)
        const settings = obj(body.settings)
        platformVersion = nonEmpty(environment.version)
        currency = currencyCode(settings.currency)
        language = nonEmpty(environment.language)?.replace('_', '-') ?? null
        storeInfoReadable = true
      } else if (status.status === 403) {
        // The key works but its user cannot manage WooCommerce: prove each resource instead.
        const probes = await Promise.all(
          (['orders', 'products', 'customers'] as const).map(async (resource) => {
            const res = await wcRequest(deps, ctx, `${resource}.probe`, { path: `/${resource}`, query: { per_page: 1 } })
            return { resource, res }
          }),
        )
        const orders = probes.find((p) => p.resource === 'orders')!
        if (orders.res.status !== 200) throw httpFailure(orders.res, 'orders.probe')
        if (!Array.isArray(orders.res.json)) throw invalidResponse('orders.probe', 'not an array')
        products = probes.find((p) => p.resource === 'products')!.res.status === 200
        customers = probes.find((p) => p.resource === 'customers')!.res.status === 200
        notes.push(NOTE_NO_STORE_INFO)
        log.info('woocommerce.validate.limited_key', { storeDomain, products, customers })
      } else {
        throw httpFailure(status, 'system_status')
      }

      if (storeInfoReadable) {
        // Store base country (General settings; "RO" or "RO:B" with a state). Optional: a failure only loses the country.
        const country = await wcRequest(deps, ctx, 'settings.default_country', { path: '/settings/general/woocommerce_default_country' })
        if (country.status === 200) countryCode_ = countryCode(obj(country.json).value)
        else log.warn('woocommerce.validate.country_unavailable', { storeDomain, status: country.status, code: errorCodeOf(country.json) })
      }

      // Site title and time zone from the WordPress index (public). Optional as well.
      let displayName: string | null = null
      let timezone: string | null = null
      const root = await wcRequest(deps, ctx, 'wp.index', { api: 'wp', path: '' })
      if (root.status === 200 && !looksLikeHtml(root)) {
        const index = obj(root.json)
        displayName = nonEmpty(index.name)
        const tz = nonEmpty(index.timezone_string)
        timezone = tz && /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(tz) ? tz : null
      } else {
        log.warn('woocommerce.validate.index_unavailable', { storeDomain, status: root.status })
      }

      const write = await probeWriteAccess(ctx, log)
      if (write.note) notes.push(write.note)
      notes.push(NOTE_NO_CART_SOURCE)

      const capabilities: CommerceCapabilities = {
        products,
        customers,
        orders: true,
        webhooks: write.webhooks,
        abandoned_carts: false,
        customer_phone: true,
        polling_minutes: write.webhooks ? null : READ_ONLY_POLLING_MINUTES,
        notes,
      }
      log.info('woocommerce.validate.ok', { storeDomain, platformVersion, currency, countryCode: countryCode_, webhooks: write.webhooks, products, customers })
      return {
        storeUrl,
        storeDomain,
        displayName,
        currency,
        countryCode: countryCode_,
        timezone,
        language,
        platformVersion,
        capabilities,
        secrets: {
          consumer_key: secrets.consumer_key,
          consumer_secret: secrets.consumer_secret,
          // Chosen by us: WooCommerce signs every delivery with it (base64url, no HTML specials to decode).
          webhook_secret: secrets.webhook_secret ?? randomSecret(),
        },
      }
    },

    async registerWebhooks(connection: AdapterConnection, log: Logger): Promise<WebhookRegistration[]> {
      if (!connection.webhookUrl) {
        throw new ConnectionError('not_configured', 'Adresa publică pentru webhook-uri nu este configurată pe platformă.', false, 'woocommerce webhooks: no webhook url')
      }
      const secrets = parseSecrets(connection.secrets)
      if (!secrets.webhook_secret) {
        throw new ConnectionError('not_configured', 'Secretul pentru webhook-uri lipsește: reconectează magazinul.', false, 'woocommerce webhooks: no webhook secret')
      }
      const ctx = contextFor(canonicalStoreUrl(connection.storeUrl).storeUrl, secrets)
      const deliveryUrl = connection.webhookUrl
      const existing = await listOwnWebhooks(ctx, deliveryUrl)
      const registrations: WebhookRegistration[] = []
      let created = 0
      let reused = 0
      for (const topic of WOOCOMMERCE_WEBHOOK_TOPICS) {
        const found = existing.find((w) => w.topic === topic)
        if (found) {
          // The API never returns a webhook's secret, so an existing one cannot be checked against ours. A
          // reconnect stores a freshly generated webhook_secret (the connect form only carries the keys), and
          // a webhook left with the previous secret would fail every signature until WooCommerce disables it
          // after five failed deliveries. The secret is therefore always re-set; the same PUT re-activates a
          // webhook that was auto-disabled or paused by the merchant.
          const res = await wcRequest(deps, ctx, 'webhooks.update', { method: 'PUT', path: `/webhooks/${found.id}`, body: { status: 'active', secret: secrets.webhook_secret } })
          if (res.status !== 200) throw httpFailure(res, 'webhooks.update', true)
          registrations.push({ topic, externalId: String(found.id), source: 'api' })
          reused++
          continue
        }
        const res = await wcRequest(deps, ctx, 'webhooks.create', {
          method: 'POST',
          path: '/webhooks',
          body: { name: `Neuro Tech Voice: ${topic}`, topic, delivery_url: deliveryUrl, secret: secrets.webhook_secret, status: 'active' },
        })
        if (res.status !== 201 && res.status !== 200) throw httpFailure(res, 'webhooks.create', true)
        const id = integer(obj(res.json).id)
        if (!id || id <= 0) throw invalidResponse('webhooks.create', 'no id')
        registrations.push({ topic, externalId: String(id), source: 'api' })
        created++
      }
      // Merchant-made registrations (companion plugin) are reported as manual so the stored list keeps them.
      const manual = new Map<string, WebhookRegistration>()
      for (const reg of connection.webhookRegistrations) if (reg.source === 'manual') manual.set(reg.externalId, reg)
      for (const w of existing) if (w.topic === CART_TOPIC) manual.set(String(w.id), { topic: CART_TOPIC, externalId: String(w.id), source: 'manual' })
      log.info('woocommerce.webhooks.registered', { storeDomain: connection.storeDomain, created, reused, manual: manual.size })
      return [...registrations, ...manual.values()]
    },

    async unregisterWebhooks(connection: AdapterConnection, log: Logger): Promise<void> {
      const ctx = connectionContext(connection)
      let deleted = 0
      for (const reg of connection.webhookRegistrations) {
        if (reg.source !== 'api' || !/^\d{1,15}$/.test(reg.externalId)) continue
        // Webhooks cannot be trashed: without force=true WooCommerce answers 501.
        const res = await wcRequest(deps, ctx, 'webhooks.delete', { method: 'DELETE', path: `/webhooks/${reg.externalId}`, query: { force: true } })
        if (res.status === 404) continue
        if (res.status !== 200) throw httpFailure(res, 'webhooks.delete', true)
        deleted++
      }
      log.info('woocommerce.webhooks.unregistered', { storeDomain: connection.storeDomain, deleted })
    },

    async syncPage(connection: AdapterConnection, resource: SyncResource, checkpoint: SyncCheckpoint, mode, log: Logger): Promise<SyncBatch> {
      const nextCheckpoint = (done: boolean, page: number): SyncCheckpoint => ({ cursor: done ? null : String(page + 1), modifiedAfter: checkpoint.modifiedAfter, pages: checkpoint.pages + 1 })
      if (resource === 'carts') {
        // No cart endpoint in the REST API: carts only arrive through the companion plugin's webhook.
        return { resource, carts: [], checkpoint: { ...checkpoint, cursor: null }, done: true }
      }
      const ctx = connectionContext(connection)
      const page = pageOf(checkpoint.cursor)
      const modifiedAfter = mode === 'incremental' && checkpoint.modifiedAfter ? isoFromGmt(checkpoint.modifiedAfter) : null
      const perPage = resource === 'orders' ? ORDERS_PAGE_SIZE : PAGE_SIZE
      // Every scan is ordered by id, also the filtered incremental ones: the API paginates by offset, and a
      // record edited while the scan runs must not move across the cursor. Ordered by id, a record that
      // enters the modified_after window can only push later records forward (read twice, upserted twice),
      // whereas ordered by modification date it would jump behind the cursor and the record after it would
      // slide into a page already read (skipped until its next edit, since the next pass starts at this one's
      // start time).
      const query: Record<string, string | number | boolean | undefined> =
        resource === 'customers'
          ? { per_page: perPage, page, role: 'customer', orderby: 'id', order: 'asc' }
          : {
              per_page: perPage,
              page,
              status: 'any',
              orderby: 'id',
              order: 'asc',
              modified_after: modifiedAfter ?? undefined,
              dates_are_gmt: modifiedAfter ? true : undefined,
            }
      const operation = `${resource}.list`
      const res = await wcRequest(deps, ctx, operation, { path: `/${resource}`, query, timeoutMs: LIST_TIMEOUT_MS, maxBytes: LIST_MAX_BYTES })
      if (res.status !== 200) throw httpFailure(res, operation)
      if (!Array.isArray(res.json)) throw invalidResponse(operation, 'not an array')
      const totalPages = integer(res.headers.get('x-wp-totalpages'))
      const done = res.json.length < perPage || (totalPages !== null && page >= totalPages)
      let skipped = 0
      const keep = <T>(records: Array<T | null>): T[] => {
        const out: T[] = []
        for (const r of records) {
          if (r) out.push(r)
          else skipped++
        }
        return out
      }
      const batch: SyncBatch = { resource, checkpoint: nextCheckpoint(done, page), done }
      if (resource === 'orders') batch.orders = keep(res.json.map(normalizeWooOrder))
      else if (resource === 'products') batch.products = keep(res.json.map(normalizeWooProduct))
      else batch.customers = keep(res.json.map(normalizeWooCustomer))
      log.info('woocommerce.sync.page', { storeDomain: connection.storeDomain, resource, mode, page, count: res.json.length, skipped, totalPages, done })
      return batch
    },

    async verifyWebhook(request: RawWebhookRequest, connection: AdapterConnection): Promise<VerifiedCommerceEvent | VerificationFailure> {
      const parsed = WooCommerceSecretsSchema.safeParse(connection.secrets)
      const secret = parsed.success ? parsed.data.webhook_secret : undefined
      if (!secret) return { ok: false, reason: 'not_supported', status: 400 }
      const signature = request.headers.get('x-wc-webhook-signature')?.trim() ?? ''
      const topicHeader = request.headers.get('x-wc-webhook-topic')?.trim().toLowerCase() ?? ''
      const text = new TextDecoder().decode(request.rawBody)
      if (!signature) {
        // The creation ping is unsigned (class-wc-webhook.php deliver_ping: body "webhook_id=<id>", no
        // X-WC-Webhook-* headers). It is accepted only in that exact shape and only ever maps to 'ignored'.
        const ping = !topicHeader && PING_BODY_RE.exec(text.trim())
        if (ping) return { ok: true, topic: 'ping', deliveryId: null, externalResourceId: null, payload: { webhook_id: ping[1] } }
        return { ok: false, reason: 'missing_signature', status: 401 }
      }
      // Signature over the exact bytes received: base64(HMAC-SHA256(body, secret)).
      const expected = crypto.createHmac('sha256', secret).update(request.rawBody).digest()
      const given = Buffer.from(signature, 'base64')
      if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: 'bad_signature', status: 401 }
      const deliveryHeader = request.headers.get('x-wc-webhook-delivery-id')?.trim() ?? ''
      const deliveryId = DELIVERY_ID_RE.test(deliveryHeader) ? deliveryHeader : null
      let payload: unknown
      try {
        payload = text.trim() ? JSON.parse(text) : undefined
      } catch (err) {
        void err // Signed but not JSON (a ping variant, a plugin test): acknowledged, never processed.
        payload = undefined
      }
      if (payload === undefined) {
        return { ok: true, topic: PING_BODY_RE.test(text.trim()) ? 'ping' : 'non_json', deliveryId, externalResourceId: null, payload: null }
      }
      const body = obj(payload)
      // The companion plugin may carry the topic in the body instead of the header.
      const topic = topicHeader || (nonEmpty(body.topic)?.toLowerCase() ?? '')
      if (!TOPIC_RE.test(topic)) return { ok: false, reason: 'unknown_topic', status: 400 }
      return { ok: true, topic, deliveryId, externalResourceId: externalIdOf(body.id) ?? externalIdOf(body.cart_id), payload }
    },

    normalizeEvent(event: VerifiedCommerceEvent): CommerceEvent[] {
      const malformed = (what: string): CommerceEvent[] => [{ kind: 'ignored', reason: `malformed_payload:${what}` }]
      switch (event.topic) {
        case 'order.created':
        case 'order.updated':
        case 'order.restored': {
          const order = normalizeWooOrder(event.payload)
          if (!order) return malformed('order')
          return [{ kind: event.topic === 'order.created' ? 'order.created' : 'order.updated', order }]
        }
        case 'order.deleted': {
          const externalId = externalIdOf(obj(event.payload).id)
          return externalId ? [{ kind: 'order.deleted', externalId }] : malformed('order')
        }
        case 'product.created':
        case 'product.updated':
        case 'product.restored':
        case 'product.published': {
          const product = normalizeWooProduct(event.payload)
          return product ? [{ kind: 'product.updated', product }] : malformed('product')
        }
        case 'product.deleted': {
          const externalId = externalIdOf(obj(event.payload).id)
          return externalId ? [{ kind: 'product.deleted', externalId }] : malformed('product')
        }
        case 'customer.created':
        case 'customer.updated': {
          const customer = normalizeWooCustomer(event.payload)
          return customer ? [{ kind: 'customer.updated', customer }] : malformed('customer')
        }
        case CART_TOPIC: {
          const cart = normalizeWooCart(event.payload)
          return cart ? [{ kind: 'cart.updated', cart }] : malformed('cart')
        }
        case 'ping':
        case 'non_json':
          return [{ kind: 'ignored', reason: event.topic }]
        default:
          // customer.deleted (no event kind), coupon.*, action.*, unknown extension topics.
          return [{ kind: 'ignored', reason: `unhandled_topic:${event.topic}` }]
      }
    },

    fetchOrder(connection, externalId, log) {
      return fetchOne(connection, 'orders.get', '/orders', externalId, normalizeWooOrder, log)
    },
    fetchCustomer(connection, externalId, log) {
      return fetchOne(connection, 'customers.get', '/customers', externalId, normalizeWooCustomer, log)
    },
    fetchProduct(connection, externalId, log) {
      return fetchOne(connection, 'products.get', '/products', externalId, normalizeWooProduct, log)
    },
  }
}

export const wooCommerceAdapter = createWooCommerceAdapter()
