import 'server-only'
// Applies a re-run analysis (POST /v1/convai/conversations/{id}/analysis/run)
// to one call. Unlike the webhook merge (which never replaces an outcome once
// set, and is deduplicated per conversation), a re-analysis REPLACES the
// analysis, summary, title, AI verdict and the outcome the AI extracted,
// because the owner asked for it after changing the data-collection fields.
// Outcomes the platform proved itself (transferred, voicemail, missed) are
// kept. No billing, no workflows: the call already had them.
// A call whose content the privacy retention removed never gets it back: the
// UPDATE itself requires retention_applied_at IS NULL (the retention can run
// between the route's check and this write) and must change exactly the row.

import { createAdminClient } from '@/lib/supabase/admin'
import { RequestError } from '@/lib/api/http'
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

const PURGED_MESSAGE = 'This call’s transcript was removed by your retention setting, so it cannot be analysed again.'

export async function applyReanalysis(current: ReanalysisRow, event: NormalizedCallEvent, log: Logger): Promise<void> {
  if (current.retention_applied_at) throw new RequestError('conflict', PURGED_MESSAGE, 409)
  const { error, count } = await createAdminClient()
    .from('calls')
    .update(reanalysisPatch(current, event), { count: 'exact' })
    .eq('id', current.id)
    .eq('org_id', current.org_id)
    // Purged meanwhile (retention ran after the caller's check): never write content back.
    .is('retention_applied_at', null)
  if (error) throw new Error(`calls reanalysis update failed: ${error.message}`)
  if (count === 0) {
    log.warn('call_reanalysis.row_purged_or_gone', { callId: current.id })
    throw new RequestError('conflict', PURGED_MESSAGE, 409)
  }
  log.info('call_reanalysis.applied', { callId: current.id, callSuccessful: event.callSuccessful })
}
