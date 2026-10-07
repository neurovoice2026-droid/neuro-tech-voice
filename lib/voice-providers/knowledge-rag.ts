import 'server-only'
// RAG index state per document, for the agent's current embedding model.
//
// ElevenLabs indexes a document per embedding model; the agent's model
// follows its language (multilingual for anything but English), so a language
// change needs new indexes, and the old ones keep using the shared workspace
// quota until deleted. This module:
//   • stores the index state on the row (rag_status/progress/model/index id/
//     used bytes) so the dashboard can show "Indexing 40%", "Failed",
//     "Workspace limit reached" instead of a blanket "Ready";
//   • refreshes in-progress states with the batch endpoint (100 per call,
//     create_if_missing=false: read only);
//   • re-indexes every document of an organization for a new model (batch,
//     create_if_missing=true) and later deletes the old-model indexes;
//   • reads the workspace quota (cached) to pause uploads above 95 %.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import * as kb from '@/lib/elevenlabs/api/knowledge'
import { RequestError } from '@/lib/api/http'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { isProviderError } from './errors'
import { AGENT_RAG_COLUMNS, embeddingModelForAgentRow } from './agent-rag-model'

export const RAG_PENDING_STATUSES: readonly kb.RagIndexStatus[] = ['new', 'created', 'processing']
/** States that will not change without an action (re-index, more quota). */
export const RAG_SETTLED_STATUSES: readonly kb.RagIndexStatus[] = [
  'succeeded',
  'failed',
  'rag_limit_exceeded',
  'document_too_small',
  'cannot_index_folder',
]

/** Minimum time between two status reads for the same organization from the dashboard. */
const LIST_REFRESH_MIN_MS = 10_000

export function isRagStatus(v: unknown): v is kb.RagIndexStatus {
  return typeof v === 'string' && (kb.RAG_INDEX_STATUSES as readonly string[]).includes(v)
}

/** Row patch for one index response. */
export function ragPatch(index: kb.RagDocumentIndex, now = new Date()): Record<string, unknown> {
  const progress = Number(index.progress_percentage)
  const used = Number(index.document_model_index_usage?.used_bytes)
  return {
    rag_status: isRagStatus(index.status) ? index.status : null,
    rag_progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : null,
    rag_model: index.model ?? null,
    rag_index_id: typeof index.id === 'string' ? index.id : null,
    rag_used_bytes: Number.isFinite(used) ? Math.max(0, Math.round(used)) : null,
    rag_checked_at: now.toISOString(),
  }
}

/** The embedding model the organization's agent uses now. */
export async function agentEmbeddingModel(db: SupabaseClient, orgId: string, agentId: string): Promise<kb.EmbeddingModel> {
  const { data, error } = await db.from('agents').select(AGENT_RAG_COLUMNS).eq('id', agentId).eq('org_id', orgId).maybeSingle()
  if (error) throw new Error(`agents read failed: ${error.message}`)
  return embeddingModelForAgentRow(data)
}

interface RagRow {
  id: string
  elevenlabs_doc_id: string | null
  rag_status?: string | null
  rag_model?: string | null
  rag_checked_at?: string | null
}

/**
 * Brings the stored index state of these rows up to date for `model`:
 * rows indexed for another model (or never recorded) are (re)indexed
 * (create_if_missing=true), rows still indexing are read
 * (create_if_missing=false). Returns the number of rows updated.
 */
export async function syncRagState(
  db: SupabaseClient,
  orgId: string,
  rows: readonly RagRow[],
  model: kb.EmbeddingModel,
  log: Logger,
  opts: { fast?: boolean } = {},
): Promise<number> {
  const items: Array<{ document_id: string; model: kb.EmbeddingModel; create_if_missing: boolean }> = []
  const byElId = new Map<string, RagRow>()
  for (const r of rows) {
    if (!r.elevenlabs_doc_id) continue
    const wrongModel = r.rag_model !== model
    const pending = !r.rag_status || (RAG_PENDING_STATUSES as readonly string[]).includes(r.rag_status)
    if (!wrongModel && !pending) continue
    items.push({ document_id: r.elevenlabs_doc_id, model, create_if_missing: wrongModel || !r.rag_status })
    byElId.set(r.elevenlabs_doc_id, r)
  }
  if (!items.length) return 0
  const results = opts.fast ? await kb.ragIndexBatch(items, { orgId }, { fast: true }) : await kb.ragIndexBatch(items, { orgId })
  let updated = 0
  const now = new Date()
  for (const [elId, row] of byElId) {
    const res = results[elId]
    if (!res) continue
    if (res.status !== 'success') {
      // 404: the document is gone (the reconcile step heals it); other failures are retried next time.
      log.warn('knowledge.rag_batch_item_failed', { docId: row.id, code: res.error_code })
      continue
    }
    const patch: Record<string, unknown> = ragPatch(res.data, now)
    // A previous model's index (or one never recorded) may still use quota: clean it up once settled.
    if (row.rag_model !== model) patch.rag_cleanup_pending = true
    const { error } = await db.from('knowledge_documents').update(patch).eq('id', row.id).eq('org_id', orgId)
    if (error) log.error('knowledge.rag_state_write_failed', error, { docId: row.id })
    else updated++
  }
  return updated
}

