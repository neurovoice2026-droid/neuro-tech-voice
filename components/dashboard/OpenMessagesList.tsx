'use client'

// Open messages the agent took during calls (take_message tool), newest
// first: the loader, mark-as-done (with undo) and list shared by the
// dashboard card and its "Show all" dialog.

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, MailWarning, Phone, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CallMessageView } from '@/lib/voice-tools/message-view'

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

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(iso).toLocaleDateString()
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

export function OpenMessagesList({ messages, busyId, onDone }: OpenMessagesListProps) {
  return (
    <ul className="divide-y" aria-label="Open messages">
      {messages.map((m) => (
        <li key={m.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{m.purged ? 'Details removed (retention)' : m.caller_name || 'Unknown caller'}</span>
              {m.urgency === 'urgent' && (
                <Badge variant="destructive" className="gap-1 text-[10px]">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  Urgent
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{timeAgo(m.created_at)}</span>
            </div>
            {m.reason && <p className="line-clamp-2 text-sm text-muted-foreground">{m.reason}</p>}
            {m.callback_number && (
              <a href={`tel:${m.callback_number.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:underline">
                <Phone className="size-3" aria-hidden="true" />
                {m.callback_number}
              </a>
            )}
            {m.notify_error && NOTIFY_PROBLEM[m.notify_error] && (
              <p className="flex items-center gap-1 text-[11px] text-amber-700">
                <MailWarning className="size-3" aria-hidden="true" />
                {NOTIFY_PROBLEM[m.notify_error]}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busyId === m.id}
            onClick={() => onDone(m)}
            aria-label={`Mark the message from ${m.caller_name || 'unknown caller'} as done`}
          >
            {busyId === m.id ? <RotateCcw className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            Done
          </Button>
        </li>
      ))}
    </ul>
  )
}
