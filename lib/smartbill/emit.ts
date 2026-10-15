// ─── Stripe → SmartBill bridge ───────────────────────────────────────────────
// Emits a SmartBill fiscal invoice from a paid Stripe invoice and records the
// result in our `invoices` table, one row per Stripe invoice id (UNIQUE). The
// row is claimed before SmartBill is called, so a retried or concurrent
// webhook never emits twice. A failed emission is kept on its row:
//   • SmartBill refused it (an HTTP 4xx or an errorText: nothing was issued):
//     status 'failed' with the reason, and the next delivery of the same
//     invoice.paid (a Stripe retry, or "Resend" in the Stripe Dashboard)
//     emits it again on that row;
//   • no readable answer (a timeout, the network, a 5xx): SmartBill may have
//     issued it, so the error starts with "unconfirmed:" and it is never
//     emitted again automatically (a second fiscal invoice needs a storno). A
//     human checks SmartBill, then fills in the number or removes the prefix
//     so the next delivery retries it. A claim whose run never finished keeps
//     the same prefix, for the same reason.

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { invoices as sbInvoices, isConfigured, SmartBillError } from './client'
import { createLogger } from '@/lib/observability/logger'

/** Map an ISO 3166-1 alpha-2 code to the country name SmartBill expects. */
const COUNTRY_NAMES: Record<string, string> = {
  RO: 'Romania',
  MD: 'Republica Moldova',
}

/** `error` prefix of an emission SmartBill never confirmed either way: never retried automatically. */
const UNCONFIRMED = 'unconfirmed:'
/** `error` of a claimed row while its emission runs. */
const CLAIMED = `${UNCONFIRMED} emission started, no answer recorded`

function countryName(code: string | null | undefined): string {
  if (!code) return 'Romania'
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase()
}

function customerIdOf(invoice: Stripe.Invoice): string | undefined {
  if (!invoice.customer) return undefined
  return typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id
}

async function resolveOrgId(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice
): Promise<string | undefined> {
  // Prefer org_id stamped on the invoice (one-time packs) or on its
  // subscription (Checkout copies it there).
  const meta = invoice.metadata?.org_id ?? invoice.parent?.subscription_details?.metadata?.org_id
  if (meta) return meta

  // Fall back to the Stripe customer id we stored at checkout.
  const customerId = customerIdOf(invoice)
  if (!customerId) return undefined
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (error) throw new Error(`organizations read failed: ${error.message}`)
  return data?.id
}

/**
 * The line the invoice is mostly for: the largest positive amount. An
 * immediate upgrade's prorated invoice lists the old plan's unused time (a
 * negative line) first, which would name the plan being left.
 */
function principalLine(invoice: Stripe.Invoice): Stripe.InvoiceLineItem | undefined {
  const lines = invoice.lines?.data ?? []
  return lines.reduce<Stripe.InvoiceLineItem | undefined>(
    (best, line) => ((line.amount ?? 0) > (best?.amount ?? 0) ? line : best),
    undefined,
  ) ?? lines[0]
}

interface InvoiceRow {
  id: string
  status: string | null
  error: string | null
}

/** A failure SmartBill confirmed (it refused the invoice): safe to emit again. */
function isRetryable(row: InvoiceRow): boolean {
  return row.status === 'failed' && !!row.error && !row.error.startsWith(UNCONFIRMED)
}

/**
 * Emit a SmartBill invoice for a paid Stripe invoice. Safe to call from the
 * Stripe webhook — no-ops when SmartBill isn't configured, the amount is zero,
 * or an invoice was already emitted (or is being emitted) for this Stripe
 * invoice id. Throws only before SmartBill is called (a database error while
 * claiming), so the webhook's retry can never issue a second invoice.
 */
