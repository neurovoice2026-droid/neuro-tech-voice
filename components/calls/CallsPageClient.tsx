'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { CallsStatsBar } from './CallsStatsBar'
import { CallsToolbar, countActiveCallFilters } from './CallsToolbar'
import { CallsTable } from './CallsTable'
import { ExportDialog } from './ExportDialog'
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
  const [exportOpen, setExportOpen] = useState(false)

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
    <PageContainer>
      <PageHeader
        eyebrow="Calls"
        title="Calls"
        description="Review every call your voice agents handled, including backup and after-hours calls."
        actions={
          <Button variant="outline" onClick={() => setExportOpen(true)}>
            <Download aria-hidden="true" />
            Export
          </Button>
        }
      />

      <div className="space-y-6">
        <CallsStatsBar stats={stats} isLoading={statsLoading} />

        <div className="space-y-4">
          <CallsToolbar
            filters={filters}
            onFiltersChange={setFilters}
            totalCount={total}
            isLoading={isLoading}
          />

          <CallsTable
            calls={calls}
            isLoading={isLoading}
            error={error}
            filtered={countActiveCallFilters(filters) > 0}
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
      </div>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        filters={filters}
        total={total}
        selectedIds={selectedIds}
      />
    </PageContainer>
  )
}
