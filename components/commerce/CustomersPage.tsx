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
import { suppressionSourceLabel } from './labels'
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
      toast.success('Clientul nu va mai fi sunat', {
        description: `${next.name} a fost adăugat în lista „Nu suna”. Eliminarea se face din acea listă, cu motiv.`,
      })
    } catch (err) {
      toast.error('Clientul nu a putut fi adăugat în lista „Nu suna”', { description: commerceErrorMessage(err, 'Încearcă din nou.') })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Magazin"
        title="Clienți"
        description="Clienții sincronizați din magazin. Datele de contact sunt mascate; cine nu vrea să fie sunat este marcat aici."
        meta={
          typeof customers.total === 'number' ? (
            <span className="text-[13px] leading-[19px] text-muted-foreground tabular-nums">{formatCount(customers.total)} clienți</span>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField value={search} onChange={setSearch} placeholder="Caută după nume, e-mail sau telefon…" label="Caută clienți" />
          <Chip pressed={dncOnly} onClick={() => setDncOnly((v) => !v)}>
            Doar „Nu suna”
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
          emptyTitle="Niciun client sincronizat"
          emptyDescription={connection ? 'Clienții apar aici după prima sincronizare a magazinului.' : 'Conectează magazinul ca să vezi clienții.'}
          loadingLabel="Se încarcă clienții…"
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
            <caption className="sr-only">Clienți</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Client</TableHead>
                <TableHead scope="col" className="hidden @min-[560px]/records:table-cell">Telefon</TableHead>
                <TableHead scope="col" className="hidden @min-[760px]/records:table-cell">E-mail</TableHead>
                <TableHead scope="col" className="hidden text-right @min-[900px]/records:table-cell">Comenzi</TableHead>
                <TableHead scope="col" className="hidden @min-[1000px]/records:table-cell">Actualizat</TableHead>
                <TableHead scope="col" className="text-right">Nu suna</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.items.map((customer) => {
                const switchId = `dnc-${customer.id}`
                const busy = busyId === customer.id
                return (
                  <TableRow key={customer.id}>
                    <TableCell className="py-2.5">
                      <span className="block text-sm font-medium text-foreground">{customer.name || 'Client fără nume'}</span>
                      <span className="mt-0.5 block text-xs leading-4 text-muted-foreground tabular-nums @min-[560px]/records:hidden">
                        {maskedOrDash(customer.phone_masked)}
                      </span>
                      {customer.do_not_call && (
                        <span className="mt-1.5 block">
                          <StatusChip tone="danger" dot>
                            Nu suna · {suppressionSourceLabel(customer.do_not_call_source)}
                          </StatusChip>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden tabular-nums @min-[560px]/records:table-cell">
                      {customer.has_phone ? maskedOrDash(customer.phone_masked) : <span className="text-muted-foreground">fără telefon</span>}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground @min-[760px]/records:table-cell">{maskedOrDash(customer.email_masked)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums @min-[900px]/records:table-cell">{formatCount(customer.orders_count)}</TableCell>
                    <TableCell className="hidden text-muted-foreground @min-[1000px]/records:table-cell">
                      <time dateTime={customer.updated_at} title={formatDateTime(customer.updated_at)} className="tabular-nums">
                        {relativeTime(customer.updated_at)}
                      </time>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-2">
                        <span className="grid size-5 shrink-0 place-items-center" aria-hidden={!busy}>
                          {busy && <OrbInline state="working" label="Se salvează" />}
                        </span>
                        {customer.do_not_call ? (
                          <Link
                            href="/magazin/nu-suna"
                            className="relative tap-44 rounded-sm text-xs leading-4 text-muted-foreground underline decoration-foreground/30 underline-offset-4 outline-none hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
                            aria-label={`${customer.name || 'Clientul'} este în lista „Nu suna”; eliminarea se face din acea listă`}
                          >
                            din lista „Nu suna”
                          </Link>
                        ) : (
                          <label htmlFor={switchId} className="sr-only">
                            Nu suna: {customer.name || 'client fără nume'}
                          </label>
                        )}
                        <Switch
                          id={switchId}
                          checked={customer.do_not_call}
                          // Turning it off is an audited action with a reason, done only from the "Nu suna" list.
                          disabled={busy || customer.do_not_call}
                          onCheckedChange={(checked) => {
                            if (checked) void suppress(customer)
                          }}
                          aria-label={customer.do_not_call ? `${customer.name || 'Clientul'} este în lista „Nu suna”` : undefined}
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