export async function emitInvoiceForStripePayment(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice
): Promise<void> {
  if (!isConfigured()) return
  if (!invoice.id) return
  if ((invoice.amount_paid ?? 0) <= 0) return
  const log = createLogger({ component: 'smartbill', stripeInvoiceId: invoice.id })

  const { data: existing, error: readErr } = await supabase
    .from('invoices')
    .select('id, status, error')
    .eq('stripe_invoice_id', invoice.id)
    .maybeSingle()
  if (readErr) throw new Error(`invoices read failed: ${readErr.message}`)

  // Stripe amounts are in minor units (bani / cents).
  const amount = (invoice.amount_paid ?? 0) / 100
  const currency = (invoice.currency ?? 'ron').toUpperCase()

  // Buyer fiscal data from the Stripe customer snapshot on the invoice.
  const addr = invoice.customer_address
  const taxId: string | undefined =
    invoice.customer_tax_ids?.find((t) => t.value)?.value ?? undefined
  const clientName = invoice.customer_name ?? 'Client'
  const addressLine = [addr?.line1, addr?.line2].filter(Boolean).join(', ')

  // Claim the row: SmartBill is called only by the run that holds it.
  if (existing) {
    const row = existing as InvoiceRow
    if (!isRetryable(row)) {
      if (row.status === 'failed') log.warn('smartbill.emission_unconfirmed')
      return
    }
    // Taken over only while it still holds the failure this run read.
    const { data: taken, error } = await supabase
      .from('invoices')
      .update({ error: CLAIMED })
      .eq('id', row.id)
      .eq('status', 'failed')
      .eq('error', row.error)
      .select('id')
    if (error) throw new Error(`invoices claim failed: ${error.message}`)
    if (!Array.isArray(taken) || taken.length === 0) return
  } else {
    const orgId = await resolveOrgId(supabase, invoice)
    if (!orgId) {
      log.warn('smartbill.org_unresolved')
      return
    }
    const { error } = await supabase.from('invoices').insert({
      org_id: orgId,
      stripe_invoice_id: invoice.id,
      amount,
      currency,
      status: 'failed',
      error: CLAIMED,
      client_name: clientName,
      client_vat_code: taxId ?? null,
    })
    if (error) {
      // Another delivery of the same invoice claimed it first.
      if (error.code === '23505') return
      throw new Error(`invoices claim failed: ${error.message}`)
    }
  }

  const companyVatCode = process.env.SMARTBILL_COMPANY_VAT_CODE!
  const seriesName = process.env.SMARTBILL_SERIES!
  const taxPercentage = Number(process.env.SMARTBILL_TAX_PERCENTAGE ?? '0')
  const taxName = process.env.SMARTBILL_TAX_NAME ?? 'Normala'
  const language = process.env.SMARTBILL_LANGUAGE ?? 'RO'

  const lineDescription =
    principalLine(invoice)?.description ?? `Abonament Neuro Tech Voice`

  const issueDate = new Date((invoice.created ?? Date.now() / 1000) * 1000)
    .toISOString()
    .slice(0, 10)

  const record = async (fields: Record<string, unknown>) => {
    const { error } = await supabase.from('invoices').update(fields).eq('stripe_invoice_id', invoice.id)
    return error
  }

  let res: Awaited<ReturnType<typeof sbInvoices.create>>
  try {
    res = await sbInvoices.create({
      companyVatCode,
      seriesName,
      issueDate,
      isDraft: false,
      currency,
      language,
      precision: 2,
      useStock: false,
      client: {
        name: clientName,
        vatCode: taxId,
        isTaxPayer: !!taxId,
        address: addressLine || undefined,
        city: addr?.city ?? undefined,
        county: addr?.state ?? undefined,
        country: countryName(addr?.country),
        email: invoice.customer_email ?? undefined,
        saveToDb: true,
      },
      products: [
        {
          name: lineDescription,
          measuringUnitName: 'buc',
          currency,
          quantity: 1,
          price: amount,
          isTaxIncluded: true,
          taxName,
          taxPercentage,
          isService: true,
          saveToDb: false,
        },
      ],
      // Stripe already collected the money by card → record it as paid.
      payment: { value: amount, type: 'Card', isCash: false },
    })
  } catch (err) {
    const refused = err instanceof SmartBillError && err.refused
    const reason = (
      err instanceof SmartBillError
        ? `${err.status}: ${err.body}`
        : err instanceof Error
          ? `${err.name}: ${err.message}`
          : 'unknown error'
    ).slice(0, 300)
    log.error('smartbill.emission_failed', undefined, {
      refused,
      status: err instanceof SmartBillError ? err.status : null,
      errorType: err instanceof Error ? err.name : typeof err,
    })
    // Refused: retried by the next delivery. No answer: waits for a human.
    const writeErr = await record({ error: refused ? reason : `${UNCONFIRMED} ${reason}` })
    if (writeErr) log.error('smartbill.failure_record_failed', writeErr)
    return
  }

  const writeErr = await record({
    smartbill_series: res.series,
    smartbill_number: res.number,
    status: 'issued',
    error: null,
    pdf_url: res.url ?? null,
    issued_at: new Date().toISOString(),
  })
  if (writeErr) {
    // Not thrown: SmartBill issued it, and the row keeps its "unconfirmed"
    // claim, so no retry can issue it twice. A human records the number.
    log.error('smartbill.invoice_record_failed', writeErr, { series: res.series, number: res.number })
  }
}
