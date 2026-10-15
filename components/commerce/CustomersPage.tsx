'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Chip } from '@/components/shared/OptionCard'
import { OrbInline } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusChip } from '@/components/shared/StatusChip'
import { commerceErrorMessage, useDebouncedValue } from '@/hooks/useCommerceApi'
import { useCurrentConnection } from '@/hooks/useCommerceConnections'
import { suppressCustomer, useCommerceCustomers } from '@/hooks/useCommerceRecords'
import type { CustomerListDto } from '@/lib/commerce/types'
import { formatCount, formatDateTime, maskedOrDash, relativeTime } from './format'
import { STORE_PATHS, suppressionSourceLabel } from './labels'
import { LoadMoreFooter, RecordsPanel, SearchField } from './ListScaffold'

export function CustomersPage() {
  const { connection, isLoading: connectionLoading, error: connectionError, refetch: refetchConnection } = useCurrentConnection()
  const [search, setSearch] = useState('')
  const [dncOnly, setDncOnly] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const q = useDebouncedValue(search.trim(), 300)

  const customers = useCommerceCustomers({ connection_id: connection?.id, q, dnc: dncOnly ? '1' : undefined }, !connectionLoading)
  const filtered = Boolean(q) || dncOnly
  const isLoading = connectionLoading || customers.isLoading
  const error = connectionError ?? customers.error

  async function suppress(customer: CustomerListDto) {
    setBusyId(customer.id)
    try {
      const next = await suppressCustomer(customer.id)
      customers.replaceItem(customer.id, next)
      toast.success('The customer will not be called again', {
        description: `${next.name} was added to the do-not-call list. Removal happens from that list, with a reason.`,
      })
    } catch (err) {
      toast.error('The customer could not be added to the do-not-call list', { description: commerceErrorMessage(err, 'Try again.') })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Store"
        title="Customers"
        description="The customers synced from the store. Contact details are masked, and customers who asked not to be called are flagged here."
        meta={
          typeof customers.total === 'number' ? (
            <span className="text-[13px] leading-[19px] text-muted-foreground tabular-nums">{formatCount(customers.total)} customers</span>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField value={search} onChange={setSearch} placeholder="Search by name, email or phone…" label="Search customers" />
          <Chip pressed={dncOnly} onClick={() => setDncOnly((v) => !v)}>
            Do-not-call only
          </Chip>
        </div>

        <RecordsPanel
          isLoading={isLoading}
          error={error}
          onRetry={() => {
            refetchConnection()
            customers.refetch()
          }}
          isEmpty={customers.items.length === 0}
          filtered={filtered}
          emptyIcon={Users}
          emptyTitle="No customers synced"
          emptyDescription={connection ? 'Customers show up here after the store’s first sync.' : 'Connect the store to see its customers.'}
          loadingLabel="Loading customers…"
          footer={
            <LoadMoreFooter
              shown={customers.items.length}
              total={customers.total}
              hasMore={customers.hasMore}
              isLoadingMore={customers.isLoadingMore}
              loadMoreError={customers.loadMoreError}
              onLoadMore={customers.loadMore}
            />
          }
        >
          <Table>
            <caption className="sr-only">Customers</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Customer</TableHead>
                <TableHead scope="col" className="hidden @min-[560px]/records:table-cell">Phone</TableHead>
                <TableHead scope="col" className="hidden @min-[900px]/records:table-cell">Email</TableHead>
                <TableHead scope="col" className="hidden text-right @min-[1000px]/records:table-cell">Orders</TableHead>
                <TableHead scope="col" className="hidden @min-[1100px]/records:table-cell">Updated</TableHead>
                <TableHead scope="col" className="pl-1 text-right">
                  {/* Below 760 px the cell keeps only the switch (the list link sits under the name): the heading would be wider than the column. */}
                  <span className="sr-only @min-[760px]/records:not-sr-only">Do not call</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.items.map((customer) => {
                const switchId = `dnc-${customer.id}`
                const busy = busyId === customer.id
                const displayName = customer.name || 'Unnamed customer'
                return (
                  <TableRow key={customer.id}>
                    <TableCell className="py-2.5">
                      {/* The panel width less the switch cell, so a long name truncates instead of pushing the switch out. */}
                      <div className="max-w-[calc(100cqw-136px)] min-w-0 @min-[560px]/records:max-w-[32ch]">
                        <span className="block truncate text-sm font-medium text-foreground" title={displayName}>{displayName}</span>
                        <span className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground tabular-nums @min-[560px]/records:hidden">
                          {maskedOrDash(customer.phone_masked)}
                        </span>
                        {customer.do_not_call && (
                          <span className="mt-1.5 block">
                            <StatusChip tone="danger" dot>
                              Do not call · {suppressionSourceLabel(customer.do_not_call_source)}
                            </StatusChip>
                          </span>
                        )}
                        {customer.do_not_call && (
                          <Link
                            href={STORE_PATHS.doNotCall}
                            className="relative mt-1 tap-44 inline-block rounded-sm text-xs leading-4 text-muted-foreground underline decoration-foreground/30 underline-offset-4 outline-none hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring @min-[760px]/records:hidden"
                            aria-label={`${displayName} is on the do-not-call list; removal happens from that list`}
                          >
                            Manage on the do-not-call list
                          </Link>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden tabular-nums @min-[560px]/records:table-cell">
                      {customer.has_phone ? maskedOrDash(customer.phone_masked) : <span className="text-muted-foreground">no phone</span>}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground @min-[900px]/records:table-cell">{maskedOrDash(customer.email_masked)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums @min-[1000px]/records:table-cell">{formatCount(customer.orders_count)}</TableCell>
                    <TableCell className="hidden text-muted-foreground @min-[1100px]/records:table-cell">
                      <time dateTime={customer.updated_at} title={formatDateTime(customer.updated_at)} className="tabular-nums">
                        {relativeTime(customer.updated_at)}
                      </time>
                    </TableCell>
                    <TableCell className="pl-1 text-right">
                      <span className="inline-flex items-center justify-end gap-2">
                        <span className="grid size-5 shrink-0 place-items-center" aria-hidden={!busy}>
                          {busy && <OrbInline state="working" label="Saving" />}
                        </span>
                        {customer.do_not_call ? (
                          <Link
                            href={STORE_PATHS.doNotCall}
                            className="relative hidden tap-44 rounded-sm text-xs leading-4 text-muted-foreground underline decoration-foreground/30 underline-offset-4 outline-none hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring @min-[760px]/records:inline"
                            aria-label={`${displayName} is on the do-not-call list; removal happens from that list`}
                          >
                            on the do-not-call list
                          </Link>
                        ) : (
                          <label htmlFor={switchId} className="sr-only">
                            Do not call: {displayName}
                          </label>
                        )}
                        <Switch
                          id={switchId}
                          checked={customer.do_not_call}
                          // Turning it off is an audited action with a reason, done only from the do-not-call list.
                          disabled={busy || customer.do_not_call}
                          onCheckedChange={(checked) => {
                            if (checked) void suppress(customer)
                          }}
                          aria-label={customer.do_not_call ? `${displayName} is on the do-not-call list` : undefined}
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </RecordsPanel>
      </div>
    </PageContainer>
  )
}
