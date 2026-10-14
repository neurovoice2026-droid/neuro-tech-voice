import 'server-only'
// PrestaShop adapter: the Webservice (/api) of PrestaShop 1.7 and 8 over HTTPS
// with the merchant's webservice key as the HTTP Basic user name and an empty
// password.
//
// Verified against the official documentation on 2026-10-13:
//   • https://devdocs.prestashop-project.org/8/webservice/getting-started/ (the
//     key is the login, Authorization: Basic base64("<key>:"); JSON output via
//     output_format=JSON or the Output-Format: JSON header; "As of PrestaShop
//     8.1, the Webservice is only able to output JSON, it cannot read JSON inputs");
//   • https://devdocs.prestashop-project.org/8/webservice/tutorials/testing-access/
//     (GET /api/ lists the resources the key may use, each with get/put/post/
//     patch/delete/head flags, as XML);
//   • https://devdocs.prestashop-project.org/8/webservice/cheat-sheet/ and
//     https://devdocs.prestashop-project.org/8/webservice/tutorials/advanced-use/additional-list-parameters/
//     (display=full | [f1,f2], filter[field]=[a|b] = OR, [a,b] = interval,
//     sort=[field_ASC], limit=offset,count, "&date=1" required for date fields);
//   • https://devdocs.prestashop-project.org/8/webservice/tutorials/advanced-use/multilang-fields/
//     (translated fields are a JSON array of {id, value}, a plain string when
//     exactly one language is active);
//   • https://devdocs.prestashop-project.org/8/webservice/resources/ (orders,
//     order_details, order_states, customers, addresses, products,
//     stock_availables, configurations, currencies, countries, languages);
//   • PrestaShop 8.2.8 source, classes/webservice/*.php, for what the docs leave
//     implicit: the JSON error envelope {errors:[{code, message}]}; the status/
//     code pairs of a bad key (401, codes 16-21), of a resource the key may not
//     read (401, code 26), of a method the key may not use (405, code 25), of a
//     disabled webservice (503, code 22), of a key without rights on the shop
//     (403, code 132; a 403 without that envelope comes from the web server or
//     a firewall); the PSWS-Version response header (sent once authenticated);
//     the >[value] and <[value] filter operators (SQLUtils::getSQLRetrieveFilter);
//     an empty list is rendered as [] (not {"orders":[]}); a key must be exactly
//     32 characters long.
//
// What the platform offers and how this adapter uses it:
//   • no webhooks exist in a standard PrestaShop: every resource is polled
//     (capabilities.webhooks=false, polling every PRESTASHOP_POLLING_MINUTES);
//   • orders, customers and products accept filter[date_upd] (with date=1), so
//     incremental syncs are server-side filtered; pages are keyset pages by id
//     (sort=[id_ASC], filter[id]=>[last id], limit=count): a record added or
//     deleted during a pass never shifts the others across the cursor;
//   • an order page is enriched with one order_details request, one addresses
//     request and one customers request for the whole page (OR filters), so the
//     request count per page is constant; countries, currencies, order states
//     and the configuration are cached per connection for CONTEXT_TTL_MS;
//   • /api/carts exists but carries neither a phone nor the customer's consent
//     to be called: it is not exposed (abandoned_carts=false);
//   • dates are stored in the shop's time zone without an offset (PHP's default
//     time zone is PS_TIMEZONE): they are converted with that configuration,
//     and treated as UTC (with a merchant-facing note) when it cannot be read.
//
// The key never reaches a log field, an error message or a URL: it travels in
// the Authorization header only.

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
 * The Webservice has no version in its URL: it lives at /api of every
 * PrestaShop install. This adapter follows the PrestaShop 8 reference
 * (https://devdocs.prestashop-project.org/8/webservice/, read 2026-10-13) and
 * uses only parameters that exist unchanged since 1.7; a store reporting an
 * older PSWS-Version is refused.
 */
export const PRESTASHOP_API_VERSION = 'webservice-8' as const
export const PRESTASHOP_API_PATH = '/api'
export const PRESTASHOP_MIN_VERSION = '1.7'

/** Orders carry line items plus three enrichment requests per page: a small page keeps every request bounded. */
export const ORDERS_PAGE_SIZE = 20
export const CUSTOMERS_PAGE_SIZE = 50
export const PRODUCTS_PAGE_SIZE = 50
const LIST_TIMEOUT_MS = 30_000
const LIST_MAX_BYTES = 8 * 1024 * 1024
/** Polling cadence: the platform has no webhooks. */
export const PRESTASHOP_POLLING_MINUTES = 15
/** Lifetime of the cached shop context (configuration, countries, currencies, order states). */
const CONTEXT_TTL_MS = 15 * 60_000

/** GET rights the key must have (the connect form instructions list them). */
export const REQUIRED_RESOURCES = ['orders', 'order_details', 'order_states', 'customers', 'addresses', 'products'] as const
/** GET rights that improve the data when present; each missing one adds a note. */
const OPTIONAL_RESOURCES = ['configurations', 'currencies', 'countries', 'languages', 'stock_availables'] as const

/** Merchant-facing notes (Romanian) stored in capabilities.notes. */
export const NOTE_NO_WEBHOOKS = 'PrestaShop nu are webhook-uri standard: comenzile, clienții și produsele sunt citite periodic (la 15 minute).'
export const NOTE_NO_CARTS = 'Coșurile abandonate nu sunt disponibile: Webservice-ul PrestaShop expune coșurile fără telefon și fără acordul clientului, deci nu pot declanșa apeluri.'
export const NOTE_NO_STOCK = 'Cheia nu poate citi resursa „stock_availables”: stocul produselor apare ca necunoscut.'
export const NOTE_NO_CONFIG = 'Cheia nu poate citi resursa „configurations”: numele magazinului și fusul orar nu pot fi citite, iar datele comenzilor sunt interpretate ca UTC.'
export const NOTE_NO_COUNTRIES = 'Cheia nu poate citi resursa „countries”: țara adreselor nu poate fi determinată, iar telefoanele fără prefix internațional nu pot fi apelate.'
export const NOTE_NO_CURRENCIES = 'Cheia nu poate citi resursa „currencies”: moneda comenzilor nu poate fi determinată.'
export const NOTE_TIMEZONE_UTC = 'Fusul orar al magazinului (PS_TIMEZONE) nu a putut fi citit: datele comenzilor sunt interpretate ca UTC.'

/**
 * Connect-form secrets. The Webservice refuses any key that is not exactly 32
 * characters long (WebserviceRequest::authenticate, code 18); generated keys
 * are upper-case letters and digits, merchant-typed keys may mix case.
 */
export const PrestaShopSecretsSchema = z.object({
  webservice_key: z.string().trim().regex(/^[A-Za-z0-9_-]{32}$/, 'Webservice key must be 32 letters or digits'),
})
export type PrestaShopSecrets = z.infer<typeof PrestaShopSecretsSchema>

export interface PrestaShopAdapterDeps {
  fetchImpl?: typeof fetch
  /** DNS resolver handed to the SSRF guard (tests resolve to a public address). */
  lookup?: (hostname: string) => Promise<string[]>
  /** Clock of the context cache (tests). */
  now?: () => number
}

// ─── Store URL ────────────────────────────────────────────────────────────────

/**
 * Canonical base URL of the PrestaShop install: https, lower-case host, no
 * query/hash, no trailing slash. A pasted API root (…/api/…) is reduced to the
 * install; a sub-directory install (https://host/shop) keeps its path because
 * the Webservice lives under it.
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
  let path = url.pathname.replace(/\/api(\/.*)?$/, '').replace(/\/+$/, '')
  if (path === '/') path = ''
  const host = url.hostname.toLowerCase()
  const origin = `https://${host}${url.port ? `:${url.port}` : ''}`
  return { storeUrl: `${origin}${path}`, storeDomain: host }
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

interface PsContext {
  storeUrl: string
  /** Value of the Authorization header (Basic base64("<key>:")). */
  authorization: string
}

