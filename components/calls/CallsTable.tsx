'use client'

import { useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, CheckCheck, ChevronLeft, ChevronRight, Copy, Eye,
  FileText, MoreHorizontal, PhoneOff, RefreshCw, SearchX, Trash2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn, formatDate, formatDuration, formatPhoneNumber } from '@/lib/utils'
import { PAGE_SIZES, type CallListItem } from '@/hooks/useCalls'
import { CallDetailSheet } from './CallDetailSheet'
import { DeleteCallDialog } from './DeleteCallDialog'
import {
  callerLabel, FallbackBadge, formatIntent, OutcomeChip, SentimentDot, StatusBadge, TagChips, TestBadge,
} from './call-display'

interface CallsTableProps {
  calls: CallListItem[]
  isInitialLoading: boolean
  isRefreshing: boolean
  error: string | null
  hasActiveFilters: boolean
  total: number
  totalPages: number
  page: number
  pageSize: number
  selectedIds: Set<string>
  onSelectedIdsChange: (ids: Set<string>) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onDeleteCall: (id: string) => void
  onClearFilters: () => void
  onRetry: () => void
  /** Opens this call's sheet on first render (links like /calls?call=<id>). */
  initialOpenCallId?: string | null
}

function CallerCell({ call }: { call: CallListItem }) {
  const number = callerLabel(call)
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {call.direction === 'outbound' ? (
        <ArrowUpRight aria-label="Outbound call" className="size-3.5 shrink-0 text-purple-500" />
      ) : (
        <ArrowDownLeft aria-label="Inbound call" className="size-3.5 shrink-0 text-blue-500" />
      )}
      <span className="truncate font-mono text-sm font-medium">
        {number ? formatPhoneNumber(number) : <span className="font-sans text-muted-foreground">Unknown caller</span>}
      </span>
    </span>
  )
}

/** Test / fallback markers; kept outside buttons because the fallback badge is focusable. */
function CallBadges({ call, className }: { call: CallListItem; className?: string }) {
  if (!call.is_test && !call.fallback_used) return null
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {call.is_test && <TestBadge />}
      {call.fallback_used && <FallbackBadge />}
    </div>
  )
}

function WhenCell({ startedAt, align = 'right' }: { startedAt: string | null; align?: 'left' | 'right' }) {
  if (!startedAt) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className={align === 'right' ? 'text-right' : undefined}>
      <p className="text-xs font-medium">{formatDistanceToNow(new Date(startedAt), { addSuffix: true })}</p>
      <p className="text-[11px] text-muted-foreground">{formatDate(startedAt)}</p>
    </div>
  )
}

function RowActions({
  call,
  copied,
  onOpen,
  onCopy,
  onDelete,
}: {
  call: CallListItem
  copied: boolean
  onOpen: (tab: string) => void
  onCopy: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Call actions"
        className="flex size-10 items-center justify-center rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 md:size-8"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onOpen('overview')}>
          <Eye className="mr-2 size-4" /> View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOpen('transcript')}>
          <FileText className="mr-2 size-4" /> View transcript
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopy} disabled={!callerLabel(call)}>
          {copied ? <CheckCheck className="mr-2 size-4 text-green-500" /> : <Copy className="mr-2 size-4" />}
          {copied ? 'Copied' : 'Copy number'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="mr-2 size-4" /> Delete call
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PaginationBar({
  page, totalPages, pageSize, total, onPageChange, onPageSizeChange,
}: {
  page: number
  totalPages: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  onPageSizeChange: (ps: number) => void
}) {
  const from = Math.min((page - 1) * pageSize + 1, total)
  const to = Math.min(page * pageSize, total)

  const pages: (number | 'gap')[] = []
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('gap')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('gap')
    pages.push(totalPages)
  }

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {total.toLocaleString()}
      </p>
      <div className="flex items-center justify-center gap-1">
        <Button variant="outline" size="icon-sm" className="max-sm:size-9" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-sm text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
              className={cn(
                'h-9 min-w-9 rounded-md px-2 text-sm transition-colors sm:h-7 sm:min-w-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                p === page ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-purple-50'
              )}
            >
              {p}
            </button>
          )
        )}
        <Button variant="outline" size="icon-sm" className="max-sm:size-9" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="flex items-center justify-center gap-2 sm:justify-end">
        <span className="text-sm text-muted-foreground">Rows per page</span>
        <Select value={String(pageSize)} onValueChange={(v) => v && onPageSizeChange(Number(v))}>
          <SelectTrigger aria-label="Rows per page" className="h-7 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </nav>
  )
}

