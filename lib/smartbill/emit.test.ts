import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { fakeDb, type FakeCall } from '@/tests/helpers/fake-db'

// One-time Stripe invoices (extra-minute packs: the invoice Checkout issues
// for a pack, and auto top-up invoices) go through the same SmartBill path as
// subscription payments: the organization comes from the invoice metadata,
// the product line from the invoice line description.

const create = vi.fn()
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  isConfigured: () => true,
  invoices: { create: (...a: unknown[]) => create(...a) },
}))

import { emitInvoiceForStripePayment } from './emit'
import { SmartBillError } from './client'

const ORG = '11111111-1111-4111-8111-111111111111'

function packInvoice(over: Record<string, unknown> = {}): Stripe.Invoice {
  return {
    id: 'in_pack',
    customer: 'cus_1',
    customer_email: 'owner@example.com',
    customer_name: 'Acme SRL',
    customer_address: { line1: 'Str. Exemplu 1', line2: null, city: 'Cluj-Napoca', state: 'CJ', country: 'RO', postal_code: '400000' },
    customer_tax_ids: [{ type: 'eu_vat', value: 'RO12345678' }],
    amount_paid: 12000,
    currency: 'usd',
    created: 1_791_000_000,
    billing_reason: 'manual',
    parent: null,
    metadata: { type: 'minute_pack', source: 'auto_topup', org_id: ORG, minutes: '500', plan: 'pro' },
    lines: { data: [{ description: '500 extra minutes' }] },
    ...over,
  } as unknown as Stripe.Invoice
}

beforeEach(() => {
  vi.stubEnv('SMARTBILL_COMPANY_VAT_CODE', 'RO99999999')
  vi.stubEnv('SMARTBILL_SERIES', 'NTV')
  create.mockReset().mockResolvedValue({ series: 'NTV', number: '0042', url: 'https://smartbill.example/0042.pdf' })
})

describe('emitInvoiceForStripePayment: one-time invoices', () => {
  it('an auto top-up invoice is emitted for its organization with the pack as the product line', async () => {
    const db = fakeDb(() => ({ data: null, error: null }))
    await emitInvoiceForStripePayment(db as never, packInvoice())
    expect(create).toHaveBeenCalledTimes(1)
    const params = create.mock.calls[0][0] as { currency: string; client: Record<string, unknown>; products: Array<Record<string, unknown>>; payment: Record<string, unknown> }
    expect(params.currency).toBe('USD')
    expect(params.client).toMatchObject({ name: 'Acme SRL', vatCode: 'RO12345678', isTaxPayer: true, city: 'Cluj-Napoca', country: 'Romania' })
    expect(params.products).toEqual([expect.objectContaining({ name: '500 extra minutes', quantity: 1, price: 120, currency: 'USD' })])
    expect(params.payment).toMatchObject({ value: 120, type: 'Card' })
    // The row is claimed before SmartBill is called, then completed with the fiscal number.
    const insert = db.calls.find((c: FakeCall) => c.table === 'invoices' && c.op === 'insert')
    expect(insert?.payload).toMatchObject({ org_id: ORG, stripe_invoice_id: 'in_pack', status: 'failed', error: expect.stringMatching(/^unconfirmed:/), amount: 120 })
    const done = db.calls.find((c: FakeCall) => c.table === 'invoices' && c.op === 'update')
    expect(done?.payload).toMatchObject({ status: 'issued', error: null, smartbill_series: 'NTV', smartbill_number: '0042', pdf_url: 'https://smartbill.example/0042.pdf' })
    expect(done?.filters).toEqual([['eq', 'stripe_invoice_id', 'in_pack']])
    // The organization came from the invoice metadata: no lookup by customer.
    expect(db.calls.some((c: FakeCall) => c.table === 'organizations')).toBe(false)
  })

  it('the invoice Checkout issues for a pack (no source) is emitted the same way, once', async () => {
    const db = fakeDb(() => ({ data: null, error: null }))
    await emitInvoiceForStripePayment(db as never, packInvoice({ id: 'in_checkout', metadata: { type: 'minute_pack', org_id: ORG, minutes: '100', plan: 'store_growth' }, amount_paid: 2200, lines: { data: [{ description: '100 extra minutes' }] } }))
    expect(create.mock.calls[0][0]).toMatchObject({ products: [expect.objectContaining({ name: '100 extra minutes', price: 22 })] })

    const already = fakeDb((c) => (c.table === 'invoices' && c.op === 'select' ? { data: { id: 'inv-row', status: 'issued', error: null }, error: null } : { data: null, error: null }))
    create.mockClear()
    await emitInvoiceForStripePayment(already as never, packInvoice())
    expect(create).not.toHaveBeenCalled()
  })

  it('without metadata the organization is found by its Stripe customer', async () => {
    const db = fakeDb((c) => (c.table === 'organizations' ? { data: { id: ORG, name: 'Acme' }, error: null } : { data: null, error: null }))
    await emitInvoiceForStripePayment(db as never, packInvoice({ metadata: {} }))
    const lookup = db.calls.find((c: FakeCall) => c.table === 'organizations')
    expect(lookup?.filters).toEqual([['eq', 'stripe_customer_id', 'cus_1']])
    expect(db.calls.find((c: FakeCall) => c.table === 'invoices' && c.op === 'insert')?.payload).toMatchObject({ org_id: ORG })
  })
})

