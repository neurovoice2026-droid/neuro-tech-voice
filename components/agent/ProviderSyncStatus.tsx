'use client'

import { CheckCircle2, CircleDashed, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { describeSyncHealth } from '@/components/agent/agent-health'
import type { ProviderSyncState } from '@/types'

interface ProviderSyncChipProps {
  providerSync: ProviderSyncState | null | undefined
  /** A save or manual sync is still being followed by the dashboard. */
  busy?: boolean
  className?: string
}

/** "Live on Cartesia" / "Syncing…" / "Needs attention" pill for the agent header. */
export function ProviderSyncChip({ providerSync, busy = false, className }: ProviderSyncChipProps) {
  const health = describeSyncHealth(providerSync)
  const state = busy && health.state !== 'attention' ? 'syncing' : health.state
  const label = state === 'syncing' ? 'Syncing…' : health.label
  const Icon =
    state === 'live' ? CheckCircle2 : state === 'syncing' ? Loader2 : state === 'attention' || state === 'unavailable' ? TriangleAlert : CircleDashed

  return (
    <span
      role="status"
      title={health.detail}
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap',
        state === 'live' && 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400',
        state === 'syncing' && 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
        (state === 'attention' || state === 'unavailable') &&
          'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
        state === 'unsynced' && 'border-border bg-muted text-muted-foreground',
        className
      )}
    >
      <Icon className={cn('size-3', state === 'syncing' && 'animate-spin')} aria-hidden="true" />
      {label}
    </span>
  )
}

interface ProviderSyncNoticeProps {
  providerSync: ProviderSyncState | null | undefined
  onRetry: () => void
  retrying: boolean
}

/** Explains a failed or missing provider sync and offers a retry. Renders nothing when all is well. */
export function ProviderSyncNotice({ providerSync, onRetry, retrying }: ProviderSyncNoticeProps) {
  const health = describeSyncHealth(providerSync)
  if (health.state !== 'attention' && health.state !== 'unsynced' && health.state !== 'unavailable') return null
  const attention = health.state === 'attention' || health.state === 'unavailable'
  const canRetry = health.state !== 'unavailable'

  return (
    <div
      role={attention ? 'alert' : 'status'}
      className={cn(
        'flex flex-col gap-3 rounded-lg border px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between',
        attention
          ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
          : 'bg-muted/50 text-muted-foreground'
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {attention ? (
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        ) : (
          <CircleDashed className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p>{health.detail}</p>
          {health.errors.length > 1 && (
            <p className="mt-0.5 text-xs opacity-80">
              Also: we couldn’t update {health.errors[1].name}: {health.errors[1].message}
            </p>
          )}
        </div>
      </div>
      {canRetry && (
        <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={retrying} className="self-start sm:self-auto">
          {retrying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          {retrying ? 'Updating…' : attention ? 'Retry' : 'Sync now'}
        </Button>
      )}
    </div>
  )
}
