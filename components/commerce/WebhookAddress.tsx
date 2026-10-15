'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// The address a store's own code sends its events to (ConnectionDto
// .webhook_url: the custom connector, WooCommerce cart events), with a copy
// button. Shown on the Connections page and in the onboarding's connection
// panel; it is the only place the merchant can learn it.

interface WebhookAddressProps {
  url: string
  /** What sends to it, under the address (e.g. which events, how they are signed). */
  hint?: React.ReactNode
  className?: string
}

export function WebhookAddress({ url, hint, className }: WebhookAddressProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function copy() {
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true)
        toast.success('Webhook address copied')
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), 2000)
      },
      () => toast.error('Could not copy to the clipboard', { description: 'Select the address and copy it by hand.' }),
    )
  }

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex min-w-0 items-center gap-2 rounded-xl bg-secondary py-1.5 pr-1.5 pl-3">
        <code className="min-w-0 flex-1 truncate font-mono text-xs leading-5 text-foreground" title={url}>
          {url}
        </code>
        <Button type="button" variant="outline" size="xs" className="tap-44 shrink-0" onClick={copy} aria-label="Copy the webhook address">
          {copied ? <Check className="text-success-dot" aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {hint && <p className="mt-1.5 text-xs leading-[18px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
