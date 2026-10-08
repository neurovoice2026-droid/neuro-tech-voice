'use client'

import { useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, MoreHorizontal, Eye,
  FileText, Copy, Trash2, ChevronLeft, ChevronRight, Phone, PhoneCall,
  CheckCheck, RotateCw, TriangleAlert,
} from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrbInline, OrbLoader } from '@/components/shared/OrbLoader'
import { cn, formatDuration, formatPhoneNumber, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { CallDetailSheet } from './CallDetailSheet'
import { DeleteCallDialog } from './DeleteCallDialog'
import { AiOutcomeIcon, CallStatusBadge, HandledByBadge, TestCallBadge } from './CallBadges'
import type { CallListItem } from '@/lib/calls/labels'

const COLUMN_COUNT = 9

// Columns appear by the table panel's own width (container queries on `@container/calls`),
// not the viewport: the sidebar takes 240 px from lg up, so viewport breakpoints would
// overflow between 1024 and 1440. Thresholds are the cumulative column widths:
//   ≥560 date · ≥700 status · ≥880 handled by · ≥980 duration · ≥1100 AI outcome · ≥1170 agent.
// Below a threshold the caller cell carries that information (chips, relative time).
const COL = {
  date:     'hidden @min-[560px]/calls:table-cell',
  status:   'hidden @min-[700px]/calls:table-cell',
  handled:  'hidden @min-[880px]/calls:table-cell',
  duration: 'hidden @min-[980px]/calls:table-cell',
  outcome:  'hidden @min-[1100px]/calls:table-cell',
  agent:    'hidden @min-[1170px]/calls:table-cell',
}

interface CallsTableProps {
  calls: CallListItem[]
  isLoading: boolean
  error?: string | null
  /** A search or filter narrows the list: an empty result is a filter miss, not an empty account. */
  filtered?: boolean
  total: number
  totalPages: number
  page: number
  pageSize: number
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  onPageChange: (p: number) => void
  onPageSizeChange: (ps: number) => void
  onDeleteCall: (id: string) => void
  onRetry?: () => void
}

function PaginationBar({
  page, totalPages, pageSize, total, updating,
  onPageChange, onPageSizeChange,
}: {
  page: number; totalPages: number; pageSize: number; total: number
  /** A page/filter change is loading while the previous rows stay on screen. */
  updating: boolean
  onPageChange: (p: number) => void; onPageSizeChange: (ps: number) => void
}) {
  const from = Math.min((page - 1) * pageSize + 1, total)
  const to   = Math.min(page * pageSize, total)

  // Page numbers with ellipsis
  const pages: (number | '…')[] = []
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  return (
    <nav
      aria-label="Calls pagination"
      className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
    >
      <p className="flex min-h-5 items-center justify-center text-[13px] text-muted-foreground tabular-nums sm:justify-start" aria-live="polite">
        {updating ? (
          // The range would describe rows that are not on screen yet, so the bar says
          // "Updating…" next to the control that was pressed. Hidden from the live
          // region: the toolbar already announces it, and the new range is announced
          // when it lands.
          <span className="inline-flex items-center gap-1.5" aria-hidden="true">
            <OrbInline state="breathing" />
            Updating…
          </span>
        ) : (
          <>Showing {from}–{to} of {total.toLocaleString()} calls</>
        )}
      </p>
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="tap-44"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground" aria-hidden="true">…</span>
          ) : (
            <Button
              key={p}
              type="button"
              variant={p === page ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              className={cn('tap-44 min-w-8 w-auto px-2 tabular-nums', p !== page && 'text-muted-foreground hover:text-foreground')}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="tap-44"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="flex items-center justify-center gap-2 sm:justify-end">
        <span className="text-[13px] text-muted-foreground" id="calls-page-size-label">Rows per page</span>
        <Select value={String(pageSize)} onValueChange={(v) => v && onPageSizeChange(Number(v))}>
          <SelectTrigger size="sm" className="tabular-nums" aria-labelledby="calls-page-size-label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </nav>
  )
}

function callerText(call: CallListItem): string {
  return call.caller_number ? formatPhoneNumber(call.caller_number) : 'Unknown caller'
}

function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={formatDate(iso)} className={cn('tabular-nums', className)}>
      {formatDistanceToNowStrict(new Date(iso), { addSuffix: true })}
    </time>
  )
}

