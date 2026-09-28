'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCallsChanged } from '@/hooks/useCallsChanged'
import type { DashboardMetrics } from '@/types'

// Dashboard numbers: loaded once, refreshed when the tab regains focus and
// shortly after any call of the organisation changes (Supabase Realtime),
// instead of polling every minute.

const FOCUS_REFRESH_MIN_MS = 15_000
const REALTIME_DEBOUNCE_MS = 2_000

export function useDashboardMetrics(orgId?: string | null) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const lastLoadRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    lastLoadRef.current = Date.now()
    try {
      const res = await fetch('/api/dashboard/metrics', { signal: controller.signal, cache: 'no-store' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null
        throw new Error(typeof body?.error?.message === 'string' ? body.error.message : 'We couldn’t load your numbers.')
      }
      const data = (await res.json()) as DashboardMetrics
      if (controller.signal.aborted) return
      setMetrics(data)
      setError(null)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error && err.message ? err.message : 'We couldn’t load your numbers.')
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => controllerRef.current?.abort()
  }, [load])

  // Refresh when the owner comes back to the tab.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastLoadRef.current < FOCUS_REFRESH_MIN_MS) return
      void load()
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  // Realtime nudge: a call was added or updated (status, analysis) → refresh soon.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useCallsChanged(orgId, () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void load(), REALTIME_DEBOUNCE_MS)
  })
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { metrics, error, isLoading, refetch: load }
}
