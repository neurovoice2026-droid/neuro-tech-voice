import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'
import type { Logger } from '@/lib/observability/logger'

// Auto top-up: one DB-claimed attempt per cooldown, an off-session Stripe
// invoice (so invoice.paid emits the fiscal invoice and the receipt), a
// credit idempotent on the invoice id, and on failure: voided invoice,
// failed purchase row, auto top-up off, owner e-mailed, never retried.

const sendEmail = vi.fn()
vi.mock('@/lib/email/client', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }))
vi.mock('@/lib/stripe/client', () => ({ getStripeClient: () => { throw new Error('tests pass a Stripe client') }, isStripeConfigured: () => false }))

import { AUTO_TOPUP_COOLDOWN_SECONDS, autoTopUpFailureMessage, effectiveAutoTopUpThreshold, maybeAutoTopUp, sweepAutoTopUps, topUpFailureKind } from './auto-topup'

const ORG = '11111111-1111-4111-8111-111111111111'

function logger(): Logger {
  const l: Record<string, unknown> = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }
  l.child = () => l
  return l as unknown as Logger
}

function stripeMock() {
  return {
    subscriptions: { retrieve: vi.fn().mockResolvedValue({ id: 'sub_1', default_payment_method: 'pm_sub' }) },
    customers: { retrieve: vi.fn().mockResolvedValue({ id: 'cus_1', invoice_settings: { default_payment_method: 'pm_customer' } }) },
    invoices: {
      create: vi.fn().mockResolvedValue({ id: 'in_1', status: 'draft' }),
      finalizeInvoice: vi.fn().mockResolvedValue({ id: 'in_1', status: 'open' }),
      pay: vi.fn().mockResolvedValue({ id: 'in_1', status: 'paid', amount_paid: 9600, currency: 'usd', payments: { data: [{ payment: { type: 'payment_intent', payment_intent: 'pi_1' } }] } }),
      retrieve: vi.fn().mockResolvedValue({ id: 'in_1', status: 'open' }),
      voidInvoice: vi.fn().mockResolvedValue({ id: 'in_1', status: 'void' }),
      del: vi.fn().mockResolvedValue({ id: 'in_1', deleted: true }),
    },
    invoiceItems: { create: vi.fn().mockResolvedValue({ id: 'ii_1' }) },
  }
}
type StripeMock = ReturnType<typeof stripeMock>

function org(over: Record<string, unknown> = {}) {
  return {
    id: ORG,
    user_id: 'user-1',
    plan: 'pro',
    minutes_used: 840,
    minutes_limit: 850,
    extra_minutes_balance: 0,
    auto_topup_enabled: true,
    auto_topup_pack: 500,
    auto_topup_threshold: 50,
    auto_topup_last_attempt_at: null,
    auto_topup_failed_at: null,
    auto_topup_failure: null,
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_1',
    deletion_requested_at: null,
    ...over,
  }
}

type Row = Record<string, unknown>

/** In-memory versions of the two RPCs of migration 027 this module calls. */
function rpc(fn: string, args: unknown, tables: Record<string, Row[]>) {
  const a = args as Record<string, unknown>
  const o = tables.organizations.find((r) => r.id === a.p_org_id)
  if (fn === 'claim_auto_topup') {
    const last = o?.auto_topup_last_attempt_at ? Date.parse(o.auto_topup_last_attempt_at as string) : null
    if (!o || o.auto_topup_enabled !== true || (last !== null && Date.now() - last < (a.p_cooldown_seconds as number) * 1000)) return { data: false, error: null }
    o.auto_topup_last_attempt_at = new Date().toISOString()
    return { data: true, error: null }
  }
  if (fn === 'credit_minute_purchase') {
    tables.minute_purchases ??= []
    const existing = tables.minute_purchases.find((r) => r.stripe_invoice_id === a.p_invoice_id && r.status === 'credited')
    if (existing) return { data: [{ credited: false, balance_after: o?.extra_minutes_balance }], error: null }
    tables.minute_purchases.push({ org_id: a.p_org_id, minutes: a.p_minutes, amount_cents: a.p_amount_cents, currency: a.p_currency, source: a.p_source, status: 'credited', stripe_invoice_id: a.p_invoice_id, stripe_payment_intent_id: a.p_payment_intent_id })
    o!.extra_minutes_balance = (o!.extra_minutes_balance as number) + (a.p_minutes as number)
    return { data: [{ credited: true, balance_after: o!.extra_minutes_balance }], error: null }
  }
  return { data: null, error: { message: `unexpected rpc ${fn}` } }
}

