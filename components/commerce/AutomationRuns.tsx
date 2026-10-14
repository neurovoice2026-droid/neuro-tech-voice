'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCommerceRuns } from '@/hooks/useCommerceRuns'
import type { AutomationDto } from '@/lib/commerce/types'
import { RUN_STATUSES, RUN_STATUS_LABEL } from './labels'
import { filterPillClass } from './ListScaffold'
import { RunsTable } from './RunsTable'

const STATUS_OPTIONS = [{ value: 'all', label: 'Toate stările' }, ...RUN_STATUSES.map((s) => ({ value: s, label: RUN_STATUS_LABEL[s] }))]

/** The run history of one configured automation: status filter, cursor pages, cancel on waiting runs. */
export function AutomationRuns({ automation }: { automation: AutomationDto }) {
  const [status, setStatus] = useState('all')
  const runs = useCommerceRuns(
    automation.id ? { automation_id: automation.id, status: status === 'all' ? undefined : status } : null,
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading font-title text-[20px] leading-[26px] tracking-[-0.01em]">Istoricul apelurilor</h3>
        <Select value={status} onValueChange={(v) => v && setStatus(String(v))}>
          <SelectTrigger size="sm" aria-label="Filtrează apelurile după stare" className={filterPillClass(status !== 'all')}>
            <SelectValue>{(value: string) => STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="end" className="min-w-44">
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <RunsTable
        runs={runs.items}
        isLoading={runs.isLoading}
        error={runs.error}
        onRetry={runs.refetch}
        onRunChanged={(run) => runs.replaceItem(run.id, run)}
        showAutomation={false}
        cancellable
        filtered={status !== 'all'}
        emptyTitle="Niciun apel încă"
        emptyDescription="Apelurile apar aici după ce automatizarea este activă și găsește comenzi eligibile."
        pagination={{
          total: runs.total,
          hasMore: runs.hasMore,
          isLoadingMore: runs.isLoadingMore,
          loadMoreError: runs.loadMoreError,
          onLoadMore: runs.loadMore,
        }}
      />
    </div>
  )
}
