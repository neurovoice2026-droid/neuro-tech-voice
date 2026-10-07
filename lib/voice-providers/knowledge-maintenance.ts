import 'server-only'
// Scheduled knowledge-base upkeep (one step of runVoiceMaintenance). Every
// sub-step is bounded and isolated: one failing never stops the others.
//   crawls       poll running website imports, finish interrupted deletes
//   reconcile    GET /summaries for attached documents: heal documents the
//                provider lost (re-upload from Storage), store sizes and
//                auto-sync state, refresh the fallback excerpt of URL pages
//                the provider re-fetched
//   rag          refresh indexing states (batch) and re-index for the agent's
//                current embedding model (language change)
//   rag_cleanup  delete indexes of other embedding models (quota)
//   folders      move root-level documents into their organization's folder
//   orphans      delete documents in an organization's folder no row knows
//   deletes      finish document deletes interrupted half-way
//   quota        workspace RAG usage: warn at 80 %, error at 95 %

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import * as kb from '@/lib/elevenlabs/api/knowledge'
import { ragEmbeddingModel } from '@/lib/elevenlabs/models'
import { createLogger, describeError, type Logger } from '@/lib/observability/logger'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { bumpRevision, providersFor, syncAgent } from './agent-sync'
import { maintainWebsiteImports } from './knowledge-crawl'
import { finishInterruptedDeletes, sweepOrphanDocuments } from './knowledge-delete'
import { moveRootDocumentsToFolders } from './knowledge-folders'
import {
  RAG_QUOTA_BLOCK_RATIO,
  RAG_QUOTA_WARN_RATIO,
  RAG_PENDING_STATUSES,
  cleanupOldRagIndexes,
  getRagOverview,
  indexFolderPages,
  quotaRatio,
  syncRagState,
} from './knowledge-rag'
import { MISSING_REMOTE_MESSAGE, summaryPatch } from './knowledge-reconcile'
import { EXCERPT_SOURCE_MAX_BYTES, excerptPatch, processDocument } from './knowledge'

const RECHECK_AFTER_MS = 20 * 3_600_000
const MAX_HEAL_REUPLOADS = 2
const MAX_EXCERPT_REFRESHES = 5

export async function runKnowledgeMaintenance(log: Logger = createLogger({ component: 'knowledge_maintenance' })) {
  const report: Record<string, unknown> = {}
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['crawls', () => maintainWebsiteImports(10, log)],
    ['reconcile', () => reconcileKnowledgeDocuments(300, log)],
    ['rag', () => refreshRagStates(300, log)],
    ['rag_cleanup', () => cleanupOldRagIndexes(20, log)],
    ['crawl_rag_cleanup', () => cleanupOldCrawlIndexes(2, log)],
    ['folders', () => moveRootDocumentsToFolders(100, log)],
    ['orphans', () => sweepOrphanDocuments(5, log)],
    ['deletes', () => finishInterruptedDeletes(10, log)],
    ['quota', () => checkWorkspaceQuota(log)],
  ]
  for (const [name, fn] of steps) {
    try {
      report[name] = await fn()
    } catch (err) {
      log.error('maintenance.knowledge_step_failed', err, { step: name })
      report[name] = { error: err instanceof Error ? err.message.slice(0, 200) : 'failed' }
    }
  }
  return report
}

interface ReconcileRow {
  id: string
  org_id: string
  agent_id: string
  type: string
  elevenlabs_doc_id: string
  auto_sync: boolean | null
  remote_updated_at: string | null
}

