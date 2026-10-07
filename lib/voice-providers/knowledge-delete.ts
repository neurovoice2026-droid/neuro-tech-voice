import 'server-only'
// Removing knowledge from the shared ElevenLabs workspace.
//
// deleteKnowledgeDocument: one document, in an order that never leaves a
// locator for a deleted document in the agent spec:
//   1. deleting_at is set (the spec leaves the row out) and the revision bumped;
//   2. the provider copy is deleted (force: also detached from the agent);
//      "not found" counts as done; any other failure clears deleting_at again;
//   3. the stored file, then the row; 4. the agent is re-synced.
// A row whose delete died half-way keeps deleting_at (still excluded) and is
// finished by maintenance (finishInterruptedDeletes).
//
// deleteAllOrgKnowledge: every provider copy of an organization (documents,
// website imports, the organization's folder), for account closure. Exported
// for the offboarding flow (lib/account/*, step delete_knowledge_copies). It
// must run while the database still holds the ids (before the organization
// row is deleted); failures are logged and reported, never abort the caller.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import * as kb from '@/lib/elevenlabs/api/knowledge'
import { RequestError } from '@/lib/api/http'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { bumpRevision, syncAgent } from './agent-sync'
import { isProviderError } from './errors'
import { KNOWLEDGE_BUCKET, isOrgStoragePath } from './knowledge'

export const PROVIDER_DELETE_FAILED = "The document could not be removed from your agent's voice provider. Please try again."
export const STORAGE_WARNING = 'The stored copy of the file could not be removed. It will not be used by your agent.'

export interface DeleteDocumentResult {
  warnings: string[]
  hadProviderDoc: boolean
}

/** A provider failure the route reports as 502 (the row is kept and can be deleted again). */
export class ProviderDeleteError extends Error {
  constructor(readonly cause: unknown) {
    super('provider delete failed')
    this.name = 'ProviderDeleteError'
  }
}

async function removeStoredObjects(db: SupabaseClient, orgId: string, paths: Array<string | null | undefined>, log: Logger): Promise<string[]> {
  const warnings: string[] = []
  const valid: string[] = []
  for (const p of paths) {
    if (!p) continue
    if (!isOrgStoragePath(orgId, p)) {
      log.error('agent.knowledge.storage_path_outside_org', undefined)
      warnings.push(STORAGE_WARNING)
      continue
    }
    valid.push(p)
  }
  if (valid.length) {
    const { error } = await db.storage.from(KNOWLEDGE_BUCKET).remove(valid)
    if (error) {
      log.error('agent.knowledge.storage_remove_failed', error)
      warnings.push(STORAGE_WARNING)
    }
  }
  return [...new Set(warnings)]
}

/** Deletes one document of the organization (see the ordering above). Throws RequestError 404 / ProviderDeleteError. */
export async function deleteKnowledgeDocument(orgId: string, docId: string, log: Logger): Promise<DeleteDocumentResult> {
  const db = createAdminClient()
  const { data: doc, error: readErr } = await db
    .from('knowledge_documents')
    .select('id, agent_id, storage_path, pending_storage_path, elevenlabs_doc_id, deleting_at')
    .eq('id', docId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (readErr) throw new Error(`knowledge_documents read failed: ${readErr.message}`)
  if (!doc) throw new RequestError('not_found', 'Document not found.', 404)
  const agentId = doc.agent_id as string
  const wasDeleting = !!doc.deleting_at

  // 1. Out of the agent spec before anything is removed upstream.
  if (!wasDeleting) {
    const { error } = await db.from('knowledge_documents').update({ deleting_at: new Date().toISOString() }).eq('id', docId).eq('org_id', orgId)
    if (error) throw new Error(`knowledge_documents mark failed: ${error.message}`)
  }
  try {
    await bumpRevision(agentId)
  } catch (err) {
    // The re-sync below still pushes the new config (its hash differs).
    log.error('agent.knowledge.revision_bump_failed', err)
  }

  // 2. Provider copy.
  const elDocId = doc.elevenlabs_doc_id as string | null
  if (elDocId) {
    try {
      await kb.deleteEntity(elDocId, true, { orgId, agentId })
    } catch (err) {
      if (isProviderError(err) && err.code === 'not_found') {
        log.info('agent.knowledge.remote_already_gone', { elevenlabsDocId: elDocId })
      } else {
        log.error('agent.knowledge.remote_delete_failed', err, { elevenlabsDocId: elDocId })
        if (!wasDeleting) {
          const { error } = await db.from('knowledge_documents').update({ deleting_at: null }).eq('id', docId).eq('org_id', orgId)
          if (error) log.error('agent.knowledge.unmark_failed', error)
          else await bumpRevision(agentId).catch((bumpErr: unknown) => log.error('agent.knowledge.revision_bump_failed', bumpErr))
        }
        throw new ProviderDeleteError(err)
      }
    }
  }

  // 3. Stored files (only ever inside the org's own folder), then the row.
  const warnings = await removeStoredObjects(db, orgId, [doc.storage_path as string | null, doc.pending_storage_path as string | null], log)
  const { error: deleteErr } = await db.from('knowledge_documents').delete().eq('id', docId).eq('org_id', orgId)
  if (deleteErr) throw new Error(`knowledge_documents delete failed: ${deleteErr.message}`)

  // 4. Agent config: the document is gone from the spec (and the fallback excerpt).
  deferBackground(
    syncAgent(agentId, { log })
      .then((results) => {
        for (const r of results) {
          if (r.status === 'failed' || r.status === 'degraded') {
            log.warn('agent.knowledge.delete_sync_unsuccessful', { provider: r.provider, status: r.status, errorCode: r.errorCode })
          }
        }
      })
      .catch((err: unknown) => log.error('agent.knowledge.delete_sync_failed', err)),
  )
  return { warnings, hadProviderDoc: !!elDocId }
}

/** Maintenance: completes deletes interrupted after step 1 (rows keep deleting_at). */
export async function finishInterruptedDeletes(limit: number, log: Logger): Promise<{ finished: number; failed: number }> {
  const db = createAdminClient()
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data, error } = await db.from('knowledge_documents').select('id, org_id').not('deleting_at', 'is', null).lt('deleting_at', cutoff).limit(limit)
  if (error) throw new Error(`knowledge_documents deleting scan failed: ${error.message}`)
  let finished = 0
  let failed = 0
  for (const d of data ?? []) {
    try {
      await deleteKnowledgeDocument(d.org_id as string, d.id as string, log.child({ orgId: d.org_id, docId: d.id }))
      finished++
    } catch (err) {
      failed++
      log.error('maintenance.knowledge_delete_failed', err instanceof ProviderDeleteError ? err.cause : err, { docId: d.id })
    }
  }
  return { finished, failed }
}

