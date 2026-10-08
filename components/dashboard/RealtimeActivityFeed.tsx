'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Card, CardAction, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatDate, formatDuration, formatPhoneNumber } from '@/lib/utils'
import { LiveDot } from '@/components/shared/LiveDot'
import { OrbLoader } from '@/components/shared/OrbLoader'
import type { Call } from '@/types'
import { CardError } from './CardError'
import { relativeTime } from './relative-time'

/** Leading status mark of a row, with its name for screen readers (never colour alone). */
function StatusMark({ status }: { status: string }) {
  const inProgress = status === 'in-progress'
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary">
      {inProgress ? (
        <LiveDot />
      ) : status === 'completed' ? (
        <CheckCircle2 className="size-4 text-success-dot" aria-hidden="true" />
      ) : status === 'failed' ? (
        <XCircle className="size-4 text-destructive" aria-hidden="true" />
      ) : (
        <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="sr-only">
        {inProgress ? 'In progress' : status === 'completed' ? 'Completed' : status === 'failed' ? 'Failed' : status}
      </span>
    </span>
  )
}

const ROWS_SHOWN = 8

interface RealtimeActivityFeedProps {
  calls: Call[]
  /** True until the first recent-calls response. */
  isLoading?: boolean
  /** Last failed request, if any (rows already shown are kept on a failed refresh). */
  error?: string | null
  onRetry?: () => void
}

export function RealtimeActivityFeed({ calls, isLoading = false, error = null, onRetry }: RealtimeActivityFeedProps) {
  const [, setTick] = useState(0)

  // Re-render every 30s to update "time ago"
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const recent = calls.slice(0, ROWS_SHOWN)
  const inProgress = recent.filter((c) => c.status === 'in-progress')

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Live activity</CardTitle>
        {/* Always rendered (empty when nothing is live) so the header keeps its height. */}
        <CardAction className="flex items-center gap-2 self-center text-xs text-muted-foreground">
          {inProgress.length > 0 && (
            <>
              {/* Static here: the in-progress row below carries the pinging dot. */}
              <LiveDot active={false} tone="success" />
              <span className="tabular-nums">{inProgress.length} active</span>
            </>
          )}
        </CardAction>
      </CardHeader>
      {isLoading ? (
        // Reserves the 8 rows it replaces (56 px each + hairlines).
        <OrbLoader label="Loading activity…" className="min-h-[456px] border-t border-rule" />
      ) : error && recent.length === 0 ? (
        <CardError message="Activity could not be loaded." onRetry={onRetry} className="border-t border-rule" />
      ) : recent.length === 0 ? (
        <p className="border-t border-rule px-5 py-6 text-center text-[13px] text-muted-foreground">No recent activity</p>
      ) : (
        <ul className="border-t border-rule">
          {recent.map((call) => (
            <li
              key={call.id}
              className={cn(
                'flex min-h-14 items-center gap-3 border-b border-rule px-5 py-2.5 transition-colors last:border-b-0',
                call.status === 'in-progress' ? 'bg-band' : 'hover:bg-band'
              )}
            >
              <StatusMark status={call.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground tabular-nums">
                  {call.caller_number ? formatPhoneNumber(call.caller_number) : 'Unknown'}
                </p>
                <p className="text-xs leading-4 text-muted-foreground tabular-nums">
                  {call.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                  {' · '}
                  {call.status === 'in-progress'
                    ? 'In progress'
                    : formatDuration(call.duration_seconds)}
                </p>
              </div>
              {call.started_at ? (
                <time
                  dateTime={call.started_at}
                  title={formatDate(call.started_at)}
                  className="shrink-0 text-xs text-muted-foreground tabular-nums"
                >
                  {relativeTime(call.started_at)}
                </time>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">—</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
