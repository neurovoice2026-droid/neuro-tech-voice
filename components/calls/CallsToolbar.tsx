'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Download, Hash, Loader2, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { activeFilterCount, DEFAULT_CALL_FILTERS } from '@/hooks/useCalls'
import { ExportDialog } from './ExportDialog'
import { OUTCOME_META, OUTCOME_OPTIONS, SENTIMENT_META, STATUS_META } from './call-display'
import type { CallFilters, CallOutcome } from '@/types'

interface CallsToolbarProps {
  filters: CallFilters
  onFiltersChange: (filters: CallFilters) => void
  /** Show dashboard test calls in the list (hidden by default). */
  includeTest: boolean
  onIncludeTestChange: (includeTest: boolean) => void
  /** null while the list couldn't be loaded, so no misleading "0 calls" shows. */
  totalCount: number | null
  isLoading: boolean
  selectedIds: string[]
}

const STATUS_OPTS: { value: CallFilters['status']; label: string }[] = [
  { value: 'all', label: 'Any status' },
  { value: 'completed', label: STATUS_META.completed.label },
  { value: 'failed', label: STATUS_META.failed.label },
  { value: 'busy', label: STATUS_META.busy.label },
  { value: 'no-answer', label: STATUS_META['no-answer'].label },
]

const DIRECTION_OPTS: { value: CallFilters['direction']; label: string }[] = [
  { value: 'all', label: 'In & outbound' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
]

const SENTIMENT_OPTS: { value: CallFilters['sentiment']; label: string }[] = [
  { value: 'all', label: 'Any sentiment' },
  { value: 'positive', label: SENTIMENT_META.positive.label },
  { value: 'neutral', label: SENTIMENT_META.neutral.label },
  { value: 'negative', label: SENTIMENT_META.negative.label },
]

const OUTCOME_OPTS: { value: CallFilters['outcome']; label: string }[] = [
  { value: 'all', label: 'Any outcome' },
  ...OUTCOME_OPTIONS,
]

const SORT_OPTS = [
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'created_at:asc', label: 'Oldest first' },
  { value: 'duration_seconds:desc', label: 'Longest first' },
  { value: 'caller_number:asc', label: 'Phone number' },
]

const SEARCH_DEBOUNCE_MS = 350

/**
 * Text input that reports its value after a pause and follows outside changes
 * (e.g. "Clear all") without overwriting what the owner is still typing.
 */
