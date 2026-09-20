import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, parseJson } from '@/lib/api/http'
import { requireOrgContext, type OrgContext } from '@/lib/api/auth'
import { cartesia } from '@/lib/cartesia/client'
import { kvDel, kvIncr } from '@/lib/kv'
import { sha256Hex } from '@/lib/security/crypto'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordProviderUsage } from '@/lib/voice/budget'
import {
  AUDIO_CONTENT_TYPES,
  CLONE_AUDIO_FORMATS,
  CLONE_MAX_BYTES,
  CLONE_MIN_SECONDS,
  CLONE_NAME_MAX,
  consentStatement,
  formatBytes,
  VOICE_LANGUAGE_CODES,
} from '@/components/voice/voice-options'
import { detectAudioFormat, wavDurationSeconds } from '../_lib/audio-format'
import { CLONE_COLUMNS, listAccents, type CloneRecord } from '../_lib/catalog'
import { addElevenLabsClone, deleteElevenLabsVoice } from '../_lib/elevenlabs-voices'
import { cloneToVoice } from '../_lib/filters'
import { parseUploadPath } from '../_lib/keys'
import { downloadObject, removeObjects, requireStorage, VOICE_BUCKETS } from '../_lib/storage'
import { requireCartesia, toVoiceApiError } from '../_lib/synthesis'
import { requireCloneSlot, requireCloningEntitlement } from './_lib/guards'

export const runtime = 'nodejs'
// Download from storage + Cartesia's clone call (up to 60 s).
export const maxDuration = 90

// POST /api/voices/clone { storage_path, name, language, accent?, gender?, consent, consent_statement }
// Creates a private Cartesia instant clone from a recording the browser has
// already uploaded (see ./upload-url). The consent statement the owner agreed
// to is stored with the clone together with who agreed and when.
//
// The uploaded recording is kept only as the consent evidence of a voice that
// exists: when no voice comes out of this request it is deleted (the browser
// uploads again on retry), so abandoned attempts don't leave people's voices
// in storage.

const bodySchema = z.object({
  storage_path: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1, 'Please give the voice a name').max(CLONE_NAME_MAX),
  language: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => VOICE_LANGUAGE_CODES.includes(value), 'Unsupported language'),
  accent: z.string().trim().max(48).regex(/^[a-z0-9-]+$/, 'Invalid accent').nullish(),
  gender: z.enum(['masculine', 'feminine', 'gender_neutral']).nullish(),
  consent: z.union([z.literal(true), z.literal('true')], { message: 'Please confirm you have permission to clone this voice' }),
  consent_statement: z.string().trim().min(1).max(1000),
})

type CloneBody = z.infer<typeof bodySchema>

// Covers the download, Cartesia's 60 s clone call and the insert.
const LOCK_TTL_SECONDS = 120

function cleanFileName(name: string): string {
  return name.normalize('NFD').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'voice'
}

/** The organisation's clone made from this upload, if any (any status when `anyStatus`). */
async function findCloneByUpload(ctx: OrgContext, storagePath: string, anyStatus = false): Promise<CloneRecord | null | 'unknown'> {
  let query = ctx.supabase
    .from('voice_clones')
    .select(CLONE_COLUMNS)
    .eq('org_id', ctx.org.id)
    .eq('source_storage_path', storagePath)
  if (!anyStatus) query = query.eq('status', 'ready')
  const { data, error } = await query.limit(1).maybeSingle()
  if (error) {
    console.error('[voices] clone lookup by upload failed', error.code, error.message)
    return 'unknown'
  }
  return (data as unknown as CloneRecord | null) ?? null
}

async function discardUnusedUpload(ctx: OrgContext, storagePath: string): Promise<void> {
  const owner = await findCloneByUpload(ctx, storagePath, true)
  // Never delete a recording a voice points at, or when that can't be checked.
  if (owner !== null) return
  await removeObjects(VOICE_BUCKETS.clips, [storagePath])
}