/**
 * Called by the dashboard's document list: refreshes rows that are still
 * indexing or indexed for another model, at most once every 10 s per
 * organization (rag_checked_at) and within the status rate limit. Never
 * throws: the list must load even when the provider does not answer.
 */
export async function refreshRagForList(
  db: SupabaseClient,
  orgId: string,
  agentId: string,
  rows: ReadonlyArray<RagRow & { status?: string | null; deleting_at?: string | null }>,
  log: Logger,
  allow: () => Promise<boolean>,
): Promise<boolean> {
  try {
    const model = await agentEmbeddingModel(db, orgId, agentId)
    const cutoff = Date.now() - LIST_REFRESH_MIN_MS
    const due = rows.filter((r) => {
      if (!r.elevenlabs_doc_id || r.deleting_at || r.status !== 'ready') return false
      const needs = r.rag_model !== model || !r.rag_status || (RAG_PENDING_STATUSES as readonly string[]).includes(r.rag_status)
      const checked = r.rag_checked_at ? Date.parse(r.rag_checked_at) : 0
      return needs && (!Number.isFinite(checked) || checked < cutoff)
    })
    if (!due.length || !(await allow())) return false
    // The dashboard waits for this: one short attempt (maintenance catches up otherwise).
    return (await syncRagState(db, orgId, due, model, log, { fast: true })) > 0
  } catch (err) {
    log.warn('knowledge.rag_list_refresh_failed', { error: isProviderError(err) ? err.code : err instanceof Error ? err.message.slice(0, 120) : 'error' })
    return false
  }
}

/**
 * After a language change: (re)index every document (and imported website
 * page) of the organization for the agent's new embedding model. Runs after
 * the response; failures are logged and picked up by maintenance.
 */
export function scheduleKnowledgeReindex(agentId: string, log: Logger): void {
  deferBackground(
    reindexAgentKnowledge(agentId, log).catch((err: unknown) => log.error('knowledge.reindex_failed', err, { agentId })),
  )
}

export async function reindexAgentKnowledge(agentId: string, baseLog: Logger = createLogger()): Promise<{ documents: number; pages: number }> {
  const db = createAdminClient()
  const { data: agent, error: agentErr } = await db.from('agents').select(`id, org_id, ${AGENT_RAG_COLUMNS}`).eq('id', agentId).maybeSingle()
  if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
  if (!agent) return { documents: 0, pages: 0 }
  const orgId = agent.org_id as string
  const log = baseLog.child({ orgId, agentId, component: 'knowledge_rag' })
  const model = embeddingModelForAgentRow(agent)

  const { data: rows, error } = await db
    .from('knowledge_documents')
    .select('id, elevenlabs_doc_id, rag_status, rag_model, rag_checked_at')
    .eq('org_id', orgId)
    .eq('agent_id', agentId)
    .eq('status', 'ready')
    .not('elevenlabs_doc_id', 'is', null)
    .is('deleting_at', null)
  if (error) throw new Error(`knowledge_documents read failed: ${error.message}`)
  const documents = await syncRagState(db, orgId, (rows ?? []) as RagRow[], model, log)
  const pages = await reindexWebsitePages(db, orgId, agentId, model, log)
  log.info('knowledge.reindexed', { model, documents, pages })
  return { documents, pages }
}

/** Website imports: their pages live in the import's folder (no rows of ours). */
async function reindexWebsitePages(db: SupabaseClient, orgId: string, agentId: string, model: kb.EmbeddingModel, log: Logger): Promise<number> {
  const { data: crawls, error } = await db
    .from('knowledge_crawls')
    .select('id, root_folder_id, rag_model, max_pages')
    .eq('org_id', orgId)
    .eq('agent_id', agentId)
    .eq('status', 'succeeded')
    .not('root_folder_id', 'is', null)
  if (error) throw new Error(`knowledge_crawls read failed: ${error.message}`)
  let pages = 0
  for (const c of crawls ?? []) {
    if (c.rag_model === model) continue
    const state = await indexFolderPages(orgId, c.root_folder_id as string, Number(c.max_pages ?? 50), model, true)
    const { error: updErr } = await db
      .from('knowledge_crawls')
      .update({ ...state, rag_model: model, rag_cleanup_pending: true })
      .eq('id', c.id)
      .eq('org_id', orgId)
    if (updErr) log.error('knowledge.crawl_rag_write_failed', updErr, { crawlId: c.id })
    pages += state.page_ids.length
  }
  return pages
}

/**
 * Indexes (or reads) the pages of a website folder; returns an aggregate
 * state for the import's row: the least advanced status and the mean progress.
 */
