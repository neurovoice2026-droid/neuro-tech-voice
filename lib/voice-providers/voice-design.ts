import 'server-only'
// Voice Design: a tenant describes a voice, gets 3 previews, saves one as its
// own custom voice (owner_org_id = org, source 'designed').
//
// • POST /v1/text-to-voice/design (model ELEVENLABS_VOICE_DESIGN_MODEL,
//   default eleven_multilingual_ttv_v2: the spec default, Romanian listed by
//   the models page). Previews come back inline (base64 MP3). Reference audio
//   is never sent: voice-sample based generation is legally a clone.
// • Each generated_voice_id is recorded in voice_design_previews for the org
//   (1 h). Saving claims that row atomically: a voice is only ever created from
//   a preview THIS org received, never from an arbitrary id.
// • POST /v1/text-to-voice creates the workspace voice (uses a custom voice
//   slot): plan gate, per-org cap (counted with clones), workspace capacity
//   preflight, compensating delete when the registry write fails.
// Every design call costs credits: rate-limited per org (routes).

import crypto from 'crypto'
import { RequestError } from '@/lib/api/http'
import { VOICE_DESIGN_MODELS, createVoiceFromPreview, designVoice, type ELVoicePreview, type VoiceDesignModel } from '@/lib/elevenlabs/api/voices'
import * as el from '@/lib/elevenlabs/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import type { RateLimitRule } from '@/lib/security/rate-limit'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import type { VoiceOption } from '@/types'
import { ProviderError, isProviderError } from './errors'
import { capViolationAfterInsert } from './voice-capacity'
import { EL_VOICE_ID_RE, cleanText, defaultPreviewText, discardCustomVoice, platformVoiceDescription, platformVoiceName, writeAudit } from './voice-catalog'

export const VOICE_DESIGN_RATE_LIMITS: { burst: RateLimitRule; daily: RateLimitRule; save: RateLimitRule } = {
  burst: { name: 'voice_design_burst', limit: 3, windowSeconds: 60 },
  daily: { name: 'voice_design', limit: 10, windowSeconds: 86_400 },
  save: { name: 'voice_design_save', limit: 5, windowSeconds: 86_400 },
}

export const DESIGN_DESCRIPTION = { min: 20, max: 1000 } as const
export const DESIGN_TEXT = { min: 100, max: 1000 } as const
const PREVIEW_TTL_MS = 60 * 60_000
const MAX_PREVIEWS = 3
/** Bound per preview (base64 of ~30 s of 32 kbps MP3 is ~160 KB). */
const MAX_PREVIEW_BASE64 = 1_500_000
const GENERATED_ID_RE = /^[A-Za-z0-9_-]{6,128}$/
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

/** ELEVENLABS_VOICE_DESIGN_MODEL: eleven_multilingual_ttv_v2 (default) or eleven_ttv_v3. */
export function voiceDesignModel(): VoiceDesignModel {
  const v = (process.env.ELEVENLABS_VOICE_DESIGN_MODEL ?? '').trim()
  return (VOICE_DESIGN_MODELS as readonly string[]).includes(v) ? (v as VoiceDesignModel) : 'eleven_multilingual_ttv_v2'
}

// A second receptionist sentence, so the preview text reaches the 100
// characters the endpoint requires (VoiceDesignRequestModel.text 100–1000).
const DESIGN_EXTRA: Record<string, string> = {
  en: 'We are open Monday to Friday from nine to six. Would you like me to book an appointment for you?',
  ro: 'Suntem deschiși de luni până vineri, între orele nouă și optsprezece. Doriți să vă fac o programare?',
  es: 'Abrimos de lunes a viernes, de nueve a seis. ¿Quiere que le reserve una cita?',
  fr: 'Nous sommes ouverts du lundi au vendredi, de neuf heures à dix-huit heures. Souhaitez-vous prendre rendez-vous ?',
  de: 'Wir haben montags bis freitags von neun bis achtzehn Uhr geöffnet. Möchten Sie einen Termin vereinbaren?',
  it: 'Siamo aperti dal lunedì al venerdì, dalle nove alle diciotto. Desidera prenotare un appuntamento?',
  pt: 'Estamos abertos de segunda a sexta, das nove às dezoito. Quer que eu marque uma consulta?',
  pl: 'Jesteśmy otwarci od poniedziałku do piątku, od dziewiątej do osiemnastej. Czy umówić Państwa na wizytę?',
  nl: 'Wij zijn geopend van maandag tot en met vrijdag, van negen tot zes. Zal ik een afspraak voor u maken?',
  ja: '営業時間は月曜日から金曜日の午前九時から午後六時までです。ご予約をお取りしましょうか？担当者がすぐに対応いたします。お気軽にお申し付けください。',
  ko: '저희는 월요일부터 금요일까지 오전 아홉 시부터 오후 여섯 시까지 영업합니다. 예약을 도와드릴까요? 궁금하신 점이 있으시면 언제든지 말씀해 주세요.',
  zh: '我们的营业时间是周一至周五，上午九点到下午六点。需要我为您预约吗？如果您有任何问题，请随时告诉我，我很乐意为您提供帮助。',
  ar: 'نحن نعمل من الاثنين إلى الجمعة من التاسعة صباحًا حتى السادسة مساءً. هل تريد أن أحجز لك موعدًا؟',
  hi: 'हम सोमवार से शुक्रवार, सुबह नौ बजे से शाम छह बजे तक खुले रहते हैं। क्या मैं आपके लिए अपॉइंटमेंट बुक कर दूँ?',
}