/** Attached documents, oldest check first: heal missing ones, store metadata, refresh re-synced excerpts. */
export async function reconcileKnowledgeDocuments(limit: number, log: Logger) {
  const db = createAdminClient()
  const cutoff = new Date(Date.now() - RECHECK_AFTER_MS).toISOString()
  const { data, error } = await db
    .from('knowledge_documents')
    .select('id, org_id, agent_id, type, elevenlabs_doc_id, auto_sync, remote_updated_at')
    .eq('status', 'ready')
    .not('elevenlabs_doc_id', 'is', null)
    .is('deleting_at', null)
    .or(`remote_checked_at.is.null,remote_checked_at.lt."${cutoff}"`)
    .order('remote_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw new Error(`knowledge_documents reconcile scan failed: ${error.message}`)
  const rows = (data ?? []) as unknown as ReconcileRow[]
  const byOrg = new Map<string, ReconcileRow[]>()
  for (const r of rows) byOrg.set(r.org_id, [...(byOrg.get(r.org_id) ?? []), r])

  const out = { checked: 0, missing: 0, reuploaded: 0, excerpts: 0, errors: 0 }
  const healedAgents = new Set<string>()
  const excerptAgents = new Set<string>()
  const healed: ReconcileRow[] = []
  for (const [orgId, list] of byOrg) {
    const orgLog = log.child({ orgId })
    let results: Record<string, kb.BatchResult<kb.KnowledgeSummary>>
    try {
      results = await kb.summaries(list.map((r) => r.elevenlabs_doc_id), { orgId })
    } catch (err) {
      out.errors++
      orgLog.warn('maintenance.knowledge_summaries_failed', { error: describeError(err) })
      continue
    }
    for (const r of list) {
      const res = results[r.elevenlabs_doc_id]
      out.checked++
      if (kb.isMissing(res)) {
        const { error: healErr } = await db
          .from('knowledge_documents')
          .update({ status: 'failed', error_message: MISSING_REMOTE_MESSAGE, elevenlabs_doc_id: null, attached_at: null, elevenlabs_folder_id: null, rag_status: null, rag_index_id: null })
          .eq('id', r.id)
          .eq('org_id', orgId)
          .eq('elevenlabs_doc_id', r.elevenlabs_doc_id)
        if (healErr) orgLog.error('maintenance.knowledge_heal_write_failed', healErr, { docId: r.id })
        else {
          out.missing++
          healed.push(r)
          healedAgents.add(r.agent_id)
          orgLog.warn('knowledge.remote_missing_detached', { docId: r.id })
        }
        continue
      }
      if (res?.status !== 'success') {
        out.errors++
        continue
      }
      const patch = summaryPatch(res.data, { includeSize: r.type === 'url' })
      // The provider re-fetched an auto-synced page since we last looked: refresh the fallback excerpt.
      const remoteUpdated = typeof patch.remote_updated_at === 'string' ? Date.parse(patch.remote_updated_at) : NaN
      const known = r.remote_updated_at ? Date.parse(r.remote_updated_at) : NaN
      if (r.type === 'url' && r.auto_sync && Number.isFinite(known) && remoteUpdated > known && out.excerpts < MAX_EXCERPT_REFRESHES) {
        try {
          const content = await kb.contentPrefix(r.elevenlabs_doc_id, { maxBytes: EXCERPT_SOURCE_MAX_BYTES }, { orgId, agentId: r.agent_id })
          Object.assign(patch, excerptPatch(content.text, content.truncated), { last_synced_at: new Date().toISOString() })
          out.excerpts++
          excerptAgents.add(r.agent_id)
        } catch (err) {
          orgLog.warn('maintenance.knowledge_excerpt_refresh_failed', { docId: r.id, error: describeError(err) })
        }
      }
      const { error: updErr } = await db.from('knowledge_documents').update(patch).eq('id', r.id).eq('org_id', orgId)
      if (updErr) orgLog.error('maintenance.knowledge_metadata_write_failed', updErr, { docId: r.id })
    }
  }

  // Stale locators out of the agents now; then re-add a few documents from their stored source.
  for (const agentId of healedAgents) {
    try {
      await bumpRevision(agentId)
      await syncAgent(agentId, { providers: ['elevenlabs'], log })
    } catch (err) {
      log.error('maintenance.knowledge_heal_sync_failed', err, { agentId })
    }
  }
  for (const r of healed.slice(0, MAX_HEAL_REUPLOADS)) {
    try {
      const doc = await processDocument(r.org_id, r.id, log, { mode: 'retry' })
      if (doc.status === 'ready') out.reuploaded++
    } catch (err) {
      log.error('maintenance.knowledge_reupload_failed', err, { docId: r.id, orgId: r.org_id })
    }
  }
  for (const agentId of excerptAgents) await syncFallbackProviders(createAdminClient(), agentId, log)
  return out
}

/** The fallback agent carries knowledge excerpts: re-sync it after they changed. */
async function syncFallbackProviders(db: SupabaseClient, agentId: string, log: Logger): Promise<void> {
  try {
    const providers = (await providersFor(db, agentId)).filter((p) => p !== 'elevenlabs')
    if (providers.length) await syncAgent(agentId, { providers, log })
  } catch (err) {
    log.error('maintenance.knowledge_fallback_sync_failed', err, { agentId })
  }
}

/** Indexing states (documents and website imports) for each agent's current embedding model. */
export async function refreshRagStates(limit: number, log: Logger) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('knowledge_documents')
    .select('id, org_id, agent_id, elevenlabs_doc_id, rag_status, rag_model, rag_checked_at')
    .eq('status', 'ready')
    .not('elevenlabs_doc_id', 'is', null)
    .is('deleting_at', null)
    .order('rag_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw new Error(`knowledge_documents rag scan failed: ${error.message}`)
  const { data: crawls, error: crawlErr } = await db
    .from('knowledge_crawls')
    .select('id, org_id, agent_id, root_folder_id, max_pages, rag_status, rag_model')
    .eq('status', 'succeeded')
    .not('root_folder_id', 'is', null)
    .limit(50)
  if (crawlErr) throw new Error(`knowledge_crawls rag scan failed: ${crawlErr.message}`)

  const agentIds = [...new Set([...(data ?? []).map((d) => d.agent_id as string), ...(crawls ?? []).map((c) => c.agent_id as string)])]
  if (!agentIds.length) return { documents: 0, websites: 0 }
  const { data: agents, error: agentErr } = await db.from('agents').select('id, org_id, language').in('id', agentIds)
  if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
  const modelOf = new Map((agents ?? []).map((a) => [a.id as string, ragEmbeddingModel(normalizeAgentLanguage(a.language as string | null))]))

  let documents = 0
  const byAgent = new Map<string, Array<Record<string, unknown>>>()
  for (const d of data ?? []) byAgent.set(d.agent_id as string, [...(byAgent.get(d.agent_id as string) ?? []), d])
  for (const [agentId, rows] of byAgent) {
    const model = modelOf.get(agentId)
    if (!model) continue
    const orgId = rows[0].org_id as string
    try {
      documents += await syncRagState(db, orgId, rows as unknown as Parameters<typeof syncRagState>[2], model, log.child({ orgId, agentId }))
    } catch (err) {
      log.warn('maintenance.knowledge_rag_failed', { agentId, error: describeError(err) })
    }
  }

  let websites = 0
  for (const c of crawls ?? []) {
    const model = modelOf.get(c.agent_id as string)
    if (!model) continue
    const pending = !c.rag_status || (RAG_PENDING_STATUSES as readonly string[]).includes(String(c.rag_status))
    const wrongModel = c.rag_model !== model
    if (!pending && !wrongModel) continue
    try {
      const state = await indexFolderPages(c.org_id as string, c.root_folder_id as string, Number(c.max_pages ?? 50), model, true)
      const { error: updErr } = await db
        .from('knowledge_crawls')
        .update({ rag_status: state.rag_status, rag_progress: state.rag_progress, rag_model: model, ...(wrongModel && c.rag_model ? { rag_cleanup_pending: true } : {}) })
        .eq('id', c.id)
        .eq('org_id', c.org_id as string)
      if (updErr) log.error('maintenance.knowledge_crawl_rag_write_failed', updErr, { crawlId: c.id })
      else websites++
    } catch (err) {
      log.warn('maintenance.knowledge_crawl_rag_failed', { crawlId: c.id, error: describeError(err) })
    }
  }
  return { documents, websites }
}

/** Website imports re-indexed for a new model: delete the old model's page indexes. */
export async function cleanupOldCrawlIndexes(limit: number, log: Logger) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('knowledge_crawls')
    .select('id, org_id, root_folder_id, max_pages, rag_model')
    .eq('status', 'succeeded')
    .eq('rag_cleanup_pending', true)
    .eq('rag_status', 'succeeded')
    .not('root_folder_id', 'is', null)
    .limit(limit)
  if (error) throw new Error(`knowledge_crawls cleanup scan failed: ${error.message}`)
  let deleted = 0
  for (const c of data ?? []) {
    const ctx = { orgId: c.org_id as string }
    try {
      const { documents } = await kb.listFolderDocuments(c.root_folder_id as string, { types: ['url', 'file', 'text'], maxItems: Number(c.max_pages ?? 50) }, ctx)
      for (const page of documents) {
        const { indexes } = await kb.ragIndexes(page.id, ctx)
        for (const idx of indexes ?? []) {
          if (idx.model === c.rag_model) continue
          await kb.deleteRagIndex(page.id, idx.id, ctx)
          deleted++
        }
      }
      const { error: updErr } = await db.from('knowledge_crawls').update({ rag_cleanup_pending: false }).eq('id', c.id).eq('org_id', c.org_id as string)
      if (updErr) log.error('maintenance.knowledge_crawl_cleanup_write_failed', updErr, { crawlId: c.id })
    } catch (err) {
      log.warn('maintenance.knowledge_crawl_cleanup_failed', { crawlId: c.id, error: describeError(err) })
    }
  }
  return { checked: data?.length ?? 0, deleted }
}

/** Workspace RAG usage vs the plan limit (platform-level; reported to logs and the cron report only). */
export async function checkWorkspaceQuota(log: Logger) {
  const overview = await getRagOverview(0)
  const ratio = quotaRatio(overview)
  const usedPct = ratio === null ? null : Math.round(ratio * 1000) / 10
  if (ratio !== null && ratio >= RAG_QUOTA_BLOCK_RATIO) log.error('knowledge.rag_quota_critical', undefined, { usedPct })
  else if (ratio !== null && ratio >= RAG_QUOTA_WARN_RATIO) log.warn('knowledge.rag_quota_high', { usedPct })
  return { used_pct: usedPct }
}
