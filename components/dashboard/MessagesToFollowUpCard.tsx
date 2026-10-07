'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, MailWarning, MessageSquareText, Phone, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { CallMessageView } from '@/lib/voice-tools/message-view'

// Messages the agent took during calls (take_message tool) that are still
// open, newest first, with mark-as-done (and undo).

interface MessagesResponse {
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

export function MessagesToFollowUpCard({ limit = 5, className }: { limit?: number; className?: string }) {
  const [data, setData] = useState<MessagesResponse | null>(null)
  const [failed, setFailed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
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
  }, [limit])

  useEffect(() => {
    const ctrl = new AbortController()
    void load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

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
    } catch (err) {
      console.warn('Message update failed', err)
      toast.error('Could not update the message. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const messages = data?.messages ?? []
  return (
    <Card className={cn('border shadow-sm', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <MessageSquareText className="size-4 text-purple-600" aria-hidden="true" />
          Messages to follow up
          {data && data.open_count > 0 && (
            <Badge variant="secondary" className="text-xs" aria-label={`${data.open_count} open`}>
              {data.open_count}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Messages your agent took during calls.</CardDescription>
      </CardHeader>
      <CardContent>
        {!data && !failed ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading messages">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : failed && !data ? (
          <p className="text-sm text-muted-foreground">Messages could not be loaded.</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to follow up. Messages appear here when your agent takes one.</p>
        ) : (
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
                  onClick={() => void setStatus(m, 'done')}
                  aria-label={`Mark the message from ${m.caller_name || 'unknown caller'} as done`}
                >
                  {busyId === m.id ? <RotateCcw className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                  Done
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
