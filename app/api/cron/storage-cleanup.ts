import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

// Daily removal of uploads nothing will ever use. They appear when a browser
// uploads a file straight to storage and is closed before the app registers it
// (Voice Lab transcription, a voice clone recording, a knowledge document), or
// when a transcription failed and was never retried. Every bucket is laid out
// as <org_id>/..., so the walk goes org folder by org folder and stops at the
// deadline; whatever is left is picked up by the next run.

/** Old enough that no upload still in progress can be touched. */
export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000
const LIST_PAGE = 1000
const REMOVE_BATCH = 100
const LOOKUP_BATCH = 100
const MAX_FILES_PER_BUCKET = 5000

export interface StorageFile {
  path: string
  createdAt: string | null
}

/** Files older than the cutoff. Files without a timestamp are left alone. */
export function olderThan(files: StorageFile[], cutoffMs: number): StorageFile[] {
  return files.filter((file) => {
    const created = file.createdAt ? Date.parse(file.createdAt) : Number.NaN
    return Number.isFinite(created) && created < cutoffMs
  })
}

/** Knowledge files a document row doesn't point at. Extracted text is removed with its document. */
export function unreferencedKnowledgeFiles(files: StorageFile[], referenced: Set<string>): StorageFile[] {
  return files.filter((file) => !referenced.has(file.path) && !file.path.split('/').includes('extracted'))
}

async function listFiles(admin: SupabaseClient, bucket: string, deadline: number): Promise<StorageFile[] | null> {
  const files: StorageFile[] = []
  const folders = ['']
  while (folders.length > 0 && files.length < MAX_FILES_PER_BUCKET && Date.now() < deadline) {
    const folder = folders.shift() as string
    for (let offset = 0; ; offset += LIST_PAGE) {
      const { data, error } = await admin.storage.from(bucket).list(folder, { limit: LIST_PAGE, offset })
      if (error) {
        // A bucket created later (migration 011 or first use) simply has nothing to clean yet.
        if (/not found/i.test(error.message)) return null
        throw new Error(`listing ${bucket} failed: ${error.message.slice(0, 120)}`)
      }
      for (const entry of data ?? []) {
        const path = folder ? `${folder}/${entry.name}` : entry.name
        // Folders come back without an id.
        if (entry.id === null) folders.push(path)
        else files.push({ path, createdAt: entry.created_at ?? null })
      }
      if (!data || data.length < LIST_PAGE) break
    }
  }
  return files
}

async function removeFiles(admin: SupabaseClient, bucket: string, paths: string[]): Promise<number> {
  let removed = 0
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const batch = paths.slice(i, i + REMOVE_BATCH)
    const { error } = await admin.storage.from(bucket).remove(batch)
    if (error) throw new Error(`removing from ${bucket} failed: ${error.message.slice(0, 120)}`)
    removed += batch.length
  }
  return removed
}

/** Paths among `paths` that a row of `table` still stores in `column`. */
async function referencedPaths(admin: SupabaseClient, table: string, column: string, paths: string[]): Promise<Set<string> | null> {
  const found = new Set<string>()
  for (let i = 0; i < paths.length; i += LOOKUP_BATCH) {
    const { data, error } = await admin.from(table).select(column).in(column, paths.slice(i, i + LOOKUP_BATCH))
    if (error) {
      // Table missing (migration not applied): don't guess, keep everything.
      if (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703') return null
      throw new Error(`${table} lookup failed: ${error.message.slice(0, 120)}`)
    }
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const value = row[column]
      if (typeof value === 'string') found.add(value)
    }
  }
  return found
}

export interface StorageCleanupResult {
  voice_lab_uploads: number
  voice_clips: number
  knowledge_documents: number
  incomplete: boolean
}

export async function purgeOrphanUploads(now: Date, opts: { deadline: number }): Promise<StorageCleanupResult> {
  const admin = createAdminClient()
  const cutoff = now.getTime() - ORPHAN_MIN_AGE_MS
  const result: StorageCleanupResult = { voice_lab_uploads: 0, voice_clips: 0, knowledge_documents: 0, incomplete: false }

  // Transcription uploads are deleted after use, so anything a day old is left over.
  const labFiles = await listFiles(admin, 'voice-lab-uploads', opts.deadline)
  if (labFiles) result.voice_lab_uploads = await removeFiles(admin, 'voice-lab-uploads', olderThan(labFiles, cutoff).map((f) => f.path))

  if (Date.now() < opts.deadline) {
    const clipFiles = await listFiles(admin, 'voice-clips', opts.deadline)
    const oldClips = clipFiles ? olderThan(clipFiles, cutoff) : []
    if (oldClips.length > 0) {
      const kept = await referencedPaths(admin, 'voice_clones', 'source_storage_path', oldClips.map((f) => f.path))
      if (kept) {
        result.voice_clips = await removeFiles(admin, 'voice-clips', oldClips.filter((f) => !kept.has(f.path)).map((f) => f.path))
      }
    }
  } else {
    result.incomplete = true
  }

  if (Date.now() < opts.deadline) {
    const docFiles = await listFiles(admin, 'knowledge-documents', opts.deadline)
    const oldDocs = docFiles ? olderThan(docFiles, cutoff).filter((f) => !f.path.split('/').includes('extracted')) : []
    if (oldDocs.length > 0) {
      const kept = await referencedPaths(admin, 'knowledge_documents', 'storage_path', oldDocs.map((f) => f.path))
      if (kept) {
        const orphans = unreferencedKnowledgeFiles(oldDocs, kept)
        result.knowledge_documents = await removeFiles(admin, 'knowledge-documents', orphans.map((f) => f.path))
      }
    }
  } else {
    result.incomplete = true
  }

  if (Date.now() >= opts.deadline) result.incomplete = true
  return result
}
