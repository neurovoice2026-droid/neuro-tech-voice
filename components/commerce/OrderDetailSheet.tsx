'use client'

import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { StatusChip } from '@/components/shared/StatusChip'
import { useCommerceOrderDetail } from '@/hooks/useCommerceRecords'
import { cn } from '@/lib/utils'
import { formatCount, formatDateTime, formatMoney, maskedOrDash } from './format'
import { FINANCIAL_STATUS_LABEL, FULFILLMENT_STATUS_LABEL } from './labels'
import { RunsTable } from './RunsTable'
import { CodChip, OrderStatusChip } from './StatusChips'

const OVERLINE = 'text-[11px] leading-4 font-medium tracking-[0.12em] uppercase text-muted-foreground'
const PANEL = 'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring'

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={OVERLINE}>{label}</dt>
      <dd className="mt-1 text-sm break-words text-foreground">{children}</dd>
    </div>
  )
}

interface OrderDetailSheetProps {
  orderId: string | null
  onClose: () => void
}

/** GET /api/commerce/orders/[id]: the order's items and the automation runs placed for it. */
export function OrderDetailSheet({ orderId, onClose }: OrderDetailSheetProps) {
  const { data, isLoading, error, refetch } = useCommerceOrderDetail(orderId)
  const order = data?.order ?? null
  const runs = data?.runs ?? []

  return (
    <Sheet open={!!orderId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" closeLabel="Close" className="gap-0 overflow-hidden p-0 sm:max-w-[640px]">
        <SheetHeader className="shrink-0">
          <p className={OVERLINE}>Order</p>
          <SheetTitle className="mt-1 truncate tabular-nums">{order ? `#${order.order_number}` : 'Order details'}</SheetTitle>
          {order ? (
            <SheetDescription className="tabular-nums">
              {[order.provider_created_at ? formatDateTime(order.provider_created_at) : null, formatMoney(order.total, order.currency)]
                .filter(Boolean)
                .join(' · ')}
            </SheetDescription>
          ) : (
            <p aria-hidden="true" className="invisible text-[13px] leading-[19px]">—</p>
          )}
          <div className="mt-2.5 flex min-h-6 flex-wrap gap-1.5">
            {order && (
              <>
                <OrderStatusChip status={order.status} />
                <StatusChip tone="neutral">{FINANCIAL_STATUS_LABEL[order.financial_status] ?? order.financial_status}</StatusChip>
                <StatusChip tone="neutral">{FULFILLMENT_STATUS_LABEL[order.fulfillment_status] ?? order.fulfillment_status}</StatusChip>
                {order.is_cod && <CodChip />}
              </>
            )}
          </div>
        </SheetHeader>

        {!order && error ? (
          <div className="flex flex-1 items-center justify-center p-6" role="alert">
            <EmptyState
              bare
              icon={TriangleAlert}
              iconClassName="bg-destructive-soft text-destructive shadow-none"
              title="The order could not be loaded"
              description={error}
              action={
                <Button variant="outline" size="sm" onClick={refetch}>
                  <RotateCw aria-hidden="true" /> Try again
                </Button>
              }
            />
          </div>
        ) : isLoading || !order ? (
          <OrbLoader label="Loading order…" className="min-h-[50vh] flex-1" />
        ) : (
          <div tabIndex={0} className={cn(PANEL, 'min-h-0 flex-1 divide-y divide-rule overflow-y-auto px-6 pt-5 pb-8')}>
            <section aria-label="Contact and delivery details" className="pb-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoItem label="Customer">{order.contact_name ?? '—'}</InfoItem>
                <InfoItem label="Phone"><span className="tabular-nums">{maskedOrDash(order.contact_phone_masked)}</span></InfoItem>
                <InfoItem label="Email">{maskedOrDash(order.contact_email_masked)}</InfoItem>
                <InfoItem label="Payment method">{order.payment_method_title ?? '—'}</InfoItem>
                <InfoItem label="Delivery">{order.shipping_summary ?? order.shipping_city ?? '—'}</InfoItem>
                <InfoItem label="Updated in store"><span className="tabular-nums">{formatDateTime(order.provider_updated_at)}</span></InfoItem>
              </dl>
            </section>

            <section aria-labelledby="order-items-title" className="py-6">
              <h3 id="order-items-title" className={cn('mb-3', OVERLINE)}>Items ({formatCount(order.items_count)})</h3>
              {order.items.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">The order items were not synced.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl shadow-hair">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Order items</caption>
                    <thead>
                      <tr className="border-b border-rule">
                        <th scope="col" className={cn('h-9 px-4 text-left', OVERLINE)}>Item</th>
                        <th scope="col" className={cn('h-9 px-4 text-right', OVERLINE)}>Qty</th>
                        <th scope="col" className={cn('h-9 px-4 text-right', OVERLINE)}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, i) => (
                        <tr key={`${item.sku ?? item.name}-${i}`} className="border-b border-rule last:border-b-0">
                          <td className="px-4 py-2.5 align-top">
                            <span className="block text-foreground">{item.name}</span>
                            {item.sku && <span className="block font-mono text-xs text-muted-foreground">{item.sku}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right align-top tabular-nums">{formatCount(item.quantity)}</td>
                          <td className="px-4 py-2.5 text-right align-top tabular-nums">
                            {formatMoney(item.total ?? (item.unit_price !== null ? item.unit_price * item.quantity : null), order.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-rule">
                        <th scope="row" colSpan={2} className="px-4 py-2.5 text-right text-[13px] font-medium text-muted-foreground">Order total</th>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground tabular-nums">{formatMoney(order.total, order.currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            <section aria-labelledby="order-runs-title" className="pt-6">
              <h3 id="order-runs-title" className={cn('mb-3', OVERLINE)}>Automated calls for this order</h3>
              <RunsTable
                runs={runs}
                isLoading={false}
                error={null}
                onRetry={refetch}
                cancellable
                onRunChanged={refetch}
                emptyTitle="No automated calls"
                emptyDescription="No automation has called for this order (yet)."
              />
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
