'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, CalendarX2, CheckCircle2, Loader2, MessageSquareText, Phone, PhoneCall, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { SectionError } from '@/components/skills/SkillSection'
import { errorMessage, isAbortError, requestJson } from '@/components/skills/request'
import { dayKey, displayPhone, formatDateTime, formatDayHeading, formatTime } from '@/components/inbox/format'
import type { Booking, BookingStatus } from '@/types'

type Range = 'upcoming' | 'past'

interface BookingsResponse {
  bookings: Booking[]
  total: number
  page: number
  page_size: number
  available: boolean
}

const PAGE_SIZE = 25

const STATUS_LABELS: Record<BookingStatus, { label: string; className: string }> = {
  booked: { label: 'Booked', className: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' },
  rescheduled: { label: 'Moved', className: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground line-through' },
  completed: { label: 'Completed', className: 'bg-muted text-foreground' },
  no_show: { label: 'No-show', className: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
}

function isActive(status: BookingStatus): boolean {
  return status === 'booked' || status === 'rescheduled'
}

interface BookingsPanelProps {
  timezone: string
}

export function BookingsPanel({ timezone }: BookingsPanelProps) {
  const [range, setRange] = useState<Range>('upcoming')
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [cancelling, setCancelling] = useState<Booking | null>(null)
  const [cancelPending, setCancelPending] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestJson<BookingsResponse>(`/api/bookings?range=${range}&page=1&page_size=${PAGE_SIZE}`, { signal: controller.signal })
      .then((res) => {
        setBookings(res.bookings)
        setTotal(res.total)
        setPage(1)
        setError(null)
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setError(errorMessage(err, 'We couldn’t load your bookings.'))
      })
    return () => controller.abort()
  }, [range, reloadKey])

  const changeRange = (next: Range) => {
    if (next === range) return
    setBookings(null)
    setError(null)
    setRange(next)
  }

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const next = page + 1
      const res = await requestJson<BookingsResponse>(`/api/bookings?range=${range}&page=${next}&page_size=${PAGE_SIZE}`)
      setBookings((prev) => {
        const seen = new Set((prev ?? []).map((b) => b.id))
        return [...(prev ?? []), ...res.bookings.filter((b) => !seen.has(b.id))]
      })
      setTotal(res.total)
      setPage(next)
    } catch (err) {
      toast.error('Couldn’t load more bookings', { description: errorMessage(err) })
    } finally {
      setLoadingMore(false)
    }
  }

  const replace = (booking: Booking) => setBookings((prev) => (prev ?? []).map((b) => (b.id === booking.id ? booking : b)))

  const confirmCancel = async () => {
    if (!cancelling) return
    setCancelPending(true)
    try {
      const res = await requestJson<{ booking: Booking; calendar_synced?: boolean; sms?: string }>(`/api/bookings/${cancelling.id}`, {
        method: 'PATCH',
        body: { status: 'cancelled' },
      })
      replace(res.booking)
      const notes = [
        res.calendar_synced === false
          ? 'We couldn’t reach your Google Calendar, so please delete the event there yourself (and reconnect Google in Agent → Skills).'
          : null,
        res.sms === 'sent' ? `${cancelling.caller_name} was sent a text.` : null,
      ].filter(Boolean)
      toast.success('Booking cancelled', notes.length ? { description: notes.join(' ') } : undefined)
      setCancelling(null)
    } catch (err) {
      toast.error('The booking wasn’t cancelled', { description: errorMessage(err) })
    } finally {
      setCancelPending(false)
    }
  }

  const mark = async (booking: Booking, status: 'completed' | 'no_show') => {
    setPendingId(booking.id)
    try {
      const res = await requestJson<{ booking: Booking }>(`/api/bookings/${booking.id}`, { method: 'PATCH', body: { status } })
      replace(res.booking)
      toast.success(status === 'completed' ? 'Marked as completed' : 'Marked as a no-show')
    } catch (err) {
      toast.error('That change wasn’t saved', { description: errorMessage(err) })
    } finally {
      setPendingId(null)
    }
  }

  const groups: { key: string; heading: string; items: Booking[] }[] = []
  for (const booking of bookings ?? []) {
    const zone = booking.timezone || timezone
    const key = dayKey(booking.starts_at, zone)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(booking)
    else groups.push({ key, heading: formatDayHeading(booking.starts_at, zone), items: [booking] })
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Which bookings" className="inline-flex rounded-lg border p-0.5">
        {(['upcoming', 'past'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={range === value}
            onClick={() => changeRange(value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium capitalize outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
              range === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {error ? (
        <SectionError
          message={error}
          onRetry={() => {
            setError(null)
            setBookings(null)
            setReloadKey((k) => k + 1)
          }}
        />
      ) : bookings === null ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading bookings">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={range === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
          description={
            range === 'upcoming'
              ? 'Appointments your agent books during calls appear here and in your Google Calendar.'
              : 'Finished appointments show up here so you can mark who came.'
          }
          action={
            range === 'upcoming' ? (
              <Link href="/agent?tab=skills" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Booking settings
              </Link>
            ) : undefined
          }
          className="rounded-xl border border-dashed"
        />
      ) : (
        <>
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.key} aria-label={group.heading}>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{group.heading}</h3>
                <ul className="space-y-2">
                  {group.items.map((b) => {
                    const zone = b.timezone || timezone
                    const status = STATUS_LABELS[b.status] ?? STATUS_LABELS.booked
                    const started = Date.parse(b.starts_at) <= Date.now()
                    const pending = pendingId === b.id
                    return (
                      <li key={b.id} className={cn('rounded-xl border bg-card p-4', pending && 'opacity-60')}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 gap-3">
                            <div className="w-16 shrink-0 text-sm">
                              <p className="font-semibold">{formatTime(b.starts_at, zone)}</p>
                              <p className="text-xs text-muted-foreground">to {formatTime(b.ends_at, zone)}</p>
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-medium">{b.caller_name}</p>
                                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status.className)}>{status.label}</span>
                              </div>
                              {b.service && <p className="text-sm text-muted-foreground">{b.service}</p>}
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {b.caller_phone && (
                                  <a href={`tel:${b.caller_phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                                    <Phone className="size-3" aria-hidden="true" />
                                    {displayPhone(b.caller_phone)}
                                  </a>
                                )}
                                {b.confirmation_sent_at && (
                                  <span className="inline-flex items-center gap-1">
                                    <MessageSquareText className="size-3" aria-hidden="true" />
                                    Confirmation texted
                                  </span>
                                )}
                                {zone !== timezone && <span>Times in {zone}</span>}
                              </div>
                              {b.notes && <p className="mt-2 text-sm whitespace-pre-line break-words">{b.notes}</p>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            {b.call_id && (
                              <Link href={`/calls?call=${b.call_id}`} className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
                                <PhoneCall aria-hidden="true" />
                                View call
                              </Link>
                            )}
                            {isActive(b.status) && !started && (
                              <Button type="button" size="sm" variant="outline" onClick={() => setCancelling(b)}>
                                <CalendarX2 aria-hidden="true" />
                                Cancel
                              </Button>
                            )}
                            {isActive(b.status) && started && (
                              <>
                                <Button type="button" size="sm" variant="outline" onClick={() => mark(b, 'completed')} disabled={pending}>
                                  <CheckCircle2 aria-hidden="true" />
                                  Completed
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => mark(b, 'no_show')} disabled={pending}>
                                  <UserX aria-hidden="true" />
                                  No-show
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
          {bookings.length < total && (
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="animate-spin" aria-hidden="true" />}
                {loadingMore ? 'Loading…' : `Show more (${total - bookings.length} left)`}
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={cancelling !== null} onOpenChange={(open) => !open && !cancelPending && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>
              {cancelling
                ? `${cancelling.caller_name}, ${formatDateTime(cancelling.starts_at, cancelling.timezone || timezone)}${
                    cancelling.service ? ` (${cancelling.service})` : ''
                  }. We’ll remove it from your Google Calendar and text the caller if booking texts are on. The freed time is offered to your waitlist.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)} disabled={cancelPending}>
              Keep booking
            </Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={cancelPending}>
              {cancelPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {cancelPending ? 'Cancelling…' : 'Cancel booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
