// Pure voice catalogue logic: language/accent/native filtering, mapping
// Cartesia voices and our clones to the provider-neutral Voice type, and
// filling one page of results from Cartesia's cursor pages. No I/O here, so
// the rules are unit tested (filters.test.ts).

import type { CartesiaVoice, CartesiaVoiceAccent } from '@/lib/cartesia/types'
import type { Voice, VoiceClone } from '@/types'

export type VoiceGenderFilter = 'masculine' | 'feminine' | 'gender_neutral'

export interface VoiceFilters {
  /** Free-text search (name, description); matched upstream for the catalogue. */
  q: string | null
  gender: VoiceGenderFilter | null
  /** ISO 639-1 base language. */
  language: string | null
  /** Accent id (`british`) or locale (`en-GB`). */
  accent: string | null
  /** Only voices whose matching accent is native (default when a language is picked). */
  nativeOnly: boolean
}

/** 'en-US' → 'en', 'pt_BR' → 'pt'. */
export function localeLanguage(locale: string | null | undefined): string | null {
  const base = (locale ?? '').trim().toLowerCase().split(/[-_]/)[0]
  return /^[a-z]{2,3}$/.test(base) ? base : null
}

/** Lower-case, accents stripped: "Solène" and "solene" match. */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

function accentMatches(entry: CartesiaVoiceAccent, accent: string): boolean {
  const wanted = accent.trim().toLowerCase()
  return entry.accent.toLowerCase() === wanted || entry.locale.toLowerCase().replace('_', '-') === wanted.replace('_', '-')
}

/**
 * Whether a voice fits the language/accent filters.
 * - No language and no accent: everything.
 * - One accent entry must satisfy every active constraint at once: its locale
 *   is in the language, it is the requested accent, and it is native when
 *   nativeOnly is on. So "English, British, native" means British-born voices,
 *   not an American voice that can also do a British accent.
 * - Voices without accents[] (older records) fall back to the deprecated
 *   top-level language and never match an accent filter.
 */
export function matchesAccentFilters(
  voice: { accents: CartesiaVoiceAccent[]; language: string | null },
  filters: Pick<VoiceFilters, 'language' | 'accent' | 'nativeOnly'>
): boolean {
  const language = filters.language?.trim().toLowerCase() || null
  const accent = filters.accent?.trim() || null
  if (!language && !accent) return true

  if (voice.accents.length === 0) {
    if (accent) return false
    return localeLanguage(voice.language) === language
  }

  return voice.accents.some(
    (entry) =>
      (!language || localeLanguage(entry.locale) === language) &&
      (!accent || accentMatches(entry, accent)) &&
      (!filters.nativeOnly || entry.is_native)
  )
}

/** Language of the voice's native accent, else the deprecated top-level language. */
export function nativeLanguageOf(voice: { accents: CartesiaVoiceAccent[]; language: string | null }): string | null {
  const native = voice.accents.find((a) => a.is_native)
  return localeLanguage(native?.locale) ?? localeLanguage(voice.language)
}

export function previewPathFor(voiceId: string): string {
  return `/api/voices/${encodeURIComponent(voiceId)}/preview`
}

export function toVoice(voice: CartesiaVoice): Voice {
  return {
    provider: 'cartesia',
    id: voice.id,
    name: voice.name,
    description: voice.description,
    tagline: voice.tagline,
    gender: voice.gender,
    language: nativeLanguageOf(voice),
    accents: voice.accents.map((a) => ({ accent: a.accent, locale: a.locale, is_native: a.is_native })),
    is_owner: false,
    is_pro: voice.is_pro,
    preview_url: previewPathFor(voice.id),
  }
}

export type CloneRow = Pick<
  VoiceClone,
  'id' | 'cartesia_voice_id' | 'elevenlabs_voice_id' | 'name' | 'language' | 'accent' | 'gender' | 'status' | 'created_at'
>

export function cloneToVoice(clone: CloneRow): Voice {
  const language = localeLanguage(clone.language)
  return {
    provider: 'cartesia',
    id: clone.cartesia_voice_id,
    name: clone.name,
    description: 'Cloned from your recording',
    tagline: 'Your voice',
    gender: clone.gender,
    language,
    // Clones record the accent id only; the locale is the recording language.
    accents: clone.accent && language ? [{ accent: clone.accent, locale: language, is_native: true }] : [],
    is_owner: true,
    is_pro: false,
    preview_url: previewPathFor(clone.cartesia_voice_id),
  }
}

/** Same rules as the catalogue, applied locally to the organisation's clones. */
export function cloneMatchesFilters(clone: CloneRow, filters: VoiceFilters): boolean {
  if (filters.gender && clone.gender !== filters.gender) return false
  if (filters.q) {
    const q = foldText(filters.q)
    if (q && !foldText(clone.name).includes(q)) return false
  }
  const language = filters.language?.trim().toLowerCase() || null
  if (language && localeLanguage(clone.language) !== language) return false
  if (filters.accent) {
    const accent = filters.accent.trim().toLowerCase()
    if ((clone.accent ?? '').toLowerCase() !== accent) return false
  }
  return true
}

/**
 * Only the public library belongs in the shared catalogue. Clones made by any
 * customer live in the same Cartesia account (is_owner: true) and must never
 * be listed to another organisation.
 */
export function isPublicLibraryVoice(voice: Pick<CartesiaVoice, 'id' | 'is_owner' | 'access'>): boolean {
  if (!voice.id || voice.is_owner) return false
  return voice.access === null || voice.access === 'public'
}

export interface CatalogPage {
  data: CartesiaVoice[]
  has_more: boolean
  /** Cursor for the next upstream page (last id of the unfiltered page). */
  next_page: string | null
}

/**
 * Fills one result page from Cartesia's cursor pages, which are filtered after
 * the fact (native accents, accent ids). Stops after `maxPages` upstream pages
 * so a rare filter can't scan the whole library in one request; the returned
 * cursor resumes exactly where scanning stopped.
 */
export async function collectVoices(input: {
  fetchPage: (startingAfter: string | null) => Promise<CatalogPage>
  filters: VoiceFilters
  cursor: string | null
  limit: number
  maxPages: number
}): Promise<{ voices: Voice[]; nextCursor: string | null }> {
  const voices: Voice[] = []
  let startingAfter = input.cursor
  for (let pageIndex = 0; pageIndex < input.maxPages; pageIndex++) {
    const page = await input.fetchPage(startingAfter)
    for (let i = 0; i < page.data.length; i++) {
      const voice = page.data[i]
      if (!isPublicLibraryVoice(voice)) continue
      if (!matchesAccentFilters(voice, input.filters)) continue
      voices.push(toVoice(voice))
      if (voices.length >= input.limit) {
        const moreInPage = i < page.data.length - 1
        if (moreInPage) return { voices, nextCursor: voice.id }
        return { voices, nextCursor: page.has_more ? page.next_page : null }
      }
    }
    if (!page.has_more || !page.next_page) return { voices, nextCursor: null }
    startingAfter = page.next_page
  }
  return { voices, nextCursor: startingAfter }
}
