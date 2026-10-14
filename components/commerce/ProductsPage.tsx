'use client'

import { useState } from 'react'
import { Tag } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { useDebouncedValue } from '@/hooks/useCommerceApi'
import { useCurrentConnection } from '@/hooks/useCommerceConnections'
import { useCommerceProducts } from '@/hooks/useCommerceRecords'
import { formatCount, formatDateTime, formatMoney, relativeTime } from './format'
import { PRODUCT_STATUS_LABEL, STOCK_STATUS_LABEL } from './labels'
import { LoadMoreFooter, RecordsPanel, SearchField, filterPillClass } from './ListScaffold'
import { StockStatusChip } from './StatusChips'

/** The route filters on in_stock / out_of_stock only (the contract); the other stock states show in the column. */
const STOCK_OPTIONS = [
  { value: 'all', label: 'All stock' },
  { value: 'in_stock', label: STOCK_STATUS_LABEL.in_stock },
  { value: 'out_of_stock', label: STOCK_STATUS_LABEL.out_of_stock },
]

export function ProductsPage() {
  const { connection, isLoading: connectionLoading, error: connectionError, refetch: refetchConnection } = useCurrentConnection()
  const [search, setSearch] = useState('')
  const [stock, setStock] = useState('all')
  const q = useDebouncedValue(search.trim(), 300)

  const products = useCommerceProducts({ connection_id: connection?.id, q, stock: stock === 'all' ? undefined : stock }, !connectionLoading)
  const filtered = Boolean(q) || stock !== 'all'
  const isLoading = connectionLoading || products.isLoading
  const error = connectionError ?? products.error

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Store"
        title="Products"
        description="The catalog synced from the store: price and stock, as the agent sees them during calls."
        meta={
          typeof products.total === 'number' ? (
            <span className="text-[13px] leading-[19px] text-muted-foreground tabular-nums">{formatCount(products.total)} products</span>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField value={search} onChange={setSearch} placeholder="Search by name or SKU…" label="Search products" />
          <Select value={stock} onValueChange={(v) => v && setStock(String(v))}>
            <SelectTrigger size="sm" aria-label="Filter by stock" className={filterPillClass(stock !== 'all')}>
              <SelectValue>{(value: string) => STOCK_OPTIONS.find((o) => o.value === value)?.label ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="start" className="min-w-40">
              {STOCK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <RecordsPanel
          isLoading={isLoading}
          error={error}
          onRetry={() => {
            refetchConnection()
            products.refetch()
          }}
          isEmpty={products.items.length === 0}
          filtered={filtered}
          emptyIcon={Tag}
          emptyTitle="No products synced"
          emptyDescription={connection ? 'Products show up here after the store’s first sync.' : 'Connect the store to see its products.'}
          loadingLabel="Loading products…"
          footer={
            <LoadMoreFooter
              shown={products.items.length}
              total={products.total}
              hasMore={products.hasMore}
              isLoadingMore={products.isLoadingMore}
              loadMoreError={products.loadMoreError}
              onLoadMore={products.loadMore}
            />
          }
        >
          <Table>
            <caption className="sr-only">Products</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Product</TableHead>
                <TableHead scope="col" className="hidden @min-[560px]/records:table-cell">SKU</TableHead>
                <TableHead scope="col" className="hidden @min-[760px]/records:table-cell">Status</TableHead>
                <TableHead scope="col" className="text-right">Price</TableHead>
                <TableHead scope="col">Stock</TableHead>
                <TableHead scope="col" className="hidden text-right @min-[900px]/records:table-cell">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="py-2.5">
                    <span className="block max-w-[36ch] truncate text-sm font-medium text-foreground" title={product.name}>
                      {product.name}
                    </span>
                    {product.sku && <span className="mt-0.5 block font-mono text-xs text-muted-foreground @min-[560px]/records:hidden">{product.sku}</span>}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground @min-[560px]/records:table-cell">{product.sku ?? '—'}</TableCell>
                  <TableCell className="hidden text-muted-foreground @min-[760px]/records:table-cell">{PRODUCT_STATUS_LABEL[product.status] ?? product.status}</TableCell>
                  <TableCell className="text-right font-medium text-foreground tabular-nums">{formatMoney(product.price, product.currency)}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StockStatusChip status={product.stock_status} />
                      {typeof product.stock_quantity === 'number' && (
                        <span className="text-xs leading-4 text-muted-foreground tabular-nums">{formatCount(product.stock_quantity)} units</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground @min-[900px]/records:table-cell">
                    <time dateTime={product.updated_at} title={formatDateTime(product.updated_at)} className="tabular-nums">
                      {relativeTime(product.updated_at)}
                    </time>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </RecordsPanel>
      </div>
    </PageContainer>
  )
}
