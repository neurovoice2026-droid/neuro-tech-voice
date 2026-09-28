'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, History, Loader2, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { maskPhone } from '@/lib/phone/e164'
import type { WorkflowRun, WorkflowSummary } from '@/lib/workflows/types'
import { cn } from '@/lib/utils'
import { ActionResultList } from './ActionResultList'
import { readApiError } from './api'
import { formatRelative } from './meta'

/** A run still "running" after this long was cut off (for example the server restarted). */
const STALE_RUN_MS = 10 * 60 * 1000

function runStatus(run: WorkflowRun, now: number): { label: string; className: string } {
  if (run.status === 'completed') return { label: 'Succeeded', className: 'border-green-200 bg-green-50 text-green-700' }
  if (run.status === 'failed') return { label: 'Failed', className: 'border-red-200 bg-red-50 text-red-700' }
  if (now - new Date(run.started_at).getTime() > STALE_RUN_MS) {
    return { label: 'Didn’t finish', className: 'border-amber-200 bg-amber-50 text-amber-700' }
  }
  return { label: 'Running', className: 'border-blue-200 bg-blue-50 text-blue-700' }
}

function runDuration(run: WorkflowRun): string | null {
  if (!run.completed_at) return null
  const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return ms < 1000 ? 'under a second' : `${Math.round(ms / 1000)} s`
}

function caller(run: WorkflowRun): string | null {
  const number = run.call?.from_number ?? run.call?.caller_number
  return number ? maskPhone(number) : null
}

interface RunHistorySheetProps {
  workflow: WorkflowSummary | null
  onClose: () => void
}

export function RunHistorySheet({ workflow, onClose }: RunHistorySheetProps) {
  return (
    <Sheet open={workflow !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {workflow ? <RunHistoryBody key={workflow.id} workflow={workflow} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function RunHistoryBody({ workflow }: { workflow: WorkflowSummary }) {
  const [runs, setRuns] = useState<WorkflowRun[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [openRun, setOpenRun] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/runs`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readApiError(res, 'We couldn’t load the run history.'))
      const data = (await res.json()) as { runs: WorkflowRun[] }
      setRuns(data.runs)
      setError(null)
      setNow(Date.now())
      setOpenRun((current) => current ?? data.runs[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t load the run history.')
    } finally {
      setRefreshing(false)
    }
  }, [workflow.id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle>Run history</SheetTitle>
        <SheetDescription className="truncate">{workflow.name} · last 50 runs</SheetDescription>
      </SheetHeader>

      <div className="flex items-center justify-between px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {workflow.runs} {workflow.runs === 1 ? 'run' : 'runs'} in total, {workflow.successful_runs} succeeded
        </p>
        <Button type="button" size="xs" variant="ghost" onClick={() => void load()} disabled={refreshing}>
          {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {runs === null && !error ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading run history">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : error && runs === null ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
          </div>
        ) : runs && runs.length === 0 ? (
          <EmptyState
            icon={History}
            title="No runs yet"
            description="Each time a matching call ends, the run and what every step did will show up here."
          />
        ) : (
          <ul className="space-y-2">
            {error ? <li className="text-[11px] text-destructive">{error}</li> : null}
            {(runs ?? []).map((run) => {
              const status = runStatus(run, now)
              const expanded = openRun === run.id
              const who = caller(run)
              const took = runDuration(run)
              return (
                <li key={run.id} className="rounded-xl border bg-card">
                  <button
                    type="button"
                    onClick={() => setOpenRun(expanded ? null : run.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Badge variant="outline" className={cn('shrink-0', status.className)}>{status.label}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-foreground">
                        {formatRelative(run.started_at) ?? 'Unknown time'}
                        {who ? ` · ${who}` : ''}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {new Date(run.started_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                        {took ? ` · took ${took}` : ''}
                      </span>
                    </span>
                    <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
                  </button>
                  {expanded ? (
                    <div className="border-t px-3 py-3">
                      <ActionResultList results={run.results} />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
