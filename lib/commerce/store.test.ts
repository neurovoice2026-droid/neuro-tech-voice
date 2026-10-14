import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('not used') } }))

import { CONN_A, CONN_B, ORG_A, ORG_B, asClient, commerceDb, connectionRow, normalizedOrder } from '@/tests/helpers/commerce'
import { parsePostgrestList } from '@/tests/helpers/memory-db'
import { connectionDto, decodeCursor, encodeCursor, encryptedSecretsFor, isCodPayment, isPhoneSuppressed, markDoNotCall, toAdapterConnection, upsertCustomers, upsertOrders } from './store'

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }
void log

beforeEach(() => {
  vi.stubEnv('COMMERCE_CREDENTIALS_ENCRYPTION_KEY', crypto.randomBytes(32).toString('base64'))
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://app.example.com')
})

describe('mirror upserts', () => {
  it('keeps the same external id apart per connection (tenant boundary) and reports created vs changed', async () => {
    const db = commerceDb({})
    const a = { orgId: ORG_A, connectionId: CONN_A, country: 'RO' }
    const b = { orgId: ORG_B, connectionId: CONN_B, country: 'RO' }
    const first = await upsertOrders(asClient(db), a, [normalizedOrder()], ['cod'])
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ created: true, changed: true })
    expect(first[0].row).toMatchObject({ org_id: ORG_A, connection_id: CONN_A, is_cod: true, contact_phone_e164: '+40722123456', items_count: 2 })
    expect(first[0].row.items_summary).toContain('Tricou bumbac')
    const other = await upsertOrders(asClient(db), b, [normalizedOrder()], ['cod'])
    expect(other[0].row.org_id).toBe(ORG_B)
    expect(db.tables.commerce_orders).toHaveLength(2)
    // Same payload again: not created, not changed. A new status: changed with the previous status.
    const again = await upsertOrders(asClient(db), a, [normalizedOrder()], ['cod'])
    expect(again[0]).toMatchObject({ created: false, changed: false })
    const moved = await upsertOrders(asClient(db), a, [normalizedOrder({ status: 'cancelled', payloadHash: 'h2' })], ['cod'])
    expect(moved[0]).toMatchObject({ created: false, changed: true, previousStatus: 'processing' })
    expect(db.tables.commerce_orders.filter((o) => o.connection_id === CONN_A)).toHaveLength(1)
    expect(db.tables.commerce_order_items.filter((i) => i.connection_id === CONN_A)).toHaveLength(2)
  })

  it('never undoes a do-not-call flag when a customer is re-imported', async () => {
    const db = commerceDb({})
    const ctx = { orgId: ORG_A, connectionId: CONN_A, country: 'RO' }
    const customer = { externalId: 'c1', email: 'A@Example.com', firstName: 'Ana', lastName: 'Pop', phoneRaw: '0722123456', countryCode: null, marketingConsent: null, callConsent: null, ordersCount: 2, totalSpent: 10, providerCreatedAt: null, providerUpdatedAt: null }
    const refs = await upsertCustomers(asClient(db), ctx, [customer])
    expect(refs.get('c1')).toMatchObject({ phone_e164: '+40722123456' })
    const row = db.tables.commerce_customers[0]
    expect(row.email).toBe('a@example.com')
    expect(row.do_not_call ?? false).toBe(false)
    await markDoNotCall(asClient(db), { orgId: ORG_A, connectionId: CONN_A, customerId: String(row.id), phoneE164: '+40722123456', reason: 'nu mă mai sunați', source: 'customer_opt_out' })
    expect(db.tables.commerce_customers[0].do_not_call).toBe(true)
    await upsertCustomers(asClient(db), ctx, [{ ...customer, firstName: 'Ana-Maria' }])
    expect(db.tables.commerce_customers[0]).toMatchObject({ first_name: 'Ana-Maria', do_not_call: true, do_not_call_source: 'customer_opt_out' })
  })

  it('suppresses a guest by number with a synthetic customer row', async () => {
    const db = commerceDb({})
    const row = await markDoNotCall(asClient(db), { orgId: ORG_A, connectionId: CONN_A, customerId: null, phoneE164: '+40722999999', reason: null, source: 'customer_opt_out' })
    expect(row).toMatchObject({ external_id: 'phone:+40722999999', do_not_call: true, phone_e164: '+40722999999' })
  })

  it('suppresses the dialed number even when the customer row is found but carries another (or no) phone', async () => {
    const db = commerceDb({
      commerce_customers: [
        { id: 'c-nophone', org_id: ORG_A, connection_id: CONN_A, external_id: 'c1', phone_e164: null, do_not_call: false, updated_at: 'x' },
        { id: 'c-other', org_id: ORG_A, connection_id: CONN_A, external_id: 'c2', phone_e164: '+40733999999', do_not_call: false, updated_at: 'x' },
      ],
    })
    // Customer without a profile phone, reached on the order's contact number.
    const found = await markDoNotCall(asClient(db), { orgId: ORG_A, connectionId: CONN_A, customerId: 'c-nophone', phoneE164: '+40722123456', reason: 'nu mă mai sunați', source: 'customer_opt_out' })
    expect(found).toMatchObject({ id: 'c-nophone', do_not_call: true })
    expect(await isPhoneSuppressed(asClient(db), CONN_A, '+40722123456')).toBe(true)
    expect(db.tables.commerce_customers.filter((c) => c.external_id === 'phone:+40722123456')).toHaveLength(1)
    // Customer whose profile phone differs from the dialed one: both numbers end up suppressed.
    await markDoNotCall(asClient(db), { orgId: ORG_A, connectionId: CONN_A, customerId: 'c-other', phoneE164: '+40744000000', reason: null, source: 'customer_opt_out' })
    expect(await isPhoneSuppressed(asClient(db), CONN_A, '+40744000000')).toBe(true)
    expect(await isPhoneSuppressed(asClient(db), CONN_A, '+40733999999')).toBe(true)
    // Idempotent, and no synthetic row when the customer already carries the number.
    await markDoNotCall(asClient(db), { orgId: ORG_A, connectionId: CONN_A, customerId: 'c-other', phoneE164: '+40733999999', reason: null, source: 'customer_opt_out' })
    expect(db.tables.commerce_customers.filter((c) => c.external_id === 'phone:+40733999999')).toHaveLength(0)
    expect(db.tables.commerce_customers.filter((c) => c.external_id === 'phone:+40744000000')).toHaveLength(1)
  })

  it('keeps line items whose ids contain quotes or backslashes and prunes only the removed ones', async () => {
    expect(parsePostgrestList('("SKU-12\\"","abc\\\\","ab\\"c",plain)')).toEqual(['SKU-12"', 'abc\\', 'ab"c', 'plain'])
    const db = commerceDb({})
    const ctx = { orgId: ORG_A, connectionId: CONN_A, country: 'RO' }
    const items = [
      { externalId: 'SKU-12"', productExternalId: 'p1', sku: 'A', name: 'Unu', quantity: 1, unitPrice: 1, total: 1 },
      { externalId: 'abc\\', productExternalId: 'p2', sku: 'B', name: 'Doi', quantity: 1, unitPrice: 1, total: 1 },
      { externalId: 'ab"c', productExternalId: 'p3', sku: 'C', name: 'Trei', quantity: 1, unitPrice: 1, total: 1 },
    ]
    await upsertOrders(asClient(db), ctx, [normalizedOrder({ items })], ['cod'])
    expect(db.tables.commerce_order_items.map((i) => i.external_id).sort()).toEqual(['SKU-12"', 'ab"c', 'abc\\'])
    await upsertOrders(asClient(db), ctx, [normalizedOrder({ items: items.slice(0, 2), payloadHash: 'h2' })], ['cod'])
    expect(db.tables.commerce_order_items.map((i) => i.external_id).sort()).toEqual(['SKU-12"', 'abc\\'])
  })

  it('detects cash on delivery from platform ids, titles and the merchant list', () => {
    expect(isCodPayment({ paymentMethod: 'cod', paymentMethodTitle: null }, [])).toBe(true)
    expect(isCodPayment({ paymentMethod: 'manual', paymentMethodTitle: 'Plata ramburs la curier' }, [])).toBe(true)
    expect(isCodPayment({ paymentMethod: 'cashondelivery', paymentMethodTitle: null }, [])).toBe(true)
    expect(isCodPayment({ paymentMethod: 'stripe', paymentMethodTitle: 'Card' }, [])).toBe(false)
    // An explicit is_cod from the connector wins over the heuristic in both directions.
    expect(isCodPayment({ paymentMethod: 'ramburs_plus', paymentMethodTitle: 'Ramburs Plus', metadata: { is_cod: false } }, [])).toBe(false)
    expect(isCodPayment({ paymentMethod: 'gateway_7', paymentMethodTitle: 'Metoda 7', metadata: { is_cod: true } }, [])).toBe(true)
    expect(isCodPayment({ paymentMethod: 'cod', paymentMethodTitle: null, metadata: { is_cod: 'nope' } }, [])).toBe(true)
    expect(isCodPayment({ paymentMethod: 'custom_x', paymentMethodTitle: 'Numerar la curier' }, ['custom_x'])).toBe(true)
    expect(isCodPayment({ paymentMethod: null, paymentMethodTitle: null }, ['cod'])).toBe(false)
  })
})

