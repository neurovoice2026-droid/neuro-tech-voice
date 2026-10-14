'use client'

import { useCallback } from 'react'
import type { AutomationDto, CommerceOverviewDto } from '@/lib/commerce/types'
import { useCommerceQuery } from './useCommerceApi'

const REFRESH_MS = 60_000

/** GET /api/commerce/overview, refreshed every minute (queue counts and problems move). */
export function useCommerceOverview() {
  const query = useCommerceQuery<CommerceOverviewDto>('/api/commerce/overview', {
    fallback: 'The store overview could not be loaded.',
    refreshMs: REFRESH_MS,
  })
  const { setData } = query

  /** After PUT /api/commerce/automations/[type]: the server's row replaces the card's. */
  const replaceAutomation = useCallback(
    (automation: AutomationDto) =>
      setData((prev) =>
        prev ? { ...prev, automations: prev.automations.map((a) => (a.type === automation.type ? automation : a)) } : prev,
      ),
    [setData],
  )

  return { overview: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch, replaceAutomation }
}
