import 'server-only'
import { ApiError } from '@/lib/api/http'
import type { OrgContext } from '@/lib/api/auth'
import { cartesia, CartesiaError } from '@/lib/cartesia/client'
import type { CartesiaVoice } from '@/lib/cartesia/types'
import { kvGet, kvSet } from '@/lib/kv'
import type { Voice } from '@/types'
import {
  cloneToVoice,
  collectVoices,
  isPublicLibraryVoice,
  nativeLanguageOf,
  type CatalogPage,
  type CloneRow,
  type VoiceFilters,
} from './filters'
import { ACCENTS_KEY, catalogPageKey, normalizeQuery, voiceMetaKey } from './keys'

// Voice catalogue access: Cartesia's public library (cached in KV, shared by
// every org because it is the same for everyone) plus each organisation's own
// clones (always read live and scoped to the org; never cached across orgs).

const CATALOG_TTL_SECONDS = 600
const META_TTL_SECONDS = 3600
const MISSING_META_TTL_SECONDS = 300
const ACCENTS_TTL_SECONDS = 86_400
const MAX_UPSTREAM_PAGES = 4

export const CLONE_COLUMNS =
  'id, cartesia_voice_id, elevenlabs_voice_id, name, language, accent, gender, status, created_at, source_storage_path'

export type CloneRecord = CloneRow & { source_storage_path: string | null }

let warnedMissingClones = false

function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

async function fetchCatalogPage(query: { q: string | null; gender: string | null; language: string | null }, startingAfter: string | null): Promise<CatalogPage> {
  const key = catalogPageKey({ ...query, startingAfter })
  const cached = await kvGet<CatalogPage>(key)
  if (cached && Array.isArray(cached.data)) return cached

  const page = await cartesia.voices.list({
    q: query.q ?? undefined,
    gender: query.gender ?? undefined,
    language: query.language ?? undefined,
    limit: 100,
    startingAfter: startingAfter ?? undefined,
  })
  const value: CatalogPage = {
    // Private voices (every customer's clones share our Cartesia account) are
    // dropped before anything is cached or mapped.
    data: page.data.filter(isPublicLibraryVoice),
    has_more: page.has_more,
    next_page: page.next_page ?? page.data.at(-1)?.id ?? null,
  }
  await kvSet(key, value, CATALOG_TTL_SECONDS)
  return value
}

/** One page of the public Cartesia library matching the filters. */
export async function listCatalogVoices(
  filters: VoiceFilters,
  cursor: string | null,
  limit: number
): Promise<{ voices: Voice[]; nextCursor: string | null }> {
  const query = { q: normalizeQuery(filters.q), gender: filters.gender, language: filters.language }
  return collectVoices({
    fetchPage: (startingAfter) => fetchCatalogPage(query, startingAfter),
    filters,
    cursor,
    limit,
    maxPages: MAX_UPSTREAM_PAGES,
  })
}

/** The organisation's ready clones, newest first. RLS scopes the read to the owner as well. */
export async function listOrgClones(ctx: OrgContext): Promise<CloneRecord[]> {
  const { data, error } = await ctx.supabase
    .from('voice_clones')
    .select(CLONE_COLUMNS)
    .eq('org_id', ctx.org.id)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    if (isMissingTable(error)) {
      if (!warnedMissingClones) {
        warnedMissingClones = true
        console.warn('[voices] voice_clones is missing (apply migration 010); cloned voices are unavailable')
      }
      return []
    }
    console.error('[voices] loading clones failed', error.code, error.message)
    throw new ApiError(500, 'internal_error', 'We couldn’t load your voices. Please try again.')
  }
  return (data ?? []) as unknown as CloneRecord[]
}

