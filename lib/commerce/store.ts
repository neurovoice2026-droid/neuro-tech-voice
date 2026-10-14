import 'server-only'
// Data access of the commerce vertical (service role, every query scoped by
// org_id / connection_id). Routes, the worker and the tools read and write
// through here, so the DTO rules live in one place: no credential envelope,
// cursor, webhook id or raw payload ever leaves this module, and phone
// numbers reach the browser masked.

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/observability/logger'
import { maskPhone } from '@/lib/phone/e164'
import { credentialAad, decryptCredentials, encryptCredentials, randomToken } from './crypto'
import { normalizeStorePhone } from './phone'
import { commercePublicBaseUrl } from './config'
import type { AdapterConnection, ConnectionSecrets, WebhookRegistration } from './adapters/types'
import {
  NO_CAPABILITIES,
  type AutomationType,
  type CommerceCapabilities,
  type CommercePlatform,
  type ConnectionDto,
  type ConnectionStatus,
  type CustomerListDto,
  type NormalizedCart,
  type NormalizedCustomer,
  type NormalizedOrder,
  type NormalizedProduct,
  type OrderListDto,
  type ProductListDto,
  type RunDto,
  type RunOutcome,
  type RunStatus,
  type SyncJobKind,
  type SyncJobStatus,
  type SyncResource,
} from './types'

// ─── Connections ─────────────────────────────────────────────────────────────

export interface ConnectionRow {
  id: string
  org_id: string
  platform: CommercePlatform
  store_url: string
  store_domain: string
  display_name: string | null
  status: ConnectionStatus
  capabilities: unknown
  encrypted_credentials: unknown
  credential_key_version: number | null
  webhook_config: unknown
  webhook_public_id: string
  sync_cursor: unknown
  last_sync_at: string | null
  last_successful_sync_at: string | null
  error_code: string | null
  error_message: string | null
  connected_at: string | null
  disconnected_at: string | null
  created_at: string
  updated_at: string
}

export const CONNECTION_COLUMNS =
  'id, org_id, platform, store_url, store_domain, display_name, status, capabilities, encrypted_credentials, credential_key_version, webhook_config, webhook_public_id, sync_cursor, last_sync_at, last_successful_sync_at, error_code, error_message, connected_at, disconnected_at, created_at, updated_at'

export function readCapabilities(raw: unknown): CommerceCapabilities {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...NO_CAPABILITIES, notes: [] }
  const r = raw as Record<string, unknown>
  const bool = (k: keyof CommerceCapabilities) => r[k] === true
  const polling = typeof r.polling_minutes === 'number' && Number.isFinite(r.polling_minutes) ? r.polling_minutes : null
  const notes = Array.isArray(r.notes) ? r.notes.filter((n): n is string => typeof n === 'string').slice(0, 10) : []
  return {
    products: bool('products'),
    customers: bool('customers'),
    orders: bool('orders'),
    webhooks: bool('webhooks'),
    abandoned_carts: bool('abandoned_carts'),
    customer_phone: bool('customer_phone'),
    polling_minutes: polling,
    notes,
  }
}

export interface WebhookConfig {
  registrations: WebhookRegistration[]
  /** Last delivery problem reported by the worker (public-safe). */
  last_error: string | null
  last_error_at: string | null
  last_delivery_at: string | null
}

export function readWebhookConfig(raw: unknown): WebhookConfig {
  const empty: WebhookConfig = { registrations: [], last_error: null, last_error_at: null, last_delivery_at: null }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty
  const r = raw as Record<string, unknown>
  const regs = Array.isArray(r.registrations) ? r.registrations : []
  return {
    registrations: regs
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x): WebhookRegistration => ({ topic: String(x.topic ?? ''), externalId: String(x.externalId ?? ''), source: x.source === 'manual' ? 'manual' : 'api' }))
      .filter((x) => x.topic),
    last_error: typeof r.last_error === 'string' ? r.last_error : null,
    last_error_at: typeof r.last_error_at === 'string' ? r.last_error_at : null,
    last_delivery_at: typeof r.last_delivery_at === 'string' ? r.last_delivery_at : null,
  }
}

/** The public webhook endpoint of a connection (never contains an org or connection id). */
export function webhookUrlFor(platform: CommercePlatform, publicId: string): string | null {
  const base = commercePublicBaseUrl()
  return base ? `${base}/api/commerce/webhooks/${platform}/${encodeURIComponent(publicId)}` : null
}

