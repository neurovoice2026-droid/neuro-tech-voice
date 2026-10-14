import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('not used') } }))

import { AUTO_A, CONN_A, NOW, ORG_A, asClient, automationRow, commerceDb, connectionRow, normalizedOrder, orgRow } from '@/tests/helpers/commerce'
import { applyEvents } from '../events'

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }

function seed(automations: Record<string, unknown>[] = [automationRow()]) {
  return commerceDb({ organizations: [orgRow()], commerce_connections: [connectionRow()], commerce_automations: automations })
}
const runs = (db: ReturnType<typeof seed>) => db.tables.commerce_automation_runs ?? []

describe('scheduler', () => {
  it('schedules one COD run per order, never a duplicate for repeated events', async () => {
    const db = seed()
    const ctx = { db: asClient(db), connection: connectionRow() as never, log, now: NOW }
    await applyEvents(ctx, [{ kind: 'order.created', order: normalizedOrder() }])
    await applyEvents(ctx, [{ kind: 'order.updated', order: normalizedOrder({ payloadHash: 'h2' }) }])
    expect(runs(db)).toHaveLength(1)
    expect(runs(db)[0]).toMatchObject({ status: 'scheduled', scheduled_for: '2026-10-13T08:15:00.000Z', max_attempts: 2 })
    expect(db.tables.commerce_audit_log.some((a) => a.action === 'run.scheduled')).toBe(true)
  })

  it('cancels the queued COD run when the order is paid, shipped or cancelled', async () => {
    const db = seed()
    const ctx = { db: asClient(db), connection: connectionRow() as never, log, now: NOW }
    await applyEvents(ctx, [{ kind: 'order.created', order: normalizedOrder() }])
    await applyEvents(ctx, [{ kind: 'order.updated', order: normalizedOrder({ status: 'cancelled', payloadHash: 'h3' }) }])
    expect(runs(db)[0]).toMatchObject({ status: 'cancelled' })
  })

  it('records a visible suppressed run for an opted-out customer and never a run for a non-COD order', async () => {
    const db = seed()
    db.tables.commerce_customers = [{ id: 'cust-1', org_id: ORG_A, connection_id: CONN_A, external_id: 'c1', phone_e164: '+40722123456', do_not_call: true, updated_at: 'x' }]
    const ctx = { db: asClient(db), connection: connectionRow() as never, log, now: NOW }
    await applyEvents(ctx, [{ kind: 'order.created', order: normalizedOrder() }])
    expect(runs(db)[0]).toMatchObject({ status: 'suppressed', eligibility_reason: 'Customer asked not to be called' })
    await applyEvents(ctx, [{ kind: 'order.created', order: normalizedOrder({ externalId: '1002', orderNumber: '1002', customerExternalId: null, contactPhoneRaw: '0733000000', paymentMethod: 'card', paymentMethodTitle: 'Card online' }) }])
    expect(runs(db)).toHaveLength(1)
  })

  it('cancels an abandoned-cart run when the customer completes an order, and when the cart is recovered', async () => {
    const db = seed([automationRow({ id: AUTO_A, type: 'abandoned_cart', config: { delay_minutes: 30 } })])
    const ctx = { db: asClient(db), connection: connectionRow() as never, log, now: NOW }
    await applyEvents(ctx, [{ kind: 'customer.updated', customer: { externalId: 'c1', email: null, firstName: 'A', lastName: 'B', phoneRaw: '0722123456', countryCode: 'RO', marketingConsent: null, callConsent: null, ordersCount: null, totalSpent: null, providerCreatedAt: null, providerUpdatedAt: null } }])
    const cart = { externalId: 'cart-9', customerExternalId: 'c1', contactName: 'A B', contactPhoneRaw: '0722123456', contactEmail: null, status: 'abandoned' as const, currency: 'RON', total: 120, items: [{ name: 'Tricou', quantity: 1 }], abandonedAt: '2026-10-13T07:45:00Z', recoveredOrderExternalId: null, providerUpdatedAt: '2026-10-13T07:45:00Z' }
    await applyEvents(ctx, [{ kind: 'cart.updated', cart }])
    expect(runs(db)).toHaveLength(1)
    expect(runs(db)[0]).toMatchObject({ status: 'scheduled', automation_type: 'abandoned_cart', scheduled_for: '2026-10-13T08:30:00.000Z' })
    await applyEvents(ctx, [{ kind: 'order.created', order: normalizedOrder({ externalId: '2001', orderNumber: '2001', paymentMethod: 'card' }) }])
    expect(runs(db)[0]).toMatchObject({ status: 'cancelled', eligibility_reason: 'Customer completed the order' })
    // A second cart later: recovered → cancelled as well.
    await applyEvents(ctx, [{ kind: 'cart.updated', cart: { ...cart, externalId: 'cart-10', abandonedAt: '2026-10-13T07:50:00Z' } }])
    expect(runs(db)).toHaveLength(2)
    await applyEvents(ctx, [{ kind: 'cart.updated', cart: { ...cart, externalId: 'cart-10', status: 'recovered', recoveredOrderExternalId: '2002' } }])
    expect(runs(db)[1]).toMatchObject({ status: 'cancelled' })
  })

  it('never calls for orders created before the automation was enabled (imports)', async () => {
    const db = seed([automationRow({ enabled_at: '2026-10-13T07:45:00Z' })])
    const ctx = { db: asClient(db), connection: connectionRow() as never, log, now: NOW }
    await applyEvents(ctx, [{ kind: 'order.created', order: normalizedOrder({ providerCreatedAt: '2026-10-12T10:00:00Z' }) }])
    expect(runs(db)).toHaveLength(0)
  })

  it('queues no call for a cart the store reports as open; the same cart reported abandoned later is queued', async () => {
    const db = seed([automationRow({ id: AUTO_A, type: 'abandoned_cart', config: { delay_minutes: 30 } })])
    const ctx = { db: asClient(db), connection: connectionRow() as never, log, now: NOW }
    const open = { externalId: 'cart-9', customerExternalId: null, contactName: 'A B', contactPhoneRaw: '0722123456', contactEmail: null, status: 'open' as const, currency: 'RON', total: 120, items: [{ name: 'Tricou', quantity: 1 }], abandonedAt: null, recoveredOrderExternalId: null, providerUpdatedAt: '2026-10-13T07:30:00Z' }
    await applyEvents(ctx, [{ kind: 'cart.updated', cart: open }])
    await applyEvents(ctx, [{ kind: 'cart.updated', cart: { ...open, providerUpdatedAt: '2026-10-13T07:50:00Z' } }])
    expect(runs(db)).toHaveLength(0)
    await applyEvents(ctx, [{ kind: 'cart.updated', cart: { ...open, status: 'abandoned', abandonedAt: '2026-10-13T07:55:00Z', providerUpdatedAt: '2026-10-13T07:55:00Z' } }])
    expect(runs(db)).toHaveLength(1)
    expect(runs(db)[0]).toMatchObject({ status: 'scheduled', automation_type: 'abandoned_cart', scheduled_for: '2026-10-13T08:30:00.000Z' })
  })
})