// ─── Subscription invoices, failures and retries ──────────────────────────────

describe('emitInvoiceForStripePayment: subscription invoices', () => {
  it('the organization comes from the subscription metadata the invoice carries (no customer lookup)', async () => {
    const db = fakeDb(() => ({ data: null, error: null }))
    await emitInvoiceForStripePayment(db as never, packInvoice({
      id: 'in_sub',
      metadata: {},
      billing_reason: 'subscription_cycle',
      parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_1', metadata: { org_id: ORG, ntv_plan: 'pro' } } },
    }))
    expect(db.calls.some((c: FakeCall) => c.table === 'organizations')).toBe(false)
    expect(db.calls.find((c: FakeCall) => c.op === 'insert')?.payload).toMatchObject({ org_id: ORG, stripe_invoice_id: 'in_sub' })
  })

  it('a prorated upgrade invoice names the new plan\'s line, not the old plan\'s unused time', async () => {
    const db = fakeDb(() => ({ data: null, error: null }))
    await emitInvoiceForStripePayment(db as never, packInvoice({
      id: 'in_upgrade',
      billing_reason: 'subscription_update',
      amount_paid: 10000,
      lines: { data: [{ amount: -2450, description: 'Unused time on Starter after 1 Oct 2026' }, { amount: 12450, description: 'Remaining time on Pro after 1 Oct 2026' }] },
    }))
    expect(create.mock.calls[0][0]).toMatchObject({ products: [expect.objectContaining({ name: 'Remaining time on Pro after 1 Oct 2026', price: 100 })] })
  })
})

