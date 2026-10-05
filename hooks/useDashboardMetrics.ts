'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DashboardMetrics } from '@/types'
import { readApiError } from '@/hooks/useCalls'

const REFRESH_MS = 60_000

interface MetricsState {
  metrics: DashboardMetrics | null
  loaded: boolean
  error: string | null
}

export function useDashboardMetrics() {
  const [state, setState] = useState<MetricsState>({ metrics: null, loaded: false, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/dashboard/metrics', { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readApiError(res, 'Could not load metrics.'))
        return (await res.json()) as DashboardMetrics
      })
      .then((metrics) => {
        if (!ctrl.signal.aborted) setState({ metrics, loaded: true, error: null })
      })
      .catch((e: unknown) => {
        // Aborted: unmounted or replaced by a newer refresh.
        if (ctrl.signal.aborted) return
        // Keep the last good numbers on a failed background refresh.
        setState((prev) => ({ ...prev, loaded: true, error: e instanceof Error ? e.message : 'Could not load metrics.' }))
      })
    return () => ctrl.abort()
  }, [reloadKey])

  useEffect(() => {
    const id = setInterval(() => setReloadKey((k) => k + 1), REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const refetch = useCallback(() => setReloadKey((k) => k + 1), [])

  return { metrics: state.metrics, isLoading: !state.loaded, error: state.error, refetch }
}
