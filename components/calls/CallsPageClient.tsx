'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CallsStatsBar } from './CallsStatsBar'
import { CallsToolbar } from './CallsToolbar'
import { CallsTable } from './CallsTable'
import { useCalls, readApiError } from '@/hooks/useCalls'
import type { CallStats } from '@/types'

export function CallsPageClient() {
  const {
    calls, total, totalPages, isLoading, error, filters, page, pageSize,
    setFilters, setPage, setPageSize, deleteCall, refetch,
  } = useCalls()

  const [stats, setStats] = useState<CallStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/calls/stats', { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(await readApiError(r, 'Could not load call statistics.'))
        return (await r.json()) as CallStats
      })
      .then((d) => setStats(d))
      .catch((e: unknown) => {
        // Aborted on unmount: nothing to report.
        if (ctrl.signal.aborted) return
        toast.error(e instanceof Error ? e.message : 'Could not load call statistics.')
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setStatsLoading(false)
      })
    return () => ctrl.abort()
  }, [])

  function handleDeleted(id: string) {
    deleteCall(id)
    setStats((s) => (s ? { ...s, total_calls: Math.max(0, s.total_calls - 1) } : s))
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calls</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review every call your voice agents handled, including backup and after-hours calls.
        </p>
      </div>

      <CallsStatsBar stats={stats} isLoading={statsLoading} />

      <CallsToolbar
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={total}
        isLoading={isLoading}
        selectedIds={selectedIds}
      />

      <CallsTable
        calls={calls}
        isLoading={isLoading}
        error={error}
        total={total}
        totalPages={totalPages}
        page={page}
        pageSize={pageSize}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onDeleteCall={handleDeleted}
        onRetry={refetch}
      />
    </div>
  )
}