interface PsRequest {
  /** Path under /api ('/' for the resource list, '/orders', …). */
  path: string
  query?: Record<string, string | number | undefined>
  /** JSON (default) for resources; the resource list exists in XML only. */
  format?: 'json' | 'xml'
  timeoutMs?: number
  maxBytes?: number
}

interface PsResponse {
  status: number
  headers: Headers
  json: unknown
  text: string
}

function contextFor(storeUrl: string, secrets: PrestaShopSecrets): PsContext {
  return { storeUrl, authorization: `Basic ${Buffer.from(`${secrets.webservice_key}:`, 'utf8').toString('base64')}` }
}

function parseSecrets(secrets: ConnectionSecrets): PrestaShopSecrets {
  const parsed = PrestaShopSecretsSchema.safeParse(secrets)
  if (!parsed.success) {
    throw new ConnectionError('unauthorized', 'Cheia Webservice lipsește sau are un format greșit (32 de litere și cifre).', false, 'prestashop secrets: invalid shape')
  }
  return parsed.data
}

function looksLikeHtml(res: PsResponse): boolean {
  return res.json === undefined && /^\s*<(!doctype|html|head|body|script|div)/i.test(res.text.slice(0, 512))
}

/**
 * Numeric error codes of the Webservice error envelope: {errors:[{code,
 * message}]} in JSON, <errors><error><code><![CDATA[n]]></code>… in XML. Only
 * the codes are read; messages are never echoed (they may quote the request).
 */
export function webserviceErrorCodes(res: Pick<PsResponse, 'json' | 'text'>): number[] {
  const out: number[] = []
  if (res.json && typeof res.json === 'object' && !Array.isArray(res.json)) {
    const errors = (res.json as Obj).errors
    if (Array.isArray(errors)) {
      for (const entry of errors) {
        const code = integer(obj(entry).code)
        if (code !== null) out.push(code)
      }
    }
  } else if (res.json === undefined && /<errors>/i.test(res.text)) {
    for (const m of res.text.matchAll(/<code>\s*(?:<!\[CDATA\[)?\s*(\d{1,6})\s*(?:\]\]>)?\s*<\/code>/g)) out.push(Number(m[1]))
  }
  return out
}

/** Error code 26 (401): the key exists but has no GET right on this resource. 21: no right at all. */
const WS_NO_RESOURCE_RIGHT = 26
const WS_NO_RIGHT_AT_ALL = 21
const WS_METHOD_NOT_ALLOWED = 25
const WS_DISABLED = 22
/** Error code 132 (403): the key has no right on the shop of a multistore install. */
const WS_NO_SHOP_RIGHT = 132

function forbiddenResource(resources: readonly string[], detail: string): ConnectionError {
  const list = resources.map((r) => `„${r}”`).join(', ')
  return new ConnectionError(
    'forbidden',
    `Cheia Webservice nu are drept de citire (GET) pe ${resources.length > 1 ? 'resursele' : 'resursa'} ${list}. Bifează GET pentru ${resources.length > 1 ? 'ele' : 'ea'} în Parametri avansați → Webservice.`,
    false,
    detail,
  )
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
      return new ConnectionError('timeout', 'Magazinul nu a răspuns la timp.', true, `prestashop ${operation}: timeout`)
    case 'redirect':
      return new ConnectionError('redirect', 'Magazinul redirecționează către altă adresă; folosește adresa finală (https, cu sau fără www).', false, `prestashop ${operation}: redirect ${err.status ?? ''}`.trim())
    case 'too_large':
      return new ConnectionError('invalid_response', 'Răspunsul magazinului este prea mare.', false, `prestashop ${operation}: response too large`)
    case 'network':
    case 'http':
      return new ConnectionError('unreachable', 'Magazinul nu a putut fi contactat.', true, `prestashop ${operation}: ${err.code}`)
  }
}

/** Classifies a non-200 answer. `resource` names the resource for permission failures. */
function httpFailure(res: PsResponse, operation: string, resource?: string): ConnectionError {
  const codes = webserviceErrorCodes(res)
  const detail = `prestashop ${operation}: HTTP ${res.status}${codes.length ? ` (ws ${codes.join(',')})` : ''}`
  const name = resource ?? operation.split('.')[0]
  if (res.status === 401 && codes.includes(WS_NO_RESOURCE_RIGHT)) return forbiddenResource([name], detail)
  if (res.status === 401 && codes.includes(WS_NO_RIGHT_AT_ALL)) return forbiddenResource([...REQUIRED_RESOURCES], detail)
  if (res.status === 401) {
    return new ConnectionError('unauthorized', 'Cheia Webservice nu a fost acceptată de magazin. Verifică cheia (32 de caractere) și că este activă în Parametri avansați → Webservice.', false, detail)
  }
  if (res.status === 429) return new ConnectionError('rate_limited', 'Magazinul limitează cererile; încearcă din nou în câteva minute.', true, detail)
  if (res.status === 503 && codes.includes(WS_DISABLED)) {
    return new ConnectionError('not_a_store', 'Webservice-ul PrestaShop este dezactivat: activează-l din Parametri avansați → Webservice.', false, detail)
  }
  // Any other 5xx, HTML maintenance and firewall pages included, is a transient server failure: retried, never "not a store".
  if (res.status >= 500) return new ConnectionError('unreachable', 'Magazinul a răspuns cu o eroare de server; încearcă din nou.', true, detail)
  if (res.status === 405 && codes.includes(WS_METHOD_NOT_ALLOWED)) return forbiddenResource([name], detail)
  if (res.status === 403) {
    // Only the Webservice's own 403 (code 132) is about shop rights; without its envelope the web server or a firewall refused the request.
    return codes.includes(WS_NO_SHOP_RIGHT)
      ? new ConnectionError('forbidden', 'Cheia Webservice nu are drepturi pe acest magazin (multi-magazin): asociază cheia cu magazinul.', false, detail)
      : new ConnectionError('forbidden', 'Serverul magazinului sau un firewall a refuzat cererea (403) înainte de a ajunge la Webservice: permite accesul la /api pentru această platformă.', false, detail)
  }
  if (res.status === 404 || looksLikeHtml(res)) {
    return new ConnectionError('not_a_store', 'La această adresă nu răspunde Webservice-ul PrestaShop (/api). Verifică adresa magazinului și că Webservice-ul este activat.', false, detail)
  }
  return new ConnectionError('invalid_response', 'Magazinul a răspuns neașteptat.', false, detail)
}