function seed(orgs: Row[] = [org()]): MemoryDb {
  const db = memoryDb({ organizations: orgs, minute_purchases: [] }, { rpc })
  ;(db as unknown as { auth: unknown }).auth = { admin: { getUserById: async () => ({ data: { user: { email: 'owner@example.com' } }, error: null }) } }
  return db
}

let stripe: StripeMock
beforeEach(() => {
  sendEmail.mockReset().mockResolvedValue(true)
  stripe = stripeMock()
})

const run = (db: MemoryDb) => maybeAutoTopUp(db as never, ORG, logger(), { stripe: stripe as never })

describe('maybeAutoTopUp: success', () => {
  it('charges the pack off-session through a Stripe invoice and credits it', async () => {
    const db = seed()
    const res = await run(db)
    // 500 minutes at Pro's $0.20 with the 4% pack discount.
    expect(res).toEqual({ status: 'credited', minutes: 500, amountCents: 9600, invoiceId: 'in_1', balanceAfter: 500 })

    const metadata = { type: 'minute_pack', source: 'auto_topup', org_id: ORG, minutes: '500', plan: 'pro' }
    const [createParams, createOpts] = stripe.invoices.create.mock.calls[0]
    expect(createParams).toEqual({
      customer: 'cus_1',
      collection_method: 'charge_automatically',
      auto_advance: false,
      pending_invoice_items_behavior: 'exclude',
      currency: 'usd',
      default_payment_method: 'pm_sub',
      description: 'Auto top-up: 500 extra minutes',
      metadata,
    })
    expect(stripe.invoiceItems.create).toHaveBeenCalledWith(
      { customer: 'cus_1', invoice: 'in_1', amount: 9600, currency: 'usd', description: '500 extra minutes', metadata },
      expect.anything(),
    )
    expect(stripe.invoices.finalizeInvoice).toHaveBeenCalledWith('in_1', { auto_advance: false }, expect.anything())
    expect(stripe.invoices.pay).toHaveBeenCalledWith('in_1', expect.objectContaining({ off_session: true, payment_method: 'pm_sub' }), expect.anything())

    // Every write carries a key derived from the org id and the claim timestamp.
    const claimMs = Date.parse(db.tables.organizations[0].auto_topup_last_attempt_at as string)
    const keys = [
      createOpts,
      stripe.invoiceItems.create.mock.calls[0][1],
      stripe.invoices.finalizeInvoice.mock.calls[0][2],
      stripe.invoices.pay.mock.calls[0][2],
    ].map((o) => (o as { idempotencyKey: string }).idempotencyKey)
    expect(keys).toEqual([`ntv_topup_${ORG}_${claimMs}_invoice`, `ntv_topup_${ORG}_${claimMs}_item`, `ntv_topup_${ORG}_${claimMs}_finalize`, `ntv_topup_${ORG}_${claimMs}_pay`])

    expect(db.tables.minute_purchases).toEqual([
      expect.objectContaining({ org_id: ORG, minutes: 500, amount_cents: 9600, source: 'auto_topup', status: 'credited', stripe_invoice_id: 'in_1', stripe_payment_intent_id: 'pi_1' }),
    ])
    expect(db.tables.organizations[0]).toMatchObject({ extra_minutes_balance: 500, auto_topup_enabled: true })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("falls back to the customer's invoice payment method when the subscription has none", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_1', default_payment_method: null })
    await run(seed())
    expect(stripe.customers.retrieve).toHaveBeenCalledWith('cus_1')
    expect(stripe.invoices.create.mock.calls[0][0]).toMatchObject({ default_payment_method: 'pm_customer' })
    expect(stripe.invoices.pay.mock.calls[0][1]).toMatchObject({ payment_method: 'pm_customer' })
  })

  it('an invoice already settled at finalization (customer credit) is not charged again', async () => {
    stripe.invoices.finalizeInvoice.mockResolvedValue({ id: 'in_1', status: 'paid', amount_paid: 0, currency: 'usd' })
    const res = await run(seed())
    expect(res.status).toBe('credited')
    expect(stripe.invoices.pay).not.toHaveBeenCalled()
  })

  it('a lost response for a payment that went through is credited, not reported as a failure', async () => {
    stripe.invoices.pay.mockRejectedValue(Object.assign(new Error('socket hang up'), { type: 'StripeConnectionError' }))
    stripe.invoices.retrieve.mockResolvedValue({ id: 'in_1', status: 'paid', amount_paid: 9600, currency: 'usd' })
    const db = seed()
    const res = await run(db)
    expect(res).toMatchObject({ status: 'credited', invoiceId: 'in_1' })
    expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled()
    expect(db.tables.organizations[0]).toMatchObject({ auto_topup_enabled: true, auto_topup_failure: null })
  })

  it('a failed credit write leaves the paid invoice to the invoice.paid webhook', async () => {
    const db = memoryDb({ organizations: [org()], minute_purchases: [] }, {
      rpc: (fn, args, tables) => (fn === 'credit_minute_purchase' ? { data: null, error: { message: 'connection reset' } } : rpc(fn, args, tables)),
    })
    const res = await maybeAutoTopUp(db as never, ORG, logger(), { stripe: stripe as never })
    expect(res).toEqual({ status: 'paid', minutes: 500, amountCents: 9600, invoiceId: 'in_1' })
  })
})

describe('maybeAutoTopUp: nothing to do', () => {
  it.each([
    ['disabled', { auto_topup_enabled: false }, 'disabled'],
    ['on the trial', { plan: 'trial', minutes_limit: 5, minutes_used: 5 }, 'not_available'],
    ['without a plan subscription', { stripe_subscription_id: null }, 'not_available'],
    ['while the account is being deleted', { deletion_requested_at: '2026-10-14T10:00:00Z' }, 'not_available'],
    ['above the threshold', { minutes_used: 100 }, 'above_threshold'],
    ['above the threshold thanks to extra minutes', { extra_minutes_balance: 60 }, 'above_threshold'],
    ['without a valid pack', { auto_topup_pack: 42 }, 'invalid_pack'],
  ])('%s', async (_label, over, reason) => {
    const res = await run(seed([org(over)]))
    expect(res).toEqual({ status: 'skipped', reason })
    expect(stripe.invoices.create).not.toHaveBeenCalled()
  })

  it('the default threshold (50 minutes) applies when none was saved', async () => {
    expect(await run(seed([org({ auto_topup_threshold: null, minutes_used: 790 })]))).toEqual({ status: 'skipped', reason: 'above_threshold' })
    expect((await run(seed([org({ auto_topup_threshold: null, minutes_used: 810 })]))).status).toBe('credited')
  })

  it('one attempt per cooldown: a concurrent or recent attempt holds the claim', async () => {
    const recent = new Date(Date.now() - 60_000).toISOString()
    const res = await run(seed([org({ auto_topup_last_attempt_at: recent })]))
    expect(res).toEqual({ status: 'skipped', reason: 'cooldown' })
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()

    const db = seed()
    await run(db)
    expect(await run(db)).toMatchObject({ status: 'skipped' })
    expect(stripe.invoices.create).toHaveBeenCalledTimes(1)
  })
})

describe('maybeAutoTopUp: failure', () => {
  it('a declined card voids the invoice, records the failure, turns auto top-up off and e-mails the owner', async () => {
    stripe.invoices.pay.mockRejectedValue(Object.assign(new Error('Your card was declined.'), { type: 'StripeCardError', code: 'card_declined' }))
    const db = seed()
    const res = await run(db)
    expect(res).toEqual({ status: 'failed', minutes: 500, reason: 'Your card was declined.' })
    expect(stripe.invoices.voidInvoice).toHaveBeenCalledWith('in_1')
    expect(db.tables.minute_purchases).toEqual([
      expect.objectContaining({ org_id: ORG, minutes: 500, amount_cents: 9600, currency: 'usd', source: 'auto_topup', status: 'failed', stripe_invoice_id: 'in_1', failure_message: 'Your card was declined.' }),
    ])
    expect(db.tables.organizations[0]).toMatchObject({ auto_topup_enabled: false, auto_topup_failure: 'Your card was declined.', extra_minutes_balance: 0 })
    expect(db.tables.organizations[0].auto_topup_failed_at).toEqual(expect.any(String))
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: 'owner@example.com', subject: 'Action needed: auto top-up failed' })

    // Never retried automatically: the next usage finds it turned off.
    expect(await run(db)).toEqual({ status: 'skipped', reason: 'disabled' })
    expect(stripe.invoices.pay).toHaveBeenCalledTimes(1)
  })

  it('without a saved payment method nothing is invoiced and the owner is told why', async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_1', default_payment_method: null })
    stripe.customers.retrieve.mockResolvedValue({ id: 'cus_1', invoice_settings: { default_payment_method: null } })
    const db = seed()
    const res = await run(db)
    expect(res).toMatchObject({ status: 'failed', reason: expect.stringContaining('No saved payment method') })
    expect(stripe.invoices.create).not.toHaveBeenCalled()
    expect(db.tables.minute_purchases[0]).toMatchObject({ status: 'failed', stripe_invoice_id: null })
    expect(db.tables.organizations[0]).toMatchObject({ auto_topup_enabled: false })
  })

  it('a draft invoice left by a failure before finalization is deleted', async () => {
    stripe.invoiceItems.create.mockRejectedValue(Object.assign(new Error('No such customer'), { type: 'StripeInvalidRequestError', statusCode: 400 }))
    stripe.invoices.retrieve.mockResolvedValue({ id: 'in_1', status: 'draft' })
    const res = await run(seed())
    expect(res).toMatchObject({ status: 'failed', reason: 'The payment could not be completed.' })
    expect(stripe.invoices.del).toHaveBeenCalledWith('in_1')
  })

  it('an invoice Stripe left unpaid is a payment failure', async () => {
    stripe.invoices.pay.mockResolvedValue({ id: 'in_1', status: 'open' })
    const db = seed()
    expect(await run(db)).toMatchObject({ status: 'failed', reason: 'The payment could not be completed.' })
    expect(stripe.invoices.voidInvoice).toHaveBeenCalledWith('in_1')
    expect(db.tables.organizations[0]).toMatchObject({ auto_topup_enabled: false })
  })
})

