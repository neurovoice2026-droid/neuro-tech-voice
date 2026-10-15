import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('not used') } }))

import type { ToolCallContext } from '@/lib/voice-tools/call-context'
import { AGENT_A, AUTO_A, CALL_A, CONN_A, CONN_B, NOW, ORG_A, ORG_B, USER_A, asClient, commerceDb, connectionRow, orgRow } from '@/tests/helpers/commerce'
import { getOrderItemsTool, getOrderStatusTool, getProductAvailabilityTool, markDoNotCallTool, namesMatch, recordCallbackRequestTool, recordCodConfirmationTool } from './handlers'

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }
const CALL_B = '77777777-7777-4777-8777-777777777777'

function order(over: Record<string, unknown> = {}) {
  return { id: 'order-1', org_id: ORG_A, connection_id: CONN_A, external_id: '1001', order_number: '1001', customer_id: 'cust-1', contact_name: 'Andreea Popescu', contact_phone_e164: '+40722123456', contact_email: 'a@example.com', shipping_city: 'Cluj-Napoca', shipping_summary: 'Str. Exemplu 1', status: 'processing', financial_status: 'pending', fulfillment_status: 'unfulfilled', is_cod: true, currency: 'RON', total: 189.9, items_count: 1, items_summary: '1 × Tricou', provider_created_at: '2026-10-13T07:30:00Z', updated_at: 'x', ...over }
}

function seed(opts: { campaign?: boolean } = {}) {
  const db = commerceDb({
    organizations: [orgRow(), orgRow(ORG_B, { user_id: 'other', name: 'Alt magazin' })],
    commerce_connections: [connectionRow(), connectionRow({ id: CONN_B, org_id: ORG_B, store_domain: 'other.example.com', webhook_public_id: 'pubid-bbbbbbbbbbbbbbbbbbbbbbbbbbbbb' })],
    commerce_customers: [{ id: 'cust-1', org_id: ORG_A, connection_id: CONN_A, external_id: 'c1', first_name: 'Andreea', last_name: 'Popescu', phone_e164: '+40722123456', do_not_call: false, updated_at: 'x' }],
    commerce_orders: [order(), order({ id: 'order-b', org_id: ORG_B, connection_id: CONN_B, order_number: '5005', external_id: '5005', contact_name: 'Ion Ionescu', contact_phone_e164: '+40733000000' })],
    commerce_order_items: [{ id: 'li-1', org_id: ORG_A, connection_id: CONN_A, order_id: 'order-1', external_id: 'li1', name: 'Tricou bumbac (M)', sku: 'TS-M', quantity: 1, unit_price: 89.9, total: 89.9, created_at: 'x' }],
    commerce_products: [{ id: 'p-1', org_id: ORG_A, connection_id: CONN_A, external_id: 'p1', name: 'Tricou bumbac', sku: 'TS-M', status: 'active', price: 89.9, currency: 'RON', stock_status: 'in_stock', stock_quantity: 12, updated_at: 'x' }],
    commerce_automations: [{ id: AUTO_A, org_id: ORG_A, connection_id: CONN_A, type: 'cod_confirmation', enabled: true }],
    commerce_automation_runs: opts.campaign ? [{ id: 'run-1', org_id: ORG_A, automation_id: AUTO_A, connection_id: CONN_A, automation_type: 'cod_confirmation', order_id: 'order-1', customer_id: 'cust-1', cart_id: null, external_ref: '1001', event_key: 'order:1001', idempotency_key: 'k1', status: 'calling', to_phone_e164: '+40722123456', attempt: 1, max_attempts: 2, call_id: CALL_A, outcome: null, created_at: 'x', updated_at: 'x' }] : [],
    calls: [
      { id: CALL_A, org_id: ORG_A, commerce_run_id: opts.campaign ? 'run-1' : null },
      { id: CALL_B, org_id: ORG_B, commerce_run_id: null },
    ],
  })
  return db
}

function ctx(db: ReturnType<typeof seed>, over: Partial<ToolCallContext['call']> = {}, org: 'A' | 'B' = 'A'): ToolCallContext {
  const orgId = org === 'A' ? ORG_A : ORG_B
  return {
    call: { id: org === 'A' ? CALL_A : CALL_B, org_id: orgId, agent_id: AGENT_A, direction: 'inbound', status: 'in-progress', provider: 'elevenlabs', from_number: '+40799000000', to_number: '+40310000001', caller_number: '+40799000000', ended_at: null, is_test: false, ...over },
    org: { id: orgId, name: 'Magazinul Exemplu', timezone: 'Europe/Bucharest', userId: USER_A },
    agent: { id: AGENT_A, name: 'Maria', language: 'ro', workingHours: null, booking: { enabled: false } as never, messages: { enabled: false } as never },
    callerPhone: over.from_number === null ? null : (over.from_number ?? '+40799000000'),
    businessPhone: '+40310000001',
    now: NOW,
    db: asClient(db),
  }
}

