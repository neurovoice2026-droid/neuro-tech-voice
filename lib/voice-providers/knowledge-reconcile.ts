import 'server-only'
// Keeps knowledge rows honest about what the provider really has, using the
// light GET /summaries endpoint (100 ids per call, no document content):
//   • a document the provider no longer has (deleted in the dashboard, removed
//     by auto-sync, a delete that half-failed) is taken out of the agent spec
//     (status 'failed', ids cleared) instead of being sent as a stale locator
//     on every sync, which can fail the whole agent update;
//   • sizes, supported usage modes and auto-sync state are refreshed from the
//     provider's metadata (URL documents only learn their size this way).

import type { SupabaseClient } from '@supabase/supabase-js'
import * as kb from '@/lib/elevenlabs/api/knowledge'
import type { Logger } from '@/lib/observability/logger'

export const MISSING_REMOTE_MESSAGE = 'This document was removed from the voice provider. It is being added again; if it stays here, retry.'
export const MISSING_WEBSITE_MESSAGE = 'This website import was removed from the voice provider. Import the website again.'

/** Row patch for a provider summary: size, usage modes, auto-sync state, folder. */
export function summaryPatch(s: kb.KnowledgeSummary, opts: { includeSize: boolean }): Record<string, unknown> {
  const patch: Record<string, unknown> = { remote_checked_at: new Date().toISOString() }
  const size = Number(s.metadata?.size_bytes)
  if (opts.includeSize && Number.isInteger(size) && size >= 0 && size <= 2_000_000_000) patch.size_bytes = size
  if (Array.isArray(s.supported_usages)) {
    patch.supported_usages = s.supported_usages.filter((u) => u === 'prompt' || u === 'auto')
  }
  const updated = Number(s.metadata?.last_updated_at_unix_secs)
  if (Number.isFinite(updated) && updated > 0) patch.remote_updated_at = new Date(updated * 1000).toISOString()
  const failures = Number(s.auto_sync_info?.consec_failures)
  if (Number.isInteger(failures) && failures >= 0) patch.sync_failures = failures
  const freq = Number(s.auto_sync_info?.minimum_frequency_days)
  if (s.auto_sync_info && Number.isInteger(freq) && freq >= 1 && freq <= 180) patch.sync_frequency_days = freq
  if (typeof s.folder_parent_id === 'string' && s.folder_parent_id) patch.elevenlabs_folder_id = s.folder_parent_id
  return patch
}

/**
 * Checks every attached document and website folder of the agent and takes the
 * ones the provider no longer has out of the spec. Returns how many were
 * removed (the caller bumps the agent revision and re-syncs). Provider
 * failures other than 404 change nothing.
 */
export async function healMissingDocuments(db: SupabaseClient, orgId: string, agentId: string, log: Logger): Promise<number> {
  const [{ data: docs, error: docErr }, { data: crawls, error: crawlErr }] = await Promise.all([
    db
      .from('knowledge_documents')
      .select('id, elevenlabs_doc_id')
      .eq('org_id', orgId)
      .eq('agent_id', agentId)
      .in('status', ['ready', 'processing'])
      .not('elevenlabs_doc_id', 'is', null)
      .is('deleting_at', null),
    db
      .from('knowledge_crawls')
      .select('id, root_folder_id')
      .eq('org_id', orgId)
      .eq('agent_id', agentId)
      .eq('status', 'succeeded')
      .not('root_folder_id', 'is', null),
  ])
  if (docErr) throw new Error(`knowledge_documents read failed: ${docErr.message}`)
  if (crawlErr) throw new Error(`knowledge_crawls read failed: ${crawlErr.message}`)
  const ids = [
    ...(docs ?? []).map((d) => d.elevenlabs_doc_id as string),
    ...(crawls ?? []).map((c) => c.root_folder_id as string),
  ]
  if (!ids.length) return 0
  let results: Record<string, kb.BatchResult<kb.KnowledgeSummary>>
  try {
    results = await kb.summaries(ids, { orgId, agentId })
  } catch (err) {
    log.warn('knowledge.heal_check_failed', { error: err instanceof Error ? err.message.slice(0, 120) : 'error' })
    return 0
  }
  let removed = 0
  for (const d of docs ?? []) {
    if (!kb.isMissing(results[d.elevenlabs_doc_id as string])) continue
    const { error } = await db
      .from('knowledge_documents')
      .update({ status: 'failed', error_message: MISSING_REMOTE_MESSAGE, elevenlabs_doc_id: null, attached_at: null, elevenlabs_folder_id: null, rag_status: null, rag_index_id: null })
      .eq('id', d.id)
      .eq('org_id', orgId)
      .eq('elevenlabs_doc_id', d.elevenlabs_doc_id as string)
    if (error) log.error('knowledge.heal_write_failed', error, { docId: d.id })
    else {
      removed++
      log.warn('knowledge.remote_missing_detached', { docId: d.id, elevenlabsDocId: d.elevenlabs_doc_id })
    }
  }
  for (const c of crawls ?? []) {
    if (!kb.isMissing(results[c.root_folder_id as string])) continue
    const { error } = await db
      .from('knowledge_crawls')
      .update({ status: 'failed', error_message: MISSING_WEBSITE_MESSAGE, attached_at: null })
      .eq('id', c.id)
      .eq('org_id', orgId)
      .eq('status', 'succeeded')
    if (error) log.error('knowledge.heal_crawl_write_failed', error, { crawlId: c.id })
    else {
      removed++
      log.warn('knowledge.remote_folder_missing_detached', { crawlId: c.id })
    }
  }
  return removed
}
