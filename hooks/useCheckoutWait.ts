'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CHECKOUT_POLL_INTERVAL_MS,
  checkoutWaitState,
  parseBillingStatus,
  type BillingStatus,
  type CheckoutWait,
} from '@/lib/billing/checkout-wait'
import type { Plan } from '@/types'

/**
 * Polls GET /api/billing/status after a successful Stripe Checkout until the
 * webhook applied the plan, or the wait times out. `active` false does nothing.
 */
export function useCheckoutWait(input: { active: boolean; flow: 'onboarding' | 'billing'; initialPlan: Plan }): {
  state: CheckoutWait | 'idle'
  status: BillingStatus | null
  restart: () => void
} {
  const { active, flow, initialPlan } = input
  const [state, setState] = useState<CheckoutWait | 'idle'>(active ? 'waiting' : 'idle')
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (!active) return
    const startedAt = Date.now()
    const controller = new AbortController()
    let timer: number | null = null

    const check = async () => {
      let latest: BillingStatus | null = null
      try {
        const res = await fetch('/api/billing/status', { cache: 'no-store', signal: controller.signal })
        if (res.ok) latest = parseBillingStatus(await res.json().catch(() => null))
      } catch {
        if (controller.signal.aborted) return
        // A dropped request is just one missed poll.
      }
      if (controller.signal.aborted) return
      if (latest) setStatus(latest)
      const next = checkoutWaitState({ flow, initialPlan, status: latest, elapsedMs: Date.now() - startedAt })
      setState(next)
      if (next === 'waiting') timer = window.setTimeout(() => void check(), CHECKOUT_POLL_INTERVAL_MS)
    }
    void check()
    return () => {
      controller.abort()
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [active, flow, initialPlan, round])

  const restart = useCallback(() => {
    setState('waiting')
    setRound((n) => n + 1)
  }, [])

  return { state, status, restart }
}
