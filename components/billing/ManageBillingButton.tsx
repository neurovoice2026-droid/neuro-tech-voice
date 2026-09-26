'use client'

import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Opens the Stripe customer portal (payment method, receipts, cancellation).

export function ManageBillingButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false)

  async function openPortal() {
    setPending(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } }
      if (res.ok && data.url) {
        window.location.assign(data.url)
        return
      }
      toast.error(data.error?.message ?? 'We couldn’t open the billing portal. Please try again.')
    } catch {
      toast.error('We couldn’t reach the server. Check your connection and try again.')
    }
    setPending(false)
  }

  return (
    <Button variant="outline" onClick={openPortal} disabled={pending} className={cn('gap-1.5', className)}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}
      Manage billing
      <span className="sr-only"> (payment method, receipts and cancellation, opens Stripe)</span>
    </Button>
  )
}
