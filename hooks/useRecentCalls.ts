'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCallsChanged } from '@/hooks/useCallsChanged'
import type { CallListItem } from '@/hooks/useCalls'

// Newest calls for the dashboard, kept live with Supabase Realtime: any insert
// or update of this organisation's calls triggers a (debounced) refetch, so a
// burst of status/analysis updates for one call costs one request.

const REALTIME_DEBOUNCE_MS = 800

export function useRecentCalls(orgId?: string | null, limit = 20) {
  const [calls, setCalls] = useState<CallListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  /** Increments after each realtime-triggered refresh; lets siblings (the chart) follow along without refetching on mount. */
  const [version, setVersion] = useState(0)
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async (opts?: { realtime?: boolean }) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const res = await fetch(`/api/dashboard/recent-calls?limit=${limit}`, { signal: controller.signal, cache: 'no-store' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null
        throw new Error(typeof body?.error?.message === 'string' ? body.error.message : 'We couldn’t load recent calls.')
      }
      const data = (await res.json()) as CallListItem[]
      if (controller.signal.aborted) return
      setCalls(data)
      setError(null)
      if (opts?.realtime) setVersion((v) => v + 1)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error && err.message ? err.message : 'We couldn’t load recent calls.')
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void load()
    return () => controllerRef.current?.abort()
  }, [load])

  // Shared realtime subscription (hooks/useCallsChanged), debounced here.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useCallsChanged(orgId, () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void load({ realtime: true }), REALTIME_DEBOUNCE_MS)
  })
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const refetch = useCallback(() => load(), [load])

  return { calls, error, isLoading, version, refetch }
}