/** Localized preview text of at least 100 characters (the endpoint's minimum). */
export function designPreviewText(language: string | null | undefined): string {
  const lang = normalizeAgentLanguage(language)
  let text = `${defaultPreviewText(lang)} ${DESIGN_EXTRA[lang] ?? DESIGN_EXTRA.en}`.trim()
  while (Array.from(text).length < DESIGN_TEXT.min) text = `${text} ${DESIGN_EXTRA[lang] ?? DESIGN_EXTRA.en}`
  return Array.from(text).slice(0, DESIGN_TEXT.max).join('')
}

export interface DesignPreview {
  generated_voice_id: string
  audio_base_64: string
  media_type: 'audio/mpeg'
  duration_secs: number | null
}

function validPreview(p: ELVoicePreview): DesignPreview | null {
  if (!p || typeof p.generated_voice_id !== 'string' || !GENERATED_ID_RE.test(p.generated_voice_id)) return null
  if (typeof p.audio_base_64 !== 'string' || p.audio_base_64.length === 0 || p.audio_base_64.length > MAX_PREVIEW_BASE64 || !BASE64_RE.test(p.audio_base_64)) return null
  return {
    generated_voice_id: p.generated_voice_id,
    audio_base_64: p.audio_base_64,
    media_type: 'audio/mpeg',
    duration_secs: typeof p.duration_secs === 'number' && Number.isFinite(p.duration_secs) ? Math.round(p.duration_secs * 10) / 10 : null,
  }
}

/** Generates previews and records their ids for the org (expires in 1 h). */
export async function designVoicePreviews(params: {
  orgId: string
  userId: string
  description: string
  text?: string | null
  language: string
  log: Logger
}): Promise<{ previews: DesignPreview[]; text: string; expires_at: string }> {
  const { orgId, log } = params
  if (!el.isConfigured()) throw new ProviderError({ system: 'elevenlabs', operation: 'voices.design', code: 'not_configured' })
  const description = cleanText(params.description, DESIGN_DESCRIPTION.max)
  if (Array.from(description).length < DESIGN_DESCRIPTION.min) {
    throw new RequestError('invalid_request', `Describe the voice in at least ${DESIGN_DESCRIPTION.min} characters.`, 400)
  }
  const language = normalizeAgentLanguage(params.language)
  const custom = params.text ? cleanText(params.text, DESIGN_TEXT.max) : ''
  const text = Array.from(custom).length >= DESIGN_TEXT.min ? custom : designPreviewText(language)
  const model = voiceDesignModel()

  const res = await designVoice({ voice_description: description, model_id: model, text }, 'mp3_22050_32', { orgId })
  const previews = (res.previews ?? []).map(validPreview).filter((p): p is DesignPreview => p !== null).slice(0, MAX_PREVIEWS)
  if (!previews.length) {
    throw new ProviderError({ system: 'elevenlabs', operation: 'voices.design', code: 'bad_response', detail: 'no usable previews' })
  }

  const batchId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS).toISOString()
  const { error } = await createAdminClient()
    .from('voice_design_previews')
    .insert(
      previews.map((p) => ({
        org_id: orgId,
        batch_id: batchId,
        generated_voice_id: p.generated_voice_id,
        description,
        language,
        model_id: model,
        created_by: params.userId,
        expires_at: expiresAt,
      })),
    )
  if (error) throw new Error(`voice_design_previews insert failed: ${error.message}`)
  log.info('voice_design.previews', { count: previews.length, model, language })
  return { previews, text, expires_at: expiresAt }
}

interface ClaimedPreview {
  id: string
  batch_id: string
  generated_voice_id: string
  language: string | null
}

async function releaseClaim(id: string, log: Logger): Promise<void> {
  const { error } = await createAdminClient().from('voice_design_previews').update({ consumed_at: null }).eq('id', id).is('saved_voice_id', null)
  if (error) log.error('voice_design.release_failed', error, { previewId: id })
}

/**
 * Creates the org's voice from one of ITS previews. The preview row is claimed
 * first (consumed_at), so a double click or a replay cannot create two voices.
 */