export async function indexFolderPages(
  orgId: string,
  folderId: string,
  maxPages: number,
  model: kb.EmbeddingModel,
  create: boolean,
): Promise<{ rag_status: kb.RagIndexStatus | null; rag_progress: number | null; page_ids: string[] }> {
  const { documents } = await kb.listFolderDocuments(folderId, { types: ['url', 'file', 'text'], maxItems: Math.max(1, maxPages) }, { orgId })
  const ids = documents.map((d) => d.id)
  if (!ids.length) return { rag_status: null, rag_progress: null, page_ids: [] }
  const results = await kb.ragIndexBatch(ids.map((id) => ({ document_id: id, model, create_if_missing: create })), { orgId })
  const states: kb.RagIndexStatus[] = []
  let progress = 0
  for (const id of ids) {
    const r = results[id]
    if (r?.status !== 'success') continue
    states.push(r.data.status)
    progress += Number(r.data.progress_percentage) || 0
  }
  return { rag_status: aggregateRagStatus(states), rag_progress: states.length ? Math.round(progress / states.length) : null, page_ids: ids }
}

/** One status for many indexes: limit > failed > in progress > done. */
export function aggregateRagStatus(states: readonly kb.RagIndexStatus[]): kb.RagIndexStatus | null {
  if (!states.length) return null
  const order: kb.RagIndexStatus[] = ['rag_limit_exceeded', 'failed', 'new', 'created', 'processing', 'succeeded', 'document_too_small', 'cannot_index_folder']
  for (const s of order) if (states.includes(s)) return s
  return states[0]
}

/**
 * Deletes indexes of other embedding models once the current one settled
 * (they only use quota). Bounded per run; 404 means the document is gone.
 */
export async function cleanupOldRagIndexes(limit: number, log: Logger): Promise<{ checked: number; deleted: number }> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('knowledge_documents')
    .select('id, org_id, elevenlabs_doc_id, rag_model, rag_status')
    .eq('rag_cleanup_pending', true)
    .in('rag_status', ['succeeded', 'document_too_small'])
    .not('elevenlabs_doc_id', 'is', null)
    .is('deleting_at', null)
    .limit(limit)
  if (error) throw new Error(`knowledge_documents cleanup scan failed: ${error.message}`)
  let deleted = 0
  for (const d of data ?? []) {
    const ctx = { orgId: d.org_id as string }
    try {
      const { indexes } = await kb.ragIndexes(d.elevenlabs_doc_id as string, ctx)
      for (const idx of indexes ?? []) {
        if (idx.model === d.rag_model) continue
        await kb.deleteRagIndex(d.elevenlabs_doc_id as string, idx.id, ctx)
        deleted++
      }
    } catch (err) {
      if (!(isProviderError(err) && err.code === 'not_found')) {
        log.warn('knowledge.rag_cleanup_failed', { docId: d.id, error: isProviderError(err) ? err.code : 'error' })
        continue
      }
    }
    const { error: updErr } = await db.from('knowledge_documents').update({ rag_cleanup_pending: false }).eq('id', d.id).eq('org_id', d.org_id as string)
    if (updErr) log.error('knowledge.rag_cleanup_write_failed', updErr, { docId: d.id })
  }
  return { checked: data?.length ?? 0, deleted }
}

// ─── Workspace quota ─────────────────────────────────────────────────────────

const OVERVIEW_TTL_MS = 5 * 60_000
let overviewCache: { at: number; value: kb.RagIndexOverview } | null = null

/** Workspace RAG usage (cached). Platform-level information: never returned to tenants. */
export async function getRagOverview(maxAgeMs = OVERVIEW_TTL_MS): Promise<kb.RagIndexOverview> {
  if (overviewCache && maxAgeMs > 0 && Date.now() - overviewCache.at <= maxAgeMs) return overviewCache.value
  const value = await kb.ragOverview()
  overviewCache = { at: Date.now(), value }
  return value
}

/** Test hook. */
export function resetRagOverviewCache(): void {
  overviewCache = null
}

export const RAG_QUOTA_WARN_RATIO = 0.8
export const RAG_QUOTA_BLOCK_RATIO = 0.95

export function quotaRatio(o: Pick<kb.RagIndexOverview, 'total_used_bytes' | 'total_max_bytes'>): number | null {
  const max = Number(o.total_max_bytes)
  const used = Number(o.total_used_bytes)
  return Number.isFinite(max) && max > 0 && Number.isFinite(used) ? used / max : null
}

/**
 * Pauses new knowledge while the shared workspace is above 95 % of its RAG
 * quota (one tenant must not push every other tenant into
 * rag_limit_exceeded). Fails open when the overview cannot be read: the
 * per-organization byte budget still applies.
 */
export async function assertWorkspaceRagHeadroom(log: Logger): Promise<void> {
  let ratio: number | null = null
  try {
    ratio = quotaRatio(await getRagOverview())
  } catch (err) {
    log.warn('knowledge.rag_overview_unavailable', { error: isProviderError(err) ? err.code : 'error' })
    return
  }
  if (ratio !== null && ratio >= RAG_QUOTA_BLOCK_RATIO) {
    log.error('knowledge.rag_quota_blocking_uploads', undefined, { ratio: Math.round(ratio * 1000) / 1000 })
    throw new RequestError(
      'precondition_failed',
      'Adding knowledge is paused for a short while. Please try again later; our team has been notified.',
      503,
    )
  }
}
