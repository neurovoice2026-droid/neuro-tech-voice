import 'server-only'
// Custom JSON REST connector: a documented contract (version 1) that the
// merchant implements on their own backend, read over HTTPS with the
// authentication scheme chosen on the connect form.
//
// There is no external platform documentation here: the contract IS this
// file (CUSTOM_CONNECTOR_CONTRACT below is the source docs/commerce-
// integrations.md renders from, and the Zod schemas are its executable
// form). The building blocks are standards:
//   • HMAC-SHA256 webhook signatures (RFC 2104; Node crypto.timingSafeEqual,
//     https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b, read
//     2026-10-13) over the exact bytes received;
//   • Bearer (RFC 6750 §2.1) and Basic (RFC 7617 §2) credentials, or an API
//     key in a merchant-named header whose name is an RFC 9110 §5.1 token
//     that can never shadow Authorization, Cookie or Host.
//
// How the connector works:
//   • GET {base}/health proves the credentials and tells us what the API
//     exposes (orders, customers, products, carts, webhooks) and the store's
//     facts (name, currency, country, time zone, language);
//   • GET {base}/orders|customers|products|carts?limit=100&cursor=…
//     &modified_after=… page with the merchant's own opaque cursor; the
//     incremental watermark is sent as `modified_after` on every page;
//   • webhooks cannot be registered by us: when the merchant configured a
//     webhook secret, they POST signed events to the connection's webhook
//     URL themselves (X-NTV-* headers, body { data: <record> });
//   • abandoned carts come from GET /carts (polling) and/or the cart.updated
//     webhook, whenever /health reports capabilities.carts.
//
// The token and the webhook secret never reach a log field, an error message
// or a URL: authentication travels in a request header only.

import crypto from 'node:crypto'
import { z } from 'zod'
import type { Logger } from '@/lib/observability/logger'
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
 * Contract version this adapter speaks. /health must report exactly this
 * value in `contract_version`; anything else is `api_version_unsupported`
 * (the contract is documented in docs/commerce-integrations.md, generated
 * from CUSTOM_CONNECTOR_CONTRACT below; first published 2026-10-13).
 */
export const CUSTOM_CONTRACT_VERSION = '1'
/** `limit` sent on every list request and the most items a page may carry. */
export const CUSTOM_PAGE_SIZE = 100
/** Polling cadence of a connection without verified webhooks. */
export const CUSTOM_POLLING_MINUTES = 15
/**
 * Pages one pass over a resource may fetch (× CUSTOM_PAGE_SIZE records). An
 * opaque cursor that cycles (a → b → a) would otherwise page forever: the
 * worker only bounds pages per time slice, not per pass.
 */
export const CUSTOM_MAX_PAGES_PER_PASS = 5000
/** |now − X-NTV-Timestamp| accepted on a delivery (replay window). */
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300
const MAX_STRING = 500
const MAX_ID = 128
const MAX_CURSOR = 500
const MAX_ORDER_ITEMS = 200
const MAX_CART_ITEMS = 200
const MAX_TOKEN = 2000
const LIST_TIMEOUT_MS = 30_000
const LIST_MAX_BYTES = 8 * 1024 * 1024

/** Topics the merchant may send (X-NTV-Topic); everything else is rejected before parsing. */
export const CUSTOM_WEBHOOK_TOPICS = ['order.created', 'order.updated', 'product.updated', 'customer.updated', 'cart.updated'] as const
export type CustomWebhookTopic = (typeof CUSTOM_WEBHOOK_TOPICS)[number]

export const SIGNATURE_HEADER = 'x-ntv-signature'
export const EVENT_ID_HEADER = 'x-ntv-event-id'
export const TOPIC_HEADER = 'x-ntv-topic'
export const TIMESTAMP_HEADER = 'x-ntv-timestamp'

/** Merchant-facing notes (English) stored in capabilities.notes. */
export const NOTE_WEBHOOKS_MANUAL =
  'Webhooks cannot be registered automatically: the store sends the events itself (order.created, order.updated, product.updated, customer.updated, cart.updated) to the connection\'s webhook address, signed with HMAC-SHA256 using the configured secret.'
export const NOTE_NO_WEBHOOK_SECRET = 'Without a webhook secret, events sent by the store cannot be verified: data arrives through periodic sync, every 15 minutes. Add a webhook secret to enable them.'
export const NOTE_WEBHOOKS_NOT_SENT = 'The API reports that it does not send webhooks (capabilities.webhooks=false): data arrives through periodic sync, every 15 minutes.'
export const NOTE_NO_CARTS = 'The API does not expose carts (capabilities.carts=false): the abandoned cart automation is not available.'
export const NOTE_CARTS_POLLED = 'Carts are read from GET /carts during periodic sync; send the cart.updated event by webhook for an immediate reaction.'
export const NOTE_NO_PRODUCTS = 'The API does not expose products (capabilities.products=false): products are not synced.'
export const NOTE_NO_CUSTOMERS = 'The API does not expose customers (capabilities.customers=false): customers are not synced; the contact phone number comes from orders.'

// ─── Contract description (rendered by the docs) ──────────────────────────────

/**
 * The connector contract in prose, for docs/commerce-integrations.md. The
 * executable truth is the Zod schemas below; keep both in step.
 */