describe('maybeAutoTopUp: Stripe unavailable (no payment was refused)', () => {
  it.each([
    ['a Stripe 5xx before any invoice', () => stripe.subscriptions.retrieve.mockRejectedValue(Object.assign(new Error('Something went wrong on our end.'), { type: 'StripeAPIError', statusCode: 500 }))],
    ['a network failure creating the invoice', () => stripe.invoices.create.mockRejectedValue(Object.assign(new Error('socket hang up'), { type: 'StripeConnectionError' }))],
    ['a rate limit', () => stripe.invoices.create.mockRejectedValue(Object.assign(new Error('Too many requests'), { type: 'StripeRateLimitError', statusCode: 429 }))],
    ['a lock timeout (409)', () => stripe.invoices.create.mockRejectedValue(Object.assign(new Error('lock timeout'), { type: 'StripeInvalidRequestError', statusCode: 409, code: 'lock_timeout' }))],
    ['our own API key rejected', () => stripe.subscriptions.retrieve.mockRejectedValue(Object.assign(new Error('Invalid API Key provided: sk_live_****'), { type: 'StripeAuthenticationError', statusCode: 401 }))],
  ])('%s: nothing recorded, no e-mail, auto top-up stays on', async (_label, arrange) => {
    arrange()
    const db = seed()
    const res = await run(db)
    expect(res).toEqual({ status: 'skipped', reason: 'stripe_unavailable' })
    expect(db.tables.minute_purchases).toEqual([])
    expect(db.tables.organizations[0]).toMatchObject({ auto_topup_enabled: true, auto_topup_failed_at: null, auto_topup_failure: null, extra_minutes_balance: 0 })
    expect(sendEmail).not.toHaveBeenCalled()
    // The claim still holds the cooldown: no second attempt right away.
    expect(await run(db)).toEqual({ status: 'skipped', reason: 'cooldown' })
  })

  it('an unpaid invoice left by a Stripe outage is voided so it is never collected later', async () => {
    stripe.invoices.pay.mockRejectedValue(Object.assign(new Error('Something went wrong on our end.'), { type: 'StripeAPIError', statusCode: 500 }))
    stripe.invoices.retrieve.mockResolvedValue({ id: 'in_1', status: 'open' })
    const db = seed()
    expect(await run(db)).toEqual({ status: 'skipped', reason: 'stripe_unavailable' })
    expect(stripe.invoices.voidInvoice).toHaveBeenCalledWith('in_1')
    expect(db.tables.organizations[0]).toMatchObject({ auto_topup_enabled: true })
  })

  it('topUpFailureKind: payment problems need the owner, everything else is transient', () => {
    expect(topUpFailureKind(Object.assign(new Error('declined'), { type: 'StripeCardError' }))).toBe('payment')
    expect(topUpFailureKind(Object.assign(new Error('confirm'), { code: 'authentication_required' }))).toBe('payment')
    expect(topUpFailureKind(Object.assign(new Error('No such PaymentMethod'), { type: 'StripeInvalidRequestError', statusCode: 400 }))).toBe('payment')
    expect(topUpFailureKind(Object.assign(new Error('down'), { type: 'StripeAPIError', statusCode: 503 }))).toBe('transient')
    expect(topUpFailureKind(Object.assign(new Error('timeout'), { type: 'StripeConnectionError' }))).toBe('transient')
    expect(topUpFailureKind(Object.assign(new Error('replay'), { type: 'StripeIdempotencyError', statusCode: 400 }))).toBe('transient')
    expect(topUpFailureKind(new TypeError('fetch failed'))).toBe('transient')
  })
})

