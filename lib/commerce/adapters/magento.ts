import 'server-only'
// Magento Open Source / Adobe Commerce adapter: the REST API (/rest/V1) over
// HTTPS, authenticated with the merchant's integration credentials.
//
// Verified against the official documentation and the Magento 2 source
// (magento/magento2, 2.4-develop) on 2026-10-13:
//   • https://developer.adobe.com/commerce/webapi/get-started/authentication/
//     and the token guide (commerce-webapi: get-started/authentication/
//     gs-authentication-token.md): "Authorization: Bearer <authentication
//     token>"; an integration token's lifetime is "Indefinite. It lasts until
//     it is manually revoked."; BUT using the access token alone as a Bearer
//     token "has been disabled by default due to the security implications of
//     a never-expiring access token" (Magento 2.4.4+): the merchant either
//     enables Stores → Configuration → Services → OAuth → Consumer Settings →
//     "Allow OAuth Access Tokens to be used as standalone Bearer tokens"
//     (bin/magento config:set oauth/consumer/enable_integration_as_bearer 1)
//     or the request is signed with the four OAuth 1.0a credentials
//     (gs-authentication-oauth.md: consumer key/secret, access token/secret,
//     "Only HMAC-SHA256 is supported"). Both are implemented here: the
//     integration's Access Token alone selects Bearer, the four credentials
//     select OAuth 1.0a signing (see magentoOAuthHeader);
//   • Magento\Webapi\Model\Authorization\TokenUserContext::processRequest:
//     an unknown, revoked or Bearer-disabled token is NOT an error, the
//     request simply continues as a guest; the ACL check then answers 401.
//     Magento\WebapiSecurity (AnonymousResourceSecurity) makes GET
//     /V1/store/storeConfigs, /V1/store/storeViews and GET /V1/products
//     anonymous when "Allow Anonymous Guest Access" is enabled, so a 200
//     from those routes never proves the credential: only the orders read
//     does (Magento_Sales::actions_view is never anonymous);
//   • https://developer.adobe.com/commerce/webapi/rest/use-rest/performing-searches/
//     (searchCriteria[filter_groups][i][filters][j][field|value|condition_type],
//     searchCriteria[sortOrders][i][field|direction], pageSize, currentPage;
//     filter groups are ANDed) and Magento\Framework\Api\SearchResults
//     (response keys items, search_criteria, total_count);
//   • app/code/Magento/{Store,Sales,Customer,Catalog}/etc/webapi.xml: GET
//     /V1/store/storeConfigs and /V1/store/storeViews (Magento_Backend::store),
//     GET /V1/orders and /V1/orders/:id (Magento_Sales::actions_view), GET
//     /V1/customers/search and /V1/customers/:id (Magento_Customer::customer),
//     GET /V1/products and /V1/products/:sku (Magento_Catalog::products);
//   • Magento\Framework\Webapi\ErrorProcessor and Rest\Response: an
//     AuthorizationException (bad token OR missing ACL resource, same text
//     "The consumer isn't authorized to access %resources.") answers 401, an
//     unknown route 404 "Request does not match any route.", a missing entity
//     404; the body is { message, parameters?, errors?, code? };
//   • Magento\Framework\Oauth\Oauth (_validateSignature, processNonRequiredParams),
//     Oauth\Helper\Request (header parsing with rawurldecode, query pairs added
//     to the signed parameters) and Oauth\Helper\Signature\Hmac (base string,
//     ksort, rawurlencode, HMAC key) for the OAuth 1.0a signature; the nonce
//     is 32 characters (Oauth\Helper\Oauth::LENGTH_NONCE), the timestamp may
//     not run more than 600 s ahead of the store (Nonce\Generator);
//   • Magento\Sales\Api\Data\{Order,OrderItem,OrderPayment,OrderAddress,
//     ShippingAssignment,Shipping}Interface and Magento\Customer\Api\Data\
//     {Customer,Address}Interface for the field names read below;
//   • https://experienceleague.adobe.com/en/docs/commerce-admin/stores-sales/order-management/orders/order-status
//     (status codes incl. received, rejected and Magento's own spelling
//     `paypay_canceled_reversal`; closed = credit memo and refund, complete =
//     paid and shipped, holded = manual hold);
//   • Magento\CatalogInventory: the `stock_item` product extension attribute is
//     filled by the AfterProductLoad plugin on Product::load only, so GET
//     /V1/products/{sku} carries qty / is_in_stock while the getList
//     collection (GET /V1/products) does not on a stock Magento;
//   • Magento\Framework\Data\Collection::getCurPage does not clamp a page
//     beyond the last one (an empty page comes back), but the scan below does
//     not page by offset at all (see Pagination);
//   • https://developer.adobe.com/commerce/extensibility/events/installation/
//     ("requires Adobe Commerce 2.4.4 or higher", "Magento Open Source is not
//     supported", an App Builder project) and
//     https://developer.adobe.com/commerce/extensibility/webhooks/installation/
//     (composer package magento/commerce-webhooks + bin/magento
//     webhooks:generate:module): neither can be set up through the REST API.
//
// Consequences for this adapter:
//   • no webhooks: every connection polls (MAGENTO_POLLING_MINUTES);
//     verifyWebhook answers not_supported and registerWebhooks returns [];
//   • no abandoned carts: quotes are not exposed by the standard REST API;
//   • a 401 is reported as `unauthorized` with every cause the merchant can
//     fix (token, Bearer setting, Sales ACL): Magento does not tell them
//     apart, and no earlier 200 can be taken as proof of the credential;
//   • Pagination is keyset-based: every page asks for entity_id > cursor,
//     ordered by entity_id ASC, with currentPage fixed at 1. A record created,
//     edited or deleted during the scan cannot shift a page boundary, the scan
//     never depends on total_count, and a page that fails to advance the
//     cursor is an error rather than a loop. Incremental syncs add
//     updated_at >= watermark − MAGENTO_INCREMENTAL_OVERLAP_MS (server-side):
//     the overlap absorbs the second precision of the column and a store
//     clock that runs behind ours; re-reads are idempotent upserts.
//
// No credential ever reaches a log field, an error message or a URL: the
// Bearer token and the OAuth signature travel in the Authorization header only.

