// Test fixtures of the e-commerce vertical: ids, rows, a fake adapter and an
// in-memory database with the uniqueness rules of migration 024 and the
// claim functions implemented in memory.

import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import type { CommerceAdapter, SyncBatch, VerifiedCommerceEvent, VerificationFailure } from '@/lib/commerce/adapters/types'
import type { CommerceCapabilities, CommerceEvent, NormalizedOrder } from '@/lib/commerce/types'

export const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
export const CONN_A = '11111111-1111-4111-8111-111111111111'
export const CONN_B = '22222222-2222-4222-8222-222222222222'
export const AUTO_A = '33333333-3333-4333-8333-333333333333'
export const AGENT_A = '44444444-4444-4444-8444-444444444444'
export const CALL_A = '55555555-5555-4555-8555-555555555555'
export const USER_A = '66666666-6666-4666-8666-666666666666'
export const PUBLIC_ID_A = 'pubid-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
/** Tuesday 13 October 2026, 11:00 in Bucharest. */
export const NOW = new Date('2026-10-13T08:00:00Z')

export const CAPS_FULL: CommerceCapabilities = { products: true, customers: true, orders: true, webhooks: true, abandoned_carts: true, customer_phone: true, polling_minutes: null, notes: [] }

export function orgRow(id = ORG_A, over: Record<string, unknown> = {}) {
  return { id, user_id: USER_A, name: 'Magazinul Exemplu', timezone: 'Europe/Bucharest', plan: 'pro', minutes_used: 0, minutes_limit: 1000, business_type: 'ecommerce', commerce_profile: { display_name: 'Magazinul Exemplu', country: 'RO', timezone: 'Europe/Bucharest', language: 'ro', currency: 'RON' }, onboarding_step: 6, onboarding_completed: true, deletion_requested_at: null, ...over }
}

export function connectionRow(over: Record<string, unknown> = {}) {
  return {
    id: CONN_A,
    org_id: ORG_A,
    platform: 'woocommerce',
    store_url: 'https://shop.example.com',
    store_domain: 'shop.example.com',
    display_name: 'Shop',
    status: 'active',
    capabilities: CAPS_FULL,
    encrypted_credentials: null,
    credential_key_version: null,
    webhook_config: {},
    webhook_public_id: PUBLIC_ID_A,
    sync_cursor: {},
    last_sync_at: null,
    last_successful_sync_at: '2026-10-13T07:00:00Z',
    error_code: null,
    error_message: null,
    connected_at: '2026-10-01T00:00:00Z',
    disconnected_at: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...over,
  }
}

export function automationRow(over: Record<string, unknown> = {}) {
  return {
    id: AUTO_A,
    org_id: ORG_A,
    connection_id: CONN_A,
    agent_id: AGENT_A,
    type: 'cod_confirmation',
    enabled: true,
    enabled_at: '2026-10-01T00:00:00Z',
    config: {},
    script: {},
    consent_confirmed_at: '2026-10-01T00:00:00Z',
    consent_confirmed_by: USER_A,
    consent_version: '2026-10-v1',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...over,
  }
}

export function normalizedOrder(over: Partial<NormalizedOrder> = {}): NormalizedOrder {
  return {
    externalId: '1001',
    orderNumber: '1001',
    customerExternalId: 'c1',
    contactName: 'Andreea Popescu',
    contactPhoneRaw: '0722 123 456',
    contactEmail: 'andreea@example.com',
    shippingCity: 'Cluj-Napoca',
    shippingCountry: 'RO',
    shippingSummary: 'Str. Exemplu 1, Cluj-Napoca',
    status: 'processing',
    financialStatus: 'pending',
    fulfillmentStatus: 'unfulfilled',
    paymentMethod: 'cod',
    paymentMethodTitle: 'Plata ramburs',
    currency: 'RON',
    total: 189.9,
    items: [{ externalId: 'li1', productExternalId: 'p1', sku: 'TS-M', name: 'Tricou bumbac (M)', quantity: 1, unitPrice: 89.9, total: 89.9 }, { externalId: 'li2', productExternalId: 'p2', sku: 'SO', name: 'Șosete sport', quantity: 2, unitPrice: 50, total: 100 }],
    providerCreatedAt: '2026-10-13T07:30:00Z',
    providerUpdatedAt: '2026-10-13T07:30:00Z',
    payloadHash: 'h1',
    ...over,
  }
}

/** Bumps updated_at like the DB trigger. */
function touch(_table: string, row: Record<string, unknown>) {
  row.updated_at = new Date().toISOString()
}