function useDebouncedField(value: string, onCommit: (value: string) => void) {
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  const [committed, setCommitted] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commitRef = useRef(onCommit)

  useEffect(() => {
    commitRef.current = onCommit
  })

  if (value !== seen) {
    setSeen(value)
    if (value !== committed) {
      setDraft(value)
      setCommitted(value)
    }
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function change(next: string) {
    setDraft(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setCommitted(next)
      commitRef.current(next)
    }, SEARCH_DEBOUNCE_MS)
  }

  /** Sets the field and reports it immediately. */
  function commitNow(next: string) {
    reset(next)
    commitRef.current(next)
  }

  /** Sets the field without reporting (the caller updates the filters itself). */
  function reset(next: string) {
    if (timer.current) clearTimeout(timer.current)
    setDraft(next)
    setCommitted(next)
  }

  return { draft, change, commitNow, reset }
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as T)}>
      <SelectTrigger aria-label={label} className={cn('h-9 w-full sm:w-40', value !== 'all' && 'border-primary/40 bg-purple-50/50', className)}>
        <SelectValue>{(v: string) => options.find((o) => o.value === v)?.label ?? v}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CallsToolbar({
  filters, onFiltersChange, includeTest, onIncludeTestChange, totalCount, isLoading, selectedIds,
}: CallsToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const moreId = useId()
  const fromId = useId()
  const toId = useId()
  const minId = useId()
  const testId = useId()

  // Debounced fields call the latest render's commit handler (useDebouncedField
  // keeps it in a ref), so a pause-then-commit merges into the current filters.
  function update(partial: Partial<CallFilters>) {
    onFiltersChange({ ...filters, ...partial })
  }

  const search = useDebouncedField(filters.search, (value) => update({ search: value }))
  const tag = useDebouncedField(filters.tag, (value) => update({ tag: value.replace(/^#/, '') }))

  const moreCount = [filters.dateFrom !== '', filters.dateTo !== '', filters.minDuration > 0].filter(Boolean).length
  const activeCount = activeFilterCount(filters)

  function clearAll() {
    search.reset('')
    tag.reset('')
    onFiltersChange({ ...DEFAULT_CALL_FILTERS, sortBy: filters.sortBy, sortOrder: filters.sortOrder })
  }

  const pills: { key: string; label: string; clear: () => void }[] = []
  if (filters.outcome !== 'all') pills.push({ key: 'outcome', label: OUTCOME_META[filters.outcome as CallOutcome].label, clear: () => update({ outcome: 'all' }) })
  if (filters.status !== 'all') pills.push({ key: 'status', label: STATUS_META[filters.status].label, clear: () => update({ status: 'all' }) })
  if (filters.direction !== 'all') pills.push({ key: 'direction', label: filters.direction === 'inbound' ? 'Inbound' : 'Outbound', clear: () => update({ direction: 'all' }) })
  if (filters.sentiment !== 'all') pills.push({ key: 'sentiment', label: `${SENTIMENT_META[filters.sentiment].label} sentiment`, clear: () => update({ sentiment: 'all' }) })
  if (filters.tag) pills.push({ key: 'tag', label: `#${filters.tag}`, clear: () => tag.commitNow('') })
  if (filters.dateFrom) pills.push({ key: 'from', label: `From ${filters.dateFrom}`, clear: () => update({ dateFrom: '' }) })
  if (filters.dateTo) pills.push({ key: 'to', label: `Until ${filters.dateTo}`, clear: () => update({ dateTo: '' }) })
  if (filters.minDuration > 0) pills.push({ key: 'min', label: `At least ${filters.minDuration}s`, clear: () => update({ minDuration: 0 }) })

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm sm:p-4">
      {/* Search + export */}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search.draft}
            onChange={(e) => search.change(e.target.value)}
            placeholder="Search calls"
            aria-label="Search calls, transcripts and summaries"
            maxLength={200}
            className="h-9 pl-9 pr-8"
          />
          {search.draft && (
            <button
              type="button"
              onClick={() => search.commitNow('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button variant="outline" className="h-9 shrink-0 gap-2" onClick={() => setExportOpen(true)}>
          <Download aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Export</span>
          <span className="sr-only sm:hidden">Export calls</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <FilterSelect label="Outcome" value={filters.outcome} options={OUTCOME_OPTS} onChange={(outcome) => update({ outcome })} />
        <FilterSelect label="Status" value={filters.status} options={STATUS_OPTS} onChange={(status) => update({ status })} />
        <FilterSelect label="Direction" value={filters.direction} options={DIRECTION_OPTS} onChange={(direction) => update({ direction })} />
        <FilterSelect label="Sentiment" value={filters.sentiment} options={SENTIMENT_OPTS} onChange={(sentiment) => update({ sentiment })} />
        <div className="relative col-span-1 sm:w-40">
          <Hash aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={tag.draft}
            onChange={(e) => tag.change(e.target.value)}
            placeholder="Tag"
            aria-label="Filter by tag"
            maxLength={64}
            className={cn('h-9 pl-7', filters.tag && 'border-primary/40 bg-purple-50/50')}
          />
        </div>
        <Button
          variant="outline"
          className={cn('h-9 min-w-0 gap-2 px-2.5 sm:px-3', moreCount > 0 && 'border-primary/40 bg-purple-50/50')}
          aria-expanded={moreOpen}
          aria-controls={moreId}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          <span className="truncate sm:hidden">More filters</span>
          <span className="hidden sm:inline">Dates & length</span>
          {moreCount > 0 && (
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {moreCount}
            </span>
          )}
        </Button>
      </div>

      {moreOpen && (
        <div id={moreId} className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={fromId} className="text-xs">From</Label>
            <Input
              id={fromId}
              type="date"
              value={filters.dateFrom}
              max={filters.dateTo || undefined}
              onChange={(e) => update({ dateFrom: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={toId} className="text-xs">Until</Label>
            <Input
              id={toId}
              type="date"
              value={filters.dateTo}
              min={filters.dateFrom || undefined}
              onChange={(e) => update({ dateTo: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={minId} className="text-xs">
              Shortest call: {filters.minDuration > 0 ? `${filters.minDuration}s` : 'any'}
            </Label>
            <input
              id={minId}
              type="range"
              min={0}
              max={300}
              step={10}
              value={filters.minDuration}
              onChange={(e) => update({ minDuration: Number(e.target.value) })}
              className="h-9 w-full accent-primary"
            />
          </div>
        </div>
      )}

      {/* Count + sort */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2" aria-live="polite">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {isLoading && <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />}
            {isLoading ? 'Updating…' : totalCount === null ? '' : `${totalCount.toLocaleString()} ${totalCount === 1 ? 'call' : 'calls'}`}
          </span>
          {activeCount > 0 && (
            <button type="button" onClick={clearAll} className="text-sm text-primary hover:underline focus-visible:underline focus-visible:outline-none">
              Clear all filters
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Switch id={testId} size="sm" checked={includeTest} onCheckedChange={(checked) => onIncludeTestChange(checked)} />
            <Label htmlFor={testId} className="cursor-pointer text-sm font-normal text-muted-foreground">
              Show test calls
            </Label>
          </div>
          <Select
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onValueChange={(v) => {
              if (!v) return
              const [sortBy, sortOrder] = v.split(':') as [CallFilters['sortBy'], CallFilters['sortOrder']]
              update({ sortBy, sortOrder })
            }}
          >
            <SelectTrigger aria-label="Sort calls" className="h-8 w-40">
              <SelectValue>{(v: string) => SORT_OPTS.find((o) => o.value === v)?.label ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {pills.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Active filters">
          {pills.map((p) => (
            <li key={p.key}>
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-purple-100 py-1 pl-3 pr-1 text-xs font-medium text-purple-700">
                <span className="truncate">{p.label}</span>
                <button
                  type="button"
                  onClick={p.clear}
                  aria-label={`Remove filter ${p.label}`}
                  className="flex size-5 items-center justify-center rounded-full hover:bg-purple-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <X className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        filters={filters}
        includeTest={includeTest}
        total={totalCount ?? 0}
        selectedIds={selectedIds}
      />
    </div>
  )
}
