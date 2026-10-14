'use client'

// Step navigation of the store onboarding, provided by CommerceOnboardingWrapper
// and read by the steps. Moving mirrors the position into the store at once and
// persists it through POST /api/commerce/onboarding/step; a failed persist only
// changes where a reload lands, so it is reported and the user keeps working.

import { createContext, useContext } from 'react'
import type { OAuthReturn } from './shopify'

export type { OAuthReturn }

export interface CommerceNavigation {
  /** Shows `step`; `persist: false` when the step's own route already stored the position. */
  goTo: (step: number, opts?: { persist?: boolean }) => void
  /** Re-reads GET /api/commerce/onboarding/state into the store (fresh checklist, counts…). */
  refetchState: () => void
  /** What the Shopify install returned with (?commerce=connected / ?commerce_error=…), until dismissed. */
  oauth: OAuthReturn | null
  dismissOauth: () => void
}

export const CommerceNavigationContext = createContext<CommerceNavigation | null>(null)

export function useCommerceNavigation(): CommerceNavigation {
  const nav = useContext(CommerceNavigationContext)
  if (!nav) throw new Error('useCommerceNavigation must be used inside CommerceOnboardingWrapper')
  return nav
}
