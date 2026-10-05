import 'server-only'
// ─── Voice catalog: what an organization may list, preview, select and clone ──
//
// The ElevenLabs workspace is SHARED by every customer of the platform, so the
// provider's own listing (GET /v2/voices) would show one org's cloned voices to
// everyone, and any voice id a browser sends could point at another tenant's
// clone. Every voice-related route goes through this module instead.
//
// An organization may list / preview / select only:
//   (a) ElevenLabs default voices: voice_type=default, category "premade".
//       NOTE: ElevenLabs retires ALL default voices on 2026-12-31 (and they only
//       exist for accounts created before March 2026), so the catalog must keep
//       working when this set is empty: library voices are the long-term path.
//   (b) provider_voices registry rows that are platform-wide (owner_org_id NULL,
//       e.g. provisioned library voices) or owned by the org, with status ready.
//   (c) public Voice Library voices (GET /v1/shared-voices without live
//       moderation or custom rates and with a minimum notice period). They are
//       provisioned (added to the workspace + registered) before an agent uses
//       them, and eligibility is re-validated against the library server-side.
// Anything else in the workspace (other orgs' clones, unregistered generated or
// professional voices) is rejected with 403. Registry/audit writes use the
// service-role client: those tables have no tenant write policies.

import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { previewTtsModel } from '@/lib/elevenlabs/models'
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
import { cartesiaFallbackVoices, libraryMinNoticeDays } from './config'
import { ProviderError, isProviderError } from './errors'

// ─── Identifiers and shared input schemas ────────────────────────────────────

/** ElevenLabs voice ids are 20 alphanumerics today; the bound leaves room. */
export const EL_VOICE_ID_RE = /^[A-Za-z0-9]{8,64}$/
/** Voice Library public owner ids (64 hex chars today). */
export const EL_OWNER_ID_RE = /^[A-Za-z0-9]{8,128}$/
/** Cartesia voice ids are UUIDs. */
export const CARTESIA_VOICE_ID_RE = /^[A-Za-z0-9-]{8,64}$/
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
  if (err instanceof VoiceNotProvisionedError) {
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
}

const REGISTRY_COLUMNS =
  'id, provider, voice_id, source, source_public_owner_id, source_voice_id, owner_org_id, name, language, gender, accent, category, preview_url, status, created_at'

const UNIQUE_VIOLATION = '23505'