export const CUSTOM_CONNECTOR_CONTRACT = {
  version: CUSTOM_CONTRACT_VERSION,
  baseUrl: 'The connect form\'s store_url: an https URL whose path is the API root (e.g. https://api.example.ro/ntv). Every endpoint is appended to it. No redirects: the final address must be given.',
  auth: {
    bearer: 'Authorization: Bearer <auth_token>',
    api_key_header: '<auth_header_name>: <auth_token> — the header name is an RFC 9110 token (letters, digits, -_.) and never Authorization, Proxy-Authorization, Cookie, Host, Accept, Content-Type, Content-Length, Transfer-Encoding or Connection',
    basic: 'Authorization: Basic base64(<auth_token>) where auth_token is "user:password"',
  },
  requestHeaders: { accept: 'application/json' },
  pagination: {
    limit: `limit=<n> (≤ ${CUSTOM_PAGE_SIZE}; a sync always sends ${CUSTOM_PAGE_SIZE}, the connection test sends 1); a page may never carry more than ${CUSTOM_PAGE_SIZE} items`,
    cursor: 'cursor=<next_cursor of the previous page> (opaque string ≤ 500 chars; absent on the first page)',
    modified_after: 'modified_after=<ISO 8601 instant>: only records whose updated_at is after it, sent on every page of an incremental sync; omitted on a full sync',
    envelope: '{ "items": Record[], "next_cursor": string | null } — null (or absent) next_cursor means the last page; next_cursor must differ from the cursor received',
    bound: `one pass over a resource stops with an error after ${CUSTOM_MAX_PAGES_PER_PASS} pages (a cursor that never ends is a bug on the store's side)`,
  },
  connectionTest: `GET /health, then GET /orders?limit=1 and, for every capability /health declares (customers, products, carts), GET /<resource>?limit=1: each must answer 200 with the list envelope and its first item (when any) must follow the contract. A declared resource whose endpoint fails blocks the connection: fix the endpoint or declare the capability false.`,
  endpoints: {
    health: { method: 'GET', path: '/health', response: '{ "ok": true, "contract_version": "1", "store": { "name", "currency" (ISO 4217), "country" (ISO 3166-1 alpha-2), "timezone" (IANA), "language"? }, "capabilities": { "orders", "customers", "products", "carts", "webhooks" } }' },
    orders: { method: 'GET', path: '/orders', query: ['cursor', 'limit', 'modified_after'], response: '{ "items": Order[], "next_cursor": string | null }', required: true },
    customers: { method: 'GET', path: '/customers', query: ['cursor', 'limit', 'modified_after'], response: '{ "items": Customer[], "next_cursor": string | null }', required: 'when capabilities.customers (probed at connection time)' },
    products: { method: 'GET', path: '/products', query: ['cursor', 'limit', 'modified_after'], response: '{ "items": Product[], "next_cursor": string | null }', required: 'when capabilities.products (probed at connection time)' },
    carts: { method: 'GET', path: '/carts', query: ['cursor', 'limit', 'modified_after'], response: '{ "items": Cart[], "next_cursor": string | null }', required: 'when capabilities.carts (probed at connection time; may answer an empty list when carts only arrive by webhook)' },
    order: { method: 'GET', path: '/orders/{id}', response: '{ "item": Order } or 404', required: false },
    customer: { method: 'GET', path: '/customers/{id}', response: '{ "item": Customer } or 404', required: false },
    product: { method: 'GET', path: '/products/{id}', response: '{ "item": Product } or 404', required: false },
  },
  records: {
    Order: {
      id: 'string (≤ 128, no whitespace; an integer is accepted and stringified)',
      number: 'string? (shown to the customer; defaults to id)',
      created_at: 'ISO 8601 instant (YYYY-MM-DD[THH:MM[:SS[.fff]]<Z|±HH:MM>]; a time without a zone is rejected)',
      updated_at: 'ISO 8601 instant (same form)',
      status: 'pending | processing | on_hold | completed | cancelled | refunded | failed | draft',
      financial_status: 'pending | authorized | paid | partially_paid | partially_refunded | refunded | voided (null = unknown)',
      fulfillment_status: 'unfulfilled | partial | fulfilled | cancelled (null = unknown)',
      payment_method: 'string? (the store\'s payment method id, e.g. "cod"; kept in metadata.payment_method when is_cod overrides it)',
      payment_method_title: 'string? (as shown at checkout)',
      is_cod: 'boolean? — authoritative when present: true records the order as cash on delivery whatever the method id/title say (the mirrored payment method id becomes "cod"); when absent the platform guesses from payment_method / payment_method_title (cod, ramburs, cash on delivery…)',
      currency: 'ISO 4217',
      total: 'number (a decimal string is accepted)',
      customer: '{ id?, name?, phone? (raw, as entered), email?, country? (alpha-2) }',
      shipping: '{ city?, country? (alpha-2), summary? (one line: street, city) }',
      items: `OrderItem[] (≤ ${MAX_ORDER_ITEMS})`,
    },
    OrderItem: { id: 'string', product_id: 'string?', sku: 'string?', name: 'string', quantity: 'integer ≥ 0', unit_price: 'number?', total: 'number?' },
    Customer: {
      id: 'string',
      email: 'string?',
      first_name: 'string?',
      last_name: 'string?',
      phone: 'string? (raw)',
      country: 'alpha-2?',
      marketing_consent: 'boolean?',
      call_consent: 'boolean?',
      orders_count: 'integer?',
      total_spent: 'number?',
      created_at: 'ISO 8601?',
      updated_at: 'ISO 8601 instant',
    },
    Product: {
      id: 'string',
      sku: 'string?',
      name: 'string',
      status: 'active | draft | archived (null = unknown)',
      price: 'number?',
      currency: 'ISO 4217?',
      stock_status: 'in_stock | out_of_stock | on_backorder (null = unknown)',
      stock_quantity: 'integer?',
      url: 'https URL?',
      updated_at: 'ISO 8601 instant',
    },
    Cart: {
      id: 'string',
      customer: '{ id?, name?, phone (raw; without it the cart cannot be called), email?, country? }',
      items: `{ name, quantity }[] (≤ ${MAX_CART_ITEMS})`,
      total: 'number?',
      currency: 'ISO 4217?',
      status: 'open | abandoned | recovered | expired',
      abandoned_at: 'ISO 8601?',
      recovered_order_id: 'string?',
      updated_at: 'ISO 8601 instant',
    },
    limits: { stringLength: MAX_STRING, idLength: MAX_ID, cursorLength: MAX_CURSOR, itemsPerPage: CUSTOM_PAGE_SIZE, pagesPerPass: CUSTOM_MAX_PAGES_PER_PASS },
    unknownFields: 'ignored',
  },
  webhooks: {
    registration: 'none: the merchant sends deliveries to the connection\'s webhook URL (shown after connecting); the platform cannot subscribe or unsubscribe',
    method: 'POST',
    headers: {
      [SIGNATURE_HEADER]: 'sha256=<hex HMAC-SHA256(raw request body bytes, webhook_secret)>',
      [EVENT_ID_HEADER]: 'unique delivery id (≤ 128 chars; a repeated id with the same body is acknowledged, not reprocessed)',
      [TOPIC_HEADER]: CUSTOM_WEBHOOK_TOPICS.join(' | '),
      [TIMESTAMP_HEADER]: `unix seconds at sending time; rejected when more than ${WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS} s from the platform clock`,
      'content-type': 'application/json',
    },
    body: '{ "data": <Order | Product | Customer | Cart as above, validated against the topic\'s record shape at delivery> }',
    responses: '200 accepted (or duplicate); 401 missing/bad signature; 400 malformed body or a record that does not follow the contract, stale timestamp, unknown topic, or webhooks not configured (no webhook_secret); 413 body over 1 MiB; 429 too many deliveries',
    secret: 'webhook_secret from the connect form (16–200 chars, used as its UTF-8 bytes); the signature is not computed over the headers, so the event id must be unique per delivery',
  },
} as const

// ─── Secrets ──────────────────────────────────────────────────────────────────

/** RFC 9110 §5.1 field-name token. */
const HEADER_NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$/
/** Printable ASCII only: a value with CR/LF or other control characters could inject headers. */
const HEADER_VALUE_RE = /^[\x21-\x7e][\x20-\x7e]*$/
/**
 * Header names an API key may never travel in: the credential headers we
 * build ourselves, the request-framing headers, and the ones safeFetch sets.
 */
const FORBIDDEN_HEADER_NAMES: ReadonlySet<string> = new Set(['authorization', 'proxy-authorization', 'cookie', 'host', 'accept', 'content-type', 'content-length', 'transfer-encoding', 'connection'])

