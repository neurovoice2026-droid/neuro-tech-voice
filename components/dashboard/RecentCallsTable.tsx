'use client'

import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Phone, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn, formatDuration, formatPhoneNumber } from '@/lib/utils'
import { callerLabel, FallbackBadge, formatIntent, OutcomeChip, SentimentDot, StatusBadge } from '@/components/calls/call-display'
import type { CallListItem } from '@/hooks/useCalls'

interface RecentCallsTableProps {
  calls: CallListItem[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

export function RecentCallsTable({ calls, isLoading, error, onRetry }: RecentCallsTableProps) {
  const rows = calls.slice(0, 10)

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent calls</CardTitle>
          <Link href="/calls" className="text-xs font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none">
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && calls.length === 0 ? (
          <div className="space-y-3 p-4 sm:p-6" aria-busy="true" aria-label="Loading recent calls">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : error && calls.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="Recent calls couldn’t load"
            description={error}
            action={
              <Button variant="outline" size="sm" className="gap-2" onClick={onRetry}>
                <RefreshCw aria-hidden="true" className="size-3.5" /> Try again
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No calls yet"
            description="Calls will appear here as soon as your agent starts answering."
          />
        ) : (
          <>
            {/* Compact list on small screens */}
            <ul className="divide-y sm:hidden">
              {rows.map((call) => {
                const number = callerLabel(call)
                return (
                  <li key={call.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/calls?call=${call.id}`}
                        className={cn('block truncate text-sm font-medium hover:underline focus-visible:underline focus-visible:outline-none', number ? 'font-mono' : 'text-muted-foreground')}
                      >
                        {number ? formatPhoneNumber(number) : 'Unknown caller'}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {call.started_at ? formatDistanceToNow(new Date(call.started_at), { addSuffix: true }) : ''}
                        {call.duration_seconds > 0 ? ` · ${formatDuration(call.duration_seconds)}` : ''}
                      </p>
                    </div>
                    {call.status === 'in-progress' ? (
                      <StatusBadge status={call.status} className="shrink-0" />
                    ) : (
                      <OutcomeChip outcome={call.outcome} className="shrink-0" />
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground">Caller</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground">Outcome</th>
                    {/* Two thirds of the page from xl, so the reason only fits again on very wide screens. */}
                    <th scope="col" className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground lg:table-cell xl:hidden 2xl:table-cell">Reason</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground">Sentiment</th>
                    <th scope="col" className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Length</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted-foreground">When</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((call) => {
                    const number = callerLabel(call)
                    return (
                      <tr key={call.id} className="border-b transition-colors last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {call.direction === 'outbound' ? (
                              <ArrowUpRight aria-label="Outbound" className="size-3.5 shrink-0 text-purple-500" />
                            ) : (
                              <ArrowDownLeft aria-label="Inbound" className="size-3.5 shrink-0 text-blue-500" />
                            )}
                            <Link
                              href={`/calls?call=${call.id}`}
                              className={cn('whitespace-nowrap text-xs font-medium hover:underline focus-visible:underline focus-visible:outline-none', number ? 'font-mono' : 'text-muted-foreground')}
                            >
                              {number ? formatPhoneNumber(number) : 'Unknown caller'}
                            </Link>
                          </div>
                          {call.fallback_used && <FallbackBadge className="mt-1" />}
                        </td>
                        <td className="px-4 py-3">
                          {call.status === 'in-progress' ? <StatusBadge status={call.status} /> : <OutcomeChip outcome={call.outcome} />}
                        </td>
                        <td className="hidden max-w-48 px-4 py-3 lg:table-cell xl:hidden 2xl:table-cell">
                          <span className="line-clamp-1 text-xs text-muted-foreground">{formatIntent(call.intent) ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <SentimentDot sentiment={call.sentiment} showLabel />
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {call.started_at ? formatDistanceToNow(new Date(call.started_at), { addSuffix: true }) : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