describe('maybeAutoTopUp: a threshold above the pack size', () => {
  it('acts as the pack size: one pack per depletion, never a charge every cooldown until the threshold', async () => {
    // Threshold 1,000 with 100-minute packs and 50 minutes left: one pack brings it to 150 ≥ 100.
    const db = seed([org({ auto_topup_pack: 100, auto_topup_threshold: 1000, minutes_used: 800, minutes_limit: 850 })])
    expect((await run(db)).status).toBe('credited')
    expect(db.tables.organizations[0]).toMatchObject({ extra_minutes_balance: 100 })
    // After the cooldown, with 150 minutes left, nothing is charged again.
    db.tables.organizations[0].auto_topup_last_attempt_at = new Date(Date.now() - (AUTO_TOPUP_COOLDOWN_SECONDS + 60) * 1000).toISOString()
    expect(await run(db)).toEqual({ status: 'skipped', reason: 'above_threshold' })
    expect(stripe.invoices.create).toHaveBeenCalledTimes(1)
    expect(effectiveAutoTopUpThreshold(1000, 100)).toBe(100)
    expect(effectiveAutoTopUpThreshold(50, 500)).toBe(50)
    expect(effectiveAutoTopUpThreshold(null, 500)).toBe(50)
  })
})

describe('autoTopUpFailureMessage', () => {
  it('keeps card messages, explains authentication, and hides everything else', () => {
    expect(autoTopUpFailureMessage(Object.assign(new Error('Your card has insufficient funds.'), { type: 'StripeCardError' }))).toBe('Your card has insufficient funds.')
    expect(autoTopUpFailureMessage(Object.assign(new Error('requires action'), { code: 'invoice_payment_intent_requires_action' }))).toContain('asked to confirm this payment')
    expect(autoTopUpFailureMessage(Object.assign(new Error('Invalid API Key provided: sk_live_****'), { type: 'StripeAuthenticationError' }))).toBe('The payment could not be completed.')
    expect(autoTopUpFailureMessage(null)).toBe('The payment could not be completed.')
  })
})

