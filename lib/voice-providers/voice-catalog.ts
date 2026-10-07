import 'server-only'
// ─── Voice catalog: what an organization may list, preview, select and clone ──
//
// The ElevenLabs workspace is SHARED by every customer of the platform, so the
// provider's own listing (GET /v2/voices) would show one org's cloned voices to
// everyone, and any voice id a browser sends could point at another tenant's
// clone. Every voice-related route goes through this module instead.
//
// An organization may list / preview / select only:
//   (a) provider_voices registry rows that are platform-wide (owner_org_id NULL,
//       e.g. provisioned library voices and the curated voices per language) or
//       owned by the org, with status ready and no lifecycle notice.
//   (b) public Voice Library voices (GET /v1/shared-voices without live
//       moderation or custom rates and with a minimum notice period). They are
//       provisioned (added to the workspace + registered) before an agent uses
//       them, and eligibility is re-validated against the library server-side.
// ElevenLabs default ("premade") voices expire on 2026-12-31 and are no longer
// offered: they are hidden from the catalog and refused for new selections.
// An agent that already uses one keeps it (re-saving the current voice works)
// until the default-voice migration moves it (lib/voice-providers/default-voices.ts).
// A registry voice with a lifecycle notice (scheduled removal, live
// moderation, custom rate, removed) is likewise kept only by agents already on it.
// Anything else in the workspace (other orgs' clones, unregistered generated or
// professional voices) is rejected with 403. Registry/audit writes use the
// service-role client: those tables have no tenant write policies.

import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { CARTESIA_VOICE_ID_RE, isAllowedFallbackVoice, platformFallbackIds } from '@/lib/cartesia/voice-policy'
export { CARTESIA_VOICE_ID_RE } from '@/lib/cartesia/voice-policy'
import { previewTtsModel, ttsModelFor } from '@/lib/elevenlabs/models'
import { TTS_TUNING_DEFAULTS } from '@/lib/elevenlabs/conversation-behaviour'
import { searchLibrary, type LibrarySort } from '@/lib/elevenlabs/api/voices'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  parseJsonBody,
  requestErrorResponse,
} from '@/lib/api/http'
import { requireOrg } from '@/lib/api/auth'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { parseJson } from '@/lib/util/json'
import { AGENT_LANGUAGES, type AgentLanguageCode } from '@/lib/agent-languages'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import type { ElevenLabsVoice, VoiceOption } from '@/types'
import { libraryMinNoticeDays } from './config'
import { ProviderError, isProviderError } from './errors'
import { readVoiceTuning } from './settings'
import { purgeVoiceHistory } from './tts-history'
import { locatorBody, pronunciationLocatorOf, type PronunciationLocator } from './pronunciation-rules'
import type { VoiceTuning } from './types'
import {
  VOICE_CAPACITY_MESSAGE,
  VoiceCapacityError,
  assertWorkspaceVoiceCapacity,
  capViolationAfterInsert,
  isVoiceCapacityProviderError,
} from './voice-capacity'

// ─── Identifiers and shared input schemas ────────────────────────────────────

/** ElevenLabs voice ids are 20 alphanumerics today; the bound leaves room. */
export const EL_VOICE_ID_RE = /^[A-Za-z0-9]{8,64}$/
/** Voice Library public owner ids (64 hex chars today). */
export const EL_OWNER_ID_RE = /^[A-Za-z0-9]{8,128}$/
/** Cartesia voice ids are UUIDs. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const PREVIEW_TEXT_MAX_CHARS = 200
const DEFAULT_PAGE_SIZE = 30
const MAX_PAGE_SIZE = 100

const LANGUAGE_VALUES = AGENT_LANGUAGES.map((l) => l.value) as [AgentLanguageCode, ...AgentLanguageCode[]]

export const languageSchema = z.enum(LANGUAGE_VALUES)
export const elVoiceIdSchema = z.string().trim().regex(EL_VOICE_ID_RE, 'Invalid voice id.')
export const libraryRefSchema = z
  .object({
    public_owner_id: z.string().trim().regex(EL_OWNER_ID_RE, 'Invalid library owner id.'),
    voice_id: elVoiceIdSchema,
  })
  .strict()

/** Query-string helper: an empty `?x=` is treated as absent. */
export function optionalParam<S extends z.ZodType>(schema: S) {
  return z.preprocess((v) => (v === '' ? undefined : v), schema.optional())
}

export interface LibraryRef {
  publicOwnerId: string
  voiceId: string
}

export function toLibraryRef(raw: z.infer<typeof libraryRefSchema> | null | undefined): LibraryRef | null {
  return raw ? { publicOwnerId: raw.public_owner_id, voiceId: raw.voice_id } : null
}

// ─── Route helpers (shared by the voice routes) ──────────────────────────────

/** Validates the query string with a zod object schema (400 on failure). */
export function parseQuery<S extends z.ZodType>(request: Request, schema: S): z.infer<S> {
  const raw = Object.fromEntries(new URL(request.url).searchParams.entries())
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new RequestError(
      'invalid_request',
      'Some query parameters are invalid.',
      400,
      parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  return parsed.data
}

/** A library voice that has not been added to the workspace cannot speak custom text yet. */
export class VoiceNotProvisionedError extends Error {
  constructor(readonly libraryRef: LibraryRef | null) {
    super('This library voice is not added yet. Play its sample, or select it to hear custom text.')
    this.name = 'VoiceNotProvisionedError'
  }
}

/**
 * One error mapping for the voice routes: RequestError → its status (its
 * headers carry Retry-After for our own 429s), VoiceNotProvisionedError → 409
 * voice_not_provisioned, anything else → errorResponse (provider-safe message
 * or a generic 500), with the provider's Retry-After when it throttled us.
 */
export function voiceErrorResponse(err: unknown, log: Logger, event: string, requestId: string): NextResponse {
  let res: NextResponse
  if (err instanceof VoiceCapacityError || isVoiceCapacityProviderError(err)) {
    // Ops are alerted where the capacity problem was detected; the tenant gets
    // a product message without the platform's numbers.
    if (!(err instanceof VoiceCapacityError)) log.error(event, err, { reason: 'voice_capacity' })
    res = NextResponse.json(
      {
        error: VOICE_CAPACITY_MESSAGE,
        code: 'voice_capacity',
        request_id: requestId,
      },
      { status: 503 },
    )
  } else if (err instanceof VoiceNotProvisionedError) {
    res = NextResponse.json(
      {
        error: err.message,
        code: 'voice_not_provisioned',
        request_id: requestId,
        ...(err.libraryRef
          ? { details: { library_ref: { public_owner_id: err.libraryRef.publicOwnerId, voice_id: err.libraryRef.voiceId } } }
          : {}),
      },
      { status: 409 },
    )
  } else if (err instanceof RequestError) {
    if (err.status >= 500) log.error(event, err)
    res = requestErrorResponse(err, requestId)
  } else {
    res = errorResponse(err, log, event, requestId)
    if (isProviderError(err) && res.status === 429 && err.retryAfterSeconds !== null) {
      res.headers.set('Retry-After', String(Math.max(1, Math.ceil(err.retryAfterSeconds))))
    }
  }
  return res
}

/** Language of the org's agent (normalized), used for previews and clones. */
export async function orgAgentLanguage(supabase: SupabaseClient, orgId: string): Promise<AgentLanguageCode> {
  const { data, error } = await supabase
    .from('agents')
    .select('language')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`agents language read failed: ${error.message}`)
  return normalizeAgentLanguage((data?.language as string | null | undefined) ?? null) as AgentLanguageCode
}

// ─── Normalization ───────────────────────────────────────────────────────────

// 'english' → 'en', 'chinese (mandarin)' and 'chinese' → 'zh', ...
const LANGUAGE_BY_NAME = new Map<string, string>()
for (const l of AGENT_LANGUAGES) {
  const label = l.label.toLowerCase()
  LANGUAGE_BY_NAME.set(label, l.value)
  LANGUAGE_BY_NAME.set(label.replace(/\s*\(.*\)\s*$/, ''), l.value)
}

/** 'en-US' / 'EN' / 'English' → 'en'; anything unrecognizable → null. */
export function normalizeLanguage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase()
  if (!v) return null
  const m = /^([a-z]{2,3})(?:[-_][a-z0-9]{1,8})*$/.exec(v)
  if (m) return m[1]
  return LANGUAGE_BY_NAME.get(v) ?? null
}

export function normalizeGender(raw: unknown): 'female' | 'male' | 'neutral' | null {
  const g = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (!g) return null
  // "female"/"feminine" contain "male"/"masculine"-adjacent text: test them first.
  if (/(female|feminine|woman|girl)/.test(g)) return 'female'
  if (/(neutral|non[-_ ]?binary|androgynous)/.test(g)) return 'neutral'
  if (/(male|masculine|\bman\b|boy)/.test(g)) return 'male'
  return null
}