export function CallsTable({
  calls, isInitialLoading, isRefreshing, error, hasActiveFilters, total, totalPages, page, pageSize,
  selectedIds, onSelectedIdsChange, onPageChange, onPageSizeChange, onDeleteCall, onClearFilters, onRetry,
  initialOpenCallId,
}: CallsTableProps) {
  const [openCall, setOpenCall] = useState<{ id: string; tab: string } | null>(() =>
    initialOpenCallId ? { id: initialOpenCallId, tab: 'overview' } : null
  )
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const allSelected = calls.length > 0 && calls.every((c) => selectedIds.has(c.id))
  const someSelected = !allSelected && calls.some((c) => selectedIds.has(c.id))

  function toggleAll() {
    const next = new Set(selectedIds)
    if (allSelected) calls.forEach((c) => next.delete(c.id))
    else calls.forEach((c) => next.add(c.id))
    onSelectedIdsChange(next)
  }

  function toggleRow(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedIdsChange(next)
  }

  async function copyNumber(call: CallListItem) {
    const number = callerLabel(call)
    if (!number) return
    try {
      await navigator.clipboard.writeText(number)
      setCopiedId(call.id)
      toast.success('Phone number copied')
      setTimeout(() => setCopiedId((current) => (current === call.id ? null : current)), 2000)
    } catch {
      toast.error('Couldn’t copy the number. Your browser blocked clipboard access.')
    }
  }

  function handleDeleted(id: string) {
    onDeleteCall(id)
    if (openCall?.id === id) setOpenCall(null)
    if (selectedIds.has(id)) {
      const next = new Set(selectedIds)
      next.delete(id)
      onSelectedIdsChange(next)
    }
  }

  const showEmpty = !isInitialLoading && !error && calls.length === 0

  return (
    <>
      <div className={cn('overflow-hidden rounded-xl border bg-card shadow-sm transition-opacity', isRefreshing && !isInitialLoading && 'opacity-70')} aria-busy={isInitialLoading || isRefreshing}>
        {error ? (
          <EmptyState
            icon={PhoneOff}
            title="Calls didn’t load"
            description={error}
            action={
              <Button variant="outline" onClick={onRetry} className="gap-2">
                <RefreshCw className="size-4" /> Try again
              </Button>
            }
          />
        ) : showEmpty ? (
          hasActiveFilters ? (
            <EmptyState
              icon={SearchX}
              title="No calls match these filters"
              description="Try a different search or clear the filters to see every call."
              action={<Button variant="outline" onClick={onClearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={PhoneOff}
              title="No calls yet"
              description="When your agent answers its first call, the transcript, summary and outcome will appear here."
            />
          )
        ) : (
          <>
            {/* Cards below md */}
            <ul className="divide-y md:hidden">
              {isInitialLoading
                ? [...Array(6)].map((_, i) => (
                    <li key={i} className="space-y-2 p-4">
                      <div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-16" /></div>
                      <Skeleton className="h-3 w-full" />
                      <div className="flex gap-2"><Skeleton className="h-5 w-20 rounded-full" /><Skeleton className="h-5 w-14 rounded-full" /></div>
                    </li>
                  ))
                : calls.map((call) => {
                    const intent = formatIntent(call.intent)
                    return (
                      <li key={call.id} className={cn('relative', selectedIds.has(call.id) && 'bg-purple-50/40')}>
                        <div className="flex items-start gap-3 p-4">
                          <Checkbox
                            checked={selectedIds.has(call.id)}
                            onCheckedChange={() => toggleRow(call.id)}
                            aria-label="Select call"
                            // A 16 px box is hard to hit on a phone; the invisible margin makes it about 40 px.
                            className="relative mt-0.5 after:absolute after:-inset-3"
                          />
                          <div className="min-w-0 flex-1">
                            {/* Phrasing elements only: this is the content of a button. */}
                            <button
                              type="button"
                              onClick={() => setOpenCall({ id: call.id, tab: 'overview' })}
                              className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                              <span className="flex items-start justify-between gap-2">
                                <CallerCell call={call} />
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : '—'}
                                </span>
                              </span>
                              {call.summary && <span className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{call.summary}</span>}
                              <span className="mt-2 flex flex-wrap items-center gap-2">
                                {call.status !== 'in-progress' && <OutcomeChip outcome={call.outcome} />}
                                {call.status !== 'completed' && <StatusBadge status={call.status} />}
                                {call.sentiment && <SentimentDot sentiment={call.sentiment} showLabel />}
                                {intent && <span className="text-xs text-muted-foreground">{intent}</span>}
                              </span>
                              <span className="mt-2 flex items-center justify-between gap-2">
                                <TagChips tags={call.tags} max={2} />
                                <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                                  {call.started_at ? formatDistanceToNow(new Date(call.started_at), { addSuffix: true }) : ''}
                                </span>
                              </span>
                            </button>
                            <CallBadges call={call} className="mt-2" />
                          </div>
                          <RowActions
                            call={call}
                            copied={copiedId === call.id}
                            onOpen={(tab) => setOpenCall({ id: call.id, tab })}
                            onCopy={() => void copyNumber(call)}
                            onDelete={() => setDeleteTarget(call.id)}
                          />
                        </div>
                      </li>
                    )
                  })}
            </ul>

            {/* Table from md */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all calls on this page"
                        disabled={isInitialLoading || calls.length === 0}
                      />
                    </TableHead>
                    <TableHead>Caller</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="hidden lg:table-cell">Intent</TableHead>
                    <TableHead className="hidden xl:table-cell">Tags</TableHead>
                    <TableHead className="text-center">Sentiment</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isInitialLoading
                    ? [...Array(8)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="size-4 rounded" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="mx-auto size-2 rounded-full" /></TableCell>
                          <TableCell><Skeleton className="ml-auto h-4 w-10" /></TableCell>
                          <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="size-6" /></TableCell>
                        </TableRow>
                      ))
                    : calls.map((call) => {
                        const selected = selectedIds.has(call.id)
                        const active = openCall?.id === call.id
                        return (
                          <TableRow
                            key={call.id}
                            onClick={() => setOpenCall({ id: call.id, tab: 'overview' })}
                            className={cn(
                              'cursor-pointer transition-colors',
                              active && 'bg-purple-50 shadow-[inset_4px_0_0_var(--color-primary)]',
                              selected && !active && 'bg-purple-50/30',
                              !active && 'hover:bg-purple-50/20'
                            )}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={selected} onCheckedChange={() => toggleRow(call.id)} aria-label="Select call" />
                            </TableCell>
                            <TableCell className="max-w-56">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenCall({ id: call.id, tab: 'overview' })
                                }}
                                className="block max-w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                aria-label={`Open call from ${callerLabel(call) ?? 'unknown caller'}`}
                              >
                                <CallerCell call={call} />
                              </button>
                              <CallBadges call={call} className="mt-1" />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col items-start gap-1">
                                {call.status !== 'in-progress' && <OutcomeChip outcome={call.outcome} />}
                                {call.status !== 'completed' && <StatusBadge status={call.status} />}
                              </div>
                            </TableCell>
                            <TableCell className="hidden max-w-40 whitespace-normal lg:table-cell">
                              <span className="line-clamp-2 text-xs text-muted-foreground">{formatIntent(call.intent) ?? '—'}</span>
                            </TableCell>
                            <TableCell className="hidden max-w-44 whitespace-normal xl:table-cell">
                              {call.tags?.length ? <TagChips tags={call.tags} /> : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              <SentimentDot sentiment={call.sentiment} />
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm text-muted-foreground">
                                {call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <WhenCell startedAt={call.started_at} />
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <RowActions
                                call={call}
                                copied={copiedId === call.id}
                                onOpen={(tab) => setOpenCall({ id: call.id, tab })}
                                onCopy={() => void copyNumber(call)}
                                onDelete={() => setDeleteTarget(call.id)}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {selectedIds.size > 0 && (
          <div className="m-3 flex items-center justify-between gap-3 rounded-xl bg-purple-900 px-4 py-3 text-white">
            <span className="text-sm font-medium">
              {selectedIds.size} {selectedIds.size === 1 ? 'call' : 'calls'} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-white/30 bg-transparent text-xs text-white hover:bg-white/10 hover:text-white"
              onClick={() => onSelectedIdsChange(new Set())}
            >
              Clear selection
            </Button>
          </div>
        )}
      </div>

      {!isInitialLoading && !error && total > 0 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}

      <CallDetailSheet
        callId={openCall?.id ?? null}
        defaultTab={openCall?.tab ?? 'overview'}
        onClose={() => setOpenCall(null)}
        onDeleted={handleDeleted}
      />

      {deleteTarget && (
        <DeleteCallDialog
          open
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          callId={deleteTarget}
          onDeleted={(id) => {
            handleDeleted(id)
            setDeleteTarget(null)
          }}
        />
      )}
    </>
  )
}