/** The connect form posts '' for an optional field left empty. */
const emptyToUndefined = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional())

export const CustomSecretsSchema = z
  .object({
    auth_scheme: z.enum(['bearer', 'api_key_header', 'basic']),
    auth_header_name: emptyToUndefined(z.string().trim().regex(HEADER_NAME_RE, 'Header name must be an HTTP token (letters, digits, -_.)')),
    auth_token: z.string().trim().min(1).max(MAX_TOKEN).regex(HEADER_VALUE_RE, 'Token must be printable ASCII without line breaks'),
    webhook_secret: emptyToUndefined(z.string().trim().min(16).max(200)),
  })
  .superRefine((s, ctx) => {
    if (s.auth_scheme === 'api_key_header') {
      if (!s.auth_header_name) ctx.addIssue({ code: 'custom', path: ['auth_header_name'], message: 'A header name is required for the api_key_header scheme' })
      else if (FORBIDDEN_HEADER_NAMES.has(s.auth_header_name.toLowerCase())) ctx.addIssue({ code: 'custom', path: ['auth_header_name'], message: 'This header name cannot carry the API key' })
    }
    // RFC 7617: user-id ":" password; without the colon the header would be meaningless.
    if (s.auth_scheme === 'basic' && !s.auth_token.includes(':')) ctx.addIssue({ code: 'custom', path: ['auth_token'], message: 'Basic authentication needs user:password' })
  })
export type CustomSecrets = z.infer<typeof CustomSecretsSchema>

export interface CustomAdapterDeps {
  fetchImpl?: typeof fetch
  /** DNS resolver handed to the SSRF guard (tests resolve to a public address). */
  lookup?: (hostname: string) => Promise<string[]>
  /** Clock (ms) for the webhook timestamp window. */
  now?: () => number
}

// ─── Store URL ────────────────────────────────────────────────────────────────

/**
 * Canonical API base URL: https, lower-case host, the path kept (it is the
 * API root), no query/hash, no trailing slash, no credentials.
 */
export function canonicalBaseUrl(raw: string): { storeUrl: string; storeDomain: string } {
  const text = raw.trim()
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
  } catch (err) {
    throw new ConnectionError('invalid_url', 'The API base address is not valid.', false, `base url: ${err instanceof Error ? err.message : 'parse failed'}`)
  }
  if (url.protocol !== 'https:') throw new ConnectionError('invalid_url', 'The API base address must start with https://.', false, 'base url: not https')
  if (url.username || url.password) throw new ConnectionError('invalid_url', 'The API base address cannot contain a user name and password.', false, 'base url: credentials')
  let path = url.pathname.replace(/\/+$/, '')
  if (path === '/') path = ''
  const host = url.hostname.toLowerCase()
  return { storeUrl: `https://${host}${url.port ? `:${url.port}` : ''}${path}`, storeDomain: host }
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

interface ApiContext {
  baseUrl: string
  /** The one request header carrying the credential (name → value); never logged. */
  authHeaders: Record<string, string>
}

interface ApiRequest {
  path: string
  query?: Record<string, string | number | undefined>
  timeoutMs?: number
  maxBytes?: number
}

interface ApiResponse {
  status: number
  headers: Headers
  json: unknown
  text: string
}

function parseSecrets(secrets: ConnectionSecrets): CustomSecrets {
  const parsed = CustomSecretsSchema.safeParse(secrets)
  if (!parsed.success) {
    throw new ConnectionError(
      'unauthorized',
      'The authentication details are missing or malformed (scheme, API key header name, token or user:password).',
      false,
      `custom secrets: invalid shape (${parsed.error.issues.map((i) => i.path.join('.') || 'root').join(', ')})`,
    )
  }
  return parsed.data
}

/** The request header of each scheme. A pasted "Bearer x" is not doubled. */
export function authHeadersFor(secrets: CustomSecrets): Record<string, string> {
  switch (secrets.auth_scheme) {
    case 'bearer':
      return { authorization: `Bearer ${secrets.auth_token.replace(/^bearer\s+/i, '')}` }
    case 'api_key_header':
      // The schema guarantees the name for this scheme; the defensive branch keeps the type honest.
      if (!secrets.auth_header_name) throw new ConnectionError('unauthorized', 'The API key header name is missing.', false, 'custom secrets: header name missing')
      return { [secrets.auth_header_name.toLowerCase()]: secrets.auth_token }
    case 'basic':
      return { authorization: `Basic ${Buffer.from(secrets.auth_token, 'utf8').toString('base64')}` }
  }
}

function contextFor(baseUrl: string, secrets: CustomSecrets): ApiContext {
  return { baseUrl, authHeaders: authHeadersFor(secrets) }
}

function connectionContext(connection: Pick<AdapterConnection, 'storeUrl' | 'secrets'>): ApiContext {
  return contextFor(canonicalBaseUrl(connection.storeUrl).storeUrl, parseSecrets(connection.secrets))
}

function looksLikeHtml(res: ApiResponse): boolean {
  return res.json === undefined && /^\s*<(!doctype|html|head|body|script|div)/i.test(res.text.slice(0, 512))
}

function unsafeUrlFailure(err: UnsafeUrlError): ConnectionError {
  const reason = err.reason
  if (/private or reserved|resolves to a private|local hosts/.test(reason)) {
    return new ConnectionError('ssrf_blocked', 'The API address points to a private or local network; a public address is required.', false, `base url: ${reason}`)
  }
  if (/does not resolve/.test(reason)) return new ConnectionError('unreachable', 'The API domain cannot be resolved (DNS).', true, `base url: ${reason}`)
  return new ConnectionError('invalid_url', 'The API address is not valid (https only, no unusual port).', false, `base url: ${reason}`)
}

function transportFailure(err: StoreHttpError, operation: string): ConnectionError {
  switch (err.code) {
    case 'timeout':
      return new ConnectionError('timeout', 'The store API did not respond in time.', true, `custom ${operation}: timeout`)
    case 'redirect':
      return new ConnectionError('redirect', 'The API redirects to another address; use the final address (https).', false, `custom ${operation}: redirect ${err.status ?? ''}`.trim())
    case 'too_large':
      return new ConnectionError('invalid_response', 'The API response is too large.', false, `custom ${operation}: response too large`)
    case 'network':
    case 'http':
      return new ConnectionError('unreachable', 'The store API could not be reached.', true, `custom ${operation}: ${err.code}`)
  }
}

