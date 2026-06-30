'use client'

import { useEffect, useState } from 'react'
import { CallsStatsBar } from './CallsStatsBar'
import { CallsToolbar } from './CallsToolbar'
import { CallsTable } from './CallsTable'
import { useCalls } from '@/hooks/useCalls'
import type { CallStats } from '@/types'

export function CallsPageClient() {
  const {
    calls, total, totalPages, isLoading, filters, page, pageSize,
    setFilters, setPage, setPageSize, deleteCall,
  } = useCalls()

  const [stats, setStats] = useState<CallStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/calls/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setStats(d) })
      .catch(() => {})
      .finally(() => { if (active) setStatsLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calls</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and analyze every call your AI agent handled.
        </p>
      </div>

      <CallsStatsBar stats={stats} isLoading={statsLoading} />

      <CallsToolbar
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={total}
        isLoading={isLoading}
        selectedIds={[]}
      />

      <CallsTable
        calls={calls}
        isLoading={isLoading}
        total={total}
        totalPages={totalPages}
        page={page}
        pageSize={pageSize}
        filters={filters}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onDeleteCall={deleteCall}
      />
    </div>
  )
}
