// Domain types of the e-commerce vertical (lib/commerce, migration 024).
// Client-safe: no secrets, no server imports. The adapter contract lives in
// ./adapters/types.ts (server-only).

export type CommercePlatform = 'woocommerce' | 'shopify' | 'magento' | 'prestashop' | 'custom'
export const COMMERCE_PLATFORMS: readonly CommercePlatform[] = ['woocommerce', 'shopify', 'magento', 'prestashop', 'custom']

export type ConnectionStatus = 'draft' | 'connecting' | 'active' | 'degraded' | 'disconnected' | 'error'

export type SyncResource = 'products' | 'customers' | 'orders' | 'carts'
export const SYNC_RESOURCES: readonly SyncResource[] = ['products', 'customers', 'orders', 'carts']
export type SyncJobKind = 'initial' | 'incremental' | 'manual' | 'recovery'
export type SyncJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type WebhookEventStatus = 'received' | 'processing' | 'processed' | 'failed' | 'ignored'

export type AutomationType = 'cod_confirmation' | 'abandoned_cart' | 'order_follow_up'
export const AUTOMATION_TYPES: readonly AutomationType[] = ['cod_confirmation', 'abandoned_cart', 'order_follow_up']

export type RunStatus = 'eligible' | 'scheduled' | 'calling' | 'completed' | 'suppressed' | 'skipped' | 'failed' | 'retry_waiting' | 'cancelled'
export type RunOutcome = 'confirmed' | 'not_confirmed' | 'callback_requested' | 'voicemail' | 'no_answer' | 'opted_out' | 'failed'

export type OrderStatus = 'pending' | 'processing' | 'on_hold' | 'completed' | 'cancelled' | 'refunded' | 'failed' | 'draft' | 'unknown'
export type FinancialStatus = 'pending' | 'authorized' | 'paid' | 'partially_paid' | 'partially_refunded' | 'refunded' | 'voided' | 'unknown'
export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'cancelled' | 'unknown'
export type ProductStatus = 'active' | 'draft' | 'archived' | 'unknown'
export type StockStatus = 'in_stock' | 'out_of_stock' | 'on_backorder' | 'unknown'
export type CartStatus = 'open' | 'abandoned' | 'recovered' | 'expired'

/**
 * What a connection can actually do, decided by the adapter from the real
 * platform (never assumed). The UI only offers an automation whose
 * capability is true; `*_note` explains a false value to the merchant.
 */
export interface CommerceCapabilities {
  products: boolean
  customers: boolean
  orders: boolean
  /** Real-time events for orders/products/customers (otherwise polling at `polling_minutes`). */
  webhooks: boolean
  /** A cart/checkout event source with the contact phone exists (companion plugin or platform event). */
  abandoned_carts: boolean
  /** Customer phone numbers are readable (e.g. Shopify protected customer data approval). */
  customer_phone: boolean
  polling_minutes: number | null
  /** Short merchant-facing notes (Romanian) on what is unavailable and why. */
  notes: string[]
}

export const NO_CAPABILITIES: CommerceCapabilities = {
  products: false,
  customers: false,
  orders: false,
  webhooks: false,
  abandoned_carts: false,
  customer_phone: false,
  polling_minutes: null,
  notes: [],
}

/** Normalized records written to the mirror tables (service role, UPSERT by connection + external id). */
export interface NormalizedProduct {
  externalId: string
  sku: string | null
  name: string
  status: ProductStatus
  price: number | null
  currency: string | null
  stockStatus: StockStatus
  stockQuantity: number | null
  url: string | null
  providerUpdatedAt: string | null
  metadata?: Record<string, unknown>
}

export interface NormalizedCustomer {
  externalId: string
  email: string | null
  firstName: string | null
  lastName: string | null
  /** As the platform returned it; normalized to E.164 by the sync (lib/commerce/phone.ts). */
  phoneRaw: string | null
  countryCode: string | null
  marketingConsent: boolean | null
  callConsent: boolean | null
  ordersCount: number | null
  totalSpent: number | null
  providerCreatedAt: string | null
  providerUpdatedAt: string | null
  metadata?: Record<string, unknown>
}