async function createClone(ctx: OrgContext, body: CloneBody): Promise<Response> {
  if (body.consent_statement !== consentStatement(body.name)) {
    throw new ApiError(400, 'consent_mismatch', 'Please read and confirm the consent statement for this voice name again.')
  }

  await enforceRateLimit(RATE_LIMITS.voiceClone, ctx.org.id)
  await requireCloneSlot(ctx)

  if (body.accent) {
    const accents = await listAccents(body.language).catch((error: unknown) => {
      throw toVoiceApiError(error, 'clone')
    })
    if (!accents.some((accent) => accent.id === body.accent)) {
      throw new ApiError(400, 'invalid_accent', 'That accent isn’t available for the selected language.')
    }
  }

  const stored = await downloadObject(VOICE_BUCKETS.clips, body.storage_path)
  if (!stored) throw new ApiError(404, 'upload_not_found', 'We couldn’t find the uploaded recording. Please upload it again.')
  if (stored.size === 0 || stored.size > CLONE_MAX_BYTES) {
    throw new ApiError(413, 'file_too_large', `Recordings can be up to ${formatBytes(CLONE_MAX_BYTES)}. Please use a shorter clip.`)
  }

  const bytes = new Uint8Array(await stored.arrayBuffer())
  const format = detectAudioFormat(bytes.subarray(0, 16))
  if (!format || !CLONE_AUDIO_FORMATS.includes(format)) {
    throw new ApiError(415, 'unsupported_audio_format', 'This file isn’t a WAV, MP3, OGG, WebM or FLAC recording.')
  }
  if (format === 'wav') {
    const seconds = wavDurationSeconds(bytes)
    if (seconds !== null && seconds < CLONE_MIN_SECONDS) {
      throw new ApiError(422, 'clip_too_short', `Recordings need at least ${CLONE_MIN_SECONDS} seconds of speech.`)
    }
  }

  const clip = new Blob([bytes], { type: AUDIO_CONTENT_TYPES[format] })
  const filename = `${cleanFileName(body.name)}.${format}`

  let cartesiaVoiceId: string
  try {
    const created = await cartesia.voices.clone({
      clip,
      filename,
      name: body.name,
      language: body.language,
      accent: body.accent ?? undefined,
      description: `Cloned voice for organization ${ctx.org.id}`,
    })
    cartesiaVoiceId = created.id
  } catch (error) {
    throw toVoiceApiError(error, 'clone')
  }

  const admin = createAdminClient()
  const { data: row, error: insertError } = await admin
    .from('voice_clones')
    .insert({
      org_id: ctx.org.id,
      cartesia_voice_id: cartesiaVoiceId,
      name: body.name,
      language: body.language,
      accent: body.accent ?? null,
      gender: body.gender ?? null,
      source_storage_path: body.storage_path,
      consent_attested_by: ctx.user.id,
      consent_attested_at: new Date().toISOString(),
      consent_statement: body.consent_statement,
      status: 'ready',
    })
    .select(CLONE_COLUMNS)
    .single()

  if (insertError || !row) {
    console.error('[voices] saving clone failed; removing it at Cartesia', insertError?.code, insertError?.message)
    // Without a consent record the voice must not exist.
    await cartesia.voices.delete(cartesiaVoiceId).catch((error: unknown) => {
      console.error('[cartesia] orphan clone could not be deleted', cartesiaVoiceId, error instanceof Error ? error.message : error)
    })
    throw new ApiError(500, 'internal_error', 'We couldn’t save your new voice. Nothing was created; please try again.')
  }
  const clone = row as unknown as CloneRecord

  after(async () => {
    await recordProviderUsage([
      {
        provider: 'cartesia',
        kind: 'clone',
        quantity: 1,
        credits: 0,
        org_id: ctx.org.id,
        meta: { voice_id: cartesiaVoiceId, language: body.language, bytes: stored.size, format },
      },
    ])
    const elevenLabsVoiceId = await addElevenLabsClone({
      name: body.name,
      clip,
      filename,
      description: `Fallback twin of Cartesia voice ${cartesiaVoiceId}`,
    })
    if (!elevenLabsVoiceId) return
    const { data: updated, error } = await admin
      .from('voice_clones')
      .update({ elevenlabs_voice_id: elevenLabsVoiceId })
      .eq('org_id', ctx.org.id)
      .eq('id', clone.id)
      .eq('status', 'ready')
      .select('id')
    if (error) {
      console.error('[voices] storing the ElevenLabs twin id failed', error.code, error.message)
    }
    // Not stored (the owner deleted the voice meanwhile, or the write failed):
    // a twin nobody can find again must not keep the person's voice.
    if (error || !updated || updated.length === 0) await deleteElevenLabsVoice(elevenLabsVoiceId)
  })

  return NextResponse.json({ voice: cloneToVoice(clone) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}

export const POST = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  requireCloningEntitlement(ctx)
  const body = await parseJson(req, bodySchema)
  requireCartesia()
  requireStorage()

  // Only paths this API issued to this organisation are ever read or deleted.
  const upload = parseUploadPath(ctx.org.id, body.storage_path, CLONE_AUDIO_FORMATS)
  if (!upload) throw new ApiError(400, 'invalid_upload', 'This upload isn’t valid. Please upload the recording again.')

  // A repeat for a recording that already became a voice (a retry after a
  // lost response) returns that voice instead of cloning it twice.
  const existing = await findCloneByUpload(ctx, body.storage_path)
  if (existing && existing !== 'unknown') {
    return NextResponse.json({ voice: cloneToVoice(existing) }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  }

  const lockKey = `voices:clone-lock:${sha256Hex(`${ctx.org.id}|${body.storage_path}`)}`
  if ((await kvIncr(lockKey, LOCK_TTL_SECONDS)) > 1) {
    throw new ApiError(409, 'clone_in_progress', 'This voice is already being created. Please wait a moment.')
  }
  try {
    return await createClone(ctx, body)
  } catch (error) {
    await discardUnusedUpload(ctx, body.storage_path)
    throw error
  } finally {
    await kvDel(lockKey)
  }
})
