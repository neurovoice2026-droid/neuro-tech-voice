import { describe, expect, it, vi } from 'vitest'
import type { CartesiaVoice } from '@/lib/cartesia/types'
import {
  cloneMatchesFilters,
  cloneToVoice,
  collectVoices,
  foldText,
  isPublicLibraryVoice,
  localeLanguage,
  matchesAccentFilters,
  nativeLanguageOf,
  toVoice,
  type CatalogPage,
  type CloneRow,
  type VoiceFilters,
} from './filters'

function voice(id: string, partial: Partial<CartesiaVoice> = {}): CartesiaVoice {
  return {
    id,
    name: `Voice ${id}`,
    description: null,
    tagline: null,
    gender: 'feminine',
    language: 'en',
    country: 'US',
    accents: [{ accent: 'general-american', locale: 'en-US', is_native: true }],
    is_owner: false,
    is_pro: false,
    status: 'active',
    access: 'public',
    visibility: 'all',
    created_at: null,
    ...partial,
  }
}

const skylar = voice('skylar', {
  accents: [
    { accent: 'general-american', locale: 'en-US', is_native: true },
    { accent: 'mexican', locale: 'es-MX', is_native: false },
    { accent: 'british', locale: 'en-GB', is_native: false },
  ],
})
const british = voice('british', { accents: [{ accent: 'british', locale: 'en-GB', is_native: true }] })
const marta = voice('marta', { language: 'es', accents: [{ accent: 'castilian', locale: 'es-ES', is_native: true }] })
const legacy = voice('legacy', { language: 'ro', accents: [] })

const none: Pick<VoiceFilters, 'language' | 'accent' | 'nativeOnly'> = { language: null, accent: null, nativeOnly: true }

describe('localeLanguage / foldText', () => {
  it('extracts the base language of a locale', () => {
    expect(localeLanguage('en-US')).toBe('en')
    expect(localeLanguage('pt_BR')).toBe('pt')
    expect(localeLanguage(' RO ')).toBe('ro')
    expect(localeLanguage('')).toBeNull()
    expect(localeLanguage(null)).toBeNull()
  })

  it('folds case and diacritics', () => {
    expect(foldText('Solène')).toBe('solene')
    expect(foldText('  ANDRADA ')).toBe('andrada')
    expect(foldText('Bună')).toBe('buna')
  })
})

describe('matchesAccentFilters', () => {
  it('matches everything without language or accent', () => {
    expect(matchesAccentFilters(skylar, none)).toBe(true)
    expect(matchesAccentFilters(legacy, none)).toBe(true)
  })

  it('keeps only native speakers of the language when nativeOnly is on', () => {
    const f = { language: 'es', accent: null, nativeOnly: true }
    expect(matchesAccentFilters(marta, f)).toBe(true)
    // Skylar can do a Mexican accent but isn't a native Spanish voice.
    expect(matchesAccentFilters(skylar, f)).toBe(false)
  })

  it('includes multilingual voices when nativeOnly is off', () => {
    const f = { language: 'es', accent: null, nativeOnly: false }
    expect(matchesAccentFilters(skylar, f)).toBe(true)
    expect(matchesAccentFilters(marta, f)).toBe(true)
    expect(matchesAccentFilters(british, f)).toBe(false)
  })

  it('requires the language, accent and native constraints on the same accent entry', () => {
    const nativeBritish = { language: 'en', accent: 'british', nativeOnly: true }
    expect(matchesAccentFilters(british, nativeBritish)).toBe(true)
    // Skylar is native en-US and has a non-native British accent: not a match.
    expect(matchesAccentFilters(skylar, nativeBritish)).toBe(false)
    expect(matchesAccentFilters(skylar, { ...nativeBritish, nativeOnly: false })).toBe(true)
  })

  it('accepts an accent locale instead of an id, case-insensitively', () => {
    expect(matchesAccentFilters(british, { language: null, accent: 'EN-gb', nativeOnly: true })).toBe(true)
    expect(matchesAccentFilters(british, { language: null, accent: 'en_GB', nativeOnly: true })).toBe(true)
    expect(matchesAccentFilters(marta, { language: null, accent: 'en-GB', nativeOnly: true })).toBe(false)
  })

  it('falls back to the top-level language for voices without accents', () => {
    expect(matchesAccentFilters(legacy, { language: 'ro', accent: null, nativeOnly: true })).toBe(true)
    expect(matchesAccentFilters(legacy, { language: 'en', accent: null, nativeOnly: true })).toBe(false)
    expect(matchesAccentFilters(legacy, { language: 'ro', accent: 'romanian', nativeOnly: true })).toBe(false)
  })
})

