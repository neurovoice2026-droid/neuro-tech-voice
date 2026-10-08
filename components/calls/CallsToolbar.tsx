'use client'

import { useState, useRef, useCallback, useEffect, useId } from 'react'
import {
  Search, X, SlidersHorizontal, ArrowDownLeft, ArrowUpRight, CircleCheck, CircleX, CircleHelp,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { OrbInline } from '@/components/shared/OrbLoader'
import { DEFAULT_CALL_FILTERS } from '@/hooks/useCalls'
import { cn } from '@/lib/utils'
import { OUTCOME_LABEL, callResultLabel, outcomeLabel, providerLabel, statusLabel, type CallListFilters } from '@/lib/calls/labels'
import { CALL_OUTCOMES } from '@/types'

interface CallsToolbarProps {
  filters: CallListFilters
  onFiltersChange: (filters: CallListFilters) => void
  totalCount: number
  isLoading: boolean
}

type Opt<V> = { value: V; label: string }

// Status options carry a small tone dot in the menu (the label still says it all).
const STATUS_OPTS: Array<Opt<CallListFilters['status']> & { dot?: string }> = [
  { value: 'all',         label: 'All statuses' },
  { value: 'completed',   label: 'Completed',    dot: 'bg-success-dot' },
  { value: 'failed',      label: 'Failed',       dot: 'bg-destructive' },
  { value: 'transferred', label: 'Transferred',  dot: 'bg-info' },
  { value: 'after-hours', label: 'After hours',  dot: 'bg-[#a19dac]' },
  { value: 'busy',        label: 'Busy',         dot: 'bg-warning-dot' },
  { value: 'no-answer',   label: 'No answer',    dot: 'bg-[#a19dac]' },
]

const PROVIDER_OPTS: Array<Opt<CallListFilters['provider']>> = [
  { value: 'all',        label: 'Any provider' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'cartesia',   label: 'Cartesia (backup)' },
]

const DIRECTION_OPTS: Array<Opt<string> & { icon?: LucideIcon }> = [
  { value: 'all',      label: 'All calls' },
  { value: 'inbound',  label: 'Inbound',  icon: ArrowDownLeft },
  { value: 'outbound', label: 'Outbound', icon: ArrowUpRight },
]

// "AI outcome" = calls.call_successful: the AI's verdict on the call's goal (not sentiment).
const AI_OUTCOME_OPTS: Array<Opt<CallListFilters['aiOutcome']> & { icon?: LucideIcon; iconClass?: string }> = [
  { value: 'all',     label: 'Any AI outcome' },
  { value: 'success', label: 'Successful',     icon: CircleCheck, iconClass: 'text-success-dot' },
  { value: 'failure', label: 'Not successful', icon: CircleX,     iconClass: 'text-destructive' },
  { value: 'unknown', label: 'Unclear',        icon: CircleHelp,  iconClass: 'text-muted-foreground' },
]

const OUTCOME_OPTS: Array<Opt<CallListFilters['outcome']>> = [
  { value: 'all', label: 'Any outcome' },
  ...CALL_OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] })),
]

const SORT_OPTS = [
  { value: 'created_at:desc',         label: 'Date (newest)' },
  { value: 'created_at:asc',          label: 'Date (oldest)' },
  { value: 'duration_seconds:desc',   label: 'Duration' },
  { value: 'caller_number:asc',       label: 'Phone number' },
]

/** Width of the "More" panel; it opens towards whichever side has room. */
const PANEL_WIDTH = 272

