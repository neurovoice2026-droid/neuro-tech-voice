'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Call } from '@/types'

export function useRecentCalls(orgId?: string, limit = 20) {
  const [calls, setCalls] = useState<Call[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchCalls = useCallback(async () => {
    const res = await fetch(`/api/dashboard/recent-calls?limit=${limit}`)
    if (res.ok) setCalls(await res.json())
    setIsLoading(false)
  }, [limit])

  useEffect(() => {
    fetchCalls()
  }, [fetchCalls])

  // Realtime subscription
  useEffect(() => {
    if (!orgId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`calls:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calls', filter: `org_id=eq.${orgId}` },
        () => { fetchCalls() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orgId, fetchCalls])

  return { calls, isLoading, refetch: fetchCalls }
}
