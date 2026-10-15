import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('not used') } }))
vi.mock('@/lib/telephony/outbound', () => ({ startOutboundCall: vi.fn() }))

import { RequestError } from '@/lib/api/http'
import { ProviderError } from '@/lib/voice-providers/errors'
import { AGENT_A, AUTO_A, CALL_A, CONN_A, NOW, ORG_A, asClient, automationRow, commerceDb, connectionRow, orgRow } from '@/tests/helpers/commerce'
import { MINUTES_RESERVED_REASON, MINUTES_SKIP_REASON, MINUTES_WAIT_REASON, claimDueRuns, dispatchFailureMessage, dispatchRun, minutesRetrySlot, recoverStaleDispatches } from './dispatch'
import { readAutomationConfig } from './config'
import { outcomeFromCall, reconcileCommerceRun, reconcileStaleCallingRuns } from './reconcile'

const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log, context: {} }
/** The second attempt's call of a run (CALL_A is the first). */
const CALL_B = '77777777-7777-4777-8777-777777777777'

function run(over: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    org_id: ORG_A,
    automation_id: AUTO_A,
    connection_id: CONN_A,
    automation_type: 'cod_confirmation',
    order_id: 'order-1',
    customer_id: null,
    cart_id: null,
    external_ref: '1001',
    event_key: 'order:1001',
    idempotency_key: 'k1',
    status: 'scheduled',
    eligibility_reason: null,
    to_phone_e164: '+40722123456',
    scheduled_for: '2026-10-13T07:59:00Z',
    attempt: 0,
    max_attempts: 2,
    lease_owner: null,
    lease_until: null,
    call_id: null,
    provider_call_ref: null,
    dispatch_uncertain: false,
    outcome: null,
    outcome_detail: null,
    summary: null,
    error_code: null,
    error_message: null,
    last_attempt_at: null,
    completed_at: null,
    created_at: '2026-10-13T07:40:00Z',
    updated_at: '2026-10-13T07:40:00Z',
    ...over,
  }
}
function order(over: Record<string, unknown> = {}) {
  return { id: 'order-1', org_id: ORG_A, connection_id: CONN_A, external_id: '1001', order_number: '1001', customer_id: null, contact_name: 'Andreea Popescu', contact_phone_e164: '+40722123456', shipping_city: 'Cluj-Napoca', status: 'processing', financial_status: 'pending', fulfillment_status: 'unfulfilled', is_cod: true, currency: 'RON', total: 189.9, items_count: 2, items_summary: '1 × Tricou, 2 × Șosete', provider_created_at: '2026-10-13T07:30:00Z', updated_at: 'x', ...over }
}
function seed(over: { run?: Record<string, unknown>; order?: Record<string, unknown>; automation?: Record<string, unknown>; org?: Record<string, unknown> } = {}) {
  return commerceDb({
    organizations: [orgRow(ORG_A, over.org)],
    agents: [{ id: AGENT_A, org_id: ORG_A, name: 'Maria', created_at: 'x' }],
    commerce_connections: [connectionRow()],
    commerce_automations: [automationRow(over.automation)],
    commerce_orders: [order(over.order)],
    commerce_automation_runs: [run(over.run)],
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

describe('dispatch', () => {
  it('claims atomically (scheduled → calling once), re-checks the rules and dials through startOutboundCall with the run id and script values', async () => {
    const db = seed()
    const start = vi.fn(async () => ({ callId: CALL_A, routingMode: 'app_routed' as const, status: 'queued' as const }))
    const [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(claimed).toMatchObject({ status: 'calling', attempt: 1, lease_owner: 'w1' })
    expect(await claimDueRuns(asClient(db), 'w2', 10)).toHaveLength(0)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('called')
    expect(start).toHaveBeenCalledTimes(1)
    const req = (start.mock.calls[0] as unknown as unknown[])[0] as Record<string, unknown>
    expect(req).toMatchObject({ orgId: ORG_A, toNumber: '+40722123456', purpose: 'outbound', commerceRunId: 'run-1' })
    expect(req.variables).toMatchObject({ call_reason: 'cod_confirmation', order_number: '1001', order_total: '189,90 lei', customer_name: 'Andreea Popescu', delivery_city: 'Cluj-Napoca', store_name: 'Magazinul Exemplu', agent_name: 'Maria' })
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'calling', call_id: CALL_A, dispatch_uncertain: false })
    expect(db.tables.commerce_audit_log.some((a) => a.action === 'call.started' && a.call_id === CALL_A)).toBe(true)
  })

  it('keeps an unconfirmed dispatch as calling with dispatch_uncertain and never dials again', async () => {
    const db = seed()
    const start = vi.fn(async () => ({ callId: CALL_A, routingMode: 'native_elevenlabs' as const, status: 'unconfirmed' as const }))
    const [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('unconfirmed')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'calling', call_id: CALL_A, dispatch_uncertain: true })
    expect(await claimDueRuns(asClient(db), 'w3', 10)).toHaveLength(0)
    // A crashed dispatch without a call id is settled as failed, not redialed.
    db.tables.commerce_automation_runs.push(run({ id: 'run-2', idempotency_key: 'k2', external_ref: '1002', status: 'calling', lease_until: '2026-10-13T07:00:00Z', lease_owner: 'dead', attempt: 1 }))
    expect(await recoverStaleDispatches(asClient(db), log, NOW)).toBe(1)
    expect(db.tables.commerce_automation_runs[1]).toMatchObject({ status: 'failed', dispatch_uncertain: true, error_code: 'dispatch_uncertain' })
  })

  it('suppresses opted-out customers, cancels closed orders and skips when the merchant must act', async () => {
    const start = vi.fn()
    let db = seed()
    db.tables.commerce_customers = [{ id: 'c-1', org_id: ORG_A, connection_id: CONN_A, external_id: 'c1', phone_e164: '+40722123456', do_not_call: true, updated_at: 'x' }]
    let [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('skipped')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'suppressed', error_code: 'do_not_call' })

    db = seed({ order: { financial_status: 'paid' } })
    ;[claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('cancelled')

    db = seed({ automation: { consent_confirmed_at: null } })
    ;[claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('cancelled')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ error_code: 'no_consent' })

    // Out of minutes: the run waits for minutes instead of dialing (see 'out of minutes' below).
    db = seed({ org: { plan: 'trial', minutes_used: 100, minutes_limit: 100 } })
    ;[claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('deferred')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'scheduled', eligibility_reason: MINUTES_WAIT_REASON })

    db = seed()
    const noNumber = vi.fn(async () => { throw new RequestError('precondition_failed', 'You need an active phone number to place calls.', 409) })
    ;[claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: noNumber }, NOW)).toBe('skipped')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'skipped', error_code: 'precondition_failed' })
    expect(start).not.toHaveBeenCalled()
  })

  it('defers outside the call window and when the daily caps are reached', async () => {
    const start = vi.fn()
    const evening = new Date('2026-10-13T18:30:00Z') // 21:30 Bucharest
    vi.setSystemTime(evening)
    let db = seed()
    let [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, evening)).toBe('deferred')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'scheduled', scheduled_for: '2026-10-14T06:00:00.000Z', attempt: 0 })

    vi.setSystemTime(NOW)
    db = seed({ automation: { config: { daily_cap: 1 } } })
    db.tables.commerce_automation_runs.push(run({ id: 'run-done', idempotency_key: 'kd', external_ref: '999', status: 'completed', last_attempt_at: '2026-10-13T06:30:00Z' }))
    ;[claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('deferred')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'scheduled', scheduled_for: '2026-10-14T06:00:00.000Z' })
    expect(start).not.toHaveBeenCalled()
  })

  it('retries a provider failure within the attempt limit, then fails', async () => {
    const db = seed()
    const boom = vi.fn(async () => { throw new RequestError('provider_error', 'The call could not be placed.', 502) })
    let [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: boom }, NOW)).toBe('retry')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'retry_waiting', scheduled_for: '2026-10-13T10:00:00.000Z', attempt: 1 })
    vi.setSystemTime(new Date('2026-10-13T10:01:00Z'))
    ;[claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(claimed.attempt).toBe(2)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: boom }, new Date('2026-10-13T10:01:00Z'))).toBe('failed')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'failed', outcome: 'failed' })
  })

  it('shows the merchant public-safe text when the dial fails, never the provider or database message', async () => {
    const raw = [
      new ProviderError({ system: 'elevenlabs', operation: 'twilio.outbound_call', code: 'validation', status: 422, detail: 'invalid_phone - request_id abc123' }),
      new Error('calls insert failed: new row violates check constraint "calls_status_check"'),
    ]
    for (const err of raw) {
      const db = seed()
      const boom = vi.fn(async () => { throw err })
      const [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
      expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: boom }, NOW)).toBe('retry')
      const stored = String(db.tables.commerce_automation_runs[0].error_message)
      expect(stored).not.toMatch(/elevenlabs|twilio|insert failed|constraint|request_id|422/i)
      expect(stored).toMatch(/Retrying automatically\.$/)
      expect(db.tables.commerce_automation_runs[0].error_code).toBe('dispatch_failed')
    }
    expect(dispatchFailureMessage(raw[0], false)).toBe('The voice provider rejected the call.')
    expect(dispatchFailureMessage(new ProviderError({ system: 'elevenlabs', operation: 'twilio.outbound_call', code: 'timeout' }), true)).toBe('The voice provider did not respond. Retrying automatically.')
    expect(dispatchFailureMessage(raw[1], false)).toBe('The call could not be started.')
    expect(dispatchFailureMessage('not even an Error', false)).toBe('The call could not be started.')
  })

  it("unlinks the previous attempt's call before a retry dials, so only the new call can settle the run", async () => {
    const db = seed({ run: { status: 'retry_waiting', call_id: CALL_A, provider_call_ref: 'native_elevenlabs', dispatch_uncertain: true, attempt: 1, outcome: 'no_answer' } })
    let linkedAtDial: unknown = 'unset'
    const start = vi.fn(async () => {
      linkedAtDial = db.tables.commerce_automation_runs[0].call_id
      return { callId: CALL_B, routingMode: 'app_routed' as const, status: 'queued' as const }
    })
    const [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(claimed).toMatchObject({ status: 'calling', attempt: 2, call_id: CALL_A })
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('called')
    expect(linkedAtDial).toBeNull()
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'calling', call_id: CALL_B, provider_call_ref: 'app_routed', dispatch_uncertain: false })
  })

  it('cancels an abandoned-cart run whose cart is still open at dial time, and dials an abandoned one', async () => {
    const start = vi.fn(async () => ({ callId: CALL_A, routingMode: 'app_routed' as const, status: 'queued' as const }))
    const cartRun = { automation_type: 'abandoned_cart', order_id: null, cart_id: 'cart-1', external_ref: 'cart-9', event_key: 'cart:cart-9' }
    const cart = (status: 'open' | 'abandoned') => ({ id: 'cart-1', org_id: ORG_A, connection_id: CONN_A, external_id: 'cart-9', customer_id: null, customer_external_id: null, contact_name: 'Andreea Popescu', contact_phone_e164: '+40722123456', contact_email: null, status, currency: 'RON', total: 120, items_count: 1, items_summary: '1 × Tricou', abandoned_at: status === 'abandoned' ? '2026-10-13T07:00:00Z' : null, recovered_order_external_id: null, provider_updated_at: '2026-10-13T07:00:00Z', created_at: 'x', updated_at: 'x' })
    let db = seed({ run: cartRun, automation: { type: 'abandoned_cart' } })
    db.tables.commerce_carts = [cart('open')]
    let [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('cancelled')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'cancelled', error_code: 'cart_not_abandoned', eligibility_reason: 'Cart is not abandoned' })
    expect(start).not.toHaveBeenCalled()

    db = seed({ run: cartRun, automation: { type: 'abandoned_cart' } })
    db.tables.commerce_carts = [cart('abandoned')]
    ;[claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('called')
    expect(start).toHaveBeenCalledTimes(1)
  })
})

