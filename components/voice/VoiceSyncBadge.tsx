'use client'

import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { OrbInline } from '@/components/shared/OrbLoader'
import { StatusChip } from '@/components/shared/StatusChip'
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

/** Voice sync status chip: Active (success) · Syncing (connecting orb) · Not applied (danger) · Pending (warning). */
export function VoiceSyncBadge({ status, className }: VoiceSyncBadgeProps) {
  const s: VoiceSyncStatus = status ?? 'pending'
  const copy = VOICE_SYNC_COPY[s]

  if (s === 'synced') {
    return (
      <StatusChip tone="success" icon={<CheckCircle2 aria-hidden="true" />} title={copy.description} className={className}>
        {copy.label}
      </StatusChip>
    )
  }
  if (s === 'saving') {
    return (
      <StatusChip
        tone="neutral"
        icon={<OrbInline state="connecting" />}
        title={copy.description}
        aria-live="polite"
        className={className}
      >
        {copy.label}
      </StatusChip>
    )
  }
  if (s === 'failed') {
    return (
      <StatusChip tone="danger" icon={<AlertCircle aria-hidden="true" />} title={copy.description} className={className}>
        {copy.label}
      </StatusChip>
    )
  }
  return (
    <StatusChip tone="warning" icon={<Clock aria-hidden="true" />} title={copy.description} className={className}>
      {copy.label}
    </StatusChip>
  )
}
