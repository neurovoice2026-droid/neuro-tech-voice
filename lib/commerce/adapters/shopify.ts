import 'server-only'
// Shopify adapter: GraphQL Admin API + webhooks, behind the CommerceAdapter
// contract. Verified against the official docs on 2026-10-13:
//   versioning (2026-10 is the latest stable, released 2026-10-01):
//     https://shopify.dev/docs/api/usage/versioning
//   endpoint https://{shop}/admin/api/{version}/graphql.json, header
//   X-Shopify-Access-Token, status/error codes (throttling is HTTP 200 with
//   errors[].extensions.code = THROTTLED, missing scopes ACCESS_DENIED,
//   401 bad token, 402 frozen shop, 403 restricted shop, 423 locked shop,
//   429 only for the daily resource-based limit):
//     https://shopify.dev/docs/api/usage/response-codes
//     https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits
//   query cost (scalars 0, objects 1, connections sized by first/last,
//   mutations 10, one query ≤ 1000 points): same rate-limits page. The page
//   sizes below keep every query under that budget.
//   pagination (first ≤ 250, pageInfo.hasNextPage/endCursor):
//     https://shopify.dev/docs/api/usage/pagination-graphql
//   queries: orders (sortKey UPDATED_AT, query "updated_at:>'ISO'"),
//   customers (UPDATED_AT), products (UPDATED_AT), abandonedCheckouts (no
//   UPDATED_AT sort key: CREATED_AT, incremental via the updated_at filter;
//   requires read_orders), order/customer/product by id, shop,
//   currentAppInstallation { accessScopes { handle } }, webhookSubscriptions:
//     https://shopify.dev/docs/api/admin-graphql/latest/queries/{orders,customers,products,abandonedCheckouts,webhookSubscriptions,currentAppInstallation}
//   objects: Order (displayFinancialStatus / displayFulfillmentStatus,
//   paymentGatewayNames, cancelledAt, closedAt), Customer (email/phone are
//   deprecated → defaultEmailAddress / defaultPhoneNumber), Product,
//   ProductVariant, AbandonedCheckout, MailingAddress, Shop (billingAddress
//   is deprecated; shopAddress: ShopAddress! is the non-deprecated address
//   and the only one queried):
//     https://shopify.dev/docs/api/admin-graphql/latest/objects/{Order,Customer,Product,ProductVariant,AbandonedCheckout,MailingAddress,Shop}
//   webhooks: webhookSubscriptionCreate(topic, webhookSubscription { uri })
//   (callbackUrl is deprecated), webhookSubscriptionDelete(id), topics and
//   scopes (ORDERS_* / CHECKOUTS_* need read_orders, PRODUCTS_UPDATE
//   read_products, CUSTOMERS_UPDATE read_customers), delivery headers
//   (X-Shopify-Hmac-Sha256 = base64 HMAC-SHA256 of the raw body with the app
//   client secret, X-Shopify-Topic, X-Shopify-Shop-Domain,
//   X-Shopify-Webhook-Id = "unique composite key per delivery, use to
//   deduplicate", X-Shopify-Event-Id = shared by every delivery of one
//   merchant action):
//     https://shopify.dev/docs/api/admin-graphql/latest/mutations/{webhookSubscriptionCreate,webhookSubscriptionDelete}
//     https://shopify.dev/docs/api/admin-graphql/latest/enums/WebhookSubscriptionTopic
//     https://shopify.dev/docs/apps/build/webhooks/subscribe/https
//     https://shopify.dev/docs/apps/build/webhooks/delivery-structure
//   protected customer data (name, address, phone, email): unapproved fields
//   come back null with an error "This app is not approved to access the
//   Customer object" at HTTP 200; custom apps have access by default:
//     https://shopify.dev/docs/apps/launch/protected-customer-data
//
// Ids: the mirror tables use the numeric (legacy REST) id so GraphQL
// records (gid://shopify/Order/123) and webhook payloads ({ id: 123 }) meet.
// Abandoned checkouts use the checkout token (the only id both the GraphQL
// recovery URL and the checkouts/* payload carry).

import crypto from 'node:crypto'
import { z } from 'zod'
import type { Logger } from '@/lib/observability/logger'
import { shopifyAppConfig, type ShopifyAppConfig } from '../config'
import { safeFetch } from '../safe-fetch'
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
  type RawWebhookRequest,
  type SyncBatch,
  type SyncCheckpoint,
  type ValidatedStore,
  type VerificationFailure,
  type VerifiedCommerceEvent,
  type WebhookRegistration,
} from './types'
import { SHOPIFY_MESSAGES, errorForHttpStatus, looksLikeHtml, normalizeScopes, normalizeShopDomain, translateStoreError } from './shopify-oauth'

/** Latest stable Admin API version (https://shopify.dev/docs/api/usage/versioning, read 2026-10-13: 2026-10, released 2026-10-01, supported until 2027-10-16). */
export const SHOPIFY_API_VERSION = '2026-10'

/** Offline access token issued by the authorization code grant (shopify-oauth.ts) plus the granted scopes. */
export const ShopifySecretsSchema = z.object({
  access_token: z.string().trim().min(8).max(4096).regex(/^[\x21-\x7e]+$/, 'access token must be printable ASCII'),
  scope: z.string().trim().max(4000).optional(),
})
export type ShopifySecrets = z.infer<typeof ShopifySecretsSchema>

export interface ShopifyAdapterDeps {
  fetchImpl?: typeof fetch
  lookup?: (hostname: string) => Promise<string[]>
  /** The app credentials (client secret signs webhooks). Defaults to lib/commerce/config.ts. */
  appConfig?: () => ShopifyAppConfig | null
  /** Operator override of the API version (COMMERCE_SHOPIFY_API_VERSION); only a YYYY-MM value counts. */
  apiVersionOverride?: () => string | undefined
}

// Page sizes derived from the cost model (objects 1, connections 2 + first ×
// node, scalars 0): an order with 14 line items costs ~94 points, so 10
// orders ≈ 942; customers/products ≈ 6 points each; a checkout with 10 line
// items ≈ 20. Everything stays under the 1000-point single-query limit.
const ORDERS_PAGE_SIZE = 10
const ORDER_LINE_ITEMS = 14
const CUSTOMERS_PAGE_SIZE = 50
const PRODUCTS_PAGE_SIZE = 50
const CHECKOUTS_PAGE_SIZE = 30
const CHECKOUT_LINE_ITEMS = 10
const PROBE_SIZE = 5
const WEBHOOK_LIST_PAGE = 100
const WEBHOOK_LIST_MAX_PAGES = 5

/** Topics we subscribe to (X-Shopify-Topic form → WebhookSubscriptionTopic enum). */
const TOPIC_ENUM: Record<string, string> = {
  'orders/create': 'ORDERS_CREATE',
  'orders/updated': 'ORDERS_UPDATED',
  'orders/cancelled': 'ORDERS_CANCELLED',
  'products/update': 'PRODUCTS_UPDATE',
  'customers/update': 'CUSTOMERS_UPDATE',
  'checkouts/create': 'CHECKOUTS_CREATE',
  'checkouts/update': 'CHECKOUTS_UPDATE',
}

/** Topics verifyWebhook accepts: the subscribed ones plus deletions Shopify may still deliver. */
const KNOWN_TOPICS = new Set([...Object.keys(TOPIC_ENUM), 'orders/delete', 'products/delete', 'checkouts/delete'])

// ─── GraphQL documents ───────────────────────────────────────────────────────

const MONEY = 'shopMoney { amount currencyCode }'

const ORDER_FIELDS = `
  id legacyResourceId name createdAt updatedAt processedAt cancelledAt closedAt
  displayFinancialStatus displayFulfillmentStatus paymentGatewayNames currencyCode test
  email phone
  totalPriceSet { ${MONEY} }
  customer { id firstName lastName defaultPhoneNumber { phoneNumber } }
  shippingAddress { name firstName lastName phone address1 city countryCodeV2 }
  billingAddress { name phone countryCodeV2 }
  lineItems(first: ${ORDER_LINE_ITEMS}) {
    nodes { id title name quantity currentQuantity sku product { id } originalUnitPriceSet { ${MONEY} } discountedTotalSet { ${MONEY} } }
    pageInfo { hasNextPage }
  }`