export async function loadConnection(db: SupabaseClient, id: string, orgId?: string): Promise<ConnectionRow | null> {
  let q = db.from('commerce_connections').select(CONNECTION_COLUMNS).eq('id', id)
  if (orgId) q = q.eq('org_id', orgId)
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(`commerce_connections read failed: ${error.message}`)
  return (data as ConnectionRow | null) ?? null
}

export async function loadConnectionByPublicId(db: SupabaseClient, platform: string, publicId: string): Promise<ConnectionRow | null> {
  const { data, error } = await db.from('commerce_connections').select(CONNECTION_COLUMNS).eq('platform', platform).eq('webhook_public_id', publicId).maybeSingle()
  if (error) throw new Error(`commerce_connections read failed: ${error.message}`)
  return (data as ConnectionRow | null) ?? null
}

export async function listConnections(db: SupabaseClient, orgId: string): Promise<ConnectionRow[]> {
  const { data, error } = await db.from('commerce_connections').select(CONNECTION_COLUMNS).eq('org_id', orgId).order('created_at', { ascending: true }).limit(20)
  if (error) throw new Error(`commerce_connections list failed: ${error.message}`)
  return (data ?? []) as ConnectionRow[]
}

/** The org's primary (first non-disconnected, else first) connection, or null. */
export async function primaryConnection(db: SupabaseClient, orgId: string): Promise<ConnectionRow | null> {
  const rows = await listConnections(db, orgId)
  return rows.find((r) => r.status !== 'disconnected') ?? rows[0] ?? null
}

/** Decrypts the credentials of a connection for an adapter call. Throws CommerceCryptoError when they cannot be read. */
export function toAdapterConnection(row: ConnectionRow): AdapterConnection {
  const secrets = row.encrypted_credentials ? decryptCredentials<ConnectionSecrets>(row.encrypted_credentials, credentialAad(row.org_id, row.id)) : {}
  return {
    id: row.id,
    orgId: row.org_id,
    platform: row.platform,
    storeUrl: row.store_url,
    storeDomain: row.store_domain,
    secrets,
    capabilities: readCapabilities(row.capabilities),
    webhookRegistrations: readWebhookConfig(row.webhook_config).registrations,
    webhookUrl: webhookUrlFor(row.platform, row.webhook_public_id),
  }
}

export function encryptedSecretsFor(row: Pick<ConnectionRow, 'id' | 'org_id'>, secrets: ConnectionSecrets): { encrypted_credentials: unknown; credential_key_version: number } {
  const env = encryptCredentials(secrets, credentialAad(row.org_id, row.id))
  return { encrypted_credentials: env, credential_key_version: env.k }
}

export function newWebhookPublicId(): string {
  return randomToken(24)
}

