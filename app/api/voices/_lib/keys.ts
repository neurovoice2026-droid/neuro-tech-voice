// Cache keys and storage paths. Pure (keys.test.ts): the same inputs must
// always land on the same key, or cached audio is regenerated and billed again.

import { createHash, randomUUID } from 'node:crypto'
import type { AudioFileFormat } from '@/components/voice/voice-options'

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export interface CatalogPageQuery {
  q: string | null
  gender: string | null
  language: string | null
  startingAfter: string | null
}

/** Normalised search text: case and surrounding/double spaces don't create new cache entries. */
export function normalizeQuery(q: string | null | undefined): string | null {
  const value = (q ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  return value || null
}

/** One upstream Cartesia /voices page (public catalogue only, shared by every org). */
export function catalogPageKey(query: CatalogPageQuery): string {
  const parts = [normalizeQuery(query.q), query.gender ?? null, query.language ?? null, query.startingAfter ?? null]
  return `voices:catalog:v1:${sha256(JSON.stringify(parts))}`
}

export function voiceMetaKey(voiceId: string): string {
  return `voices:meta:v1:${voiceId.toLowerCase()}`
}

export const ACCENTS_KEY = 'voices:accents:v1'

/** 1 → '1.00', null → '' so equal speeds always hash equally. */
export function speedKeyPart(speed: number | null | undefined): string {
  return typeof speed === 'number' && Number.isFinite(speed) ? speed.toFixed(2) : ''
}

/**
 * sha256(voice|model|language|speed|emotion|text) — the contract's preview
 * cache key. Text is kept exactly as synthesised (trimmed by the caller).
 */
export function previewCacheKey(input: {
  voiceId: string
  model: string
  language: string
  speed: number | null
  emotion: string | null
  text: string
}): string {
  return sha256(
    [
      input.voiceId.toLowerCase(),
      input.model,
      input.language.toLowerCase(),
      speedKeyPart(input.speed),
      input.emotion?.trim().toLowerCase() ?? '',
      input.text,
    ].join('|')
  )
}

/**
 * Object path of a synthesised sample in the voice-previews bucket. Samples of
 * the organisation's cloned voices live under `<org_id>/` so deleting the
 * account removes them; samples of public library voices are shared by everyone.
 */
export function sampleObjectPath(hash: string, orgId: string | null): string {
  const folder = `samples/${hash.slice(0, 2)}/${hash}.mp3`
  return orgId ? `${orgId}/${folder}` : folder
}

/**
 * Folder holding an organisation's spoken previews (greetings, pace checks)
 * in one voice. Grouped by voice so deleting a cloned voice can remove every
 * clip that was generated with it.
 */
export function textPreviewFolder(orgId: string, voiceId: string): string {
  return `${orgId}/text/${voiceId.toLowerCase()}`
}

export function textPreviewObjectPath(hash: string, orgId: string, voiceId: string): string {
  return `${textPreviewFolder(orgId, voiceId)}/${hash}.mp3`
}

/** `<org_id>/<uuid>.<ext>` for browser uploads to a private bucket. */
export function newUploadPath(orgId: string, format: AudioFileFormat): string {
  return `${orgId}/${randomUUID()}.${format}`
}

const UPLOAD_PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([a-z0-9]{3,4})$/

/**
 * Accepts only paths this API handed out for this organisation, so a caller
 * can't point the clone or transcription routes at another org's file.
 */
export function parseUploadPath(
  orgId: string,
  path: string,
  allowed: readonly AudioFileFormat[]
): { format: AudioFileFormat } | null {
  const match = UPLOAD_PATH.exec(path)
  if (!match) return null
  if (match[1] !== orgId.toLowerCase()) return null
  const format = match[3] as AudioFileFormat
  return allowed.includes(format) ? { format } : null
}
