import { StatusChip } from '@/components/shared/StatusChip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { MinutesSummaryDto } from '@/lib/billing/minutes-summary'
import { formatCents, formatMinutes, formatPurchaseDate, purchaseSourceLabel, purchaseStatusLabel } from './minutes-logic'

/** The last extra-minute purchases (newest first, as GET /api/billing/minutes lists them). */
export function PurchaseHistory({ purchases }: { purchases: MinutesSummaryDto['purchases'] }) {
  return (
    <div className="rounded-2xl bg-card shadow-hair">
      <div className="p-5 pb-3">
        <h3 className="text-[15px] leading-[22px] font-medium">Purchase history</h3>
        <p className="mt-0.5 text-[13px] leading-[19px] text-muted-foreground">
          Invoices for every purchase are in the billing portal.
        </p>
      </div>
      {purchases.length === 0 ? (
        <p className="border-t border-rule px-5 py-4 text-[13px] leading-[19px] text-muted-foreground">No extra minutes bought yet.</p>
      ) : (
        <div className="border-t border-rule px-2 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Minutes</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>How</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">{formatPurchaseDate(p.created_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinutes(p.minutes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(p.amount_cents, p.currency)}</TableCell>
                  <TableCell>{purchaseSourceLabel(p.source)}</TableCell>
                  <TableCell>
                    <StatusChip tone={p.status === 'credited' ? 'success' : p.status === 'failed' ? 'danger' : 'muted'}>
                      {purchaseStatusLabel(p.status)}
                    </StatusChip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