/** Strips control characters, collapses whitespace, bounds by code points. */
export function cleanText(raw: string, maxChars: number): string {
  const flat = raw.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim()
  const chars = Array.from(flat)
  return chars.length > maxChars ? chars.slice(0, maxChars).join('').trim() : flat
}

/** Free-text search reduced to letters, digits, spaces and . ' - (no LIKE/PostgREST wildcards). */
function cleanSearch(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const v = cleanText(raw.normalize('NFC').replace(/[^\p{L}\p{N}\s.'-]/gu, ' '), 64)
  return v.length ? v : undefined
}

function humanize(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/_/g, ' ').trim()
  return v ? v : null
}

/** Only absolute https URLs from the provider are passed to the browser. */
function publicHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 2048 || !URL.canParse(raw)) return null
  const u = new URL(raw)
  return u.protocol === 'https:' ? u.toString() : null
}

function displayName(raw: string | null | undefined, fallback = 'Voice'): string {
  return cleanText(raw ?? '', 100) || fallback
}

function assertUuid(id: string): void {
  if (!UUID_RE.test(id)) throw new Error('organization id is not a UUID')
}

// ─── Default preview sentences (one short line per supported language) ──────

const PREVIEW_TEXT: Record<AgentLanguageCode, string> = {
  en: "Hello! Thanks for calling. I'm your virtual assistant. How can I help you today?",
  ro: 'Bună ziua! Vă mulțumim că ați sunat. Sunt asistentul virtual. Cu ce vă pot ajuta astăzi?',
  es: '¡Hola! Gracias por llamar. Soy su asistente virtual. ¿En qué puedo ayudarle hoy?',
  fr: "Bonjour ! Merci de votre appel. Je suis votre assistant virtuel. Comment puis-je vous aider aujourd'hui ?",
  de: 'Guten Tag! Danke für Ihren Anruf. Ich bin Ihr virtueller Assistent. Wie kann ich Ihnen heute helfen?',
  it: 'Buongiorno! Grazie per aver chiamato. Sono il suo assistente virtuale. Come posso aiutarla oggi?',
  pt: 'Olá! Obrigado por ligar. Sou o seu assistente virtual. Como posso ajudar hoje?',
  pl: 'Dzień dobry! Dziękujemy za telefon. Jestem wirtualnym asystentem. W czym mogę dziś pomóc?',
  nl: 'Goedendag! Bedankt voor uw telefoontje. Ik ben uw virtuele assistent. Waarmee kan ik u vandaag helpen?',
  ja: 'お電話ありがとうございます。バーチャルアシスタントです。本日はどのようなご用件でしょうか？',
  ko: '전화해 주셔서 감사합니다. 저는 가상 비서입니다. 오늘 무엇을 도와드릴까요?',
  zh: '您好！感谢您的来电。我是您的虚拟助理。请问今天有什么可以帮您？',
  ar: 'مرحبًا! شكرًا لاتصالك. أنا المساعد الافتراضي. كيف يمكنني مساعدتك اليوم؟',
  hi: 'नमस्ते! कॉल करने के लिए धन्यवाद। मैं आपका वर्चुअल असिस्टेंट हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?',
}

export function defaultPreviewText(language: string | null | undefined): string {
  return PREVIEW_TEXT[normalizeAgentLanguage(language) as AgentLanguageCode] ?? PREVIEW_TEXT.en
}

// ─── Registry (provider_voices) ──────────────────────────────────────────────

type RegistrySource = 'library' | 'cloned' | 'designed' | 'premade'
type RegistryStatus = 'pending' | 'ready' | 'failed' | 'deleted'

interface RegistryRow {
  id: string
  provider: 'elevenlabs' | 'cartesia'
  voice_id: string
  source: RegistrySource
  source_public_owner_id: string | null
  source_voice_id: string | null
  owner_org_id: string | null
  name: string | null
  language: string | null
  gender: string | null
  accent: string | null
  category: string | null
  preview_url: string | null
  status: RegistryStatus
  created_at: string
  /** Every verified language (migration 015); `language` stays the primary one. */
  languages?: string[] | null
  /** Curated platform voice for these languages (migration 015). */
  featured_languages?: string[] | null
  featured_rank?: number | null
  /** Lifecycle notice (migration 015): a voice with a notice is not offered for new selections. */
  notice?: string | null
  retiring_at?: string | null
}

const REGISTRY_COLUMNS =
  'id, provider, voice_id, source, source_public_owner_id, source_voice_id, owner_org_id, name, language, gender, accent, category, preview_url, status, created_at, languages, featured_languages, featured_rank, notice, retiring_at'

const UNIQUE_VIOLATION = '23505'

function visibleTo(row: RegistryRow, orgId: string): boolean {
  return row.status === 'ready' && (row.owner_org_id === null || row.owner_org_id === orgId)
}

/** The date ElevenLabs retires every default (premade) voice. */
export const DEFAULT_VOICE_RETIREMENT_DATE = '2026-12-31'

function retiringVoice(): RequestError {
  return new RequestError(
    'forbidden',
    'This voice is being retired by our voice provider and can no longer be selected. Choose another voice.',
    403,
    { reason: 'voice_retiring' },
  )
}

/** Verified language codes of a library voice (primary first), normalized and de-duplicated. */
export function libraryLanguages(lib: Pick<el.ELSharedVoice, 'language' | 'locale' | 'verified_languages'>): string[] {
  const out: string[] = []
  for (const raw of [lib.language, lib.locale, ...(lib.verified_languages ?? []).map((l) => l.language)]) {
    const code = normalizeLanguage(raw)
    if (code && !out.includes(code)) out.push(code)
  }
  return out
}

async function registryByVoiceId(db: SupabaseClient, voiceId: string): Promise<RegistryRow | null> {
  const { data, error } = await db
    .from('provider_voices')
    .select(REGISTRY_COLUMNS)
    .eq('provider', 'elevenlabs')
    .eq('voice_id', voiceId)
    .maybeSingle()
  if (error) throw new Error(`provider_voices read failed: ${error.message}`)
  return (data as RegistryRow | null) ?? null
}

async function registryByLibraryVoice(db: SupabaseClient, libraryVoiceId: string): Promise<RegistryRow | null> {
  const { data, error } = await db
    .from('provider_voices')
    .select(REGISTRY_COLUMNS)
    .eq('provider', 'elevenlabs')
    .eq('source', 'library')
    .eq('source_voice_id', libraryVoiceId)
    .maybeSingle()
  if (error) throw new Error(`provider_voices read failed: ${error.message}`)
  return (data as RegistryRow | null) ?? null
}

function registryToOption(row: RegistryRow, language?: string): VoiceOption {
  const libraryRef =
    row.source === 'library' && row.source_public_owner_id && row.source_voice_id
      ? { publicOwnerId: row.source_public_owner_id, voiceId: row.source_voice_id }
      : null
  const featured = row.owner_org_id === null ? (row.featured_languages ?? []) : []
  const primary = normalizeLanguage(row.language)
  // A multilingual voice listed under the requested language shows that language.
  const shown = language && primary !== language && (row.languages ?? []).includes(language) ? language : primary
  return {
    provider: 'elevenlabs',
    voiceId: row.voice_id,
    name: displayName(row.name),
    description: null,
    language: shown,
    accent: row.accent ?? null,
    gender: normalizeGender(row.gender),
    age: null,
    category: row.category ?? (row.source === 'cloned' ? 'cloned' : row.source === 'designed' ? 'generated' : null),
    source: row.source,
    previewUrl: publicHttpsUrl(row.preview_url),
    requiresProvisioning: false,
    libraryRef,
    ...(featured.length && (!language || featured.includes(language)) ? { recommended: true } : {}),
  }
}

export async function writeAudit(
  db: SupabaseClient,
  entry: {
    orgId: string | null
    userId: string | null
    action: string
    targetId: string
    details: Record<string, unknown>
    actorKind?: 'user' | 'system' | 'admin_token' | 'admin_user'
    targetType?: string
  },
  log: Logger,
): Promise<void> {
  const { error } = await db.from('audit_log').insert({
    org_id: entry.orgId,
    actor_user_id: entry.userId,
    actor_kind: entry.actorKind ?? 'user',
    action: entry.action,
    target_type: entry.targetType ?? 'provider_voice',
    target_id: entry.targetId,
    details: entry.details,
  })
  // The voice operation itself already succeeded; a lost audit row must be loud, not fatal.
  if (error) log.error('audit_log.write_failed', error, { action: entry.action, targetId: entry.targetId })
}

// ─── ElevenLabs default voices (cached per instance) ─────────────────────────

const DEFAULTS_TTL_MS = 10 * 60_000
let defaultsCache: { at: number; voices: el.ELVoice[] } | null = null
let defaultsInflight: Promise<el.ELVoice[]> | null = null