function invalidResponse(operation: string, what: string): ConnectionError {
  return new ConnectionError('invalid_response', 'Răspunsul magazinului nu are formatul așteptat.', false, `prestashop ${operation}: ${what}`)
}

async function psRequest(deps: PrestaShopAdapterDeps, ctx: PsContext, operation: string, req: PsRequest): Promise<PsResponse> {
  const format = req.format ?? 'json'
  const params = new URLSearchParams()
  // Both documented forms are sent: the query parameter survives proxies that drop custom headers.
  if (format === 'json') params.set('output_format', 'JSON')
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (value !== undefined) params.set(key, String(value))
  }
  const base = `${ctx.storeUrl}${PRESTASHOP_API_PATH}${req.path}`
  const url = params.size ? `${base}?${params.toString()}` : base
  const headers: Record<string, string> = { authorization: ctx.authorization }
  if (format === 'json') headers['output-format'] = 'JSON'
  else headers.accept = 'application/xml, text/xml;q=0.9, */*;q=0.8'
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

// ─── Value helpers ────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>

function obj(value: unknown): Obj {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {}
}

function nonEmpty(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text : null
}

/** Webservice money fields are decimal strings ("159.900000"). */
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

/** Booleans arrive as "0"/"1" strings. */
function flag(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  return null
}

/** An external id as the Webservice reports it (positive integer, usually a string). */
function externalIdOf(value: unknown): string | null {
  const id = integer(value)
  return id !== null && id > 0 ? String(id) : null
}

/** A foreign key as a map key ("0" and empty = unset). */
function refOf(value: unknown): string | null {
  return externalIdOf(value)
}

function countryIso(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cc = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(cc) ? cc : null
}

function currencyIso(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : null
}

function fullName(first: unknown, last: unknown): string | null {
  const name = [nonEmpty(first), nonEmpty(last)].filter((v): v is string => !!v).join(' ')
  return name || null
}

/**
 * A translated field: a plain string when the shop has one active language,
 * else [{id, value}] per language. The shop's default language wins, then the
 * first non-empty translation.
 */
export function langValue(value: unknown, defaultLangId: string | null): string | null {
  if (typeof value === 'string') return nonEmpty(value)
  if (!Array.isArray(value)) return null
  const entries = value.map((entry) => {
    const e = obj(entry)
    return { id: e.id === undefined || e.id === null ? null : String(e.id), value: nonEmpty(e.value) }
  })
  const preferred = defaultLangId ? entries.find((e) => e.id === defaultLangId)?.value : null
  return preferred ?? entries.find((e) => e.value)?.value ?? null
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
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

/** sha256 of the stable JSON (sorted keys) of the source record(s). */
export function payloadHashOf(record: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(sortKeys(record))).digest('hex')
}

/** The id the next page starts after (checkpoint.cursor), or null from the start. */
function afterIdOf(cursor: string | null): string | null {
  return cursor && /^[1-9]\d{0,14}$/.test(cursor) ? cursor : null
}

/** The OR filter of the Webservice: filter[field]=[a|b|c] (a single value is a literal match). */
function orFilter(values: readonly string[]): string {
  return `[${values.join('|')}]`
}

// ─── Shop time zone ───────────────────────────────────────────────────────────

const TZ_RE = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/

/** The IANA zone when Intl knows it, else null (the caller then treats dates as UTC). */
export function validTimezone(value: unknown): string | null {
  const tz = nonEmpty(value)
  if (!tz || !TZ_RE.test(tz)) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch (err) {
    void err // Unknown zone in this runtime: no conversion is better than a wrong one.
    return null
  }
}

/** Offset (ms) of `tz` from UTC at the instant `utcMs`, from Intl's wall clock. */
function tzOffsetMs(tz: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN)
  const wall = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour') % 24, n('minute'), n('second'))
  return wall - Math.floor(utcMs / 1000) * 1000
}

/**
 * ISO instant of a shop date ("2026-03-01 12:20:30", wall clock of PS_TIMEZONE,
 * no offset). "0000-00-00 00:00:00" means unset. Without a zone the value is
 * read as UTC (documented in the capability note).
 */
export function shopDateToIso(value: unknown, timezone: string | null): string | null {
  const text = nonEmpty(value)
  if (!text) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text)
  if (!m || m[1] === '0000' || m[2] === '00' || m[3] === '00') return null
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0))
  if (!Number.isFinite(wall)) return null
  if (!timezone) return new Date(wall).toISOString()
  // Two passes: the offset at the guessed instant settles DST edges.
  let utc = wall - tzOffsetMs(timezone, wall)
  utc = wall - tzOffsetMs(timezone, utc)
  return new Date(utc).toISOString()
}