function visibleTo(row: RegistryRow, orgId: string): boolean {
  return row.status === 'ready' && (row.owner_org_id === null || row.owner_org_id === orgId)
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

function registryToOption(row: RegistryRow): VoiceOption {
  const libraryRef =
    row.source === 'library' && row.source_public_owner_id && row.source_voice_id
      ? { publicOwnerId: row.source_public_owner_id, voiceId: row.source_voice_id }
      : null
  return {
    provider: 'elevenlabs',
    voiceId: row.voice_id,
    name: displayName(row.name),
    description: null,
    language: normalizeLanguage(row.language),
    accent: row.accent ?? null,
    gender: normalizeGender(row.gender),
    age: null,
    category: row.category ?? (row.source === 'cloned' ? 'cloned' : null),
    source: row.source,
    previewUrl: publicHttpsUrl(row.preview_url),
    requiresProvisioning: false,
    libraryRef,
  }
}

async function writeAudit(
  db: SupabaseClient,
  entry: { orgId: string; userId: string | null; action: string; targetId: string; details: Record<string, unknown> },
  log: Logger,
): Promise<void> {
  const { error } = await db.from('audit_log').insert({
    org_id: entry.orgId,
    actor_user_id: entry.userId,
    actor_kind: 'user',
    action: entry.action,
    target_type: 'provider_voice',
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

/** Default (premade) voices. Expire 2026-12-31 at ElevenLabs: may legitimately be empty. */
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

function defaultToOption(v: el.ELVoice, language: string | undefined): VoiceOption | null {
  const labels = v.labels ?? {}
  const verified = v.verified_languages ?? []
  const labelLanguage = normalizeLanguage(labels.language)
  const match = language ? verified.find((l) => normalizeLanguage(l.language) === language) : undefined
  if (language && !match && labelLanguage !== language && !(language === 'en' && !labelLanguage && verified.length === 0)) {
    return null
  }
  return {
    provider: 'elevenlabs',
    voiceId: v.voice_id,
    name: displayName(v.name),
    description: v.description?.trim() || humanize(labels.description) || null,
    language: match ? (language as string) : labelLanguage ?? normalizeLanguage(verified[0]?.language) ?? null,
    accent: match?.accent ?? humanize(labels.accent),
    gender: normalizeGender(labels.gender),
    age: humanize(labels.age),
    category: v.category,
    source: 'premade',
    previewUrl: publicHttpsUrl(match?.preview_url) ?? publicHttpsUrl(v.preview_url),
    requiresProvisioning: false,
    libraryRef: null,
  }
}

// ─── Voice Library (shared voices) ───────────────────────────────────────────

/** Library entries we accept: no live moderation, no custom rate, long enough notice period. */
function isUsableLibraryVoice(v: el.ELSharedVoice): boolean {
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

export interface VoiceCatalogQuery {
  source: 'workspace' | 'library'
  search?: string | null
  language?: string | null
  gender?: 'female' | 'male' | 'neutral' | null
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
  assertUuid(orgId) // the only interpolated value in the filter below, and it is a server-side UUID
  let query = db
    .from('provider_voices')
    .select(REGISTRY_COLUMNS)
    .eq('provider', 'elevenlabs')
    .eq('status', 'ready')
    .or(`owner_org_id.is.null,owner_org_id.eq.${orgId}`)
  if (q.search) query = query.ilike('name', `%${q.search}%`)
  if (q.language) query = query.eq('language', q.language)
  if (q.gender) query = query.eq('gender', q.gender)
  const { data, error } = await query
    .order('owner_org_id', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(`provider_voices read failed: ${error.message}`)
  return (data as RegistryRow[] | null) ?? []
}

async function filteredDefaultVoices(q: NormalizedQuery): Promise<VoiceOption[]> {
  const needle = q.search?.toLowerCase()
  return (await defaultVoices())
    .map((v) => ({ v, option: defaultToOption(v, q.language) }))
    .filter((x): x is { v: el.ELVoice; option: VoiceOption } => x.option !== null)
    .filter(({ option }) => !q.gender || option.gender === q.gender)
    .filter(({ v, option }) => {
      if (!needle) return true
      const hay = [option.name, option.description, option.accent, ...Object.values(v.labels ?? {})].join(' ').toLowerCase()
      return hay.includes(needle)
    })
    .map(({ option }) => option)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Registry rows visible to the org first (its own voices, then platform ones), then default voices. */
async function listWorkspaceVoices(orgId: string, q: NormalizedQuery, cursor: PageCursor | null): Promise<VoiceCatalogPage> {
  const voices: VoiceOption[] = []
  let defaultsOffset = 0
  if (!cursor || cursor.p === 'r') {
    const offset = cursor && cursor.p === 'r' ? cursor.o : 0
    const rows = await registryPage(createAdminClient(), orgId, q, offset, q.pageSize + 1)
    voices.push(...rows.slice(0, q.pageSize).map(registryToOption))
    if (rows.length > q.pageSize) {
      return { voices, next_page_token: encodeCursor({ v: 1, p: 'r', o: offset + q.pageSize }) }
    }
  } else if (cursor.p === 'd') {
    defaultsOffset = cursor.o
  }
  const seen = new Set(voices.map((v) => v.voiceId))
  const defaults = (await filteredDefaultVoices(q)).filter((v) => !seen.has(v.voiceId))
  const slice = defaults.slice(defaultsOffset, defaultsOffset + (q.pageSize - voices.length))
  voices.push(...slice)
  const nextOffset = defaultsOffset + slice.length
  return { voices, next_page_token: nextOffset < defaults.length ? encodeCursor({ v: 1, p: 'd', o: nextOffset }) : null }
}

async function listLibraryVoices(q: NormalizedQuery, page: number): Promise<VoiceCatalogPage> {
  const res = await el.sharedVoices.list({
    search: q.search,
    language: q.language,
    gender: q.gender,
    page,
    page_size: q.pageSize,
    min_notice_period_days: libraryMinNoticeDays(),
  })
  const usable = (res.voices ?? []).filter(isUsableLibraryVoice)
  const provisioned = await provisionedLibraryMap(
    createAdminClient(),
    usable.map((v) => v.voice_id),
  )
  return {
    voices: usable.map((v) => libraryToOption(v, q.language, provisioned.get(v.voice_id) ?? null)),
    next_page_token: res.has_more ? encodeCursor({ v: 1, p: 'l', n: page + 1 }) : null,
  }
}

/**
 * Voices an organization may pick. `workspace`: registry rows visible to the
 * org + ElevenLabs default voices (opaque offset token). `library`: public
 * Voice Library (page-number token), with already-provisioned voices carrying
 * their workspace voice id and requiresProvisioning=false.
 */
export async function listVoices(orgId: string, query: VoiceCatalogQuery): Promise<VoiceCatalogPage> {
  const pageSize = Math.min(Math.max(Math.floor(query.pageSize ?? DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE)
  const q: NormalizedQuery = {
    search: cleanSearch(query.search),
    language: normalizeLanguage(query.language) ?? undefined,
    gender: query.gender ?? undefined,
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
 */
export async function assertVoiceEligible(orgId: string, ref: { voiceId: string; libraryRef?: LibraryRef | null }): Promise<EligibleVoice> {
  const { voiceId } = ref
  const libraryRef = ref.libraryRef ?? null
  if (!EL_VOICE_ID_RE.test(voiceId)) throw new RequestError('invalid_request', 'Invalid voice id.', 400)
  const db = createAdminClient()

  if (libraryRef) {
    if (!EL_VOICE_ID_RE.test(libraryRef.voiceId) || !EL_OWNER_ID_RE.test(libraryRef.publicOwnerId)) throw notAllowed()
    const row = await registryByLibraryVoice(db, libraryRef.voiceId)
    if (row && visibleTo(row, orgId)) {
      if (voiceId !== row.voice_id && voiceId !== libraryRef.voiceId) throw notAllowed()
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
    const hit = (page.voices ?? []).find((v) => v.sharing?.original_voice_id === lib.voice_id && EL_VOICE_ID_RE.test(v.voice_id))
    if (hit) return hit.voice_id
    if (!page.has_more || !page.next_page_token) break
    token = page.next_page_token
  }
  return null
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
    // 409 voice_already_exists: the workspace already holds a copy (e.g. added
    // by the old flow, never registered). Reuse it instead of failing.
    if (!isProviderError(err) || err.code !== 'conflict') throw err
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

  const added = await addToWorkspace(lib, log)
  const row = {
    provider: 'elevenlabs',
    voice_id: added.voiceId,
    source: 'library',
    source_public_owner_id: lib.public_owner_id,
    source_voice_id: lib.voice_id,
    owner_org_id: null,
    name: displayName(lib.name),
    language: normalizeLanguage(lib.language),
    gender: normalizeGender(lib.gender),
    accent: humanize(lib.accent),
    category: lib.category ?? null,
    preview_url: publicHttpsUrl(lib.preview_url),
    status: 'ready',
    deleted_at: null,
    created_by: userId,
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
      orgId,
      userId,
      action: 'voice.library.provisioned',
      targetId: winner,
      details: { library_voice_id: lib.voice_id, public_owner_id: lib.public_owner_id, name: displayName(lib.name), reused_copy: !added.fresh },
    },
    log,
  )
  return { voiceId: winner, provisioned: true }
}

// ─── Preview (TTS) ───────────────────────────────────────────────────────────

/**
 * Synthesizes a short preview with an eligible voice. A library voice that is
 * not provisioned yet cannot be synthesized (it is not in the workspace): the
 * caller gets VoiceNotProvisionedError and plays the public sample instead.
 */
export async function synthesizePreview(params: {
  orgId: string
  voiceId: string
  libraryRef: LibraryRef | null
  text: string | null | undefined
  language: string
}): Promise<ArrayBuffer> {
  if (!el.isConfigured()) throw new ProviderError({ system: 'elevenlabs', operation: 'tts.preview', code: 'not_configured' })
  if (params.libraryRef) {
    // Cheap check first: no library lookup needed to know it cannot be spoken yet.
    const row = await registryByLibraryVoice(createAdminClient(), params.libraryRef.voiceId)
    if (!row || !visibleTo(row, params.orgId)) throw new VoiceNotProvisionedError(params.libraryRef)
  }
  const eligible = await assertVoiceEligible(params.orgId, { voiceId: params.voiceId, libraryRef: params.libraryRef })
  if (eligible.requiresProvisioning) throw new VoiceNotProvisionedError(eligible.libraryRef)
  const language = normalizeAgentLanguage(params.language)
  const text = cleanText(params.text ?? '', PREVIEW_TEXT_MAX_CHARS) || defaultPreviewText(language)
  return el.textToSpeech(eligible.voiceId, text, previewTtsModel(language), language)
}

const PreviewBodySchema = z.object({
  voice_id: elVoiceIdSchema,
  library_ref: libraryRefSchema.nullish(),
  // Longer text is accepted and clipped to PREVIEW_TEXT_MAX_CHARS (old callers send whole greetings).
  text: z.string().max(2_000).nullish(),
  language: languageSchema.nullish(),
})

export const PREVIEW_AUDIO_HEADERS = {
  'Content-Type': 'audio/mpeg',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
} as const

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
    const language = body.language ?? (await orgAgentLanguage(supabase, org.id))
    const audio = await synthesizePreview({
      orgId: org.id,
      voiceId: body.voice_id,
      libraryRef: toLibraryRef(body.library_ref),
      text: body.text,
      language,
    })
    return new Response(audio, { status: 200, headers: PREVIEW_AUDIO_HEADERS })
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

/**
 * Instant voice clone for one org. Audio is streamed to ElevenLabs and never
 * stored by us. The registry row (owner_org_id = org) makes the clone visible
 * to that org only; if it cannot be written, the clone is deleted again so no
 * unregistered voice is left in the shared workspace.
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
}): Promise<{ voice: VoiceOption; requiresVerification: boolean }> {
  const { orgId, userId, samples } = params
  const log = params.log.child({ component: 'voice_clone' })
  const name = displayName(params.name)
  const speakerName = displayName(params.speakerName, '')
  const db = createAdminClient()

  const created = await el.voices.addInstantClone(
    {
      // The workspace is shared: tag the provider-side name/description with the org for operators.
      name: `${name} [${orgId.slice(0, 8)}]`.slice(0, 100),
      description: `Instant clone for org ${orgId}`,
      labels: params.language ? { language: params.language } : undefined,
      files: samples.map((s, i) => ({ blob: s.file, filename: `sample-${i + 1}.${s.kind}` })),
    },
    { orgId },
  )
  const voiceId = created?.voice_id
  if (!voiceId || !EL_VOICE_ID_RE.test(voiceId)) {
    throw new ProviderError({ system: 'elevenlabs', operation: 'voices.ivc', code: 'bad_response', detail: 'missing voice_id' })
  }
  const requiresVerification = created.requires_verification === true

  const consent = {
    accepted_at: new Date().toISOString(),
    user_id: userId,
    speaker_name: speakerName,
    statement_version: CONSENT_STATEMENT_VERSION,
    ip_hash: params.ipHash,
  }
  const { error } = await db.from('provider_voices').insert({
    provider: 'elevenlabs',
    voice_id: voiceId,
    source: 'cloned',
    owner_org_id: orgId,
    name,
    language: params.language,
    category: 'cloned',
    status: requiresVerification ? 'pending' : 'ready',
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
  if (requiresVerification) log.warn('voice_clone.requires_verification', { voiceId })
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
        requires_verification: requiresVerification,
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
      gender: null,
      age: null,
      category: 'cloned',
      source: 'cloned',
      previewUrl: null,
      requiresProvisioning: false,
      libraryRef: null,
    },
    requiresVerification,
  }
}

async function agentUsesVoice(db: SupabaseClient, orgId: string, voiceId: string): Promise<boolean> {
  const { data, error } = await db.from('agents').select('id').eq('org_id', orgId).eq('voice_id', voiceId).limit(1)
  if (error) throw new Error(`agents read failed: ${error.message}`)
  return (data ?? []).length > 0
}

/**
 * Deletes one of the org's own clones. The row is flagged 'deleted' first so
 * it cannot be selected while the provider call runs; a failed provider delete
 * restores it. Refused (409) while the org's agent uses the voice.
 */
export async function deleteOrgClone(params: { orgId: string; userId: string; voiceId: string; log: Logger }): Promise<void> {
  const { orgId, userId, voiceId } = params
  const log = params.log.child({ component: 'voice_clone', voiceId })
  const db = createAdminClient()

  const { data, error } = await db
    .from('provider_voices')
    .select('id, status')
    .eq('provider', 'elevenlabs')
    .eq('voice_id', voiceId)
    .eq('owner_org_id', orgId)
    .eq('source', 'cloned')
    .maybeSingle()
  if (error) throw new Error(`provider_voices read failed: ${error.message}`)
  const row = data as { id: string; status: RegistryStatus } | null
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
  await writeAudit(db, { orgId, userId, action: 'voice.clone.deleted', targetId: voiceId, details: {} }, log)
}

// ─── Cartesia fallback voices ────────────────────────────────────────────────

export interface FallbackVoiceOption {
  voiceId: string
  name: string
  gender: 'female' | 'male' | 'neutral' | null
  language: string | null
  hasPreview: boolean
}

function isPublicCartesiaVoice(v: ct.CartesiaVoice): boolean {
  const access = typeof v.access === 'string' ? v.access : v.access?.type
  return access === 'public' || v.is_owner === false
}

function platformFallbackIds(): Set<string> {
  return new Set(Object.values(cartesiaFallbackVoices()))
}

/**
 * Voices a tenant may see or pick for the fallback agent: public Cartesia
 * voices plus the platform's explicitly mapped ones. Private voices of the
 * platform account (if any) are never offered otherwise.
 */
function isAllowedFallbackVoice(v: ct.CartesiaVoice, mapped: Set<string>): boolean {
  return CARTESIA_VOICE_ID_RE.test(v.id) && (v.status ?? 'active') === 'active' && (isPublicCartesiaVoice(v) || mapped.has(v.id))
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
