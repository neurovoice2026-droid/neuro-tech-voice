import 'server-only'
import { ApiError } from '@/lib/api/http'
import { isSupabaseAdminConfigured } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { CLONE_MAX_BYTES, STT_MAX_BYTES } from '@/components/voice/voice-options'

// Private buckets for voice audio, service role only (no storage policies):
//   voice-clips       clone source recordings (consent evidence)
//   voice-previews    synthesised samples and greeting previews, cached by hash
//   voice-lab-uploads audio waiting to be transcribed; deleted right after
// Migration 011 creates the first two. When a bucket is missing (011 not yet
// applied, or voice-lab-uploads which 011 doesn't define) it is created here
// with the same private settings, so the features work either way.

export interface BucketSpec {
  id: string
  fileSizeLimit: number
  allowedMimeTypes: string[]
}

export const VOICE_BUCKETS = {
  clips: { id: 'voice-clips', fileSizeLimit: CLONE_MAX_BYTES, allowedMimeTypes: ['audio/*'] },
  previews: { id: 'voice-previews', fileSizeLimit: 2 * 1024 * 1024, allowedMimeTypes: ['audio/mpeg', 'audio/wav'] },
  labUploads: { id: 'voice-lab-uploads', fileSizeLimit: STT_MAX_BYTES, allowedMimeTypes: ['audio/*'] },
} satisfies Record<string, BucketSpec>

const ensured = new Set<string>()

interface StorageErrorLike {
  message?: string
  status?: number | string
  statusCode?: number | string
}

function errorText(error: unknown): string {
  const e = (error ?? {}) as StorageErrorLike
  return `${e.statusCode ?? e.status ?? ''} ${e.message ?? ''}`.trim()
}

function isBucketMissing(error: unknown): boolean {
  return /bucket not found|NoSuchBucket/i.test(errorText(error))
}

function isObjectMissing(error: unknown): boolean {
  const e = (error ?? {}) as StorageErrorLike
  return /not found|NoSuchKey|does not exist/i.test(errorText(error)) || e.status === 404 || e.statusCode === '404'
}

function isAlreadyExists(error: unknown): boolean {
  return /already exists|Duplicate|409/i.test(errorText(error))
}

export function requireStorage(): void {
  if (!isSupabaseAdminConfigured()) {
    throw new ApiError(503, 'not_configured', 'File storage is not configured on this server.')
  }
}

async function ensureBucket(spec: BucketSpec): Promise<void> {
  if (ensured.has(spec.id)) return
  const { error } = await createAdminClient().storage.createBucket(spec.id, {
    public: false,
    fileSizeLimit: spec.fileSizeLimit,
    allowedMimeTypes: spec.allowedMimeTypes,
  })
  if (error && !isAlreadyExists(error)) {
    console.error('[voices] creating storage bucket failed', spec.id, errorText(error))
    throw new ApiError(503, 'storage_unavailable', 'File storage isn’t ready yet. Please try again in a few minutes.')
  }
  if (!error) console.warn('[voices] created missing private storage bucket', spec.id)
  ensured.add(spec.id)
}

/** Runs a storage operation, creating the bucket once if it doesn't exist yet. */
async function withBucket<T extends { error: unknown }>(spec: BucketSpec, run: () => Promise<T>): Promise<T> {
  const first = await run()
  if (!first.error || !isBucketMissing(first.error)) return first
  await ensureBucket(spec)
  return run()
}

export interface SignedUpload {
  bucket: string
  path: string
  token: string
  signed_url: string
}

export async function createSignedUpload(spec: BucketSpec, path: string): Promise<SignedUpload> {
  requireStorage()
  const bucket = createAdminClient().storage.from(spec.id)
  const { data, error } = await withBucket(spec, () => bucket.createSignedUploadUrl(path))
  if (error || !data) {
    console.error('[voices] signed upload URL failed', spec.id, errorText(error))
    throw new ApiError(502, 'storage_error', 'We couldn’t prepare the upload. Please try again.')
  }
  return { bucket: spec.id, path: data.path, token: data.token, signed_url: data.signedUrl }
}