/** The shop's wall-clock form ("YYYY-MM-DD HH:MM:SS") of an ISO instant, for filter values. */
export function isoToShopDate(iso: string, timezone: string | null): string | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const wall = new Date(timezone ? ms + tzOffsetMs(timezone, ms) : ms)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())} ${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:${pad(wall.getUTCSeconds())}`
}

// ─── Order states ─────────────────────────────────────────────────────────────

export interface OrderStateInfo {
  id: string
  name: string | null
  /** Mail template of the state: language-independent ('order_canceled', 'refund', 'payment_error', 'shipped', …). */
  template: string | null
  paid: boolean
  shipped: boolean
  logable: boolean
  deleted: boolean
}

export interface MappedOrderStatus {
  status: OrderStatus
  financialStatus: FinancialStatus
  fulfillmentStatus: FulfillmentStatus
}

const CANCELLED_NAME = /cancel|anulat|annul|storn/i
const REFUNDED_NAME = /refund|rambursat|rembours|erstatt|rimbors|reembols/i
const FAILED_NAME = /payment error|eroare|erreur|fehler|errore|error de pago/i
// "livré(e)(s)" needs an explicit letter guard: \b is ASCII-only and never matches after "é".
const DELIVERED_NAME = /delivered|livrat|livr[ée]e?s?(?![a-zà-ÿ])|zugestellt|consegnat|entregad/i

/**
 * current_state → statuses, from the state's flags and mail template (the
 * default states of install-dev/data/xml/order_state.xml, PrestaShop 8.2.8):
 *   • template order_canceled / name "Canceled"   → cancelled, voided, cancelled
 *   • template refund / name "Refunded"           → refunded, refunded
 *   • template payment_error / name "Payment error" → failed, pending
 *   • name "Delivered" (no flag marks delivery: `delivery` only enables the
 *     delivery slip, the Delivered state carries shipped=1 like Shipped)
 *                                                 → completed, paid, fulfilled
 *   • shipped=1 ("Shipped")                       → processing, fulfilled
 *   • paid=1 ("Payment accepted", "Processing in progress", "On backorder (paid)",
 *     "Remote payment accepted")                  → processing, paid
 *   • template outofstock, unpaid                 → on_hold, pending
 *   • everything else unpaid ("Awaiting check payment", "Awaiting bank wire
 *     payment", "Awaiting Cash On Delivery validation", custom states)
 *                                                 → pending, pending, unfulfilled
 * A state id the shop does not list → unknown everywhere (automations never act on it).
 */
export function mapOrderState(state: OrderStateInfo | null): MappedOrderStatus {
  if (!state) return { status: 'unknown', financialStatus: 'unknown', fulfillmentStatus: 'unknown' }
  const name = state.name ?? ''
  const template = (state.template ?? '').toLowerCase()
  const fulfillment: FulfillmentStatus = state.shipped ? 'fulfilled' : 'unfulfilled'
  if (template === 'order_canceled' || CANCELLED_NAME.test(name)) {
    return { status: 'cancelled', financialStatus: state.paid ? 'paid' : 'voided', fulfillmentStatus: 'cancelled' }
  }
  if (template === 'refund' || REFUNDED_NAME.test(name)) return { status: 'refunded', financialStatus: 'refunded', fulfillmentStatus: fulfillment }
  if (template === 'payment_error' || FAILED_NAME.test(name)) return { status: 'failed', financialStatus: 'pending', fulfillmentStatus: fulfillment }
  if (DELIVERED_NAME.test(name)) return { status: 'completed', financialStatus: state.paid ? 'paid' : 'pending', fulfillmentStatus: 'fulfilled' }
  if (state.shipped) return { status: 'processing', financialStatus: state.paid ? 'paid' : 'pending', fulfillmentStatus: 'fulfilled' }
  if (state.paid) return { status: 'processing', financialStatus: 'paid', fulfillmentStatus: 'unfulfilled' }
  if (template === 'outofstock') return { status: 'on_hold', financialStatus: 'pending', fulfillmentStatus: 'unfulfilled' }
  return { status: 'pending', financialStatus: 'pending', fulfillmentStatus: 'unfulfilled' }
}

function parseOrderState(raw: unknown, defaultLangId: string | null): OrderStateInfo | null {
  const state = obj(raw)
  const id = externalIdOf(state.id)
  if (!id) return null
  return {
    id,
    name: langValue(state.name, defaultLangId),
    template: langValue(state.template, defaultLangId),
    paid: flag(state.paid) === true,
    shipped: flag(state.shipped) === true,
    logable: flag(state.logable) === true,
    deleted: flag(state.deleted) === true,
  }
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

/** What the normalizers need about the shop (cached per connection). */
export interface ShopContext {
  timezone: string | null
  defaultLangId: string | null
  /** ISO 4217 of PS_CURRENCY_DEFAULT, when readable. */
  defaultCurrency: string | null
  /** PS_ORDER_OUT_OF_STOCK: whether products with out_of_stock=2 ("default") accept orders. */
  backordersByDefault: boolean | null
  /** id_currency → ISO 4217. */
  currencies: ReadonlyMap<string, string>
  /** id_country → ISO 3166-1 alpha-2. */
  countries: ReadonlyMap<string, string>
  /** id_order_state → flags. */
  orderStates: ReadonlyMap<string, OrderStateInfo>
}

export const EMPTY_SHOP_CONTEXT: ShopContext = {
  timezone: null,
  defaultLangId: null,
  defaultCurrency: null,
  backordersByDefault: null,
  currencies: new Map(),
  countries: new Map(),
  orderStates: new Map(),
}

export interface OrderEnrichment {
  /** order_details rows of this order (may be empty: the order_rows association is the fallback). */
  details: readonly Obj[]
  /** The delivery address (/api/addresses/{id_address_delivery}), when readable. */
  address: Obj | null
  /** The customer (/api/customers/{id_customer}), when readable. */
  customer: Obj | null
}

/** Cash on delivery: the ps_cashondelivery module, or a module/payment title that says so. */
export function isCashOnDelivery(module: string | null, payment: string | null): boolean {
  if (module === 'ps_cashondelivery') return true
  return /cash|ramburs|\bcod\b|cashondelivery/i.test(`${module ?? ''} ${payment ?? ''}`)
}

function normalizeDetailRow(raw: Obj): NormalizedOrderItem | null {
  const externalId = externalIdOf(raw.id)
  if (!externalId) return null
  return {
    externalId,
    // Combinations are not mirrored: the parent product id is the reference.
    productExternalId: externalIdOf(raw.product_id),
    sku: nonEmpty(raw.product_reference),
    name: nonEmpty(raw.product_name) ?? `#${externalId}`,
    quantity: Math.max(0, integer(raw.product_quantity) ?? 0),
    unitPrice: money(raw.unit_price_tax_incl) ?? money(raw.product_price),
    total: money(raw.total_price_tax_incl),
  }
}

/** The order_rows association of the orders resource (no line total: unit price × quantity). */
function normalizeOrderRow(raw: Obj): NormalizedOrderItem | null {
  const externalId = externalIdOf(raw.id)
  if (!externalId) return null
  const quantity = Math.max(0, integer(raw.product_quantity) ?? 0)
  const unitPrice = money(raw.unit_price_tax_incl) ?? money(raw.product_price)
  return {
    externalId,
    productExternalId: externalIdOf(raw.product_id),
    sku: nonEmpty(raw.product_reference),
    name: nonEmpty(raw.product_name) ?? `#${externalId}`,
    quantity,
    unitPrice,
    total: unitPrice === null ? null : Math.round(unitPrice * quantity * 1_000_000) / 1_000_000,
  }
}

/** Normalizes an /api/orders record (display=full) with its enrichment. Null when it has no id. */
export function normalizePrestaShopOrder(raw: unknown, shop: ShopContext, extra: OrderEnrichment): NormalizedOrder | null {
  const order = obj(raw)
  const externalId = externalIdOf(order.id)
  if (!externalId) return null
  const address = extra.address ?? {}
  const customer = extra.customer ?? {}
  const stateId = refOf(order.current_state)
  const state = stateId ? (shop.orderStates.get(stateId) ?? null) : null
  const mapped = mapOrderState(state)
  const details = extra.details.map(normalizeDetailRow).filter((i): i is NormalizedOrderItem => !!i)
  const rows = Array.isArray(obj(order.associations).order_rows) ? (obj(order.associations).order_rows as unknown[]) : []
  const items = details.length ? details : rows.map((r) => normalizeOrderRow(obj(r))).filter((i): i is NormalizedOrderItem => !!i)
  const paymentModule = nonEmpty(order.module)
  const payment = nonEmpty(order.payment)
  const currencyId = refOf(order.id_currency)
  const countryId = refOf(address.id_country)
  const summary = [nonEmpty(address.address1), nonEmpty(address.address2), nonEmpty(address.city)].filter((v): v is string => !!v).join(', ')
  return {
    externalId,
    orderNumber: nonEmpty(order.reference) ?? externalId,
    customerExternalId: refOf(order.id_customer),
    contactName: fullName(address.firstname, address.lastname) ?? fullName(customer.firstname, customer.lastname),
    // The mobile number is the one customers answer; the landline is the fallback. Raw, as stored.
    contactPhoneRaw: nonEmpty(address.phone_mobile) ?? nonEmpty(address.phone),
    contactEmail: nonEmpty(customer.email),
    shippingCity: nonEmpty(address.city),
    shippingCountry: countryId ? (shop.countries.get(countryId) ?? null) : null,
    shippingSummary: summary || null,
    status: mapped.status,
    financialStatus: mapped.financialStatus,
    fulfillmentStatus: mapped.fulfillmentStatus,
    // Module id ('ps_cashondelivery' = cash on delivery) and the title shown to the customer.
    paymentMethod: paymentModule,
    paymentMethodTitle: payment,
    currency: (currencyId ? shop.currencies.get(currencyId) : null) ?? shop.defaultCurrency,
    total: money(order.total_paid_tax_incl) ?? money(order.total_paid),
    items,
    providerCreatedAt: shopDateToIso(order.date_add, shop.timezone),
    providerUpdatedAt: shopDateToIso(order.date_upd, shop.timezone),
    // Every source record the normalized order is built from: a corrected phone or name on the address changes the hash too.
    payloadHash: payloadHashOf({ order, details: extra.details, address: extra.address, customer: extra.customer }),
    metadata: {
      provider_state: stateId,
      state_name: state?.name ?? null,
      valid: flag(order.valid),
      is_cod: isCashOnDelivery(paymentModule, payment),
      cart_id: refOf(order.id_cart),
      delivery_address_id: refOf(order.id_address_delivery),
    },
  }
}

