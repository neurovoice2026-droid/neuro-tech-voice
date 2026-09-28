'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PhoneIncoming, PhoneMissed, PhoneOutgoing } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LiveDot } from '@/components/shared/LiveDot'
import { cn, formatDuration, formatPhoneNumber } from '@/lib/utils'
import { OutcomeChip, callerLabel } from '@/components/calls/call-display'
import type { CallListItem } from '@/hooks/useCalls'

function timeAgo(date: string | null, now: number): string {
  if (!date) return ''
  const diff = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000))
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86_400)}d ago`
}

interface RealtimeActivityFeedProps {
  calls: CallListItem[]
  isLoading: boolean
  error: string | null
}

export function RealtimeActivityFeed({ calls, isLoading, error }: RealtimeActivityFeedProps) {
  const [now, setNow] = useState(() => Date.now())

  // Keeps "5m ago" honest without refetching anything.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const recent = calls.slice(0, 8)
  const live = calls.filter((c) => c.status === 'in-progress').length

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Live activity</CardTitle>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            <LiveDot active={live > 0} />
            {live > 0 ? `${live} on a call now` : 'Watching for calls'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {isLoading && calls.length === 0 ? (
          <div className="space-y-2" aria-busy="true">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : error && calls.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{error}</p>
        ) : recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nothing yet. New calls show up here the moment they start.
          </p>
        ) : (
          <ul className="space-y-1">
            {recent.map((call) => {
              const number = callerLabel(call)
              const inProgress = call.status === 'in-progress'
              const missed = call.outcome === 'missed' || call.status === 'no-answer' || call.status === 'busy'
              const Icon = missed ? PhoneMissed : call.direction === 'outbound' ? PhoneOutgoing : PhoneIncoming
              return (
                <li key={call.id}>
                  <Link
                    href={`/calls?call=${call.id}`}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:px-3',
                      inProgress ? 'bg-purple-50' : 'hover:bg-muted/40'
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn('size-4 shrink-0', inProgress ? 'animate-pulse text-purple-500' : missed ? 'text-rose-500' : 'text-muted-foreground')}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{number ? formatPhoneNumber(number) : 'Unknown caller'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {inProgress ? 'On the call now' : call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : 'No conversation'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {!inProgress && <OutcomeChip outcome={call.outcome} />}
                      <span className="text-[11px] text-muted-foreground">{timeAgo(call.started_at, now)}</span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