export interface OrgKnowledgeDeletion {
  documents: number
  websites: number
  folder: boolean
  deleted: number
  alreadyGone: number
  failed: number
}

/**
 * Deletes every provider copy of an organization's knowledge: running crawls
 * are cancelled, then documents, website folders and the organization's
 * folder are bulk-deleted (20 per call, force) — a per-id 404 counts as done.
 * Rows are marked deleting first so no sync re-attaches them; the database
 * rows themselves go with the organization (cascade). Never throws for
 * provider failures: they are logged and counted in `failed`.
 */
export async function deleteAllOrgKnowledge(orgId: string, baseLog: Logger = createLogger()): Promise<OrgKnowledgeDeletion> {
  const db = createAdminClient()
  const log = baseLog.child({ orgId, component: 'knowledge_delete' })
  const ctx = { orgId }
  const [{ data: docs, error: docErr }, { data: crawls, error: crawlErr }, { data: folder, error: folderErr }] = await Promise.all([
    db.from('knowledge_documents').select('id, elevenlabs_doc_id').eq('org_id', orgId),
    db.from('knowledge_crawls').select('id, status, crawl_job_id, root_folder_id').eq('org_id', orgId),
    db.from('knowledge_folders').select('folder_id').eq('org_id', orgId).maybeSingle(),
  ])
  if (docErr) throw new Error(`knowledge_documents read failed: ${docErr.message}`)
  if (crawlErr) throw new Error(`knowledge_crawls read failed: ${crawlErr.message}`)
  if (folderErr) throw new Error(`knowledge_folders read failed: ${folderErr.message}`)

  // Nothing may re-attach these while they are being removed.
  const now = new Date().toISOString()
  const { error: markErr } = await db.from('knowledge_documents').update({ deleting_at: now }).eq('org_id', orgId).is('deleting_at', null)
  if (markErr) log.error('knowledge.org_delete_mark_failed', markErr)
  const { error: markCrawlErr } = await db.from('knowledge_crawls').update({ status: 'deleting' }).eq('org_id', orgId)
  if (markCrawlErr) log.error('knowledge.org_delete_mark_crawls_failed', markCrawlErr)

  let failed = 0
  for (const c of crawls ?? []) {
    if (!c.crawl_job_id || !['starting', 'queued', 'processing'].includes(String(c.status))) continue
    try {
      await kb.cancelCrawl(c.crawl_job_id as string, ctx)
    } catch (err) {
      if (isProviderError(err) && err.code === 'not_found') continue
      failed++
      log.error('knowledge.org_delete_cancel_failed', err, { crawlId: c.id })
    }
  }

  // Documents first, then website folders, then the organization's folder (its subtree catches anything left).
  const docIds = (docs ?? []).map((d) => d.elevenlabs_doc_id as string | null).filter((v): v is string => !!v)
  const folderIds = (crawls ?? []).map((c) => c.root_folder_id as string | null).filter((v): v is string => !!v)
  const orgFolder = (folder?.folder_id as string | null | undefined) ?? null
  let deleted = 0
  let alreadyGone = 0
  for (const ids of [docIds, folderIds, orgFolder ? [orgFolder] : []]) {
    if (!ids.length) continue
    try {
      const results = await kb.bulkDelete(ids, true, ctx)
      for (const id of ids) {
        const r = results[id]
        if (r?.status === 'success') deleted++
        else if (kb.isMissing(r)) alreadyGone++
        else {
          failed++
          log.error('knowledge.org_delete_item_failed', undefined, { code: r?.status === 'failure' ? r.error_code : 'missing_result' })
        }
      }
    } catch (err) {
      failed += ids.length
      log.error('knowledge.org_delete_batch_failed', err, { count: ids.length })
    }
  }
  if (orgFolder && failed === 0) {
    const { error } = await db.from('knowledge_folders').update({ folder_id: null }).eq('org_id', orgId).eq('folder_id', orgFolder)
    if (error) log.error('knowledge.org_delete_folder_forget_failed', error)
  }
  const report = { documents: docIds.length, websites: folderIds.length, folder: !!orgFolder, deleted, alreadyGone, failed }
  log.info('knowledge.org_deleted', report)
  return report
}