describe('page cursors', () => {
  it('round-trips a real cursor and restarts the list on a tampered one instead of splicing it into the filter', () => {
    const real = { updated_at: '2026-10-13T08:00:00.000Z', id: CONN_A }
    expect(decodeCursor(encodeCursor(real))).toEqual(real)
    // PostgREST's own timestamptz rendering is accepted too.
    expect(decodeCursor(encodeCursor({ updated_at: '2026-10-13T08:00:00.123456+00:00', id: CONN_A }))).not.toBeNull()
    const tampered = [
      { updated_at: '2026-10-13T08:00:00.000Z', id: 'x' },
      { updated_at: '2026-10-13T08:00:00.000Z', id: `${CONN_A}),or(phone_e164.like.+4071*` },
      { updated_at: 'Mon, 13 Oct 2026 08:00:00 GMT', id: CONN_A },
      { updated_at: '2026-10-13T08:00:00.000Z,id.gt.0', id: CONN_A },
    ]
    for (const c of tampered) expect(decodeCursor(encodeCursor(c)), JSON.stringify(c)).toBeNull()
    expect(decodeCursor('not base64 json')).toBeNull()
    expect(decodeCursor(null)).toBeNull()
  })
})

describe('connection DTO and credentials', () => {
  it('never serializes the credential envelope, cursors or webhook ids, and decrypts only for adapters', async () => {
    const base = connectionRow()
    const secrets = { consumer_key: 'ck_live_1', consumer_secret: 'cs_live_2', webhook_secret: 'whs_3' }
    const row = { ...base, ...encryptedSecretsFor({ id: base.id, org_id: base.org_id }, secrets), webhook_config: { registrations: [{ topic: 'order.created', externalId: 'wh_77', source: 'api' }] }, sync_cursor: { orders: { modifiedAfter: 'x' } } }
    const db = commerceDb({ commerce_connections: [row], commerce_orders: [{ id: 'o1', connection_id: CONN_A, org_id: ORG_A, updated_at: 'x' }] })
    const dto = await connectionDto(asClient(db), row as never)
    const text = JSON.stringify(dto)
    for (const needle of ['ck_live_1', 'cs_live_2', 'whs_3', 'encrypted', 'wh_77', 'sync_cursor', 'webhook_public_id', row.webhook_public_id]) expect(text).not.toContain(needle)
    expect(dto.webhook_topics).toEqual(['order.created'])
    expect(dto.counts.orders).toBe(1)
    const adapterConn = toAdapterConnection(row as never)
    expect(adapterConn.secrets).toEqual(secrets)
    expect(adapterConn.webhookUrl).toBe(`https://app.example.com/api/commerce/webhooks/woocommerce/${row.webhook_public_id}`)
    // A blob moved to another connection does not decrypt.
    expect(() => toAdapterConnection({ ...row, id: CONN_B } as never)).toThrow()
  })
})