const CUSTOMER_FIELDS = `
  id legacyResourceId firstName lastName createdAt updatedAt numberOfOrders
  defaultEmailAddress { emailAddress marketingState }
  defaultPhoneNumber { phoneNumber smsMarketingConsent { state } }
  defaultAddress { phone countryCodeV2 }
  amountSpent { amount currencyCode }`

const PRODUCT_FIELDS = `
  id legacyResourceId title handle status onlineStoreUrl createdAt updatedAt totalInventory tracksInventory hasOnlyDefaultVariant
  priceRangeV2 { minVariantPrice { amount currencyCode } }
  variants(first: 1) { nodes { id sku price inventoryQuantity inventoryPolicy } }`

const CHECKOUT_FIELDS = `
  id name abandonedCheckoutUrl createdAt updatedAt completedAt
  customer { id firstName lastName defaultPhoneNumber { phoneNumber } defaultEmailAddress { emailAddress } }
  shippingAddress { name firstName lastName phone city countryCodeV2 }
  billingAddress { phone countryCodeV2 }
  totalPriceSet { ${MONEY} }
  lineItems(first: ${CHECKOUT_LINE_ITEMS}) { nodes { id title quantity sku } }`

const PAGE_INFO = 'pageInfo { hasNextPage endCursor }'

const Q = {
  validate: `query ShopifyValidateShop {
    shop { name myshopifyDomain currencyCode ianaTimezone primaryDomain { host } shopAddress { countryCodeV2 } }
    currentAppInstallation { accessScopes { handle } }
  }`,
  probeOrders: `query ShopifyProbeOrders {
    orders(first: ${PROBE_SIZE}, sortKey: CREATED_AT, reverse: true) {
      nodes { id email phone shippingAddress { phone address1 } billingAddress { phone } customer { defaultPhoneNumber { phoneNumber } defaultEmailAddress { emailAddress } } }
    }
  }`,
  probeCustomers: `query ShopifyProbeCustomers {
    customers(first: ${PROBE_SIZE}, sortKey: CREATED_AT, reverse: true) {
      nodes { id defaultPhoneNumber { phoneNumber } defaultEmailAddress { emailAddress } defaultAddress { phone address1 } }
    }
  }`,
  orders: `query ShopifyOrdersPage($first: Int!, $after: String, $query: String, $reverse: Boolean!) {
    orders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: $reverse) { nodes { ${ORDER_FIELDS} } ${PAGE_INFO} }
  }`,
  customers: `query ShopifyCustomersPage($first: Int!, $after: String, $query: String, $reverse: Boolean!) {
    customers(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: $reverse) { nodes { ${CUSTOMER_FIELDS} } ${PAGE_INFO} }
  }`,
  products: `query ShopifyProductsPage($first: Int!, $after: String, $query: String, $reverse: Boolean!) {
    products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: $reverse) { nodes { ${PRODUCT_FIELDS} } ${PAGE_INFO} }
  }`,
  checkouts: `query ShopifyCheckoutsPage($first: Int!, $after: String, $query: String) {
    abandonedCheckouts(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) { nodes { ${CHECKOUT_FIELDS} } ${PAGE_INFO} }
  }`,
  order: `query ShopifyOrder($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`,
  customer: `query ShopifyCustomer($id: ID!) { customer(id: $id) { ${CUSTOMER_FIELDS} } }`,
  product: `query ShopifyProduct($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`,
  webhooks: `query ShopifyWebhookSubscriptions($first: Int!, $after: String) {
    webhookSubscriptions(first: $first, after: $after) { nodes { id topic uri } ${PAGE_INFO} }
  }`,
  webhookCreate: `mutation ShopifyWebhookCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription { id topic uri }
      userErrors { field message }
    }
  }`,
  webhookDelete: `mutation ShopifyWebhookDelete($id: ID!) {
    webhookSubscriptionDelete(id: $id) { deletedWebhookSubscriptionId userErrors { field message } }
  }`,
}

// ─── Small value helpers ─────────────────────────────────────────────────────

type Rec = Record<string, unknown>

const obj = (v: unknown): Rec | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
/** Numbers and decimal strings (Money amounts are strings); null for anything else. */
function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v)
  return null
}
function iso(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}
/** The numeric id in a gid (gid://shopify/Order/123[?...]). */
function legacyIdFromGid(gid: unknown): string | null {
  const s = str(gid)
  const m = s?.match(/^gid:\/\/shopify\/[A-Za-z]+\/(\d+)(?:\?.*)?$/)
  return m ? m[1] : null
}
/** A numeric id as the webhook payloads carry it (number or digit string). */
function idString(v: unknown): string | null {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return String(v)
  if (typeof v === 'string' && /^\d{1,20}$/.test(v)) return v
  return null
}
/** The gid of the expected type for a numeric id or a gid; null for anything else (a gid of another type would query the wrong object). */
function toGid(type: 'Order' | 'Customer' | 'Product', externalId: string): string | null {
  const id = externalId.trim()
  const gid = id.match(/^gid:\/\/shopify\/([A-Za-z]+)\/(\d{1,20})$/)
  if (gid) return gid[1] === type ? id : null
  return /^\d{1,20}$/.test(id) ? `gid://shopify/${type}/${id}` : null
}
function money(bag: unknown): { amount: number | null; currency: string | null } {
  const m = obj(obj(bag)?.shopMoney)
  return { amount: num(m?.amount), currency: str(m?.currencyCode) }
}
function fullName(first: unknown, last: unknown): string | null {
  const name = [str(first), str(last)].filter(Boolean).join(' ').trim()
  return name || null
}
function addressSummary(line1: unknown, city: unknown): string | null {
  const parts = [str(line1), str(city)].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}
/** The checkout token embedded in the recovery URL (https://{shop}/{id}/checkouts/{token}/recover). */
function tokenFromRecoveryUrl(url: unknown): string | null {
  const m = str(url)?.match(/\/checkouts\/([0-9a-f]{16,64})\/recover/i)
  return m ? m[1].toLowerCase() : null
}
/** WebhookSubscriptionTopic enum (ORDERS_CREATE) → header form (orders/create). */
function slashTopic(v: unknown): string | null {
  const s = str(v)
  return s ? s.toLowerCase().replace('_', '/') : null
}

