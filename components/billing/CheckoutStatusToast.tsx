'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCheckoutWait } from '@/hooks/useCheckoutWait'
import { PLANS, type Plan } from '@/types'

// Tells the owner how a Stripe Checkout visit ended, then cleans the URL so a
// reload doesn't repeat the message. After a successful payment the new plan
// is applied by the Stripe webhook a few seconds later: until then the page
// says so (instead of showing the old plan as if nothing happened) and checks
// again every couple of seconds.

export function CheckoutStatusToast({ status, plan }: { status: 'success' | 'canceled' | null; plan: Plan }) {
  const router = useRouter()
  const shown = useRef(false)
  // Fixed at the first render: the plan prop changes once the refreshed page arrives.
  const [waiting] = useState(() => (status === 'success' ? { initialPlan: plan } : null))
  const wait = useCheckoutWait({ active: waiting !== null, flow: 'billing', initialPlan: waiting?.initialPlan ?? plan })

  useEffect(() => {
    if (!status || shown.current) return
    shown.current = true
    if (status === 'canceled') toast('Checkout was canceled. Nothing was charged.')
    // Only the address bar: a navigation would re-render the page and restart the wait.
    const url = new URL(window.location.href)
    url.searchParams.delete('checkout')
    window.history.replaceState(window.history.state, '', url.toString())
  }, [status])

  useEffect(() => {
    if (wait.state === 'applied') {
      router.refresh()
      const name = wait.status ? PLANS[wait.status.plan]?.name : null
      toast.success(name ? `Payment received. You’re on ${name} now.` : 'Payment received. Your new plan is active.')
    } else if (wait.state === 'timed_out') {
      router.refresh()
      toast('Payment received. Your plan is still being confirmed and will appear here within a few minutes.', { duration: 8000 })
    }
  }, [wait.state, wait.status, router])

  if (wait.state !== 'waiting') return null
  return (
    <div role="status" className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      Payment received. Activating your new plan, this usually takes a few seconds…
    </div>
  )
}