describe('mapping', () => {
  it('maps a Cartesia voice with the native language and an app preview URL', () => {
    const mapped = toVoice(marta)
    expect(mapped).toMatchObject({
      provider: 'cartesia',
      id: 'marta',
      language: 'es',
      is_owner: false,
      preview_url: '/api/voices/marta/preview',
    })
    expect(mapped.accents).toEqual([{ accent: 'castilian', locale: 'es-ES', is_native: true }])
  })

  it('uses the native accent before the deprecated language field', () => {
    expect(nativeLanguageOf(voice('x', { language: 'en', accents: [{ accent: 'parisian', locale: 'fr-FR', is_native: true }] }))).toBe('fr')
    expect(nativeLanguageOf(legacy)).toBe('ro')
  })

  it('never exposes provider preview URLs', () => {
    const mapped = toVoice({ ...marta, preview_file_url: 'https://files.cartesia.ai/files/x/download' })
    expect(JSON.stringify(mapped)).not.toContain('cartesia.ai')
  })

  const clone: CloneRow = {
    id: 'row-1',
    cartesia_voice_id: 'clone-voice',
    elevenlabs_voice_id: null,
    name: 'Ana (owner)',
    language: 'ro',
    accent: 'romanian',
    gender: 'feminine',
    status: 'ready',
    created_at: '2026-09-01T00:00:00Z',
  }

  it('maps a clone as an owned voice', () => {
    expect(cloneToVoice(clone)).toMatchObject({
      id: 'clone-voice',
      is_owner: true,
      language: 'ro',
      accents: [{ accent: 'romanian', locale: 'ro', is_native: true }],
      preview_url: '/api/voices/clone-voice/preview',
    })
  })

  it('filters clones locally with the catalogue rules', () => {
    const f: VoiceFilters = { q: null, gender: null, language: null, accent: null, nativeOnly: true }
    expect(cloneMatchesFilters(clone, f)).toBe(true)
    expect(cloneMatchesFilters(clone, { ...f, q: 'ANA' })).toBe(true)
    expect(cloneMatchesFilters(clone, { ...f, q: 'bob' })).toBe(false)
    expect(cloneMatchesFilters(clone, { ...f, gender: 'masculine' })).toBe(false)
    expect(cloneMatchesFilters(clone, { ...f, language: 'en' })).toBe(false)
    expect(cloneMatchesFilters(clone, { ...f, language: 'ro', accent: 'Romanian' })).toBe(true)
    expect(cloneMatchesFilters(clone, { ...f, accent: 'moldovan' })).toBe(false)
  })
})

describe('isPublicLibraryVoice', () => {
  it('drops voices owned by the account (other customers’ clones)', () => {
    expect(isPublicLibraryVoice(voice('a'))).toBe(true)
    expect(isPublicLibraryVoice(voice('b', { is_owner: true }))).toBe(false)
    expect(isPublicLibraryVoice(voice('c', { access: 'private' }))).toBe(false)
    expect(isPublicLibraryVoice(voice('d', { access: null }))).toBe(true)
    expect(isPublicLibraryVoice(voice('', {}))).toBe(false)
  })
})

describe('collectVoices', () => {
  const filters: VoiceFilters = { q: null, gender: null, language: 'es', accent: null, nativeOnly: true }

  function pages(list: CartesiaVoice[][]): (startingAfter: string | null) => Promise<CatalogPage> {
    return async (startingAfter) => {
      const index = startingAfter === null ? 0 : list.findIndex((page) => page.at(-1)?.id === startingAfter) + 1
      const data = list[index] ?? []
      const hasMore = index < list.length - 1
      return { data, has_more: hasMore, next_page: hasMore ? data.at(-1)?.id ?? null : null }
    }
  }

  it('skips non-matching and private voices across pages until the page is full', async () => {
    const fetchPage = vi.fn(
      pages([
        [skylar, marta, voice('priv', { is_owner: true, language: 'es', accents: marta.accents })],
        [voice('es2', { accents: marta.accents }), voice('es3', { accents: marta.accents })],
      ])
    )
    const result = await collectVoices({ fetchPage, filters, cursor: null, limit: 3, maxPages: 5 })
    expect(result.voices.map((v) => v.id)).toEqual(['marta', 'es2', 'es3'])
    expect(result.nextCursor).toBeNull()
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('returns a cursor at the last returned voice when it stops mid-page', async () => {
    const fetchPage = pages([[marta, voice('es2', { accents: marta.accents }), voice('es3', { accents: marta.accents })], [voice('es4', { accents: marta.accents })]])
    const first = await collectVoices({ fetchPage, filters, cursor: null, limit: 2, maxPages: 5 })
    expect(first.voices.map((v) => v.id)).toEqual(['marta', 'es2'])
    expect(first.nextCursor).toBe('es2')
  })

  it('continues with the upstream cursor when the page ends exactly at the limit', async () => {
    const fetchPage = pages([[marta, voice('es2', { accents: marta.accents })], [voice('es3', { accents: marta.accents })]])
    const first = await collectVoices({ fetchPage, filters, cursor: null, limit: 2, maxPages: 5 })
    expect(first.nextCursor).toBe('es2')
    const second = await collectVoices({ fetchPage, filters, cursor: first.nextCursor, limit: 2, maxPages: 5 })
    expect(second.voices.map((v) => v.id)).toEqual(['es3'])
    expect(second.nextCursor).toBeNull()
  })

  it('stops after maxPages and hands back the cursor to resume from', async () => {
    const fetchPage = vi.fn(pages([[skylar], [british], [marta]]))
    const result = await collectVoices({ fetchPage, filters, cursor: null, limit: 10, maxPages: 2 })
    expect(result.voices).toEqual([])
    expect(result.nextCursor).toBe('british')
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })
})