export interface NormalizedOrderItem {
  externalId: string
  productExternalId: string | null
  sku: string | null
  name: string
  quantity: number
  unitPrice: number | null
  total: number | null
}

export interface NormalizedOrder {
  externalId: string
  orderNumber: string
  customerExternalId: string | null
  contactName: string | null
  contactPhoneRaw: string | null
  contactEmail: string | null
  shippingCity: string | null
  shippingCountry: string | null
  /** One line (street, city), shown to the agent only on an authorized call. */
  shippingSummary: string | null
  status: OrderStatus
  financialStatus: FinancialStatus
  fulfillmentStatus: FulfillmentStatus
  paymentMethod: string | null
  paymentMethodTitle: string | null
  currency: string | null
  total: number | null
  items: NormalizedOrderItem[]
  providerCreatedAt: string | null
  providerUpdatedAt: string | null
  /** Hash of the source payload (change detection). */
  payloadHash: string | null
  metadata?: Record<string, unknown>
}

export interface NormalizedCart {
  externalId: string
  customerExternalId: string | null
  contactName: string | null
  contactPhoneRaw: string | null
  contactEmail: string | null
  status: CartStatus
  currency: string | null
  total: number | null
  items: Array<{ name: string; quantity: number }>
  abandonedAt: string | null
  recoveredOrderExternalId: string | null
  providerUpdatedAt: string | null
  metadata?: Record<string, unknown>
}

/** A platform event after verification and normalization (lib/commerce/events.ts). */
export type CommerceEvent =
  | { kind: 'order.created'; order: NormalizedOrder }
  | { kind: 'order.updated'; order: NormalizedOrder }
  | { kind: 'order.deleted'; externalId: string }
  | { kind: 'product.updated'; product: NormalizedProduct }
  | { kind: 'product.deleted'; externalId: string }
  | { kind: 'customer.updated'; customer: NormalizedCustomer }
  | { kind: 'cart.updated'; cart: NormalizedCart }
  | { kind: 'ignored'; reason: string }

// ─── DTOs (what the routes return to the browser; never a secret) ─────────────

export interface ConnectionDto {
  id: string
  platform: CommercePlatform
  store_url: string
  store_domain: string
  display_name: string | null
  status: ConnectionStatus
  capabilities: CommerceCapabilities
  /** Topics with a live registration (never ids or secrets). */
  webhook_topics: string[]
  /**
   * Where the store must send its events, for platforms whose deliveries the
   * merchant sets up (custom connector; WooCommerce cart events): null for
   * the others, for a disconnected store and when no public origin is set.
   */
  webhook_url: string | null
  /** Last verified delivery (unverified ones are never recorded). */
  webhook_last_delivery_at: string | null
  last_sync_at: string | null
  last_successful_sync_at: string | null
  error_code: string | null
  error_message: string | null
  connected_at: string | null
  disconnected_at: string | null
  counts: { products: number; customers: number; orders: number; carts: number }
  sync: { status: SyncJobStatus | 'idle'; kind: SyncJobKind | null; resource: SyncResource | 'all' | null; counts: Record<string, number>; error_message: string | null; updated_at: string | null } | null
  created_at: string
}

export interface AutomationConfig {
  /** Minutes after the triggering event before the call (abandoned carts: at least 30). */
  delay_minutes: number
  /** Local call window; outside it the run waits for the next slot. */
  call_window: { start: string; end: string; days: string[] }
  /** IANA zone of the window; null = the organization's time zone. */
  timezone: string | null
  /** Calls per automation per local day. */
  daily_cap: number
  /** Calls per customer per local day (across automations). */
  per_customer_daily_cap: number
  /** Dials per run (1 = no retry). */
  max_attempts: number
  /** Minutes between dials of the same run. */
  retry_minutes: number
  /** Payment method ids/titles that count as cash on delivery (cod_confirmation). */
  cod_payment_methods: string[]
  /** Order status that triggers order_follow_up. */
  follow_up_status: OrderStatus | 'fulfilled'
  /** Carts below this total are not called (abandoned_cart); null = any. */
  min_order_total: number | null
}

