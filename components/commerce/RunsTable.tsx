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
import { automationTypeLabel, runReferenceLabel, runStatusReason, runSubjectLabel, runWhen } from './labels'
import { RunOutcomeChip, RunStatusChip } from './StatusChips'
import { LoadMoreFooter, RecordsPanel } from './ListScaffold'

// One table for every list of automation runs (overview, automation history,
// order detail). "View call" opens the same CallDetailSheet the Calls page
// uses, in place, so the person never lands on a list that ignores the id.
// Like the calls table, the columns follow the panel's width, not the
// page's (the same table sits in the 600px order sheet): what a narrow panel
// hides (status, phone, outcome, when) is folded under the reference, and the
// row actions shrink to icon buttons, so nothing leaves the panel.

/**
 * When each column joins, by the panel's width (container queries on the
 * RecordsPanel). Below its breakpoint a column's content is folded under the
 * reference in the first cell; the action buttons keep only their icon
 * (aria-label and title name them) until the panel is wide enough for all.
 */
const COL = {
  status: 'hidden @min-[640px]/records:table-cell',
  phone: 'hidden @min-[800px]/records:table-cell',
  automation: 'hidden @min-[960px]/records:table-cell',
  outcome: 'hidden @min-[1060px]/records:table-cell',
  when: 'hidden @min-[1100px]/records:table-cell',
  actionLabel: 'hidden @min-[1200px]/records:inline',
} as const

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
      toast.success('Call canceled', { description: `${runSubjectLabel(run)} will no longer be called by this automation.` })
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
              {showAutomation && <TableHead scope="col" className={COL.automation}>Automation</TableHead>}
              <TableHead scope="col" className={COL.phone}>Phone</TableHead>
              <TableHead scope="col" className={COL.status}>Status</TableHead>
              <TableHead scope="col" className={COL.outcome}>Outcome</TableHead>
              <TableHead scope="col" className={COL.when}>When</TableHead>
              <TableHead scope="col" className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => {
              const when = runWhen(run)
              const reason = runStatusReason(run)
              const canCancel = cancellable && isCancellable(run)
              const subject = runSubjectLabel(run).toLowerCase()
              return (
                <TableRow key={run.id}>
                  <TableCell className="py-2.5">
                    {/* The panel width less the actions cell: the folded details truncate instead of widening the table. */}
                    <div className="max-w-[calc(100cqw-144px)] min-w-0 @min-[640px]/records:max-w-[28ch]">
                      <span className="block truncate text-sm font-medium text-foreground tabular-nums">{runReferenceLabel(run)}</span>
                      <span className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground">
                        {showAutomation && <span className="@min-[960px]/records:hidden">{automationTypeLabel(run.automation_type)} · </span>}
                        <span className="tabular-nums">
                          attempt {run.attempt}/{run.max_attempts}
                        </span>
                      </span>
                      {run.to_phone_masked && (
                        <span className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground tabular-nums @min-[800px]/records:hidden">{run.to_phone_masked}</span>
                      )}
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 @min-[640px]/records:hidden">
                        <RunStatusChip status={run.status} />
                      </span>
                      {reason && (
                        <span className="mt-1 block truncate text-xs leading-4 text-muted-foreground @min-[640px]/records:hidden" title={reason}>
                          {reason}
                        </span>
                      )}
                      {run.status === 'failed' && run.error_message && (
                        <span className="mt-1 block truncate text-xs leading-4 text-destructive @min-[640px]/records:hidden" title={run.error_message}>
                          {run.error_message}
                        </span>
                      )}
                      {run.outcome && (
                        <span className="mt-1.5 block @min-[1060px]/records:hidden">
                          <RunOutcomeChip outcome={run.outcome} />
                        </span>
                      )}
                      {run.outcome_detail && (
                        <span className="mt-1 block truncate text-xs leading-4 text-muted-foreground @min-[1060px]/records:hidden" title={run.outcome_detail}>
                          {run.outcome_detail}
                        </span>
                      )}
                      {when.iso && (
                        <span className="mt-1 block truncate text-xs leading-4 text-muted-foreground @min-[1100px]/records:hidden">
                          {when.label}{' '}
                          <time dateTime={when.iso} title={formatDateTime(when.iso)} className="tabular-nums">
                            {relativeTime(when.iso)}
                          </time>
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {showAutomation && (
                    <TableCell className={COL.automation}>{automationTypeLabel(run.automation_type)}</TableCell>
                  )}
                  <TableCell className={cn('text-muted-foreground tabular-nums', COL.phone)}>
                    {maskedOrDash(run.to_phone_masked)}
                  </TableCell>
                  <TableCell className={COL.status}>
                    <RunStatusChip status={run.status} />
                    {/* Why it is held back, waiting (e.g. out of minutes) or skipped. */}
                    {reason && (
                      <span className="mt-1 block max-w-[24ch] truncate text-xs leading-4 text-muted-foreground" title={reason}>
                        {reason}
                      </span>
                    )}
                    {run.status === 'failed' && run.error_message && (
                      <span className="mt-1 block max-w-[24ch] truncate text-xs leading-4 text-destructive" title={run.error_message}>
                        {run.error_message}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={COL.outcome}>
                    <RunOutcomeChip outcome={run.outcome} />
                    {run.outcome_detail && (
                      <span className="mt-1 block max-w-[24ch] truncate text-xs leading-4 text-muted-foreground" title={run.outcome_detail}>
                        {run.outcome_detail}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={cn('text-muted-foreground', COL.when)}>
                    <span className="block text-xs leading-4">{when.label}</span>
                    {when.iso ? (
                      <time dateTime={when.iso} title={formatDateTime(when.iso)} className="block text-sm text-foreground tabular-nums">
                        {relativeTime(when.iso)}
                      </time>
                    ) : (
                      <span>—</span>
                    )}
                  </TableCell>
                  <TableCell className="pl-1 text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      {run.call_id && (
                        <Button
                          variant="outline"
                          size="xs"
                          className="tap-44"
                          onClick={() => setOpenCallId(run.call_id)}
                          aria-label={`View the call for ${subject}`}
                          title="View call"
                        >
                          <PhoneCall aria-hidden="true" />
                          <span className={COL.actionLabel}>View call</span>
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
                          aria-label={`Cancel the call for ${subject}`}
                          title="Cancel"
                        >
                          <Ban aria-hidden="true" />
                          <span className={COL.actionLabel}>Cancel</span>
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
