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
    const insert = db.calls.find((c: FakeCall) => c.table === 'invoices' && c.op === 'insert')
    expect(insert?.payload).toMatchObject({ org_id: ORG, stripe_invoice_id: 'in_pack', status: 'issued', smartbill_number: '0042', amount: 120 })
    // The organization came from the invoice metadata: no lookup by customer.
    expect(db.calls.some((c: FakeCall) => c.table === 'organizations')).toBe(false)
  })

  it('the invoice Checkout issues for a pack (no source) is emitted the same way, once', async () => {
    const db = fakeDb(() => ({ data: null, error: null }))
    await emitInvoiceForStripePayment(db as never, packInvoice({ id: 'in_checkout', metadata: { type: 'minute_pack', org_id: ORG, minutes: '100', plan: 'store_growth' }, amount_paid: 2200, lines: { data: [{ description: '100 extra minutes' }] } }))
    expect(create.mock.calls[0][0]).toMatchObject({ products: [expect.objectContaining({ name: '100 extra minutes', price: 22 })] })

    const already = fakeDb((c) => (c.table === 'invoices' && c.op === 'select' ? { data: { id: 'inv-row' }, error: null } : { data: null, error: null }))
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
