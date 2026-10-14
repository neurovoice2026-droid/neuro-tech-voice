'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Ban, PhoneCall, PhoneOutgoing } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CallDetailSheet } from '@/components/calls/CallDetailSheet'
import { commerceErrorMessage } from '@/hooks/useCommerceApi'
import { cancelRun, isCancellable } from '@/hooks/useCommerceRuns'
import type { RunDto } from '@/lib/commerce/types'
import { cn } from '@/lib/utils'
import { formatDateTime, maskedOrDash, relativeTime } from './format'
import { automationTypeLabel } from './labels'
import { RunOutcomeChip, RunStatusChip } from './StatusChips'
import { LoadMoreFooter, RecordsPanel } from './ListScaffold'

// One table for every list of automation runs (overview, automation history,
// order detail). "View call" opens the same CallDetailSheet the Calls page
// uses, in place, so the person never lands on a list that ignores the id.

interface RunsTableProps {
  runs: RunDto[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
  /** The server's row after a cancel (or a call deletion) replaces the one shown. */
  onRunChanged?: (run: RunDto) => void
  /** Hides the automation column when every run belongs to one automation. */
  showAutomation?: boolean
  /** Allows "Cancel" on eligible / scheduled / retry-waiting runs. */
  cancellable?: boolean
  emptyTitle?: string
  emptyDescription?: React.ReactNode
  filtered?: boolean
  pagination?: {
    total: number | null
    hasMore: boolean
    isLoadingMore: boolean
    loadMoreError: string | null
    onLoadMore: () => void
  }
  /** Link under the table (e.g. "View all" on the overview). */
  footerLink?: { href: string; label: string }
  className?: string
}

/** When the run matters to the merchant: the scheduled slot while it waits, otherwise its last activity. */
function runWhen(run: RunDto): { label: string; iso: string | null } {
  if ((run.status === 'scheduled' || run.status === 'retry_waiting') && run.scheduled_for) return { label: 'Scheduled', iso: run.scheduled_for }
  if (run.completed_at) return { label: 'Completed', iso: run.completed_at }
  if (run.last_attempt_at) return { label: 'Last attempt', iso: run.last_attempt_at }
  return { label: 'Created', iso: run.created_at }
}

export function RunsTable({
  runs, isLoading, error, onRetry, onRunChanged, showAutomation = true, cancellable = false,
  emptyTitle = 'No automated calls yet', emptyDescription, filtered = false, pagination, footerLink, className,
}: RunsTableProps) {
  const [openCallId, setOpenCallId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  async function handleCancel(run: RunDto) {
    setCancellingId(run.id)
    try {
      const next = await cancelRun(run.id)
      onRunChanged?.(next)
      toast.success('Call canceled', { description: `Order #${run.reference} will no longer be called by this automation.` })
    } catch (err) {
      toast.error('The call could not be canceled', { description: commerceErrorMessage(err, 'Try again.') })
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <>
      <RecordsPanel
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={runs.length === 0}
        filtered={filtered}
        emptyIcon={PhoneOutgoing}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription ?? 'Automated calls show up here as soon as an enabled automation finds an eligible order.'}
        loadingLabel="Loading automated calls…"
        minHeightClassName="min-h-[240px]"
        className={className}
        footer={
          pagination ? (
            <LoadMoreFooter
              shown={runs.length}
              total={pagination.total}
              hasMore={pagination.hasMore}
              isLoadingMore={pagination.isLoadingMore}
              loadMoreError={pagination.loadMoreError}
              onLoadMore={pagination.onLoadMore}
            />
          ) : footerLink ? (
            <div className="border-t border-rule px-5 py-3">
              <Link
                href={footerLink.href}
                className="relative tap-44 rounded-sm text-[13px] leading-[19px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4 outline-none transition-[text-decoration-color] duration-200 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {footerLink.label}
              </Link>
            </div>
          ) : undefined
        }
      >
        <Table>
          <caption className="sr-only">Automated calls</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Order</TableHead>
              {showAutomation && <TableHead scope="col" className="hidden @min-[640px]/records:table-cell">Automation</TableHead>}
              <TableHead scope="col" className="hidden @min-[520px]/records:table-cell">Phone</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="hidden @min-[760px]/records:table-cell">Outcome</TableHead>
              <TableHead scope="col" className="hidden @min-[900px]/records:table-cell">When</TableHead>
              <TableHead scope="col" className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => {
              const when = runWhen(run)
              const canCancel = cancellable && isCancellable(run)
              return (
                <TableRow key={run.id}>
                  <TableCell className="py-2.5">
                    <span className="block text-sm font-medium text-foreground tabular-nums">#{run.reference}</span>
                    <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                      {showAutomation && <span className="@min-[640px]/records:hidden">{automationTypeLabel(run.automation_type)} · </span>}
                      <span className="tabular-nums">
                        attempt {run.attempt}/{run.max_attempts}
                      </span>
                    </span>
                    {run.outcome && (
                      <span className="mt-1.5 block @min-[760px]/records:hidden">
                        <RunOutcomeChip outcome={run.outcome} />
                      </span>
                    )}
                  </TableCell>
                  {showAutomation && (
                    <TableCell className="hidden @min-[640px]/records:table-cell">{automationTypeLabel(run.automation_type)}</TableCell>
                  )}
                  <TableCell className="hidden text-muted-foreground tabular-nums @min-[520px]/records:table-cell">
                    {maskedOrDash(run.to_phone_masked)}
                  </TableCell>
                  <TableCell>
                    <RunStatusChip status={run.status} />
                    {run.status === 'suppressed' && run.eligibility_reason && (
                      <span className="mt-1 block max-w-[28ch] truncate text-xs leading-4 text-muted-foreground" title={run.eligibility_reason}>
                        {run.eligibility_reason}
                      </span>
                    )}
                    {run.status === 'failed' && run.error_message && (
                      <span className="mt-1 block max-w-[28ch] truncate text-xs leading-4 text-destructive" title={run.error_message}>
                        {run.error_message}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden @min-[760px]/records:table-cell">
                    <RunOutcomeChip outcome={run.outcome} />
                    {run.outcome_detail && (
                      <span className="mt-1 block max-w-[32ch] truncate text-xs leading-4 text-muted-foreground" title={run.outcome_detail}>
                        {run.outcome_detail}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground @min-[900px]/records:table-cell">
                    <span className="block text-xs leading-4">{when.label}</span>
                    {when.iso ? (
                      <time dateTime={when.iso} title={formatDateTime(when.iso)} className="block text-sm text-foreground tabular-nums">
                        {relativeTime(when.iso)}
                      </time>
                    ) : (
                      <span>—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      {run.call_id && (
                        <Button
                          variant="outline"
                          size="xs"
                          className="tap-44"
                          onClick={() => setOpenCallId(run.call_id)}
                          aria-label={`View the call for order #${run.reference}`}
                        >
                          <PhoneCall aria-hidden="true" />
                          <span className="hidden @min-[520px]/records:inline">View call</span>
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          variant="ghost"
                          size="xs"
                          className={cn('tap-44 text-muted-foreground hover:text-destructive')}
                          loading={cancellingId === run.id}
                          disabled={cancellingId !== null && cancellingId !== run.id}
                          onClick={() => void handleCancel(run)}
                          aria-label={`Cancel the call for order #${run.reference}`}
                        >
                          <Ban aria-hidden="true" />
                          <span className="hidden @min-[520px]/records:inline">Cancel</span>
                        </Button>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </RecordsPanel>

      <CallDetailSheet
        callId={openCallId}
        onClose={() => setOpenCallId(null)}
        onDeleted={() => {
          // The run keeps its row; its call is gone, so the list is re-read for the server's view.
          setOpenCallId(null)
          onRetry()
        }}
      />
    </>
  )
}