/** Classifies a non-2xx answer. The body is never echoed: only the status reaches the detail. */
function httpFailure(res: ApiResponse, operation: string): ConnectionError {
  const detail = `custom ${operation}: HTTP ${res.status}`
  if (res.status === 401) return new ConnectionError('unauthorized', 'The API rejected the authentication (401). Check the scheme and the token.', false, detail)
  if (res.status === 403) return new ConnectionError('forbidden', 'The API refused access (403): the token lacks the required permissions.', false, detail)
  if (res.status === 404 || looksLikeHtml(res)) {
    return new ConnectionError('not_a_store', 'No API following the contract answers at this address (GET /health). Check the base address.', false, detail)
  }
  if (res.status === 429) return new ConnectionError('rate_limited', 'The API is rate limiting requests; try again in a few minutes.', true, detail)
  if (res.status >= 500) return new ConnectionError('unreachable', 'The API answered with a server error; try again.', true, detail)
  return new ConnectionError('invalid_response', 'The API answered unexpectedly.', false, detail)
}

function invalidResponse(operation: string, what: string): ConnectionError {
  return new ConnectionError('invalid_response', 'The API response does not have the expected format.', false, `custom ${operation}: ${what}`)
}

/** Zod issues as "path: code" (field names and codes only; never a received value). */
function describeIssues(error: z.ZodError, max = 3): string {
  return error.issues
    .slice(0, max)
    .map((i) => `${i.path.map(String).join('.') || 'root'}: ${i.code}`)
    .join('; ')
}

/** A record that does not follow the contract; the field path helps the merchant fix their endpoint. */
function contractViolation(operation: string, what: string, issues: string): ConnectionError {
  return new ConnectionError('invalid_response', `${what} does not follow the contract (${issues}).`, false, `custom ${operation}: ${issues}`)
}

async function apiRequest(deps: CustomAdapterDeps, ctx: ApiContext, operation: string, req: ApiRequest): Promise<ApiResponse> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (value !== undefined) params.set(key, String(value))
  }
  const base = `${ctx.baseUrl}${req.path}`
  const url = params.size ? `${base}?${params.toString()}` : base
  try {
    return await safeFetch(url, {
      method: 'GET',
      headers: ctx.authHeaders,
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

// ─── Inbound record schemas ───────────────────────────────────────────────────

const emptyToNull = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema.nullish())

/** An external id: a non-blank string without whitespace/control characters; integers are stringified. */
const Id = z.union([z.string().trim().regex(/^[^\s\x00-\x1f\x7f]{1,128}$/), z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)]).transform(String)
const Str = z.string().trim().max(MAX_STRING)
const OptStr = emptyToNull(Str)
/** Money and counts: JSON numbers, or decimal strings as PHP backends tend to produce. */
const Money = z.union([z.number(), z.string().trim().regex(/^-?\d{1,12}(\.\d{1,6})?$/)]).transform(Number)
const Int = z.union([z.number().int(), z.string().trim().regex(/^-?\d{1,12}$/)]).transform(Number)
/**
 * ISO 8601 instant: a calendar date, optionally with a time that MUST carry a
 * zone (Z or ±HH:MM). A zone-less time would be read in the server's zone,
 * and abandoned_at / updated_at drive when a customer is called.
 */
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2}))?$/i
const Instant = z
  .string()
  .trim()
  .max(64)
  .regex(INSTANT_RE, 'Not an ISO 8601 instant with a time zone')
  .refine((v) => Number.isFinite(Date.parse(v)), 'Not a date')
  .transform((v) => new Date(Date.parse(v)).toISOString())
const Currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/)
const Country = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/)
const Url = z.string().trim().max(2000).regex(/^https?:\/\/\S+$/i)
const Timezone = z.string().trim().regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/)

export const CustomHealthSchema = z.object({
  ok: z.literal(true),
  contract_version: z.string().trim().max(16),
  store: z
    .object({
      name: OptStr,
      currency: emptyToNull(Currency),
      country: emptyToNull(Country),
      timezone: emptyToNull(Timezone),
      language: OptStr,
    })
    .nullish(),
  capabilities: z.object({
    orders: z.boolean().default(false),
    customers: z.boolean().default(false),
    products: z.boolean().default(false),
    carts: z.boolean().default(false),
    webhooks: z.boolean().default(false),
  }),
})

export const CustomListSchema = z.object({
  items: z.array(z.unknown()).max(CUSTOM_PAGE_SIZE),
  next_cursor: emptyToNull(z.string().trim().max(MAX_CURSOR)),
})

const Contact = z
  .object({
    id: Id.nullish(),
    name: OptStr,
    phone: OptStr,
    email: OptStr,
    country: emptyToNull(Country),
  })
  .nullish()

export const CustomOrderItemSchema = z.object({
  id: Id,
  product_id: Id.nullish(),
  sku: OptStr,
  name: OptStr,
  quantity: Int.nullish(),
  unit_price: Money.nullish(),
  total: Money.nullish(),
})

export const CustomOrderSchema = z.object({
  id: Id,
  number: OptStr,
  created_at: Instant,
  updated_at: Instant,
  status: z.enum(['pending', 'processing', 'on_hold', 'completed', 'cancelled', 'refunded', 'failed', 'draft']),
  financial_status: z.enum(['pending', 'authorized', 'paid', 'partially_paid', 'partially_refunded', 'refunded', 'voided']).nullish(),
  fulfillment_status: z.enum(['unfulfilled', 'partial', 'fulfilled', 'cancelled']).nullish(),
  payment_method: OptStr,
  payment_method_title: OptStr,
  is_cod: z.boolean().nullish(),
  currency: Currency,
  total: Money,
  customer: Contact,
  shipping: z.object({ city: OptStr, country: emptyToNull(Country), summary: OptStr }).nullish(),
  items: z.array(CustomOrderItemSchema).max(MAX_ORDER_ITEMS).default([]),
})

export const CustomCustomerSchema = z.object({
  id: Id,
  email: OptStr,
  first_name: OptStr,
  last_name: OptStr,
  phone: OptStr,
  country: emptyToNull(Country),
  marketing_consent: z.boolean().nullish(),
  call_consent: z.boolean().nullish(),
  orders_count: Int.nullish(),
  total_spent: Money.nullish(),
  created_at: Instant.nullish(),
  updated_at: Instant,
})

export const CustomProductSchema = z.object({
  id: Id,
  sku: OptStr,
  name: Str.min(1),
  status: z.enum(['active', 'draft', 'archived']).nullish(),
  price: Money.nullish(),
  currency: emptyToNull(Currency),
  stock_status: z.enum(['in_stock', 'out_of_stock', 'on_backorder']).nullish(),
  stock_quantity: Int.nullish(),
  url: emptyToNull(Url),
  updated_at: Instant,
})

export const CustomCartSchema = z.object({
  id: Id,
  customer: Contact,
  items: z.array(z.object({ name: Str.min(1), quantity: Int.nullish() })).max(MAX_CART_ITEMS).default([]),
  total: Money.nullish(),
  currency: emptyToNull(Currency),
  status: z.enum(['open', 'abandoned', 'recovered', 'expired']),
  abandoned_at: Instant.nullish(),
  recovered_order_id: Id.nullish(),
  updated_at: Instant,
})

/** Webhook body and single-record envelope. */
const WebhookBodySchema = z.object({ data: z.record(z.string(), z.unknown()) })
const ItemEnvelopeSchema = z.object({ item: z.record(z.string(), z.unknown()) })

