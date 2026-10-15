'use client'

import { useState } from 'react'
import { Package } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Chip } from '@/components/shared/OptionCard'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { useDebouncedValue } from '@/hooks/useCommerceApi'
import { useCurrentConnection } from '@/hooks/useCommerceConnections'
import { useCommerceOrders } from '@/hooks/useCommerceRecords'
import type { OrderListDto } from '@/lib/commerce/types'
import { cn } from '@/lib/utils'
import { formatCount, formatDateTime, formatMoney, maskedOrDash, relativeTime } from './format'
import { ORDER_STATUSES, ORDER_STATUS_LABEL } from './labels'
import { LoadMoreFooter, RecordsPanel, SearchField, filterPillClass } from './ListScaffold'
import { OrderDetailSheet } from './OrderDetailSheet'
import { CodChip, OrderStatusChip } from './StatusChips'

const STATUS_OPTIONS = [{ value: 'all', label: 'All statuses' }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))]

export function OrdersPage() {
  const { connection, isLoading: connectionLoading, error: connectionError, refetch: refetchConnection } = useCurrentConnection()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [codOnly, setCodOnly] = useState(false)
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)
  const q = useDebouncedValue(search.trim(), 300)

  const orders = useCommerceOrders(
    { connection_id: connection?.id, q, status: status === 'all' ? undefined : status, cod: codOnly ? '1' : undefined },
    !connectionLoading,
  )
  const filtered = Boolean(q) || status !== 'all' || codOnly
  const isLoading = connectionLoading || orders.isLoading
  const error = connectionError ?? orders.error

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Store"
        title="Orders"
        description="The orders synced from the store, with their payment method and the automated calls tied to each."
        meta={
          typeof orders.total === 'number' ? (
            <span className="text-[13px] leading-[19px] text-muted-foreground tabular-nums">{formatCount(orders.total)} orders</span>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField value={search} onChange={setSearch} placeholder="Search by order number, name or city…" label="Search orders" />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => v && setStatus(String(v))}>
              <SelectTrigger size="sm" aria-label="Filter by status" className={filterPillClass(status !== 'all')}>
                <SelectValue>{(value: string) => STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start" className="min-w-44">
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Chip pressed={codOnly} onClick={() => setCodOnly((v) => !v)}>
              COD only
            </Chip>
          </div>
        </div>

        <RecordsPanel
          isLoading={isLoading}
          error={error}
          onRetry={() => {
            refetchConnection()
            orders.refetch()
          }}
          isEmpty={orders.items.length === 0}
          filtered={filtered}
          emptyIcon={Package}
          emptyTitle="No orders synced"
          emptyDescription={connection ? 'Orders show up here after the store’s first sync.' : 'Connect the store to see its orders.'}
          loadingLabel="Loading orders…"
          footer={
            <LoadMoreFooter
              shown={orders.items.length}
              total={orders.total}
              hasMore={orders.hasMore}
              isLoadingMore={orders.isLoadingMore}
              loadMoreError={orders.loadMoreError}
              onLoadMore={orders.loadMore}
            />
          }
        >
          <Table>
            <caption className="sr-only">Orders</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Order</TableHead>
                <TableHead scope="col" className="hidden @min-[560px]/records:table-cell">Customer</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="hidden @min-[800px]/records:table-cell">Payment</TableHead>
                <TableHead scope="col" className="hidden text-right @min-[640px]/records:table-cell">Total</TableHead>
                <TableHead scope="col" className="hidden @min-[1000px]/records:table-cell">Items</TableHead>
                <TableHead scope="col" className="hidden text-right @min-[1100px]/records:table-cell">Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.items.map((order) => (
                <OrderRow key={order.id} order={order} onOpen={() => setOpenOrderId(order.id)} active={openOrderId === order.id} />
              ))}
            </TableBody>
          </Table>
        </RecordsPanel>
      </div>

      <OrderDetailSheet orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </PageContainer>
  )
}

function OrderRow({ order, onOpen, active }: { order: OrderListDto; onOpen: () => void; active: boolean }) {
  return (
    // Same row model as the calls table: the row is the control (Enter / Space open the sheet),
    // the open order gets an ink bar on its leading edge.
    <TableRow
      tabIndex={0}
      aria-label={`Open order #${order.order_number}`}
      data-state={active ? 'selected' : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'cursor-pointer outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring',
        active && '[&>td:first-child]:shadow-[inset_3px_0_0_var(--foreground)]',
      )}
    >
      <TableCell className="py-2.5">
        {/* What a narrow panel has no column for folds in here: customer (560 px), total (640 px), placed time (1100 px). */}
        <div className="max-w-[calc(100cqw-160px)] min-w-0 @min-[560px]/records:max-w-none">
          <span className="block truncate text-sm font-medium text-foreground tabular-nums">#{order.order_number}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs leading-4 text-muted-foreground @min-[560px]/records:hidden">
            <span className="min-w-0 truncate">{order.contact_name ?? 'Unknown customer'}</span>
            {order.is_cod && <CodChip className="h-5 px-2 text-[11px]" />}
          </span>
          <span className="mt-0.5 block text-sm font-medium text-foreground tabular-nums @min-[640px]/records:hidden">{formatMoney(order.total, order.currency)}</span>
          {order.provider_created_at && (
            <time dateTime={order.provider_created_at} title={formatDateTime(order.provider_created_at)} className="mt-0.5 block text-xs leading-4 text-muted-foreground tabular-nums @min-[1100px]/records:hidden">
              {relativeTime(order.provider_created_at)}
            </time>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden @min-[560px]/records:table-cell">
        <div className="max-w-[24ch] min-w-0">
          <span className="block truncate text-sm text-foreground" title={order.contact_name ?? undefined}>{order.contact_name ?? '—'}</span>
          <span className="block truncate text-xs leading-4 text-muted-foreground tabular-nums">
            {maskedOrDash(order.contact_phone_masked)}
            {order.shipping_city ? ` · ${order.shipping_city}` : ''}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <OrderStatusChip status={order.status} />
      </TableCell>
      <TableCell className="hidden @min-[800px]/records:table-cell">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="max-w-[16ch] truncate text-sm" title={order.payment_method_title ?? undefined}>
            {order.payment_method_title ?? '—'}
          </span>
          {order.is_cod && <CodChip />}
        </span>
      </TableCell>
      <TableCell className="hidden text-right font-medium text-foreground tabular-nums @min-[640px]/records:table-cell">{formatMoney(order.total, order.currency)}</TableCell>
      <TableCell className="hidden text-muted-foreground @min-[1000px]/records:table-cell">
        <span className="block max-w-[24ch] truncate" title={order.items_summary ?? undefined}>
          {order.items_summary ?? `${formatCount(order.items_count)} items`}
        </span>
      </TableCell>
      <TableCell className="hidden text-right text-muted-foreground @min-[1100px]/records:table-cell">
        {order.provider_created_at ? (
          <time dateTime={order.provider_created_at} title={formatDateTime(order.provider_created_at)} className="tabular-nums">
            {relativeTime(order.provider_created_at)}
          </time>
        ) : (
          '—'
        )}
      </TableCell>
    </TableRow>
  )
}
