'use client'

import { useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, MoreHorizontal, Phone, Eye,
  FileText, Copy, Trash2, ChevronLeft, ChevronRight, Search,
  CheckCheck,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
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
import type { Call, CallFilters } from '@/types'

const STATUS_BADGE: Record<string, string> = {
  completed:     'border-green-200 bg-green-100 text-green-700',
  failed:        'border-red-200 bg-red-100 text-red-700',
  busy:          'border-amber-200 bg-amber-100 text-amber-700',
  'no-answer':   'border-gray-200 bg-gray-100 text-gray-600',
  'in-progress': 'border-blue-200 bg-blue-100 text-blue-700',
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completed', failed: 'Failed', busy: 'Busy',
  'no-answer': 'No answer', 'in-progress': 'In progress',
}

interface CallsTableProps {
  calls: Call[]
  isLoading: boolean
  total: number
  totalPages: number
  page: number
  pageSize: number
  filters: CallFilters
  onPageChange: (p: number) => void
  onPageSizeChange: (ps: number) => void
  onDeleteCall: (id: string) => void
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell><Skeleton className="h-4 w-6" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-6" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
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
  calls: Call[]; onPageChange: (p: number) => void; onPageSizeChange: (ps: number) => void
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1 mt-4">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {total.toLocaleString()} calls
      </p>
      <div className="flex items-center gap-2 justify-center">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'h-7 min-w-7 rounded-md px-2.5 text-sm transition-colors',
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
          disabled={page === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 justify-center sm:justify-end">
        <span className="text-sm text-muted-foreground">Rows per page:</span>
        <Select value={String(pageSize)} onValueChange={(v) => v && onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-7 w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function CallsTable({
  calls, isLoading, total, totalPages, page, pageSize,
  onPageChange, onPageSizeChange, onDeleteCall,
}: CallsTableProps) {
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [sheetTab, setSheetTab]         = useState('overview')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [copiedId, setCopiedId]         = useState<string | null>(null)

  const allSelected = calls.length > 0 && calls.every((c) => selectedIds.has(c.id))

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(calls.map((c) => c.id)))
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openDetail(id: string, tab = 'overview') {
    setSelectedCallId(id)
    setSheetTab(tab)
  }

  function copyNumber(call: Call, e: React.MouseEvent) {
    e.stopPropagation()
    if (!call.caller_number) return
    navigator.clipboard.writeText(call.caller_number)
    setCopiedId(call.id)
    toast.success('Phone number copied')
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleDeleted(id: string) {
    onDeleteCall(id)
    if (selectedCallId === id) setSelectedCallId(null)
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next })
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
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Caller</TableHead>
              <TableHead className="w-16 text-center hidden sm:table-cell">Dir.</TableHead>
              <TableHead className="text-right hidden md:table-cell">Duration</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center hidden lg:table-cell">Sentiment</TableHead>
              <TableHead className="hidden xl:table-cell">Agent</TableHead>
              <TableHead className="text-right">Date</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
            ) : calls.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16">
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
                </td>
              </tr>
            ) : (
              calls.map((call) => {
                const isSelected = selectedIds.has(call.id)
                const isActive   = selectedCallId === call.id

                return (
                  <TableRow
                    key={call.id}
                    onClick={() => openDetail(call.id)}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isActive  && 'border-l-4 border-l-primary bg-purple-50',
                      isSelected && !isActive && 'bg-purple-50/30',
                      !isActive  && 'hover:bg-purple-50/20'
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(call.id)}
                        aria-label="Select row"
                      />
                    </TableCell>

                    {/* Caller */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-mono text-sm font-medium">
                          {call.caller_number ? formatPhoneNumber(call.caller_number) : (
                            <span className="text-muted-foreground">Unknown caller</span>
                          )}
                        </span>
                      </div>
                    </TableCell>

                    {/* Direction */}
                    <TableCell className="text-center hidden sm:table-cell">
                      {call.direction === 'inbound' ? (
                        <span title="Inbound"><ArrowDownLeft className="h-4 w-4 text-blue-500 mx-auto" /></span>
                      ) : (
                        <span title="Outbound"><ArrowUpRight className="h-4 w-4 text-purple-500 mx-auto" /></span>
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
                      <Badge
                        variant="outline"
                        className={cn('text-xs capitalize', STATUS_BADGE[call.status])}
                      >
                        {call.status === 'in-progress' && (
                          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                        )}
                        {STATUS_LABEL[call.status] ?? call.status}
                      </Badge>
                    </TableCell>

                    {/* Sentiment */}
                    <TableCell className="text-center hidden lg:table-cell">
                      {call.sentiment === 'positive' && <span title="Positive" className="text-base">😊</span>}
                      {call.sentiment === 'neutral'  && <span title="Neutral"  className="text-base">😐</span>}
                      {call.sentiment === 'negative' && <span title="Negative" className="text-base">😞</span>}
                      {!call.sentiment               && <span className="text-muted-foreground text-xs">—</span>}
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors outline-none"
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
                          <DropdownMenuItem onClick={(e) => copyNumber(call, e)}>
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
        {selectedIds.size > 0 && (
          <div className="mx-4 mb-4 mt-2 flex items-center justify-between rounded-xl bg-purple-900 px-4 py-3 text-white">
            <span className="text-sm font-medium">{selectedIds.size} call{selectedIds.size > 1 ? 's' : ''} selected</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-white/30 text-white hover:bg-white/10"
                onClick={() => setSelectedIds(new Set())}
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
          calls={calls}
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
