'use client'

import { useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, MoreHorizontal, Phone, Eye,
  FileText, Copy, Trash2, ChevronLeft, ChevronRight, Search,
  CheckCheck, RotateCw,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatDuration, formatPhoneNumber, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { CallDetailSheet } from './CallDetailSheet'
import { DeleteCallDialog } from './DeleteCallDialog'
import { AiOutcomeIcon, CallStatusBadge, HandledByBadge, TestCallBadge } from './CallBadges'
import type { CallListItem } from '@/lib/calls/labels'

const COLUMN_COUNT = 10

interface CallsTableProps {
  calls: CallListItem[]
  isLoading: boolean
  error?: string | null
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

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-6" /></TableCell>
      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-28 rounded-full" /></TableCell>
      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-6" /></TableCell>
      <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-6" /></TableCell>
    </TableRow>
  )
}

function PaginationBar({
  page, totalPages, pageSize, total,
  onPageChange, onPageSizeChange,
}: {
  page: number; totalPages: number; pageSize: number; total: number
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
    <nav aria-label="Calls pagination" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1 mt-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {from}–{to} of {total.toLocaleString()} calls
      </p>
      <div className="flex items-center gap-2 justify-center">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm" aria-hidden="true">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'h-7 min-w-7 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                p === page
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-purple-50 text-foreground'
              )}
            >
              {p}
            </button>
          )
        )}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 justify-center sm:justify-end">
        <span className="text-sm text-muted-foreground" id="calls-page-size-label">Rows per page:</span>
        <Select value={String(pageSize)} onValueChange={(v) => v && onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-7 w-16" aria-labelledby="calls-page-size-label">
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

export function CallsTable({
  calls, isLoading, error, total, totalPages, page, pageSize,
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

  return (
    <>
      <div className="rounded-xl border shadow-sm bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all calls on this page"
                />
              </TableHead>
              <TableHead>Caller</TableHead>
              <TableHead className="w-16 text-center hidden sm:table-cell">Dir.</TableHead>
              <TableHead className="text-right hidden md:table-cell">Duration</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="hidden md:table-cell">Handled by</TableHead>
              <TableHead className="text-center hidden lg:table-cell">AI outcome</TableHead>
              <TableHead className="hidden xl:table-cell">Agent</TableHead>
              <TableHead className="text-right">Date</TableHead>
              <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && calls.length === 0 ? (
              [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
            ) : error && calls.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMN_COUNT} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-center" role="alert">
                    <p className="font-semibold text-sm">Calls could not be loaded</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    {onRetry && (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
                        <RotateCw className="h-3.5 w-3.5" /> Try again
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : calls.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMN_COUNT} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-muted p-4">
                      <Search className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">No calls found</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Try adjusting your filters or search term
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call) => {
                const isSelected = selected.has(call.id)
                const isActive   = selectedCallId === call.id
                const caller = callerText(call)

                return (
                  <TableRow
                    key={call.id}
                    tabIndex={0}
                    aria-label={`Open call from ${caller}`}
                    aria-selected={isSelected}
                    onClick={() => openDetail(call.id)}
                    onKeyDown={(e) => onRowKeyDown(e, call.id)}
                    className={cn(
                      'cursor-pointer transition-colors outline-none focus-visible:bg-purple-50/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50',
                      isActive  && 'border-l-4 border-l-primary bg-purple-50',
                      isSelected && !isActive && 'bg-purple-50/30',
                      !isActive  && 'hover:bg-purple-50/20',
                      isLoading && 'opacity-60'
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

                    {/* Caller (+ title, and the handled-by badge on small screens) */}
                    <TableCell className="max-w-[16rem]">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                        <span className={cn('font-mono text-sm font-medium', !call.caller_number && 'font-sans text-muted-foreground')}>
                          {caller}
                        </span>
                        {call.is_test && <TestCallBadge />}
                      </div>
                      {call.summary_title && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={call.summary_title}>
                          {call.summary_title}
                        </p>
                      )}
                      <div className="mt-1 md:hidden">
                        <HandledByBadge call={call} />
                      </div>
                    </TableCell>

                    {/* Direction */}
                    <TableCell className="text-center hidden sm:table-cell">
                      {call.direction === 'inbound' ? (
                        <span title="Inbound"><ArrowDownLeft className="h-4 w-4 text-blue-500 mx-auto" aria-label="Inbound" /></span>
                      ) : (
                        <span title="Outbound"><ArrowUpRight className="h-4 w-4 text-purple-500 mx-auto" aria-label="Outbound" /></span>
                      )}
                    </TableCell>

                    {/* Duration */}
                    <TableCell className="text-right hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : '—'}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      <CallStatusBadge status={call.status} />
                    </TableCell>

                    {/* Handled by */}
                    <TableCell className="hidden md:table-cell">
                      <HandledByBadge call={call} />
                    </TableCell>

                    {/* AI outcome (call_successful; not sentiment) */}
                    <TableCell className="text-center hidden lg:table-cell">
                      <AiOutcomeIcon value={call.call_successful} />
                    </TableCell>

                    {/* Agent */}
                    <TableCell className="hidden xl:table-cell">
                      <span className="text-xs text-muted-foreground">{call.agent_name ?? '—'}</span>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="text-right">
                      {call.started_at ? (
                        <div>
                          <p className="text-xs font-medium">
                            {formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDate(call.started_at)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Actions dropdown */}
                    <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for call from ${caller}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => openDetail(call.id, 'overview')}>
                            <Eye className="mr-2 h-4 w-4" /> View details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDetail(call.id, 'transcript')}>
                            <FileText className="mr-2 h-4 w-4" /> View transcript
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyNumber(call)} disabled={!call.caller_number}>
                            {copiedId === call.id
                              ? <><CheckCheck className="mr-2 h-4 w-4 text-green-500" /> Copied!</>
                              : <><Copy className="mr-2 h-4 w-4" /> Copy number</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(call.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete call
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

        {/* Bulk actions */}
        {selectedIds.length > 0 && (
          <div className="mx-4 mb-4 mt-2 flex items-center justify-between rounded-xl bg-purple-900 px-4 py-3 text-white">
            <span className="text-sm font-medium" aria-live="polite">
              {selectedIds.length} call{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-white/30 bg-transparent text-white hover:bg-white/10"
                onClick={() => onSelectedIdsChange([])}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          total={total}
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
