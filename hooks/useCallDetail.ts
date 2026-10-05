'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Call } from '@/types'
import { isLiveStatus } from '@/lib/calls/labels'
import { readApiError } from '@/hooks/useCalls'

/** How often an open call that is still live is refreshed (transcript, recording, routing). */
const LIVE_REFRESH_MS = 10_000

interface DetailState {
  id: string | null
  call: Call | null
  error: string | null
}

export function useCallDetail(callId: string | null) {
  const [state, setState] = useState<DetailState>({ id: null, call: null, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!callId) return
    const ctrl = new AbortController()
    fetch(`/api/calls/${encodeURIComponent(callId)}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readApiError(res, 'Could not load this call.'))
        return (await res.json()) as Call
      })
      .then((call) => {
        if (!ctrl.signal.aborted) setState({ id: callId, call, error: null })
      })
      .catch((e: unknown) => {
        // Aborted: the sheet closed or switched to another call.
        if (ctrl.signal.aborted) return
        setState((prev) => ({
          id: callId,
          // Keep showing what we had on a failed background refresh.
          call: prev.id === callId ? prev.call : null,
          error: e instanceof Error ? e.message : 'Could not load this call.',
        }))
      })
    return () => ctrl.abort()
  }, [callId, reloadKey])

  const current = callId !== null && state.id === callId
  const call = current ? state.call : null
  const live = isLiveStatus(call?.status)

  // While the call is live, refresh it so the transcript/recording appear when it ends.
  useEffect(() => {
    if (!live) return
    const timer = setInterval(() => setReloadKey((k) => k + 1), LIVE_REFRESH_MS)
    return () => clearInterval(timer)
  }, [live])

  const refetch = useCallback(() => setReloadKey((k) => k + 1), [])

  return {
    call,
    isLoading: callId !== null && !current,
    error: current ? state.error : null,
    refetch,
  }
}
