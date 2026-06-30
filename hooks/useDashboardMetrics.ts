import { useState, useEffect, useCallback } from 'react'
import type { DashboardMetrics } from '@/types'

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/metrics')
      if (res.ok) setMetrics(await res.json())
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch_()
    const id = setInterval(fetch_, 60_000)
    return () => clearInterval(id)
  }, [fetch_])

  return { metrics, isLoading, refetch: fetch_ }
}
