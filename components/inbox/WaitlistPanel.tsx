'use client'

import { useEffect, useState } from 'react'
import { CalendarCheck, ListOrdered, Loader2, Phone, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { SectionError } from '@/components/skills/SkillSection'
import { errorMessage, isAbortError, requestJson } from '@/components/skills/request'
import { displayPhone, formatDateTime, formatRelative } from '@/components/inbox/format'
import type { WaitlistEntry } from '@/types'

type Filter = 'active' | 'all'

interface WaitlistResponse {
  entries: WaitlistEntry[]
  total: number
  page: number
  page_size: number
  available: boolean
}

const PAGE_SIZE = 25

const STATUS_LABELS: Record<WaitlistEntry['status'], string> = {
  waiting: 'Waiting',
  offered: 'Offered a slot',
  booked: 'Booked',
  removed: 'Removed',
}

interface WaitlistPanelProps {
  timezone: string
}

export function WaitlistPanel({ timezone }: WaitlistPanelProps) {
  const [filter, setFilter] = useState<Filter>('active')
  const [entries, setEntries] = useState<WaitlistEntry[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    requestJson<WaitlistResponse>(`/api/bookings/waitlist?status=${filter}&page=1&page_size=${PAGE_SIZE}`, { signal: controller.signal })
      .then((res) => {
        setEntries(res.entries)
        setTotal(res.total)
        setPage(1)
        setError(null)
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setError(errorMessage(err, 'We couldn’t load your waitlist.'))
      })
    return () => controller.abort()
  }, [filter, reloadKey])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const next = page + 1
      // Offset by what's on screen: entries marked booked or removed have left the list.
      const res = await requestJson<WaitlistResponse>(
        `/api/bookings/waitlist?status=${filter}&offset=${entries?.length ?? 0}&page_size=${PAGE_SIZE}`
      )
      setEntries((prev) => {
        const seen = new Set((prev ?? []).map((e) => e.id))
        return [...(prev ?? []), ...res.entries.filter((e) => !seen.has(e.id))]
      })
      setTotal(res.total)
      setPage(next)
    } catch (err) {
      toast.error('Couldn’t load more', { description: errorMessage(err) })
    } finally {
      setLoadingMore(false)
    }
  }

  const setStatus = async (entry: WaitlistEntry, status: 'waiting' | 'booked' | 'removed') => {
    setPendingId(entry.id)
    try {
      const res = await requestJson<{ entry: WaitlistEntry }>(`/api/bookings/waitlist/${entry.id}`, { method: 'PATCH', body: { status } })
      const stillActive = res.entry.status === 'waiting' || res.entry.status === 'offered'
      if (filter === 'active' && !stillActive) {
        setEntries((prev) => (prev ?? []).filter((e) => e.id !== entry.id))
        setTotal((t) => Math.max(0, t - 1))
      } else {
        setEntries((prev) => (prev ?? []).map((e) => (e.id === entry.id ? res.entry : e)))
      }
      toast.success(status === 'removed' ? 'Removed from the waitlist' : status === 'booked' ? 'Marked as booked' : 'Back on the waitlist')
    } catch (err) {
      toast.error('That change wasn’t saved', { description: errorMessage(err) })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Which entries" className="inline-flex rounded-lg border p-0.5">
        {(
          [
            { value: 'active', label: 'Waiting' },
            { value: 'all', label: 'All' },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => {
              if (option.value === filter) return
              setEntries(null)
              setError(null)
              setFilter(option.value)
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
              filter === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? (
        <SectionError
          message={error}
          onRetry={() => {
            setError(null)
            setEntries(null)
            setReloadKey((k) => k + 1)
          }}
        />
      ) : entries === null ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading waitlist">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="Nobody is waiting"
          description="When no time suits a caller, your agent can add them to the waitlist. If a booking is cancelled, the first person in line is offered the slot by text."
          className="rounded-xl border border-dashed"
        />
      ) : (
        <>
          <ol className="space-y-2">
            {entries.map((entry, index) => {
              const active = entry.status === 'waiting' || entry.status === 'offered'
              const pending = pendingId === entry.id
              return (
                <li key={entry.id} className={cn('rounded-xl border bg-card p-4', pending && 'opacity-60')}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      {filter === 'active' && (
                        <span
                          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                          aria-label={`Position ${index + 1}`}
                        >
                          {index + 1}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{entry.caller_name || 'Caller'}</p>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{STATUS_LABELS[entry.status]}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <a href={`tel:${entry.caller_phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                            <Phone className="size-3" aria-hidden="true" />
                            {displayPhone(entry.caller_phone)}
                          </a>
                          <time dateTime={entry.created_at} title={formatDateTime(entry.created_at, timezone)}>
                            Added {formatRelative(entry.created_at, timezone)}
                          </time>
                          {entry.offered_at && <span>Offered {formatRelative(entry.offered_at, timezone)}</span>}
                        </div>
                        {(entry.service || entry.preferred_times) && (
                          <p className="mt-2 text-sm">
                            {entry.service && <span className="font-medium">{entry.service}</span>}
                            {entry.service && entry.preferred_times && <span className="text-muted-foreground"> · </span>}
                            {entry.preferred_times && <span className="text-muted-foreground">Prefers {entry.preferred_times}</span>}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:shrink-0 sm:flex-nowrap sm:justify-end">
                      {active ? (
                        <>
                          <Button type="button" size="sm" variant="outline" onClick={() => setStatus(entry, 'booked')} disabled={pending}>
                            <CalendarCheck aria-hidden="true" />
                            Mark as booked
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setStatus(entry, 'removed')} disabled={pending}>
                            <X aria-hidden="true" />
                            Remove
                          </Button>
                        </>
                      ) : (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setStatus(entry, 'waiting')} disabled={pending}>
                          <RotateCcw aria-hidden="true" />
                          Put back on the list
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          {entries.length < total && (
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="animate-spin" aria-hidden="true" />}
                {loadingMore ? 'Loading…' : `Show more (${total - entries.length} left)`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
