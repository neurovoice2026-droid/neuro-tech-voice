'use client'

import { useEffect } from 'react'
import { businessIntentCookie } from '@/lib/auth/business-intent'
import type { BusinessType } from '@/types'

/**
 * Remembers what the visitor came to sign up for (lib/auth/business-intent.ts)
 * so the onboarding's first step can pre-select it. Written in the browser,
 * after paint: the register page stays a plain page and the cookie survives
 * the email confirmation and the Google round trip alike.
 */
export function BusinessIntentCookie({ businessType }: { businessType: BusinessType }) {
  useEffect(() => {
    document.cookie = businessIntentCookie(businessType, window.location.protocol === 'https:')
  }, [businessType])
  return null
}