/** Normalizes an /api/customers record; the phone comes from one of the customer's addresses. */
export function normalizePrestaShopCustomer(raw: unknown, shop: ShopContext, address: Obj | null): NormalizedCustomer | null {
  const customer = obj(raw)
  const externalId = externalIdOf(customer.id)
  if (!externalId) return null
  const countryId = address ? refOf(address.id_country) : null
  const newsletter = flag(customer.newsletter)
  const optin = flag(customer.optin)
  return {
    externalId,
    email: nonEmpty(customer.email),
    firstName: nonEmpty(customer.firstname),
    lastName: nonEmpty(customer.lastname),
    phoneRaw: address ? (nonEmpty(address.phone_mobile) ?? nonEmpty(address.phone)) : null,
    countryCode: countryId ? (shop.countries.get(countryId) ?? null) : null,
    // newsletter = e-mail marketing, optin = partner offers: either is a marketing consent; neither says anything about calls.
    marketingConsent: newsletter === null && optin === null ? null : newsletter === true || optin === true,
    callConsent: null,
    ordersCount: null,
    totalSpent: null,
    providerCreatedAt: shopDateToIso(customer.date_add, shop.timezone),
    providerUpdatedAt: shopDateToIso(customer.date_upd, shop.timezone),
    metadata: {
      active: flag(customer.active),
      is_guest: flag(customer.is_guest),
      phone_address_id: address ? externalIdOf(address.id) : null,
      payload_hash: payloadHashOf(customer),
    },
  }
}

/** Stock of the product-level row (id_product_attribute = 0) of /api/stock_availables. */
function stockOf(stock: Obj | null, shop: ShopContext): { status: StockStatus; quantity: number | null } {
  if (!stock) return { status: 'unknown', quantity: null }
  const quantity = integer(stock.quantity)
  if (quantity === null) return { status: 'unknown', quantity: null }
  if (quantity > 0) return { status: 'in_stock', quantity }
  // out_of_stock: 0 = deny orders, 1 = allow orders (backorder), 2 = the shop default (PS_ORDER_OUT_OF_STOCK).
  const mode = nonEmpty(stock.out_of_stock)
  const backorders = mode === '1' || (mode === '2' && shop.backordersByDefault === true)
  return { status: backorders ? 'on_backorder' : 'out_of_stock', quantity }
}

/** Normalizes an /api/products record (name is translated; price is the catalogue price before tax). */
export function normalizePrestaShopProduct(raw: unknown, shop: ShopContext, storeUrl: string | null, stock: Obj | null): NormalizedProduct | null {
  const product = obj(raw)
  const externalId = externalIdOf(product.id)
  if (!externalId) return null
  const active = flag(product.active)
  const stockInfo = stockOf(stock, shop)
  return {
    externalId,
    sku: nonEmpty(product.reference),
    name: langValue(product.name, shop.defaultLangId) ?? `#${externalId}`,
    // A disabled product is hidden from the shop but kept: the closest to a draft.
    status: active === true ? 'active' : active === false ? 'draft' : 'unknown',
    price: money(product.price),
    currency: shop.defaultCurrency,
    stockStatus: stockInfo.status,
    stockQuantity: stockInfo.quantity,
    // The dispatcher resolves this form whatever the friendly-URL settings are.
    url: storeUrl ? `${storeUrl}/index.php?controller=product&id_product=${externalId}` : null,
    providerUpdatedAt: shopDateToIso(product.date_upd, shop.timezone),
    metadata: { price_includes_tax: false, payload_hash: payloadHashOf(product) },
  }
}

// ─── Resource list (GET /api/) ────────────────────────────────────────────────

export interface ResourceListing {
  shopName: string | null
  /** Resources the key may GET. */
  readable: Set<string>
}

/**
 * Parses the XML resource list: <prestashop><api shopName="…"><orders
 * xlink:href="…" get="true" put="false" …><description>…</description>
 * <schema …/></orders>…</api></prestashop>. Resources without any right are
 * absent. Null when the document is not that list.
 */
export function parseResourceListing(xml: string): ResourceListing | null {
  if (!/<prestashop\b/i.test(xml) || !/<api\b/i.test(xml)) return null
  const shopName = decodeEntities(/<api\s+shopName="([^"]*)"/.exec(xml)?.[1] ?? '').trim() || null
  const readable = new Set<string>()
  for (const m of xml.matchAll(/<([a-z][a-z0-9_]*)\s+xlink:href="[^"]*"([^>]*)>/g)) {
    if (/\sget="true"/.test(m[2])) readable.add(m[1])
  }
  return { shopName, readable }
}

/** Major.minor of the PSWS-Version header, or null when absent or odd. */
function platformVersionOf(headers: Headers): string | null {
  const raw = headers.get('psws-version')?.trim() ?? ''
  return /^\d{1,2}\.\d{1,3}(\.\d{1,3}){0,2}$/.test(raw) ? raw : null
}

