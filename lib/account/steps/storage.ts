import 'server-only'
// delete_storage: every object under knowledge-documents/<org_id>/ (uploaded
// files, pasted texts, pending replacements). Only that prefix is listed, and
// every path is checked to start with it before removal, so another
// organization's folder can never be touched. Also run again a few hours
// after the job completed (a signed upload URL issued before the deletion
// stays valid for up to 2 hours): deleteOrgStorage is shared with that sweep.

import type { SupabaseClient } from '@supabase/supabase-js'
import { KNOWLEDGE_BUCKET } from '@/lib/voice-providers/knowledge'
import type { StepOutcome } from '../deletion-plan'
import type { StepContext } from '../job'
import { chunks } from './util'

const LIST_PAGE = 1000
const REMOVE_BATCH = 100
/** Files removed per call at most (a bigger folder continues on the next run). */
const MAX_FILES_PER_RUN = 5000
const MAX_DEPTH = 4

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function listFiles(db: SupabaseClient, orgId: string, max: number): Promise<string[] | null> {
  const root = orgId
  const files: string[] = []
  const folders: Array<{ path: string; depth: number }> = [{ path: root, depth: 0 }]
  while (folders.length && files.length < max) {
    const folder = folders.shift() as { path: string; depth: number }
    for (let offset = 0; files.length < max; offset += LIST_PAGE) {
      const { data, error } = await db.storage.from(KNOWLEDGE_BUCKET).list(folder.path, { limit: LIST_PAGE, offset })
      if (error) {
        if (/not found/i.test(error.message)) return null
        throw new Error(`storage list failed: ${error.message.slice(0, 120)}`)
      }
      for (const entry of data ?? []) {
        const path = `${folder.path}/${entry.name}`
        // Folders come back without an id.
        if (entry.id === null || entry.id === undefined) {
          if (folder.depth < MAX_DEPTH) folders.push({ path, depth: folder.depth + 1 })
        } else files.push(path)
      }
      if (!data || data.length < LIST_PAGE) break
    }
  }
  return files
}

/** Removes up to `max` objects under <orgId>/; returns how many and whether some are left. */
export async function deleteOrgStorage(db: SupabaseClient, orgId: string, max = MAX_FILES_PER_RUN): Promise<{ removed: number; more: boolean }> {
  if (!UUID.test(orgId)) throw new Error('deleteOrgStorage: invalid organization id')
  const listed = await listFiles(db, orgId, max)
  if (listed === null) return { removed: 0, more: false }
  const prefix = `${orgId}/`
  const paths = listed.filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).split('/').includes('..'))
  let removed = 0
  for (const batch of chunks(paths, REMOVE_BATCH)) {
    const { error } = await db.storage.from(KNOWLEDGE_BUCKET).remove(batch)
    if (error) throw new Error(`storage remove failed: ${error.message.slice(0, 120)}`)
    removed += batch.length
  }
  return { removed, more: listed.length >= max }
}

export async function deleteStorage(ctx: StepContext): Promise<StepOutcome> {
  const { removed, more } = await deleteOrgStorage(ctx.db, ctx.orgId)
  ctx.state.storage_removed = (ctx.state.storage_removed ?? 0) + removed
  const counts = { files_removed: ctx.state.storage_removed }
  return more ? { status: 'more', counts } : { status: 'done', counts }
}
