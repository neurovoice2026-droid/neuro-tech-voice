'use client'

import { useCallback, useEffect, useState } from 'react'
import type { BookingStatus, Call, MessageUrgency, Plan } from '@/types'

export interface CallDetailBooking {
  id: string
  service: string | null
  caller_name: string
  starts_at: string
  ends_at: string
  timezone: string
  status: BookingStatus
  created_at: string
}

export interface CallDetailMessage {
  id: string
  recipient_name: string | null
  caller_name: string | null
  callback_number: string | null
  body: string
  urgency: MessageUrgency
  status: 'new' | 'notified' | 'read' | 'done'
  created_at: string
}

export interface CallDetailToolInvocation {
  id: string
  tool_name: string
  ok: boolean
  result_summary: string | null
  latency_ms: number | null
  created_at: string
}

/** GET /api/calls/[id] */
export interface CallDetail extends Call {
  agent_name: string | null
  /** A recording exists (it may still be locked by the plan). */
  recording_available: boolean
  recordings_entitled: boolean
  recordings_required_plan: Plan
  /** Google Docs/Sheets actions are part of the plan. */
  integrations_entitled: boolean
  integrations_required_plan: Plan
  /** The agent's lead questions, for labelling extracted details. */
  lead_fields: { key: string; label: string }[]
  bookings: CallDetailBooking[]
  messages: CallDetailMessage[]
  tool_invocations: CallDetailToolInvocation[]
}

type Result = { key: string; error: string | null }

export function useCallDetail(callId: string | null) {
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  // The last good copy stays on screen while a refresh runs or if one fails.
  const [lastCall, setLastCall] = useState<CallDetail | null>(null)
  const requestKey = callId ? `${callId}#${reload}` : null

  useEffect(() => {
    if (!callId || !requestKey) return
    const controller = new AbortController()
    fetch(`/api/calls/${encodeURIComponent(callId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null
          const message = typeof body?.error?.message === 'string' ? body.error.message : 'We couldn’t load this call.'
          throw new Error(message)
        }
        return (await res.json()) as CallDetail
      })
      .then((call) => {
        setLastCall(call)
        setResult({ key: requestKey, error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setResult({ key: requestKey, error: err instanceof Error && err.message ? err.message : 'We couldn’t load this call.' })
      })
    return () => controller.abort()
  }, [callId, requestKey])

  const refetch = useCallback(() => setReload((n) => n + 1), [])
  const current = lastCall && lastCall.id === callId ? lastCall : null

  return {
    call: callId ? current : null,
    isLoading: !!requestKey && result?.key !== requestKey,
    error: requestKey && result?.key === requestKey ? result.error : null,
    refetch,
  }
}
