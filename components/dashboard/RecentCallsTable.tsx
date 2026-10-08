'use client'

import Link from 'next/link'
import { ArrowRight, PhoneIncoming, PhoneOutgoing, Phone } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { AiOutcomeIcon, CallStatusBadge, HandledByBadge } from '@/components/calls/CallBadges'
import { cn, formatDate, formatDuration, formatPhoneNumber } from '@/lib/utils'
import type { CallListItem } from '@/lib/calls/labels'
import { CardError } from './CardError'
import { relativeTime } from './relative-time'

/** The home page shows the latest few; "View all" opens the full list. */
const ROWS_SHOWN = 6

interface RecentCallsTableProps {
  calls: CallListItem[]
  isLoading: boolean
  /** Last failed request, if any (the calls already shown are kept on a failed refresh). */
  error?: string | null
  onRetry?: () => void
}

export function RecentCallsTable({ calls, isLoading, error = null, onRetry }: RecentCallsTableProps) {
  const shown = calls.slice(0, ROWS_SHOWN)
  return (
    // Column visibility follows the card's own width (container queries), not the viewport:
    // the card is full width below xl and two-thirds of the page from xl.
    <Card className="@container/calls gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Recent calls</CardTitle>
        <CardAction className="self-center">
          <Link href="/calls" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-my-1 -mr-2')}>
            View all
            <ArrowRight aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>
      {isLoading ? (
        // Reserves the 6-row table it replaces (taller rows while the card is narrow).
        <OrbLoader
          label="Loading recent calls…"
          className="min-h-[574px] border-t border-rule @min-[560px]/calls:min-h-[394px]"
        />
      ) : error && calls.length === 0 ? (
        <CardError
          message="Recent calls could not be loaded."
          detail={error}
          onRetry={onRetry}
          className="border-t border-rule"
        />
      ) : calls.length === 0 ? (
        <div className="border-t border-rule">
          <EmptyState
            bare
            icon={Phone}
            title="No calls yet"
            description="Calls will appear here once your agent starts receiving them."
          />
        </div>
      ) : (
        <Table className="border-t border-rule">
          <caption className="sr-only">Most recent calls</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Caller</TableHead>
              <TableHead scope="col" className="pr-5 pl-3 @min-[440px]/calls:pr-3">Status</TableHead>
              <TableHead scope="col" className="hidden px-3 @min-[560px]/calls:table-cell">Handled by</TableHead>
              <TableHead scope="col" className="hidden pr-5 pl-3 text-right @min-[440px]/calls:table-cell @min-[700px]/calls:pr-3">Duration</TableHead>
              <TableHead scope="col" className="hidden w-24 pl-3 text-center leading-[14px] whitespace-normal @min-[700px]/calls:table-cell">AI outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((call) => {
              const inbound = call.direction === 'inbound'
              const DirectionIcon = inbound ? PhoneIncoming : PhoneOutgoing
              return (
                <TableRow key={call.id}>
                  <TableCell className="py-2.5">
                    <span className="block text-sm font-medium text-foreground tabular-nums">
                      {call.caller_number ? formatPhoneNumber(call.caller_number) : 'Unknown'}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs leading-4 text-muted-foreground">
                      <DirectionIcon className="size-3 shrink-0" aria-hidden="true" />
                      <span>{inbound ? 'Inbound' : 'Outbound'}</span>
                      <span aria-hidden="true">·</span>
                      {call.started_at ? (
                        <time dateTime={call.started_at} title={formatDate(call.started_at)} className="tabular-nums">
                          {relativeTime(call.started_at)}
                        </time>
                      ) : (
                        <span>—</span>
                      )}
                    </span>
                    <div className="mt-1.5 @min-[560px]/calls:hidden">
                      <HandledByBadge call={call} quiet />
                    </div>
                  </TableCell>
                  <TableCell className="pr-5 pl-3 @min-[440px]/calls:pr-3">
                    <CallStatusBadge status={call.status} />
                  </TableCell>
                  <TableCell className="hidden px-3 @min-[560px]/calls:table-cell">
                    <HandledByBadge call={call} quiet />
                  </TableCell>
                  <TableCell className="hidden pr-5 pl-3 text-right text-muted-foreground tabular-nums @min-[440px]/calls:table-cell @min-[700px]/calls:pr-3">
                    {call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : '—'}
                  </TableCell>
                  <TableCell className="hidden pl-3 @min-[700px]/calls:table-cell">
                    <span className="flex justify-center">
                      <AiOutcomeIcon value={call.call_successful} />
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