/** JSON with sorted keys at every level, so the same record always hashes the same. */
function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`
  if (v && typeof v === 'object') {
    const rec = v as Rec
    return `{${Object.keys(rec)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(rec[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}
function payloadHash(record: unknown): string {
  return crypto.createHash('sha256').update(stableJson(record)).digest('hex')
}

// ─── Status mappings ─────────────────────────────────────────────────────────

/**
 * Order status (OrderStatus) from the order's lifecycle timestamps, as the
 * task defines it: cancelledAt → cancelled, closedAt (archived/completed) →
 * completed, otherwise processing. Shopify has no "pending" order state: a
 * pending payment shows in financialStatus.
 */
function orderStatus(cancelledAt: string | null, closedAt: string | null): OrderStatus {
  if (cancelledAt) return 'cancelled'
  if (closedAt) return 'completed'
  return 'processing'
}

/**
 * OrderDisplayFinancialStatus / REST financial_status → FinancialStatus.
 * EXPIRED (payment not captured before the provider's deadline) carries no
 * money, like a void, so it maps to voided.
 */
const FINANCIAL_MAP: Record<string, FinancialStatus> = {
  pending: 'pending',
  authorized: 'authorized',
  paid: 'paid',
  partially_paid: 'partially_paid',
  partially_refunded: 'partially_refunded',
  refunded: 'refunded',
  voided: 'voided',
  expired: 'voided',
}
function financialStatus(v: string | null): FinancialStatus {
  return v ? (FINANCIAL_MAP[v.toLowerCase()] ?? 'unknown') : 'unknown'
}

/**
 * OrderDisplayFulfillmentStatus / REST fulfillment_status → FulfillmentStatus.
 * Everything before the first shipment (in progress, scheduled, on hold,
 * request declined, the deprecated OPEN / PENDING_FULFILLMENT) is
 * unfulfilled; FULFILLMENT_NOT_REQUIRED has nothing to ship, so fulfilled;
 * REST `restocked` (every item restocked after a cancellation) is cancelled.
 * A null REST value means nothing was fulfilled.
 */
const FULFILLMENT_MAP: Record<string, FulfillmentStatus> = {
  fulfilled: 'fulfilled',
  fulfillment_not_required: 'fulfilled',
  partially_fulfilled: 'partial',
  partial: 'partial',
  unfulfilled: 'unfulfilled',
  open: 'unfulfilled',
  in_progress: 'unfulfilled',
  pending_fulfillment: 'unfulfilled',
  scheduled: 'unfulfilled',
  on_hold: 'unfulfilled',
  request_declined: 'unfulfilled',
  restocked: 'cancelled',
}
function fulfillmentStatus(v: string | null): FulfillmentStatus {
  if (!v) return 'unfulfilled'
  return FULFILLMENT_MAP[v.toLowerCase()] ?? 'unknown'
}

/** ProductStatus enum / REST status → ProductStatus (UNLISTED is active but hidden from browsing). */
function productStatus(v: string | null): ProductStatus {
  switch ((v ?? '').toLowerCase()) {
    case 'active':
    case 'unlisted':
      return 'active'
    case 'draft':
      return 'draft'
    case 'archived':
      return 'archived'
    default:
      return 'unknown'
  }
}

/**
 * Cash on delivery: Shopify has no COD flag, only payment gateway names, and
 * manual payment methods carry the merchant's own label ("Cash on Delivery
 * (COD)", "Plata ramburs", "Numerar la livrare", "Plată la livrare").
 * paymentMethod is the stable id `cash_on_delivery` when a gateway looks like
 * COD so one automation config matches every platform; paymentMethodTitle
 * keeps the label. "cash" only counts as a whole word and not when it names
 * an online wallet (Cash App Pay, Cashfree), which would otherwise trigger
 * COD confirmation calls for prepaid orders.
 */
const COD_RE = /\bcash\b(?!\s*app)|ramburs|numerar|la livrare|\bcod\b|c\.o\.d/i
function paymentFromGateways(gateways: string[]): { id: string | null; title: string | null; cod: boolean } {
  const cod = gateways.find((g) => g.toLowerCase() === 'cash_on_delivery' || COD_RE.test(g))
  if (cod) return { id: 'cash_on_delivery', title: cod, cod: true }
  const first = gateways[0] ?? null
  return { id: first, title: first, cod: false }
}

/** SUBSCRIBED on either channel → consent; a definite "not" on every known channel → no consent; else unknown. */
function marketingConsent(states: Array<string | null>): boolean | null {
  const known = states.map((s) => s?.toUpperCase() ?? null).filter((s): s is string => !!s)
  if (!known.length) return null
  if (known.includes('SUBSCRIBED')) return true
  if (known.every((s) => s === 'NOT_SUBSCRIBED' || s === 'UNSUBSCRIBED' || s === 'NEVER_SUBSCRIBED')) return false
  return null
}

// ─── Record normalizers (GraphQL nodes) ──────────────────────────────────────

function itemFromNode(v: unknown): NormalizedOrderItem | null {
  const node = obj(v)
  if (!node) return null
  const gid = str(node.id)
  if (!gid) return null
  const quantity = num(node.currentQuantity) ?? num(node.quantity) ?? 0
  if (quantity <= 0) return null // removed from the order after an edit
  return {
    externalId: legacyIdFromGid(gid) ?? gid,
    productExternalId: legacyIdFromGid(obj(node.product)?.id),
    sku: str(node.sku),
    name: str(node.name) ?? str(node.title) ?? 'Product',
    quantity,
    unitPrice: money(node.originalUnitPriceSet).amount,
    total: money(node.discountedTotalSet).amount,
  }
}

function orderFromNode(v: unknown): NormalizedOrder | null {
  const node = obj(v)
  const gid = str(node?.id)
  if (!node || !gid) return null
  const externalId = idString(node.legacyResourceId) ?? legacyIdFromGid(gid) ?? gid
  const customer = obj(node.customer)
  const ship = obj(node.shippingAddress)
  const bill = obj(node.billingAddress)
  const gateways = arr(node.paymentGatewayNames).filter((g): g is string => typeof g === 'string')
  const payment = paymentFromGateways(gateways)
  const lineItems = obj(node.lineItems)
  const items = arr(lineItems?.nodes).map(itemFromNode).filter((i): i is NormalizedOrderItem => !!i)
  const total = money(node.totalPriceSet)
  const displayFinancial = str(node.displayFinancialStatus)
  const displayFulfillment = str(node.displayFulfillmentStatus)
  return {
    externalId,
    orderNumber: str(node.name) ?? `#${externalId}`,
    customerExternalId: legacyIdFromGid(customer?.id),
    contactName: str(ship?.name) ?? fullName(ship?.firstName, ship?.lastName) ?? fullName(customer?.firstName, customer?.lastName) ?? str(bill?.name),
    contactPhoneRaw: str(ship?.phone) ?? str(bill?.phone) ?? str(obj(customer?.defaultPhoneNumber)?.phoneNumber) ?? str(node.phone),
    contactEmail: str(node.email),
    shippingCity: str(ship?.city),
    shippingCountry: str(ship?.countryCodeV2) ?? str(bill?.countryCodeV2),
    shippingSummary: addressSummary(ship?.address1, ship?.city),
    status: orderStatus(str(node.cancelledAt), str(node.closedAt)),
    financialStatus: financialStatus(displayFinancial),
    fulfillmentStatus: fulfillmentStatus(displayFulfillment),
    paymentMethod: payment.id,
    paymentMethodTitle: payment.title,
    currency: total.currency ?? str(node.currencyCode),
    total: total.amount,
    items,
    providerCreatedAt: iso(node.createdAt) ?? iso(node.processedAt),
    providerUpdatedAt: iso(node.updatedAt),
    payloadHash: payloadHash(node),
    metadata: {
      source: 'graphql',
      gid,
      is_cod: payment.cod,
      payment_gateway_names: gateways,
      display_financial_status: displayFinancial,
      display_fulfillment_status: displayFulfillment,
      test: node.test === true,
      items_truncated: obj(lineItems?.pageInfo)?.hasNextPage === true,
    },
  }
}

function customerFromNode(v: unknown): NormalizedCustomer | null {
  const node = obj(v)
  const gid = str(node?.id)
  if (!node || !gid) return null
  const email = obj(node.defaultEmailAddress)
  const phone = obj(node.defaultPhoneNumber)
  const address = obj(node.defaultAddress)
  const spent = obj(node.amountSpent)
  return {
    externalId: idString(node.legacyResourceId) ?? legacyIdFromGid(gid) ?? gid,
    email: str(email?.emailAddress),
    firstName: str(node.firstName),
    lastName: str(node.lastName),
    phoneRaw: str(phone?.phoneNumber) ?? str(address?.phone),
    countryCode: str(address?.countryCodeV2),
    marketingConsent: marketingConsent([str(email?.marketingState), str(obj(phone?.smsMarketingConsent)?.state)]),
    callConsent: null, // Shopify records no consent for phone calls
    ordersCount: num(node.numberOfOrders),
    totalSpent: num(spent?.amount),
    providerCreatedAt: iso(node.createdAt),
    providerUpdatedAt: iso(node.updatedAt),
    metadata: { source: 'graphql', gid, total_spent_currency: str(spent?.currencyCode) },
  }
}

function stockFrom(tracks: boolean | null, quantity: number | null, policies: string[]): { status: StockStatus; quantity: number | null } {
  if (tracks === false) return { status: 'in_stock', quantity: null } // untracked inventory never sells out
  if (quantity === null) return { status: 'unknown', quantity: null }
  if (quantity > 0) return { status: 'in_stock', quantity }
  const backorder = policies.some((p) => p.toLowerCase() === 'continue')
  return { status: backorder ? 'on_backorder' : 'out_of_stock', quantity }
}

function productFromNode(v: unknown): NormalizedProduct | null {
  const node = obj(v)
  const gid = str(node?.id)
  if (!node || !gid) return null
  const variant = obj(arr(obj(node.variants)?.nodes)[0])
  const minPrice = obj(obj(node.priceRangeV2)?.minVariantPrice)
  const tracks = typeof node.tracksInventory === 'boolean' ? node.tracksInventory : null
  const stock = stockFrom(tracks, num(node.totalInventory), [str(variant?.inventoryPolicy) ?? ''])
  return {
    externalId: idString(node.legacyResourceId) ?? legacyIdFromGid(gid) ?? gid,
    sku: str(variant?.sku),
    name: str(node.title) ?? 'Product',
    status: productStatus(str(node.status)),
    price: num(minPrice?.amount) ?? num(variant?.price),
    currency: str(minPrice?.currencyCode),
    stockStatus: stock.status,
    stockQuantity: stock.quantity,
    url: str(node.onlineStoreUrl),
    providerUpdatedAt: iso(node.updatedAt),
    metadata: { source: 'graphql', gid, handle: str(node.handle), has_only_default_variant: node.hasOnlyDefaultVariant === true },
  }
}

function cartStatus(completedAt: string | null, recoveryUrl: string | null): CartStatus {
  if (completedAt) return 'recovered'
  return recoveryUrl ? 'abandoned' : 'open'
}

function cartFromNode(v: unknown): NormalizedCart | null {
  const node = obj(v)
  const gid = str(node?.id)
  if (!node || !gid) return null
  const legacyId = legacyIdFromGid(gid)
  const recoveryUrl = str(node.abandonedCheckoutUrl)
  const token = tokenFromRecoveryUrl(recoveryUrl)
  const customer = obj(node.customer)
  const ship = obj(node.shippingAddress)
  const bill = obj(node.billingAddress)
  const total = money(node.totalPriceSet)
  const status = cartStatus(str(node.completedAt), recoveryUrl)
  const updatedAt = iso(node.updatedAt)
  return {
    externalId: token ?? legacyId ?? gid,
    customerExternalId: legacyIdFromGid(customer?.id),
    contactName: str(ship?.name) ?? fullName(ship?.firstName, ship?.lastName) ?? fullName(customer?.firstName, customer?.lastName),
    contactPhoneRaw: str(ship?.phone) ?? str(bill?.phone) ?? str(obj(customer?.defaultPhoneNumber)?.phoneNumber),
    contactEmail: str(obj(customer?.defaultEmailAddress)?.emailAddress),
    status,
    currency: total.currency,
    total: total.amount,
    items: arr(obj(node.lineItems)?.nodes)
      .map(obj)
      .filter((i): i is Rec => !!i)
      .map((i) => ({ name: str(i.title) ?? 'Product', quantity: num(i.quantity) ?? 1 })),
    // The last activity on the checkout is when the customer walked away.
    abandonedAt: status === 'abandoned' ? updatedAt : null,
    recoveredOrderExternalId: null,
    providerUpdatedAt: updatedAt,
    metadata: {
      source: 'graphql',
      gid,
      legacy_id: legacyId,
      token,
      name: str(node.name),
      recovery_url: recoveryUrl,
      shipping_country: str(ship?.countryCodeV2) ?? str(bill?.countryCodeV2),
      created_at: iso(node.createdAt),
    },
  }
}

// ─── Record normalizers (webhook payloads, REST shape) ───────────────────────

function itemFromPayload(v: unknown): NormalizedOrderItem | null {
  const item = obj(v)
  if (!item) return null
  const externalId = idString(item.id) ?? legacyIdFromGid(item.admin_graphql_api_id)
  if (!externalId) return null
  const quantity = num(item.current_quantity) ?? num(item.quantity) ?? 0
  if (quantity <= 0) return null
  const unitPrice = num(item.price)
  const discount = arr(item.discount_allocations)
    .map((d) => num(obj(d)?.amount) ?? 0)
    .reduce((a, b) => a + b, 0)
  return {
    externalId,
    productExternalId: idString(item.product_id),
    sku: str(item.sku),
    name: str(item.name) ?? str(item.title) ?? 'Product',
    quantity,
    unitPrice,
    total: unitPrice === null ? null : Math.round((unitPrice * quantity - discount) * 100) / 100,
  }
}

function orderFromPayload(p: Rec): NormalizedOrder | null {
  const externalId = idString(p.id) ?? legacyIdFromGid(p.admin_graphql_api_id)
  if (!externalId) return null
  const customer = obj(p.customer)
  const ship = obj(p.shipping_address)
  const bill = obj(p.billing_address)
  let gateways = arr(p.payment_gateway_names).filter((g): g is string => typeof g === 'string')
  if (!gateways.length && str(p.gateway)) gateways = [p.gateway as string]
  const payment = paymentFromGateways(gateways)
  const financial = str(p.financial_status)
  const fulfillment = str(p.fulfillment_status)
  const orderNumber = str(p.name) ?? (idString(p.order_number) ? `#${idString(p.order_number)}` : `#${externalId}`)
  return {
    externalId,
    orderNumber,
    customerExternalId: idString(customer?.id) ?? legacyIdFromGid(customer?.admin_graphql_api_id),
    contactName: str(ship?.name) ?? fullName(ship?.first_name, ship?.last_name) ?? fullName(customer?.first_name, customer?.last_name) ?? str(bill?.name),
    contactPhoneRaw: str(ship?.phone) ?? str(bill?.phone) ?? str(customer?.phone) ?? str(p.phone),
    contactEmail: str(p.email) ?? str(customer?.email),
    shippingCity: str(ship?.city),
    shippingCountry: str(ship?.country_code) ?? str(bill?.country_code),
    shippingSummary: addressSummary(ship?.address1, ship?.city),
    status: orderStatus(str(p.cancelled_at), str(p.closed_at)),
    financialStatus: financialStatus(financial),
    fulfillmentStatus: fulfillmentStatus(fulfillment),
    paymentMethod: payment.id,
    paymentMethodTitle: payment.title,
    currency: str(p.currency),
    total: num(p.total_price),
    items: arr(p.line_items).map(itemFromPayload).filter((i): i is NormalizedOrderItem => !!i),
    providerCreatedAt: iso(p.created_at) ?? iso(p.processed_at),
    providerUpdatedAt: iso(p.updated_at),
    payloadHash: payloadHash(p),
    metadata: {
      source: 'webhook',
      gid: str(p.admin_graphql_api_id),
      is_cod: payment.cod,
      payment_gateway_names: gateways,
      display_financial_status: financial,
      display_fulfillment_status: fulfillment,
      test: p.test === true,
      items_truncated: false,
    },
  }
}

function customerFromPayload(p: Rec): NormalizedCustomer | null {
  const externalId = idString(p.id) ?? legacyIdFromGid(p.admin_graphql_api_id)
  if (!externalId) return null
  const address = obj(p.default_address)
  return {
    externalId,
    email: str(p.email),
    firstName: str(p.first_name),
    lastName: str(p.last_name),
    phoneRaw: str(p.phone) ?? str(address?.phone),
    countryCode: str(address?.country_code),
    marketingConsent: marketingConsent([str(obj(p.email_marketing_consent)?.state), str(obj(p.sms_marketing_consent)?.state)]),
    callConsent: null,
    ordersCount: num(p.orders_count),
    totalSpent: num(p.total_spent),
    providerCreatedAt: iso(p.created_at),
    providerUpdatedAt: iso(p.updated_at),
    metadata: { source: 'webhook', gid: str(p.admin_graphql_api_id), total_spent_currency: str(p.currency) },
  }
}

function productFromPayload(p: Rec, storeDomain: string): NormalizedProduct | null {
  const externalId = idString(p.id) ?? legacyIdFromGid(p.admin_graphql_api_id)
  if (!externalId) return null
  const variants = arr(p.variants).map(obj).filter((v): v is Rec => !!v)
  const first = variants[0] ?? null
  const quantities = variants.map((v) => num(v.inventory_quantity)).filter((q): q is number => q !== null)
  // REST variants say inventory_management: 'shopify' | null when the field is
  // present; when every variant says null nothing is tracked.
  const management = variants.map((v) => v.inventory_management)
  const tracks = management.length && management.every((m) => m === null) ? false : management.some((m) => typeof m === 'string') ? true : null
  const stock = stockFrom(tracks, quantities.length ? quantities.reduce((a, b) => a + b, 0) : null, variants.map((v) => str(v.inventory_policy) ?? ''))
  const prices = variants.map((v) => num(v.price)).filter((x): x is number => x !== null)
  const handle = str(p.handle)
  return {
    externalId,
    sku: str(first?.sku),
    name: str(p.title) ?? 'Product',
    status: productStatus(str(p.status)),
    price: prices.length ? Math.min(...prices) : null,
    currency: null, // the products/update payload carries no currency; the shop currency applies
    stockStatus: stock.status,
    stockQuantity: stock.quantity,
    url: handle ? `https://${storeDomain}/products/${encodeURIComponent(handle)}` : null,
    providerUpdatedAt: iso(p.updated_at),
    metadata: { source: 'webhook', gid: str(p.admin_graphql_api_id), handle, variants_count: variants.length },
  }
}

function cartFromPayload(p: Rec): NormalizedCart | null {
  const recoveryUrl = str(p.abandoned_checkout_url)
  const legacyId = idString(p.id)
  const token = (str(p.token) ?? tokenFromRecoveryUrl(recoveryUrl))?.toLowerCase() ?? null
  const externalId = token ?? legacyId
  if (!externalId) return null
  const customer = obj(p.customer)
  const ship = obj(p.shipping_address)
  const bill = obj(p.billing_address)
  const status = cartStatus(str(p.completed_at), recoveryUrl)
  const updatedAt = iso(p.updated_at)
  return {
    externalId,
    customerExternalId: idString(customer?.id),
    contactName: str(ship?.name) ?? fullName(ship?.first_name, ship?.last_name) ?? fullName(customer?.first_name, customer?.last_name),
    contactPhoneRaw: str(ship?.phone) ?? str(bill?.phone) ?? str(customer?.phone) ?? str(p.phone),
    contactEmail: str(p.email) ?? str(customer?.email),
    status,
    currency: str(p.currency) ?? str(p.presentment_currency),
    total: num(p.total_price),
    items: arr(p.line_items)
      .map(obj)
      .filter((i): i is Rec => !!i)
      .map((i) => ({ name: str(i.title) ?? 'Product', quantity: num(i.quantity) ?? 1 })),
    abandonedAt: status === 'abandoned' ? updatedAt : null,
    recoveredOrderExternalId: null,
    providerUpdatedAt: updatedAt,
    metadata: {
      source: 'webhook',
      legacy_id: legacyId,
      token,
      name: str(p.name),
      recovery_url: recoveryUrl,
      shipping_country: str(ship?.country_code) ?? str(bill?.country_code),
      created_at: iso(p.created_at),
    },
  }
}

// ─── Capabilities ────────────────────────────────────────────────────────────

/** A write_* scope implies the read_* access. */
function hasScope(scopes: ReadonlySet<string>, resource: 'orders' | 'products' | 'customers' | 'all_orders'): boolean {
  return scopes.has(`read_${resource}`) || scopes.has(`write_${resource}`)
}

type PhoneProbe = 'readable' | 'redacted' | 'unknown'

function capabilitiesFrom(scopes: ReadonlySet<string>, probe: PhoneProbe): CommerceCapabilities {
  const orders = hasScope(scopes, 'orders')
  const products = hasScope(scopes, 'products')
  const customers = hasScope(scopes, 'customers')
  const customerPhone = (orders || customers) && probe !== 'redacted'
  const notes: string[] = []
  if (!orders) notes.push('The read_orders permission is missing: orders and abandoned checkouts cannot be read.')
  if (!customers) notes.push('The read_customers permission is missing: customers cannot be read.')
  if (!products) notes.push('The read_products permission is missing: products cannot be read.')
  if (orders && !hasScope(scopes, 'all_orders')) notes.push('Without the read_all_orders permission, Shopify only exposes orders from the last 60 days.')
  if ((orders || customers) && probe === 'redacted') {
    notes.push('Shopify has not approved the app\'s access to protected customer data (phone, address, email): automated calls cannot be enabled until "Protected customer data" access is approved.')
  }
  if ((orders || customers) && probe === 'unknown') {
    notes.push('The store has no orders or customers yet: access to customer phone numbers is confirmed at the first sync.')
  }
  if (orders && !customerPhone) notes.push('Abandoned checkouts need the customer\'s phone number: the abandoned cart automation is not available.')
  return {
    products,
    customers,
    orders,
    webhooks: orders || products || customers,
    abandoned_carts: orders && customerPhone,
    customer_phone: customerPhone,
    polling_minutes: null,
    notes,
  }
}

/** Webhook topics worth subscribing to for a connection's capabilities (header form). */
function desiredTopics(capabilities: CommerceCapabilities): string[] {
  const topics: string[] = []
  if (capabilities.orders) topics.push('orders/create', 'orders/updated', 'orders/cancelled')
  if (capabilities.products) topics.push('products/update')
  if (capabilities.customers) topics.push('customers/update')
  if (capabilities.abandoned_carts) topics.push('checkouts/create', 'checkouts/update')
  return topics
}

// ─── GraphQL transport ───────────────────────────────────────────────────────

interface ShopCtx {
  shop: string
  token: string
  version: string
  log: Logger
}

interface GqlError {
  message: string
  code: string | null
  path: string[]
}

interface GqlResult {
  data: Rec
  errors: GqlError[]
  /** Some protected customer fields were nulled for lack of approval. */
  redacted: boolean
}

const PROTECTED_DATA_RE = /not approved to access/i

function parseGqlErrors(raw: unknown): GqlError[] {
  if (typeof raw === 'string') return [{ message: raw.slice(0, 200), code: null, path: [] }]
  return arr(raw)
    .map(obj)
    .filter((e): e is Rec => !!e)
    .map((e) => ({
      message: (str(e.message) ?? '').slice(0, 200),
      code: str(obj(e.extensions)?.code),
      path: arr(e.path).map((p) => String(p)),
    }))
}

function resolveApiVersion(override: (() => string | undefined) | undefined): string {
  const raw = (override ? override() : process.env.COMMERCE_SHOPIFY_API_VERSION)?.trim() ?? ''
  return /^\d{4}-\d{2}$/.test(raw) ? raw : SHOPIFY_API_VERSION
}

export function createShopifyAdapter(deps: ShopifyAdapterDeps = {}): CommerceAdapter {
  const appConfig = deps.appConfig ?? shopifyAppConfig

  /** One GraphQL request. Throws ConnectionError; never logs or throws the token or a body. */
  async function graphql(ctx: ShopCtx, operation: string, query: string, variables: Rec, root: string): Promise<GqlResult> {
    let res
    try {
      res = await safeFetch(`https://${ctx.shop}/admin/api/${ctx.version}/graphql.json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-shopify-access-token': ctx.token },
        body: JSON.stringify({ query, variables }),
        fetchImpl: deps.fetchImpl,
        lookup: deps.lookup,
      })
    } catch (err) {
      const error = translateStoreError(err, operation)
      ctx.log.warn('shopify.request.failed', { operation, code: error.code, retryable: error.retryable })
      throw error
    }
    if (res.status !== 200) {
      const error = errorForHttpStatus(res.status, operation, looksLikeHtml(res.text))
      ctx.log.warn('shopify.request.failed', { operation, status: res.status, code: error.code })
      throw error
    }
    const body = obj(res.json)
    if (!body) {
      const html = looksLikeHtml(res.text)
      throw new ConnectionError(html ? 'not_a_store' : 'invalid_response', html ? SHOPIFY_MESSAGES.not_a_store : SHOPIFY_MESSAGES.invalid_response, false, `${operation}: ${html ? 'html' : 'non-json'} body`)
    }
    const errors = parseGqlErrors(body.errors)
    const codes = errors.map((e) => e.code).filter((c): c is string => !!c)
    if (codes.includes('THROTTLED')) {
      ctx.log.warn('shopify.throttled', { operation })
      throw new ConnectionError('rate_limited', SHOPIFY_MESSAGES.rate_limited, true, `${operation}: THROTTLED`)
    }
    const redacted = errors.some((e) => PROTECTED_DATA_RE.test(e.message))
    const data = obj(body.data) ?? {}
    const rootValue = data[root]
    if ((rootValue === null || rootValue === undefined) && errors.length && !(redacted && errors.every((e) => PROTECTED_DATA_RE.test(e.message)))) {
      ctx.log.warn('shopify.graphql.errors', { operation, codes })
      if (codes.includes('ACCESS_DENIED')) throw new ConnectionError('forbidden', SHOPIFY_MESSAGES.forbidden, false, `${operation}: ACCESS_DENIED`)
      if (codes.includes('INTERNAL_SERVER_ERROR')) throw new ConnectionError('unreachable', SHOPIFY_MESSAGES.unreachable, true, `${operation}: INTERNAL_SERVER_ERROR`)
      if (codes.some((c) => /^(undefinedField|argumentNotAccepted|missingRequiredArguments|unknownEnumValue)$/.test(c))) {
        throw new ConnectionError('api_version_unsupported', SHOPIFY_MESSAGES.api_version_unsupported, false, `${operation}: ${codes.join(',')} (api ${ctx.version})`)
      }
      throw new ConnectionError('invalid_response', SHOPIFY_MESSAGES.invalid_response, false, `${operation}: graphql errors ${codes.join(',') || 'without code'}`)
    }
    if (redacted) ctx.log.warn('shopify.protected_data.redacted', { operation })
    // A page that came back with nested errors (e.g. ACCESS_DENIED on
    // Order.customer without read_customers) is usable but incomplete: say so.
    if (codes.length) ctx.log.info('shopify.graphql.partial', { operation, codes: [...new Set(codes)] })
    const cost = obj(obj(body.extensions)?.cost)
    if (cost) {
      ctx.log.debug('shopify.graphql.ok', {
        operation,
        requestedCost: num(cost.requestedQueryCost),
        actualCost: num(cost.actualQueryCost),
        available: num(obj(cost.throttleStatus)?.currentlyAvailable),
      })
    }
    return { data, errors, redacted }
  }

  function secretsOf(secrets: Rec): ShopifySecrets {
    const parsed = ShopifySecretsSchema.safeParse(secrets)
    if (!parsed.success) throw new ConnectionError('unauthorized', SHOPIFY_MESSAGES.secrets_shape, false, 'secrets: invalid shape')
    return parsed.data
  }

  function contextFor(connection: AdapterConnection, log: Logger): ShopCtx {
    const shop = normalizeShopDomain(connection.storeDomain) ?? normalizeShopDomain(connection.storeUrl)
    if (!shop) throw new ConnectionError('invalid_url', SHOPIFY_MESSAGES.invalid_url, false, 'connection: invalid shop domain')
    const { access_token } = secretsOf(connection.secrets)
    return { shop, token: access_token, version: resolveApiVersion(deps.apiVersionOverride), log: log.child({ provider: 'shopify', storeDomain: shop }) }
  }

  /**
   * Whether protected customer fields are readable: an approval error, or
   * every protected field null on every recent record, means they are
   * redacted. Orders are probed first (they carry the most protected fields);
   * a shop without orders is judged on its customers when read_customers is
   * granted; a shop with neither cannot be judged yet.
   */
  async function probeProtectedData(ctx: ShopCtx, scopes: ReadonlySet<string>): Promise<PhoneProbe> {
    const judge = (result: GqlResult, nodes: Rec[], fieldsOf: (node: Rec) => unknown[]): PhoneProbe => {
      if (result.redacted) return 'redacted'
      if (!nodes.length) return 'unknown'
      return nodes.some((n) => fieldsOf(n).some((v) => typeof v === 'string' && v.trim())) ? 'readable' : 'redacted'
    }
    if (hasScope(scopes, 'orders')) {
      const result = await graphql(ctx, 'probe orders', Q.probeOrders, {}, 'orders')
      const nodes = arr(obj(result.data.orders)?.nodes).map(obj).filter((n): n is Rec => !!n)
      const verdict = judge(result, nodes, (n) => {
        const ship = obj(n.shippingAddress)
        const customer = obj(n.customer)
        return [n.phone, n.email, ship?.phone, ship?.address1, obj(n.billingAddress)?.phone, obj(customer?.defaultPhoneNumber)?.phoneNumber, obj(customer?.defaultEmailAddress)?.emailAddress]
      })
      if (verdict !== 'unknown') return verdict
    }
    if (hasScope(scopes, 'customers')) {
      const result = await graphql(ctx, 'probe customers', Q.probeCustomers, {}, 'customers')
      const nodes = arr(obj(result.data.customers)?.nodes).map(obj).filter((n): n is Rec => !!n)
      return judge(result, nodes, (n) => {
        const address = obj(n.defaultAddress)
        return [obj(n.defaultPhoneNumber)?.phoneNumber, obj(n.defaultEmailAddress)?.emailAddress, address?.phone, address?.address1]
      })
    }
    return 'unknown'
  }

  async function listSubscriptions(ctx: ShopCtx): Promise<Array<{ id: string; topic: string; uri: string }>> {
    const out: Array<{ id: string; topic: string; uri: string }> = []
    let after: string | null = null
    for (let page = 0; page < WEBHOOK_LIST_MAX_PAGES; page++) {
      const { data } = await graphql(ctx, 'webhooks list', Q.webhooks, { first: WEBHOOK_LIST_PAGE, after }, 'webhookSubscriptions')
      const connection = obj(data.webhookSubscriptions)
      for (const raw of arr(connection?.nodes)) {
        const node = obj(raw)
        const id = str(node?.id)
        const topic = slashTopic(node?.topic)
        const uri = str(node?.uri)
        if (id && topic && uri) out.push({ id, topic, uri })
      }
      const pageInfo = obj(connection?.pageInfo)
      after = str(pageInfo?.endCursor)
      if (pageInfo?.hasNextPage !== true || !after) break
    }
    return out
  }

  async function createSubscription(ctx: ShopCtx, topic: string, uri: string): Promise<{ id: string } | { taken: true }> {
    const { data } = await graphql(ctx, `webhook create ${topic}`, Q.webhookCreate, { topic: TOPIC_ENUM[topic], webhookSubscription: { uri } }, 'webhookSubscriptionCreate')
    const payload = obj(data.webhookSubscriptionCreate)
    const userErrors = arr(payload?.userErrors)
      .map((e) => str(obj(e)?.message) ?? '')
      .filter(Boolean)
    const id = str(obj(payload?.webhookSubscription)?.id)
    if (id) return { id }
    // A subscription for this topic and address exists (a race with another
    // registration run): the caller re-lists and reuses it.
    if (userErrors.some((m) => /already/i.test(m))) return { taken: true }
    ctx.log.warn('shopify.webhook.create_refused', { topic, userErrors: userErrors.map((m) => m.slice(0, 120)) })
    throw new ConnectionError('invalid_response', SHOPIFY_MESSAGES.webhook_refused, false, `webhook create ${topic}: ${userErrors.join('; ').slice(0, 200) || 'no id returned'}`)
  }

  /** Deletes one subscription; a missing one is not an error. */
  async function deleteSubscription(ctx: ShopCtx, id: string): Promise<void> {
    const { data } = await graphql(ctx, 'webhook delete', Q.webhookDelete, { id }, 'webhookSubscriptionDelete')
    const payload = obj(data.webhookSubscriptionDelete)
    const userErrors = arr(payload?.userErrors)
      .map((e) => str(obj(e)?.message) ?? '')
      .filter(Boolean)
    if (userErrors.length && !str(payload?.deletedWebhookSubscriptionId)) {
      ctx.log.warn('shopify.webhook.delete_refused', { userErrors: userErrors.map((m) => m.slice(0, 120)) })
    }
  }

  function sinceFilter(modifiedAfter: string | null): string | null {
    if (!modifiedAfter) return null
    const t = Date.parse(modifiedAfter)
    if (!Number.isFinite(t)) return null
    // Shopify's search syntax takes a quoted ISO 8601 instant; the value is
    // regenerated from the parsed date so nothing from storage is interpolated.
    return `updated_at:>'${new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z')}'`
  }

  async function syncPage(connection: AdapterConnection, resource: SyncResource, checkpoint: SyncCheckpoint, mode: 'initial' | 'incremental', log: Logger): Promise<SyncBatch> {
    const ctx = contextFor(connection, log)
    const query = sinceFilter(checkpoint.modifiedAfter)
    // Initial syncs walk newest-first so a bounded run mirrors recent records
    // first; incremental ones walk oldest-first from the watermark.
    const reverse = mode === 'initial'
    /**
     * The checkpoint after a page and whether it was the last one. A page that
     * claims more results without a new cursor (null, or the cursor we just
     * sent) would make the worker refetch the same page on every slice
     * forever, so it is a broken response, not a checkpoint.
     */
    const pageOf = (pageInfo: Rec | null, operation: string): { checkpoint: SyncCheckpoint; done: boolean } => {
      const hasNext = pageInfo?.hasNextPage === true
      const endCursor = str(pageInfo?.endCursor)
      if (hasNext && (!endCursor || endCursor === checkpoint.cursor)) {
        ctx.log.warn('shopify.page.cursor_stuck', { operation, pages: checkpoint.pages })
        throw new ConnectionError('invalid_response', SHOPIFY_MESSAGES.invalid_response, false, `${operation}: hasNextPage without a new endCursor`)
      }
      return {
        checkpoint: { cursor: endCursor ?? checkpoint.cursor, modifiedAfter: checkpoint.modifiedAfter, pages: checkpoint.pages + 1 },
        done: !hasNext,
      }
    }
    switch (resource) {
      case 'orders': {
        const { data } = await graphql(ctx, 'orders page', Q.orders, { first: ORDERS_PAGE_SIZE, after: checkpoint.cursor, query, reverse }, 'orders')
        const connectionData = obj(data.orders)
        const orders = arr(connectionData?.nodes).map(orderFromNode).filter((o): o is NormalizedOrder => !!o)
        return { resource, orders, ...pageOf(obj(connectionData?.pageInfo), 'orders page') }
      }
      case 'customers': {
        const { data } = await graphql(ctx, 'customers page', Q.customers, { first: CUSTOMERS_PAGE_SIZE, after: checkpoint.cursor, query, reverse }, 'customers')
        const connectionData = obj(data.customers)
        const customers = arr(connectionData?.nodes).map(customerFromNode).filter((c): c is NormalizedCustomer => !!c)
        return { resource, customers, ...pageOf(obj(connectionData?.pageInfo), 'customers page') }
      }
      case 'products': {
        const { data } = await graphql(ctx, 'products page', Q.products, { first: PRODUCTS_PAGE_SIZE, after: checkpoint.cursor, query, reverse }, 'products')
        const connectionData = obj(data.products)
        const products = arr(connectionData?.nodes).map(productFromNode).filter((p): p is NormalizedProduct => !!p)
        return { resource, products, ...pageOf(obj(connectionData?.pageInfo), 'products page') }
      }
      case 'carts': {
        if (!connection.capabilities.abandoned_carts) {
          ctx.log.info('shopify.sync.carts_unavailable')
          return { resource, carts: [], checkpoint: { ...checkpoint, pages: checkpoint.pages + 1 }, done: true }
        }
        // AbandonedCheckoutSortKeys has no UPDATED_AT: newest-first by creation
        // date, with the updated_at filter narrowing incremental runs.
        const { data } = await graphql(ctx, 'checkouts page', Q.checkouts, { first: CHECKOUTS_PAGE_SIZE, after: checkpoint.cursor, query }, 'abandonedCheckouts')
        const connectionData = obj(data.abandonedCheckouts)
        const carts = arr(connectionData?.nodes).map(cartFromNode).filter((c): c is NormalizedCart => !!c)
        return { resource, carts, ...pageOf(obj(connectionData?.pageInfo), 'checkouts page') }
      }
    }
  }

  return {
    platform: 'shopify',

    getCapabilities(connection) {
      return { ...connection.capabilities, notes: [...connection.capabilities.notes] }
    },

    async validateConnection(input: ConnectInput, log: Logger): Promise<ValidatedStore> {
      const shop = normalizeShopDomain(input.storeUrl)
      if (!shop) throw new ConnectionError('invalid_url', SHOPIFY_MESSAGES.invalid_url, false, 'validate: invalid shop domain')
      const secrets = secretsOf(input.secrets)
      const version = resolveApiVersion(deps.apiVersionOverride)
      const ctx: ShopCtx = { shop, token: secrets.access_token, version, log: log.child({ provider: 'shopify', storeDomain: shop }) }
      if (version !== SHOPIFY_API_VERSION) ctx.log.info('shopify.api_version.override', { version, pinned: SHOPIFY_API_VERSION })

      const { data } = await graphql(ctx, 'validate shop', Q.validate, {}, 'shop')
      const shopNode = obj(data.shop)
      if (!shopNode) throw new ConnectionError('invalid_response', SHOPIFY_MESSAGES.invalid_response, false, 'validate: shop missing')
      const handles = arr(obj(data.currentAppInstallation)?.accessScopes)
        .map((s) => str(obj(s)?.handle))
        .filter((h): h is string => !!h)
      // The installation is the truth; the scope string from the token
      // exchange only fills in when the installation query returned nothing.
      const scopes = new Set(handles.length ? handles.map((h) => h.toLowerCase()) : normalizeScopes(secrets.scope ?? ''))
      const probe = await probeProtectedData(ctx, scopes)
      const capabilities = capabilitiesFrom(scopes, probe)
      ctx.log.info('shopify.validate.ok', { scopes: [...scopes], probe, orders: capabilities.orders, customerPhone: capabilities.customer_phone })

      const myshopify = normalizeShopDomain(str(shopNode.myshopifyDomain) ?? '') ?? shop
      const shopAddress = obj(shopNode.shopAddress)
      const billingAddress = obj(shopNode.billingAddress)
      return {
        storeUrl: `https://${myshopify}`,
        storeDomain: myshopify,
        displayName: str(shopNode.name),
        currency: str(shopNode.currencyCode),
        countryCode: str(shopAddress?.countryCodeV2) ?? str(billingAddress?.countryCodeV2),
        timezone: str(shopNode.ianaTimezone),
        language: null,
        platformVersion: version,
        capabilities,
        secrets: { access_token: secrets.access_token, scope: [...scopes].join(',') },
      }
    },

    async registerWebhooks(connection, log): Promise<WebhookRegistration[]> {
      const uri = connection.webhookUrl
      if (!uri) throw new ConnectionError('not_configured', SHOPIFY_MESSAGES.webhook_url, false, 'webhooks: no webhook url')
      // Deliveries are signed with the app client secret: without the app
      // configuration nothing could ever be verified, so do not subscribe.
      if (!appConfig()) throw new ConnectionError('not_configured', SHOPIFY_MESSAGES.not_configured, false, 'webhooks: app not configured')
      const ctx = contextFor(connection, log)
      const desired = desiredTopics(connection.capabilities)
      if (!desired.length) return []
      let ours = (await listSubscriptions(ctx)).filter((s) => s.uri === uri)
      const registrations: WebhookRegistration[] = []
      for (const topic of desired) {
        let existing = ours.find((s) => s.topic === topic)
        if (!existing) {
          const created = await createSubscription(ctx, topic, uri)
          if ('id' in created) {
            existing = { id: created.id, topic, uri }
            ours.push(existing)
            ctx.log.info('shopify.webhook.created', { topic })
          } else {
            ours = (await listSubscriptions(ctx)).filter((s) => s.uri === uri)
            existing = ours.find((s) => s.topic === topic)
            if (!existing) throw new ConnectionError('invalid_response', SHOPIFY_MESSAGES.webhook_refused, false, `webhook create ${topic}: reported as taken but not listed`)
          }
        }
        registrations.push({ topic, externalId: existing.id, source: 'api' })
      }
      // Subscriptions of ours that no longer match the capabilities (e.g. the
      // checkouts topics after the phone access changed) are removed so the
      // endpoint does not receive deliveries it will ignore.
      for (const stale of ours.filter((s) => !desired.includes(s.topic))) {
        try {
          await deleteSubscription(ctx, stale.id)
          ctx.log.info('shopify.webhook.stale_removed', { topic: stale.topic })
        } catch (err) {
          ctx.log.warn('shopify.webhook.stale_remove_failed', { topic: stale.topic, code: err instanceof ConnectionError ? err.code : 'unknown' })
        }
      }
      return registrations
    },

    async unregisterWebhooks(connection, log): Promise<void> {
      const ours = connection.webhookRegistrations.filter((r) => r.source === 'api' && r.externalId)
      if (!ours.length) return
      const ctx = contextFor(connection, log)
      for (const registration of ours) {
        try {
          await deleteSubscription(ctx, registration.externalId)
        } catch (err) {
          // The shop (or the subscription) is gone already: nothing left to remove.
          if (err instanceof ConnectionError && err.code === 'not_a_store') {
            ctx.log.info('shopify.webhook.already_gone', { topic: registration.topic })
            continue
          }
          throw err
        }
      }
    },

    syncPage,

    async verifyWebhook(request: RawWebhookRequest, connection: AdapterConnection): Promise<VerifiedCommerceEvent | VerificationFailure> {
      const config = appConfig()
      if (!config?.clientSecret) return { ok: false, reason: 'not_supported', status: 400 }
      const header = request.headers.get('x-shopify-hmac-sha256')
      if (!header) return { ok: false, reason: 'missing_signature', status: 401 }
      // Buffer.from(base64) drops invalid characters instead of throwing; the
      // length check below rejects anything that is not a 32-byte digest.
      const provided = Buffer.from(header.trim(), 'base64')
      const expected = crypto.createHmac('sha256', config.clientSecret).update(request.rawBody).digest()
      if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return { ok: false, reason: 'bad_signature', status: 401 }

      const topic = (request.headers.get('x-shopify-topic') ?? '').trim().toLowerCase()
      if (!topic || !KNOWN_TOPICS.has(topic)) return { ok: false, reason: 'unknown_topic', status: 400 }
      const shopHeader = normalizeShopDomain(request.headers.get('x-shopify-shop-domain') ?? '')
      const ourShop = normalizeShopDomain(connection.storeDomain) ?? normalizeShopDomain(connection.storeUrl)
      if (!shopHeader || !ourShop || shopHeader !== ourShop) return { ok: false, reason: 'malformed', status: 400 }

      let payload: unknown
      try {
        payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(request.rawBody))
      } catch (err) {
        void err
        return { ok: false, reason: 'malformed', status: 400 }
      }
      const body = obj(payload)
      if (!body) return { ok: false, reason: 'malformed', status: 400 }
      // X-Shopify-Webhook-Id is the documented per-delivery key; X-Shopify-Event-Id
      // is shared by every delivery of one merchant action, so it is only a fallback.
      const deliveryId = str(request.headers.get('x-shopify-webhook-id')) ?? str(request.headers.get('x-shopify-event-id'))
      const externalResourceId = topic.startsWith('checkouts/')
        ? (str(body.token)?.toLowerCase() ?? tokenFromRecoveryUrl(body.abandoned_checkout_url) ?? idString(body.id))
        : (idString(body.id) ?? legacyIdFromGid(body.admin_graphql_api_id))
      return { ok: true, topic, deliveryId, externalResourceId, payload: body }
    },

    normalizeEvent(event: VerifiedCommerceEvent, connection: AdapterConnection): CommerceEvent[] {
      const body = obj(event.payload)
      if (!body) return [{ kind: 'ignored', reason: 'payload is not an object' }]
      const topic = event.topic.toLowerCase()
      const missing = (what: string): CommerceEvent[] => [{ kind: 'ignored', reason: `${topic}: ${what} without an id` }]
      switch (topic) {
        case 'orders/create': {
          const order = orderFromPayload(body)
          return order ? [{ kind: 'order.created', order }] : missing('order')
        }
        case 'orders/updated':
        case 'orders/cancelled': {
          const order = orderFromPayload(body)
          return order ? [{ kind: 'order.updated', order }] : missing('order')
        }
        case 'orders/delete': {
          const externalId = idString(body.id) ?? legacyIdFromGid(body.admin_graphql_api_id)
          return externalId ? [{ kind: 'order.deleted', externalId }] : missing('order')
        }
        case 'products/update': {
          const storeDomain = normalizeShopDomain(connection.storeDomain) ?? normalizeShopDomain(connection.storeUrl) ?? connection.storeDomain
          const product = productFromPayload(body, storeDomain)
          return product ? [{ kind: 'product.updated', product }] : missing('product')
        }
        case 'products/delete': {
          const externalId = idString(body.id) ?? legacyIdFromGid(body.admin_graphql_api_id)
          return externalId ? [{ kind: 'product.deleted', externalId }] : missing('product')
        }
        case 'customers/update': {
          const customer = customerFromPayload(body)
          return customer ? [{ kind: 'customer.updated', customer }] : missing('customer')
        }
        case 'checkouts/create':
        case 'checkouts/update': {
          const cart = cartFromPayload(body)
          return cart ? [{ kind: 'cart.updated', cart }] : missing('checkout')
        }
        case 'checkouts/delete':
          return [{ kind: 'ignored', reason: 'checkouts/delete carries no cart state to mirror' }]
        default:
          return [{ kind: 'ignored', reason: `unhandled topic ${topic}` }]
      }
    },

    async fetchOrder(connection, externalId, log) {
      const id = toGid('Order', externalId)
      if (!id) return null
      const ctx = contextFor(connection, log)
      const { data } = await graphql(ctx, 'order', Q.order, { id }, 'order')
      return orderFromNode(data.order)
    },

    async fetchCustomer(connection, externalId, log) {
      const id = toGid('Customer', externalId)
      if (!id) return null
      const ctx = contextFor(connection, log)
      const { data } = await graphql(ctx, 'customer', Q.customer, { id }, 'customer')
      return customerFromNode(data.customer)
    },

    async fetchProduct(connection, externalId, log) {
      const id = toGid('Product', externalId)
      if (!id) return null
      const ctx = contextFor(connection, log)
      const { data } = await graphql(ctx, 'product', Q.product, { id }, 'product')
      return productFromNode(data.product)
    },
  }
}

export const shopifyAdapter = createShopifyAdapter()
