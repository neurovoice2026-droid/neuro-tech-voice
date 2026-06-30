'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Search, X, Download, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ExportDialog } from './ExportDialog'
import type { CallFilters } from '@/types'

interface CallsToolbarProps {
  filters: CallFilters
  onFiltersChange: (filters: CallFilters) => void
  totalCount: number
  isLoading: boolean
  selectedIds: string[]
}

const STATUS_OPTS = [
  { value: 'all',       label: 'All statuses' },
  { value: 'completed', label: '● Completed',  dotColor: 'text-green-500' },
  { value: 'failed',    label: '● Failed',     dotColor: 'text-red-500' },
  { value: 'busy',      label: '● Busy',       dotColor: 'text-amber-500' },
  { value: 'no-answer', label: '● No answer',  dotColor: 'text-gray-400' },
]

const DIRECTION_OPTS = [
  { value: 'all',      label: 'All calls' },
  { value: 'inbound',  label: '↙ Inbound' },
  { value: 'outbound', label: '↗ Outbound' },
]

const SENTIMENT_OPTS = [
  { value: 'all',      label: 'All sentiments' },
  { value: 'positive', label: '😊 Positive' },
  { value: 'neutral',  label: '😐 Neutral' },
  { value: 'negative', label: '😞 Negative' },
]

const SORT_OPTS = [
  { value: 'created_at:desc',         label: 'Date (newest)' },
  { value: 'created_at:asc',          label: 'Date (oldest)' },
  { value: 'duration_seconds:desc',   label: 'Duration' },
  { value: 'caller_number:asc',       label: 'Phone number' },
]

export function CallsToolbar({
  filters,
  onFiltersChange,
  totalCount,
  isLoading,
  selectedIds,
}: CallsToolbarProps) {
  const [searchInput, setSearchInput] = useState(filters.search)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const moreFiltersRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync search input with external filter changes
  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  const update = useCallback(
    (partial: Partial<CallFilters>) => {
      onFiltersChange({ ...filters, ...partial })
    },
    [filters, onFiltersChange]
  )

  function handleSearch(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      update({ search: value })
    }, 300)
  }

  function clearSearch() {
    setSearchInput('')
    update({ search: '' })
  }

  const sortValue = `${filters.sortBy}:${filters.sortOrder}`

  function handleSort(val: string | null) {
    if (!val) return
    const [sortBy, sortOrder] = val.split(':') as [CallFilters['sortBy'], CallFilters['sortOrder']]
    update({ sortBy, sortOrder })
  }

  // Active filter count (excluding sort/defaults)
  const activeCount = [
    filters.search,
    filters.status !== 'all',
    filters.direction !== 'all',
    filters.sentiment !== 'all',
    filters.dateFrom,
    filters.dateTo,
    filters.minDuration > 0,
  ].filter(Boolean).length

  function clearAll() {
    setSearchInput('')
    onFiltersChange({
      search: '', status: 'all', direction: 'all', sentiment: 'all',
      dateFrom: '', dateTo: '', minDuration: 0,
      sortBy: 'created_at', sortOrder: 'desc',
    })
  }

  // Active pills
  const pills: Array<{ label: string; clear: () => void }> = []
  if (filters.status !== 'all')    pills.push({ label: filters.status, clear: () => update({ status: 'all' }) })
  if (filters.direction !== 'all') pills.push({ label: filters.direction, clear: () => update({ direction: 'all' }) })
  if (filters.sentiment !== 'all') pills.push({ label: filters.sentiment, clear: () => update({ sentiment: 'all' }) })
  if (filters.dateFrom)            pills.push({ label: `From ${filters.dateFrom}`, clear: () => update({ dateFrom: '' }) })
  if (filters.dateTo)              pills.push({ label: `To ${filters.dateTo}`, clear: () => update({ dateTo: '' }) })
  if (filters.minDuration > 0)     pills.push({ label: `Min ${filters.minDuration}s`, clear: () => update({ minDuration: 0 }) })

  return (
    <div className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
      {/* Row 1 */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by phone number..."
            className="pl-9 pr-8 h-9"
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status */}
        <Select value={filters.status} onValueChange={(v) => v && update({ status: v as CallFilters['status'] })}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Direction */}
        <Select value={filters.direction} onValueChange={(v) => v && update({ direction: v as CallFilters['direction'] })}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="All directions" />
          </SelectTrigger>
          <SelectContent>
            {DIRECTION_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sentiment */}
        <Select value={filters.sentiment} onValueChange={(v) => v && update({ sentiment: v as CallFilters['sentiment'] })}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="All sentiments" />
          </SelectTrigger>
          <SelectContent>
            {SENTIMENT_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => update({ dateFrom: e.target.value })}
          className="hidden md:block h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => update({ dateTo: e.target.value })}
          className="hidden md:block h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />

        {/* More Filters */}
        <div className="relative" ref={moreFiltersRef}>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
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
            <div className="absolute top-10 right-0 z-20 w-64 rounded-xl border bg-card shadow-lg p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">More filters</p>
              <div>
                <label className="text-sm font-medium block mb-2">
                  Min duration: {filters.minDuration}s
                </label>
                <input
                  type="range"
                  min={0}
                  max={300}
                  step={10}
                  value={filters.minDuration}
                  onChange={(e) => update({ minDuration: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0s</span><span>300s</span>
                </div>
              </div>
              <div className="md:hidden space-y-2">
                <p className="text-xs font-medium">Date range</p>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => update({ dateFrom: e.target.value })}
                  className="w-full h-8 rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => update({ dateTo: e.target.value })}
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
          Export CSV
        </Button>
      </div>

      {/* Row 2 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${totalCount.toLocaleString()} calls found`}
          </span>
          {activeCount > 0 && (
            <button onClick={clearAll} className="text-sm text-primary hover:underline">
              Clear all filters
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">Sort by:</span>
          <Select value={sortValue} onValueChange={(v) => v && handleSort(v)}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
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
        <div className="flex flex-wrap gap-2">
          {pills.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-700 px-3 py-1 text-xs font-medium"
            >
              {p.label}
              <button onClick={p.clear} className="ml-0.5 hover:text-purple-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
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