import crypto from 'node:crypto'
import { z } from 'zod'
import type { Logger } from '@/lib/observability/logger'
import { StoreHttpError, UnsafeUrlError, safeFetch } from '../safe-fetch'
import type {
  CommerceCapabilities,
  CommerceEvent,
  FinancialStatus,
  FulfillmentStatus,
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
 * REST API version segment of every request (/rest/V1/...). V1 is the only
 * published version of the Magento 2 / Adobe Commerce web API
 * (https://developer.adobe.com/commerce/webapi/rest/use-rest/performing-searches/, read 2026-10-13).
 */
export const MAGENTO_API_VERSION = 'V1'
const API_PATH = `/rest/${MAGENTO_API_VERSION}`
/** Public plain-text route of the Magento_Version module ("Magento/2.4 (Community)"); optional, often disabled. */
const VERSION_PATH = '/magento_version'

/** searchCriteria[pageSize] of every list; Magento documents no cap, the response size does (LIST_MAX_BYTES). */
export const MAGENTO_PAGE_SIZE = 100
/** Polling cadence of every Magento connection (no webhooks on Open Source). */
export const MAGENTO_POLLING_MINUTES = 15
/**
 * How far before the watermark an incremental sync starts reading. updated_at
 * has second precision and is written with the store's clock, the watermark
 * with ours: without an overlap a record edited in the last seconds of a
 * pass, or on a store whose clock runs behind, would be skipped for good.
 */
export const MAGENTO_INCREMENTAL_OVERLAP_MS = 10 * 60_000
const LIST_TIMEOUT_MS = 30_000
const LIST_MAX_BYTES = 8 * 1024 * 1024
/** The only signature method Magento 2.4 accepts (Magento\Framework\Oauth\Oauth::getSupportedSignatureMethods). */
const OAUTH_SIGNATURE_METHOD = 'HMAC-SHA256'

/** Merchant-facing notes (Romanian) stored in capabilities.notes. */
export const NOTE_NO_WEBHOOKS =
  'Magento Open Source nu are webhook-uri standard (Adobe I/O Events și Webhooks necesită Adobe Commerce 2.4.4+ cu App Builder): datele ajung prin sincronizare periodică, la 15 minute.'
export const NOTE_NO_CARTS = 'Coșurile abandonate nu sunt expuse de API-ul REST standard Magento: automatizarea nu este disponibilă fără un modul dedicat.'
export const NOTE_NO_PRODUCTS = 'Token-ul nu are acces la catalog (Catalog → Products): produsele nu se sincronizează.'
export const NOTE_NO_CUSTOMERS = 'Token-ul nu are acces la clienți (Customers → All Customers): clienții nu se sincronizează; telefonul de contact vine din comenzi.'
export const NOTE_NO_STORE_CONFIG = 'Token-ul nu poate citi configurația magazinului (Stores → Settings → Configuration): moneda, fusul orar și numele magazinului nu au fost detectate.'
export const NOTE_NO_LIST_STOCK = 'Lista standard de produse Magento nu include stocul: stocul se actualizează doar la citirea individuală a unui produs.'

/** Merchant-facing explanation of a 401, per credential kind (Magento answers 401 for every cause). */
const UNAUTHORIZED_MESSAGE = {
  bearer:
    'Magazinul a refuzat accesul (401). Verifică Access Token-ul, că integrarea este activă și că are bifată resursa Sales → Operations → Orders. Pe Magento 2.4.4+ token-ul singur nu este acceptat implicit: activează Stores → Configuration → Services → OAuth → Consumer Settings → „Allow OAuth Access Tokens to be used as standalone Bearer tokens” sau completează Consumer Key, Consumer Secret și Access Token Secret (semnare OAuth).',
  oauth:
    'Magazinul a refuzat semnătura OAuth (401). Verifică Consumer Key, Consumer Secret, Access Token și Access Token Secret, că integrarea este activă, că are bifată resursa Sales → Operations → Orders și că ora serverului magazinului este corectă.',
} as const

const credential = z.string().trim().regex(/^[A-Za-z0-9._~+/=-]{16,512}$/, 'Credential has an unexpected format')
/** An optional credential: a blank form field counts as absent. */
const optionalCredential = z.preprocess((value) => (typeof value === 'string' && !value.trim() ? undefined : value), credential.optional())

/**
 * Connect-form secrets of the integration (Admin → System → Extensions →
 * Integrations). The Access Token alone authenticates as a Bearer token
 * (needs "Allow OAuth Access Tokens to be used as standalone Bearer tokens" on
 * 2.4.4+); with the Consumer Key, Consumer Secret and Access Token Secret
 * every request is signed with OAuth 1.0a instead. Magento generates 32
 * alphanumeric characters for each; the shape is checked loosely (RFC 6750
 * b64token characters) so a store with a customised generator still connects.
 */
export const MagentoSecretsSchema = z
  .object({
    access_token: credential,
    consumer_key: optionalCredential,
    consumer_secret: optionalCredential,
    access_token_secret: optionalCredential,
  })
  .refine(
    (s) => {
      const given = [s.consumer_key, s.consumer_secret, s.access_token_secret].filter((v) => v !== undefined).length
      return given === 0 || given === 3
    },
    { message: 'OAuth signing needs consumer_key, consumer_secret and access_token_secret together' },
  )
export type MagentoSecrets = z.infer<typeof MagentoSecretsSchema>

export interface MagentoAdapterDeps {
  fetchImpl?: typeof fetch
  /** DNS resolver handed to the SSRF guard (tests resolve to a public address). */
  lookup?: (hostname: string) => Promise<string[]>
  /** OAuth nonce source (32 characters) and clock; tests pin them. */
  nonce?: () => string
  now?: () => number
}

// ─── Store URL ────────────────────────────────────────────────────────────────

/**
 * Canonical base URL of the Magento install: https, lower-case host, no
 * query/hash, no trailing slash. A pasted REST root (…/rest/V1, …/rest/all/V1,
 * …/rest/default/V1/) is reduced to the install; a sub-directory or an
 * index.php front controller (https://host/index.php) keeps its path because
 * the API lives under it.
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
  let path = url.pathname.replace(/\/rest(\/.*)?$/i, '').replace(/\/+$/, '')
  if (path === '/') path = ''
  const host = url.hostname.toLowerCase()
  const origin = `https://${host}${url.port ? `:${url.port}` : ''}`
  return { storeUrl: `${origin}${path}`, storeDomain: host }
}

// ─── Authentication ───────────────────────────────────────────────────────────

type MgAuth = { kind: 'bearer'; token: string } | { kind: 'oauth'; consumerKey: string; consumerSecret: string; token: string; tokenSecret: string }

interface MgContext {
  storeUrl: string
  auth: MgAuth
}

type QueryPairs = ReadonlyArray<readonly [string, string]>

/** RFC 3986 percent-encoding, byte for byte what PHP's rawurlencode produces (only unreserved characters stay). */
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

/**
 * OAuth 1.0a Authorization header as Magento verifies it
 * (Magento\Framework\Oauth\Oauth::_validateSignature with
 * Oauth\Helper\Signature\Hmac, 2.4-develop):
 *   base string = METHOD & enc(scheme://host[:port]path) & enc(P), where P is
 *   every parameter (oauth_* except the signature, plus the query string
 *   pairs) sorted by key (ksort) and joined as enc(key)=enc(value) with &;
 *   key = enc(consumer secret) & enc(token secret); HMAC-SHA256, base64.
 * Magento decodes header values with rawurldecode and query values with
 * rawurldecode + urldecode before signing, so the query is sent percent-encoded
 * (never with + for a space) and signed decoded. Only HMAC-SHA256 is accepted.
 */
export function magentoOAuthHeader(
  auth: { consumerKey: string; consumerSecret: string; token: string; tokenSecret: string },
  method: string,
  baseUrl: string,
  query: QueryPairs,
  nonce: string,
  timestampSeconds: number,
): string {
  const oauthParams: ReadonlyArray<readonly [string, string]> = [
    ['oauth_consumer_key', auth.consumerKey],
    ['oauth_nonce', nonce],
    ['oauth_signature_method', OAUTH_SIGNATURE_METHOD],
    ['oauth_timestamp', String(Math.floor(timestampSeconds))],
    ['oauth_token', auth.token],
    ['oauth_version', '1.0'],
  ]
  const sorted = [...oauthParams, ...query].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const paramString = sorted.map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`).join('&')
  const baseString = `${method.toUpperCase()}&${rfc3986(baseUrl)}&${rfc3986(paramString)}`
  const key = `${rfc3986(auth.consumerSecret)}&${rfc3986(auth.tokenSecret)}`
  const signature = crypto.createHmac('sha256', key).update(baseString).digest('base64')
  return `OAuth ${[...oauthParams, ['oauth_signature', signature] as const].map(([k, v]) => `${rfc3986(k)}="${rfc3986(v)}"`).join(', ')}`
}

function authOf(secrets: MagentoSecrets): MgAuth {
  if (secrets.consumer_key && secrets.consumer_secret && secrets.access_token_secret) {
    return { kind: 'oauth', consumerKey: secrets.consumer_key, consumerSecret: secrets.consumer_secret, token: secrets.access_token, tokenSecret: secrets.access_token_secret }
  }
  return { kind: 'bearer', token: secrets.access_token }
}

function contextFor(storeUrl: string, secrets: MagentoSecrets): MgContext {
  return { storeUrl, auth: authOf(secrets) }
}

function parseSecrets(secrets: ConnectionSecrets): MagentoSecrets {
  const parsed = MagentoSecretsSchema.safeParse(secrets)
  if (!parsed.success) {
    throw new ConnectionError(
      'unauthorized',
      'Datele de acces Magento lipsesc sau au un format greșit: copiază Access Token-ul integrării (și, pentru semnare OAuth, Consumer Key, Consumer Secret și Access Token Secret împreună).',
      false,
      'magento secrets: invalid shape',
    )
  }
  return parsed.data
}

/** Secrets to persist: exactly the credentials that authenticate, nothing derived. */
function storedSecrets(secrets: MagentoSecrets): ConnectionSecrets {
  const auth = authOf(secrets)
  return auth.kind === 'oauth'
    ? { access_token: auth.token, consumer_key: auth.consumerKey, consumer_secret: auth.consumerSecret, access_token_secret: auth.tokenSecret }
    : { access_token: auth.token }
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

interface MgRequest {
  /** Path under /rest/V1 (api 'rest') or under the install root (api 'root'). */
  path: string
  api?: 'rest' | 'root'
  query?: Record<string, string | number | undefined>
  /** The public version route gets no credential. */
  anonymous?: boolean
  timeoutMs?: number
  maxBytes?: number
}

interface MgResponse {
  status: number
  headers: Headers
  json: unknown
  text: string
}

/** The ACL resources Magento names in a 401 body ("Magento_Sales::actions_view"); a machine token, never the message. */
function errorResourcesOf(json: unknown): string | null {
  const params = obj(obj(json).parameters)
  const resources = params.resources
  return typeof resources === 'string' && /^[A-Za-z0-9_:, ]{1,160}$/.test(resources) ? resources : null
}

function looksLikeHtml(res: MgResponse): boolean {
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
      return new ConnectionError('timeout', 'Magazinul nu a răspuns la timp.', true, `magento ${operation}: timeout`)
    case 'redirect':
      return new ConnectionError('redirect', 'Magazinul redirecționează către altă adresă; folosește adresa finală (https, cu sau fără www).', false, `magento ${operation}: redirect ${err.status ?? ''}`.trim())
    case 'too_large':
      return new ConnectionError('invalid_response', 'Răspunsul magazinului este prea mare.', false, `magento ${operation}: response too large`)
    case 'network':
    case 'http':
      return new ConnectionError('unreachable', 'Magazinul nu a putut fi contactat.', true, `magento ${operation}: ${err.code}`)
  }
}

/**
 * Classifies a non-2xx answer. Magento answers 401 for an unknown or revoked
 * token, a token the store does not accept as Bearer, a bad OAuth signature
 * and a valid credential without the route's ACL resource alike, and an
 * earlier 200 proves nothing (several routes are anonymous on some stores),
 * so a 401 is always `unauthorized` with every cause named. Transient
 * answers (429, 5xx) are classified before the HTML sniff: a maintenance or
 * rate-limit page is retryable, not "not a store".
 */
function httpFailure(res: MgResponse, operation: string, authKind: MgAuth['kind'] = 'bearer'): ConnectionError {
  const resources = errorResourcesOf(res.json)
  const detail = `magento ${operation}: HTTP ${res.status}${resources ? ` (${resources})` : ''}`
  if (res.status === 401) return new ConnectionError('unauthorized', UNAUTHORIZED_MESSAGE[authKind], false, detail)
  if (res.status === 403) return new ConnectionError('forbidden', 'Integrarea nu are permisiunile necesare pentru această resursă: bifează în integrare Sales → Orders, Customers → All Customers, Catalog → Products și Stores → Configuration.', false, detail)
  if (res.status === 429) return new ConnectionError('rate_limited', 'Magazinul limitează cererile; încearcă din nou în câteva minute.', true, detail)
  if (res.status >= 500) return new ConnectionError('unreachable', 'Magazinul a răspuns cu o eroare de server; încearcă din nou.', true, detail)
  if (res.status === 404 || looksLikeHtml(res)) {
    return new ConnectionError('not_a_store', 'La această adresă nu răspunde API-ul REST Magento (/rest/V1). Verifică adresa magazinului.', false, detail)
  }
  return new ConnectionError('invalid_response', 'Magazinul a răspuns neașteptat.', false, detail)
}

function invalidResponse(operation: string, what: string): ConnectionError {
  return new ConnectionError('invalid_response', 'Răspunsul magazinului nu are formatul așteptat.', false, `magento ${operation}: ${what}`)
}

function defaultNonce(): string {
  return crypto.randomBytes(16).toString('hex')
}

function authorizationFor(deps: MagentoAdapterDeps, auth: MgAuth, method: string, baseUrl: string, query: QueryPairs): string {
  if (auth.kind === 'bearer') return `Bearer ${auth.token}`
  return magentoOAuthHeader(auth, method, baseUrl, query, (deps.nonce ?? defaultNonce)(), (deps.now ?? Date.now)() / 1000)
}

async function mgRequest(deps: MagentoAdapterDeps, ctx: MgContext, operation: string, req: MgRequest): Promise<MgResponse> {
  const query: Array<readonly [string, string]> = []
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (value !== undefined) query.push([key, String(value)])
  }
  const base = req.api === 'root' ? `${ctx.storeUrl}${req.path}` : `${ctx.storeUrl}${API_PATH}${req.path}`
  // RFC 3986 encoding (a space is %20, never +): what Magento signs and what PHP decodes agree.
  const url = query.length ? `${base}?${query.map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`).join('&')}` : base
  const headers: Record<string, string> = req.anonymous ? {} : { authorization: authorizationFor(deps, ctx.auth, 'GET', base, query) }
  try {
    return await safeFetch(url, {
      method: 'GET',
      headers,
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

// ─── searchCriteria ───────────────────────────────────────────────────────────

interface SearchFilter {
  field: string
  value: string
  /** Documented condition types: eq, gt, gteq, lt, lteq, like, in, nin, ... */
  condition: 'eq' | 'gt' | 'gteq' | 'lt' | 'lteq' | 'like' | 'in'
}

interface SearchOptions {
  pageSize: number
  currentPage: number
  sort?: { field: string; direction: 'ASC' | 'DESC' }
  /** Each filter lands in its own filter group (groups are ANDed). */
  filters?: SearchFilter[]
}

/** Query parameters of a searchCriteria request (one filter per group = AND). */
export function searchQuery(opts: SearchOptions): Record<string, string> {
  const query: Record<string, string> = {
    'searchCriteria[pageSize]': String(opts.pageSize),
    'searchCriteria[currentPage]': String(opts.currentPage),
  }
  if (opts.sort) {
    query['searchCriteria[sortOrders][0][field]'] = opts.sort.field
    query['searchCriteria[sortOrders][0][direction]'] = opts.sort.direction
  }
  for (const [i, filter] of (opts.filters ?? []).entries()) {
    query[`searchCriteria[filter_groups][${i}][filters][0][field]`] = filter.field
    query[`searchCriteria[filter_groups][${i}][filters][0][value]`] = filter.value
    query[`searchCriteria[filter_groups][${i}][filters][0][condition_type]`] = filter.condition
  }
  return query
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

/** Magento money and quantity fields are JSON numbers (floats); strings are accepted defensively. */
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

/** A positive integer entity id as Magento reports it (number, or a numeric string in some payloads). */
function externalIdOf(value: unknown): string | null {
  const id = integer(value)
  return id !== null && id > 0 ? String(id) : null
}

function boolOf(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return null
}

/**
 * ISO string of a Magento timestamp. The REST API returns database values
 * ("2017-08-21 22:22:19", UTC) without a zone, so one is appended; a value
 * with an explicit offset or Z is kept as given.
 */
export function isoFromMagento(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text.replace(' ', 'T')}Z`
  const ms = Date.parse(withZone)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/** The "YYYY-MM-DD HH:MM:SS" (UTC) form Magento compares timestamp filters against. */
export function magentoDateTime(iso: string): string | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}

/** ISO 3166-1 alpha-2 from a Magento country_id. */
function countryCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cc = value.trim().toUpperCase()
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

/** Street lines come as string[] (OrderAddressInterface::getStreet); a plain string is tolerated. */
function streetOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(nonEmpty).filter((v): v is string => !!v)
  const line = nonEmpty(value)
  return line ? [line] : []
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

/** sha256 of the stable JSON (sorted keys) of the source record. */
export function payloadHashOf(record: Obj): string {
  return crypto.createHash('sha256').update(JSON.stringify(sortKeys(record))).digest('hex')
}

/** The entity id the last page ended at (keyset cursor), or null from the start / for anything unreadable. */
function cursorIdOf(cursor: string | null): number | null {
  if (cursor && /^\d{1,15}$/.test(cursor) && Number(cursor) > 0) return Number(cursor)
  return null
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

/**
 * Order status → OrderStatus. Magento has a state (lifecycle, fixed set) and a
 * status (label, merchants add their own and assign each to a state). The
 * predefined statuses are mapped first; an unknown custom status falls back
 * to its state. Anything else is `unknown`: automations never act on it.
 *   pending / new → pending          pending_payment → pending
 *   processing → processing           holded → on_hold
 *   complete → completed              canceled → cancelled
 *   closed → refunded (credit memo)   payment_review, fraud → on_hold
 *   received, pending_paypal → pending
 *   rejected → failed                 paypal_reversed → on_hold
 *   paypay_canceled_reversal (Magento's own spelling, also accepted as
 *   paypal_canceled_reversal) → processing
 */
const ORDER_STATUS: Record<string, OrderStatus> = {
  pending: 'pending',
  processing: 'processing',
  holded: 'on_hold',
  complete: 'completed',
  canceled: 'cancelled',
  closed: 'refunded',
  pending_payment: 'pending',
  payment_review: 'on_hold',
  fraud: 'on_hold',
  received: 'pending',
  pending_paypal: 'pending',
  rejected: 'failed',
  paypal_reversed: 'on_hold',
  paypay_canceled_reversal: 'processing',
  paypal_canceled_reversal: 'processing',
}

const ORDER_STATE: Record<string, OrderStatus> = {
  new: 'pending',
  pending_payment: 'pending',
  processing: 'processing',
  holded: 'on_hold',
  complete: 'completed',
  canceled: 'cancelled',
  closed: 'refunded',
  payment_review: 'on_hold',
}

/** Product status attribute: 1 = enabled, 2 = disabled (Magento\Catalog\Model\Product\Attribute\Source\Status). */
const PRODUCT_STATUS: Record<string, ProductStatus> = {
  '1': 'active',
  // Disabled products are withdrawn from the storefront (closest to archived).
  '2': 'archived',
}

/**
 * Financial status, derived from the order totals (Magento has no separate
 * payment state): total_refunded > 0 → refunded when it covers grand_total,
 * else partially_refunded; total_paid ≥ grand_total → paid; total_paid > 0 →
 * partially_paid; a cancelled order never paid → voided; a gateway
 * authorization not yet captured (payment.amount_authorized) → authorized;
 * otherwise pending (unpaid: cash on delivery, bank transfer, pending gateway).
 */
function financialStatusOf(status: OrderStatus, raw: Obj): FinancialStatus {
  const grandTotal = money(raw.grand_total) ?? 0
  const paid = money(raw.total_paid) ?? 0
  const refunded = money(raw.total_refunded) ?? 0
  const authorized = money(obj(raw.payment).amount_authorized) ?? 0
  if (refunded > 0) return refunded >= grandTotal ? 'refunded' : 'partially_refunded'
  if (paid > 0 && paid >= grandTotal) return 'paid'
  if (paid > 0) return 'partially_paid'
  if (status === 'cancelled') return 'voided'
  if (authorized > 0) return 'authorized'
  return 'pending'
}

/**
 * Fulfilment from the item quantities (qty_shipped vs qty_ordered of the
 * top-level rows) with the state as a shortcut: complete → fulfilled,
 * canceled → cancelled, everything shipped → fulfilled, something shipped →
 * partial, nothing → unfulfilled.
 */
function fulfillmentStatusOf(status: OrderStatus, topLevel: Obj[]): FulfillmentStatus {
  if (status === 'completed') return 'fulfilled'
  if (status === 'cancelled') return 'cancelled'
  let ordered = 0
  let shipped = 0
  for (const item of topLevel) {
    ordered += Math.max(0, money(item.qty_ordered) ?? 0) - Math.max(0, money(item.qty_canceled) ?? 0)
    shipped += Math.max(0, money(item.qty_shipped) ?? 0)
  }
  if (shipped <= 0) return 'unfulfilled'
  return shipped >= ordered ? 'fulfilled' : 'partial'
}

/**
 * Merchant-facing title of the payment method. Offline methods (checkmo,
 * banktransfer, cashondelivery, purchaseorder) store { method_title,
 * instructions } in additional_information, which the REST serializer
 * flattens to string[] (["Cash On Delivery", ""]). The first short text with
 * a letter is taken; gateways that put ids there yield null.
 */
function paymentTitleOf(payment: Obj): string | null {
  const info = payment.additional_information
  if (info && typeof info === 'object' && !Array.isArray(info)) return nonEmpty((info as Obj).method_title)
  if (!Array.isArray(info)) return null
  for (const entry of info) {
    const text = nonEmpty(entry)
    if (text && text.length <= 100 && /\p{L}/u.test(text) && !/^[0-9a-f-]{20,}$/i.test(text)) return text
  }
  return null
}

/**
 * Cash on delivery hint: Magento's own `cashondelivery` code or a COD-looking
 * word in the method id/title (Romanian stores: "ramburs"), with `_`, `-` and
 * spaces as word separators. The core's isCodPayment (lib/commerce/store.ts,
 * merchant list included) stays authoritative; this only lands in metadata.
 */
export function isMagentoCodPayment(method: string | null, title: string | null): boolean {
  if (method === 'cashondelivery') return true
  return [method, title].some((v) => !!v && /(^|[^a-z])(cod|ramburs|cash ?on ?delivery|cashondelivery|numerar la livrare|plata la livrare)([^a-z]|$)/i.test(v))
}

function normalizeOrderItem(raw: Obj): NormalizedOrderItem | null {
  const externalId = externalIdOf(raw.item_id)
  if (!externalId) return null
  return {
    externalId,
    productExternalId: externalIdOf(raw.product_id),
    sku: nonEmpty(raw.sku),
    name: nonEmpty(raw.name) ?? `#${externalId}`,
    quantity: Math.max(0, money(raw.qty_ordered) ?? 0),
    unitPrice: money(raw.price),
    total: money(raw.row_total),
  }
}

/**
 * Normalizes a /V1/orders record (list item or single read). Null when it has
 * no entity_id. Items: only the top-level rows (parent_item_id null) are
 * kept. A configurable product places two rows: the parent carries the
 * product name, the chosen variant's SKU, qty, price and row_total, while the
 * child (parent_item_id set) is the simple product with price 0; bundle
 * components likewise hang under their bundle row. Keeping the top level
 * mirrors what the customer ordered without double counting.
 */
export function normalizeMagentoOrder(raw: unknown): NormalizedOrder | null {
  const order = obj(raw)
  const externalId = externalIdOf(order.entity_id)
  if (!externalId) return null
  const billing = obj(order.billing_address)
  const assignments = Array.isArray(obj(order.extension_attributes).shipping_assignments) ? (obj(order.extension_attributes).shipping_assignments as unknown[]) : []
  const shippingAssignment = obj(obj(assignments[0]).shipping)
  const shipping = obj(shippingAssignment.address)
  const payment = obj(order.payment)
  const statusCode = nonEmpty(order.status)?.toLowerCase() ?? ''
  const stateCode = nonEmpty(order.state)?.toLowerCase() ?? ''
  const status = ORDER_STATUS[statusCode] ?? ORDER_STATE[stateCode] ?? 'unknown'
  const rows = (Array.isArray(order.items) ? order.items : []).map(obj)
  const topLevel = rows.filter((row) => row.parent_item_id === null || row.parent_item_id === undefined)
  const items = topLevel.map(normalizeOrderItem).filter((i): i is NormalizedOrderItem => !!i)
  const customerId = integer(order.customer_id)
  const isGuest = boolOf(order.customer_is_guest) === true
  const shippingSource = streetOf(shipping.street).length || nonEmpty(shipping.city) ? shipping : billing
  const summary = [...streetOf(shippingSource.street), nonEmpty(shippingSource.city)].filter((v): v is string => !!v).join(', ')
  const paymentMethod = nonEmpty(payment.method)
  const paymentMethodTitle = paymentTitleOf(payment)
  return {
    externalId,
    orderNumber: nonEmpty(order.increment_id) ?? externalId,
    // Guest orders carry customer_is_guest = true and no usable customer_id.
    customerExternalId: !isGuest && customerId && customerId > 0 ? String(customerId) : null,
    contactName: fullName(shipping.firstname, shipping.lastname) ?? fullName(billing.firstname, billing.lastname) ?? fullName(order.customer_firstname, order.customer_lastname),
    // The shipping address phone is the delivery contact; the billing phone is the fallback.
    contactPhoneRaw: nonEmpty(shipping.telephone) ?? nonEmpty(billing.telephone),
    contactEmail: nonEmpty(order.customer_email) ?? nonEmpty(billing.email),
    shippingCity: nonEmpty(shipping.city) ?? nonEmpty(billing.city),
    shippingCountry: countryCode(shipping.country_id) ?? countryCode(billing.country_id),
    shippingSummary: summary || null,
    status,
    financialStatus: financialStatusOf(status, order),
    fulfillmentStatus: fulfillmentStatusOf(status, topLevel),
    paymentMethod,
    paymentMethodTitle,
    currency: currencyCode(order.order_currency_code),
    total: money(order.grand_total),
    items,
    providerCreatedAt: isoFromMagento(order.created_at),
    providerUpdatedAt: isoFromMagento(order.updated_at),
    payloadHash: payloadHashOf(order),
    metadata: {
      provider_state: nonEmpty(order.state),
      provider_status: nonEmpty(order.status),
      billing_country: countryCode(billing.country_id),
      customer_is_guest: isGuest,
      total_paid: money(order.total_paid),
      total_refunded: money(order.total_refunded),
      shipping_method: nonEmpty(shippingAssignment.method) ?? nonEmpty(order.shipping_description),
      cod_hint: isMagentoCodPayment(paymentMethod, paymentMethodTitle),
    },
  }
}

/**
 * Normalizes a /V1/customers/search item or a single customer. The phone
 * comes from the default billing address, then the default shipping one,
 * then any address with a phone; the country from the same address. The
 * payload carries no order count or spend; `extension_attributes.is_subscribed`
 * (Magento_Newsletter) is the only consent flag.
 */
export function normalizeMagentoCustomer(raw: unknown): NormalizedCustomer | null {
  const customer = obj(raw)
  const externalId = externalIdOf(customer.id)
  if (!externalId) return null
  const addresses = (Array.isArray(customer.addresses) ? customer.addresses : []).map(obj)
  const defaultBilling = addresses.find((a) => boolOf(a.default_billing) === true)
  const defaultShipping = addresses.find((a) => boolOf(a.default_shipping) === true)
  const withPhone = [defaultBilling, defaultShipping, ...addresses].find((a) => a && nonEmpty(a.telephone))
  const withCountry = withPhone ?? [defaultBilling, defaultShipping, ...addresses].find((a) => a && countryCode(a.country_id))
  const subscribed = boolOf(obj(customer.extension_attributes).is_subscribed)
  return {
    externalId,
    email: nonEmpty(customer.email),
    firstName: nonEmpty(customer.firstname),
    lastName: nonEmpty(customer.lastname),
    phoneRaw: withPhone ? nonEmpty(withPhone.telephone) : null,
    countryCode: withCountry ? countryCode(withCountry.country_id) : null,
    marketingConsent: subscribed,
    callConsent: null,
    ordersCount: null,
    totalSpent: null,
    providerCreatedAt: isoFromMagento(customer.created_at),
    providerUpdatedAt: isoFromMagento(customer.updated_at),
    metadata: {
      group_id: integer(customer.group_id),
      website_id: integer(customer.website_id),
      store_id: integer(customer.store_id),
      addresses_count: addresses.length,
      payload_hash: payloadHashOf(customer),
    },
  }
}

interface StockFacts {
  status: StockStatus
  quantity: number | null
  /** The record carried extension_attributes.stock_item at all. */
  present: boolean
}

/** Legacy CatalogInventory stock item (qty, is_in_stock, manage_stock, backorders) when the record carries it. */
function stockOf(product: Obj): StockFacts {
  const stock = obj(obj(product.extension_attributes).stock_item)
  if (!Object.keys(stock).length) return { status: 'unknown', quantity: null, present: false }
  const managed = boolOf(stock.manage_stock) !== false
  const qty = managed ? money(stock.qty) : null
  const inStock = boolOf(stock.is_in_stock)
  if (inStock === null) return { status: 'unknown', quantity: qty, present: true }
  // backorders: 0 = no, 1 = allow, 2 = allow and notify (Magento\CatalogInventory\Model\Stock).
  const backorders = (integer(stock.backorders) ?? 0) > 0
  const status: StockStatus = inStock ? (managed && qty !== null && qty <= 0 && backorders ? 'on_backorder' : 'in_stock') : 'out_of_stock'
  return { status, quantity: qty, present: true }
}

/**
 * Normalizes a /V1/products record. Products carry no currency (the store's
 * base currency is on the connection) and no absolute URL: the storefront
 * link needs the configurable product_url_suffix, which the REST API does not
 * expose, so none is guessed.
 */
export function normalizeMagentoProduct(raw: unknown): NormalizedProduct | null {
  const product = obj(raw)
  const externalId = externalIdOf(product.id)
  if (!externalId) return null
  const stock = stockOf(product)
  const sku = nonEmpty(product.sku)
  return {
    externalId,
    sku,
    name: nonEmpty(product.name) ?? sku ?? `#${externalId}`,
    status: PRODUCT_STATUS[String(integer(product.status) ?? '')] ?? 'unknown',
    price: money(product.price),
    currency: null,
    stockStatus: stock.status,
    stockQuantity: stock.quantity,
    url: null,
    providerUpdatedAt: isoFromMagento(product.updated_at),
    metadata: {
      type_id: nonEmpty(product.type_id),
      visibility: integer(product.visibility),
      attribute_set_id: integer(product.attribute_set_id),
      stock_known: stock.present,
      payload_hash: payloadHashOf(product),
    },
  }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

const LIST_PATH: Record<Exclude<SyncResource, 'carts'>, string> = { orders: '/orders', products: '/products', customers: '/customers/search' }

function connectionContext(connection: Pick<AdapterConnection, 'storeUrl' | 'secrets'>): MgContext {
  return contextFor(canonicalStoreUrl(connection.storeUrl).storeUrl, parseSecrets(connection.secrets))
}

/** Items array and total_count of a searchCriteria response (Magento\Framework\Api\SearchResults). */
function searchResults(res: MgResponse, operation: string): { items: unknown[]; totalCount: number | null } {
  const body = obj(res.json)
  if (!Array.isArray(body.items)) throw invalidResponse(operation, 'no items array')
  return { items: body.items, totalCount: integer(body.total_count) }
}

/** The store config of the connected host when several store views answer, else the first. */
function pickStoreConfig(configs: unknown[], storeDomain: string): Obj | null {
  const all = configs.map(obj).filter((c) => Object.keys(c).length)
  const own = all.find((c) => [c.base_url, c.secure_base_url, c.base_link_url].some((u) => typeof u === 'string' && u.toLowerCase().includes(`//${storeDomain}`)))
  return own ?? all[0] ?? null
}

/** "ro_RO" → language "ro-RO" and the locale's region as the country hint (Magento exposes no store country via REST). */
function localeFacts(locale: unknown): { language: string | null; countryCode: string | null } {
  const text = nonEmpty(locale)
  const match = text ? /^([a-z]{2,3})(?:[_-]([A-Za-z]{2}))?$/.exec(text) : null
  if (!match) return { language: null, countryCode: null }
  return { language: match[2] ? `${match[1].toLowerCase()}-${match[2].toUpperCase()}` : match[1].toLowerCase(), countryCode: match[2] ? match[2].toUpperCase() : null }
}

export function createMagentoAdapter(deps: MagentoAdapterDeps = {}): CommerceAdapter {
  async function fetchOne<T>(connection: AdapterConnection, operation: string, path: string, externalId: string, normalize: (raw: unknown) => T | null, log: Logger): Promise<T | null> {
    if (!/^\d{1,15}$/.test(externalId)) {
      log.warn('magento.fetch.invalid_id', { operation, storeDomain: connection.storeDomain })
      return null
    }
    const ctx = connectionContext(connection)
    const res = await mgRequest(deps, ctx, operation, { path: `${path}/${externalId}` })
    if (res.status === 404) return null
    if (res.status !== 200 || looksLikeHtml(res)) throw httpFailure(res, operation, ctx.auth.kind)
    const record = normalize(res.json)
    if (!record) throw invalidResponse(operation, 'record without id')
    return record
  }

  /** Lists one resource with pageSize = 1 to prove the credential's ACL for it; false on 401/403, throws on anything else. */
  async function probeResource(ctx: MgContext, resource: Exclude<SyncResource, 'carts'>): Promise<{ readable: boolean; firstItem: Obj | null }> {
    const operation = `${resource}.probe`
    const res = await mgRequest(deps, ctx, operation, { path: LIST_PATH[resource], query: searchQuery({ pageSize: 1, currentPage: 1 }) })
    if (res.status === 401 || res.status === 403) return { readable: false, firstItem: null }
    if (res.status !== 200 || looksLikeHtml(res)) throw httpFailure(res, operation, ctx.auth.kind)
    const { items } = searchResults(res, operation)
    return { readable: true, firstItem: items.length ? obj(items[0]) : null }
  }

  return {
    platform: 'magento',

    getCapabilities(connection) {
      // Decided at validation; webhooks and carts can never appear later (no event source exists).
      return { ...connection.capabilities, webhooks: false, abandoned_carts: false, polling_minutes: connection.capabilities.polling_minutes ?? MAGENTO_POLLING_MINUTES }
    },

    async validateConnection(input: ConnectInput, log: Logger): Promise<ValidatedStore> {
      const secrets = parseSecrets(input.secrets)
      const { storeUrl, storeDomain } = canonicalStoreUrl(input.storeUrl)
      const ctx = contextFor(storeUrl, secrets)
      const notes: string[] = []
      let currency: string | null = null
      let timezone: string | null = null
      let language: string | null = null
      let countryCode_: string | null = null
      let displayName: string | null = null
      let platformVersion: string | null = null
      let storeCode: string | null = null
      let storeConfigReadable = false

      // Store facts (Magento_Backend::store, anonymous on some stores): proves the REST API, not the credential.
      const config = await mgRequest(deps, ctx, 'store_configs', { path: '/store/storeConfigs' })
      if (config.status === 200 && !looksLikeHtml(config)) {
        if (!Array.isArray(config.json)) throw invalidResponse('store_configs', 'not an array')
        const chosen = pickStoreConfig(config.json, storeDomain)
        if (chosen) {
          currency = currencyCode(chosen.base_currency_code) ?? currencyCode(chosen.default_display_currency_code)
          const tz = nonEmpty(chosen.timezone)
          timezone = tz && /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(tz) ? tz : null
          const locale = localeFacts(chosen.locale)
          language = locale.language
          countryCode_ = locale.countryCode
          storeCode = nonEmpty(chosen.code)
          storeConfigReadable = true
        } else {
          // An empty list: nothing to read, the connection still stands on the orders read.
          notes.push(NOTE_NO_STORE_CONFIG)
        }
      } else if (config.status === 401 || config.status === 403) {
        // The credential may be valid without Stores → Configuration: the orders read decides below.
        notes.push(NOTE_NO_STORE_CONFIG)
      } else {
        throw httpFailure(config, 'store_configs', ctx.auth.kind)
      }

      // Orders are mandatory (Magento_Sales::actions_view, never anonymous): the only read that proves the credential.
      const orders = await mgRequest(deps, ctx, 'orders.probe', { path: LIST_PATH.orders, query: searchQuery({ pageSize: 1, currentPage: 1 }) })
      if (orders.status !== 200 || looksLikeHtml(orders)) throw httpFailure(orders, 'orders.probe', ctx.auth.kind)
      searchResults(orders, 'orders.probe')
      if (!storeConfigReadable) log.info('magento.validate.store_config_unavailable', { storeDomain, status: config.status, resources: errorResourcesOf(config.json) })

      // Products and customers are optional resources of the integration.
      const [products, customers] = await Promise.all([probeResource(ctx, 'products'), probeResource(ctx, 'customers')])
      if (!products.readable) notes.push(NOTE_NO_PRODUCTS)
      else if (products.firstItem && !stockOf(products.firstItem).present) notes.push(NOTE_NO_LIST_STOCK)
      if (!customers.readable) notes.push(NOTE_NO_CUSTOMERS)

      // Store view name (same ACL as the configs). Optional: a failure only loses the name.
      if (storeConfigReadable) {
        const views = await mgRequest(deps, ctx, 'store_views', { path: '/store/storeViews' })
        if (views.status === 200 && Array.isArray(views.json)) {
          const list = views.json.map(obj)
          const own = list.find((v) => storeCode && v.code === storeCode) ?? list.find((v) => boolOf(v.is_active) === true) ?? list[0]
          displayName = own ? nonEmpty(own.name) : null
        } else {
          log.warn('magento.validate.store_views_unavailable', { storeDomain, status: views.status })
        }
      }

      // Edition and major.minor version from the public Magento_Version route; optional (often disabled, may redirect).
      try {
        const version = await mgRequest(deps, ctx, 'version', { api: 'root', path: VERSION_PATH, anonymous: true })
        const text = version.status === 200 ? version.text.trim() : ''
        platformVersion = /^Magento\/\d+\.\d+ \((Community|Enterprise|B2B)\)$/.test(text) ? text : null
      } catch (err) {
        if (!(err instanceof ConnectionError)) throw err
        log.info('magento.validate.version_unavailable', { storeDomain, code: err.code })
      }

      notes.push(NOTE_NO_WEBHOOKS, NOTE_NO_CARTS)
      const capabilities: CommerceCapabilities = {
        products: products.readable,
        customers: customers.readable,
        orders: true,
        webhooks: false,
        abandoned_carts: false,
        customer_phone: true,
        polling_minutes: MAGENTO_POLLING_MINUTES,
        notes,
      }
      log.info('magento.validate.ok', { storeDomain, auth: ctx.auth.kind, platformVersion, currency, timezone, countryCode: countryCode_, products: products.readable, customers: customers.readable, storeConfigReadable })
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
        secrets: storedSecrets(secrets),
      }
    },

    async registerWebhooks(connection: AdapterConnection, log: Logger): Promise<WebhookRegistration[]> {
      // Nothing to register: the standard REST API has no webhook subscriptions (see the header). Not an error.
      log.info('magento.webhooks.none', { storeDomain: connection.storeDomain, hasWebhookUrl: !!connection.webhookUrl })
      return []
    },

    async unregisterWebhooks(connection: AdapterConnection, log: Logger): Promise<void> {
      log.info('magento.webhooks.none', { storeDomain: connection.storeDomain, registrations: connection.webhookRegistrations.length })
    },

    async syncPage(connection: AdapterConnection, resource: SyncResource, checkpoint: SyncCheckpoint, mode, log: Logger): Promise<SyncBatch> {
      if (resource === 'carts') {
        // Quotes are not exposed by the standard REST API: no cart source exists for Magento.
        return { resource, carts: [], checkpoint: { ...checkpoint, cursor: null }, done: true }
      }
      const ctx = connectionContext(connection)
      const after = cursorIdOf(checkpoint.cursor)
      if (checkpoint.cursor && after === null) log.warn('magento.sync.cursor_unreadable', { storeDomain: connection.storeDomain, resource })
      const filters: SearchFilter[] = []
      const since = mode === 'incremental' && checkpoint.modifiedAfter ? Date.parse(checkpoint.modifiedAfter) : Number.NaN
      if (Number.isFinite(since)) {
        const value = magentoDateTime(new Date(since - MAGENTO_INCREMENTAL_OVERLAP_MS).toISOString())
        if (value) filters.push({ field: 'updated_at', value, condition: 'gteq' })
      }
      if (after !== null) filters.push({ field: 'entity_id', value: String(after), condition: 'gt' })
      // Keyset paging: entity_id > cursor ordered by entity_id, always the first page of that window.
      const query = searchQuery({ pageSize: MAGENTO_PAGE_SIZE, currentPage: 1, sort: { field: 'entity_id', direction: 'ASC' }, filters })
      const operation = `${resource}.list`
      const res = await mgRequest(deps, ctx, operation, { path: LIST_PATH[resource], query, timeoutMs: LIST_TIMEOUT_MS, maxBytes: LIST_MAX_BYTES })
      if (res.status !== 200 || looksLikeHtml(res)) throw httpFailure(res, operation, ctx.auth.kind)
      const { items, totalCount } = searchResults(res, operation)
      let skipped = 0
      let maxId = after ?? 0
      const keep = <T extends { externalId: string }>(records: Array<T | null>): T[] => {
        const out: T[] = []
        for (const r of records) {
          if (r) {
            out.push(r)
            maxId = Math.max(maxId, Number(r.externalId))
          } else skipped++
        }
        return out
      }
      const batch: SyncBatch = { resource, checkpoint, done: true }
      if (resource === 'orders') batch.orders = keep(items.map(normalizeMagentoOrder))
      else if (resource === 'products') batch.products = keep(items.map(normalizeMagentoProduct))
      else batch.customers = keep(items.map(normalizeMagentoCustomer))
      // A short page is the last one. A full page must move the cursor, or the store ignored the filter (never loop on it).
      const done = items.length < MAGENTO_PAGE_SIZE
      if (!done && maxId <= (after ?? 0)) throw invalidResponse(operation, 'full page did not advance the entity_id cursor')
      batch.done = done
      batch.checkpoint = { cursor: done ? null : String(maxId), modifiedAfter: checkpoint.modifiedAfter, pages: checkpoint.pages + 1 }
      log.info('magento.sync.page', { storeDomain: connection.storeDomain, resource, mode, after, count: items.length, skipped, totalCount, done })
      return batch
    },

    async verifyWebhook(_request: RawWebhookRequest, _connection: AdapterConnection): Promise<VerifiedCommerceEvent | VerificationFailure> {
      // No standard webhook delivery exists for Magento: nothing can be verified, so nothing is accepted.
      return { ok: false, reason: 'not_supported', status: 400 }
    },

    normalizeEvent(event: VerifiedCommerceEvent): CommerceEvent[] {
      // verifyWebhook never produces a verified event today; the mapping documents the topic contract a
      // future verified source (Adobe I/O Events relay) would use, reusing the record normalizers.
      const malformed = (what: string): CommerceEvent[] => [{ kind: 'ignored', reason: `malformed_payload:${what}` }]
      switch (event.topic) {
        case 'order.created':
        case 'order.updated': {
          const order = normalizeMagentoOrder(event.payload)
          if (!order) return malformed('order')
          return [{ kind: event.topic, order }]
        }
        case 'product.updated': {
          const product = normalizeMagentoProduct(event.payload)
          return product ? [{ kind: 'product.updated', product }] : malformed('product')
        }
        case 'customer.updated': {
          const customer = normalizeMagentoCustomer(event.payload)
          return customer ? [{ kind: 'customer.updated', customer }] : malformed('customer')
        }
        default:
          return [{ kind: 'ignored', reason: `unhandled_topic:${event.topic}` }]
      }
    },

    fetchOrder(connection, externalId, log) {
      return fetchOne(connection, 'orders.get', '/orders', externalId, normalizeMagentoOrder, log)
    },
    fetchCustomer(connection, externalId, log) {
      return fetchOne(connection, 'customers.get', '/customers', externalId, normalizeMagentoCustomer, log)
    },
    async fetchProduct(connection, externalId, log) {
      // Products are addressed by SKU in the single-read route, so the id is resolved through a search first;
      // the single read is then worth its request because it is the only one carrying the stock item.
      if (!/^\d{1,15}$/.test(externalId)) {
        log.warn('magento.fetch.invalid_id', { operation: 'products.get', storeDomain: connection.storeDomain })
        return null
      }
      const ctx = connectionContext(connection)
      const found = await mgRequest(deps, ctx, 'products.find', { path: LIST_PATH.products, query: searchQuery({ pageSize: 1, currentPage: 1, filters: [{ field: 'entity_id', value: externalId, condition: 'eq' }] }) })
      if (found.status !== 200 || looksLikeHtml(found)) throw httpFailure(found, 'products.find', ctx.auth.kind)
      const { items } = searchResults(found, 'products.find')
      const listed = items.length ? normalizeMagentoProduct(items[0]) : null
      if (!listed || listed.externalId !== externalId) return null
      // A SKU that is a dot segment would address another route once the path is normalised: the listing stands.
      if (!listed.sku || /^\.{1,2}$/.test(listed.sku)) return listed
      const single = await mgRequest(deps, ctx, 'products.get', { path: `/products/${encodeURIComponent(listed.sku)}` })
      if (single.status !== 200 || looksLikeHtml(single)) {
        // A SKU the route cannot address (slashes, encoding rules of the host) or a missing ACL: the listing stands.
        log.warn('magento.fetch.product_single_unavailable', { storeDomain: connection.storeDomain, status: single.status })
        return listed
      }
      const full = normalizeMagentoProduct(single.json)
      return full && full.externalId === externalId ? full : listed
    },
  }
}

export const magentoAdapter = createMagentoAdapter()