/** In-memory implementation of the service-only claim functions (FOR UPDATE SKIP LOCKED semantics by status). */
function claims(fn: string, args: unknown, tables: Record<string, Record<string, unknown>[]>) {
  const a = args as { p_owner: string; p_limit: number; p_lease_seconds: number }
  const now = Date.now()
  const until = new Date(now + a.p_lease_seconds * 1000).toISOString()
  if (fn === 'commerce_claim_sync_jobs') {
    const rows = (tables.commerce_sync_jobs ?? []).filter((j) => (j.status === 'pending' && Date.parse(String(j.run_after)) <= now) || (j.status === 'running' && typeof j.lease_until === 'string' && Date.parse(j.lease_until) < now)).slice(0, a.p_limit)
    for (const j of rows) Object.assign(j, { status: 'running', lease_owner: a.p_owner, lease_until: until, attempts: Number(j.attempts ?? 0) + 1, started_at: j.started_at ?? new Date(now).toISOString() })
    return { data: rows.map((r) => ({ ...r })), error: null }
  }
  if (fn === 'commerce_claim_webhook_events') {
    const rows = (tables.commerce_webhook_events ?? []).filter((e) => e.verified === true && ((e.status === 'received' && Date.parse(String(e.run_after ?? 0)) <= now) || (e.status === 'processing' && typeof e.lease_until === 'string' && Date.parse(e.lease_until) < now))).slice(0, a.p_limit)
    for (const e of rows) Object.assign(e, { status: 'processing', lease_owner: a.p_owner, lease_until: until, attempts: Number(e.attempts ?? 0) + 1 })
    return { data: rows.map((r) => ({ ...r })), error: null }
  }
  if (fn === 'commerce_claim_automation_runs') {
    const rows = (tables.commerce_automation_runs ?? []).filter((r) => (r.status === 'scheduled' || r.status === 'retry_waiting') && typeof r.scheduled_for === 'string' && Date.parse(r.scheduled_for) <= now).slice(0, a.p_limit)
    for (const r of rows) Object.assign(r, { status: 'calling', lease_owner: a.p_owner, lease_until: until, attempt: Number(r.attempt ?? 0) + 1, last_attempt_at: new Date(now).toISOString() })
    return { data: rows.map((r) => ({ ...r })), error: null }
  }
  return { data: null, error: { message: `unknown rpc ${fn}` } }
}

export function commerceDb(initial: Parameters<typeof memoryDb>[0] = {}): MemoryDb {
  return memoryDb(initial, {
    onUpdate: touch,
    rpc: claims,
    unique: {
      commerce_connections: [['id'], ['webhook_public_id'], ['org_id', 'platform', 'store_domain']],
      // The partial unique index (one queued/running job per connection and resource) approximated for tests.
      commerce_sync_jobs: [['id'], ['connection_id', 'resource']],
      commerce_webhook_events: [['id'], ['connection_id', 'dedupe_key']],
      commerce_products: [['id'], ['connection_id', 'external_id']],
      commerce_customers: [['id'], ['connection_id', 'external_id']],
      commerce_orders: [['id'], ['connection_id', 'external_id']],
      commerce_order_items: [['id'], ['order_id', 'external_id']],
      commerce_carts: [['id'], ['connection_id', 'external_id']],
      commerce_automations: [['id'], ['connection_id', 'type']],
      commerce_automation_runs: [['id'], ['idempotency_key']],
      tool_invocations: [['id'], ['call_id', 'tool', 'idempotency_key']],
    },
  })
}

export const asClient = (db: MemoryDb) => db as unknown as SupabaseClient

/** Rows the memory DB inserted get defaults the real table would give. */
export function withRunDefaults(db: MemoryDb) {
  const insert = db.from
  void insert
  return db
}

export interface FakeAdapterOptions {
  verify?: (raw: Uint8Array, headers: Headers) => VerifiedCommerceEvent | VerificationFailure
  normalize?: (event: VerifiedCommerceEvent) => CommerceEvent[]
  pages?: Record<string, SyncBatch[]>
  capabilities?: CommerceCapabilities
}

/** An adapter whose behaviour the test controls; every method is a spy. */
export function fakeAdapter(opts: FakeAdapterOptions = {}): CommerceAdapter & { calls: Record<string, number> } {
  const calls: Record<string, number> = {}
  const count = (k: string) => (calls[k] = (calls[k] ?? 0) + 1)
  const pages = { ...(opts.pages ?? {}) }
  return {
    platform: 'woocommerce',
    calls,
    getCapabilities: () => opts.capabilities ?? CAPS_FULL,
    validateConnection: vi.fn(async () => {
      count('validate')
      return { storeUrl: 'https://shop.example.com', storeDomain: 'shop.example.com', displayName: 'Shop', currency: 'RON', countryCode: 'RO', timezone: 'Europe/Bucharest', language: 'ro', platformVersion: '9.0', capabilities: opts.capabilities ?? CAPS_FULL, secrets: { consumer_key: 'ck', consumer_secret: 'cs', webhook_secret: 'whs' } }
    }),
    registerWebhooks: vi.fn(async () => {
      count('register')
      return [{ topic: 'order.created', externalId: 'wh1', source: 'api' as const }]
    }),
    unregisterWebhooks: vi.fn(async () => {
      count('unregister')
    }),
    syncPage: vi.fn(async (_c, resource, checkpoint) => {
      count(`sync:${resource}`)
      const list = pages[resource] ?? []
      const idx = checkpoint.cursor ? Number(checkpoint.cursor) : 0
      const batch = list[idx]
      if (!batch) return { resource, checkpoint: { cursor: null, modifiedAfter: checkpoint.modifiedAfter, pages: checkpoint.pages + 1 }, done: true }
      return { ...batch, checkpoint: { cursor: idx + 1 < list.length ? String(idx + 1) : null, modifiedAfter: checkpoint.modifiedAfter, pages: checkpoint.pages + 1 }, done: idx + 1 >= list.length }
    }),
    verifyWebhook: vi.fn(async (req) => {
      count('verify')
      return opts.verify ? opts.verify(req.rawBody, req.headers) : { ok: false as const, reason: 'bad_signature' as const, status: 401 as const }
    }),
    normalizeEvent: vi.fn((event) => {
      count('normalize')
      return opts.normalize ? opts.normalize(event) : []
    }),
    fetchOrder: vi.fn(async () => null),
    fetchCustomer: vi.fn(async () => null),
    fetchProduct: vi.fn(async () => null),
  }
}
