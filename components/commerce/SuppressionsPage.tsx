'use client'

import { useId, useState } from 'react'
import { PhoneOff, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/shared/FormSection'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusChip } from '@/components/shared/StatusChip'
import { commerceErrorMessage } from '@/hooks/useCommerceApi'
import { useCurrentConnection } from '@/hooks/useCommerceConnections'
import { unsuppressCustomer, useCommerceSuppressions } from '@/hooks/useCommerceRecords'
import type { CustomerListDto } from '@/lib/commerce/types'
import { formatCount, formatDateTime, maskedOrDash } from './format'
import { suppressionSourceLabel } from './labels'
import { LoadMoreFooter, RecordsPanel } from './ListScaffold'
import { SUPPRESSION_REASON_MAX, SUPPRESSION_REASON_MIN, suppressionReasonOk } from './suppression-reason'

/** The audited removal: a written reason and an explicit confirmation, both sent with the DELETE. */
function RemoveSuppressionDialog({ customer, onClose, onRemoved }: { customer: CustomerListDto | null; onClose: () => void; onRemoved: (customer: CustomerListDto) => void }) {
  const id = useId()
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const reasonOk = suppressionReasonOk(reason)
  const optedOut = customer?.do_not_call_source === 'customer_opt_out'

  function close() {
    if (pending) return
    setReason('')
    setConfirmed(false)
    onClose()
  }

  async function remove() {
    if (!customer || !reasonOk || !confirmed) return
    setPending(true)
    try {
      const next = await unsuppressCustomer(customer.id, reason.trim())
      onRemoved(next)
      toast.success('Clientul poate fi sunat din nou', { description: `${next.name} a fost scos din lista „Nu suna”; motivul a fost înregistrat.` })
      setReason('')
      setConfirmed(false)
      onClose()
    } catch (err) {
      toast.error('Clientul nu a putut fi scos din listă', { description: commerceErrorMessage(err, 'Încearcă din nou.') })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={customer !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scoți clientul din lista „Nu suna”?</DialogTitle>
          <DialogDescription>
            {customer?.name || 'Clientul'} va putea fi sunat din nou de automatizări. Acțiunea este înregistrată în jurnal, cu motivul tău.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {optedOut && (
            <p className="rounded-xl bg-warning-soft px-4 py-3 text-[13px] leading-[19px] text-warning">
              Clientul însuși a cerut să nu mai fie sunat. Scoate-l din listă doar dacă ți-a dat din nou acordul.
            </p>
          )}
          <Field label="Motivul" htmlFor={`${id}-reason`} hint={`Între ${SUPPRESSION_REASON_MIN} și ${SUPPRESSION_REASON_MAX} de caractere; de exemplu „clientul a cerut telefonic să fie sunat din nou”.`}>
            <Textarea id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={SUPPRESSION_REASON_MAX} disabled={pending} className="min-h-20" />
          </Field>
          <div className="flex items-start gap-3">
            <Checkbox id={`${id}-confirm`} checked={confirmed} onCheckedChange={(v) => setConfirmed(Boolean(v))} disabled={pending} className="mt-px" />
            <label htmlFor={`${id}-confirm`} className="text-[13px] leading-[19px] text-foreground select-none">
              Confirm că am temei să contactez din nou acest client.
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Renunță
          </Button>
          <Button variant="destructive-solid" onClick={() => void remove()} disabled={!reasonOk || !confirmed} loading={pending} loadingText="Se înregistrează…">
            Scoate din listă
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SuppressionsPage() {
  const { connection, isLoading: connectionLoading, error: connectionError, refetch: refetchConnection } = useCurrentConnection()
  const list = useCommerceSuppressions({ connection_id: connection?.id }, !connectionLoading)
  const [removing, setRemoving] = useState<CustomerListDto | null>(null)
  const isLoading = connectionLoading || list.isLoading
  const error = connectionError ?? list.error

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Magazin"
        title="Lista „Nu suna”"
        description="Clienții pe care nicio automatizare nu îi sună: cei care au cerut-o în apel, cei adăugați de tine și cei marcați de platformă."
        meta={
          typeof list.total === 'number' ? (
            <span className="text-[13px] leading-[19px] text-muted-foreground tabular-nums">{formatCount(list.total)} clienți</span>
          ) : undefined
        }
      />

      <RecordsPanel
        isLoading={isLoading}
        error={error}
        onRetry={() => {
          refetchConnection()
          list.refetch()
        }}
        isEmpty={list.items.length === 0}
        emptyIcon={PhoneOff}
        emptyTitle="Lista este goală"
        emptyDescription="Un client ajunge aici când cere în apel să nu mai fie sunat sau când îl marchezi din pagina Clienți."
        loadingLabel="Se încarcă lista…"
        footer={
          <LoadMoreFooter
            shown={list.items.length}
            total={list.total}
            hasMore={list.hasMore}
            isLoadingMore={list.isLoadingMore}
            loadMoreError={list.loadMoreError}
            onLoadMore={list.loadMore}
          />
        }
      >
        <Table>
          <caption className="sr-only">Clienți care nu sunt sunați</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Client</TableHead>
              <TableHead scope="col" className="hidden @min-[560px]/records:table-cell">Telefon</TableHead>
              <TableHead scope="col">Sursa</TableHead>
              <TableHead scope="col" className="hidden @min-[760px]/records:table-cell">Din</TableHead>
              <TableHead scope="col" className="text-right">
                <span className="sr-only">Acțiuni</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="py-2.5">
                  <span className="block text-sm font-medium text-foreground">{customer.name || 'Client fără nume'}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-muted-foreground tabular-nums @min-[560px]/records:hidden">{maskedOrDash(customer.phone_masked)}</span>
                </TableCell>
                <TableCell className="hidden tabular-nums @min-[560px]/records:table-cell">{maskedOrDash(customer.phone_masked)}</TableCell>
                <TableCell>
                  <StatusChip tone={customer.do_not_call_source === 'customer_opt_out' ? 'danger' : 'neutral'} dot>
                    {suppressionSourceLabel(customer.do_not_call_source)}
                  </StatusChip>
                </TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums @min-[760px]/records:table-cell">{formatDateTime(customer.do_not_call_at)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="xs" className="tap-44" onClick={() => setRemoving(customer)} aria-label={`Scoate ${customer.name || 'clientul'} din lista „Nu suna”`}>
                    <Undo2 aria-hidden="true" />
                    Scoate din listă
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </RecordsPanel>

      <RemoveSuppressionDialog
        customer={removing}
        onClose={() => setRemoving(null)}
        onRemoved={(customer) => {
          // Off the do-not-call list, the row no longer belongs here.
          list.removeItem(customer.id)
        }}
      />
    </PageContainer>
  )
}
