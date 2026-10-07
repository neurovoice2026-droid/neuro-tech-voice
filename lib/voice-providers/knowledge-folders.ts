import 'server-only'
// One ElevenLabs knowledge-base folder per organization. Every new document
// and website import of the organization is created inside it, so its copies
// in the shared workspace can be listed, swept and erased as a unit.
//
// Creation is lazy and race-safe: a lease on knowledge_folders (lock token +
// expiry, atomic UPDATE … WHERE free) lets exactly one request create the
// folder; before creating, an existing folder with our exact name is adopted
// (a create that succeeded upstream but whose id was never stored). When the
// folder cannot be obtained quickly, callers create the document at the
// workspace root instead (never blocking an upload); maintenance moves
// root-level documents into the folder later (moveRootDocumentsToFolders).

import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import * as el from '@/lib/elevenlabs/client'
import * as kb from '@/lib/elevenlabs/api/knowledge'
import type { Logger } from '@/lib/observability/logger'
import { isProviderError } from './errors'

const LEASE_MS = 60_000
const WAIT_ROUNDS = 3
const WAIT_MS = 1_000

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Folder name: environment-scoped, so staging and production never share one. */
export function orgFolderName(orgId: string): string {
  const env = (process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development').replace(/[^a-z0-9-]/gi, '').slice(0, 20) || 'env'
  return `ntv:${env}:org:${orgId}`
}

async function readFolderId(db: SupabaseClient, orgId: string): Promise<string | null> {
  const { data, error } = await db.from('knowledge_folders').select('folder_id').eq('org_id', orgId).maybeSingle()
  if (error) throw new Error(`knowledge_folders read failed: ${error.message}`)
  return (data?.folder_id as string | null | undefined) ?? null
}

/** The organization's folder id if it already exists (no provider call). */
export async function getOrgFolderId(orgId: string, db: SupabaseClient = createAdminClient()): Promise<string | null> {
  return readFolderId(db, orgId)
}

/** An existing root-level folder with exactly our name (created by a run whose DB write was lost). */
async function findExistingFolder(orgId: string, log: Logger): Promise<string | null> {
  const name = orgFolderName(orgId)
  const res = await kb.listDocuments({ search: name, types: ['folder'], page_size: 10 }, { orgId })
  const matches = (res?.documents ?? []).filter((d) => d.type === 'folder' && d.name === name && !d.folder_parent_id)
  if (matches.length > 1) log.warn('knowledge.folder_duplicates', { count: matches.length })
  return matches[0]?.id ?? null
}

/**
 * Returns the organization's folder id, creating the folder once if needed.
 * Never throws for provider trouble: null means "create at the root for now".
 */
export async function ensureOrgFolder(orgId: string, log: Logger, db: SupabaseClient = createAdminClient()): Promise<string | null> {
  const existing = await readFolderId(db, orgId)
  if (existing) return existing
  if (!el.isConfigured()) return null

  const { error: upsertErr } = await db
    .from('knowledge_folders')
    .upsert({ org_id: orgId, provider: 'elevenlabs' }, { onConflict: 'org_id', ignoreDuplicates: true })
  if (upsertErr) throw new Error(`knowledge_folders upsert failed: ${upsertErr.message}`)

  const token = crypto.randomUUID()
  const now = new Date()
  const { data: claimed, error: claimErr } = await db
    .from('knowledge_folders')
    .update({ lock_token: token, lock_expires_at: new Date(now.getTime() + LEASE_MS).toISOString() })
    .eq('org_id', orgId)
    .is('folder_id', null)
    .or(`lock_expires_at.is.null,lock_expires_at.lt."${now.toISOString()}"`)
    .select('org_id')
  if (claimErr) throw new Error(`knowledge_folders lease failed: ${claimErr.message}`)

  if (!claimed?.length) {
    // Another request is creating it: wait briefly, then fall back to the root.
    for (let i = 0; i < WAIT_ROUNDS; i++) {
      await sleep(WAIT_MS)
      const id = await readFolderId(db, orgId)
      if (id) return id
    }
    log.info('knowledge.folder_busy_using_root')
    return null
  }

  let folderId: string | null = null
  try {
    folderId = await findExistingFolder(orgId, log)
    if (folderId) log.warn('knowledge.folder_adopted', { folderId })
    else {
      const created = await kb.createFolder({ name: orgFolderName(orgId) }, { orgId })
      if (!created?.id) throw new Error('folder create returned no id')
      folderId = created.id
      log.info('knowledge.folder_created', { folderId })
    }
  } catch (err) {
    log.error('knowledge.folder_create_failed', err)
    folderId = null
  }

  const { error: writeErr } = await db
    .from('knowledge_folders')
    .update({ folder_id: folderId, lock_token: null, lock_expires_at: null })
    .eq('org_id', orgId)
    .eq('lock_token', token)
  if (writeErr) {
    // The folder exists upstream; the next call adopts it by name.
    log.error('knowledge.folder_write_failed', writeErr, { folderId })
  }
  return folderId
}

/**
 * Forgets a folder the provider no longer has (deleted out of band), so the
 * next ensureOrgFolder() creates a new one.
 */
export async function forgetOrgFolder(orgId: string, folderId: string, log: Logger, db: SupabaseClient = createAdminClient()): Promise<void> {
  const { error } = await db.from('knowledge_folders').update({ folder_id: null }).eq('org_id', orgId).eq('folder_id', folderId)
  if (error) log.error('knowledge.folder_forget_failed', error, { folderId })
  else log.warn('knowledge.folder_forgotten', { folderId })
}

/**
 * Migration path for documents created before per-organization folders
 * (and for uploads that fell back to the root): moves them into their
 * organization's folder, 20 per call. Idempotent: moving a document that is
 * already in the folder changes nothing; a document the provider no longer
 * has is left for the reconcile step (it heals missing documents).
 */
export async function moveRootDocumentsToFolders(limit: number, log: Logger): Promise<{ moved: number; orgs: number; failed: number }> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('knowledge_documents')
    .select('id, org_id, elevenlabs_doc_id')
    .not('elevenlabs_doc_id', 'is', null)
    .is('elevenlabs_folder_id', null)
    .is('deleting_at', null)
    .limit(limit)
  if (error) throw new Error(`knowledge_documents root scan failed: ${error.message}`)
  const byOrg = new Map<string, Array<{ id: string; elId: string }>>()
  for (const d of data ?? []) {
    const list = byOrg.get(d.org_id as string) ?? []
    list.push({ id: d.id as string, elId: d.elevenlabs_doc_id as string })
    byOrg.set(d.org_id as string, list)
  }
  let moved = 0
  let failed = 0
  for (const [orgId, docs] of byOrg) {
    const orgLog = log.child({ orgId })
    const folderId = await ensureOrgFolder(orgId, orgLog, db)
    if (!folderId) continue
    for (let i = 0; i < docs.length; i += kb.KB_LIMITS.bulkMovePerCall) {
      const part = docs.slice(i, i + kb.KB_LIMITS.bulkMovePerCall)
      let movedIds: string[] = []
      try {
        await kb.bulkMove(part.map((d) => d.elId), folderId, { orgId })
        movedIds = part.map((d) => d.id)
      } catch (err) {
        // One missing id can fail the whole batch: move one by one instead.
        orgLog.warn('knowledge.bulk_move_failed', { error: isProviderError(err) ? err.code : 'error', count: part.length })
        for (const d of part) {
          try {
            await kb.moveDocument(d.elId, folderId, { orgId })
            movedIds.push(d.id)
          } catch (moveErr) {
            failed++
            orgLog.warn('knowledge.move_failed', { docId: d.id, error: isProviderError(moveErr) ? moveErr.code : 'error' })
          }
        }
      }
      if (movedIds.length) {
        const { error: updErr } = await db
          .from('knowledge_documents')
          .update({ elevenlabs_folder_id: folderId })
          .eq('org_id', orgId)
          .in('id', movedIds)
        if (updErr) orgLog.error('knowledge.move_write_failed', updErr)
        else moved += movedIds.length
      }
    }
  }
  return { moved, orgs: byOrg.size, failed }
}
