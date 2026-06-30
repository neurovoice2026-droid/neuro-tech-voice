'use client'

import { PhoneIncoming, PhoneOutgoing, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn, formatDuration, formatPhoneNumber } from '@/lib/utils'
import type { Call } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  busy: 'bg-amber-50 text-amber-700 border-amber-200',
  'no-answer': 'bg-gray-100 text-gray-600 border-gray-200',
  'in-progress': 'bg-purple-50 text-purple-700 border-purple-200',
}

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'text-green-600',
  neutral: 'text-gray-400',
  negative: 'text-red-500',
}

const SENTIMENT_EMOJI: Record<string, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😞',
}

interface RecentCallsTableProps {
  calls: Call[]
  isLoading: boolean
}

export function RecentCallsTable({ calls, isLoading }: RecentCallsTableProps) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Calls</CardTitle>
          <a href="/calls" className="text-xs text-primary hover:underline">View all</a>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : calls.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No calls yet"
            description="Calls will appear here once your agent starts receiving them."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Caller</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Direction</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Duration</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Sentiment</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Time</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium">
                        {call.caller_number ? formatPhoneNumber(call.caller_number) : 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {call.direction === 'inbound' ? (
                          <PhoneIncoming className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <PhoneOutgoing className="h-3.5 w-3.5 text-purple-500" />
                        )}
                        <span className="capitalize text-xs">{call.direction}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn('text-xs capitalize', STATUS_STYLES[call.status])}
                      >
                        {call.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(call.duration_seconds)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {call.sentiment ? (
                        <span className={cn('text-sm', SENTIMENT_STYLES[call.sentiment])}>
                          {SENTIMENT_EMOJI[call.sentiment]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {new Date(call.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