describe('dispatch out of minutes (included and purchased)', () => {
  const OUT = { plan: 'pro', minutes_used: 1000, minutes_limit: 1000, extra_minutes_balance: 0 }
  const at = (iso: string) => {
    const d = new Date(iso)
    vi.setSystemTime(d)
    return d
  }
  const deferredAudits = (db: ReturnType<typeof seed>) => db.tables.commerce_audit_log.filter((a) => a.action === 'run.deferred')

  it('waits 30 minutes at a time from the scheduled time, never dialing and never spending an attempt', async () => {
    const start = vi.fn()
    const db = seed({ org: OUT })
    let [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('deferred')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({
      status: 'scheduled',
      scheduled_for: '2026-10-13T08:30:00.000Z',
      attempt: 0,
      eligibility_reason: MINUTES_WAIT_REASON,
      minutes_wait_since: '2026-10-13T07:59:00.000Z',
      lease_owner: null,
    })
    expect(deferredAudits(db)).toHaveLength(1)
    expect(deferredAudits(db)[0].metadata).toMatchObject({ code: 'minutes_exhausted', until: '2026-10-13T08:30:00.000Z' })

    // Still out of minutes 31 minutes later: the anchor stays the scheduled time, one audit only.
    const later = at('2026-10-13T08:31:00Z')
    ;[claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(claimed.attempt).toBe(1)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, later)).toBe('deferred')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'scheduled', scheduled_for: '2026-10-13T09:01:00.000Z', attempt: 0, minutes_wait_since: '2026-10-13T07:59:00.000Z' })
    expect(deferredAudits(db)).toHaveLength(1)
    expect(start).not.toHaveBeenCalled()
  })

  it('dials as soon as minutes are bought, and the run no longer waits', async () => {
    const start = vi.fn(async () => ({ callId: CALL_A, routingMode: 'app_routed' as const, status: 'queued' as const }))
    const db = seed({ org: OUT })
    let [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('deferred')
    db.tables.organizations[0].extra_minutes_balance = 500
    const later = at('2026-10-13T08:30:00Z')
    ;[claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, later)).toBe('called')
    expect(start).toHaveBeenCalledTimes(1)
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'calling', call_id: CALL_A, minutes_wait_since: null, attempt: 1 })
  })

  it('a paid plan with purchased minutes left dials without waiting', async () => {
    const start = vi.fn(async () => ({ callId: CALL_A, routingMode: 'app_routed' as const, status: 'queued' as const }))
    const db = seed({ org: { ...OUT, extra_minutes_balance: 5 } })
    const [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('called')
    expect(db.tables.commerce_automation_runs[0]).not.toHaveProperty('minutes_wait_since')
  })

  it('moves the next try into the call window (next morning) while that is within 24 hours', async () => {
    const start = vi.fn()
    // 19:45 in Bucharest: 30 minutes later is past the 20:00 window end.
    const evening = at('2026-10-13T16:45:00Z')
    const db = seed({ org: OUT, run: { scheduled_for: '2026-10-13T16:40:00Z' } })
    const [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, evening)).toBe('deferred')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'scheduled', scheduled_for: '2026-10-14T06:00:00.000Z', minutes_wait_since: '2026-10-13T16:40:00.000Z' })
  })

  it('skips the run as minutes_exhausted 24 hours after its scheduled time, and never dials later than that', async () => {
    const start = vi.fn()
    // Waiting since 07:59 yesterday: the next try (08:15) would be past the 24 hours.
    let now = at('2026-10-14T07:45:00Z')
    let db = seed({ org: OUT, run: { scheduled_for: '2026-10-14T07:44:00Z', minutes_wait_since: '2026-10-13T07:59:00Z' } })
    let [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, now)).toBe('skipped')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'skipped', error_code: 'minutes_exhausted', eligibility_reason: MINUTES_SKIP_REASON, lease_owner: null })
    expect(db.tables.commerce_audit_log.some((a) => a.action === 'run.skipped' && (a.metadata as Record<string, unknown>).code === 'minutes_exhausted')).toBe(true)

    // Out of minutes in the evening with the 24 hours ending before the window reopens: skipped now.
    now = at('2026-10-13T16:45:00Z')
    db = seed({ org: OUT, run: { scheduled_for: '2026-10-13T05:30:00Z' } })
    ;[claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, now)).toBe('skipped')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'skipped', error_code: 'minutes_exhausted' })
    expect(start).not.toHaveBeenCalled()
  })

  it('an out-of-minutes refusal from startOutboundCall (minutes ran out after the check) waits for minutes instead of skipping', async () => {
    const outOfMinutes = vi.fn(async () => {
      throw new RequestError('precondition_failed', 'You are out of call minutes.', 409, { reason: 'minutes_exhausted' })
    })
    const db = seed()
    const [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
    expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: outOfMinutes }, NOW)).toBe('deferred')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({
      status: 'scheduled',
      scheduled_for: '2026-10-13T08:30:00.000Z',
      attempt: 0,
      eligibility_reason: MINUTES_WAIT_REASON,
      minutes_wait_since: '2026-10-13T07:59:00.000Z',
      lease_owner: null,
    })
    expect(deferredAudits(db)[0].metadata).toMatchObject({ code: 'minutes_exhausted' })
  })

  describe('calls under way hold minutes (usage is recorded only when a call ends)', () => {
    const liveCall = (id: string, over: Record<string, unknown> = {}) => ({
      id,
      org_id: ORG_A,
      status: 'in-progress',
      usage_recorded_at: null,
      started_at: '2026-10-13T07:58:00.000Z',
      ...over,
    })
    const dialed = () => vi.fn(async () => ({ callId: CALL_A, routingMode: 'app_routed' as const, status: 'queued' as const }))

    it('with 3 minutes left and one call under way, the next store call waits a few minutes instead of overrunning', async () => {
      const start = dialed()
      const db = seed({ org: { plan: 'pro', minutes_used: 997, minutes_limit: 1000, extra_minutes_balance: 0 } })
      db.tables.calls = [liveCall('call-live')]
      const [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
      expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('deferred')
      expect(start).not.toHaveBeenCalled()
      expect(db.tables.commerce_automation_runs[0]).toMatchObject({
        status: 'scheduled',
        scheduled_for: '2026-10-13T08:05:00.000Z',
        attempt: 0,
        eligibility_reason: MINUTES_RESERVED_REASON,
        minutes_wait_since: '2026-10-13T07:59:00.000Z',
      })
      expect(deferredAudits(db)[0].metadata).toMatchObject({ code: 'minutes_reserved' })
    })

    it('dials when the minutes left cover the calls under way and this one', async () => {
      const start = dialed()
      const db = seed({ org: { plan: 'pro', minutes_used: 996, minutes_limit: 1000, extra_minutes_balance: 0 } })
      db.tables.calls = [liveCall('call-live')]
      const [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
      expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('called')
    })

    it('the first call always may start, and finished, recorded, stale or other organizations\' calls hold nothing', async () => {
      const start = dialed()
      const db = seed({ org: { plan: 'pro', minutes_used: 999, minutes_limit: 1000, extra_minutes_balance: 0 } })
      db.tables.calls = [
        liveCall('call-done', { status: 'completed' }),
        liveCall('call-recorded', { usage_recorded_at: '2026-10-13T07:59:30.000Z' }),
        liveCall('call-stale', { started_at: '2026-10-13T04:00:00.000Z' }),
        liveCall('call-other-org', { org_id: '99999999-9999-4999-8999-999999999999' }),
      ]
      const [claimed] = await claimDueRuns(asClient(db), 'w1', 10)
      expect(await dispatchRun(asClient(db), claimed, 'w1', log, { startOutboundCall: start }, NOW)).toBe('called')
    })

    it('within one tick, each dialed store call holds minutes for the next', async () => {
      // 3 minutes left: the first run dials; once its call is live, the second waits.
      const db = seed({ org: { plan: 'pro', minutes_used: 997, minutes_limit: 1000, extra_minutes_balance: 0 } })
      // Another customer's order, so only the minutes can hold the second run back.
      db.tables.commerce_orders.push(order({ id: 'order-2', external_id: '1002', order_number: '1002', contact_phone_e164: '+40722123457' }))
      db.tables.commerce_automation_runs.push(run({ id: 'run-2', idempotency_key: 'k2', external_ref: '1002', order_id: 'order-2', event_key: 'order:1002', to_phone_e164: '+40722123457' }))
      const start = vi.fn(async () => {
        db.tables.calls = [...(db.tables.calls ?? []), liveCall(`call-${(db.tables.calls ?? []).length}`)]
        return { callId: CALL_A, routingMode: 'app_routed' as const, status: 'queued' as const }
      })
      const claimed = await claimDueRuns(asClient(db), 'w1', 10)
      expect(claimed).toHaveLength(2)
      const outcomes = []
      for (const r of claimed) outcomes.push(await dispatchRun(asClient(db), r, 'w1', log, { startOutboundCall: start }, NOW))
      expect(outcomes).toEqual(['called', 'deferred'])
      expect(start).toHaveBeenCalledTimes(1)
      expect(db.tables.commerce_automation_runs.find((r) => r.id === claimed[1].id)).toMatchObject({ status: 'scheduled', eligibility_reason: MINUTES_RESERVED_REASON })
    })
  })

  it('minutesRetrySlot: 30 minutes on, inside the window, null past the 24 hours', () => {
    const cfg = readAutomationConfig('cod_confirmation', {})
    const anchor = new Date('2026-10-13T07:59:00Z')
    expect(minutesRetrySlot(anchor, new Date('2026-10-13T08:00:00Z'), cfg, 'Europe/Bucharest')?.toISOString()).toBe('2026-10-13T08:30:00.000Z')
    expect(minutesRetrySlot(anchor, new Date('2026-10-13T16:45:00Z'), cfg, 'Europe/Bucharest')?.toISOString()).toBe('2026-10-14T06:00:00.000Z')
    expect(minutesRetrySlot(anchor, new Date('2026-10-14T07:20:00Z'), cfg, 'Europe/Bucharest')?.toISOString()).toBe('2026-10-14T07:50:00.000Z')
    expect(minutesRetrySlot(anchor, new Date('2026-10-14T07:30:00Z'), cfg, 'Europe/Bucharest')).toBeNull()
    expect(minutesRetrySlot(anchor, new Date('2026-10-14T07:59:00Z'), cfg, 'Europe/Bucharest')).toBeNull()
  })
})