/** How many filters (search included, sort excluded) narrow the list. */
export function countActiveCallFilters(filters: CallListFilters): number {
  return [
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
}

/** A filter pill around a native date input ("From ▢"), same look as the select pills. */
function DatePill({
  label, ariaLabel, value, min, max, onChange, className,
}: {
  label: string; ariaLabel: string; value: string; min?: string; max?: string
  onChange: (v: string) => void; className?: string
}) {
  return (
    <label
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full bg-white pr-2 pl-3 text-[13px] shadow-pill transition-[background-color] hover:bg-band focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-solid focus-within:outline-ring',
        className
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={cn(
          'h-full bg-transparent text-[13px] tabular-nums outline-none [&::-webkit-calendar-picker-indicator]:opacity-60',
          // Empty: the browser's mm/dd/yyyy placeholder reads muted, like an idle pill.
          value ? 'font-medium text-foreground' : 'text-muted-foreground'
        )}
      />
    </label>
  )
}

export function CallsToolbar({
  filters,
  onFiltersChange,
  totalCount,
  isLoading,
}: CallsToolbarProps) {
  const [searchInput, setSearchInput] = useState(filters.search)
  // Last search value this toolbar pushed, and the last one it saw from the parent:
  // an external change (e.g. a reset) updates the box; our own debounced push does not.
  const [pushedSearch, setPushedSearch] = useState(filters.search)
  const [seenSearch, setSeenSearch] = useState(filters.search)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  // Horizontal offset of the panel from the More button's left edge (kept inside the viewport).
  const [panelOffset, setPanelOffset] = useState(0)
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

  function toggleMoreFilters() {
    if (!showMoreFilters) {
      // Right-aligned to the button, then clamped so the panel keeps a 16 px
      // gutter on both sides of the viewport wherever the pills wrapped it.
      const rect = moreFiltersRef.current?.getBoundingClientRect()
      if (rect) {
        const width = Math.min(PANEL_WIDTH, window.innerWidth - 32)
        const left = Math.max(16, Math.min(rect.right - width, window.innerWidth - 16 - width))
        setPanelOffset(Math.round(left - rect.left))
      }
    }
    setShowMoreFilters(!showMoreFilters)
  }

  const sortValue = `${filters.sortBy}:${filters.sortOrder}`

  function handleSort(val: string | null) {
    if (!val) return
    const [sortBy, sortOrder] = val.split(':') as [CallListFilters['sortBy'], CallListFilters['sortOrder']]
    update({ sortBy, sortOrder })
  }

  // Active filter count (excluding sort/defaults)
  const activeCount = countActiveCallFilters(filters)

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

  /** An active filter pill reads in ink medium; an idle one stays quiet. */
  const pillClass = (active: boolean) => cn('max-w-full', active ? 'font-medium text-foreground' : 'text-foreground/85')

  return (
    <div className="space-y-3">
      {/* Row 1: search · count + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full min-w-0 sm:max-w-[420px] sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by number, summary or what was said…"
            aria-label="Search calls by phone number, summary or transcript"
            maxLength={120}
            className="h-9 rounded-full pr-10 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {searchInput && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={clearSearch}
              aria-label="Clear search"
              className="tap-44 absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X />
            </Button>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
          <span className="flex items-center gap-1.5 text-[13px] whitespace-nowrap text-muted-foreground tabular-nums" aria-live="polite">
            {/* Refetch only: on first load the table body carries the one orb for this wait. */}
            {isLoading && totalCount > 0 && <OrbInline state="breathing" />}
            {isLoading ? (totalCount > 0 ? 'Updating…' : 'Loading…') : `${totalCount.toLocaleString()} calls found`}
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden text-[13px] whitespace-nowrap text-muted-foreground sm:inline">Sort by</span>
            <Select value={sortValue} onValueChange={(v) => v && handleSort(v)}>
              <SelectTrigger size="sm" aria-label="Sort calls">
                <SelectValue>
                  {(value: string) => SORT_OPTS.find((o) => o.value === value)?.label ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                {SORT_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Row 2: filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status */}
        <Select value={filters.status} onValueChange={(v) => v && update({ status: v as CallListFilters['status'] })}>
          <SelectTrigger size="sm" aria-label="Filter by status" className={pillClass(filters.status !== 'all')}>
            <SelectValue placeholder="All statuses">
              {(value: string) => STATUS_OPTS.find((o) => o.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" className="min-w-44">
            {STATUS_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.dot ? <span aria-hidden="true" className={cn('size-1.5 self-center rounded-full', o.dot)} /> : null}
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Provider */}
        <Select value={filters.provider} onValueChange={(v) => v && update({ provider: v as CallListFilters['provider'] })}>
          <SelectTrigger size="sm" aria-label="Filter by voice provider" className={pillClass(filters.provider !== 'all')}>
            <SelectValue placeholder="Any provider">
              {(value: string) => PROVIDER_OPTS.find((o) => o.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" className="min-w-44">
            {PROVIDER_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Direction */}
        <Select value={filters.direction} onValueChange={(v) => v && update({ direction: v as CallListFilters['direction'] })}>
          <SelectTrigger size="sm" aria-label="Filter by direction" className={pillClass(filters.direction !== 'all')}>
            <SelectValue placeholder="All directions">
              {(value: string) => DIRECTION_OPTS.find((o) => o.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" className="min-w-40">
            {DIRECTION_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.icon ? <o.icon aria-hidden="true" className="self-center text-muted-foreground" /> : null}
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Outcome */}
        <Select value={filters.outcome} onValueChange={(v) => v && update({ outcome: v as CallListFilters['outcome'] })}>
          <SelectTrigger size="sm" aria-label="Filter by outcome" className={pillClass(filters.outcome !== 'all')}>
            <SelectValue placeholder="Any outcome">
              {(value: string) => OUTCOME_OPTS.find((o) => o.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" className="min-w-48">
            {OUTCOME_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* AI outcome */}
        <Select value={filters.aiOutcome} onValueChange={(v) => v && update({ aiOutcome: v as CallListFilters['aiOutcome'] })}>
          <SelectTrigger size="sm" aria-label="Filter by AI outcome" className={pillClass(filters.aiOutcome !== 'all')}>
            <SelectValue placeholder="Any AI outcome">
              {(value: string) => AI_OUTCOME_OPTS.find((o) => o.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" className="min-w-48">
            {AI_OUTCOME_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.icon ? <o.icon aria-hidden="true" className={cn('self-center', o.iconClass)} /> : null}
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range (in the "More" panel on phones) */}
        <DatePill
          label="From"
          ariaLabel="From date"
          value={filters.dateFrom}
          max={filters.dateTo || undefined}
          onChange={(v) => update({ dateFrom: v })}
          className="hidden md:inline-flex"
        />
        <DatePill
          label="To"
          ariaLabel="To date"
          value={filters.dateTo}
          min={filters.dateFrom || undefined}
          onChange={(v) => update({ dateTo: v })}
          className="hidden md:inline-flex"
        />

        {/* More Filters */}
        <div className="relative" ref={moreFiltersRef}>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={showMoreFilters}
            aria-controls={panelId}
            onClick={toggleMoreFilters}
          >
            <SlidersHorizontal aria-hidden="true" />
            More
            {filters.minDuration > 0 && (
              <Badge className="h-4 min-w-4 px-1 text-[10px] tabular-nums">1</Badge>
            )}
          </Button>
          {showMoreFilters && (
            <div
              id={panelId}
              role="group"
              aria-label="More filters"
              style={{ width: PANEL_WIDTH, left: panelOffset }}
              className="absolute top-10 z-20 max-w-[calc(100vw-2rem)] space-y-4 rounded-xl bg-popover p-4 text-popover-foreground shadow-pop animate-in fade-in-0 zoom-in-98 duration-200 ease-site"
            >
              <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">More filters</p>
              <div>
                <label htmlFor={`${panelId}-min`} className="mb-2 flex items-center justify-between text-[13px] font-medium">
                  <span>Min duration</span>
                  <span className="text-muted-foreground tabular-nums">{filters.minDuration}s</span>
                </label>
                <input
                  id={`${panelId}-min`}
                  type="range"
                  min={0}
                  max={300}
                  step={10}
                  value={filters.minDuration}
                  onChange={(e) => update({ minDuration: Number(e.target.value) })}
                  className="w-full accent-[#140a24]"
                />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums" aria-hidden="true">
                  <span>0s</span><span>300s</span>
                </div>
              </div>
              <div className="space-y-2 md:hidden">
                <p className="text-[13px] font-medium">Date range</p>
                <DatePill
                  label="From"
                  ariaLabel="From date"
                  value={filters.dateFrom}
                  max={filters.dateTo || undefined}
                  onChange={(v) => update({ dateFrom: v })}
                  className="flex w-full justify-between"
                />
                <DatePill
                  label="To"
                  ariaLabel="To date"
                  value={filters.dateTo}
                  min={filters.dateFrom || undefined}
                  onChange={(v) => update({ dateTo: v })}
                  className="flex w-full justify-between"
                />
              </div>
              <Button variant="secondary" size="sm" className="w-full" onClick={() => setShowMoreFilters(false)}>
                Done
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: active filters */}
      {(pills.length > 0 || activeCount > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {pills.length > 0 && (
            <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
              {pills.map((p) => (
                <li
                  key={p.label}
                  className="inline-flex h-7 items-center gap-0.5 rounded-full bg-secondary pr-0.5 pl-3 text-xs font-medium text-foreground"
                >
                  {p.label}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={p.clear}
                    aria-label={`Remove filter: ${p.label}`}
                    className="tap-44 size-6 text-muted-foreground hover:bg-secondary-hover hover:text-foreground"
                  >
                    <X className="size-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {activeCount > 0 && (
            <Button type="button" variant="ghost" size="xs" onClick={clearAll}>
              Clear all filters
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
