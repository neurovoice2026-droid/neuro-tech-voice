import 'server-only'
// ElevenLabs voice endpoints beyond the basic get/search/delete/clone of
// lib/elevenlabs/client.ts: batched lifecycle reads, the Voice Library search
// with every filter a receptionist needs, library accents, the workspace
// voice-slot quota and Voice Design (text-to-voice).
// Field names, enums and limits verified against the official OpenAPI spec
// (2026-10). The workspace is shared by every tenant: nothing here is proxied
// to a browser unfiltered. Callers resolve every id server-side.

import { NO_RETRY } from '@/lib/voice-providers/http'
import { req, T, type Ctx } from '../client'

const enc = encodeURIComponent

/** Spec limits. */
export const VOICE_LIMITS = {
  /** GET /v2/voices voice_ids: "Maximum 100 voice IDs". */
  idsPerLookup: 100,
  /** GET /v2/voices and /v1/shared-voices page_size cap. */
  pageSize: 100,
  /** VoiceDesignRequestModel.voice_description. */
  designDescription: { min: 20, max: 1000 },
  /** VoiceDesignRequestModel.text ("has to be between 100 and 1000"). */
  designText: { min: 100, max: 1000 },
} as const

/** VoiceSharingResponseModel.status. */
export type VoiceSharingStatus = 'enabled' | 'disabled' | 'copied' | 'copied_disabled'
/** VoiceResponseModel.safety_control. */
export type VoiceSafetyControl = 'NONE' | 'BAN' | 'CAPTCHA' | 'ENTERPRISE_BAN' | 'ENTERPRISE_CAPTCHA'
/** VoiceResponseModel.category. */
export type VoiceCategory = 'generated' | 'cloned' | 'premade' | 'professional' | 'famous' | 'high_quality'

export interface ELVerifiedLanguage {
  language: string
  model_id?: string | null
  accent?: string | null
  locale?: string | null
  preview_url?: string | null
}

/** VoiceResponseModel (the subset the lifecycle checks and the orphan scan read). */
export interface ELVoiceDetail {
  voice_id: string
  name: string
  category: VoiceCategory | string
  description?: string | null
  labels?: Record<string, string>
  preview_url?: string | null
  created_at_unix?: number | null
  is_legacy?: boolean
  safety_control?: VoiceSafetyControl | null
  verified_languages?: ELVerifiedLanguage[] | null
  sharing?: {
    status?: VoiceSharingStatus | null
    public_owner_id?: string | null
    original_voice_id?: string | null
    notice_period?: number | null
    disable_at_unix?: number | null
    live_moderation_enabled?: boolean | null
    rate?: number | null
    fiat_rate?: number | null
  } | null
}

export interface ELVoicePage {
  voices: ELVoiceDetail[]
  has_more: boolean
  next_page_token?: string | null
}

/**
 * GET /v2/voices?voice_ids=… (at most 100 ids): one batched read of the
 * workspace voices' current state. Ids unknown to the workspace are simply
 * absent from the answer.
 */
export function getVoicesByIds(voiceIds: string[], ctx?: Ctx) {
  if (voiceIds.length > VOICE_LIMITS.idsPerLookup) throw new Error('getVoicesByIds: at most 100 ids per call')
  return req<ELVoicePage>('voices.lookup', '/v2/voices', {
    query: { voice_ids: voiceIds, page_size: VOICE_LIMITS.pageSize, include_total_count: false },
    timeoutMs: T.read,
    ctx,
  })
}

/** GET /v1/voices/{voice_id}: one voice with its sharing / safety state. */
export function getVoiceDetail(voiceId: string, ctx?: Ctx) {
  return req<ELVoiceDetail>('voices.get', `/v1/voices/${enc(voiceId)}`, { ctx })
}

/**
 * GET /v2/voices for the platform's own scans (never proxied to a tenant).
 * voice_type 'non-community' = personal + workspace voices (no library copies);
 * category is single-valued ('premade', 'cloned', 'generated', 'professional').
 */
export function listWorkspaceVoices(params: {
  voice_type?: 'personal' | 'community' | 'default' | 'workspace' | 'non-default' | 'non-community' | 'saved'
  category?: 'premade' | 'cloned' | 'generated' | 'professional'
  next_page_token?: string | null
  page_size?: number
}) {
  return req<ELVoicePage>('voices.list', '/v2/voices', {
    query: {
      voice_type: params.voice_type,
      category: params.category,
      next_page_token: params.next_page_token ?? undefined,
      page_size: Math.min(params.page_size ?? VOICE_LIMITS.pageSize, VOICE_LIMITS.pageSize),
      include_total_count: false,
    },
  })
}

// ─── Voice Library ───────────────────────────────────────────────────────────

/** GET /v1/shared-voices sort enum. */
export const LIBRARY_SORTS = ['created_date', 'usage_character_count_1y', 'trending', 'cloned_by_count'] as const
export type LibrarySort = (typeof LIBRARY_SORTS)[number]

