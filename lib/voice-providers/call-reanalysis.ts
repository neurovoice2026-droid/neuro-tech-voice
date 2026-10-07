import 'server-only'
// Applies a re-run analysis (POST /v1/convai/conversations/{id}/analysis/run)
// to one call. Unlike the webhook merge (which never replaces an outcome once
// set, and is deduplicated per conversation), a re-analysis REPLACES the
// analysis, summary, title, AI verdict and the outcome the AI extracted,
// because the owner asked for it after changing the data-collection fields.
// Outcomes the platform proved itself (transferred, voicemail, missed) are
// kept. No billing, no workflows: the call already had them.

import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { EVIDENCE_OUTCOMES, mergeMetadata, outcomeFrom } from './call-merge'
import type { NormalizedCallEvent } from './types'

export interface ReanalysisRow {
  id: string
  org_id: string
  outcome: string | null
  call_metadata?: unknown
  retention_applied_at?: string | null
}

/** Column patch for a re-analysed conversation (pure). */
export function reanalysisPatch(current: ReanalysisRow, event: NormalizedCallEvent): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    analysis: event.analysis ?? {},
    summary: event.summary,
    summary_title: event.summaryTitle ? event.summaryTitle.slice(0, 200) : null,
    call_successful: event.callSuccessful,
  }
  const derived = outcomeFrom(event)
  if (event.evidenceOutcome) patch.outcome = event.evidenceOutcome
  else if (!(current.outcome && EVIDENCE_OUTCOMES.has(current.outcome))) patch.outcome = derived
  const score = event.metadata?.call_success_score
  const metadata = mergeMetadata(current.call_metadata, score === undefined ? null : { call_success_score: score })
  if (metadata) patch.call_metadata = metadata
  return patch
}

export async function applyReanalysis(current: ReanalysisRow, event: NormalizedCallEvent, log: Logger): Promise<void> {
  if (current.retention_applied_at) throw new Error('call content was removed by the privacy retention')
  const { error } = await createAdminClient()
    .from('calls')
    .update(reanalysisPatch(current, event))
    .eq('id', current.id)
    .eq('org_id', current.org_id)
  if (error) throw new Error(`calls reanalysis update failed: ${error.message}`)
  log.info('call_reanalysis.applied', { callId: current.id, callSuccessful: event.callSuccessful })
}