type CustomOrder = z.output<typeof CustomOrderSchema>
type CustomCustomer = z.output<typeof CustomCustomerSchema>
type CustomProduct = z.output<typeof CustomProductSchema>
type CustomCart = z.output<typeof CustomCartSchema>

// ─── Value helpers ────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>

function obj(value: unknown): Obj {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {}
}

function orNull<T>(value: T | null | undefined): T | null {
  return value === undefined ? null : value
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

/** sha256 of the stable JSON (sorted keys) of the record exactly as the merchant sent it. */
export function payloadHashOf(record: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(sortKeys(record))).digest('hex')
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

/**
 * Status mapping: the contract uses the platform's own vocabulary, so every
 * accepted value maps to itself; a missing financial/fulfilment status is
 * `unknown` (automations never act on it). Unlisted values are rejected by
 * the schema (the record is skipped and counted, never half-mirrored).
 */
const ORDER_STATUS: Record<CustomOrder['status'], OrderStatus> = {
  pending: 'pending',
  processing: 'processing',
  on_hold: 'on_hold',
  completed: 'completed',
  cancelled: 'cancelled',
  refunded: 'refunded',
  failed: 'failed',
  draft: 'draft',
}
const FINANCIAL_STATUS: Record<NonNullable<CustomOrder['financial_status']>, FinancialStatus> = {
  pending: 'pending',
  authorized: 'authorized',
  paid: 'paid',
  partially_paid: 'partially_paid',
  partially_refunded: 'partially_refunded',
  refunded: 'refunded',
  voided: 'voided',
}
const FULFILLMENT_STATUS: Record<NonNullable<CustomOrder['fulfillment_status']>, FulfillmentStatus> = {
  unfulfilled: 'unfulfilled',
  partial: 'partial',
  fulfilled: 'fulfilled',
  cancelled: 'cancelled',
}
const PRODUCT_STATUS: Record<NonNullable<CustomProduct['status']>, ProductStatus> = { active: 'active', draft: 'draft', archived: 'archived' }
const STOCK_STATUS: Record<NonNullable<CustomProduct['stock_status']>, StockStatus> = { in_stock: 'in_stock', out_of_stock: 'out_of_stock', on_backorder: 'on_backorder' }
const CART_STATUS: Record<CustomCart['status'], CartStatus> = { open: 'open', abandoned: 'abandoned', recovered: 'recovered', expired: 'expired' }

type Outcome<T> = { ok: true; record: T } | { ok: false; issues: string }

function normalizeWith<S extends z.ZodType, T>(schema: S, to: (parsed: z.output<S>, raw: unknown) => T, raw: unknown): Outcome<T> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false, issues: describeIssues(parsed.error) }
  return { ok: true, record: to(parsed.data, raw) }
}

function toOrderItem(item: z.output<typeof CustomOrderItemSchema>): NormalizedOrderItem {
  return {
    externalId: item.id,
    productExternalId: orNull(item.product_id),
    sku: orNull(item.sku),
    name: item.name ?? item.sku ?? `#${item.id}`,
    quantity: Math.max(0, item.quantity ?? 1),
    unitPrice: orNull(item.unit_price),
    total: orNull(item.total),
  }
}

function toOrder(o: CustomOrder, raw: unknown): NormalizedOrder {
  const customer = o.customer ?? null
  const shipping = o.shipping ?? null
  return {
    externalId: o.id,
    orderNumber: o.number ?? o.id,
    customerExternalId: orNull(customer?.id),
    contactName: orNull(customer?.name),
    contactPhoneRaw: orNull(customer?.phone),
    contactEmail: orNull(customer?.email),
    shippingCity: orNull(shipping?.city),
    // The shipping country resolves national phone formats; the customer's country is the fallback.
    shippingCountry: shipping?.country ?? customer?.country ?? null,
    shippingSummary: orNull(shipping?.summary),
    status: ORDER_STATUS[o.status],
    financialStatus: o.financial_status ? FINANCIAL_STATUS[o.financial_status] : 'unknown',
    fulfillmentStatus: o.fulfillment_status ? FULFILLMENT_STATUS[o.fulfillment_status] : 'unknown',
    // The core flags COD from paymentMethod/paymentMethodTitle (lib/commerce/store.ts isCodPayment: a configured
    // list plus whole-word cod/ramburs/…), so a merchant id like "cod_fan" would be missed. is_cod=true is
    // authoritative: the mirrored id becomes the conventional "cod" and the merchant's id lives in metadata.
    paymentMethod: o.is_cod === true ? 'cod' : (o.payment_method ?? null),
    paymentMethodTitle: orNull(o.payment_method_title),
    currency: o.currency,
    total: o.total,
    items: o.items.map(toOrderItem),
    providerCreatedAt: o.created_at,
    providerUpdatedAt: o.updated_at,
    payloadHash: payloadHashOf(raw),
    metadata: {
      // Authoritative flag of the contract, kept for the core alongside its own payment-method detection.
      is_cod: orNull(o.is_cod),
      payment_method: orNull(o.payment_method),
      customer_country: orNull(customer?.country),
    },
  }
}

function toCustomer(c: CustomCustomer, raw: unknown): NormalizedCustomer {
  return {
    externalId: c.id,
    email: orNull(c.email),
    firstName: orNull(c.first_name),
    lastName: orNull(c.last_name),
    phoneRaw: orNull(c.phone),
    countryCode: orNull(c.country),
    marketingConsent: orNull(c.marketing_consent),
    callConsent: orNull(c.call_consent),
    ordersCount: orNull(c.orders_count),
    totalSpent: orNull(c.total_spent),
    providerCreatedAt: orNull(c.created_at),
    providerUpdatedAt: c.updated_at,
    metadata: { payload_hash: payloadHashOf(raw) },
  }
}

function toProduct(p: CustomProduct, raw: unknown): NormalizedProduct {
  return {
    externalId: p.id,
    sku: orNull(p.sku),
    name: p.name,
    status: p.status ? PRODUCT_STATUS[p.status] : 'unknown',
    price: orNull(p.price),
    currency: orNull(p.currency),
    stockStatus: p.stock_status ? STOCK_STATUS[p.stock_status] : 'unknown',
    stockQuantity: orNull(p.stock_quantity),
    url: orNull(p.url),
    providerUpdatedAt: p.updated_at,
    metadata: { payload_hash: payloadHashOf(raw) },
  }
}

function toCart(c: CustomCart, raw: unknown): NormalizedCart {
  const customer = c.customer ?? null
  return {
    externalId: c.id,
    customerExternalId: orNull(customer?.id),
    contactName: orNull(customer?.name),
    contactPhoneRaw: orNull(customer?.phone),
    contactEmail: orNull(customer?.email),
    status: CART_STATUS[c.status],
    currency: orNull(c.currency),
    total: orNull(c.total),
    items: c.items.map((i) => ({ name: i.name, quantity: Math.max(1, i.quantity ?? 1) })),
    abandonedAt: orNull(c.abandoned_at),
    recoveredOrderExternalId: orNull(c.recovered_order_id),
    providerUpdatedAt: c.updated_at,
    metadata: { country: orNull(customer?.country), payload_hash: payloadHashOf(raw) },
  }
}

