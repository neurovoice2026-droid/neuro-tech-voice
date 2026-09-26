import { AlertTriangle, Download, FileText } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { formatDay, formatMoney } from './format'

export interface BillingInvoice {
  id: string
  smartbill_series: string | null
  smartbill_number: string | null
  amount: number | null
  currency: string | null
  status: 'issued' | 'failed' | 'reversed' | null
  pdf_url: string | null
  issued_at: string | null
  created_at: string | null
}

interface InvoicesListProps {
  invoices: BillingInvoice[]
  failed: boolean
  timeZone: string
  hasBillingAccount: boolean
}

const STATUS: Record<'issued' | 'failed' | 'reversed', { label: string; className: string }> = {
  issued: { label: 'Issued', className: 'bg-green-50 text-green-700' },
  failed: { label: 'Being prepared', className: 'bg-amber-50 text-amber-700' },
  reversed: { label: 'Reversed', className: 'bg-muted text-muted-foreground' },
}

function invoiceNumber(invoice: BillingInvoice): string {
  return invoice.smartbill_number ? `${invoice.smartbill_series ?? ''}${invoice.smartbill_number}` : 'Pending number'
}

function StatusPill({ status }: { status: BillingInvoice['status'] }) {
  const meta = STATUS[status ?? 'issued']
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', meta.className)}>{meta.label}</span>
}

function PdfLink({ invoice }: { invoice: BillingInvoice }) {
  // Only ever link to an https document (the URL comes from the invoicing provider).
  if (!invoice.pdf_url || invoice.status !== 'issued' || !/^https:\/\//i.test(invoice.pdf_url)) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <a
      href={invoice.pdf_url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      <Download className="size-3.5" aria-hidden="true" />
      PDF
      <span className="sr-only"> of invoice {invoiceNumber(invoice)} (opens in a new tab)</span>
    </a>
  )
}

export function InvoicesList({ invoices, failed, timeZone, hasBillingAccount }: InvoicesListProps) {
  return (
    <section aria-labelledby="invoices-heading" className="rounded-2xl border bg-card p-5">
      <h2 id="invoices-heading" className="text-sm font-semibold text-foreground">
        Invoices
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Fiscal invoices issued for your payments.
        {hasBillingAccount ? ' Card receipts for every payment are in Manage billing.' : ''}
      </p>

      {failed ? (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          We couldn’t load your invoices. Refresh the page to try again.
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Your invoices will show up here after your first payment."
          className="py-8"
        />
      ) : (
        <>
          {/* Phones: one card per invoice. */}
          <ul className="mt-4 divide-y rounded-xl border sm:hidden">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{invoiceNumber(invoice)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDay(invoice.issued_at ?? invoice.created_at, timeZone) ?? '—'} ·{' '}
                    {invoice.amount != null ? formatMoney(Number(invoice.amount), invoice.currency) : '—'}
                  </p>
                  <div className="mt-1.5">
                    <StatusPill status={invoice.status} />
                  </div>
                </div>
                <PdfLink invoice={invoice} />
              </li>
            ))}
          </ul>

          {/* Tablets and up: a table. */}
          <div className="mt-4 hidden overflow-x-auto rounded-xl border sm:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Invoice</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Download</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{invoiceNumber(invoice)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDay(invoice.issued_at ?? invoice.created_at, timeZone) ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {invoice.amount != null ? formatMoney(Number(invoice.amount), invoice.currency) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={invoice.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PdfLink invoice={invoice} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
