'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CalendarCheck, Check, MessageSquareText, Phone, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/shared/StatusChip'
import type { CallBookingView, CallMessageView } from '@/lib/voice-tools/message-view'

// The message the agent took and the appointments it booked during this call
// (slice B2), in the call view. Hidden when there are none.

interface BusinessResponse {
  messages: CallMessageView[]
  bookings: CallBookingView[]
}

/** Same rhythm as the call sheet's other sections (hairline-separated blocks). */
const SECTION = 'py-6 first:pt-0 last:pb-0'
const HEADING = 'mb-3 flex items-center gap-1.5 text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase'

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
  // The message being saved: its button shows the orb, the others are only disabled.
  const [busyId, setBusyId] = useState<string | null>(null)

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
    setBusyId(message.id)
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
      setBusyId(null)
    }
  }

  if (!data || (data.messages.length === 0 && data.bookings.length === 0)) return null

  return (
    <>
      {data.messages.map((m) => (
        <section key={m.id} aria-labelledby={`call-message-${m.id}`} className={SECTION}>
          <h3 id={`call-message-${m.id}`} className={HEADING}>
            <MessageSquareText className="size-3.5" aria-hidden="true" />
            Message taken
          </h3>
          <div className="space-y-3 rounded-2xl p-4 shadow-hair">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{m.purged ? 'Details removed (retention)' : m.caller_name || 'Unknown caller'}</span>
              {m.urgency === 'urgent' && (
                <StatusChip tone="danger" icon={<AlertTriangle aria-hidden="true" />}>
                  Urgent
                </StatusChip>
              )}
              <StatusChip tone={m.status === 'done' ? 'muted' : 'warning'} dot>
                {m.status === 'done' ? 'Done' : 'To follow up'}
              </StatusChip>
            </div>
            {m.reason && <p className="text-[13px] leading-[19px] whitespace-pre-line text-muted-foreground">{m.reason}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button
                size="sm"
                variant="outline"
                loading={busyId === m.id}
                disabled={busyId !== null && busyId !== m.id}
                onClick={() => void toggle(m)}
              >
                {m.status === 'done' ? <RotateCcw aria-hidden="true" /> : <Check aria-hidden="true" />}
                {m.status === 'done' ? 'Re-open' : 'Mark as done'}
              </Button>
              {m.callback_number && (
                <a
                  href={`tel:${m.callback_number.replace(/[^\d+]/g, '')}`}
                  className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4 outline-none hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
                >
                  <Phone className="size-3.5" aria-hidden="true" />
                  <span className="tabular-nums">Call back on {m.callback_number}</span>
                </a>
              )}
            </div>
          </div>
        </section>
      ))}
      {data.bookings.length > 0 && (
        <section aria-labelledby="call-bookings-title" className={SECTION}>
          <h3 id="call-bookings-title" className={HEADING}>
            <CalendarCheck className="size-3.5" aria-hidden="true" />
            Appointments booked
          </h3>
          <ul className="overflow-hidden rounded-2xl shadow-hair">
            {data.bookings.map((b) => (
              <li key={b.id} className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-rule px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatWhen(b.starts_at, b.timezone)}</p>
                  {b.caller_name && <p className="text-xs leading-4 text-muted-foreground">for {b.caller_name}</p>}
                </div>
                <StatusChip tone={b.status === 'booked' ? 'success' : b.status === 'cancelled' ? 'muted' : 'warning'} dot>
                  {b.status === 'booked' ? 'In your calendar' : b.status === 'cancelled' ? 'Cancelled' : 'Not confirmed'}
                </StatusChip>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
