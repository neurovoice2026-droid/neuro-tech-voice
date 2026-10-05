'use client'

import Link from 'next/link'
import { PhoneIncoming, PhoneOutgoing, Phone } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { CallStatusBadge, HandledByBadge, SentimentIcon } from '@/components/calls/CallBadges'
import { formatDate, formatDuration, formatPhoneNumber } from '@/lib/utils'
import type { CallListItem } from '@/lib/calls/labels'

interface RecentCallsTableProps {
  calls: CallListItem[]
  isLoading: boolean
}

export function RecentCallsTable({ calls, isLoading }: RecentCallsTableProps) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Calls</CardTitle>
          <Link href="/calls" className="text-xs text-primary hover:underline">View all</Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-6" aria-busy="true" aria-label="Loading recent calls">
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
              <caption className="sr-only">Most recent calls</caption>
              <thead>
                <tr className="border-b bg-muted/30">
                  <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground">Caller</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Direction</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Handled by</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Duration</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Sentiment</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Time</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium">
                        {call.caller_number ? formatPhoneNumber(call.caller_number) : 'Unknown'}
                      </span>
                      <div className="mt-1 md:hidden">
                        <HandledByBadge call={call} />
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {call.direction === 'inbound' ? (
                          <PhoneIncoming className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
                        ) : (
                          <PhoneOutgoing className="h-3.5 w-3.5 text-purple-500" aria-hidden="true" />
                        )}
                        <span className="text-xs">{call.direction === 'inbound' ? 'Inbound' : 'Outbound'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <CallStatusBadge status={call.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <HandledByBadge call={call} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <SentimentIcon sentiment={call.sentiment} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {call.started_at ? (
                        <time dateTime={call.started_at} title={formatDate(call.started_at)} className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}
                        </time>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
