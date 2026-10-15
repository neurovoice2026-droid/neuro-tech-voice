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
      toast.success('The customer can be called again', { description: `${next.name} was removed from the do-not-call list; the reason was recorded.` })
      setReason('')
      setConfirmed(false)
      onClose()
    } catch (err) {
      toast.error('The customer could not be removed from the list', { description: commerceErrorMessage(err, 'Try again.') })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={customer !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove the customer from the do-not-call list?</DialogTitle>
          <DialogDescription>
            {customer?.name || 'The customer'} can be called again by automations. The action is recorded in the audit log, with your reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {optedOut && (
            <p className="rounded-xl bg-warning-soft px-4 py-3 text-[13px] leading-[19px] text-warning">
              The customer asked not to be called again. Remove them from the list only if they gave their consent again.
            </p>
          )}
          <Field label="Reason" htmlFor={`${id}-reason`} hint={`Between ${SUPPRESSION_REASON_MIN} and ${SUPPRESSION_REASON_MAX} characters; for example "the customer asked by phone to be called again".`}>
            <Textarea id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={SUPPRESSION_REASON_MAX} disabled={pending} className="min-h-20" />
          </Field>
          <div className="flex items-start gap-3">
            <Checkbox id={`${id}-confirm`} checked={confirmed} onCheckedChange={(v) => setConfirmed(Boolean(v))} disabled={pending} className="mt-px" />
            <label htmlFor={`${id}-confirm`} className="text-[13px] leading-[19px] text-foreground select-none">
              I confirm that I have grounds to contact this customer again.
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive-solid" onClick={() => void remove()} disabled={!reasonOk || !confirmed} loading={pending} loadingText="Recording…">
            Remove from list
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
        eyebrow="Store"
        title="Do-not-call list"
        description="Customers that automations never call: those who asked during a call, those you added, and those flagged by the store platform."
        meta={
          typeof list.total === 'number' ? (
            <span className="text-[13px] leading-[19px] text-muted-foreground tabular-nums">{formatCount(list.total)} customers</span>
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
        emptyTitle="The list is empty"
        emptyDescription="A customer lands here when they ask during a call not to be called again, or when you flag them on the Customers page."
        loadingLabel="Loading the list…"
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
          <caption className="sr-only">Customers who are not called</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Customer</TableHead>
              <TableHead scope="col" className="hidden @min-[560px]/records:table-cell">Phone</TableHead>
              <TableHead scope="col" className="hidden @min-[760px]/records:table-cell">Source</TableHead>
              <TableHead scope="col" className="hidden @min-[900px]/records:table-cell">Since</TableHead>
              <TableHead scope="col" className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="py-2.5">
                  {/* On a narrow panel: the panel width less the icon-only remove button; phone (560 px) and source (760 px) fold in here. */}
                  <div className="max-w-[calc(100cqw-112px)] min-w-0 @min-[560px]/records:max-w-[32ch]">
                    <span className="block truncate text-sm font-medium text-foreground" title={customer.name || undefined}>{customer.name || 'Unnamed customer'}</span>
                    <span className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground tabular-nums @min-[560px]/records:hidden">{maskedOrDash(customer.phone_masked)}</span>
                    <span className="mt-1.5 block @min-[760px]/records:hidden">
                      <StatusChip tone={customer.do_not_call_source === 'customer_opt_out' ? 'danger' : 'neutral'} dot>
                        {suppressionSourceLabel(customer.do_not_call_source)}
                      </StatusChip>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden tabular-nums @min-[560px]/records:table-cell">{maskedOrDash(customer.phone_masked)}</TableCell>
                <TableCell className="hidden @min-[760px]/records:table-cell">
                  <StatusChip tone={customer.do_not_call_source === 'customer_opt_out' ? 'danger' : 'neutral'} dot>
                    {suppressionSourceLabel(customer.do_not_call_source)}
                  </StatusChip>
                </TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums @min-[900px]/records:table-cell">{formatDateTime(customer.do_not_call_at)}</TableCell>
                <TableCell className="pl-1 text-right">
                  <Button variant="outline" size="xs" className="tap-44" onClick={() => setRemoving(customer)} aria-label={`Remove ${customer.name || 'the customer'} from the do-not-call list`} title="Remove from list">
                    <Undo2 aria-hidden="true" />
                    <span className="hidden @min-[1000px]/records:inline">Remove from list</span>
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
