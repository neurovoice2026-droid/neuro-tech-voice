// ─── Stripe → SmartBill bridge ───────────────────────────────────────────────
// Emits a SmartBill fiscal invoice from a paid Stripe invoice and records the
// result in our `invoices` table. Idempotent on the Stripe invoice id so a
// retried webhook never double-emits.

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { invoices as sbInvoices, isConfigured, SmartBillError } from './client'

/** Map an ISO 3166-1 alpha-2 code to the country name SmartBill expects. */
const COUNTRY_NAMES: Record<string, string> = {
  RO: 'Romania',
  MD: 'Republica Moldova',
}

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
  // Prefer org_id stamped on the subscription/invoice metadata.
  const meta =
    invoice.metadata?.org_id ??
    (invoice as unknown as { subscription_details?: { metadata?: Record<string, string> } })
      .subscription_details?.metadata?.org_id
  if (meta) return meta

  // Fall back to the Stripe customer id we stored at checkout.
  const customerId = customerIdOf(invoice)
  if (!customerId) return undefined
  const { data } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return data?.id
}

/**
 * Emit a SmartBill invoice for a paid Stripe invoice. Safe to call from the
 * Stripe webhook — no-ops when SmartBill isn't configured, the amount is zero,
 * or an invoice was already emitted for this Stripe invoice id.
 */
export async function emitInvoiceForStripePayment(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice
): Promise<void> {
  if (!isConfigured()) return
  if (!invoice.id) return
  if ((invoice.amount_paid ?? 0) <= 0) return

  // Idempotency guard.
  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('stripe_invoice_id', invoice.id)
    .maybeSingle()
  if (existing) return

  const orgId = await resolveOrgId(supabase, invoice)
  if (!orgId) {
    console.warn(`SmartBill: cannot resolve organization for Stripe invoice ${invoice.id}`)
    return
  }

  const companyVatCode = process.env.SMARTBILL_COMPANY_VAT_CODE!
  const seriesName = process.env.SMARTBILL_SERIES!
  const taxPercentage = Number(process.env.SMARTBILL_TAX_PERCENTAGE ?? '0')
  const taxName = process.env.SMARTBILL_TAX_NAME ?? 'Normala'
  const language = process.env.SMARTBILL_LANGUAGE ?? 'RO'

  // Stripe amounts are in minor units (bani / cents).
  const amount = (invoice.amount_paid ?? 0) / 100
  const currency = (invoice.currency ?? 'ron').toUpperCase()

  // Buyer fiscal data from the Stripe customer snapshot on the invoice.
  const addr = invoice.customer_address
  const taxId: string | undefined =
    invoice.customer_tax_ids?.find((t) => t.value)?.value ?? undefined
  const clientName = invoice.customer_name ?? 'Client'
  const addressLine = [addr?.line1, addr?.line2].filter(Boolean).join(', ')

  const lineDescription =
    invoice.lines?.data?.[0]?.description ?? `Abonament Neuro Tech Voice`

  const issueDate = new Date((invoice.created ?? Date.now() / 1000) * 1000)
    .toISOString()
    .slice(0, 10)

  try {
    const res = await sbInvoices.create({
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

    await supabase.from('invoices').insert({
      org_id: orgId,
      stripe_invoice_id: invoice.id,
      smartbill_series: res.series,
      smartbill_number: res.number,
      amount,
      currency,
      status: 'issued',
      pdf_url: res.url ?? null,
      client_name: clientName,
      client_vat_code: taxId ?? null,
    })
  } catch (err) {
    const message =
      err instanceof SmartBillError
        ? `${err.status}: ${err.body}`
        : err instanceof Error
          ? err.message
          : 'unknown error'
    console.error(`SmartBill: failed to emit invoice for ${invoice.id}:`, message)

    // Record the failure so it surfaces in the dashboard and can be retried.
    await supabase.from('invoices').insert({
      org_id: orgId,
      stripe_invoice_id: invoice.id,
      amount,
      currency,
      status: 'failed',
      error: message,
      client_name: clientName,
      client_vat_code: taxId ?? null,
    })
  }
}