describe('sweepAutoTopUps (cron)', () => {
  it('tops up the organizations below their threshold and outside the cooldown, until the deadline', async () => {
    const recent = new Date(Date.now() - 60_000).toISOString()
    const old = new Date(Date.now() - (AUTO_TOPUP_COOLDOWN_SECONDS + 60) * 1000).toISOString()
    const db = seed([
      org(),
      org({ id: 'org-high', minutes_used: 10 }),
      org({ id: 'org-cooling', auto_topup_last_attempt_at: recent }),
      org({ id: 'org-off', auto_topup_enabled: false }),
      org({ id: 'org-old-attempt', auto_topup_last_attempt_at: old, stripe_customer_id: 'cus_2' }),
    ])
    const report = await sweepAutoTopUps(db as never, logger(), Date.now() + 60_000, { stripe: stripe as never })
    expect(report).toEqual({ checked: 4, attempted: 2, credited: 2, failed: 0, deferred: 0 })
    expect(stripe.invoices.create.mock.calls.map((c) => (c[0] as { customer: string }).customer).sort()).toEqual(['cus_1', 'cus_2'])
  })

  it('defers everything once the deadline has passed', async () => {
    const report = await sweepAutoTopUps(seed() as never, logger(), Date.now() - 1, { stripe: stripe as never })
    expect(report).toEqual({ checked: 1, attempted: 0, credited: 0, failed: 0, deferred: 1 })
    expect(stripe.invoices.create).not.toHaveBeenCalled()
  })

  it('does nothing without Stripe', async () => {
    expect(await sweepAutoTopUps(seed() as never, logger(), Date.now() + 60_000)).toEqual({ checked: 0, attempted: 0, credited: 0, failed: 0, deferred: 0 })
  })
})
