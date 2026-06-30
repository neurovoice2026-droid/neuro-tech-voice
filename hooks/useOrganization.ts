import { useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import type { Organization } from '@/types'

export function useOrganization() {
  const { organization, setOrganization, isLoading, setLoading } = useAppStore()
  const supabase = createClient()

  const fetchOrganization = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .single()

    setOrganization(data as Organization | null)
    setLoading(false)
  }, [supabase, setOrganization, setLoading])

  useEffect(() => {
    fetchOrganization()
  }, [fetchOrganization])

  return { organization, isLoading, refetch: fetchOrganization }
}
