'use client'

import { useState, useRef, useCallback, useEffect, useId } from 'react'
import { Search, X, Download, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ExportDialog } from './ExportDialog'
import { DEFAULT_CALL_FILTERS } from '@/hooks/useCalls'
import { OUTCOME_LABEL, callResultLabel, outcomeLabel, providerLabel, statusLabel, type CallListFilters } from '@/lib/calls/labels'
import { CALL_OUTCOMES } from '@/types'

interface CallsToolbarProps {
  filters: CallListFilters
  onFiltersChange: (filters: CallListFilters) => void
  totalCount: number
  isLoading: boolean
  selectedIds: string[]
}

const STATUS_OPTS: Array<{ value: CallListFilters['status']; label: string }> = [
  { value: 'all',         label: 'All statuses' },
  { value: 'completed',   label: '● Completed' },
  { value: 'failed',      label: '● Failed' },
  { value: 'transferred', label: '● Transferred' },
  { value: 'after-hours', label: '● After hours' },
  { value: 'busy',        label: '● Busy' },
  { value: 'no-answer',   label: '● No answer' },
]

const PROVIDER_OPTS: Array<{ value: CallListFilters['provider']; label: string }> = [
  { value: 'all',        label: 'Any provider' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'cartesia',   label: 'Cartesia (backup)' },
]

const DIRECTION_OPTS = [
  { value: 'all',      label: 'All calls' },
  { value: 'inbound',  label: '↙ Inbound' },
  { value: 'outbound', label: '↗ Outbound' },
]

// "AI outcome" = calls.call_successful: the AI's verdict on the call's goal (not sentiment).
const AI_OUTCOME_OPTS: Array<{ value: CallListFilters['aiOutcome']; label: string }> = [
  { value: 'all',     label: 'Any AI outcome' },
  { value: 'success', label: '✓ Successful' },
  { value: 'failure', label: '✕ Not successful' },
  { value: 'unknown', label: '? Unclear' },
]

const OUTCOME_OPTS: Array<{ value: CallListFilters['outcome']; label: string }> = [
  { value: 'all', label: 'Any outcome' },
  ...CALL_OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] })),
]

const SORT_OPTS = [
  { value: 'created_at:desc',         label: 'Date (newest)' },
  { value: 'created_at:asc',          label: 'Date (oldest)' },
  { value: 'duration_seconds:desc',   label: 'Duration' },
  { value: 'caller_number:asc',       label: 'Phone number' },
]

const DATE_INPUT_CLASS =
  'h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30'