/** Normalizes a contract Order (list item, single read or webhook data). Null when it does not follow the contract. */
export function normalizeCustomOrder(raw: unknown): NormalizedOrder | null {
  const out = normalizeWith(CustomOrderSchema, toOrder, raw)
  return out.ok ? out.record : null
}

export function normalizeCustomCustomer(raw: unknown): NormalizedCustomer | null {
  const out = normalizeWith(CustomCustomerSchema, toCustomer, raw)
  return out.ok ? out.record : null
}

export function normalizeCustomProduct(raw: unknown): NormalizedProduct | null {
  const out = normalizeWith(CustomProductSchema, toProduct, raw)
  return out.ok ? out.record : null
}

export function normalizeCustomCart(raw: unknown): NormalizedCart | null {
  const out = normalizeWith(CustomCartSchema, toCart, raw)
  return out.ok ? out.record : null
}

/** The record shape of each list resource (also the data shape of the webhook topics about it). */
function schemaFor(resource: SyncResource): z.ZodType {
  switch (resource) {
    case 'orders':
      return CustomOrderSchema
    case 'customers':
      return CustomCustomerSchema
    case 'products':
      return CustomProductSchema
    case 'carts':
      return CustomCartSchema
  }
}

/** Field paths and codes of a record that breaks the contract, or null when it follows it. */
function recordIssues(resource: SyncResource, raw: unknown): string | null {
  const parsed = schemaFor(resource).safeParse(raw)
  return parsed.success ? null : describeIssues(parsed.error)
}

