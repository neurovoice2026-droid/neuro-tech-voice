'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { activeFilterCount, DEFAULT_CALL_FILTERS, useCalls } from '@/hooks/useCalls'
import { CallsStatsBar } from './CallsStatsBar'
import { CallsTable } from './CallsTable'
import { CallsToolbar } from './CallsToolbar'
import { OutboundCallDialog } from './OutboundCallDialog'
import type { OutboundCallSetup } from './outbound-call'
import type { CallStats } from '@/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type StatsResult = { stats: CallStats; error: null } | { stats: null; error: string }

export function CallsPageClient({ outbound }: { outbound?: OutboundCallSetup }) {
  const {
    calls, total, totalPages, isLoading, isInitialLoading, error, filters, page, pageSize, includeTest,
    setFilters, setPage, setPageSize, setIncludeTest, removeCall, refetch,
  } = useCalls()

  const linkedCall = useSearchParams().get('call')
  const [initialCallId] = useState(() => (linkedCall && UUID_RE.test(linkedCall) ? linkedCall : null))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statsVersion, setStatsVersion] = useState(0)
  const [statsResult, setStatsResult] = useState<StatsResult | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/calls/stats', { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
          throw new Error(body?.error?.message ?? 'Call totals aren’t available right now.')
        }
        return (await res.json()) as CallStats
      })
      .then((stats) => setStatsResult({ stats, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setStatsResult({ stats: null, error: err instanceof Error ? err.message : 'Call totals aren’t available right now.' })
      })
    return () => controller.abort()
  }, [statsVersion])

  const handleDeleted = useCallback(
    (id: string) => {
      removeCall(id)
      setStatsVersion((v) => v + 1)
    },
    [removeCall]
  )

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Calls</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every call your agent handled, with what was said and what came of it.
          </p>
        </div>
        {outbound && (
          <OutboundCallDialog
            setup={outbound}
            onPlaced={() => {
              refetch()
              setStatsVersion((v) => v + 1)
            }}
          />
        )}
      </div>

      <CallsStatsBar stats={statsResult?.stats ?? null} isLoading={statsResult === null} error={statsResult?.error ?? null} />

      <CallsToolbar
        filters={filters}
        onFiltersChange={setFilters}
        includeTest={includeTest}
        onIncludeTestChange={setIncludeTest}
        totalCount={error ? null : total}
        isLoading={isLoading}
        selectedIds={Array.from(selectedIds)}
      />

      <CallsTable
        calls={calls}
        isInitialLoading={isInitialLoading}
        isRefreshing={isLoading}
        error={error}
        hasActiveFilters={activeFilterCount(filters) > 0}
        total={total}
        totalPages={totalPages}
        page={page}
        pageSize={pageSize}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onDeleteCall={handleDeleted}
        onClearFilters={() => setFilters({ ...DEFAULT_CALL_FILTERS, sortBy: filters.sortBy, sortOrder: filters.sortOrder })}
        onRetry={refetch}
        initialOpenCallId={initialCallId}
      />
    </div>
  )
}

/** Suspense fallback for the calls page: same layout, no content shift when data arrives. */
export function CallsPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4 sm:space-y-6 sm:p-6" aria-busy="true" aria-label="Loading calls">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg sm:w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[138px] rounded-xl sm:h-[150px]" />
        ))}
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm sm:p-4">
        <Skeleton className="h-9 w-full" />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full sm:w-40" />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}
