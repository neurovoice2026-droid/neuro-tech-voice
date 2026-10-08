'use client'

// Open messages the agent took during calls (take_message tool), newest
// first: the loader, mark-as-done (with undo) and list shared by the
// dashboard card and its "Show all" dialog.

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, MailWarning, MessageSquareText, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/shared/StatusChip'
import type { CallMessageView } from '@/lib/voice-tools/message-view'
import { formatDate } from '@/lib/utils'
import { relativeTime } from './relative-time'

export interface MessagesResponse {
  messages: CallMessageView[]
  open_count: number
}

const NOTIFY_PROBLEM: Record<string, string> = {
  email_not_configured: 'No alert e-mail: e-mail sending is not set up on the platform.',
  no_recipients: 'No alert e-mail: add a recipient in Agent → Call handling → Messages.',
  daily_cap: 'No alert e-mail: the daily alert limit was reached.',
  send_failed: 'The alert e-mail could not be sent.',
}

interface UseOpenMessagesOptions {
  /** False: nothing is fetched (e.g. a closed dialog). */
  enabled?: boolean
  /** Called after a message was marked done or re-opened here (other lists refresh). */
  onChanged?: () => void
}

/** GET /api/messages?status=open&limit=… plus PATCH /api/messages/[id] (done / undo). */
export function useOpenMessages(limit: number, { enabled = true, onChanged }: UseOpenMessagesOptions = {}) {
  const [data, setData] = useState<MessagesResponse | null>(null)
  const [failed, setFailed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const onChangedRef = useRef(onChanged)
  useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/messages?status=open&limit=${limit}`, { signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setData((await res.json()) as MessagesResponse)
        setFailed(false)
      } catch (err) {
        if (signal?.aborted) return
        console.warn('Messages request failed', err)
        setFailed(true)
      }
    },
    [limit],
  )

  useEffect(() => {
    if (!enabled) return
    const ctrl = new AbortController()
    void load(ctrl.signal)
    return () => ctrl.abort()
  }, [enabled, load])

  const setStatus = async (message: CallMessageView, status: 'open' | 'done') => {
    setBusyId(message.id)
    try {
      const res = await fetch(`/api/messages/${encodeURIComponent(message.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (status === 'done') {
        toast.success('Marked as done', {
          action: { label: 'Undo', onClick: () => void setStatus(message, 'open') },
        })
      }
      await load()
      onChangedRef.current?.()
    } catch (err) {
      console.warn('Message update failed', err)
      toast.error('Could not update the message. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const reload = useCallback(() => void load(), [load])

  return { data, failed, busyId, reload, markDone: (message: CallMessageView) => void setStatus(message, 'done') }
}

interface OpenMessagesListProps {
  messages: CallMessageView[]
  busyId: string | null
  onDone: (message: CallMessageView) => void
}

/** List rows (hairline between them, 20 px side padding): place it flush inside a panel. */
export function OpenMessagesList({ messages, busyId, onDone }: OpenMessagesListProps) {
  return (
    <ul aria-label="Open messages">
      {messages.map((m) => (
        <li key={m.id} className="flex items-start gap-3 border-b border-rule px-5 py-3.5 last:border-b-0">
          <div className="hidden size-8 shrink-0 place-items-center rounded-full bg-secondary sm:grid" aria-hidden="true">
            <MessageSquareText className="size-4 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-medium text-foreground">{m.purged ? 'Details removed (retention)' : m.caller_name || 'Unknown caller'}</span>
              {m.urgency === 'urgent' && (
                <StatusChip tone="danger" icon={<AlertTriangle aria-hidden="true" />}>
                  Urgent
                </StatusChip>
              )}
              <time dateTime={m.created_at} title={formatDate(m.created_at)} className="text-xs text-muted-foreground tabular-nums">
                {relativeTime(m.created_at)}
              </time>
            </div>
            {m.reason && <p className="mt-0.5 line-clamp-2 text-[13px] leading-[19px] text-muted-foreground">{m.reason}</p>}
            {m.callback_number && (
              <a
                href={`tel:${m.callback_number.replace(/[^\d+]/g, '')}`}
                className="mt-1 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-foreground tabular-nums underline decoration-foreground/30 underline-offset-4 outline-none hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
              >
                <Phone className="size-3" aria-hidden="true" />
                {m.callback_number}
              </a>
            )}
            {m.notify_error && NOTIFY_PROBLEM[m.notify_error] && (
              <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                <MailWarning className="size-3 shrink-0" aria-hidden="true" />
                {NOTIFY_PROBLEM[m.notify_error]}
              </p>
            )}
          </div>
          <Button
            size="xs"
            variant="outline"
            loading={busyId === m.id}
            onClick={() => onDone(m)}
            aria-label={`Mark the message from ${m.caller_name || 'unknown caller'} as done`}
            className="tap-44 shrink-0"
          >
            <Check aria-hidden="true" />
            Done
          </Button>
        </li>
      ))}
    </ul>
  )
}