export function CallsToolbar({
  filters,
  onFiltersChange,
  totalCount,
  isLoading,
  selectedIds,
}: CallsToolbarProps) {
  const [searchInput, setSearchInput] = useState(filters.search)
  // Last search value this toolbar pushed, and the last one it saw from the parent:
  // an external change (e.g. a reset) updates the box; our own debounced push does not.
  const [pushedSearch, setPushedSearch] = useState(filters.search)
  const [seenSearch, setSeenSearch] = useState(filters.search)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const moreFiltersRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelId = useId()

  if (filters.search !== seenSearch) {
    setSeenSearch(filters.search)
    if (filters.search !== pushedSearch) setSearchInput(filters.search)
  }

  // Latest filters/callback for the debounced search push, so a filter changed
  // while typing is not reverted by a stale closure.
  const latestRef = useRef({ filters, onFiltersChange })
  useEffect(() => {
    latestRef.current = { filters, onFiltersChange }
  }, [filters, onFiltersChange])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  // Close the "More" panel on outside click or Escape.
  useEffect(() => {
    if (!showMoreFilters) return
    function onPointerDown(e: PointerEvent) {
      if (moreFiltersRef.current && !moreFiltersRef.current.contains(e.target as Node)) setShowMoreFilters(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowMoreFilters(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showMoreFilters])

  const update = useCallback(
    (partial: Partial<CallListFilters>) => {
      onFiltersChange({ ...filters, ...partial })
    },
    [filters, onFiltersChange]
  )

  function handleSearch(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPushedSearch(value)
      const latest = latestRef.current
      latest.onFiltersChange({ ...latest.filters, search: value })
    }, 300)
  }

  function clearSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearchInput('')
    setPushedSearch('')
    update({ search: '' })
  }

  const sortValue = `${filters.sortBy}:${filters.sortOrder}`

  function handleSort(val: string | null) {
    if (!val) return
    const [sortBy, sortOrder] = val.split(':') as [CallListFilters['sortBy'], CallListFilters['sortOrder']]
    update({ sortBy, sortOrder })
  }

  // Active filter count (excluding sort/defaults)
  const activeCount = [
    filters.search,
    filters.status !== 'all',
    filters.provider !== 'all',
    filters.direction !== 'all',
    filters.sentiment !== 'all',
    filters.outcome !== 'all',
    filters.aiOutcome !== 'all',
    filters.dateFrom,
    filters.dateTo,
    filters.minDuration > 0,
  ].filter(Boolean).length

  function clearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearchInput('')
    setPushedSearch('')
    onFiltersChange({ ...DEFAULT_CALL_FILTERS })
  }

  // Active pills
  const pills: Array<{ label: string; clear: () => void }> = []
  if (filters.status !== 'all')    pills.push({ label: statusLabel(filters.status), clear: () => update({ status: 'all' }) })
  if (filters.provider !== 'all')  pills.push({ label: providerLabel(filters.provider) ?? filters.provider, clear: () => update({ provider: 'all' }) })
  if (filters.direction !== 'all') pills.push({ label: filters.direction === 'inbound' ? 'Inbound' : 'Outbound', clear: () => update({ direction: 'all' }) })
  if (filters.sentiment !== 'all') pills.push({ label: `${filters.sentiment.charAt(0).toUpperCase()}${filters.sentiment.slice(1)} sentiment`, clear: () => update({ sentiment: 'all' }) })
  if (filters.outcome !== 'all')   pills.push({ label: outcomeLabel(filters.outcome) ?? filters.outcome, clear: () => update({ outcome: 'all' }) })
  if (filters.aiOutcome !== 'all') pills.push({ label: `AI outcome: ${callResultLabel(filters.aiOutcome) ?? filters.aiOutcome}`, clear: () => update({ aiOutcome: 'all' }) })
  if (filters.dateFrom)            pills.push({ label: `From ${filters.dateFrom}`, clear: () => update({ dateFrom: '' }) })
  if (filters.dateTo)              pills.push({ label: `To ${filters.dateTo}`, clear: () => update({ dateTo: '' }) })
  if (filters.minDuration > 0)     pills.push({ label: `Min ${filters.minDuration}s`, clear: () => update({ minDuration: 0 }) })

  return (
    <div className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
      {/* Row 1 */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by number, summary or what was said…"
            aria-label="Search calls by phone number, summary or transcript"
            maxLength={120}
            className="pl-9 pr-8 h-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status */}
        <Select value={filters.status} onValueChange={(v) => v && update({ status: v as CallListFilters['status'] })}>
          <SelectTrigger className="h-9 w-36" aria-label="Filter by status">
            <SelectValue placeholder="All statuses">
              {(value: string) => STATUS_OPTS.find((o) => o.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Provider */}
        <Select value={filters.provider} onValueChange={(v) => v && update({ provider: v as CallListFilters['provider'] })}>
          <SelectTrigger className="h-9 w-40" aria-label="Filter by voice provider">
            <SelectValue placeholder="Any provider">
              {(value: string) => PROVIDER_OPTS.find((o) => o.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Direction */}
        <Select value={filters.direction} onValueChange={(v) => v && update({ direction: v as CallListFilters['direction'] })}>
          <SelectTrigger className="h-9 w-36" aria-label="Filter by direction">
            <SelectValue placeholder="All directions">
              {(value: string) => DIRECTION_OPTS.find((o) => o.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {DIRECTION_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Outcome */}
        <Select value={filters.outcome} onValueChange={(v) => v && update({ outcome: v as CallListFilters['outcome'] })}>
          <SelectTrigger className="h-9 w-44" aria-label="Filter by outcome">
            <SelectValue placeholder="Any outcome">
              {(value: string) => OUTCOME_OPTS.find((o) => o.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {OUTCOME_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* AI outcome */}
        <Select value={filters.aiOutcome} onValueChange={(v) => v && update({ aiOutcome: v as CallListFilters['aiOutcome'] })}>
          <SelectTrigger className="h-9 w-40" aria-label="Filter by AI outcome">
            <SelectValue placeholder="Any AI outcome">
              {(value: string) => AI_OUTCOME_OPTS.find((o) => o.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {AI_OUTCOME_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <input
          type="date"
          value={filters.dateFrom}
          max={filters.dateTo || undefined}
          onChange={(e) => update({ dateFrom: e.target.value })}
          aria-label="From date"
          className={`hidden md:block ${DATE_INPUT_CLASS}`}
        />
        <input
          type="date"
          value={filters.dateTo}
          min={filters.dateFrom || undefined}
          onChange={(e) => update({ dateTo: e.target.value })}
          aria-label="To date"
          className={`hidden md:block ${DATE_INPUT_CLASS}`}
        />

        {/* More Filters */}
        <div className="relative" ref={moreFiltersRef}>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            aria-expanded={showMoreFilters}
            aria-controls={panelId}
            onClick={() => setShowMoreFilters(!showMoreFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            More
            {filters.minDuration > 0 && (
              <Badge className="ml-1 h-4 w-4 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground">
                1
              </Badge>
            )}
          </Button>
          {showMoreFilters && (
            <div
              id={panelId}
              role="group"
              aria-label="More filters"
              className="absolute top-10 right-0 z-20 w-64 rounded-xl border bg-card shadow-lg p-4 space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">More filters</p>
              <div>
                <label htmlFor={`${panelId}-min`} className="text-sm font-medium block mb-2">
                  Min duration: {filters.minDuration}s
                </label>
                <input
                  id={`${panelId}-min`}
                  type="range"
                  min={0}
                  max={300}
                  step={10}
                  value={filters.minDuration}
                  onChange={(e) => update({ minDuration: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1" aria-hidden="true">
                  <span>0s</span><span>300s</span>
                </div>
              </div>
              <div className="md:hidden space-y-2">
                <p className="text-xs font-medium">Date range</p>
                <input
                  type="date"
                  value={filters.dateFrom}
                  max={filters.dateTo || undefined}
                  onChange={(e) => update({ dateFrom: e.target.value })}
                  aria-label="From date"
                  className="w-full h-8 rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  min={filters.dateFrom || undefined}
                  onChange={(e) => update({ dateTo: e.target.value })}
                  aria-label="To date"
                  className="w-full h-8 rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
                />
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setShowMoreFilters(false)}>
                Done
              </Button>
            </div>
          )}
        </div>

        {/* Export */}
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Row 2 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {isLoading ? 'Loading…' : `${totalCount.toLocaleString()} calls found`}
          </span>
          {activeCount > 0 && (
            <button type="button" onClick={clearAll} className="text-sm text-primary hover:underline">
              Clear all filters
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">Sort by:</span>
          <Select value={sortValue} onValueChange={(v) => v && handleSort(v)}>
            <SelectTrigger className="h-8 w-40" aria-label="Sort calls">
              <SelectValue>
                {(value: string) => SORT_OPTS.find((o) => o.value === value)?.label ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active pills */}
      {pills.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Active filters">
          {pills.map((p) => (
            <li
              key={p.label}
              className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-700 px-3 py-1 text-xs font-medium"
            >
              {p.label}
              <button
                type="button"
                onClick={p.clear}
                aria-label={`Remove filter: ${p.label}`}
                className="ml-0.5 rounded-full hover:text-purple-900 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        filters={filters}
        total={totalCount}
        selectedIds={selectedIds}
      />
    </div>
  )
}