/** The object, or null when it doesn't exist (never uploaded, or already cleaned up). */
export async function downloadObject(spec: BucketSpec, path: string): Promise<Blob | null> {
  requireStorage()
  const { data, error } = await createAdminClient().storage.from(spec.id).download(path)
  if (!error) return data
  if (isBucketMissing(error) || isObjectMissing(error)) return null
  console.error('[voices] storage download failed', spec.id, errorText(error))
  throw new ApiError(502, 'storage_error', 'We couldn’t read the uploaded file. Please try again.')
}

/**
 * Best-effort cache read: a storage hiccup must not block a preview that can
 * still be generated, so failures are logged and reported as a miss.
 */
export async function readCachedObject(spec: BucketSpec, path: string): Promise<Blob | null> {
  if (!isSupabaseAdminConfigured()) return null
  try {
    const { data, error } = await createAdminClient().storage.from(spec.id).download(path)
    if (!error) return data
    if (!isBucketMissing(error) && !isObjectMissing(error)) {
      console.warn('[voices] preview cache read failed', spec.id, errorText(error))
    }
    return null
  } catch (error) {
    console.warn('[voices] preview cache read failed', spec.id, error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function uploadObject(spec: BucketSpec, path: string, body: Uint8Array, contentType: string): Promise<void> {
  requireStorage()
  const bucket = createAdminClient().storage.from(spec.id)
  const { error } = await withBucket(spec, () => bucket.upload(path, body, { contentType, upsert: true, cacheControl: '31536000' }))
  if (error) {
    console.error('[voices] storage upload failed', spec.id, errorText(error))
    throw new ApiError(502, 'storage_error', 'We couldn’t save the audio file. Please try again.')
  }
}

/** Cache writes never fail the request that produced the audio. */
export async function writeCachedObject(spec: BucketSpec, path: string, body: Uint8Array, contentType: string): Promise<void> {
  if (!isSupabaseAdminConfigured()) return
  try {
    await uploadObject(spec, path, body, contentType)
  } catch (error) {
    console.warn('[voices] preview cache write failed', spec.id, error instanceof ApiError ? error.code : String(error))
  }
}

/** Deletes objects; missing ones are fine. Errors are logged, not thrown (cleanup). */
export async function removeObjects(spec: BucketSpec, paths: string[]): Promise<boolean> {
  const list = paths.filter(Boolean)
  if (list.length === 0 || !isSupabaseAdminConfigured()) return list.length === 0
  try {
    const { error } = await createAdminClient().storage.from(spec.id).remove(list)
    if (error && !isBucketMissing(error) && !isObjectMissing(error)) {
      console.warn('[voices] storage cleanup failed', spec.id, errorText(error))
      return false
    }
    return true
  } catch (error) {
    console.warn('[voices] storage cleanup failed', spec.id, error instanceof Error ? error.message : String(error))
    return false
  }
}

const LIST_PAGE_SIZE = 1000
const MAX_LIST_ROUNDS = 20

/**
 * Deletes every object directly inside `folder` (cleanup; logged, not thrown).
 * Each round lists what is left and removes it, so paging needs no offsets.
 */
export async function removeFolder(spec: BucketSpec, folder: string): Promise<boolean> {
  if (!folder || !isSupabaseAdminConfigured()) return false
  const prefix = folder.replace(/\/+$/, '')
  try {
    const bucket = createAdminClient().storage.from(spec.id)
    for (let round = 0; round < MAX_LIST_ROUNDS; round++) {
      const { data, error } = await bucket.list(prefix, { limit: LIST_PAGE_SIZE })
      if (error) {
        if (isBucketMissing(error) || isObjectMissing(error)) return true
        console.warn('[voices] storage cleanup listing failed', spec.id, errorText(error))
        return false
      }
      // Sub-folders come back with a null id; this folder only ever holds files.
      const files = (data ?? []).filter((entry) => entry.id !== null && entry.name)
      if (files.length === 0) return true
      const removed = await removeObjects(spec, files.map((entry) => `${prefix}/${entry.name}`))
      if (!removed) return false
      if (files.length < LIST_PAGE_SIZE) return true
    }
    return true
  } catch (error) {
    console.warn('[voices] storage cleanup failed', spec.id, error instanceof Error ? error.message : String(error))
    return false
  }
}

/** First bytes of a blob, for magic-byte checks. */
export async function blobHead(blob: Blob, length = 16): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(0, length).arrayBuffer())
}