function versionSupported(version: string | null): boolean {
  if (!version) return true // Unknown: the resource reads decide.
  const [major, minor] = version.split('.').map(Number)
  const [minMajor, minMinor] = PRESTASHOP_MIN_VERSION.split('.').map(Number)
  return major > minMajor || (major === minMajor && minor >= minMinor)
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

interface LoadedContext {
  shop: ShopContext
  listing: ResourceListing
  platformVersion: string | null
  shopName: string | null
  /** ISO 3166-1 alpha-2 of PS_COUNTRY_DEFAULT. */
  defaultCountry: string | null
  /** ISO 639-1 of PS_LANG_DEFAULT. */
  language: string | null
  notes: string[]
}

/** Customer fields read (never passwd, secure_key or the reset token). */
const CUSTOMER_DISPLAY = '[id,id_lang,firstname,lastname,email,company,newsletter,optin,active,deleted,is_guest,date_add,date_upd]'
/** Product fields read (descriptions, per language, would dominate the page size). */
const PRODUCT_DISPLAY = '[id,name,reference,price,active,date_add,date_upd]'
const CONFIG_KEYS = ['PS_SHOP_NAME', 'PS_TIMEZONE', 'PS_LANG_DEFAULT', 'PS_CURRENCY_DEFAULT', 'PS_COUNTRY_DEFAULT', 'PS_ORDER_OUT_OF_STOCK'] as const

function connectionContext(connection: Pick<AdapterConnection, 'storeUrl' | 'secrets'>): PsContext {
  return contextFor(canonicalStoreUrl(connection.storeUrl).storeUrl, parseSecrets(connection.secrets))
}

export function createPrestaShopAdapter(deps: PrestaShopAdapterDeps = {}): CommerceAdapter {
  const now = deps.now ?? Date.now
  const contextCache = new Map<string, { loadedAt: number; context: LoadedContext }>()

  /** Rows of a list answer: {"<resource>":[…]} with display, or [] when empty. */
  function rowsOf(res: PsResponse, operation: string, key: string): Obj[] {
    if (Array.isArray(res.json)) {
      if (res.json.length === 0) return []
      throw invalidResponse(operation, 'unexpected top-level array')
    }
    const body = obj(res.json)
    const rows = body[key]
    if (!Array.isArray(rows)) throw invalidResponse(operation, `missing "${key}" list`)
    return rows.map(obj)
  }

  async function list(ctx: PsContext, resource: string, query: Record<string, string | number | undefined>, opts: { operation?: string; large?: boolean } = {}): Promise<Obj[]> {
    const operation = opts.operation ?? `${resource}.list`
    const res = await psRequest(deps, ctx, operation, {
      path: `/${resource}`,
      query,
      timeoutMs: opts.large ? LIST_TIMEOUT_MS : undefined,
      maxBytes: opts.large ? LIST_MAX_BYTES : undefined,
    })
    if (res.status !== 200) throw httpFailure(res, operation, resource)
    if (looksLikeHtml(res)) throw httpFailure({ ...res, status: 404 }, operation, resource)
    return rowsOf(res, operation, resource)
  }

  /** The authenticated resource list: proves the key, tells the rights, carries the version. */
  async function readListing(ctx: PsContext): Promise<{ listing: ResourceListing; platformVersion: string | null }> {
    const res = await psRequest(deps, ctx, 'api.index', { path: '/', format: 'xml' })
    if (res.status !== 200) throw httpFailure(res, 'api.index')
    if (looksLikeHtml(res)) throw httpFailure({ ...res, status: 404 }, 'api.index')
    const listing = parseResourceListing(res.text)
    if (!listing) throw invalidResponse('api.index', 'not the webservice resource list')
    const platformVersion = platformVersionOf(res.headers)
    if (!versionSupported(platformVersion)) {
      throw new ConnectionError('api_version_unsupported', `Versiunea PrestaShop ${platformVersion} nu este suportată: este nevoie de PrestaShop ${PRESTASHOP_MIN_VERSION} sau mai nou.`, false, `prestashop api.index: version ${platformVersion}`)
    }
    const missing = REQUIRED_RESOURCES.filter((r) => !listing.readable.has(r))
    if (missing.length) throw forbiddenResource(missing, `prestashop api.index: missing GET on ${missing.join(',')}`)
    return { listing, platformVersion }
  }

  /** The shop configuration keys this adapter reads (name → value), from /api/configurations. */
  async function readConfiguration(ctx: PsContext): Promise<Map<string, string>> {
    const rows = await list(ctx, 'configurations', { display: '[id,name,value,id_shop,id_shop_group]', 'filter[name]': orFilter(CONFIG_KEYS) })
    const out = new Map<string, string>()
    const rank = (row: Obj) => (refOf(row.id_shop) ? 2 : refOf(row.id_shop_group) ? 1 : 0)
    const best = new Map<string, number>()
    for (const row of rows) {
      const name = nonEmpty(row.name)
      const value = langValue(row.value, null)
      if (!name || value === null) continue
      // A shop-level value overrides the group's, which overrides the global one (multistore).
      const score = rank(row)
      if ((best.get(name) ?? -1) < score) {
        best.set(name, score)
        out.set(name, value)
      }
    }
    return out
  }

  async function readIsoMap(ctx: PsContext, resource: 'currencies' | 'countries' | 'languages'): Promise<Map<string, string>> {
    const rows = await list(ctx, resource, { display: '[id,iso_code]' })
    const out = new Map<string, string>()
    for (const row of rows) {
      const id = externalIdOf(row.id)
      const iso = resource === 'currencies' ? currencyIso(row.iso_code) : resource === 'countries' ? countryIso(row.iso_code) : nonEmpty(row.iso_code)?.toLowerCase() ?? null
      if (id && iso) out.set(id, iso)
    }
    return out
  }

  async function loadContext(ctx: PsContext, log: Logger): Promise<LoadedContext> {
    const { listing, platformVersion } = await readListing(ctx)
    const notes: string[] = []
    const can = (resource: string) => listing.readable.has(resource)

    const config = can('configurations') ? await readConfiguration(ctx) : new Map<string, string>()
    if (!can('configurations')) notes.push(NOTE_NO_CONFIG)
    const timezone = validTimezone(config.get('PS_TIMEZONE'))
    if (can('configurations') && !timezone) notes.push(NOTE_TIMEZONE_UTC)
    const defaultLangId = refOf(config.get('PS_LANG_DEFAULT'))
    const outOfStock = nonEmpty(config.get('PS_ORDER_OUT_OF_STOCK'))

    const [currencies, countries, languages, stateRows] = await Promise.all([
      can('currencies') ? readIsoMap(ctx, 'currencies') : Promise.resolve(new Map<string, string>()),
      can('countries') ? readIsoMap(ctx, 'countries') : Promise.resolve(new Map<string, string>()),
      can('languages') ? readIsoMap(ctx, 'languages') : Promise.resolve(new Map<string, string>()),
      list(ctx, 'order_states', { display: '[id,name,template,paid,shipped,logable,deleted,module_name]' }),
    ])
    if (!can('currencies')) notes.push(NOTE_NO_CURRENCIES)
    if (!can('countries')) notes.push(NOTE_NO_COUNTRIES)
    if (!can('stock_availables')) notes.push(NOTE_NO_STOCK)

    const orderStates = new Map<string, OrderStateInfo>()
    for (const row of stateRows) {
      const state = parseOrderState(row, defaultLangId)
      if (state) orderStates.set(state.id, state)
    }
    const defaultCurrencyId = refOf(config.get('PS_CURRENCY_DEFAULT'))
    const defaultCountryId = refOf(config.get('PS_COUNTRY_DEFAULT'))
    const shop: ShopContext = {
      timezone,
      defaultLangId,
      defaultCurrency: defaultCurrencyId ? (currencies.get(defaultCurrencyId) ?? null) : null,
      backordersByDefault: outOfStock === null ? null : outOfStock === '1',
      currencies,
      countries,
      orderStates,
    }
    log.info('prestashop.context.loaded', {
      platformVersion,
      timezone,
      readable: [...listing.readable].filter((r) => (REQUIRED_RESOURCES as readonly string[]).includes(r) || (OPTIONAL_RESOURCES as readonly string[]).includes(r)),
      orderStates: orderStates.size,
      countries: countries.size,
      currencies: currencies.size,
    })
    return {
      shop,
      listing,
      platformVersion,
      shopName: nonEmpty(config.get('PS_SHOP_NAME')) ?? listing.shopName,
      defaultCountry: defaultCountryId ? (countries.get(defaultCountryId) ?? null) : null,
      language: defaultLangId ? (languages.get(defaultLangId) ?? null) : null,
      notes,
    }
  }

  async function contextOf(connection: AdapterConnection, log: Logger): Promise<{ ctx: PsContext; loaded: LoadedContext }> {
    const ctx = connectionContext(connection)
    const key = `${connection.id}:${ctx.storeUrl}`
    const cached = contextCache.get(key)
    if (cached && now() - cached.loadedAt < CONTEXT_TTL_MS) return { ctx, loaded: cached.context }
    const loaded = await loadContext(ctx, log)
    contextCache.set(key, { loadedAt: now(), context: loaded })
    return { ctx, loaded }
  }

  /** Delivery addresses and customers of a page of orders, keyed by id (one request each). */
  async function enrichOrders(ctx: PsContext, orders: Obj[], readable: Set<string>): Promise<Map<string, OrderEnrichment>> {
    const out = new Map<string, OrderEnrichment>()
    if (!orders.length) return out
    const orderIds = orders.map((o) => externalIdOf(o.id)).filter((id): id is string => !!id)
    const addressIds = [...new Set(orders.map((o) => refOf(o.id_address_delivery)).filter((id): id is string => !!id))]
    const customerIds = [...new Set(orders.map((o) => refOf(o.id_customer)).filter((id): id is string => !!id))]
    const [details, addresses, customers] = await Promise.all([
      orderIds.length
        ? list(ctx, 'order_details', { display: '[id,id_order,product_id,product_attribute_id,product_name,product_quantity,product_reference,product_price,unit_price_tax_incl,total_price_tax_incl]', 'filter[id_order]': orFilter(orderIds) }, { large: true })
        : Promise.resolve([] as Obj[]),
      addressIds.length && readable.has('addresses')
        ? list(ctx, 'addresses', { display: '[id,id_customer,id_country,firstname,lastname,company,address1,address2,postcode,city,phone,phone_mobile]', 'filter[id]': orFilter(addressIds) })
        : Promise.resolve([] as Obj[]),
      customerIds.length && readable.has('customers')
        ? list(ctx, 'customers', { display: '[id,firstname,lastname,email]', 'filter[id]': orFilter(customerIds) })
        : Promise.resolve([] as Obj[]),
    ])
    const detailsByOrder = new Map<string, Obj[]>()
    for (const row of details) {
      const orderId = refOf(row.id_order)
      if (!orderId) continue
      const bucket = detailsByOrder.get(orderId) ?? []
      bucket.push(row)
      detailsByOrder.set(orderId, bucket)
    }
    const addressById = new Map(addresses.map((a) => [externalIdOf(a.id), a] as const))
    const customerById = new Map(customers.map((c) => [externalIdOf(c.id), c] as const))
    for (const order of orders) {
      const id = externalIdOf(order.id)
      if (!id) continue
      out.set(id, {
        details: detailsByOrder.get(id) ?? [],
        address: addressById.get(refOf(order.id_address_delivery)) ?? null,
        customer: customerById.get(refOf(order.id_customer)) ?? null,
      })
    }
    return out
  }

  /** The address that carries each customer's phone: the latest non-deleted one with a number. */
  async function phoneAddresses(ctx: PsContext, customerIds: string[]): Promise<Map<string, Obj>> {
    const out = new Map<string, Obj>()
    if (!customerIds.length) return out
    const rows = await list(ctx, 'addresses', { display: '[id,id_customer,id_country,phone,phone_mobile,deleted,date_upd]', 'filter[id_customer]': orFilter(customerIds) }, { large: true })
    for (const row of rows) {
      const customerId = refOf(row.id_customer)
      if (!customerId || flag(row.deleted) === true) continue
      if (!nonEmpty(row.phone_mobile) && !nonEmpty(row.phone)) continue
      const current = out.get(customerId)
      if (!current || String(row.date_upd ?? '') >= String(current.date_upd ?? '')) out.set(customerId, row)
    }
    return out
  }

  async function productStock(ctx: PsContext, productIds: string[]): Promise<Map<string, Obj>> {
    const out = new Map<string, Obj>()
    if (!productIds.length) return out
    // The row with id_product_attribute = 0 is the product total (also for products with combinations).
    const rows = await list(ctx, 'stock_availables', { display: '[id,id_product,id_product_attribute,quantity,out_of_stock]', 'filter[id_product]': orFilter(productIds), 'filter[id_product_attribute]': '[0]' })
    for (const row of rows) {
      const productId = refOf(row.id_product)
      if (productId && integer(row.id_product_attribute) === 0) out.set(productId, row)
    }
    return out
  }

  /**
   * List query of one page: ascending ids, keyset paging (filter[id]=>[last id
   * of the previous page], the ">" operator of SQLUtils::getSQLRetrieveFilter,
   * present since 1.7.0) and the server-side date filter of incremental runs.
   * Offsets were avoided on purpose: a record deleted during a pass would shift
   * the next one across an offset cursor and it would never be read.
   */
  function pageQuery(afterId: string | null, size: number, modifiedAfter: string | null, timezone: string | null, display: string): Record<string, string | number | undefined> {
    const query: Record<string, string | number | undefined> = { display, sort: '[id_ASC]', limit: size }
    if (afterId) query['filter[id]'] = `>[${afterId}]`
    if (modifiedAfter) {
      // date=1 unlocks date_add/date_upd as filters; ">" is strict, so one second is taken off the watermark.
      const since = isoToShopDate(new Date(Date.parse(modifiedAfter) - 1000).toISOString(), timezone)
      if (since) {
        query.date = 1
        query['filter[date_upd]'] = `>[${since}]`
      }
    }
    return query
  }

  async function fetchOne<T>(connection: AdapterConnection, resource: 'orders' | 'customers' | 'products', externalId: string, log: Logger, build: (row: Obj, ctx: PsContext, loaded: LoadedContext) => Promise<T | null>): Promise<T | null> {
    if (!/^\d{1,15}$/.test(externalId)) {
      log.warn('prestashop.fetch.invalid_id', { resource, storeDomain: connection.storeDomain })
      return null
    }
    const { ctx, loaded } = await contextOf(connection, log)
    const display = resource === 'orders' ? 'full' : resource === 'customers' ? CUSTOMER_DISPLAY : PRODUCT_DISPLAY
    const rows = await list(ctx, resource, { display, 'filter[id]': `[${externalId}]`, limit: 1 }, { operation: `${resource}.get` })
    const row = rows.find((r) => externalIdOf(r.id) === externalId)
    if (!row) return null
    return build(row, ctx, loaded)
  }

  return {
    platform: 'prestashop',

    getCapabilities(connection) {
      // Decided at validation; the platform never gains webhooks or a cart event source later.
      return { ...connection.capabilities, webhooks: false, abandoned_carts: false, polling_minutes: connection.capabilities.polling_minutes ?? PRESTASHOP_POLLING_MINUTES }
    },

    async validateConnection(input: ConnectInput, log: Logger): Promise<ValidatedStore> {
      const secrets = parseSecrets(input.secrets)
      const { storeUrl, storeDomain } = canonicalStoreUrl(input.storeUrl)
      const ctx = contextFor(storeUrl, secrets)
      const loaded = await loadContext(ctx, log)
      // An authenticated read of the resource the automations depend on (the listing only states the right).
      await list(ctx, 'orders', { display: '[id]', limit: 1 }, { operation: 'orders.probe' })
      const notes = [...loaded.notes, NOTE_NO_WEBHOOKS, NOTE_NO_CARTS]
      const capabilities: CommerceCapabilities = {
        products: true,
        customers: true,
        orders: true,
        webhooks: false,
        abandoned_carts: false,
        customer_phone: loaded.listing.readable.has('addresses'),
        polling_minutes: PRESTASHOP_POLLING_MINUTES,
        notes,
      }
      log.info('prestashop.validate.ok', {
        storeDomain,
        platformVersion: loaded.platformVersion,
        currency: loaded.shop.defaultCurrency,
        countryCode: loaded.defaultCountry,
        timezone: loaded.shop.timezone,
        notes: notes.length,
      })
      return {
        storeUrl,
        storeDomain,
        displayName: loaded.shopName,
        currency: loaded.shop.defaultCurrency,
        countryCode: loaded.defaultCountry,
        timezone: loaded.shop.timezone,
        language: loaded.language,
        platformVersion: loaded.platformVersion,
        capabilities,
        secrets: { webservice_key: secrets.webservice_key },
      }
    },

    async registerWebhooks(connection: AdapterConnection, log: Logger): Promise<WebhookRegistration[]> {
      // No webhook mechanism exists in a standard PrestaShop: nothing to create, polling covers it.
      log.info('prestashop.webhooks.none', { storeDomain: connection.storeDomain })
      return []
    },

    async unregisterWebhooks(connection: AdapterConnection, log: Logger): Promise<void> {
      log.info('prestashop.webhooks.none', { storeDomain: connection.storeDomain })
    },

    async syncPage(connection: AdapterConnection, resource: SyncResource, checkpoint: SyncCheckpoint, mode, log: Logger): Promise<SyncBatch> {
      if (resource === 'carts') {
        // /api/carts has no phone and no consent semantics: never mirrored.
        return { resource, carts: [], checkpoint: { ...checkpoint, cursor: null }, done: true }
      }
      const { ctx, loaded } = await contextOf(connection, log)
      const afterId = afterIdOf(checkpoint.cursor)
      const modifiedAfter = mode === 'incremental' && checkpoint.modifiedAfter && Number.isFinite(Date.parse(checkpoint.modifiedAfter)) ? checkpoint.modifiedAfter : null
      const size = resource === 'orders' ? ORDERS_PAGE_SIZE : resource === 'customers' ? CUSTOMERS_PAGE_SIZE : PRODUCTS_PAGE_SIZE
      const display = resource === 'orders' ? 'full' : resource === 'customers' ? CUSTOMER_DISPLAY : PRODUCT_DISPLAY
      const rows = await list(ctx, resource, pageQuery(afterId, size, modifiedAfter, loaded.shop.timezone, display), { large: true })
      // The cursor is the highest id of the page: it only ever moves forward.
      const lastId = rows.reduce<string | null>((max, row) => {
        const id = externalIdOf(row.id)
        return id && (max === null || Number(id) > Number(max)) ? id : max
      }, null)
      let done = rows.length < size
      if (!done && (lastId === null || (afterId !== null && Number(lastId) <= Number(afterId)))) {
        // A full page that does not move the cursor (filter or sort ignored by the store): stop rather than loop.
        log.warn('prestashop.sync.no_progress', { storeDomain: connection.storeDomain, resource, afterId, count: rows.length })
        done = true
      }
      const nextCheckpoint: SyncCheckpoint = { cursor: done ? null : lastId, modifiedAfter: checkpoint.modifiedAfter, pages: checkpoint.pages + 1 }
      let skipped = 0
      const batch: SyncBatch = { resource, checkpoint: nextCheckpoint, done }
      if (resource === 'orders') {
        const enrichment = await enrichOrders(ctx, rows, loaded.listing.readable)
        batch.orders = []
        for (const row of rows) {
          const id = externalIdOf(row.id)
          const order = id ? normalizePrestaShopOrder(row, loaded.shop, enrichment.get(id) ?? { details: [], address: null, customer: null }) : null
          if (order) batch.orders.push(order)
          else skipped++
        }
      } else if (resource === 'customers') {
        // Deleted accounts are not call targets: they are left out of the mirror.
        const live = rows.filter((row) => flag(row.deleted) !== true)
        skipped += rows.length - live.length
        const ids = live.map((row) => externalIdOf(row.id)).filter((id): id is string => !!id)
        const addresses = loaded.listing.readable.has('addresses') ? await phoneAddresses(ctx, ids) : new Map<string, Obj>()
        batch.customers = []
        for (const row of live) {
          const id = externalIdOf(row.id)
          const customer = id ? normalizePrestaShopCustomer(row, loaded.shop, addresses.get(id) ?? null) : null
          if (customer) batch.customers.push(customer)
          else skipped++
        }
      } else {
        const ids = rows.map((row) => externalIdOf(row.id)).filter((id): id is string => !!id)
        const stock = loaded.listing.readable.has('stock_availables') ? await productStock(ctx, ids) : new Map<string, Obj>()
        batch.products = []
        for (const row of rows) {
          const id = externalIdOf(row.id)
          const product = id ? normalizePrestaShopProduct(row, loaded.shop, ctx.storeUrl, stock.get(id) ?? null) : null
          if (product) batch.products.push(product)
          else skipped++
        }
      }
      log.info('prestashop.sync.page', { storeDomain: connection.storeDomain, resource, mode, afterId, lastId, count: rows.length, skipped, done })
      return batch
    },

    async verifyWebhook(request: RawWebhookRequest): Promise<VerifiedCommerceEvent | VerificationFailure> {
      // Nothing signs deliveries for a PrestaShop store: any request to the endpoint is refused.
      void request
      return { ok: false, reason: 'not_supported', status: 400 }
    },

    normalizeEvent(event: VerifiedCommerceEvent): CommerceEvent[] {
      return [{ kind: 'ignored', reason: `webhooks_not_supported:${event.topic}` }]
    },

    fetchOrder(connection, externalId, log) {
      return fetchOne(connection, 'orders', externalId, log, async (row, ctx, loaded) => {
        const enrichment = await enrichOrders(ctx, [row], loaded.listing.readable)
        return normalizePrestaShopOrder(row, loaded.shop, enrichment.get(externalId) ?? { details: [], address: null, customer: null })
      })
    },
    fetchCustomer(connection, externalId, log) {
      return fetchOne(connection, 'customers', externalId, log, async (row, ctx, loaded) => {
        if (flag(row.deleted) === true) return null
        const addresses = loaded.listing.readable.has('addresses') ? await phoneAddresses(ctx, [externalId]) : new Map<string, Obj>()
        return normalizePrestaShopCustomer(row, loaded.shop, addresses.get(externalId) ?? null)
      })
    },
    fetchProduct(connection, externalId, log) {
      return fetchOne(connection, 'products', externalId, log, async (row, ctx, loaded) => {
        const stock = loaded.listing.readable.has('stock_availables') ? await productStock(ctx, [externalId]) : new Map<string, Obj>()
        return normalizePrestaShopProduct(row, loaded.shop, ctx.storeUrl, stock.get(externalId) ?? null)
      })
    },
  }
}

export const prestaShopAdapter = createPrestaShopAdapter()