/** Bulk delete of provider documents of one organization (20 per call); 404 counts as deleted. */
export async function bulkDeleteRemote(orgId: string, ids: readonly string[], log: Logger): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = []
  const failed: string[] = []
  if (!ids.length) return { deleted, failed }
  try {
    const results = await kb.bulkDelete(ids, true, { orgId })
    for (const id of ids) {
      const r = results[id]
      if (r?.status === 'success' || kb.isMissing(r)) deleted.push(id)
      else failed.push(id)
    }
  } catch (err) {
    log.error('knowledge.bulk_delete_failed', err, { count: ids.length })
    failed.push(...ids)
  }
  return { deleted, failed }
}

/** Orphans younger than this may belong to an upload whose row is being written right now. */
const ORPHAN_MIN_AGE_MS = 60 * 60_000

/**
 * Maintenance: documents in an organization's folder that no row knows about
 * (an upload that timed out after the provider created it, a row deleted
 * while its provider delete failed) are deleted. Only direct children of the
 * organization's own folder older than an hour are considered; website
 * imports live in their own sub-folders and are never touched here.
 */
export async function sweepOrphanDocuments(orgLimit: number, log: Logger): Promise<{ orgs: number; orphans: number; deleted: number }> {
  const db = createAdminClient()
  const { data: folders, error } = await db
    .from('knowledge_folders')
    .select('org_id, folder_id')
    .not('folder_id', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(orgLimit)
  if (error) throw new Error(`knowledge_folders scan failed: ${error.message}`)
  let orphans = 0
  let deleted = 0
  for (const f of folders ?? []) {
    const orgId = f.org_id as string
    const orgLog = log.child({ orgId })
    try {
      const listed = await kb.listFolderDocuments(f.folder_id as string, { types: ['file', 'url', 'text'], maxItems: 500 }, { orgId })
      const direct = listed.documents.filter((d) => d.folder_parent_id === f.folder_id)
      const { data: rows, error: rowsErr } = await db.from('knowledge_documents').select('elevenlabs_doc_id').eq('org_id', orgId).not('elevenlabs_doc_id', 'is', null)
      if (rowsErr) throw new Error(`knowledge_documents read failed: ${rowsErr.message}`)
      const known = new Set((rows ?? []).map((r) => r.elevenlabs_doc_id as string))
      const cutoff = (Date.now() - ORPHAN_MIN_AGE_MS) / 1000
      const unknown = direct.filter((d) => !known.has(d.id) && Number(d.metadata?.created_at_unix_secs ?? Infinity) < cutoff).map((d) => d.id)
      orphans += unknown.length
      if (unknown.length) {
        const res = await bulkDeleteRemote(orgId, unknown, orgLog)
        deleted += res.deleted.length
        orgLog.warn('knowledge.orphans_deleted', { count: res.deleted.length, failed: res.failed.length })
      }
      // Rotate through organizations: the oldest-checked folder goes first next time.
      const { error: touchErr } = await db.from('knowledge_folders').update({ updated_at: new Date().toISOString() }).eq('org_id', orgId)
      if (touchErr) orgLog.error('knowledge.folder_touch_failed', touchErr)
    } catch (err) {
      orgLog.error('knowledge.orphan_sweep_failed', err)
    }
  }
  return { orgs: folders?.length ?? 0, orphans, deleted }
}
