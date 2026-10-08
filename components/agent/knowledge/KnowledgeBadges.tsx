'use client'

// Small status chips for a knowledge document: search index state,
// "Always include" (prompt mode) and URL auto-sync problems.

import { AlertCircle, AlertTriangle, Pin, RefreshCcw, Search } from 'lucide-react'
import { OrbInline } from '@/components/shared/OrbLoader'
import { StatusChip } from '@/components/shared/StatusChip'
import type { KnowledgeDoc } from '@/hooks/useKnowledge'

/** RagBadge renders something for this index state (a healthy index shows nothing). */
export function hasRagBadge(status: string | null | undefined): boolean {
  return !!status && status !== 'succeeded' && status !== 'cannot_index_folder'
}

/** Search-index state of an attached document (nothing for a healthy index). */
export function RagBadge({ status, progress }: { status: string | null | undefined; progress?: number | null }) {
  if (!hasRagBadge(status)) return null
  if (status === 'new' || status === 'created' || status === 'processing') {
    const pct = typeof progress === 'number' && progress > 0 ? ` ${Math.round(progress)}%` : ''
    return (
      <StatusChip
        tone="neutral"
        icon={<OrbInline state="weaving" />}
        className="tabular-nums"
        title="Your agent can already use this document; search over it is being prepared."
      >
        Indexing{pct}
      </StatusChip>
    )
  }
  if (status === 'document_too_small') {
    return (
      <StatusChip tone="muted" icon={<Search aria-hidden="true" />} title="Short documents are always given to your agent in full.">
        Always read in full
      </StatusChip>
    )
  }
  if (status === 'rag_limit_exceeded') {
    return (
      <StatusChip
        tone="warning"
        icon={<AlertTriangle aria-hidden="true" />}
        title="Search indexing is paused because the platform limit was reached. Your agent can still read the document. Contact support if this persists."
      >
        Workspace limit reached
      </StatusChip>
    )
  }
  return (
    <StatusChip tone="danger" icon={<AlertCircle aria-hidden="true" />} title="Search indexing failed. Retry to index it again.">
      Indexing failed
    </StatusChip>
  )
}

export function UsageModeBadge({ doc }: { doc: KnowledgeDoc }) {
  if (doc.usage_mode !== 'prompt') return null
  return (
    <StatusChip tone="neutral" icon={<Pin aria-hidden="true" />} title="Included in every call, so your agent always knows it.">
      Always included
    </StatusChip>
  )
}

export function SyncBadge({ doc }: { doc: KnowledgeDoc }) {
  if (doc.type !== 'url' || !doc.auto_sync) return null
  if ((doc.sync_failures ?? 0) > 0) {
    return (
      <StatusChip
        tone="warning"
        icon={<AlertTriangle aria-hidden="true" />}
        title="The page could not be re-read on the last automatic update. Check that it is still online, or refresh it."
      >
        Update failed
      </StatusChip>
    )
  }
  const days = doc.sync_frequency_days ?? 7
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`Re-read automatically at least every ${days} days.`}>
      <RefreshCcw className="size-3" aria-hidden="true" />
      Auto-updates
    </span>
  )
}