function resourceOfTopic(topic: CustomWebhookTopic): SyncResource {
  switch (topic) {
    case 'order.created':
    case 'order.updated':
      return 'orders'
    case 'product.updated':
      return 'products'
    case 'customer.updated':
      return 'customers'
    case 'cart.updated':
      return 'carts'
  }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

interface ListPage {
  items: unknown[]
  nextCursor: string | null
}

const PROBE_LABELS: Record<SyncResource, string> = { orders: 'The first order', customers: 'The first customer', products: 'The first product', carts: 'The first cart' }

/**
 * A declared list endpoint that does not answer 200 JSON at connection time.
 * /health already proved the base URL, so a missing endpoint is a contract
 * violation on the store's side and the message names it.
 */
function probeFailure(resource: SyncResource, res: ApiResponse): ConnectionError {
  const endpoint = `GET /${resource}`
  const detail = `custom ${resource}.probe: HTTP ${res.status}`
  if (res.status === 401) return new ConnectionError('unauthorized', `The API rejected the authentication (401) at ${endpoint}. Check the scheme and the token.`, false, detail)
  if (res.status === 403) return new ConnectionError('forbidden', `The API refused access (403) at ${endpoint}: the token lacks the required permissions.`, false, detail)
  if (res.status === 429) return new ConnectionError('rate_limited', `The API is rate limiting requests (429) at ${endpoint}; try again in a few minutes.`, true, detail)
  if (res.status >= 500) return new ConnectionError('unreachable', `${endpoint} answered with a server error (${res.status}); try again.`, true, detail)
  const why = resource === 'orders' ? 'the connector requires it' : `/health reports capabilities.${resource}=true`
  return new ConnectionError(
    'invalid_response',
    `${endpoint} does not answer according to the contract (HTTP ${res.status}${looksLikeHtml(res) ? ', HTML' : ''}) although ${why}. Implement the endpoint or declare the capability false in GET /health.`,
    false,
    detail,
  )
}

function parseListEnvelope(res: ApiResponse, operation: string): ListPage {
  const parsed = CustomListSchema.safeParse(res.json)
  if (!parsed.success) throw invalidResponse(operation, `list envelope: ${describeIssues(parsed.error)}`)
  return { items: parsed.data.items, nextCursor: parsed.data.next_cursor ?? null }
}

const SIGNATURE_RE = /^sha256=([0-9a-f]{64})$/i
const DELIVERY_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/
const TIMESTAMP_RE = /^\d{1,12}$/
/**
 * One request path segment: the contract's id charset minus '/', '?', '#',
 * which would change the route, and never the dot segments '.' / '..' (the
 * URL parser folds "/orders/.." into the API root, i.e. another endpoint).
 */
const PATH_ID_RE = /^(?!\.{1,2}$)[^\s\x00-\x1f\x7f/?#]{1,128}$/

function isKnownTopic(topic: string): topic is CustomWebhookTopic {
  return (CUSTOM_WEBHOOK_TOPICS as readonly string[]).includes(topic)
}

/** Capabilities from /health plus whether a webhook secret is configured; notes explain every false value. */
export function capabilitiesFrom(health: z.output<typeof CustomHealthSchema>, hasWebhookSecret: boolean): CommerceCapabilities {
  const api = health.capabilities
  const notes: string[] = []
  const webhooks = api.webhooks && hasWebhookSecret
  if (webhooks) notes.push(NOTE_WEBHOOKS_MANUAL)
  else if (!api.webhooks) notes.push(NOTE_WEBHOOKS_NOT_SENT)
  else notes.push(NOTE_NO_WEBHOOK_SECRET)
  if (!api.carts) notes.push(NOTE_NO_CARTS)
  else if (!webhooks) notes.push(NOTE_CARTS_POLLED)
  if (!api.products) notes.push(NOTE_NO_PRODUCTS)
  if (!api.customers) notes.push(NOTE_NO_CUSTOMERS)
  return {
    products: api.products,
    customers: api.customers,
    orders: api.orders,
    webhooks,
    // Carts arrive by polling GET /carts or by the cart.updated webhook: either way the API must expose them.
    abandoned_carts: api.carts,
    customer_phone: true,
    polling_minutes: webhooks ? null : CUSTOM_POLLING_MINUTES,
    notes,
  }
}

export function createCustomAdapter(deps: CustomAdapterDeps = {}): CommerceAdapter {
  const now = deps.now ?? Date.now

  async function fetchOne<T>(connection: AdapterConnection, resource: 'orders' | 'customers' | 'products', externalId: string, normalize: (raw: unknown) => T | null, log: Logger): Promise<T | null> {
    const operation = `${resource}.get`
    if (!PATH_ID_RE.test(externalId)) {
      log.warn('custom.fetch.invalid_id', { operation, storeDomain: connection.storeDomain })
      return null
    }
    // /health said the API does not expose this resource: nothing newer than the mirror can exist there.
    if (!connection.capabilities[resource]) return null
    const ctx = connectionContext(connection)
    const res = await apiRequest(deps, ctx, operation, { path: `/${resource}/${encodeURIComponent(externalId)}` })
    // 404 = not found; 501 = the optional single-record endpoint is not implemented. Both mean "nothing newer than the mirror".
    if (res.status === 404 || res.status === 501) return null
    if (res.status !== 200 || looksLikeHtml(res)) throw httpFailure(res, operation)
    const envelope = ItemEnvelopeSchema.safeParse(res.json)
    if (!envelope.success) throw invalidResponse(operation, `item envelope: ${describeIssues(envelope.error)}`)
    const record = normalize(envelope.data.item)
    if (!record) throw invalidResponse(operation, 'item does not follow the contract')
    return record
  }

  return {
    platform: 'custom',

    getCapabilities(connection) {
      // Decided at validation (health + webhook secret); only the polling cadence is re-derived for older rows.
      const caps = connection.capabilities
      return { ...caps, customer_phone: true, polling_minutes: caps.webhooks ? null : (caps.polling_minutes ?? CUSTOM_POLLING_MINUTES) }
    },

    async validateConnection(input: ConnectInput, log: Logger): Promise<ValidatedStore> {
      const secrets = parseSecrets(input.secrets)
      const { storeUrl, storeDomain } = canonicalBaseUrl(input.storeUrl)
      const ctx = contextFor(storeUrl, secrets)

      // 1. Authenticated read that proves the credentials and the contract at once.
      const res = await apiRequest(deps, ctx, 'health', { path: '/health' })
      if (res.status !== 200 || looksLikeHtml(res)) throw httpFailure(res, 'health')
      const body = obj(res.json)
      if (!Object.keys(body).length) throw invalidResponse('health', 'not a JSON object')
      if (body.ok === false) throw new ConnectionError('invalid_response', 'The API reports that it is not ready (ok=false in GET /health).', true, 'custom health: ok=false')
      const version = typeof body.contract_version === 'string' ? body.contract_version.trim() : ''
      if (version !== CUSTOM_CONTRACT_VERSION) {
        const shown = /^[A-Za-z0-9.-]{1,16}$/.test(version) ? version : 'unknown'
        throw new ConnectionError('api_version_unsupported', `The contract version reported by the API (${shown}) is not accepted: version ${CUSTOM_CONTRACT_VERSION} is required.`, false, `custom health: contract_version ${shown}`)
      }
      const health = CustomHealthSchema.safeParse(body)
      if (!health.success) throw contractViolation('health', 'The GET /health response', describeIssues(health.error))
      if (!health.data.capabilities.orders) {
        throw new ConnectionError('invalid_response', 'The API reports that it does not expose orders (capabilities.orders=false): the connector requires GET /orders.', false, 'custom health: orders=false')
      }

      // 2. Every list endpoint /health declares must exist and its first record must follow the contract: a
      //    capability is evidence from the real API, never the store's word alone, and the merchant learns
      //    about a contract mistake now, not at the first sync (or never, for a resource that silently 404s).
      const probe = async (resource: SyncResource): Promise<number> => {
        const operation = `${resource}.probe`
        const res = await apiRequest(deps, ctx, operation, { path: `/${resource}`, query: { limit: 1 } })
        if (res.status !== 200 || looksLikeHtml(res)) throw probeFailure(resource, res)
        const page = parseListEnvelope(res, operation)
        if (page.items.length) {
          const issues = recordIssues(resource, page.items[0])
          if (issues) throw contractViolation(operation, `${PROBE_LABELS[resource]} from GET /${resource}`, issues)
        }
        return page.items.length
      }
      const declared = health.data.capabilities
      const samples: Partial<Record<SyncResource, number>> = { orders: await probe('orders') }
      if (declared.customers) samples.customers = await probe('customers')
      if (declared.products) samples.products = await probe('products')
      if (declared.carts) samples.carts = await probe('carts')

      const capabilities = capabilitiesFrom(health.data, !!secrets.webhook_secret)
      const store = health.data.store ?? null
      log.info('custom.validate.ok', {
        storeDomain,
        authScheme: secrets.auth_scheme,
        webhooks: capabilities.webhooks,
        carts: capabilities.abandoned_carts,
        products: capabilities.products,
        customers: capabilities.customers,
        samples,
      })
      return {
        storeUrl,
        storeDomain,
        displayName: orNull(store?.name),
        currency: orNull(store?.currency),
        countryCode: orNull(store?.country),
        timezone: orNull(store?.timezone),
        language: orNull(store?.language),
        platformVersion: health.data.contract_version,
        capabilities,
        secrets: {
          auth_scheme: secrets.auth_scheme,
          auth_token: secrets.auth_token,
          ...(secrets.auth_scheme === 'api_key_header' && secrets.auth_header_name ? { auth_header_name: secrets.auth_header_name } : {}),
          ...(secrets.webhook_secret ? { webhook_secret: secrets.webhook_secret } : {}),
        },
      }
    },

    async registerWebhooks(connection: AdapterConnection, log: Logger): Promise<WebhookRegistration[]> {
      if (!connection.webhookUrl) {
        throw new ConnectionError('not_configured', 'The public webhook address is not configured on the platform.', false, 'custom webhooks: no webhook url')
      }
      const secrets = parseSecrets(connection.secrets)
      // Nothing can be created on the merchant's side: deliveries are theirs to send. Registrations recorded as
      // 'manual' elsewhere (a future "I send webhooks" confirmation) are kept so the call stays idempotent.
      const manual = connection.webhookRegistrations.filter((r) => r.source === 'manual')
      log.info('custom.webhooks.manual', { storeDomain: connection.storeDomain, secretConfigured: !!secrets.webhook_secret, kept: manual.length })
      return manual
    },

    async unregisterWebhooks(connection: AdapterConnection, log: Logger): Promise<void> {
      // No registration exists on the merchant's side; the connection's webhook URL simply stops accepting deliveries.
      log.info('custom.webhooks.unregistered', { storeDomain: connection.storeDomain, kept: connection.webhookRegistrations.length })
    },

    async syncPage(connection: AdapterConnection, resource: SyncResource, checkpoint: SyncCheckpoint, mode, log: Logger): Promise<SyncBatch> {
      const caps = connection.capabilities
      const exposed = resource === 'carts' ? caps.abandoned_carts : caps[resource]
      if (!exposed) {
        // /health said the API does not expose this resource: nothing to read, the pass is complete.
        return { resource, [resource]: [], checkpoint: { ...checkpoint, cursor: null }, done: true }
      }
      const operation = `${resource}.list`
      // Opaque cursors can cycle; the worker bounds pages per slice, not per pass, so a pass that never ends
      // would burn requests forever. Not retryable: the same cursor sequence would come back.
      if (checkpoint.pages >= CUSTOM_MAX_PAGES_PER_PASS) {
        throw new ConnectionError(
          'invalid_response',
          `Paging GET /${resource} does not end after ${CUSTOM_MAX_PAGES_PER_PASS} pages: next_cursor must become null on the last page.`,
          false,
          `custom ${operation}: page budget exhausted (${checkpoint.pages})`,
        )
      }
      const ctx = connectionContext(connection)
      const modifiedAfter = mode === 'incremental' && checkpoint.modifiedAfter && Number.isFinite(Date.parse(checkpoint.modifiedAfter)) ? new Date(Date.parse(checkpoint.modifiedAfter)).toISOString() : undefined
      const res = await apiRequest(deps, ctx, operation, {
        path: `/${resource}`,
        query: { limit: CUSTOM_PAGE_SIZE, cursor: checkpoint.cursor ?? undefined, modified_after: modifiedAfter },
        timeoutMs: LIST_TIMEOUT_MS,
        maxBytes: LIST_MAX_BYTES,
      })
      if (res.status !== 200 || looksLikeHtml(res)) throw httpFailure(res, operation)
      const page = parseListEnvelope(res, operation)
      // A cursor that does not move would page forever (the worker's page budget would just burn every run).
      if (page.nextCursor !== null && page.nextCursor === checkpoint.cursor) throw invalidResponse(operation, 'next_cursor did not advance')
      const done = page.nextCursor === null
      const batch: SyncBatch = { resource, checkpoint: { cursor: done ? null : page.nextCursor, modifiedAfter: checkpoint.modifiedAfter, pages: checkpoint.pages + 1 }, done }
      let skipped = 0
      let firstIssue: string | null = null
      const keep = <S extends z.ZodType, T>(schema: S, to: (parsed: z.output<S>, raw: unknown) => T): T[] => {
        const out: T[] = []
        for (const raw of page.items) {
          const result = normalizeWith(schema, to, raw)
          if (result.ok) out.push(result.record)
          else {
            skipped++
            firstIssue ??= result.issues
          }
        }
        return out
      }
      if (resource === 'orders') batch.orders = keep(CustomOrderSchema, toOrder)
      else if (resource === 'customers') batch.customers = keep(CustomCustomerSchema, toCustomer)
      else if (resource === 'products') batch.products = keep(CustomProductSchema, toProduct)
      else batch.carts = keep(CustomCartSchema, toCart)
      const fields = { storeDomain: connection.storeDomain, resource, mode, count: page.items.length, skipped, incremental: !!modifiedAfter, done }
      // Skipped records are a contract problem on the merchant's side: the first field path says where (never a value).
      if (skipped) log.warn('custom.sync.page_with_invalid_records', { ...fields, firstIssue })
      else log.info('custom.sync.page', fields)
      return batch
    },

    async verifyWebhook(request: RawWebhookRequest, connection: AdapterConnection): Promise<VerifiedCommerceEvent | VerificationFailure> {
      const parsed = CustomSecretsSchema.safeParse(connection.secrets)
      const secret = parsed.success ? parsed.data.webhook_secret : undefined
      if (!secret) return { ok: false, reason: 'not_supported', status: 400 }
      const signatureHeader = request.headers.get(SIGNATURE_HEADER)?.trim() ?? ''
      if (!signatureHeader) return { ok: false, reason: 'missing_signature', status: 401 }
      const match = SIGNATURE_RE.exec(signatureHeader)
      if (!match) return { ok: false, reason: 'bad_signature', status: 401 }
      // HMAC over the exact bytes received; hex decoding of 64 hex chars always yields 32 bytes, like the digest.
      const expected = crypto.createHmac('sha256', secret).update(request.rawBody).digest()
      const given = Buffer.from(match[1], 'hex')
      if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: 'bad_signature', status: 401 }
      // Replay window. The timestamp is not part of the signed data (contract v1), so it only bounds how long a
      // captured delivery stays acceptable; exact replays are caught by the event id + body hash dedupe.
      const timestampHeader = request.headers.get(TIMESTAMP_HEADER)?.trim() ?? ''
      if (!TIMESTAMP_RE.test(timestampHeader)) return { ok: false, reason: 'malformed', status: 400 }
      const skew = Math.abs(Math.floor(now() / 1000) - Number(timestampHeader))
      if (skew > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) return { ok: false, reason: 'malformed', status: 400 }
      const topic = request.headers.get(TOPIC_HEADER)?.trim().toLowerCase() ?? ''
      if (!isKnownTopic(topic)) return { ok: false, reason: 'unknown_topic', status: 400 }
      let payload: unknown
      try {
        payload = JSON.parse(new TextDecoder().decode(request.rawBody))
      } catch (err) {
        void err // Signed but not JSON: the merchant's bug, reported as malformed.
        return { ok: false, reason: 'malformed', status: 400 }
      }
      const body = WebhookBodySchema.safeParse(payload)
      if (!body.success) return { ok: false, reason: 'malformed', status: 400 }
      // The record must follow the topic's contract shape: a 400 now is the only feedback the merchant's
      // system gets (a 200 followed by an 'ignored' event would hide the mistake).
      if (recordIssues(resourceOfTopic(topic), body.data.data) !== null) return { ok: false, reason: 'malformed', status: 400 }
      const eventId = request.headers.get(EVENT_ID_HEADER)?.trim() ?? ''
      const id = Id.safeParse(body.data.data.id)
      return {
        ok: true,
        topic,
        deliveryId: DELIVERY_ID_RE.test(eventId) ? eventId : null,
        externalResourceId: id.success ? id.data : null,
        payload: body.data,
      }
    },

    normalizeEvent(event: VerifiedCommerceEvent): CommerceEvent[] {
      const malformed = (what: string): CommerceEvent[] => [{ kind: 'ignored', reason: `malformed_payload:${what}` }]
      const data = obj(obj(event.payload).data)
      switch (event.topic) {
        case 'order.created':
        case 'order.updated': {
          const order = normalizeCustomOrder(data)
          if (!order) return malformed('order')
          return [{ kind: event.topic, order }]
        }
        case 'product.updated': {
          const product = normalizeCustomProduct(data)
          return product ? [{ kind: 'product.updated', product }] : malformed('product')
        }
        case 'customer.updated': {
          const customer = normalizeCustomCustomer(data)
          return customer ? [{ kind: 'customer.updated', customer }] : malformed('customer')
        }
        case 'cart.updated': {
          const cart = normalizeCustomCart(data)
          return cart ? [{ kind: 'cart.updated', cart }] : malformed('cart')
        }
        default:
          // verifyWebhook only lets the five topics through; a stored event with another topic predates this build.
          return [{ kind: 'ignored', reason: `unhandled_topic:${event.topic}` }]
      }
    },

    fetchOrder(connection, externalId, log) {
      return fetchOne(connection, 'orders', externalId, normalizeCustomOrder, log)
    },
    fetchCustomer(connection, externalId, log) {
      return fetchOne(connection, 'customers', externalId, normalizeCustomCustomer, log)
    },
    fetchProduct(connection, externalId, log) {
      return fetchOne(connection, 'products', externalId, normalizeCustomProduct, log)
    },
  }
}

export const customAdapter = createCustomAdapter()
