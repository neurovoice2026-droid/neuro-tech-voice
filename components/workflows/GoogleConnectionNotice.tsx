'use client'

import { useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { UpgradeNotice } from '@/components/shared/UpgradeNotice'
import type { GoogleIntegrationType } from '@/lib/workflows/types'
import { cn } from '@/lib/utils'
import { GOOGLE_LABELS, type WorkflowCapabilities } from './meta'

interface GoogleConnectionNoticeProps {
  integration: GoogleIntegrationType
  capabilities: WorkflowCapabilities
  onRefresh: (integration: GoogleIntegrationType) => Promise<void>
}

/** Connection state for a Google step, with a way to connect without losing the workflow being built. */
export function GoogleConnectionNotice({ integration, capabilities, onRefresh }: GoogleConnectionNoticeProps) {
  const [checking, setChecking] = useState(false)
  const label = GOOGLE_LABELS[integration]
  const connection = capabilities.connections[integration]

  if (!capabilities.google.allowed) {
    return <UpgradeNotice compact feature="Google Workspace steps" requiredPlan={capabilities.google.requiredPlan} />
  }
  if (connection.connected) {
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-green-700">
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">
          {label} connected{connection.account_email ? ` as ${connection.account_email}` : ''}.
        </span>
      </p>
    )
  }
  if (!capabilities.google.available) {
    return (
      <p className="text-[11px] leading-relaxed text-amber-700">
        Google connections are unavailable right now, so this step can’t run yet. Please contact support.
      </p>
    )
  }

  async function check() {
    setChecking(true)
    try {
      await onRefresh(integration)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 sm:flex-row sm:items-center">
      <p className="flex-1 text-[11px] leading-relaxed text-amber-800">
        Connect {label} so this step can run. It opens in a new tab, and your workflow stays here.
      </p>
      <div className="flex shrink-0 gap-1.5">
        <a
          href={`/api/integrations/google/connect?type=${integration}`}
          target="_blank"
          rel="noopener"
          className={cn(buttonVariants({ size: 'xs' }))}
        >
          Connect {label} <ExternalLink />
        </a>
        <Button type="button" size="xs" variant="outline" onClick={() => void check()} disabled={checking}>
          {checking ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Check again
        </Button>
      </div>
    </div>
  )
}