describe('emitInvoiceForStripePayment: failures stay on the row and only confirmed ones are retried', () => {
  /** A database with one invoices row (or none), recording every call. */
  function withRow(row: Record<string, unknown> | null, over: (c: FakeCall) => { data: unknown; error: { message: string; code?: string } | null } | undefined = () => undefined) {
    return fakeDb((c) => over(c) ?? (c.table === 'invoices' && c.op === 'select' ? { data: row, error: null } : c.op === 'update' ? { data: [{ id: 'inv-row' }], error: null } : { data: null, error: null }))
  }
  const updates = (db: ReturnType<typeof fakeDb>) => db.calls.filter((c: FakeCall) => c.table === 'invoices' && c.op === 'update')

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('a refusal SmartBill confirmed is recorded with its reason, and the next delivery emits it again on the same row', async () => {
    create.mockRejectedValueOnce(new SmartBillError(400, 'Seria NTV nu exista', '/invoice'))
    const first = withRow(null)
    await emitInvoiceForStripePayment(first as never, packInvoice())
    expect(updates(first).map((c) => c.payload)).toEqual([{ error: '400: Seria NTV nu exista' }])

    // The replay (a Stripe retry, or "Resend" in the Dashboard): claimed while it still holds that failure, then issued.
    const replay = withRow({ id: 'inv-row', status: 'failed', error: '400: Seria NTV nu exista' })
    await emitInvoiceForStripePayment(replay as never, packInvoice())
    expect(create).toHaveBeenCalledTimes(2)
    const [claim, done] = updates(replay)
    expect(claim.payload).toEqual({ error: expect.stringMatching(/^unconfirmed:/) })
    expect(claim.filters).toEqual([['eq', 'id', 'inv-row'], ['eq', 'status', 'failed'], ['eq', 'error', '400: Seria NTV nu exista']])
    expect(done.payload).toMatchObject({ status: 'issued', smartbill_number: '0042', error: null })
    expect(replay.calls.some((c: FakeCall) => c.op === 'insert')).toBe(false)
  })

  it('an errorText answer is a refusal too', async () => {
    create.mockRejectedValueOnce(new SmartBillError(200, 'Clientul nu are CIF valid', '/invoice', true))
    const db = withRow(null)
    await emitInvoiceForStripePayment(db as never, packInvoice())
    expect(updates(db).map((c) => c.payload)).toEqual([{ error: '200: Clientul nu are CIF valid' }])
  })

  it.each([
    ['a timeout', Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })],
    ['a 5xx', new SmartBillError(502, 'Bad gateway', '/invoice')],
    ['an unreadable answer', new SmartBillError(200, '<html>', '/invoice', false)],
  ])('%s may have issued it: recorded as unconfirmed and never emitted again automatically', async (_label, err) => {
    create.mockRejectedValueOnce(err)
    const first = withRow(null)
    await emitInvoiceForStripePayment(first as never, packInvoice())
    const [failure] = updates(first)
    expect(String((failure.payload as { error: string }).error)).toMatch(/^unconfirmed: /)

    const replay = withRow({ id: 'inv-row', status: 'failed', error: (failure.payload as { error: string }).error })
    await emitInvoiceForStripePayment(replay as never, packInvoice())
    expect(create).toHaveBeenCalledTimes(1)
    expect(updates(replay)).toHaveLength(0)
  })

  it('a claim another delivery holds (still running or interrupted) is left alone', async () => {
    const running = withRow({ id: 'inv-row', status: 'failed', error: 'unconfirmed: emission started, no answer recorded' })
    await emitInvoiceForStripePayment(running as never, packInvoice())
    expect(create).not.toHaveBeenCalled()
  })

  it('losing the claim to a concurrent delivery calls SmartBill not at all', async () => {
    const insertRace = withRow(null, (c) => (c.op === 'insert' ? { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } } : undefined))
    await emitInvoiceForStripePayment(insertRace as never, packInvoice())
    const retryRace = withRow({ id: 'inv-row', status: 'failed', error: '400: x' }, (c) => (c.op === 'update' ? { data: [], error: null } : undefined))
    await emitInvoiceForStripePayment(retryRace as never, packInvoice())
    expect(create).not.toHaveBeenCalled()
  })

  it('a database error before SmartBill is called is thrown (the webhook answers 500 and Stripe retries; nothing was issued)', async () => {
    const readFails = withRow(null, (c) => (c.op === 'select' ? { data: null, error: { message: 'connection reset' } } : undefined))
    await expect(emitInvoiceForStripePayment(readFails as never, packInvoice())).rejects.toThrow('invoices read failed')
    const claimFails = withRow(null, (c) => (c.op === 'insert' ? { data: null, error: { message: 'connection reset' } } : undefined))
    await expect(emitInvoiceForStripePayment(claimFails as never, packInvoice())).rejects.toThrow('invoices claim failed')
    expect(create).not.toHaveBeenCalled()
  })

  it('a failed write after SmartBill issued it is logged with the number, not thrown, and the claim stays (no second invoice on a retry)', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = withRow(null, (c) => (c.op === 'update' ? { data: null, error: { message: 'connection reset' } } : undefined))
    await expect(emitInvoiceForStripePayment(db as never, packInvoice())).resolves.toBeUndefined()
    const line = errorLog.mock.calls.map((c) => String(c[0])).find((l) => l.includes('smartbill.invoice_record_failed'))
    expect(line).toBeDefined()
    expect(JSON.parse(line!)).toMatchObject({ stripeInvoiceId: 'in_pack', series: 'NTV', number: '0042' })
  })
})