export async function saveDesignedVoice(params: {
  orgId: string
  userId: string
  generatedVoiceId: string
  name: string
  log: Logger
}): Promise<{ voice: VoiceOption }> {
  const { orgId, userId } = params
  const log = params.log.child({ component: 'voice_design' })
  const name = cleanText(params.name, 100)
  if (!name) throw new RequestError('invalid_request', 'Give the voice a name.', 400)
  if (!GENERATED_ID_RE.test(params.generatedVoiceId)) throw new RequestError('invalid_request', 'Invalid preview.', 400)
  const db = createAdminClient()
  const now = new Date().toISOString()

  const { data: claimed, error: claimErr } = await db
    .from('voice_design_previews')
    .update({ consumed_at: now })
    .eq('org_id', orgId)
    .eq('generated_voice_id', params.generatedVoiceId)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('id, batch_id, generated_voice_id, language')
  if (claimErr) throw new Error(`voice_design_previews claim failed: ${claimErr.message}`)
  const preview = (claimed?.[0] ?? null) as ClaimedPreview | null
  // Same answer for "not yours", "expired" and "already saved": no oracle.
  if (!preview) throw new RequestError('not_found', 'This preview has expired or was already saved. Design the voice again.', 404)

  const { data: siblings, error: sibErr } = await db
    .from('voice_design_previews')
    .select('generated_voice_id')
    .eq('org_id', orgId)
    .eq('batch_id', preview.batch_id)
  if (sibErr) log.warn('voice_design.siblings_read_failed', { error: sibErr.message })
  const notSelected = (siblings ?? []).map((s) => s.generated_voice_id as string).filter((g) => g !== preview.generated_voice_id && GENERATED_ID_RE.test(g))
  const language = preview.language ? normalizeAgentLanguage(preview.language) : null

  let voiceId: string
  try {
    const created = await createVoiceFromPreview(
      {
        voice_name: platformVoiceName(name, orgId),
        // Our own description (the tenant's prompt stays out of the shared workspace).
        voice_description: platformVoiceDescription('designed', orgId),
        generated_voice_id: preview.generated_voice_id,
        ...(language ? { labels: { language } } : {}),
        ...(notSelected.length ? { played_not_selected_voice_ids: notSelected } : {}),
      },
      { orgId },
    )
    if (!created?.voice_id || !EL_VOICE_ID_RE.test(created.voice_id)) {
      throw new ProviderError({ system: 'elevenlabs', operation: 'voices.create_from_preview', code: 'bad_response', detail: 'missing voice_id' })
    }
    voiceId = created.voice_id
  } catch (err) {
    await releaseClaim(preview.id, log)
    if (isProviderError(err) && err.code === 'conflict') {
      throw new RequestError('conflict', 'This voice was already saved. Refresh your voices.', 409)
    }
    throw err
  }

  const { error } = await db.from('provider_voices').insert({
    provider: 'elevenlabs',
    voice_id: voiceId,
    source: 'designed',
    owner_org_id: orgId,
    name,
    language,
    languages: language ? [language] : null,
    category: 'generated',
    status: 'ready',
    consent: { designed_at: now, user_id: userId, kind: 'voice_design' },
    created_by: userId,
  })
  if (error) {
    log.error('voice_design.register_failed', error, { voiceId })
    try {
      await el.voices.delete(voiceId, { orgId })
    } catch (delErr) {
      log.error('voice_design.compensating_delete_failed', delErr, { voiceId })
    }
    await releaseClaim(preview.id, log)
    throw new Error(`provider_voices insert failed: ${error.message}`)
  }
  const overCap = await capViolationAfterInsert(db, orgId, voiceId)
  if (overCap) {
    await discardCustomVoice(db, orgId, voiceId, log)
    throw overCap
  }
  const { error: markErr } = await db.from('voice_design_previews').update({ saved_voice_id: voiceId }).eq('id', preview.id)
  if (markErr) log.error('voice_design.mark_saved_failed', markErr, { voiceId })

  log.info('voice_design.saved', { voiceId })
  await writeAudit(db, { orgId, userId, action: 'voice.design.saved', targetId: voiceId, details: { name, language } }, log)
  return {
    voice: {
      provider: 'elevenlabs',
      voiceId,
      name,
      description: null,
      language,
      accent: null,
      gender: null,
      age: null,
      category: 'generated',
      source: 'designed',
      previewUrl: null,
      requiresProvisioning: false,
      libraryRef: null,
    },
  }
}

/** Housekeeping: expired preview rows (they hold the tenant's description) are deleted a day later. */
export async function pruneDesignPreviews(log: Logger, now = Date.now()): Promise<{ deleted: number | null }> {
  const cutoff = new Date(now - 24 * 3600_000).toISOString()
  const { error, count } = await createAdminClient().from('voice_design_previews').delete({ count: 'exact' }).lt('expires_at', cutoff)
  if (error) {
    log.error('voice_design.prune_failed', error)
    throw new Error(`voice_design_previews prune failed: ${error.message}`)
  }
  return { deleted: count ?? null }
}