/** LibraryVoiceResponseModel (the subset we read). */
export interface ELLibraryVoice {
  public_owner_id: string
  voice_id: string
  name: string
  accent?: string
  gender?: string
  age?: string
  descriptive?: string
  use_case?: string
  category?: string
  language?: string | null
  locale?: string | null
  description?: string | null
  preview_url?: string | null
  rate?: number | null
  fiat_rate?: number | null
  free_users_allowed?: boolean
  live_moderation_enabled?: boolean
  featured?: boolean
  cloned_by_count?: number
  notice_period?: number | null
  is_added_by_user?: boolean | null
  verified_languages?: ELVerifiedLanguage[] | null
}

export interface LibrarySearch {
  search?: string
  language?: string
  locale?: string
  gender?: string
  age?: string
  accent?: string
  /** Use-case labels ("conversational", …); a voice matching any of them is returned. */
  use_cases?: string[]
  /** Only 'professional' | 'famous' | 'high_quality' are accepted by the endpoint. */
  category?: 'professional' | 'famous' | 'high_quality'
  featured?: boolean
  sort?: LibrarySort
  owner_id?: string
  min_notice_period_days?: number
  page?: number
  page_size?: number
}

/**
 * GET /v1/shared-voices. Live-moderated and custom-rate voices are always
 * excluded server-side (they add latency or cost per character).
 */
export function searchLibrary(params: LibrarySearch) {
  return req<{ voices: ELLibraryVoice[]; has_more: boolean }>('shared_voices.list', '/v1/shared-voices', {
    query: {
      page_size: Math.min(params.page_size ?? 30, VOICE_LIMITS.pageSize),
      page: params.page ?? 0,
      search: params.search,
      language: params.language,
      locale: params.locale,
      gender: params.gender,
      age: params.age,
      accent: params.accent,
      use_cases: params.use_cases && params.use_cases.length ? params.use_cases : undefined,
      category: params.category,
      featured: params.featured ? true : undefined,
      owner_id: params.owner_id,
      min_notice_period_days: params.min_notice_period_days,
      include_live_moderated: false,
      include_custom_rates: false,
      sort: params.sort ?? 'cloned_by_count',
    },
  })
}

/** VoiceAccentResponseModel. */
export interface ELVoiceAccent {
  /** Value for the `accent` filter of GET /v1/shared-voices. */
  accent: string
  language: string
  code: string
  name: string
}

/** GET /v1/voices/accents: accents available in the library (optionally for one language). */
export function listAccents(params: { language?: string; model_id?: string } = {}) {
  return req<{ accents: ELVoiceAccent[] }>('voices.accents', '/v1/voices/accents', {
    query: { language: params.language, model_id: params.model_id },
  })
}

// ─── Workspace quota (custom voice slots) ────────────────────────────────────

/** ExtendedSubscriptionResponseModel: the voice-related fields only. */
export interface ELVoiceQuota {
  tier?: string
  voice_slots_used?: number
  voice_limit?: number
  voice_add_edit_counter?: number
  max_voice_add_edits?: number | null
  can_use_instant_voice_cloning?: boolean
}

/** GET /v1/user/subscription (platform workspace; never shown to a tenant). */
export function getVoiceQuota() {
  return req<ELVoiceQuota>('user.subscription', '/v1/user/subscription', { timeoutMs: 5_000 })
}

// ─── Voice Design (text-to-voice) ────────────────────────────────────────────

/** VoiceDesignRequestModel.model_id enum. */
export const VOICE_DESIGN_MODELS = ['eleven_multilingual_ttv_v2', 'eleven_ttv_v3'] as const
export type VoiceDesignModel = (typeof VOICE_DESIGN_MODELS)[number]

/** VoicePreviewResponseModel. */
export interface ELVoicePreview {
  audio_base_64: string
  generated_voice_id: string
  media_type: string
  duration_secs: number
  language?: string | null
}

/**
 * POST /v1/text-to-voice/design. The previews come back inline as base64
 * (stream_previews=false). Never retried: every call costs credits. Reference
 * audio (voice-sample based generation, legally a clone) is never sent.
 */
export function designVoice(
  body: { voice_description: string; model_id: VoiceDesignModel; text?: string; auto_generate_text?: boolean },
  outputFormat: 'mp3_22050_32' | 'mp3_44100_64',
  ctx?: Ctx,
) {
  return req<{ previews: ELVoicePreview[]; text: string }>('voices.design', '/v1/text-to-voice/design', {
    method: 'POST',
    query: { output_format: outputFormat },
    body: { ...body, stream_previews: false },
    timeoutMs: T.upload,
    retry: NO_RETRY,
    ctx,
  })
}

/**
 * POST /v1/text-to-voice: creates a workspace voice from a preview. Creates a
 * resource (and uses a custom voice slot): never retried.
 */
export function createVoiceFromPreview(
  body: {
    voice_name: string
    voice_description: string
    generated_voice_id: string
    labels?: Record<string, string>
    played_not_selected_voice_ids?: string[]
  },
  ctx?: Ctx,
) {
  return req<ELVoiceDetail>('voices.create_from_preview', '/v1/text-to-voice', {
    method: 'POST',
    body,
    timeoutMs: T.upload,
    retry: NO_RETRY,
    ctx,
  })
}
