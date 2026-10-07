'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CalendarCheck, Check, MessageSquareText, Phone, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CallBookingView, CallMessageView } from '@/lib/voice-tools/message-view'

// The message the agent took and the appointments it booked during this call
// (slice B2), in the call view. Hidden when there are none.

interface BusinessResponse {
  messages: CallMessageView[]
  bookings: CallBookingView[]
}

function formatWhen(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone, dateStyle: 'full', timeStyle: 'short' }).format(date)
  } catch (err) {
    // An unknown zone on an old row: show the viewer's local time instead.
    console.warn('Booking time zone not supported', err)
    return date.toLocaleString()
  }
}

export function CallBusinessSection({ callId }: { callId: string }) {
  const [data, setData] = useState<BusinessResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/calls/${encodeURIComponent(callId)}/business`, { signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setData((await res.json()) as BusinessResponse)
      } catch (err) {
        if (!signal?.aborted) console.warn('Call messages and bookings could not be loaded', err)
      }
    },
    [callId],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    void load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  const toggle = async (message: CallMessageView) => {
    setBusy(true)
    try {
      const status = message.status === 'done' ? 'open' : 'done'
      const res = await fetch(`/api/messages/${encodeURIComponent(message.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(status === 'done' ? 'Marked as done' : 'Marked as open')
      await load()
    } catch (err) {
      console.warn('Message update failed', err)
      toast.error('Could not update the message. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!data || (data.messages.length === 0 && data.bookings.length === 0)) return null

  return (
    <>
      {data.messages.map((m) => (
        <section key={m.id} aria-labelledby={`call-message-${m.id}`}>
          <h3 id={`call-message-${m.id}`} className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
            Message taken
          </h3>
          <div className="space-y-2 rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{m.purged ? 'Details removed (retention)' : m.caller_name || 'Unknown caller'}</span>
              {m.urgency === 'urgent' && (
                <Badge variant="destructive" className="gap-1 text-[10px]">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  Urgent
                </Badge>
              )}
              <Badge variant={m.status === 'done' ? 'secondary' : 'outline'} className="text-[10px]">
                {m.status === 'done' ? 'Done' : 'To follow up'}
              </Badge>
            </div>
            {m.reason && <p className="whitespace-pre-line text-sm text-muted-foreground">{m.reason}</p>}
            {m.callback_number && (
              <a href={`tel:${m.callback_number.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:underline">
                <Phone className="size-3" aria-hidden="true" />
                Call back on {m.callback_number}
              </a>
            )}
            <div>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void toggle(m)}>
                {m.status === 'done' ? <RotateCcw aria-hidden="true" /> : <Check aria-hidden="true" />}
                {m.status === 'done' ? 'Re-open' : 'Mark as done'}
              </Button>
            </div>
          </div>
        </section>
      ))}
      {data.bookings.length > 0 && (
        <section aria-labelledby="call-bookings-title">
          <h3 id="call-bookings-title" className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Appointments booked
          </h3>
          <ul className="space-y-2">
            {data.bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm">
                <span className="font-medium">{formatWhen(b.starts_at, b.timezone)}</span>
                {b.caller_name && <span className="text-muted-foreground">for {b.caller_name}</span>}
                <Badge variant={b.status === 'booked' ? 'secondary' : 'outline'} className="text-[10px]">
                  {b.status === 'booked' ? 'In your calendar' : b.status === 'cancelled' ? 'Cancelled' : 'Not confirmed'}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
