'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CallListItem } from '@/lib/calls/labels'
import type { Call } from '@/types'
import { readApiError } from '@/hooks/useCalls'

/** Webhooks update a call several times in a row: coalesce realtime refreshes. */
const REALTIME_DEBOUNCE_MS = 1_000

/**
 * List endpoints omit transcript/analysis (detail-only, fetched by
 * GET /api/calls/[id]). Some dashboard widgets still type their props as
 * Call[], so the items are completed with explicit empty values.
 */
function asCalls(items: CallListItem[]): Call[] {
  return items.map((c) => ({ ...c, transcript: [], analysis: null }))
}

interface RecentState {
  calls: Call[]
  loaded: boolean
  error: string | null
}

export function useRecentCalls(orgId?: string, limit = 20) {
  const [state, setState] = useState<RecentState>({ calls: [], loaded: false, error: null })
  const [reloadKey, setReloadKey] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`/api/dashboard/recent-calls?limit=${limit}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readApiError(res, 'Could not load recent calls.'))
        return (await res.json()) as CallListItem[]
      })
      .then((calls) => {
        if (!ctrl.signal.aborted) setState({ calls: asCalls(calls), loaded: true, error: null })
      })
      .catch((e: unknown) => {
        // Aborted: a newer refresh replaced this one.
        if (ctrl.signal.aborted) return
        setState((prev) => ({ ...prev, loaded: true, error: e instanceof Error ? e.message : 'Could not load recent calls.' }))
      })
    return () => ctrl.abort()
  }, [limit, reloadKey])

  const refetch = useCallback(() => setReloadKey((k) => k + 1), [])

  // Realtime: any change to this org's calls refreshes the list (RLS still applies).
  useEffect(() => {
    if (!orgId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`calls:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calls', filter: `org_id=eq.${orgId}` },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(refetch, REALTIME_DEBOUNCE_MS)
        }
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      void supabase.removeChannel(channel)
    }
  }, [orgId, refetch])

  return { calls: state.calls, isLoading: !state.loaded, error: state.error, refetch }
}
