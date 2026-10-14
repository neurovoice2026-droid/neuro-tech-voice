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

const STATUS_OPTIONS = [{ value: 'all', label: 'Toate stările' }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))]

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
        eyebrow="Magazin"
        title="Comenzi"
        description="Comenzile sincronizate din magazin, cu metoda de plată și apelurile automate legate de fiecare."
        meta={
          typeof orders.total === 'number' ? (
            <span className="text-[13px] leading-[19px] text-muted-foreground tabular-nums">{formatCount(orders.total)} comenzi</span>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField value={search} onChange={setSearch} placeholder="Caută după numărul comenzii, nume sau oraș…" label="Caută comenzi" />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => v && setStatus(String(v))}>
              <SelectTrigger size="sm" aria-label="Filtrează după stare" className={filterPillClass(status !== 'all')}>
                <SelectValue>{(value: string) => STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start" className="min-w-44">
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Chip pressed={codOnly} onClick={() => setCodOnly((v) => !v)}>
              Doar ramburs
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
          emptyTitle="Nicio comandă sincronizată"
          emptyDescription={connection ? 'Comenzile apar aici după prima sincronizare a magazinului.' : 'Conectează magazinul ca să vezi comenzile.'}
          loadingLabel="Se încarcă comenzile…"
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
            <caption className="sr-only">Comenzi</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Comandă</TableHead>
                <TableHead scope="col" className="hidden @min-[560px]/records:table-cell">Client</TableHead>
                <TableHead scope="col">Stare</TableHead>
                <TableHead scope="col" className="hidden @min-[760px]/records:table-cell">Plată</TableHead>
                <TableHead scope="col" className="text-right">Total</TableHead>
                <TableHead scope="col" className="hidden @min-[900px]/records:table-cell">Produse</TableHead>
                <TableHead scope="col" className="hidden text-right @min-[1000px]/records:table-cell">Plasată</TableHead>
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
      aria-label={`Deschide comanda #${order.order_number}`}
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
        <span className="block text-sm font-medium text-foreground tabular-nums">#{order.order_number}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs leading-4 text-muted-foreground @min-[560px]/records:hidden">
          {order.contact_name ?? 'Client necunoscut'}
          {order.is_cod && <CodChip className="h-5 px-2 text-[11px]" />}
        </span>
      </TableCell>
      <TableCell className="hidden @min-[560px]/records:table-cell">
        <span className="block text-sm text-foreground">{order.contact_name ?? '—'}</span>
        <span className="block text-xs leading-4 text-muted-foreground tabular-nums">
          {maskedOrDash(order.contact_phone_masked)}
          {order.shipping_city ? ` · ${order.shipping_city}` : ''}
        </span>
      </TableCell>
      <TableCell>
        <OrderStatusChip status={order.status} />
      </TableCell>
      <TableCell className="hidden @min-[760px]/records:table-cell">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="max-w-[18ch] truncate text-sm" title={order.payment_method_title ?? undefined}>
            {order.payment_method_title ?? '—'}
          </span>
          {order.is_cod && <CodChip />}
        </span>
      </TableCell>
      <TableCell className="text-right font-medium text-foreground tabular-nums">{formatMoney(order.total, order.currency)}</TableCell>
      <TableCell className="hidden text-muted-foreground @min-[900px]/records:table-cell">
        <span className="block max-w-[32ch] truncate" title={order.items_summary ?? undefined}>
          {order.items_summary ?? `${formatCount(order.items_count)} produse`}
        </span>
      </TableCell>
      <TableCell className="hidden text-right text-muted-foreground @min-[1000px]/records:table-cell">
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
