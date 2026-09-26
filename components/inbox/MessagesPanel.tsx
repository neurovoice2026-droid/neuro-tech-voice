'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, CheckCheck, Inbox, Loader2, Mail, MailOpen, Phone, PhoneCall } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { SectionError } from '@/components/skills/SkillSection'
import { errorMessage, isAbortError, requestJson } from '@/components/skills/request'
import { notifyInboxChanged } from '@/components/inbox/unread'
import { displayPhone, formatDateTime, formatRelative } from '@/components/inbox/format'
import type { AgentMessage } from '@/types'

type Filter = 'unread' | 'read' | 'done' | 'all'
type Counts = { unread: number; read: number; done: number }

interface MessagesResponse {
  messages: AgentMessage[]
  total: number
  page: number
  page_size: number
  counts: Counts
  available: boolean
}

const PAGE_SIZE = 20

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
]

function bucket(status: AgentMessage['status']): keyof Counts {
  return status === 'new' || status === 'notified' ? 'unread' : status
}

function matches(filter: Filter, status: AgentMessage['status']): boolean {
  return filter === 'all' || bucket(status) === filter
}

interface MessagesPanelProps {
  timezone: string
  onUnreadChange: (unread: number) => void
}

export function MessagesPanel({ timezone, onUnreadChange }: MessagesPanelProps) {
  const [filter, setFilter] = useState<Filter>('unread')
  const [messages, setMessages] = useState<AgentMessage[] | null>(null)
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Counts>({ unread: 0, read: 0, done: 0 })
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [reloadKey, setReloadKey] = useState(0)
  const firstLoad = useRef(true)

  useEffect(() => {
    const controller = new AbortController()
    requestJson<MessagesResponse>(`/api/messages?status=${filter}&page=1&page_size=${PAGE_SIZE}`, { signal: controller.signal })
      .then((res) => {
        // Open on "All" the first time when nothing is unread, so the inbox never looks empty by accident.
        if (firstLoad.current && filter === 'unread' && res.counts.unread === 0 && res.counts.read + res.counts.done > 0) {
          firstLoad.current = false
          setFilter('all')
          return
        }
        firstLoad.current = false
        setMessages(res.messages)
        setTotal(res.total)
        setCounts(res.counts)
        setPage(1)
        setError(null)
        onUnreadChange(res.counts.unread)
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setError(errorMessage(err, 'We couldn’t load your messages.'))
      })
    return () => controller.abort()
  }, [filter, reloadKey, onUnreadChange])

  const changeFilter = (next: Filter) => {
    if (next === filter) return
    setMessages(null)
    setError(null)
    setFilter(next)
  }

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const next = page + 1
      // Offset by what's on screen: messages marked read or done have left this filter.
      const res = await requestJson<MessagesResponse>(
        `/api/messages?status=${filter}&offset=${messages?.length ?? 0}&page_size=${PAGE_SIZE}`
      )
      setMessages((prev) => {
        const seen = new Set((prev ?? []).map((m) => m.id))
        return [...(prev ?? []), ...res.messages.filter((m) => !seen.has(m.id))]
      })
      setTotal(res.total)
      setCounts(res.counts)
      setPage(next)
    } catch (err) {
      toast.error('Couldn’t load more messages', { description: errorMessage(err) })
    } finally {
      setLoadingMore(false)
    }
  }

  const setStatus = useCallback(
    async (message: AgentMessage, status: 'new' | 'read' | 'done') => {
      if (!messages) return
      const previous = { messages, counts, total }
      const from = bucket(message.status)
      const to = bucket(status)
      const nextCounts = { ...counts, [from]: Math.max(0, counts[from] - 1), [to]: counts[to] + 1 }
      const stays = matches(filter, status)
      setMessages(stays ? messages.map((m) => (m.id === message.id ? { ...m, status } : m)) : messages.filter((m) => m.id !== message.id))
      if (!stays) setTotal((t) => Math.max(0, t - 1))
      setCounts(nextCounts)
      onUnreadChange(nextCounts.unread)
      setPendingIds((ids) => new Set(ids).add(message.id))
      try {
        await requestJson(`/api/messages/${message.id}`, { method: 'PATCH', body: { status } })
        notifyInboxChanged()
      } catch (err) {
        setMessages(previous.messages)
        setCounts(previous.counts)
        setTotal(previous.total)
        onUnreadChange(previous.counts.unread)
        toast.error('That change wasn’t saved', { description: errorMessage(err) })
      } finally {
        setPendingIds((ids) => {
          const next = new Set(ids)
          next.delete(message.id)
          return next
        })
      }
    },
    [messages, counts, total, filter, onUnreadChange]
  )

  const filterCount = (value: Filter) => (value === 'all' ? counts.unread + counts.read + counts.done : counts[value])

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Filter messages" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => changeFilter(f.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
              filter === f.value ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {f.label}
            {messages !== null && <span className="text-xs opacity-80">{filterCount(f.value)}</span>}
          </button>
        ))}
      </div>

      {error ? (
        <SectionError
          message={error}
          onRetry={() => {
            setError(null)
            setMessages(null)
            setReloadKey((k) => k + 1)
          }}
        />
      ) : messages === null ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading messages">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filter === 'unread' ? 'You’re all caught up' : 'No messages here'}
          description={
            filter === 'unread'
              ? 'When your agent takes a message for you or your team, it shows up here straight away.'
              : 'Messages you mark this way will appear here.'
          }
          className="rounded-xl border border-dashed"
        />
      ) : (
        <>
          <ul className="space-y-3">
            {messages.map((m) => {
              const unread = m.status === 'new' || m.status === 'notified'
              const callback = m.callback_number || m.caller_number
              const pending = pendingIds.has(m.id)
              return (
                <li
                  key={m.id}
                  className={cn(
                    'rounded-xl border bg-card p-4 transition-opacity',
                    m.urgency === 'urgent' && m.status !== 'done' && 'border-red-200 dark:border-red-900',
                    pending && 'opacity-60'
                  )}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {unread && <span className="size-2 rounded-full bg-primary" aria-label="Unread" />}
                        <p className={cn('truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>
                          {m.caller_name || (m.caller_number ? displayPhone(m.caller_number) : 'Unknown caller')}
                        </p>
                        {m.urgency === 'urgent' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            Urgent
                          </span>
                        )}
                        {m.status === 'done' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            <Check className="size-3" aria-hidden="true" />
                            Done
                          </span>
                        )}
                      </div>
                      {m.recipient_name && <p className="mt-0.5 text-xs text-muted-foreground">For {m.recipient_name}</p>}
                    </div>
                    <time dateTime={m.created_at} title={formatDateTime(m.created_at, timezone)} className="shrink-0 text-xs text-muted-foreground">
                      {formatRelative(m.created_at, timezone)}
                    </time>
                  </div>

                  <p className="mt-2 text-sm whitespace-pre-line break-words">{m.body}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {callback && (
                      <a href={`tel:${callback}`} className={cn(buttonVariants({ size: 'sm' }))}>
                        <Phone aria-hidden="true" />
                        Call back {displayPhone(callback)}
                      </a>
                    )}
                    {unread ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => setStatus(m, 'read')} disabled={pending}>
                        <MailOpen aria-hidden="true" />
                        Mark as read
                      </Button>
                    ) : (
                      m.status !== 'done' && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setStatus(m, 'new')} disabled={pending}>
                          <Mail aria-hidden="true" />
                          Mark unread
                        </Button>
                      )
                    )}
                    {m.status !== 'done' ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => setStatus(m, 'done')} disabled={pending}>
                        <CheckCheck aria-hidden="true" />
                        Done
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setStatus(m, 'read')} disabled={pending}>
                        Reopen
                      </Button>
                    )}
                    {m.call_id && (
                      <Link href={`/calls?call=${m.call_id}`} className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }), 'sm:ml-auto')}>
                        <PhoneCall aria-hidden="true" />
                        View call
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {messages.length < total && (
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="animate-spin" aria-hidden="true" />}
                {loadingMore ? 'Loading…' : `Show more (${total - messages.length} left)`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
