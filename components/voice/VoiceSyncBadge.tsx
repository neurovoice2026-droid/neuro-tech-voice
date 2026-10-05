'use client'

import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { VoiceSyncStatus } from '@/types'

interface SyncCopy {
  label: string
  description: string
}

// "Active" is reserved for a voice the provider has confirmed. Anything else
// says plainly that callers do not hear this voice yet.
export const VOICE_SYNC_COPY: Record<VoiceSyncStatus, SyncCopy> = {
  synced: { label: 'Active', description: 'Callers hear this voice.' },
  saving: { label: 'Syncing…', description: 'Applying this voice to your agent.' },
  failed: { label: 'Not applied', description: 'Callers still hear the previous voice.' },
  pending: { label: 'Pending', description: 'Will apply when your agent is created.' },
}

interface VoiceSyncBadgeProps {
  /** Missing status (older rows) is treated as not yet confirmed. */
  status: VoiceSyncStatus | null | undefined
  className?: string
}

export function VoiceSyncBadge({ status, className }: VoiceSyncBadgeProps) {
  const s: VoiceSyncStatus = status ?? 'pending'
  const copy = VOICE_SYNC_COPY[s]

  if (s === 'synced') {
    return (
      <Badge
        variant="outline"
        title={copy.description}
        className={cn('border-green-500/30 bg-green-500/15 text-green-600 dark:text-green-400', className)}
      >
        <CheckCircle2 aria-hidden="true" />
        {copy.label}
      </Badge>
    )
  }
  if (s === 'saving') {
    return (
      <Badge variant="secondary" title={copy.description} className={className} aria-live="polite">
        <Loader2 className="animate-spin" aria-hidden="true" />
        {copy.label}
      </Badge>
    )
  }
  if (s === 'failed') {
    return (
      <Badge variant="destructive" title={copy.description} className={className}>
        <AlertCircle aria-hidden="true" />
        {copy.label}
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      title={copy.description}
      className={cn('border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400', className)}
    >
      <Clock aria-hidden="true" />
      {copy.label}
    </Badge>
  )
}