describe('store tools: identification and tenancy', () => {
  it('on an inbound call asks for the order number, then rejects a wrong name and never leaks that the order exists', async () => {
    const db = seed()
    expect(await getOrderStatusTool(ctx(db), {}, log)).toMatchObject({ ok: false, message: expect.stringContaining('order number') })
    const wrong = await getOrderStatusTool(ctx(db), { order_number: '1001', customer_name: 'Vasile Ion' }, log)
    expect(wrong.ok).toBe(false)
    expect(JSON.stringify(wrong)).not.toContain('Popescu')
    const right = await getOrderStatusTool(ctx(db), { order_number: '#1001', customer_name: 'popescu andreea' }, log)
    expect(right).toMatchObject({ ok: true, order: { order_number: '1001', payment: 'plata ramburs la livrare', delivery_city: 'Cluj-Napoca' } })
  })

  it('accepts the caller number as identification, and never finds another organization\'s order', async () => {
    const db = seed()
    const byPhone = await getOrderStatusTool(ctx(db, { from_number: '+40722123456', caller_number: '+40722123456' }), { order_number: '1001' }, log)
    expect(byPhone.ok).toBe(true)
    // Org B's order number, asked on org A's call with org B's customer name: not found.
    const cross = await getOrderStatusTool(ctx(db), { order_number: '5005', customer_name: 'Ion Ionescu' }, log)
    expect(cross.ok).toBe(false)
    expect(JSON.stringify(cross)).not.toContain('Ionescu')
    // Org B's own call cannot read org A's order either (different connection).
    const crossB = await getOrderStatusTool(ctx(db, {}, 'B'), { order_number: '1001', customer_name: 'Andreea Popescu' }, log)
    expect(crossB.ok).toBe(false)
  })

  it('on an inbound call a first name alone never identifies the order, whether or not it exists', async () => {
    const db = seed()
    // Sequential order numbers + a common first name must not disclose someone else's order.
    const firstName = await getOrderStatusTool(ctx(db), { order_number: '1001', customer_name: 'Andreea' }, log)
    expect(firstName).toMatchObject({ ok: false, message: expect.stringContaining('full name') })
    expect(JSON.stringify(firstName)).not.toContain('Popescu')
    expect(JSON.stringify(firstName)).not.toContain('Cluj')
    // The same answer when the first name is not even the one on the order (no existence oracle).
    expect(await getOrderStatusTool(ctx(db), { order_number: '1001', customer_name: 'Ion' }, log)).toEqual(firstName)
    // The caller's own number still identifies the order without a full name.
    expect(await getOrderStatusTool(ctx(db, { from_number: '+40722123456', caller_number: '+40722123456' }), { order_number: '1001', customer_name: 'Andreea' }, log)).toMatchObject({ ok: true })
  })

  it('on an inbound call get_order_items identifies the order like get_order_status and never leaks items otherwise', async () => {
    const db = seed()
    const id = { order_number: '1001', customer_name: 'Andreea Popescu' }
    expect(await getOrderStatusTool(ctx(db), id, log)).toMatchObject({ ok: true, order: { order_number: '1001' } })
    // Nothing is persisted between tool calls: the items tool takes the same identification.
    expect(await getOrderItemsTool(ctx(db), id, log)).toMatchObject({ ok: true, items: [{ name: 'Tricou bumbac (M)', quantity: 1, unit_price: '89,90 lei' }] })
    expect(await getOrderItemsTool(ctx(db, { from_number: '+40722123456', caller_number: '+40722123456' }), { order_number: '#1001' }, log)).toMatchObject({ ok: true, items: [{ name: 'Tricou bumbac (M)' }] })
    expect(await getOrderItemsTool(ctx(db), {}, log)).toMatchObject({ ok: false, message: expect.stringContaining('order number') })
    for (const args of [{ order_number: '1001', customer_name: 'Vasile Ion' }, { order_number: '1001', customer_name: 'Andreea' }, { order_number: '1001' }]) {
      const denied = await getOrderItemsTool(ctx(db), args, log)
      expect(denied.ok).toBe(false)
      expect(JSON.stringify(denied)).not.toContain('Tricou')
      expect(JSON.stringify(denied)).not.toContain('Popescu')
    }
    expect(await getOrderItemsTool(ctx(db, {}, 'B'), id, log)).toMatchObject({ ok: false })
  })

  it('on a campaign call the order comes from the run (no arguments), and items/products are read-only', async () => {
    const db = seed({ campaign: true })
    const status = await getOrderStatusTool(ctx(db, { direction: 'outbound', to_number: '+40722123456', from_number: '+40310000001' }), {}, log)
    expect(status).toMatchObject({ ok: true, order: { order_number: '1001' } })
    const items = await getOrderItemsTool(ctx(db), {}, log)
    expect(items).toMatchObject({ ok: true, items: [{ name: 'Tricou bumbac (M)', quantity: 1, unit_price: '89,90 lei' }] })
    const products = await getProductAvailabilityTool(ctx(db), { query: 'tricou' }, log)
    expect(products).toMatchObject({ ok: true, products: [{ name: 'Tricou bumbac', availability: 'în stoc', price: '89,90 lei' }] })
    db.tables.commerce_products = []
    expect(await getProductAvailabilityTool(ctx(db), { query: 'inexistent' }, log)).toMatchObject({ ok: false })
    expect(await getProductAvailabilityTool(ctx(db), { query: '' }, log)).toMatchObject({ ok: false })
    expect(db.tables.commerce_orders[0]).toMatchObject({ status: 'processing' })
  })

  it('refuses a COD confirmation outside a campaign call, records it once on the run, and is idempotent', async () => {
    const inbound = seed()
    expect(await recordCodConfirmationTool(ctx(inbound), { confirmed: true }, log)).toMatchObject({ ok: false })
    const db = seed({ campaign: true })
    const first = await recordCodConfirmationTool(ctx(db), { confirmed: 'true' }, log)
    expect(first.ok).toBe(true)
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ outcome: 'confirmed' })
    const again = await recordCodConfirmationTool(ctx(db), { confirmed: 'true' }, log)
    expect(again).toEqual(first)
    expect(db.tables.tool_invocations).toHaveLength(1)
    expect(await recordCodConfirmationTool(ctx(db), {}, log)).toMatchObject({ ok: false, message: expect.stringContaining('confirmed') })
  })

  it('mark_do_not_call suppresses the customer, cancels queued runs and records the opt-out', async () => {
    const db = seed({ campaign: true })
    db.tables.commerce_automation_runs.push({ id: 'run-2', org_id: ORG_A, automation_id: AUTO_A, connection_id: CONN_A, automation_type: 'order_follow_up', order_id: 'order-1', customer_id: 'cust-1', external_ref: '1001', event_key: 'order:1001:fulfilled', idempotency_key: 'k2', status: 'scheduled', to_phone_e164: '+40722123456', created_at: 'x', updated_at: 'x' })
    const res = await markDoNotCallTool(ctx(db, { direction: 'outbound', to_number: '+40722123456' }), { reason: 'nu mă mai sunați' }, log)
    expect(res.ok).toBe(true)
    expect(db.tables.commerce_customers[0]).toMatchObject({ do_not_call: true, do_not_call_source: 'customer_opt_out' })
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ outcome: 'opted_out' })
    expect(db.tables.commerce_automation_runs[1]).toMatchObject({ status: 'cancelled' })
    expect(db.tables.commerce_audit_log.some((a) => a.action === 'suppression.added')).toBe(true)
    const callback = await recordCallbackRequestTool(ctx(db), { reason: 'Vrea să schimbe adresa', preferred_time: 'mâine după 14' }, log)
    expect(callback.ok).toBe(true)
    expect(db.tables.commerce_audit_log.some((a) => a.action === 'callback.requested' && String((a.metadata as Record<string, unknown>).detail).includes('mâine după 14'))).toBe(true)
  })

  it('record_callback_request labels the preferred time in English for the merchant, keeping the customer\'s words', async () => {
    const db = seed({ campaign: true })
    const res = await recordCallbackRequestTool(ctx(db), { reason: 'Vrea să schimbe adresa', preferred_time: 'mâine după 14' }, log)
    expect(res.ok).toBe(true)
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ outcome: 'callback_requested', outcome_detail: 'Vrea să schimbe adresa · Preferred time: mâine după 14' })
    const audit = db.tables.commerce_audit_log.find((a) => a.action === 'callback.requested')
    expect((audit?.metadata as Record<string, unknown>).detail).toBe('Vrea să schimbe adresa · Preferred time: mâine după 14')
    expect(JSON.stringify(db.tables)).not.toContain('Preferă')
  })

  it('answers safely when the organization has no store', async () => {
    const db = seed()
    db.tables.commerce_connections = []
    expect(await getOrderStatusTool(ctx(db), { order_number: '1001' }, log)).toMatchObject({ ok: false, message: expect.stringContaining('not available') })
  })

  it('matches names loosely but never on a single token of a longer name', () => {
    expect(namesMatch('popescu andreea', 'Andreea Popescu')).toBe(true)
    expect(namesMatch('Andreea-Maria Popescu', 'Andreea Popescu')).toBe(true)
    expect(namesMatch('Ana Popescu', 'Ana Maria Popescu')).toBe(true)
    expect(namesMatch('Andreea', 'Andreea Popescu')).toBe(false)
    expect(namesMatch('Popescu', 'Andreea Popescu')).toBe(false)
    expect(namesMatch('Popescu Popescu', 'Andreea Popescu')).toBe(false)
    expect(namesMatch('Ion', 'Andreea Popescu')).toBe(false)
    expect(namesMatch('', 'Andreea Popescu')).toBe(false)
    expect(namesMatch('Ion Popescu', 'Andreea Popescu')).toBe(false)
    // A stored name of a single token can only match on that token.
    expect(namesMatch('Madonna', 'Madonna')).toBe(true)
    expect(namesMatch('Ion', 'Madonna')).toBe(false)
  })
})
