'use client'

import { useEffect, useState } from 'react'
import { PhoneIncoming, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatDuration, formatPhoneNumber } from '@/lib/utils'
import { LiveDot } from '@/components/shared/LiveDot'
import type { Call } from '@/types'

const ICON_MAP: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  'in-progress': <PhoneIncoming className="h-4 w-4 text-purple-500 animate-pulse" />,
}

function timeAgo(date: string | null) {
  if (!date) return '—'
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

interface RealtimeActivityFeedProps {
  calls: Call[]
}

export function RealtimeActivityFeed({ calls }: RealtimeActivityFeedProps) {
  const [, setTick] = useState(0)

  // Re-render every 30s to update "time ago"
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const recent = calls.slice(0, 8)
  const inProgress = recent.filter((c) => c.status === 'in-progress')

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Live Activity</CardTitle>
          {inProgress.length > 0 && (
            <div className="flex items-center gap-1.5">
              <LiveDot />
              <span className="text-xs text-muted-foreground">
                {inProgress.length} active
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1 p-3">
        {recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No recent activity</p>
        ) : (
          recent.map((call) => (
            <div
              key={call.id}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                call.status === 'in-progress' ? 'bg-purple-50' : 'hover:bg-muted/30'
              )}
            >
              {ICON_MAP[call.status] ?? <Clock className="h-4 w-4 text-gray-400" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {call.caller_number ? formatPhoneNumber(call.caller_number) : 'Unknown'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {call.direction === 'inbound' ? '↙ Inbound' : '↗ Outbound'}
                  {' · '}
                  {call.status === 'in-progress'
                    ? 'In progress'
                    : formatDuration(call.duration_seconds)}
                </p>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {timeAgo(call.started_at)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