export async function findOrgClone(ctx: OrgContext, voiceId: string): Promise<CloneRecord | null> {
  const { data, error } = await ctx.supabase
    .from('voice_clones')
    .select(CLONE_COLUMNS)
    .eq('org_id', ctx.org.id)
    .eq('cartesia_voice_id', voiceId)
    .eq('status', 'ready')
    .maybeSingle()
  if (error) {
    if (isMissingTable(error)) return null
    console.error('[voices] clone lookup failed', error.code, error.message)
    throw new ApiError(500, 'internal_error', 'We couldn’t check this voice. Please try again.')
  }
  return (data as unknown as CloneRecord | null) ?? null
}

export interface PublicVoiceMeta {
  id: string
  name: string
  gender: CartesiaVoice['gender']
  /** Native language (base code). */
  language: string | null
  has_preview_file: boolean
}

type CachedMeta = PublicVoiceMeta | { missing: true }

/**
 * Metadata of a public library voice, or null when the id doesn't exist or
 * belongs to a private voice (another customer's clone). Cached for an hour.
 */
export async function getPublicVoiceMeta(voiceId: string): Promise<PublicVoiceMeta | null> {
  const key = voiceMetaKey(voiceId)
  const cached = await kvGet<CachedMeta>(key)
  if (cached) return 'missing' in cached ? null : cached

  let voice: CartesiaVoice
  try {
    voice = await cartesia.voices.get(voiceId, { expandPreview: true })
  } catch (error) {
    if (error instanceof CartesiaError && (error.status === 404 || error.errorCode === 'voice_not_found' || error.status === 400)) {
      await kvSet(key, { missing: true }, MISSING_META_TTL_SECONDS)
      return null
    }
    throw error
  }
  if (!isPublicLibraryVoice(voice)) {
    await kvSet(key, { missing: true }, MISSING_META_TTL_SECONDS)
    return null
  }
  const meta: PublicVoiceMeta = {
    id: voice.id,
    name: voice.name,
    gender: voice.gender,
    language: nativeLanguageOf(voice),
    has_preview_file: Boolean(voice.preview_file_url),
  }
  await kvSet(key, meta, META_TTL_SECONDS)
  return meta
}

export type VoiceAccess =
  | { kind: 'clone'; voiceId: string; name: string; language: string | null; gender: CloneRow['gender']; clone: CloneRecord }
  | { kind: 'public'; voiceId: string; name: string; language: string | null; gender: CartesiaVoice['gender']; meta: PublicVoiceMeta }

/** Whether this organisation may use the voice: its own clone or a public library voice. */
export async function resolveVoiceAccess(ctx: OrgContext, voiceId: string): Promise<VoiceAccess | null> {
  const clone = await findOrgClone(ctx, voiceId)
  if (clone) {
    return { kind: 'clone', voiceId, name: clone.name, language: clone.language, gender: clone.gender, clone }
  }
  const meta = await getPublicVoiceMeta(voiceId)
  if (!meta) return null
  return { kind: 'public', voiceId, name: meta.name, language: meta.language, gender: meta.gender, meta }
}

export async function requireVoiceAccess(ctx: OrgContext, voiceId: string): Promise<VoiceAccess> {
  const access = await resolveVoiceAccess(ctx, voiceId)
  if (!access) {
    throw new ApiError(404, 'voice_not_found', 'This voice isn’t available. Please choose another voice.')
  }
  return access
}

export function clonesToVoices(clones: CloneRecord[]): Voice[] {
  return clones.map(cloneToVoice)
}

export interface AccentOption {
  id: string
  name: string
  language: string
  locale: string
}

/** Every Cartesia accent (78 today), cached for a day; filtered locally by language. */
export async function listAccents(language?: string | null): Promise<AccentOption[]> {
  let all = await kvGet<AccentOption[]>(ACCENTS_KEY)
  if (!Array.isArray(all)) {
    const accents = await cartesia.voices.listAccents()
    all = accents.map((a) => ({ id: a.id, name: a.name, language: a.language, locale: a.locale }))
    await kvSet(ACCENTS_KEY, all, ACCENTS_TTL_SECONDS)
  }
  const base = language?.trim().toLowerCase() || null
  return base ? all.filter((a) => a.language.toLowerCase() === base) : all
}
