import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('not used') } }))
vi.mock('@/lib/voice-providers/maintenance-state', () => ({ runIfDue: async () => ({ skipped: 'not_due' }) }))
vi.mock('@/lib/telephony/outbound', () => ({ startOutboundCall: vi.fn() }))
const adapterState = vi.hoisted(() => ({ adapter: null as unknown }))
vi.mock('./adapters', () => ({ adapterFor: () => adapterState.adapter, isCommercePlatform: () => true }))

import { startOutboundCall } from '@/lib/telephony/outbound'
import { AGENT_A, AUTO_A, CALL_A, CONN_A, NOW, ORG_A, asClient, automationRow, commerceDb, connectionRow, fakeAdapter, orgRow } from '@/tests/helpers/commerce'
import { runCommerceWorker } from './worker'

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }

function order(n: number) {
  return { id: `order-${n}`, org_id: ORG_A, connection_id: CONN_A, external_id: String(1000 + n), order_number: String(1000 + n), customer_id: null, contact_name: 'Andreea Popescu', contact_phone_e164: `+4072212345${n}`, shipping_city: 'Cluj-Napoca', status: 'processing', financial_status: 'pending', fulfillment_status: 'unfulfilled', is_cod: true, currency: 'RON', total: 189.9, items_count: 2, items_summary: '1 × Tricou, 2 × Șosete', provider_created_at: '2026-10-13T07:30:00Z', updated_at: 'x' }
}
function run(n: number) {
  return { id: `run-${n}`, org_id: ORG_A, automation_id: AUTO_A, connection_id: CONN_A, automation_type: 'cod_confirmation', order_id: `order-${n}`, customer_id: null, cart_id: null, external_ref: String(1000 + n), event_key: `order:${1000 + n}`, idempotency_key: `k${n}`, status: 'scheduled', eligibility_reason: null, to_phone_e164: `+4072212345${n}`, scheduled_for: '2026-10-13T07:59:00Z', attempt: 0, max_attempts: 2, lease_owner: null, lease_until: null, call_id: null, provider_call_ref: null, dispatch_uncertain: false, outcome: null, outcome_detail: null, summary: null, error_code: null, error_message: null, last_attempt_at: null, completed_at: null, created_at: '2026-10-13T07:40:00Z', updated_at: '2026-10-13T07:40:00Z' }
}
function event(n: number) {
  return { id: `evt-${n}`, org_id: ORG_A, connection_id: CONN_A, platform: 'woocommerce', dedupe_key: `d${n}`, topic: 'order.updated', verified: true, status: 'received', attempts: 0, max_attempts: 5, run_after: '2026-10-13T07:00:00Z', payload: { id: n }, external_resource_id: String(n), received_at: '2026-10-13T07:00:00Z', lease_owner: null, lease_until: null }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  adapterState.adapter = fakeAdapter()
})

describe('commerce worker budget', () => {
  it('hands back the due runs it claimed but could not dispatch, so they are dialed on the next tick instead of settled as uncertain', async () => {
    const db = commerceDb({
      organizations: [orgRow()],
      agents: [{ id: AGENT_A, org_id: ORG_A, name: 'Maria', created_at: 'x' }],
      commerce_connections: [connectionRow()],
      commerce_automations: [automationRow()],
      commerce_orders: [order(1), order(2), order(3)],
      commerce_automation_runs: [run(1), run(2), run(3)],
    })
    let t = NOW.getTime()
    const now = () => t
    let calls = 0
    vi.mocked(startOutboundCall).mockImplementation(async () => {
      t += 6_000 // a slow provider: one dispatch eats most of a 10 s budget
      calls++
      return { callId: `${CALL_A.slice(0, -1)}${calls}`, routingMode: 'app_routed', status: 'queued' } as never
    })
    const first = await runCommerceWorker(log, { db: asClient(db), budgetMs: 10_000, now })
    expect(first).toMatchObject({ dispatch: { called: 1 }, stopped_early: true, recovered: 0 })
    expect(startOutboundCall).toHaveBeenCalledTimes(1)
    const byId = () => Object.fromEntries(db.tables.commerce_automation_runs.map((r) => [String(r.id), r]))
    expect(byId()['run-1']).toMatchObject({ status: 'calling', attempt: 1 })
    expect(byId()['run-1'].call_id).not.toBeNull()
    for (const id of ['run-2', 'run-3']) expect(byId()[id]).toMatchObject({ status: 'scheduled', attempt: 0, lease_owner: null, lease_until: null, call_id: null, dispatch_uncertain: false })

    // Next cron tick, five minutes later: nothing is recovered as uncertain; the two runs are claimed and dialed.
    t = NOW.getTime() + 5 * 60_000
    vi.setSystemTime(new Date(t))
    const second = await runCommerceWorker(log, { db: asClient(db), budgetMs: 45_000, now })
    expect(second).toMatchObject({ dispatch: { called: 2 }, stopped_early: false, recovered: 0 })
    expect(startOutboundCall).toHaveBeenCalledTimes(3)
    for (const id of ['run-1', 'run-2', 'run-3']) expect(byId()[id]).toMatchObject({ status: 'calling', attempt: 1, dispatch_uncertain: false })
    expect(db.tables.commerce_automation_runs.filter((r) => r.status === 'failed')).toHaveLength(0)
  })

  it('hands back the webhook events it claimed but could not process, without burning an attempt', async () => {
    let t = NOW.getTime()
    const now = () => t
    adapterState.adapter = fakeAdapter({
      normalize: () => {
        t += 3_000 // processing one event takes most of a 4 s budget
        return []
      },
    })
    const db = commerceDb({ organizations: [orgRow()], commerce_connections: [connectionRow()], commerce_webhook_events: [event(1), event(2), event(3)] })
    const first = await runCommerceWorker(log, { db: asClient(db), budgetMs: 4_000, now })
    expect(first).toMatchObject({ webhooks: { ignored: 1 }, stopped_early: true })
    const byId = () => Object.fromEntries(db.tables.commerce_webhook_events.map((e) => [String(e.id), e]))
    expect(byId()['evt-1']).toMatchObject({ status: 'ignored', attempts: 1 })
    for (const id of ['evt-2', 'evt-3']) expect(byId()[id]).toMatchObject({ status: 'received', attempts: 0, lease_owner: null, lease_until: null, payload: expect.any(Object) })

    const second = await runCommerceWorker(log, { db: asClient(db), budgetMs: 45_000, now })
    expect(second).toMatchObject({ webhooks: { ignored: 2 }, stopped_early: false })
    // The first (starved) claim did not count: each event was processed on its first real attempt.
    for (const id of ['evt-2', 'evt-3']) expect(byId()[id]).toMatchObject({ status: 'ignored', attempts: 1 })
  })
})