export interface AutomationScript {
  /** Romanian script template with typed {{variables}} (lib/commerce/script.ts). */
  template: string
  tone: 'formal' | 'friendly'
  brand_name: string | null
  /** E.164 the agent may hand the customer to; null = no transfer offered. */
  transfer_number: string | null
  return_policy_url: string | null
}

export interface AutomationDto {
  /** null until the merchant configured or enabled this template on the connection. */
  id: string | null
  connection_id: string
  type: AutomationType
  enabled: boolean
  /** The platform supports this automation on this connection (capabilities). */
  available: boolean
  unavailable_reason: string | null
  config: AutomationConfig
  script: AutomationScript
  consent_confirmed_at: string | null
  consent_version: string | null
  stats: RunCounts
  created_at: string
  updated_at: string
}

/** Runs by status as the tiles show them; `retrying` = retry_waiting (a failed dial waiting for its next attempt). */
export interface RunCounts {
  eligible: number
  scheduled: number
  retrying: number
  calling: number
  completed: number
  suppressed: number
  failed: number
}

export interface RunDto {
  id: string
  automation_id: string
  automation_type: AutomationType
  connection_id: string
  status: RunStatus
  outcome: RunOutcome | null
  outcome_detail: string | null
  eligibility_reason: string | null
  /** Order number (no '#') or the cart's short reference, never the provider id. */
  reference: string
  /** What `reference` names: an order, or an abandoned cart. */
  reference_kind: 'order' | 'cart'
  order_id: string | null
  customer_id: string | null
  /** Masked (+40 7** *** 123). */
  to_phone_masked: string | null
  scheduled_for: string | null
  attempt: number
  max_attempts: number
  call_id: string | null
  summary: string | null
  error_message: string | null
  last_attempt_at: string | null
  completed_at: string | null
  created_at: string
}

export interface OrderListDto {
  id: string
  order_number: string
  status: OrderStatus
  financial_status: FinancialStatus
  fulfillment_status: FulfillmentStatus
  is_cod: boolean
  payment_method_title: string | null
  currency: string | null
  total: number | null
  items_count: number
  items_summary: string | null
  contact_name: string | null
  contact_phone_masked: string | null
  shipping_city: string | null
  provider_created_at: string | null
  updated_at: string
}

export interface CustomerListDto {
  id: string
  name: string
  email_masked: string | null
  phone_masked: string | null
  has_phone: boolean
  do_not_call: boolean
  do_not_call_at: string | null
  do_not_call_source: 'customer_opt_out' | 'operator' | 'provider' | null
  orders_count: number | null
  updated_at: string
}

export interface ProductListDto {
  id: string
  name: string
  sku: string | null
  status: ProductStatus
  price: number | null
  currency: string | null
  stock_status: StockStatus
  stock_quantity: number | null
  updated_at: string
}

export interface CommerceOverviewDto {
  connection: ConnectionDto | null
  automations: AutomationDto[]
  queue: RunCounts
  recent_runs: RunDto[]
  problems: Array<{ code: CommerceProblemCode; message: string; href: string | null }>
}

export type CommerceProblemCode =
  | 'no_connection'
  | 'connection_error'
  | 'credentials_expired'
  | 'webhook_failure'
  | 'sync_error'
  | 'no_phone_number'
  | 'no_consent'
  | 'agent_inactive'
  | 'minutes_exhausted'
  | 'encryption_not_configured'

/** What this deployment can do, as booleans only (GET /api/commerce/connections and the onboarding state return it as `config`). */
export interface CommerceConfigSummary {
  encryption: boolean
  /** The Shopify app is configured (SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET); without it Shopify cannot be connected. */
  shopify: boolean
  publicBaseUrl: boolean
}

/** Paged list envelope of the read-only routes. */
export interface PagedDto<T> {
  items: T[]
  next_cursor: string | null
  total: number | null
}