async function fetchDefaultVoices(): Promise<el.ELVoice[]> {
  const out: el.ELVoice[] = []
  let token: string | null = null
  for (let i = 0; i < 5; i++) {
    const page: Awaited<ReturnType<typeof el.voices.search>> = await el.voices.search({
      voice_type: 'default',
      page_size: MAX_PAGE_SIZE,
      next_page_token: token,
    })
    // voice_type=default should only return premade voices; the category check
    // keeps that true even if the provider widens the filter one day.
    out.push(...(page.voices ?? []).filter((v) => v.category === 'premade' && EL_VOICE_ID_RE.test(v.voice_id)))
    if (!page.has_more || !page.next_page_token) break
    token = page.next_page_token
  }
  return out
}

/**
 * Default (premade) voices. Expire 2026-12-31 at ElevenLabs: may legitimately
 * be empty. Never offered any more; read only to recognise agents that still
 * use one (retirement banner, migration, diagnostics).
 */
async function defaultVoices(): Promise<el.ELVoice[]> {
  if (!el.isConfigured()) return []
  if (defaultsCache && Date.now() - defaultsCache.at < DEFAULTS_TTL_MS) return defaultsCache.voices
  if (!defaultsInflight) {
    defaultsInflight = fetchDefaultVoices()
      .then((voices) => {
        defaultsCache = { at: Date.now(), voices }
        return voices
      })
      .finally(() => {
        defaultsInflight = null
      })
  }
  return defaultsInflight
}

/**
 * The ids of the ElevenLabs default voices (cached 10 min). null when the
 * listing could not be read (callers must not treat "unknown" as "not premade").
 */
export async function defaultVoiceIds(log?: Logger): Promise<Set<string> | null> {
  try {
    return new Set((await defaultVoices()).map((v) => v.voice_id))
  } catch (err) {
    log?.warn('voice_catalog.default_voices_unavailable', { error: isProviderError(err) ? err.code : 'unknown' })
    return null
  }
}

// ─── Voice Library (shared voices) ───────────────────────────────────────────

/** Library entries we accept: no live moderation, no custom rate, long enough notice period. */
export function isUsableLibraryVoice(v: el.ELSharedVoice): boolean {
  if (!EL_VOICE_ID_RE.test(v.voice_id) || !EL_OWNER_ID_RE.test(v.public_owner_id)) return false
  if (v.live_moderation_enabled === true) return false
  if (typeof v.rate === 'number' && v.rate > 1) return false
  if (v.fiat_rate !== null && v.fiat_rate !== undefined) return false
  const minNotice = libraryMinNoticeDays()
  if (minNotice && typeof v.notice_period === 'number' && v.notice_period < minNotice) return false
  return true
}

function libraryToOption(v: el.ELSharedVoice, language: string | undefined, workspaceVoiceId: string | null): VoiceOption {
  const match = language ? (v.verified_languages ?? []).find((l) => normalizeLanguage(l.language) === language) : undefined
  const descriptors = [humanize(v.descriptive), humanize(v.use_case)].filter(Boolean).join(' · ')
  return {
    provider: 'elevenlabs',
    voiceId: workspaceVoiceId ?? v.voice_id,
    name: displayName(v.name),
    description: v.description?.trim() || descriptors || null,
    language: match ? (language as string) : normalizeLanguage(v.language) ?? normalizeLanguage(v.locale) ?? language ?? null,
    accent: humanize(match?.accent) ?? humanize(v.accent),
    gender: normalizeGender(v.gender),
    age: humanize(v.age),
    category: v.category ?? null,
    source: 'library',
    previewUrl: publicHttpsUrl(match?.preview_url) ?? publicHttpsUrl(v.preview_url),
    requiresProvisioning: workspaceVoiceId === null,
    libraryRef: { publicOwnerId: v.public_owner_id, voiceId: v.voice_id },
  }
}

const LIBRARY_LOOKUP_TTL_MS = 5 * 60_000
const LIBRARY_LOOKUP_MAX_PAGES = 5
const libraryLookupCache = new Map<string, { at: number; voice: el.ELSharedVoice | null }>()

/**
 * Re-validates a library voice server-side: looks it up by its public owner in
 * /v1/shared-voices with the same filters as the catalog, so a browser cannot
 * select a voice the listing would not have offered.
 */
export async function findLibraryVoice(publicOwnerId: string, voiceId: string): Promise<el.ELSharedVoice | null> {
  if (!EL_OWNER_ID_RE.test(publicOwnerId) || !EL_VOICE_ID_RE.test(voiceId)) return null
  const key = `${publicOwnerId}/${voiceId}`
  const hit = libraryLookupCache.get(key)
  if (hit && Date.now() - hit.at < LIBRARY_LOOKUP_TTL_MS) return hit.voice
  let found: el.ELSharedVoice | null = null
  for (let page = 0; page < LIBRARY_LOOKUP_MAX_PAGES; page++) {
    const res = await el.sharedVoices.list({
      owner_id: publicOwnerId,
      page,
      page_size: MAX_PAGE_SIZE,
      min_notice_period_days: libraryMinNoticeDays(),
    })
    found =
      (res.voices ?? []).find((v) => v.voice_id === voiceId && v.public_owner_id === publicOwnerId && isUsableLibraryVoice(v)) ?? null
    if (found || !res.has_more) break
  }
  if (libraryLookupCache.size > 500) libraryLookupCache.clear()
  libraryLookupCache.set(key, { at: Date.now(), voice: found })
  return found
}

async function provisionedLibraryMap(db: SupabaseClient, libraryVoiceIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!libraryVoiceIds.length) return out
  const { data, error } = await db
    .from('provider_voices')
    .select('voice_id, source_voice_id, owner_org_id')
    .eq('provider', 'elevenlabs')
    .eq('source', 'library')
    .eq('status', 'ready')
    .is('owner_org_id', null)
    .in('source_voice_id', libraryVoiceIds)
  if (error) throw new Error(`provider_voices read failed: ${error.message}`)
  for (const r of data ?? []) {
    if (typeof r.source_voice_id === 'string' && typeof r.voice_id === 'string') out.set(r.source_voice_id, r.voice_id)
  }
  return out
}

// ─── Listing ─────────────────────────────────────────────────────────────────

/** Library use-case filter: phone-conversation voices by default, or every use case. */
export const LIBRARY_USE_CASES = ['conversational', 'all'] as const
export type LibraryUseCase = (typeof LIBRARY_USE_CASES)[number]
export const LIBRARY_AGES = ['young', 'middle_aged', 'old'] as const
export type LibraryAge = (typeof LIBRARY_AGES)[number]
/** Accent filter values (GET /v1/voices/accents `accent`): lowercase words, spaces, - and _. */
export const ACCENT_RE = /^[a-z][a-z _-]{0,39}$/

export interface VoiceCatalogQuery {
  source: 'workspace' | 'library'
  search?: string | null
  language?: string | null
  gender?: 'female' | 'male' | 'neutral' | null
  /** Library + registry rows (matched on the registry's accent label). */
  accent?: string | null
  /** Library only. */
  age?: LibraryAge | null
  /** Library only; default 'conversational'. */
  useCase?: LibraryUseCase | null
  /** Library only: studio-quality voices (category high_quality). */
  highQuality?: boolean | null
  /** Library only: voices ElevenLabs features. */
  featured?: boolean | null
  /** Library only; default cloned_by_count. */
  sort?: LibrarySort | null
  pageToken?: string | null
  pageSize?: number | null
}

export interface VoiceCatalogPage {
  voices: VoiceOption[]
  next_page_token: string | null
}

interface NormalizedQuery {
  search: string | undefined
  language: string | undefined
  gender: 'female' | 'male' | 'neutral' | undefined
  accent: string | undefined
  age: LibraryAge | undefined
  useCase: LibraryUseCase
  highQuality: boolean
  featured: boolean
  sort: LibrarySort | undefined
  pageSize: number
}

type PageCursor = { v: 1; p: 'r' | 'd'; o: number } | { v: 1; p: 'l'; n: number }

const CursorSchema = z.union([
  z.object({ v: z.literal(1), p: z.enum(['r', 'd']), o: z.number().int().min(0).max(100_000) }).strict(),
  z.object({ v: z.literal(1), p: z.literal('l'), n: z.number().int().min(0).max(10_000) }).strict(),
])

function encodeCursor(c: PageCursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url')
}

function decodeCursor(token: string, source: VoiceCatalogQuery['source']): PageCursor {
  const invalid = () => new RequestError('invalid_request', 'Invalid page token.', 400)
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(token)) throw invalid()
  const json = parseJson(Buffer.from(token, 'base64url').toString('utf8'))
  if (!json.ok) throw invalid()
  const parsed = CursorSchema.safeParse(json.value)
  if (!parsed.success) throw invalid()
  const c = parsed.data as PageCursor
  if ((source === 'library') !== (c.p === 'l')) throw invalid()
  return c
}

/** Page token for a Voice Library page number (legacy callers paginate by number). */
export function libraryPageToken(page: number): string | null {
  return page > 0 ? encodeCursor({ v: 1, p: 'l', n: Math.min(Math.floor(page), 10_000) }) : null
}