describe('reconcile', () => {
  it('maps call results to outcomes', () => {
    expect(outcomeFromCall({ status: 'no-answer', duration_seconds: 0, termination_reason: null, outcome: null, summary: null })).toBe('no_answer')
    expect(outcomeFromCall({ status: 'completed', duration_seconds: 3, termination_reason: null, outcome: null, summary: null })).toBe('no_answer')
    expect(outcomeFromCall({ status: 'completed', duration_seconds: 40, termination_reason: null, outcome: null, summary: null })).toBe('not_confirmed')
    expect(outcomeFromCall({ status: 'completed', duration_seconds: 40, termination_reason: null, outcome: 'voicemail', summary: null })).toBe('voicemail')
    expect(outcomeFromCall({ status: 'failed', duration_seconds: 0, termination_reason: null, outcome: null, summary: null })).toBe('failed')
  })

  it('lets a tool-recorded outcome win, retries unanswered calls, keeps the provider status on the call', async () => {
    const db = seed({ run: { status: 'calling', call_id: CALL_A, attempt: 1, lease_owner: 'w1', lease_until: '2026-10-13T08:03:00Z', outcome: 'confirmed' } })
    db.tables.calls = [{ id: CALL_A, org_id: ORG_A, status: 'completed', duration_seconds: 55, termination_reason: null, outcome: null, summary: 'Clientul a confirmat comanda.', commerce_run_id: 'run-1' }]
    expect(await reconcileCommerceRun(asClient(db), CALL_A, log, NOW)).toBe('confirmed')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'completed', outcome: 'confirmed', summary: 'Clientul a confirmat comanda.' })
    expect(db.tables.calls[0].status).toBe('completed')

    const db2 = seed({ run: { status: 'calling', call_id: CALL_A, attempt: 1, lease_owner: 'w1', lease_until: '2026-10-13T08:03:00Z' } })
    db2.tables.calls = [{ id: CALL_A, org_id: ORG_A, status: 'no-answer', duration_seconds: 0, termination_reason: null, outcome: null, summary: null, commerce_run_id: 'run-1' }]
    expect(await reconcileCommerceRun(asClient(db2), CALL_A, log, NOW)).toBe('no_answer')
    expect(db2.tables.commerce_automation_runs[0]).toMatchObject({ status: 'retry_waiting', outcome: 'no_answer', scheduled_for: '2026-10-13T10:00:00.000Z' })
    // Idempotent: a second event for the same call changes nothing.
    expect(await reconcileCommerceRun(asClient(db2), CALL_A, log, NOW)).toBeNull()
    // A call without a run is ignored.
    db2.tables.calls.push({ id: 'other', org_id: ORG_A, status: 'completed', commerce_run_id: null })
    expect(await reconcileCommerceRun(asClient(db2), 'other', log, NOW)).toBeNull()
  })

  it("settles a run only from its current attempt's call: a late event for an earlier call changes nothing", async () => {
    // Attempt 1 (CALL_A) was not answered; attempt 2 (CALL_B) is live.
    const db = seed({ run: { status: 'calling', call_id: CALL_B, attempt: 2, max_attempts: 3, lease_owner: 'w1', lease_until: '2026-10-13T08:03:00Z', outcome: 'no_answer' } })
    db.tables.calls = [
      { id: CALL_A, org_id: ORG_A, status: 'no-answer', duration_seconds: 0, termination_reason: null, outcome: null, summary: null, ended_at: '2026-10-13T06:01:00Z', commerce_run_id: 'run-1' },
      { id: CALL_B, org_id: ORG_A, status: 'completed', duration_seconds: 55, termination_reason: null, outcome: null, summary: 'Clientul a confirmat comanda.', ended_at: '2026-10-13T08:02:00Z', commerce_run_id: 'run-1' },
    ]
    expect(await reconcileCommerceRun(asClient(db), CALL_A, log, NOW)).toBeNull()
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'calling', call_id: CALL_B, attempt: 2 })
    expect((db.tables.commerce_audit_log ?? []).some((a) => a.action === 'call.result')).toBe(false)
    expect(await reconcileCommerceRun(asClient(db), CALL_B, log, NOW)).toBe('not_confirmed')
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'completed', outcome: 'not_confirmed', summary: 'Clientul a confirmat comanda.' })
    // No third dial for a customer who already spoke to the agent.
    vi.setSystemTime(new Date('2026-10-14T08:00:00Z'))
    expect(await claimDueRuns(asClient(db), 'w2', 10)).toHaveLength(0)
  })

  it('never re-dials an uncertain dispatch whose call no provider event settled; a verified no-answer still retries', async () => {
    const uncertain = { status: 'calling', call_id: CALL_A, provider_call_ref: 'native_elevenlabs', dispatch_uncertain: true, attempt: 1, lease_owner: 'w1', lease_until: '2026-10-13T07:03:00Z' }
    const db = seed({ run: uncertain })
    // The row is still 'ringing' six hours later: nobody knows whether the customer was reached.
    db.tables.calls = [{ id: CALL_A, org_id: ORG_A, status: 'ringing', started_at: '2026-10-13T02:00:00Z', ended_at: null, duration_seconds: null, termination_reason: null, outcome: null, summary: null, commerce_run_id: 'run-1' }]
    expect(await reconcileStaleCallingRuns(asClient(db), log, NOW)).toBe(1)
    expect(db.tables.commerce_automation_runs[0]).toMatchObject({ status: 'failed', outcome: 'failed', dispatch_uncertain: true, error_code: 'dispatch_uncertain', error_message: 'The call could not be confirmed; it is not retried automatically.' })
    expect(await claimDueRuns(asClient(db), 'w2', 10)).toHaveLength(0)
    vi.setSystemTime(new Date('2026-10-14T08:00:00Z'))
    expect(await claimDueRuns(asClient(db), 'w2', 10)).toHaveLength(0)
    vi.setSystemTime(NOW)

    // The provider did report the call (no answer): the retry budget applies as usual.
    const db2 = seed({ run: uncertain })
    db2.tables.calls = [{ id: CALL_A, org_id: ORG_A, status: 'no-answer', started_at: '2026-10-13T07:00:00Z', ended_at: '2026-10-13T07:01:00Z', duration_seconds: 0, termination_reason: null, outcome: null, summary: null, commerce_run_id: 'run-1' }]
    expect(await reconcileStaleCallingRuns(asClient(db2), log, NOW)).toBe(1)
    expect(db2.tables.commerce_automation_runs[0]).toMatchObject({ status: 'retry_waiting', outcome: 'no_answer', scheduled_for: '2026-10-13T10:00:00.000Z' })

    // A tool-recorded outcome proves the conversation happened and wins even for an uncertain dispatch.
    const db3 = seed({ run: { ...uncertain, outcome: 'confirmed' } })
    db3.tables.calls = [{ id: CALL_A, org_id: ORG_A, status: 'ringing', started_at: '2026-10-13T02:00:00Z', ended_at: null, duration_seconds: null, termination_reason: null, outcome: null, summary: null, commerce_run_id: 'run-1' }]
    expect(await reconcileStaleCallingRuns(asClient(db3), log, NOW)).toBe(1)
    expect(db3.tables.commerce_automation_runs[0]).toMatchObject({ status: 'completed', outcome: 'confirmed' })
  })
})
