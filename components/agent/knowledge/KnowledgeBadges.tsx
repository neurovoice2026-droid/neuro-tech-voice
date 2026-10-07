'use client'

// Small status badges for a knowledge document: search index state,
// "Always include" (prompt mode) and URL auto-sync problems.

import { AlertCircle, AlertTriangle, Loader2, Pin, RefreshCcw, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { KnowledgeDoc } from '@/hooks/useKnowledge'

const STYLE = {
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  warn: 'border-amber-300 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  pin: 'border-violet-200 bg-violet-50 text-violet-700',
} as const

/** Search-index state of an attached document (nothing for a healthy index). */
export function RagBadge({ status, progress }: { status: string | null | undefined; progress?: number | null }) {
  if (!status || status === 'succeeded' || status === 'cannot_index_folder') return null
  if (status === 'new' || status === 'created' || status === 'processing') {
    const pct = typeof progress === 'number' && progress > 0 ? ` ${Math.round(progress)}%` : ''
    return (
      <Badge variant="outline" className={cn('gap-1 text-xs', STYLE.info)} title="Your agent can already use this document; search over it is being prepared.">
        <Loader2 aria-hidden="true" className="animate-spin" />
        Indexing{pct}
      </Badge>
    )
  }
  if (status === 'document_too_small') {
    return (
      <Badge variant="outline" className={cn('gap-1 text-xs', STYLE.neutral)} title="Short documents are always given to your agent in full.">
        <Search aria-hidden="true" />
        Always read in full
      </Badge>
    )
  }
  if (status === 'rag_limit_exceeded') {
    return (
      <Badge variant="outline" className={cn('gap-1 text-xs', STYLE.warn)} title="Search indexing is paused because the platform limit was reached. Your agent can still read the document. Contact support if this persists.">
        <AlertTriangle aria-hidden="true" />
        Workspace limit reached
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className={cn('gap-1 text-xs', STYLE.error)} title="Search indexing failed. Retry to index it again.">
      <AlertCircle aria-hidden="true" />
      Indexing failed
    </Badge>
  )
}

export function UsageModeBadge({ doc }: { doc: KnowledgeDoc }) {
  if (doc.usage_mode !== 'prompt') return null
  return (
    <Badge variant="outline" className={cn('gap-1 text-xs', STYLE.pin)} title="Included in every call, so your agent always knows it.">
      <Pin aria-hidden="true" />
      Always included
    </Badge>
  )
}

export function SyncBadge({ doc }: { doc: KnowledgeDoc }) {
  if (doc.type !== 'url' || !doc.auto_sync) return null
  if ((doc.sync_failures ?? 0) > 0) {
    return (
      <Badge variant="outline" className={cn('gap-1 text-xs', STYLE.warn)} title="The page could not be re-read on the last automatic update. Check that it is still online, or refresh it.">
        <AlertTriangle aria-hidden="true" />
        Update failed
      </Badge>
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