async function registryPage(db: SupabaseClient, orgId: string, q: NormalizedQuery, offset: number, limit: number): Promise<RegistryRow[]> {
  assertUuid(orgId) // interpolated below, and it is a server-side UUID
  let query = db
    .from('provider_voices')
    .select(REGISTRY_COLUMNS)
    .eq('provider', 'elevenlabs')
    .eq('status', 'ready')
    // Voices being removed, live-moderated or with a custom rate are not offered.
    .is('notice', null)
    .or(`owner_org_id.is.null,owner_org_id.eq.${orgId}`)
  if (q.search) query = query.ilike('name', `%${q.search}%`)
  // q.language is a normalized 2–3 letter code (normalizeLanguage), safe to interpolate.
  if (q.language) query = query.or(`language.eq.${q.language},languages.cs.{${q.language}},featured_languages.cs.{${q.language}}`)
  if (q.gender) query = query.eq('gender', q.gender)
  // Registry accents are stored humanized ("british"); ACCENT_RE-validated, no wildcards left.
  if (q.accent) query = query.ilike('accent', q.accent.replace(/[_-]+/g, ' '))
  const { data, error } = await query
    .order('owner_org_id', { ascending: true, nullsFirst: false })
    .order('featured_rank', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(`provider_voices read failed: ${error.message}`)
  return (data as RegistryRow[] | null) ?? []
}

/**
 * The org's own voices first, then the platform's (curated voices for the
 * language first). Default voices are no longer listed (retired 2026-12-31).
 */
async function listWorkspaceVoices(orgId: string, q: NormalizedQuery, cursor: PageCursor | null): Promise<VoiceCatalogPage> {
  // A page token from the time default voices were listed ends the listing.
  if (cursor && cursor.p === 'd') return { voices: [], next_page_token: null }
  const offset = cursor && cursor.p === 'r' ? cursor.o : 0
  const rows = await registryPage(createAdminClient(), orgId, q, offset, q.pageSize + 1)
  return {
    voices: rows.slice(0, q.pageSize).map((r) => registryToOption(r, q.language)),
    next_page_token: rows.length > q.pageSize ? encodeCursor({ v: 1, p: 'r', o: offset + q.pageSize }) : null,
  }
}

/**
 * How well a library voice suits the agent: 2 = verified for the language with
 * the model the agent speaks it with, 1 = verified for the language, 0 = other.
 */
export function libraryLanguageFit(v: Pick<el.ELSharedVoice, 'verified_languages'>, language: string | undefined): number {
  if (!language) return 0
  const entries = (v.verified_languages ?? []).filter((l) => normalizeLanguage(l.language) === language)
  if (!entries.length) return 0
  const models = new Set<string>([ttsModelFor(language), previewTtsModel(language)])
  return entries.some((l) => typeof l.model_id === 'string' && models.has(l.model_id)) ? 2 : 1
}

async function listLibraryVoices(q: NormalizedQuery, page: number): Promise<VoiceCatalogPage> {
  const res = await searchLibrary({
    search: q.search,
    language: q.language,
    gender: q.gender,
    accent: q.accent,
    age: q.age,
    use_cases: q.useCase === 'all' ? undefined : [q.useCase],
    category: q.highQuality ? 'high_quality' : undefined,
    featured: q.featured,
    sort: q.sort,
    page,
    page_size: q.pageSize,
    min_notice_period_days: libraryMinNoticeDays(),
  })
  const usable = (res.voices ?? []).filter(isUsableLibraryVoice)
  // Stable: within the page, voices verified for the agent's language (and model) come first.
  const ranked = usable
    .map((v, i) => ({ v, i, fit: libraryLanguageFit(v, q.language) }))
    .sort((a, b) => b.fit - a.fit || a.i - b.i)
    .map((x) => x.v)
  const provisioned = await provisionedLibraryMap(
    createAdminClient(),
    ranked.map((v) => v.voice_id),
  )
  return {
    voices: ranked.map((v) => libraryToOption(v, q.language, provisioned.get(v.voice_id) ?? null)),
    next_page_token: res.has_more ? encodeCursor({ v: 1, p: 'l', n: page + 1 }) : null,
  }
}

/**
 * Voices an organization may pick. `workspace`: registry rows visible to the
 * org (opaque offset token). `library`: public Voice Library (page-number
 * token), with already-provisioned voices carrying their workspace voice id
 * and requiresProvisioning=false.
 */
export async function listVoices(orgId: string, query: VoiceCatalogQuery): Promise<VoiceCatalogPage> {
  const pageSize = Math.min(Math.max(Math.floor(query.pageSize ?? DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE)
  const accent = typeof query.accent === 'string' ? query.accent.trim().toLowerCase() : ''
  const q: NormalizedQuery = {
    search: cleanSearch(query.search),
    language: normalizeLanguage(query.language) ?? undefined,
    gender: query.gender ?? undefined,
    accent: ACCENT_RE.test(accent) ? accent : undefined,
    age: query.age && (LIBRARY_AGES as readonly string[]).includes(query.age) ? query.age : undefined,
    useCase: query.useCase === 'all' ? 'all' : 'conversational',
    highQuality: query.highQuality === true,
    featured: query.featured === true,
    sort: query.sort ?? undefined,
    pageSize,
  }
  const cursor = query.pageToken ? decodeCursor(query.pageToken, query.source) : null
  if (query.source === 'library') return listLibraryVoices(q, cursor && cursor.p === 'l' ? cursor.n : 0)
  return listWorkspaceVoices(orgId, q, cursor)
}

/** Legacy ElevenLabsVoice shape (old /api/elevenlabs/voices* callers). */
export function toLegacyVoice(v: VoiceOption): ElevenLabsVoice & { public_owner_id?: string } {
  const labels: Record<string, string> = {}
  if (v.language) labels.language = v.language
  if (v.accent) labels.accent = v.accent
  if (v.gender) labels.gender = v.gender
  if (v.age) labels.age = v.age
  return {
    voice_id: v.voiceId,
    name: v.name,
    category: v.category ?? v.source,
    description: v.description,
    preview_url: v.previewUrl,
    labels,
  }
}

// ─── Eligibility ─────────────────────────────────────────────────────────────

export interface EligibleVoice {
  /** Id usable for TTS and agents; the library id when requiresProvisioning. */
  voiceId: string
  name: string
  kind: 'default' | 'registry' | 'library_copy' | 'library'
  requiresProvisioning: boolean
  libraryRef: LibraryRef | null
  /** The validated library entry (kind 'library' only), reused by provisioning. */
  libraryVoice: el.ELSharedVoice | null
  language: string | null
}

function notAllowed(): RequestError {
  // Same answer for "does not exist" and "belongs to someone else": no oracle.
  return new RequestError('forbidden', 'This voice is not available for your account.', 403)
}

/**
 * Throws 403 unless the org may use `voiceId`. With `libraryRef`, the voice is
 * a public library voice: either already provisioned (registry), or validated
 * against /v1/shared-voices (requiresProvisioning=true).
 *
 * `currentVoiceId` is the voice the org's agent already uses (read server-side
 * by the caller): a retiring default voice or a registry voice with a
 * lifecycle notice stays usable for that agent (re-save, retry, preview) but
 * is refused as a new selection.
 */
export async function assertVoiceEligible(
  orgId: string,
  ref: { voiceId: string; libraryRef?: LibraryRef | null; currentVoiceId?: string | null },
): Promise<EligibleVoice> {
  const { voiceId } = ref
  const libraryRef = ref.libraryRef ?? null
  const isCurrent = !!ref.currentVoiceId && ref.currentVoiceId === voiceId
  if (!EL_VOICE_ID_RE.test(voiceId)) throw new RequestError('invalid_request', 'Invalid voice id.', 400)
  const db = createAdminClient()

  if (libraryRef) {
    if (!EL_VOICE_ID_RE.test(libraryRef.voiceId) || !EL_OWNER_ID_RE.test(libraryRef.publicOwnerId)) throw notAllowed()
    const row = await registryByLibraryVoice(db, libraryRef.voiceId)
    if (row && visibleTo(row, orgId)) {
      if (voiceId !== row.voice_id && voiceId !== libraryRef.voiceId) throw notAllowed()
      if (row.notice && !(ref.currentVoiceId && ref.currentVoiceId === row.voice_id)) throw retiringVoice()
      return {
        voiceId: row.voice_id,
        name: displayName(row.name),
        kind: 'registry',
        requiresProvisioning: false,
        libraryRef,
        libraryVoice: null,
        language: normalizeLanguage(row.language),
      }
    }
    if (voiceId !== libraryRef.voiceId) throw notAllowed()
    const lib = await findLibraryVoice(libraryRef.publicOwnerId, libraryRef.voiceId)
    if (!lib) throw notAllowed()
    return {
      voiceId: lib.voice_id,
      name: displayName(lib.name),
      kind: 'library',
      requiresProvisioning: true,
      libraryRef,
      libraryVoice: lib,
      language: normalizeLanguage(lib.language),
    }
  }

  const row = await registryByVoiceId(db, voiceId)
  if (row) {
    if (!visibleTo(row, orgId)) throw notAllowed()
    if (row.notice && !isCurrent) throw retiringVoice()
    return {
      voiceId: row.voice_id,
      name: displayName(row.name),
      kind: 'registry',
      requiresProvisioning: false,
      libraryRef: registryToOption(row).libraryRef,
      libraryVoice: null,
      language: normalizeLanguage(row.language),
    }
  }

  let voice: el.ELVoice
  try {
    voice = await el.voices.get(voiceId, { orgId })
  } catch (err) {
    if (isProviderError(err) && (err.code === 'not_found' || err.code === 'validation')) throw notAllowed()
    throw err
  }
  if (voice.voice_id !== voiceId) throw notAllowed()
  if (voice.category === 'premade') {
    // Default voices expire on 2026-12-31: kept by the agent already on one
    // (until migrated), never a new selection.
    if (!isCurrent) throw retiringVoice()
    return {
      voiceId,
      name: displayName(voice.name),
      kind: 'default',
      requiresProvisioning: false,
      libraryRef: null,
      libraryVoice: null,
      language: normalizeLanguage(voice.labels?.language),
    }
  }
  // Library copies added to the workspace before the registry existed: still
  // allowed while the original is publicly shared under the catalog's filters.
  const owner = voice.sharing?.public_owner_id
  const original = voice.sharing?.original_voice_id
  if (owner && original && (await findLibraryVoice(owner, original))) {
    return {
      voiceId,
      name: displayName(voice.name),
      kind: 'library_copy',
      requiresProvisioning: false,
      libraryRef: { publicOwnerId: owner, voiceId: original },
      libraryVoice: null,
      language: normalizeLanguage(voice.labels?.language),
    }
  }
  // Cloned / generated / professional voices that are not registered to this org.
  throw notAllowed()
}

// ─── Library provisioning ────────────────────────────────────────────────────

async function findWorkspaceCopy(lib: el.ELSharedVoice): Promise<string | null> {
  let token: string | null = null
  for (let i = 0; i < 3; i++) {
    const page: Awaited<ReturnType<typeof el.voices.search>> = await el.voices.search({
      search: displayName(lib.name).slice(0, 50),
      voice_type: 'community',
      page_size: MAX_PAGE_SIZE,
      next_page_token: token,
    })
    const hit = (page.voices ?? []).find(
      (v) =>
        v.sharing?.original_voice_id === lib.voice_id &&
        (!v.sharing?.public_owner_id || v.sharing.public_owner_id === lib.public_owner_id) &&
        v.sharing?.status !== 'copied_disabled' &&
        EL_VOICE_ID_RE.test(v.voice_id),
    )
    if (hit) return hit.voice_id
    if (!page.has_more || !page.next_page_token) break
    token = page.next_page_token
  }
  return null
}

/**
 * "The workspace already holds this voice". The spec documents only 200/422
 * for POST /v1/voices/add/{public_user_id}/{voice_id}, so the answer is
 * recognised by the error body's detail.status (kept in ProviderError.detail),
 * whatever the HTTP status (400, 409 or 422).
 */
export function isAlreadyAddedError(err: unknown): boolean {
  if (!isProviderError(err)) return false
  if (err.code === 'conflict') return true
  if (err.code !== 'validation') return false
  return /already[_ ]?(exists|added|in)|voice_already|duplicate/i.test(err.detail ?? '')
}

/** Adds the library voice to the shared workspace. `fresh` = we created this copy. */
async function addToWorkspace(lib: el.ELSharedVoice, log: Logger): Promise<{ voiceId: string; fresh: boolean }> {
  try {
    const added = await el.sharedVoices.add(lib.public_owner_id, lib.voice_id, displayName(lib.name))
    if (!added?.voice_id || !EL_VOICE_ID_RE.test(added.voice_id)) {
      throw new ProviderError({ system: 'elevenlabs', operation: 'shared_voices.add', code: 'bad_response', detail: 'missing voice_id' })
    }
    return { voiceId: added.voice_id, fresh: true }
  } catch (err) {
    // The workspace already holds a copy (e.g. added by the old flow, never
    // registered, or a registry row lost). Reuse it instead of failing.
    if (!isAlreadyAddedError(err)) throw err
    const existing = await findWorkspaceCopy(lib)
    if (!existing) throw err
    log.info('voice_provision.reused_workspace_copy', { voiceId: existing, libraryVoiceId: lib.voice_id })
    return { voiceId: existing, fresh: false }
  }
}

async function discardDuplicateCopy(voiceId: string, log: Logger): Promise<void> {
  try {
    await el.voices.delete(voiceId)
    log.info('voice_provision.duplicate_discarded', { voiceId })
  } catch (err) {
    // Not fatal for the caller (the winning copy is registered); ops must see it.
    log.error('voice_provision.duplicate_cleanup_failed', err, { voiceId })
  }
}

async function readWinner(db: SupabaseClient, libraryVoiceId: string, addedVoiceId: string): Promise<string> {
  const byLibrary = await registryByLibraryVoice(db, libraryVoiceId)
  if (byLibrary?.status === 'ready') return byLibrary.voice_id
  const byVoice = await registryByVoiceId(db, addedVoiceId)
  if (byVoice?.status === 'ready' && byVoice.owner_org_id === null) return byVoice.voice_id
  throw new Error('voice provisioning conflict without a ready registry row')
}

/**
 * Makes a public library voice usable by agents: one workspace copy per
 * library voice for the whole platform (owner_org_id NULL). Deduplicated by
 * the unique (provider, source_voice_id) index and race-safe: insert, and on a
 * unique violation re-select the winner and discard our extra copy.
 * Rate-limited per org (only when a provider call is actually needed) and
 * audited.
 */
export async function provisionLibraryVoice(params: {
  orgId: string
  userId: string
  libraryRef: LibraryRef
  libraryVoice?: el.ELSharedVoice | null
  log: Logger
}): Promise<{ voiceId: string; provisioned: boolean }> {
  const { orgId, userId, libraryRef } = params
  const log = params.log.child({ component: 'voice_provision' })
  const db = createAdminClient()

  const existing = await registryByLibraryVoice(db, libraryRef.voiceId)
  if (existing?.status === 'ready') {
    if (existing.owner_org_id !== null && existing.owner_org_id !== orgId) throw notAllowed()
    return { voiceId: existing.voice_id, provisioned: false }
  }

  await enforceRateLimit([RATE_LIMITS.voiceProvision], orgId)
  const lib = params.libraryVoice ?? (await findLibraryVoice(libraryRef.publicOwnerId, libraryRef.voiceId))
  if (!lib || lib.voice_id !== libraryRef.voiceId || lib.public_owner_id !== libraryRef.publicOwnerId) throw notAllowed()
  return provisionCore(db, lib, existing, { orgId, userId, kind: 'user' }, log)
}

interface ProvisionActor {
  /** Audit only: the row itself is platform-wide (owner_org_id NULL). */
  orgId: string | null
  userId: string | null
  kind: 'user' | 'admin_token' | 'admin_user' | 'system'
}

/**
 * Adds `lib` to the workspace (or reuses a copy already there) and registers it
 * as a platform-wide row; deduplicated and race-safe (see provisionLibraryVoice).
 */
async function provisionCore(
  db: SupabaseClient,
  lib: el.ELSharedVoice,
  existing: RegistryRow | null,
  actor: ProvisionActor,
  log: Logger,
): Promise<{ voiceId: string; provisioned: boolean }> {
  // A deleted/failed row: the workspace may still hold a usable copy (the
  // registry write was lost, or the voice was marked failed and came back).
  const reusable = existing ? await findWorkspaceCopy(lib) : null
  let added: { voiceId: string; fresh: boolean }
  if (reusable) {
    added = { voiceId: reusable, fresh: false }
  } else {
    // Adding a library voice counts as a voice add/edit operation of the shared workspace.
    await assertWorkspaceVoiceCapacity('library', log)
    added = await addToWorkspace(lib, log)
  }
  const row = {
    provider: 'elevenlabs',
    voice_id: added.voiceId,
    source: 'library',
    source_public_owner_id: lib.public_owner_id,
    source_voice_id: lib.voice_id,
    owner_org_id: null,
    name: displayName(lib.name),
    language: normalizeLanguage(lib.language),
    languages: libraryLanguages(lib),
    gender: normalizeGender(lib.gender),
    accent: humanize(lib.accent),
    category: lib.category ?? null,
    preview_url: publicHttpsUrl(lib.preview_url),
    status: 'ready',
    deleted_at: null,
    notice: null,
    retiring_at: null,
    // Platform-wide rows are readable by every tenant: the actor stays in audit_log only.
    created_by: null,
  }

  let winner: string
  if (existing) {
    // A deleted/failed row for this library voice: revive it, unless a
    // concurrent request already did (optimistic on status).
    const { data, error } = await db
      .from('provider_voices')
      .update(row)
      .eq('id', existing.id)
      .neq('status', 'ready')
      .select('voice_id')
    if (error && error.code !== UNIQUE_VIOLATION) throw new Error(`provider_voices update failed: ${error.message}`)
    const updated = !error && data && data.length ? (data[0].voice_id as string) : null
    winner = updated ?? (await readWinner(db, lib.voice_id, added.voiceId))
  } else {
    const { error } = await db.from('provider_voices').insert(row)
    if (error && error.code !== UNIQUE_VIOLATION) throw new Error(`provider_voices insert failed: ${error.message}`)
    // Unique violation = a concurrent request provisioned it first: use theirs.
    winner = error ? await readWinner(db, lib.voice_id, added.voiceId) : added.voiceId
  }

  if (winner !== added.voiceId) {
    if (added.fresh) await discardDuplicateCopy(added.voiceId, log)
    return { voiceId: winner, provisioned: false }
  }
  log.info('voice_provision.created', { voiceId: winner, libraryVoiceId: lib.voice_id, reusedCopy: !added.fresh })
  await writeAudit(
    db,
    {
      orgId: actor.orgId,
      userId: actor.userId,
      actorKind: actor.kind,
      action: 'voice.library.provisioned',
      targetId: winner,
      details: { library_voice_id: lib.voice_id, public_owner_id: lib.public_owner_id, name: displayName(lib.name), reused_copy: !added.fresh },
    },
    log,
  )
  return { voiceId: winner, provisioned: true }
}

/**
 * Platform (admin) provisioning of a curated library voice: no tenant rate
 * limit, audited with the admin actor. `lib` must come from a fresh,
 * server-side library lookup (findLibraryVoice).
 */
export async function provisionPlatformLibraryVoice(params: {
  lib: el.ELSharedVoice
  actor: { userId: string | null; kind: 'admin_token' | 'admin_user' }
  log: Logger
}): Promise<{ voiceId: string; provisioned: boolean }> {
  const db = createAdminClient()
  const log = params.log.child({ component: 'voice_provision' })
  const existing = await registryByLibraryVoice(db, params.lib.voice_id)
  if (existing?.status === 'ready') {
    if (existing.owner_org_id !== null) throw notAllowed()
    return { voiceId: existing.voice_id, provisioned: false }
  }
  return provisionCore(db, params.lib, existing, { orgId: null, userId: params.actor.userId, kind: params.actor.kind }, log)
}

// ─── Preview (TTS) ───────────────────────────────────────────────────────────

/** How a preview should sound: the agent's tuning and pronunciation dictionary, optionally the phone band. */
export interface PreviewSound {
  /** agents.voice_settings (stability / similarity / speed); null values = the agent defaults. */
  tuning?: VoiceTuning | null
  /** The org's dictionary version (resolved server-side from its own agent). */
  pronunciation?: PronunciationLocator | null
  /** 8 kHz WAV, like a phone call (otherwise MP3 22 kHz). */
  phoneQuality?: boolean
}

/** Same values the agent sends (conversation-behaviour ttsConfig), so a preview sounds like a call. */
export function previewVoiceSettings(tuning: VoiceTuning | null | undefined): { stability: number; similarity_boost: number; speed: number } {
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
  return {
    stability: clamp(tuning?.stability ?? TTS_TUNING_DEFAULTS.stability, 0, 1),
    similarity_boost: clamp(tuning?.similarity_boost ?? TTS_TUNING_DEFAULTS.similarity_boost, 0, 1),
    speed: clamp(tuning?.speed ?? TTS_TUNING_DEFAULTS.speed, 0.7, 1.2),
  }
}

// Zero retention (enable_logging=false) keeps tenant preview text and audio out
// of the shared workspace history. The spec reserves it for enterprise
// accounts: when the provider refuses it, previews fall back to logged
// requests for this instance (purged by the TTS-history retention instead).
let zeroRetentionRefused = false

function zeroRetentionWanted(): boolean {
  return process.env.ELEVENLABS_TTS_ZERO_RETENTION !== 'false' && !zeroRetentionRefused
}

function isZeroRetentionRefusal(err: unknown): boolean {
  return (
    isProviderError(err) &&
    (err.code === 'validation' || err.code === 'auth') &&
    /retention|enterprise|enable_logging|logging/i.test(err.detail ?? '')
  )
}

/** For tests. */
export function resetZeroRetentionState(): void {
  zeroRetentionRefused = false
}

async function previewTts(voiceId: string, text: string, language: string, sound: PreviewSound, log?: Logger): Promise<ArrayBuffer> {
  const model = previewTtsModel(language)
  const opts: el.TextToSpeechOptions = {
    voiceSettings: previewVoiceSettings(sound.tuning),
    pronunciationLocators: sound.pronunciation ? [locatorBody(sound.pronunciation)] : [],
    outputFormat: sound.phoneQuality ? 'wav_8000' : 'mp3_22050_32',
  }
  if (zeroRetentionWanted()) {
    try {
      return await el.textToSpeech(voiceId, text, model, language, { ...opts, enableLogging: false })
    } catch (err) {
      if (!isZeroRetentionRefusal(err)) throw err
      zeroRetentionRefused = true
      ;(log ?? createLogger({ component: 'voice_preview' })).warn('tts.zero_retention_refused', { detail: isProviderError(err) ? err.detail : null })
    }
  }
  return el.textToSpeech(voiceId, text, model, language, opts)
}

/**
 * Synthesizes a short preview with an eligible voice. A library voice that is
 * not provisioned yet cannot be synthesized (it is not in the workspace): the
 * caller gets VoiceNotProvisionedError and plays the public sample instead.
 * The preview uses the agent's model for the language, its voice tuning and
 * its pronunciation dictionary, so it sounds like a call.
 */
export async function synthesizePreview(params: {
  orgId: string
  voiceId: string
  libraryRef: LibraryRef | null
  text: string | null | undefined
  language: string
  /** The org's agent's current voice (platform-written after its own check). */
  currentAgentVoiceId?: string | null
  sound?: PreviewSound
  log?: Logger
}): Promise<ArrayBuffer> {
  if (!el.isConfigured()) throw new ProviderError({ system: 'elevenlabs', operation: 'tts.preview', code: 'not_configured' })
  const sound = params.sound ?? {}
  // The voice the org's agent already uses may predate the voice registry
  // (legacy agents) or be retiring: previewing it reveals nothing the org does not have.
  if (!params.libraryRef && params.currentAgentVoiceId && params.voiceId === params.currentAgentVoiceId) {
    const language = normalizeAgentLanguage(params.language)
    const text = cleanText(params.text ?? '', PREVIEW_TEXT_MAX_CHARS) || defaultPreviewText(language)
    return previewTts(params.voiceId, text, language, sound, params.log)
  }
  if (params.libraryRef) {
    // Cheap check first: no library lookup needed to know it cannot be spoken yet.
    const row = await registryByLibraryVoice(createAdminClient(), params.libraryRef.voiceId)
    if (!row || !visibleTo(row, params.orgId)) throw new VoiceNotProvisionedError(params.libraryRef)
  }
  const eligible = await assertVoiceEligible(params.orgId, {
    voiceId: params.voiceId,
    libraryRef: params.libraryRef,
    currentVoiceId: params.currentAgentVoiceId,
  })
  if (eligible.requiresProvisioning) throw new VoiceNotProvisionedError(eligible.libraryRef)
  const language = normalizeAgentLanguage(params.language)
  const text = cleanText(params.text ?? '', PREVIEW_TEXT_MAX_CHARS) || defaultPreviewText(language)
  return previewTts(eligible.voiceId, text, language, sound, params.log)
}

const PreviewBodySchema = z.object({
  voice_id: elVoiceIdSchema,
  library_ref: libraryRefSchema.nullish(),
  // Longer text is accepted and clipped to PREVIEW_TEXT_MAX_CHARS (old callers send whole greetings).
  text: z.string().max(2_000).nullish(),
  language: languageSchema.nullish(),
  /** 8 kHz WAV, like a phone line. */
  phone_quality: z.boolean().optional(),
})

export const PREVIEW_AUDIO_HEADERS = {
  'Content-Type': 'audio/mpeg',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
} as const

export const PREVIEW_WAV_HEADERS = { ...PREVIEW_AUDIO_HEADERS, 'Content-Type': 'audio/wav' } as const

/** POST handler body shared by /api/voices/preview and /api/agent/preview-voice. */
export async function handleVoicePreview(request: Request, route: string): Promise<Response> {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const body = await parseJsonBody(request, PreviewBodySchema, 16 * 1024)
    await enforceRateLimit([RATE_LIMITS.ttsPreview, RATE_LIMITS.ttsPreviewDaily], org.id)
    const { data: agentRow, error: agentErr } = await supabase
      .from('agents')
      .select('language, voice_id, voice_settings, pronunciation')
      .eq('org_id', org.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
    const language = body.language ?? normalizeAgentLanguage((agentRow?.language as string | null | undefined) ?? null)
    const audio = await synthesizePreview({
      orgId: org.id,
      voiceId: body.voice_id,
      libraryRef: toLibraryRef(body.library_ref),
      text: body.text,
      language,
      currentAgentVoiceId: (agentRow?.voice_id as string | null | undefined) ?? null,
      // The org's own agent row (RLS-bounded read): its tuning and dictionary version.
      sound: {
        tuning: readVoiceTuning(agentRow?.voice_settings),
        pronunciation: pronunciationLocatorOf(agentRow?.pronunciation),
        phoneQuality: body.phone_quality === true,
      },
      log,
    })
    return new Response(audio, { status: 200, headers: body.phone_quality ? PREVIEW_WAV_HEADERS : PREVIEW_AUDIO_HEADERS })
  } catch (err) {
    return voiceErrorResponse(err, log, `${route}.failed`, requestId)
  }
}

// ─── Instant voice cloning ───────────────────────────────────────────────────

export const CONSENT_STATEMENT_VERSION = '2026-10'

export const CLONE_LIMITS = {
  minFiles: 1,
  maxFiles: 3,
  /** Vercel rejects request bodies above 4.5 MB: keep the samples within 4 MB. */
  maxTotalBytes: 4 * 1024 * 1024,
  /** Whole multipart request (samples + fields + boundaries). */
  maxRequestBytes: 4.5 * 1024 * 1024,
  minFileBytes: 1024,
} as const

export type AudioKind = 'mp3' | 'wav' | 'ogg' | 'webm' | 'm4a'

/** Accepted declared MIME types (parameters such as ;codecs=opus stripped) → expected container. */
export const CLONE_MIME_TYPES: Readonly<Record<string, AudioKind>> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mpeg3': 'mp3',
  'audio/x-mpeg-3': 'mp3',
  'audio/x-mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/vnd.wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

/** Identifies the audio container from its first bytes (null = not an accepted format). */
export function sniffAudio(head: Uint8Array): AudioKind | null {
  if (head.length >= 12 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WAVE') return 'wav'
  if (head.length >= 4 && ascii(head, 0, 4) === 'OggS') return 'ogg'
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'webm'
  if (head.length >= 8 && ascii(head, 4, 4) === 'ftyp') return 'm4a'
  if (head.length >= 3 && ascii(head, 0, 3) === 'ID3') return 'mp3'
  // MPEG audio frame sync: 11 set bits, then a non-reserved version and layer.
  if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0 && ((head[1] >> 3) & 0x03) !== 0x01 && ((head[1] >> 1) & 0x03) !== 0x00) {
    return 'mp3'
  }
  return null
}

/** sha256 of the first X-Forwarded-For address (consent evidence without storing the IP). */
export function hashClientIp(forwardedFor: string | null): string | null {
  const ip = (forwardedFor ?? '').split(',')[0]?.trim()
  if (!ip || ip.length > 64) return null
  return crypto.createHash('sha256').update(ip).digest('hex')
}

export interface CloneSample {
  file: Blob
  kind: AudioKind
  mime: string
}

export const CLONE_NEEDS_VERIFICATION_MESSAGE = 'This voice could not be cloned automatically. Try different recordings.'

/**
 * ElevenLabs held the clone for speaker verification. The platform workspace
 * is shared, so the tenant can never complete that verification and nothing
 * promotes such a clone: it is deleted at the provider, registered only as a
 * 'deleted' row (consent evidence; never listed or selectable) and audited.
 */
async function rejectUnverifiedClone(
  db: SupabaseClient,
  p: { orgId: string; userId: string; voiceId: string; name: string; language: string | null; consent: Record<string, unknown>; files: number; log: Logger },
): Promise<never> {
  const { orgId, userId, voiceId, log } = p
  let providerDeleted = true
  try {
    await el.voices.delete(voiceId, { orgId })
  } catch (err) {
    if (isProviderError(err) && err.code === 'not_found') {
      log.info('voice_clone.already_gone_upstream', { voiceId })
    } else {
      providerDeleted = false
      log.error('voice_clone.verification_delete_failed', err, { voiceId })
    }
  }
  const now = new Date().toISOString()
  const { error } = await db.from('provider_voices').insert({
    provider: 'elevenlabs',
    voice_id: voiceId,
    source: 'cloned',
    owner_org_id: orgId,
    name: p.name,
    language: p.language,
    category: 'cloned',
    // 'failed' = never listed or usable, but still present at the provider:
    // the maintenance job retries the delete (purgeRejectedClones).
    status: providerDeleted ? 'deleted' : 'failed',
    deleted_at: providerDeleted ? now : null,
    consent: p.consent,
    created_by: userId,
  })
  if (error) log.error('voice_clone.rejected_register_failed', error, { voiceId })
  log.warn('voice_clone.rejected_verification', { voiceId, providerDeleted })
  await writeAudit(
    db,
    {
      orgId,
      userId,
      action: 'voice.clone.rejected_verification',
      targetId: voiceId,
      details: {
        name: p.name,
        language: p.language,
        files: p.files,
        statement_version: CONSENT_STATEMENT_VERSION,
        provider_deleted: providerDeleted,
      },
    },
    log,
  )
  throw new RequestError('invalid_request', CLONE_NEEDS_VERIFICATION_MESSAGE, 422, { reason: 'requires_verification' })
}

/** Provider-side description of the custom voices this platform creates (the orphan scan matches it). */
export function platformVoiceDescription(kind: 'clone' | 'designed', orgId: string): string {
  return `${kind === 'clone' ? 'Instant clone' : 'Designed voice'} for org ${orgId}`
}

/** Provider-side name: the workspace is shared, so the org is tagged for operators. */
export function platformVoiceName(name: string, orgId: string): string {
  const tag = ` [${orgId.slice(0, 8)}]`
  return `${displayName(name).slice(0, 100 - tag.length)}${tag}`
}

/**
 * Instant voice clone for one org. Audio is streamed to ElevenLabs and never
 * stored by us. The registry row (owner_org_id = org) makes the clone visible
 * to that org only; if it cannot be written, the clone is deleted again so no
 * unregistered voice is left in the shared workspace. A clone the provider
 * holds for verification is deleted and rejected with a 422.
 */
export async function createInstantClone(params: {
  orgId: string
  userId: string
  name: string
  speakerName: string
  language: string | null
  samples: CloneSample[]
  ipHash: string | null
  log: Logger
  gender?: 'female' | 'male' | 'neutral' | null
  /** The recordings have background noise: let the provider isolate the voice. */
  removeBackgroundNoise?: boolean
}): Promise<{ voice: VoiceOption }> {
  const { orgId, userId, samples } = params
  const log = params.log.child({ component: 'voice_clone' })
  const name = displayName(params.name)
  const speakerName = displayName(params.speakerName, '')
  const gender = params.gender ?? null
  const db = createAdminClient()

  const labels: Record<string, string> = {}
  if (params.language) labels.language = params.language
  if (gender) labels.gender = gender
  const created = await el.voices.addInstantClone(
    {
      name: platformVoiceName(name, orgId),
      description: platformVoiceDescription('clone', orgId),
      labels: Object.keys(labels).length ? labels : undefined,
      files: samples.map((s, i) => ({ blob: s.file, filename: `sample-${i + 1}.${s.kind}` })),
      removeBackgroundNoise: params.removeBackgroundNoise === true,
    },
    { orgId },
  )
  const voiceId = created?.voice_id
  if (!voiceId || !EL_VOICE_ID_RE.test(voiceId)) {
    throw new ProviderError({ system: 'elevenlabs', operation: 'voices.ivc', code: 'bad_response', detail: 'missing voice_id' })
  }
  const consent = {
    accepted_at: new Date().toISOString(),
    user_id: userId,
    speaker_name: speakerName,
    statement_version: CONSENT_STATEMENT_VERSION,
    ip_hash: params.ipHash,
  }
  if (created.requires_verification === true) {
    await rejectUnverifiedClone(db, { orgId, userId, voiceId, name, language: params.language, consent, files: samples.length, log })
  }

  const { error } = await db.from('provider_voices').insert({
    provider: 'elevenlabs',
    voice_id: voiceId,
    source: 'cloned',
    owner_org_id: orgId,
    name,
    language: params.language,
    languages: params.language ? [params.language] : null,
    gender,
    category: 'cloned',
    status: 'ready',
    consent,
    created_by: userId,
  })
  if (error) {
    log.error('voice_clone.register_failed', error, { voiceId })
    try {
      await el.voices.delete(voiceId, { orgId })
    } catch (delErr) {
      log.error('voice_clone.compensating_delete_failed', delErr, { voiceId })
    }
    throw new Error(`provider_voices insert failed: ${error.message}`)
  }
  // Two concurrent requests may both have passed the cap check: the later one is undone.
  const overCap = await capViolationAfterInsert(db, orgId, voiceId)
  if (overCap) {
    await discardCustomVoice(db, orgId, voiceId, log)
    throw overCap
  }
  log.info('voice_clone.created', { voiceId, files: samples.length })

  await writeAudit(
    db,
    {
      orgId,
      userId,
      action: 'voice.clone.created',
      targetId: voiceId,
      details: {
        name,
        language: params.language,
        files: samples.length,
        total_bytes: samples.reduce((n, s) => n + s.file.size, 0),
        statement_version: CONSENT_STATEMENT_VERSION,
        remove_background_noise: params.removeBackgroundNoise === true,
      },
    },
    log,
  )

  return {
    voice: {
      provider: 'elevenlabs',
      voiceId,
      name,
      description: null,
      language: params.language,
      accent: null,
      gender,
      age: null,
      category: 'cloned',
      source: 'cloned',
      previewUrl: null,
      requiresProvisioning: false,
      libraryRef: null,
    },
  }
}

/**
 * Undoes a custom voice created over the per-org cap: deleted at the provider,
 * registry row 'deleted' (or 'failed' when the provider delete failed, so the
 * maintenance purge retries it). Never throws.
 */
export async function discardCustomVoice(db: SupabaseClient, orgId: string, voiceId: string, log: Logger): Promise<void> {
  let providerDeleted = true
  try {
    await el.voices.delete(voiceId, { orgId })
  } catch (err) {
    if (!(isProviderError(err) && err.code === 'not_found')) {
      providerDeleted = false
      log.error('custom_voice.discard_delete_failed', err, { voiceId })
    }
  }
  const { error } = await db
    .from('provider_voices')
    .update({ status: providerDeleted ? 'deleted' : 'failed', deleted_at: providerDeleted ? new Date().toISOString() : null })
    .eq('provider', 'elevenlabs')
    .eq('voice_id', voiceId)
    .eq('owner_org_id', orgId)
  if (error) log.error('custom_voice.discard_mark_failed', error, { voiceId })
  log.warn('custom_voice.discarded_over_cap', { voiceId, providerDeleted })
}

async function agentUsesVoice(db: SupabaseClient, orgId: string, voiceId: string): Promise<boolean> {
  const { data, error } = await db.from('agents').select('id').eq('org_id', orgId).eq('voice_id', voiceId).limit(1)
  if (error) throw new Error(`agents read failed: ${error.message}`)
  return (data ?? []).length > 0
}

/**
 * Deletes one of the org's own custom voices (cloned or designed). The row is
 * flagged 'deleted' first so it cannot be selected while the provider call
 * runs; a failed provider delete restores it. Refused (409) while the org's
 * agent uses the voice. The voice's previews are then purged from the shared
 * workspace's speech history.
 */
export async function deleteOrgClone(params: { orgId: string; userId: string; voiceId: string; log: Logger }): Promise<void> {
  const { orgId, userId, voiceId } = params
  const log = params.log.child({ component: 'voice_clone', voiceId })
  const db = createAdminClient()

  const { data, error } = await db
    .from('provider_voices')
    .select('id, status, source')
    .eq('provider', 'elevenlabs')
    .eq('voice_id', voiceId)
    .eq('owner_org_id', orgId)
    .in('source', ['cloned', 'designed'])
    .maybeSingle()
  if (error) throw new Error(`provider_voices read failed: ${error.message}`)
  const row = data as { id: string; status: RegistryStatus; source: RegistrySource } | null
  if (!row || row.status === 'deleted') throw new RequestError('not_found', 'Voice not found.', 404)

  const inUse = () => new RequestError('conflict', 'Your agent uses this voice. Choose another voice before deleting it.', 409)
  if (await agentUsesVoice(db, orgId, voiceId)) throw inUse()

  const restore = async () => {
    const { error: restoreErr } = await db
      .from('provider_voices')
      .update({ status: row.status, deleted_at: null })
      .eq('id', row.id)
      .eq('owner_org_id', orgId)
    if (restoreErr) log.error('voice_clone.restore_failed', restoreErr)
  }

  const { data: flagged, error: flagErr } = await db
    .from('provider_voices')
    .update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('owner_org_id', orgId)
    .neq('status', 'deleted')
    .select('id')
  if (flagErr) throw new Error(`provider_voices update failed: ${flagErr.message}`)
  if (!flagged?.length) throw new RequestError('not_found', 'Voice not found.', 404)

  // A selection may have landed between the first check and the flag.
  if (await agentUsesVoice(db, orgId, voiceId)) {
    await restore()
    throw inUse()
  }

  try {
    await el.voices.delete(voiceId, { orgId })
  } catch (err) {
    if (isProviderError(err) && err.code === 'not_found') {
      log.info('voice_clone.already_gone_upstream')
    } else {
      await restore()
      throw err
    }
  }
  log.info('voice_clone.deleted')
  await writeAudit(db, { orgId, userId, action: row.source === 'designed' ? 'voice.design.deleted' : 'voice.clone.deleted', targetId: voiceId, details: {} }, log)
  // Previews rendered in this voice may still be in the workspace history.
  await purgeVoiceHistory(voiceId, log)
}

// ─── Cartesia fallback voices ────────────────────────────────────────────────

export interface FallbackVoiceOption {
  voiceId: string
  name: string
  gender: 'female' | 'male' | 'neutral' | null
  language: string | null
  hasPreview: boolean
}



function speaksNatively(v: ct.CartesiaVoice, language: string): boolean {
  if (normalizeLanguage(v.language) === language) return true
  return (v.accents ?? []).some((a) => a.is_native === true && normalizeLanguage(a.locale) === language)
}

/** Cartesia voices for one language, native speakers first, then by name. */
export async function listFallbackVoices(language: string): Promise<FallbackVoiceOption[]> {
  const mapped = platformFallbackIds()
  const seen = new Set<string>()
  const voices: ct.CartesiaVoice[] = []
  let cursor: string | null = null
  for (let i = 0; i < 3; i++) {
    const page: Awaited<ReturnType<typeof ct.voices.list>> = await ct.voices.list({ language, limit: MAX_PAGE_SIZE, starting_after: cursor })
    for (const v of page.data ?? []) {
      if (seen.has(v.id) || !isAllowedFallbackVoice(v, mapped)) continue
      seen.add(v.id)
      voices.push(v)
    }
    if (!page.has_more || !page.next_page) break
    cursor = page.next_page
  }
  return voices
    .map((v) => ({ native: speaksNatively(v, language), v }))
    .sort((a, b) => Number(b.native) - Number(a.native) || a.v.name.localeCompare(b.v.name))
    .map(({ v }) => ({
      voiceId: v.id,
      name: displayName(v.name),
      gender: normalizeGender(v.gender),
      language: normalizeLanguage(v.language),
      hasPreview: typeof v.preview_file_url === 'string' && v.preview_file_url.length > 0,
    }))
}

/**
 * Loads a Cartesia voice a tenant may use for its fallback agent (also for the
 * PATCH /api/agent fallback_voice_id check). Unknown and private voices both
 * answer 404.
 */
export async function getAllowedFallbackVoice(voiceId: string): Promise<ct.CartesiaVoice> {
  if (!CARTESIA_VOICE_ID_RE.test(voiceId)) throw new RequestError('invalid_request', 'Invalid voice id.', 400)
  let voice: ct.CartesiaVoice
  try {
    voice = await ct.voices.get(voiceId)
  } catch (err) {
    if (isProviderError(err) && (err.code === 'not_found' || err.code === 'validation')) {
      throw new RequestError('not_found', 'Voice not found.', 404)
    }
    throw err
  }
  if (voice.id !== voiceId || !isAllowedFallbackVoice(voice, platformFallbackIds())) {
    throw new RequestError('not_found', 'Voice not found.', 404)
  }
  return voice
}

/**
 * Maintenance: custom voices whose provider delete failed (clones rejected for
 * verification, voices discarded over the per-org cap; status 'failed') are
 * deleted again; a voice already gone counts as done.
 */
export async function purgeRejectedClones(limit: number, log: Logger): Promise<{ purged: number; failed: number }> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('provider_voices')
    .select('id, voice_id, owner_org_id')
    .eq('provider', 'elevenlabs')
    .in('source', ['cloned', 'designed'])
    .eq('status', 'failed')
    .limit(limit)
  if (error) throw new Error(`provider_voices scan failed: ${error.message}`)
  let purged = 0
  let failed = 0
  for (const row of data ?? []) {
    try {
      await el.voices.delete(row.voice_id as string, { orgId: (row.owner_org_id as string | null) ?? undefined })
    } catch (err) {
      if (!(isProviderError(err) && err.code === 'not_found')) {
        failed++
        log.error('voice_clone.purge_failed', err, { voiceId: row.voice_id })
        continue
      }
    }
    const { error: updErr } = await db.from('provider_voices').update({ status: 'deleted', deleted_at: new Date().toISOString() }).eq('id', row.id)
    if (updErr) log.error('voice_clone.purge_mark_failed', updErr, { voiceId: row.voice_id })
    else purged++
  }
  return { purged, failed }
}