export interface SyncJobRow {
  id: string
  org_id: string
  connection_id: string
  kind: SyncJobKind
  resource: SyncResource | 'all'
  status: SyncJobStatus
  attempts: number
  max_attempts: number
  run_after: string
  lease_owner: string | null
  lease_until: string | null
  cursor: unknown
  counts: unknown
  error_code: string | null
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

export const SYNC_JOB_COLUMNS = 'id, org_id, connection_id, kind, resource, status, attempts, max_attempts, run_after, lease_owner, lease_until, cursor, counts, error_code, error_message, started_at, finished_at, created_at, updated_at'

export async function latestSyncJob(db: SupabaseClient, connectionId: string): Promise<SyncJobRow | null> {
  const { data, error } = await db.from('commerce_sync_jobs').select(SYNC_JOB_COLUMNS).eq('connection_id', connectionId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(`commerce_sync_jobs read failed: ${error.message}`)
  return (data as SyncJobRow | null) ?? null
}

export type EnqueueResult = 'queued' | 'already_active'

/** Queues a sync job; one queued/running job per connection and resource (23505 → already_active). */
export async function enqueueSyncJob(
  db: SupabaseClient,
  input: { orgId: string; connectionId: string; kind: SyncJobKind; resource: SyncResource | 'all'; runAfter?: Date; cursor?: Record<string, unknown> },
): Promise<EnqueueResult> {
  const { error } = await db.from('commerce_sync_jobs').insert({
    org_id: input.orgId,
    connection_id: input.connectionId,
    kind: input.kind,
    resource: input.resource,
    run_after: (input.runAfter ?? new Date()).toISOString(),
    cursor: input.cursor ?? {},
  })
  if (!error) return 'queued'
  if (error.code === '23505') return 'already_active'
  throw new Error(`commerce_sync_jobs insert failed: ${error.message}`)
}

async function countRows(db: SupabaseClient, table: string, connectionId: string): Promise<number> {
  const { count, error } = await db.from(table).select('id', { count: 'exact', head: true }).eq('connection_id', connectionId)
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

function readCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  return out
}

export async function connectionDto(db: SupabaseClient, row: ConnectionRow): Promise<ConnectionDto> {
  const [products, customers, orders, carts, job] = await Promise.all([
    countRows(db, 'commerce_products', row.id),
    countRows(db, 'commerce_customers', row.id),
    countRows(db, 'commerce_orders', row.id),
    countRows(db, 'commerce_carts', row.id),
    latestSyncJob(db, row.id),
  ])
  const webhooks = readWebhookConfig(row.webhook_config)
  return {
    id: row.id,
    platform: row.platform,
    store_url: row.store_url,
    store_domain: row.store_domain,
    display_name: row.display_name,
    status: row.status,
    capabilities: readCapabilities(row.capabilities),
    webhook_topics: webhooks.registrations.map((r) => r.topic),
    last_sync_at: row.last_sync_at,
    last_successful_sync_at: row.last_successful_sync_at,
    error_code: row.error_code,
    error_message: row.error_message,
    connected_at: row.connected_at,
    disconnected_at: row.disconnected_at,
    counts: { products, customers, orders, carts },
    sync: job
      ? { status: job.status, kind: job.kind, resource: job.resource, counts: readCounts(job.counts), error_message: job.error_message, updated_at: job.updated_at }
      : null,
    created_at: row.created_at,
  }
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export interface AuditInput {
  orgId: string
  actor: 'user' | 'system' | 'webhook' | 'cron'
  action: string
  actorUserId?: string | null
  connectionId?: string | null
  automationId?: string | null
  runId?: string | null
  callId?: string | null
  /** Short, redacted facts (counts, codes, masked numbers); never a secret or an address. */
  metadata?: Record<string, string | number | boolean | null>
}

/** Writes an audit entry; a failure is logged, never thrown (the action itself already happened). */
export async function writeAudit(db: SupabaseClient, input: AuditInput, log: Logger): Promise<void> {
  const { error } = await db.from('commerce_audit_log').insert({
    org_id: input.orgId,
    actor: input.actor,
    actor_user_id: input.actorUserId ?? null,
    action: input.action.slice(0, 80),
    connection_id: input.connectionId ?? null,
    automation_id: input.automationId ?? null,
    run_id: input.runId ?? null,
    call_id: input.callId ?? null,
    metadata: input.metadata ?? {},
  })
  if (error) log.error('commerce.audit_write_failed', error, { action: input.action })
}

// ─── Mirrors ─────────────────────────────────────────────────────────────────

export interface MirrorContext {
  orgId: string
  connectionId: string
  /** Store country (ISO2) resolving national phone formats when a record has none. */
  country: string | null
}

const BATCH = 200

function chunk<T>(items: T[], size = BATCH): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function text(v: unknown, max = 500): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

function itemsSummary(items: Array<{ name: string; quantity: number }>): string | null {
  if (!items.length) return null
  const parts = items.slice(0, 6).map((i) => `${Number.isFinite(i.quantity) ? i.quantity : 1} × ${i.name.slice(0, 60)}`)
  const more = items.length > 6 ? ` și încă ${items.length - 6}` : ''
  return `${parts.join(', ')}${more}`.slice(0, 500)
}

export async function upsertProducts(db: SupabaseClient, ctx: MirrorContext, products: NormalizedProduct[]): Promise<number> {
  let written = 0
  const now = new Date().toISOString()
  for (const part of chunk(products)) {
    const rows = part.map((p) => ({
      org_id: ctx.orgId,
      connection_id: ctx.connectionId,
      external_id: p.externalId,
      sku: text(p.sku, 120),
      name: (text(p.name, 300) ?? 'Produs').slice(0, 300),
      status: p.status,
      price: num(p.price),
      currency: text(p.currency, 8),
      stock_status: p.stockStatus,
      stock_quantity: num(p.stockQuantity),
      url: text(p.url, 1000),
      provider_updated_at: p.providerUpdatedAt,
      synced_at: now,
      metadata: p.metadata ?? {},
    }))
    const { error } = await db.from('commerce_products').upsert(rows, { onConflict: 'connection_id,external_id' })
    if (error) throw new Error(`commerce_products upsert failed: ${error.message}`)
    written += rows.length
  }
  return written
}

export interface CustomerRef {
  id: string
  external_id: string
  phone_e164: string | null
  do_not_call: boolean
}

/** Upserts customers; never touches the do-not-call columns (an import must not undo an opt-out). */
export async function upsertCustomers(db: SupabaseClient, ctx: MirrorContext, customers: NormalizedCustomer[]): Promise<Map<string, CustomerRef>> {
  const out = new Map<string, CustomerRef>()
  const now = new Date().toISOString()
  for (const part of chunk(customers)) {
    const rows = part.map((c) => ({
      org_id: ctx.orgId,
      connection_id: ctx.connectionId,
      external_id: c.externalId,
      email: text(c.email, 320)?.toLowerCase() ?? null,
      first_name: text(c.firstName, 120),
      last_name: text(c.lastName, 120),
      phone_raw: text(c.phoneRaw, 64),
      phone_e164: normalizeStorePhone(c.phoneRaw, c.countryCode ?? ctx.country),
      country_code: text(c.countryCode, 2)?.toUpperCase() ?? null,
      marketing_consent: typeof c.marketingConsent === 'boolean' ? c.marketingConsent : null,
      call_consent: typeof c.callConsent === 'boolean' ? c.callConsent : null,
      orders_count: num(c.ordersCount),
      total_spent: num(c.totalSpent),
      provider_created_at: c.providerCreatedAt,
      provider_updated_at: c.providerUpdatedAt,
      synced_at: now,
      metadata: c.metadata ?? {},
    }))
    const { data, error } = await db.from('commerce_customers').upsert(rows, { onConflict: 'connection_id,external_id' }).select('id, external_id, phone_e164, do_not_call')
    if (error) throw new Error(`commerce_customers upsert failed: ${error.message}`)
    for (const r of (data ?? []) as CustomerRef[]) out.set(r.external_id, r)
  }
  return out
}

export interface OrderRow {
  id: string
  org_id: string
  connection_id: string
  external_id: string
  order_number: string
  customer_id: string | null
  customer_external_id: string | null
  contact_name: string | null
  contact_phone_e164: string | null
  contact_email: string | null
  shipping_city: string | null
  shipping_country: string | null
  shipping_summary: string | null
  status: NormalizedOrder['status']
  financial_status: NormalizedOrder['financialStatus']
  fulfillment_status: NormalizedOrder['fulfillmentStatus']
  payment_method: string | null
  payment_method_title: string | null
  is_cod: boolean
  currency: string | null
  total: number | null
  items_count: number
  items_summary: string | null
  provider_created_at: string | null
  provider_updated_at: string | null
  synced_at: string
  payload_hash: string | null
  metadata: unknown
  created_at: string
  updated_at: string
}

export const ORDER_COLUMNS =
  'id, org_id, connection_id, external_id, order_number, customer_id, customer_external_id, contact_name, contact_phone_e164, contact_email, shipping_city, shipping_country, shipping_summary, status, financial_status, fulfillment_status, payment_method, payment_method_title, is_cod, currency, total, items_count, items_summary, provider_created_at, provider_updated_at, synced_at, payload_hash, metadata, created_at, updated_at'

export interface OrderWrite {
  row: OrderRow
  created: boolean
  /** The source payload changed since the last import (or the row is new). */
  changed: boolean
  previousStatus: OrderRow['status'] | null
}

/** Decides from the platform's own payment method ids/titles and the merchant's list (lib/commerce/automations/config.ts). */
export function isCodPayment(order: Pick<NormalizedOrder, 'paymentMethod' | 'paymentMethodTitle' | 'metadata'>, codMethods: readonly string[]): boolean {
  // A connector that states is_cod explicitly (the custom contract) is authoritative in both
  // directions: a merchant flagging an order as not-COD must win over a title such as "Ramburs Plus".
  const explicit = order.metadata?.is_cod
  if (typeof explicit === 'boolean') return explicit
  const candidates = [order.paymentMethod, order.paymentMethodTitle].map((v) => (v ?? '').trim().toLowerCase()).filter(Boolean)
  if (!candidates.length) return false
  const list = codMethods.map((m) => m.trim().toLowerCase()).filter(Boolean)
  return candidates.some((c) => list.includes(c) || /\b(cod|ramburs|cash on delivery|cashondelivery|cash_on_delivery|numerar la livrare|plata la livrare)\b/.test(c))
}

export async function upsertOrders(db: SupabaseClient, ctx: MirrorContext, orders: NormalizedOrder[], codMethods: readonly string[]): Promise<OrderWrite[]> {
  const out: OrderWrite[] = []
  const now = new Date().toISOString()
  for (const part of chunk(orders, 100)) {
    const ids = part.map((o) => o.externalId)
    const [{ data: existing, error: readErr }, customers] = await Promise.all([
      db.from('commerce_orders').select('external_id, payload_hash, status').eq('connection_id', ctx.connectionId).in('external_id', ids),
      resolveCustomerIds(db, ctx.connectionId, part.map((o) => o.customerExternalId).filter((v): v is string => !!v)),
    ])
    if (readErr) throw new Error(`commerce_orders read failed: ${readErr.message}`)
    const before = new Map((existing ?? []).map((r) => [String(r.external_id), { hash: (r.payload_hash as string | null) ?? null, status: r.status as OrderRow['status'] }]))
    const rows = part.map((o) => {
      const country = o.shippingCountry ?? ctx.country
      return {
        org_id: ctx.orgId,
        connection_id: ctx.connectionId,
        external_id: o.externalId,
        order_number: (text(o.orderNumber, 64) ?? o.externalId).slice(0, 64),
        customer_id: o.customerExternalId ? (customers.get(o.customerExternalId) ?? null) : null,
        customer_external_id: text(o.customerExternalId, 128),
        contact_name: text(o.contactName, 200),
        contact_phone_e164: normalizeStorePhone(o.contactPhoneRaw, country),
        contact_email: text(o.contactEmail, 320)?.toLowerCase() ?? null,
        shipping_city: text(o.shippingCity, 120),
        shipping_country: text(o.shippingCountry, 2)?.toUpperCase() ?? null,
        shipping_summary: text(o.shippingSummary, 300),
        status: o.status,
        financial_status: o.financialStatus,
        fulfillment_status: o.fulfillmentStatus,
        payment_method: text(o.paymentMethod, 120),
        payment_method_title: text(o.paymentMethodTitle, 200),
        is_cod: isCodPayment(o, codMethods),
        currency: text(o.currency, 8),
        total: num(o.total),
        items_count: o.items.length,
        items_summary: itemsSummary(o.items),
        provider_created_at: o.providerCreatedAt,
        provider_updated_at: o.providerUpdatedAt,
        synced_at: now,
        payload_hash: o.payloadHash,
        metadata: o.metadata ?? {},
      }
    })
    const { data, error } = await db.from('commerce_orders').upsert(rows, { onConflict: 'connection_id,external_id' }).select(ORDER_COLUMNS)
    if (error) throw new Error(`commerce_orders upsert failed: ${error.message}`)
    const byId = new Map(((data ?? []) as OrderRow[]).map((r) => [r.external_id, r]))
    for (const o of part) {
      const row = byId.get(o.externalId)
      if (!row) continue
      const prev = before.get(o.externalId)
      out.push({ row, created: !prev, changed: !prev || prev.hash !== (o.payloadHash ?? null) || prev.status !== o.status, previousStatus: prev?.status ?? null })
      await replaceOrderItems(db, ctx, row.id, o)
    }
  }
  return out
}

async function replaceOrderItems(db: SupabaseClient, ctx: MirrorContext, orderId: string, order: NormalizedOrder): Promise<void> {
  const rows = order.items.slice(0, 200).map((i, idx) => ({
    org_id: ctx.orgId,
    connection_id: ctx.connectionId,
    order_id: orderId,
    external_id: text(i.externalId, 128) ?? `line-${idx}`,
    product_external_id: text(i.productExternalId, 128),
    sku: text(i.sku, 120),
    name: (text(i.name, 300) ?? 'Produs').slice(0, 300),
    quantity: Number.isFinite(i.quantity) && i.quantity > 0 ? i.quantity : 1,
    unit_price: num(i.unitPrice),
    total: num(i.total),
  }))
  const { error } = await db.from('commerce_order_items').upsert(rows, { onConflict: 'order_id,external_id' })
  if (error) throw new Error(`commerce_order_items upsert failed: ${error.message}`)
  if (rows.length) {
    // PostgREST list syntax: every value double-quoted, with `\` and `"` escaped
    // (the ids above are stored verbatim, so the filter must name them exactly).
    const quote = (k: string) => `"${k.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    const { error: delErr } = await db.from('commerce_order_items').delete().eq('order_id', orderId).not('external_id', 'in', `(${rows.map((r) => quote(r.external_id)).join(',')})`)
    if (delErr) throw new Error(`commerce_order_items prune failed: ${delErr.message}`)
  }
}

async function resolveCustomerIds(db: SupabaseClient, connectionId: string, externalIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [...new Set(externalIds)]
  if (!unique.length) return out
  const { data, error } = await db.from('commerce_customers').select('id, external_id').eq('connection_id', connectionId).in('external_id', unique)
  if (error) throw new Error(`commerce_customers read failed: ${error.message}`)
  for (const r of data ?? []) out.set(String(r.external_id), String(r.id))
  return out
}

export interface CartRow {
  id: string
  org_id: string
  connection_id: string
  external_id: string
  customer_id: string | null
  customer_external_id: string | null
  contact_name: string | null
  contact_phone_e164: string | null
  contact_email: string | null
  status: NormalizedCart['status']
  currency: string | null
  total: number | null
  items_count: number
  items_summary: string | null
  abandoned_at: string | null
  recovered_order_external_id: string | null
  provider_updated_at: string | null
  created_at: string
  updated_at: string
}

export const CART_COLUMNS =
  'id, org_id, connection_id, external_id, customer_id, customer_external_id, contact_name, contact_phone_e164, contact_email, status, currency, total, items_count, items_summary, abandoned_at, recovered_order_external_id, provider_updated_at, created_at, updated_at'

export async function upsertCarts(db: SupabaseClient, ctx: MirrorContext, carts: NormalizedCart[]): Promise<CartRow[]> {
  const out: CartRow[] = []
  const now = new Date().toISOString()
  for (const part of chunk(carts, 100)) {
    const customers = await resolveCustomerIds(db, ctx.connectionId, part.map((c) => c.customerExternalId).filter((v): v is string => !!v))
    const rows = part.map((c) => ({
      org_id: ctx.orgId,
      connection_id: ctx.connectionId,
      external_id: c.externalId,
      customer_id: c.customerExternalId ? (customers.get(c.customerExternalId) ?? null) : null,
      customer_external_id: text(c.customerExternalId, 128),
      contact_name: text(c.contactName, 200),
      contact_phone_e164: normalizeStorePhone(c.contactPhoneRaw, ctx.country),
      contact_email: text(c.contactEmail, 320)?.toLowerCase() ?? null,
      status: c.status,
      currency: text(c.currency, 8),
      total: num(c.total),
      items_count: c.items.length,
      items_summary: itemsSummary(c.items),
      abandoned_at: c.abandonedAt,
      recovered_order_external_id: text(c.recoveredOrderExternalId, 128),
      provider_updated_at: c.providerUpdatedAt,
      synced_at: now,
      metadata: c.metadata ?? {},
    }))
    const { data, error } = await db.from('commerce_carts').upsert(rows, { onConflict: 'connection_id,external_id' }).select(CART_COLUMNS)
    if (error) throw new Error(`commerce_carts upsert failed: ${error.message}`)
    out.push(...((data ?? []) as CartRow[]))
  }
  return out
}

export async function deleteMirrorRow(db: SupabaseClient, table: 'commerce_products' | 'commerce_orders' | 'commerce_customers', connectionId: string, externalId: string): Promise<void> {
  const { error } = await db.from(table).delete().eq('connection_id', connectionId).eq('external_id', externalId)
  if (error) throw new Error(`${table} delete failed: ${error.message}`)
}

// ─── Customers / do-not-call ─────────────────────────────────────────────────

export interface CustomerRow {
  id: string
  org_id: string
  connection_id: string
  external_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone_e164: string | null
  do_not_call: boolean
  do_not_call_reason: string | null
  do_not_call_source: 'customer_opt_out' | 'operator' | 'provider' | null
  do_not_call_at: string | null
  orders_count: number | null
  updated_at: string
}

export const CUSTOMER_COLUMNS = 'id, org_id, connection_id, external_id, email, first_name, last_name, phone_e164, do_not_call, do_not_call_reason, do_not_call_source, do_not_call_at, orders_count, updated_at'

/** True when any customer of the connection with this number asked not to be called. */
export async function isPhoneSuppressed(db: SupabaseClient, connectionId: string, phoneE164: string): Promise<boolean> {
  const { count, error } = await db.from('commerce_customers').select('id', { count: 'exact', head: true }).eq('connection_id', connectionId).eq('phone_e164', phoneE164).eq('do_not_call', true)
  if (error) throw new Error(`commerce_customers read failed: ${error.message}`)
  return (count ?? 0) > 0
}

/**
 * Marks a customer (by id, or by phone for guest orders: a synthetic
 * `phone:<e164>` customer keeps the suppression visible in the list) as
 * do-not-call. Idempotent.
 */
export async function markDoNotCall(
  db: SupabaseClient,
  input: { orgId: string; connectionId: string; customerId?: string | null; phoneE164?: string | null; reason: string | null; source: 'customer_opt_out' | 'operator' | 'provider' },
): Promise<CustomerRow | null> {
  const patch = { do_not_call: true, do_not_call_reason: input.reason?.slice(0, 200) ?? null, do_not_call_source: input.source, do_not_call_at: new Date().toISOString() }
  let found: CustomerRow | null = null
  if (input.customerId) {
    const { data, error } = await db.from('commerce_customers').update(patch).eq('id', input.customerId).eq('org_id', input.orgId).select(CUSTOMER_COLUMNS).maybeSingle()
    if (error) throw new Error(`commerce_customers update failed: ${error.message}`)
    found = (data as CustomerRow | null) ?? null
  }
  if (!input.phoneE164) return found
  // The number itself is always suppressed as well: a run dials the order's
  // contact phone, which may differ from (or be missing on) the customer
  // profile, and a later guest order with the same number must not be called.
  // Every mirrored customer with this number, then a synthetic row so guests
  // are covered too (not needed when the customer found already carries it).
  const { error: byPhoneErr } = await db.from('commerce_customers').update(patch).eq('connection_id', input.connectionId).eq('phone_e164', input.phoneE164).eq('do_not_call', false)
  if (byPhoneErr) throw new Error(`commerce_customers update failed: ${byPhoneErr.message}`)
  if (found?.phone_e164 === input.phoneE164) return found
  const { data, error } = await db
    .from('commerce_customers')
    .upsert(
      { org_id: input.orgId, connection_id: input.connectionId, external_id: `phone:${input.phoneE164}`, phone_e164: input.phoneE164, phone_raw: input.phoneE164, synced_at: new Date().toISOString(), ...patch },
      { onConflict: 'connection_id,external_id' },
    )
    .select(CUSTOMER_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(`commerce_customers upsert failed: ${error.message}`)
  return found ?? ((data as CustomerRow | null) ?? null)
}

export async function clearDoNotCall(db: SupabaseClient, input: { orgId: string; customerId: string }): Promise<CustomerRow | null> {
  const { data, error } = await db
    .from('commerce_customers')
    .update({ do_not_call: false, do_not_call_reason: null, do_not_call_source: null, do_not_call_at: null })
    .eq('id', input.customerId)
    .eq('org_id', input.orgId)
    .select(CUSTOMER_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(`commerce_customers update failed: ${error.message}`)
  return (data as CustomerRow | null) ?? null
}

// ─── DTO mappers ─────────────────────────────────────────────────────────────

function maskEmail(email: string | null): string | null {
  if (!email) return null
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  return `${user.slice(0, 2)}***@${domain}`
}

export function customerDto(row: CustomerRow): CustomerListDto {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
  return {
    id: row.id,
    name: name || (row.external_id.startsWith('phone:') ? 'Client fără cont' : `Client ${row.external_id.slice(0, 12)}`),
    email_masked: maskEmail(row.email),
    phone_masked: row.phone_e164 ? maskPhone(row.phone_e164) : null,
    has_phone: !!row.phone_e164,
    do_not_call: row.do_not_call,
    do_not_call_at: row.do_not_call_at,
    do_not_call_source: row.do_not_call_source,
    orders_count: row.orders_count,
    updated_at: row.updated_at,
  }
}

export function orderDto(row: OrderRow): OrderListDto {
  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    financial_status: row.financial_status,
    fulfillment_status: row.fulfillment_status,
    is_cod: row.is_cod,
    payment_method_title: row.payment_method_title ?? row.payment_method,
    currency: row.currency,
    total: row.total === null ? null : Number(row.total),
    items_count: row.items_count,
    items_summary: row.items_summary,
    contact_name: row.contact_name,
    contact_phone_masked: row.contact_phone_e164 ? maskPhone(row.contact_phone_e164) : null,
    shipping_city: row.shipping_city,
    provider_created_at: row.provider_created_at,
    updated_at: row.updated_at,
  }
}

export interface ProductRow {
  id: string
  name: string
  sku: string | null
  status: ProductListDto['status']
  price: number | null
  currency: string | null
  stock_status: ProductListDto['stock_status']
  stock_quantity: number | null
  updated_at: string
}
export const PRODUCT_COLUMNS = 'id, name, sku, status, price, currency, stock_status, stock_quantity, updated_at'

export function productDto(row: ProductRow): ProductListDto {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    status: row.status,
    price: row.price === null ? null : Number(row.price),
    currency: row.currency,
    stock_status: row.stock_status,
    stock_quantity: row.stock_quantity,
    updated_at: row.updated_at,
  }
}

// ─── Automation runs ─────────────────────────────────────────────────────────

export interface RunRow {
  id: string
  org_id: string
  automation_id: string
  connection_id: string
  automation_type: AutomationType
  order_id: string | null
  customer_id: string | null
  cart_id: string | null
  external_ref: string
  event_key: string
  idempotency_key: string
  status: RunStatus
  eligibility_reason: string | null
  to_phone_e164: string | null
  scheduled_for: string | null
  attempt: number
  max_attempts: number
  lease_owner: string | null
  lease_until: string | null
  call_id: string | null
  provider_call_ref: string | null
  dispatch_uncertain: boolean
  outcome: RunOutcome | null
  outcome_detail: string | null
  summary: string | null
  error_code: string | null
  error_message: string | null
  last_attempt_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  /** Embedded by RUN_COLUMNS_WITH_REFS. */
  commerce_orders?: { order_number: string } | Array<{ order_number: string }> | null
  commerce_carts?: { external_id: string } | Array<{ external_id: string }> | null
}

export const RUN_COLUMNS =
  'id, org_id, automation_id, connection_id, automation_type, order_id, customer_id, cart_id, external_ref, event_key, idempotency_key, status, eligibility_reason, to_phone_e164, scheduled_for, attempt, max_attempts, lease_owner, lease_until, call_id, provider_call_ref, dispatch_uncertain, outcome, outcome_detail, summary, error_code, error_message, last_attempt_at, completed_at, created_at, updated_at'
export const RUN_COLUMNS_WITH_REFS = `${RUN_COLUMNS}, commerce_orders!order_id(order_number), commerce_carts!cart_id(external_id)`

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

export function runReference(row: RunRow): string {
  const order = one(row.commerce_orders)
  if (order?.order_number) return `#${order.order_number}`
  if (row.automation_type === 'abandoned_cart') return `coș ${row.external_ref.slice(-6)}`
  return `#${row.external_ref.slice(-8)}`
}

export function runDto(row: RunRow): RunDto {
  return {
    id: row.id,
    automation_id: row.automation_id,
    automation_type: row.automation_type,
    connection_id: row.connection_id,
    status: row.status,
    outcome: row.outcome,
    outcome_detail: row.outcome_detail,
    eligibility_reason: row.eligibility_reason,
    reference: runReference(row),
    order_id: row.order_id,
    customer_id: row.customer_id,
    to_phone_masked: row.to_phone_e164 ? maskPhone(row.to_phone_e164) : null,
    scheduled_for: row.scheduled_for,
    attempt: row.attempt,
    max_attempts: row.max_attempts,
    call_id: row.call_id,
    summary: row.summary,
    error_message: row.error_message,
    last_attempt_at: row.last_attempt_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
  }
}

export const RUN_STATUSES: readonly RunStatus[] = ['eligible', 'scheduled', 'calling', 'completed', 'suppressed', 'skipped', 'failed', 'retry_waiting', 'cancelled']

export async function countRunsByStatus(db: SupabaseClient, filter: { orgId: string; automationId?: string }): Promise<Record<RunStatus, number>> {
  const out = Object.fromEntries(RUN_STATUSES.map((s) => [s, 0])) as Record<RunStatus, number>
  await Promise.all(
    RUN_STATUSES.map(async (status) => {
      let q = db.from('commerce_automation_runs').select('id', { count: 'exact', head: true }).eq('org_id', filter.orgId).eq('status', status)
      if (filter.automationId) q = q.eq('automation_id', filter.automationId)
      const { count, error } = await q
      if (error) throw new Error(`commerce_automation_runs count failed: ${error.message}`)
      out[status] = count ?? 0
    }),
  )
  return out
}

/** Stable key of a run for one automation and one event (unique per automation). */
export function runIdempotencyKey(automationId: string, eventKey: string): string {
  return createHash('sha256').update(`${automationId}:${eventKey}`).digest('hex').slice(0, 48)
}

// ─── Cursor pagination for the read-only lists ───────────────────────────────

export interface PageCursor {
  updated_at: string
  id: string
}

export function encodeCursor(c: PageCursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url')
}

const CURSOR_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** A timestamp as encodeCursor writes it ('Z') or as PostgREST returns a timestamptz ('+00:00'). */
const CURSOR_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/

/**
 * Both values end up spliced into a PostgREST filter expression (applyKeyset),
 * so only a uuid and a plain timestamp are accepted: a tampered cursor starts
 * the list over instead of failing the query or adding predicates.
 */
export function decodeCursor(raw: string | null | undefined): PageCursor | null {
  if (!raw || raw.length > 200) return null
  try {
    const v = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<PageCursor>
    if (typeof v.updated_at === 'string' && typeof v.id === 'string' && CURSOR_UUID_RE.test(v.id) && CURSOR_TIMESTAMP_RE.test(v.updated_at) && Number.isFinite(Date.parse(v.updated_at))) {
      return { updated_at: v.updated_at, id: v.id }
    }
  } catch (err) {
    void err // A malformed cursor starts the list over.
  }
  return null
}