export function CallsTable({
  calls, isLoading, error, filtered = false, total, totalPages, page, pageSize,
  selectedIds, onSelectedIdsChange,
  onPageChange, onPageSizeChange, onDeleteCall, onRetry,
}: CallsTableProps) {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [sheetTab, setSheetTab]         = useState('overview')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [copiedId, setCopiedId]         = useState<string | null>(null)

  const selected = new Set(selectedIds)
  const allSelected = calls.length > 0 && calls.every((c) => selected.has(c.id))
  const someSelected = !allSelected && calls.some((c) => selected.has(c.id))

  function toggleAll() {
    const pageIds = calls.map((c) => c.id)
    if (allSelected) onSelectedIdsChange(selectedIds.filter((id) => !pageIds.includes(id)))
    else onSelectedIdsChange(Array.from(new Set([...selectedIds, ...pageIds])))
  }

  function toggleRow(id: string) {
    onSelectedIdsChange(selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  function openDetail(id: string, tab = 'overview') {
    setSelectedCallId(id)
    setSheetTab(tab)
  }

  function copyNumber(call: CallListItem) {
    if (!call.caller_number) {
      toast.error('This call has no phone number')
      return
    }
    navigator.clipboard.writeText(call.caller_number).then(
      () => {
        setCopiedId(call.id)
        toast.success('Phone number copied')
        setTimeout(() => setCopiedId(null), 2000)
      },
      () => toast.error('Could not copy to the clipboard'),
    )
  }

  function handleDeleted(id: string) {
    onDeleteCall(id)
    if (selectedCallId === id) setSelectedCallId(null)
    if (selected.has(id)) onSelectedIdsChange(selectedIds.filter((x) => x !== id))
  }

  function onRowKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openDetail(id)
    }
  }

  const refetching = isLoading && calls.length > 0

  return (
    <>
      <Card className="@container/calls gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all calls on this page"
                />
              </TableHead>
              <TableHead>Caller</TableHead>
              <TableHead className={cn('text-right', COL.duration)}>Duration</TableHead>
              <TableHead className={COL.status}>Status</TableHead>
              <TableHead className={COL.handled}>Handled by</TableHead>
              <TableHead className={cn('text-center', COL.outcome)}>AI outcome</TableHead>
              <TableHead className={COL.agent}>Agent</TableHead>
              <TableHead className={cn('text-right', COL.date)}>Date</TableHead>
              <TableHead className="w-12 last:pr-3 @min-[560px]/calls:last:pr-5"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && calls.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMN_COUNT} className="h-auto p-0">
                  <OrbLoader label="Loading calls…" className="min-h-[288px]" />
                </TableCell>
              </TableRow>
            ) : error && calls.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMN_COUNT} className="h-auto p-0 whitespace-normal">
                  <div role="alert">
                    <EmptyState
                      bare
                      icon={TriangleAlert}
                      iconClassName="bg-destructive-soft text-destructive shadow-none"
                      title="Calls could not be loaded"
                      description={error}
                      className="min-h-[288px]"
                      action={onRetry && (
                        <Button variant="outline" size="sm" onClick={onRetry}>
                          <RotateCw aria-hidden="true" /> Try again
                        </Button>
                      )}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ) : calls.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMN_COUNT} className="h-auto p-0 whitespace-normal">
                  {filtered ? (
                    <EmptyState
                      bare
                      icon={PhoneCall}
                      title="No calls found"
                      description="Try adjusting your filters or search term"
                      className="min-h-[288px]"
                    />
                  ) : (
                    // Nothing narrows the list, so the account has no calls yet (same copy as the dashboard).
                    <EmptyState
                      bare
                      icon={Phone}
                      title="No calls yet"
                      description="Calls will appear here once your agent starts receiving them."
                      className="min-h-[288px]"
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call) => {
                const isSelected = selected.has(call.id)
                const isActive   = selectedCallId === call.id
                const caller = callerText(call)
                const inbound = call.direction === 'inbound'

                return (
                  <TableRow
                    key={call.id}
                    tabIndex={0}
                    aria-label={`Open call from ${caller}`}
                    aria-selected={isSelected}
                    data-state={isSelected || isActive ? 'selected' : undefined}
                    onClick={() => openDetail(call.id)}
                    onKeyDown={(e) => onRowKeyDown(e, call.id)}
                    className={cn(
                      'cursor-pointer outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring',
                      // The open call gets an ink bar on its leading edge.
                      isActive && '[&>td:first-child]:shadow-[inset_3px_0_0_var(--foreground)]',
                      refetching && 'opacity-60'
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(call.id)}
                        aria-label={`Select call from ${caller}`}
                      />
                    </TableCell>

                    {/* Caller: number, summary line; status/handled-by/time on small screens */}
                    <TableCell className="py-2.5 pr-1 pl-3 @min-[560px]/calls:px-4">
                      {/* 102 px = checkbox, actions and this cell's padding on a narrow panel. */}
                      <div className="max-w-[calc(100cqw-102px)] min-w-0 @min-[560px]/calls:max-w-[260px]">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            role="img"
                            aria-label={inbound ? 'Inbound' : 'Outbound'}
                            title={inbound ? 'Inbound' : 'Outbound'}
                            className="inline-flex shrink-0 text-muted-foreground"
                          >
                            {inbound ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                          </span>
                          <span
                            className={cn(
                              'truncate text-sm font-medium tabular-nums',
                              !call.caller_number && 'text-muted-foreground'
                            )}
                          >
                            {caller}
                          </span>
                          {call.is_test && <TestCallBadge />}
                        </div>
                        {call.summary_title && (
                          <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground" title={call.summary_title}>
                            {call.summary_title}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 @min-[880px]/calls:hidden">
                          <span className="@min-[700px]/calls:hidden"><CallStatusBadge status={call.status} /></span>
                          <HandledByBadge call={call} />
                        </div>
                        {call.started_at && (
                          <p className="mt-1 text-xs leading-4 text-muted-foreground @min-[560px]/calls:hidden">
                            <RelativeTime iso={call.started_at} />
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Duration */}
                    <TableCell className={cn('text-right text-muted-foreground tabular-nums', COL.duration)}>
                      {call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : '—'}
                    </TableCell>

                    {/* Status */}
                    <TableCell className={COL.status}>
                      <CallStatusBadge status={call.status} />
                    </TableCell>

                    {/* Handled by */}
                    <TableCell className={COL.handled}>
                      <HandledByBadge call={call} />
                    </TableCell>

                    {/* AI outcome (call_successful; not sentiment) */}
                    <TableCell className={cn('text-center', COL.outcome)}>
                      <span className="inline-flex justify-center">
                        <AiOutcomeIcon value={call.call_successful} />
                      </span>
                    </TableCell>

                    {/* Agent */}
                    <TableCell className={cn('text-[13px] text-muted-foreground', COL.agent)}>
                      {call.agent_name ?? '—'}
                    </TableCell>

                    {/* Date */}
                    <TableCell className={cn('text-right', COL.date)}>
                      {call.started_at ? (
                        <div className="leading-4">
                          <RelativeTime iso={call.started_at} className="text-[13px] text-foreground" />
                          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                            {formatDate(call.started_at)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Actions dropdown */}
                    <TableCell
                      className="pl-1 last:pr-3 @min-[560px]/calls:last:pr-5"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for call from ${caller}`}
                          render={<Button variant="ghost" size="icon-sm" className="tap-44 text-muted-foreground hover:text-foreground aria-expanded:text-foreground" />}
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => openDetail(call.id, 'overview')}>
                              <Eye /> View details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDetail(call.id, 'transcript')}>
                              <FileText /> View transcript
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyNumber(call)} disabled={!call.caller_number}>
                              {copiedId === call.id
                                ? <><CheckCheck className="text-success-dot" /> Copied!</>
                                : <><Copy /> Copy number</>}
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(call.id)}
                          >
                            <Trash2 /> Delete call
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Selection */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-rule bg-band px-5 py-2.5">
            <span className="text-[13px] font-medium tabular-nums" aria-live="polite">
              {selectedIds.length} call{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <Button size="xs" variant="ghost" onClick={() => onSelectedIdsChange([])}>
              Clear
            </Button>
          </div>
        )}
      </Card>

      {/* Pagination (kept while a page or filter change refetches, so nothing jumps) */}
      {total > 0 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          total={total}
          updating={refetching}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}

      {/* Call detail sheet */}
      <CallDetailSheet
        callId={selectedCallId}
        onClose={() => setSelectedCallId(null)}
        onDeleted={handleDeleted}
        defaultTab={sheetTab}
      />

      {/* Delete dialog */}
      {deleteTarget && (
        <DeleteCallDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          callId={deleteTarget}
          onDeleted={(id) => { handleDeleted(id); setDeleteTarget(null) }}
        />
      )}
    </>
  )
}
