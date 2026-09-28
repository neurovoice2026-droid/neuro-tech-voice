'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Plan, Voice } from '@/types'
import type { VoiceGender } from '@/components/voice/voice-options'
import { errorMessage, fetchJson, isAbort, VoiceApiError } from '@/components/voice/api'

// Voice catalogue data for the pickers.
// - useVoices: filtered library pages with debounced search, cursor paging
//   ("Load more"), an in-memory cache per query (5 minutes, like the API's
//   Cache-Control) and AbortController so a stale response never wins.
// - useVoiceClones: the organisation's own voices and what cloning allows.
// - useAccents: accent names for chips and the clone dialog.
// Creating or deleting a clone calls notifyVoicesChanged() so every mounted
// picker refetches.

export interface VoiceQuery {
  q: string
  language: string | null
  gender: VoiceGender | null
  accent: string | null
  /** Native speakers only (applies when a language or accent is set). */
  native: boolean
}

export const EMPTY_VOICE_QUERY: VoiceQuery = { q: '', language: null, gender: null, accent: null, native: true }

interface VoicesPage {
  voices: Voice[]
  next_cursor: string | null
}

interface CacheEntry {
  voices: Voice[]
  nextCursor: string | null
  at: number
}

const CACHE_TTL_MS = 5 * 60_000
const SEARCH_DEBOUNCE_MS = 300
const cache = new Map<string, CacheEntry>()

// ─── Change notifications ────────────────────────────────────────────────────

let version = 0
const versionListeners = new Set<() => void>()

/** Call after creating or deleting a voice: clears caches and refetches every picker. */
export function notifyVoicesChanged(): void {
  cache.clear()
  version++
  for (const listener of versionListeners) listener()
}

function useVoicesVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      versionListeners.add(listener)
      return () => versionListeners.delete(listener)
    },
    () => version,
    () => 0
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function buildParams(query: VoiceQuery, limit: number): URLSearchParams {
  const params = new URLSearchParams()
  const q = query.q.trim()
  if (q) params.set('q', q)
  if (query.language) params.set('language', query.language)
  if (query.gender) params.set('gender', query.gender)
  if (query.accent) params.set('accent', query.accent)
  params.set('native', query.native ? '1' : '0')
  params.set('limit', String(limit))
  return params
}

function dedupe(voices: Voice[]): Voice[] {
  const seen = new Set<string>()
  return voices.filter((voice) => (seen.has(voice.id) ? false : (seen.add(voice.id), true)))
}

/** Voices already loaded for a query (for example the same filters without an accent), if still fresh. */
export function peekCachedVoices(query: VoiceQuery, limit = 24): Voice[] | null {
  const entry = cache.get(buildParams(query, limit).toString())
  return entry && Date.now() - entry.at < CACHE_TTL_MS ? entry.voices : null
}

// ─── useVoices ───────────────────────────────────────────────────────────────

export interface UseVoicesResult {
  voices: Voice[]
  isLoading: boolean
  isLoadingMore: boolean
  error: VoiceApiError | null
  /** "Load more" failed; the voices already loaded stay on screen. */
  loadMoreError: VoiceApiError | null
  hasMore: boolean
  /** True while the search box value hasn't been applied yet. */
  isSearchPending: boolean
  loadMore: () => void
  retry: () => void
}

export function useVoices(query: VoiceQuery, options: { enabled?: boolean; limit?: number } = {}): UseVoicesResult {
  const enabled = options.enabled ?? true
  const limit = options.limit ?? 24
  const debouncedQ = useDebounced(query.q, SEARCH_DEBOUNCE_MS)
  const changeVersion = useVoicesVersion()
  const effective = useMemo<VoiceQuery>(
    () => ({ ...query, q: debouncedQ }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- q is applied through its debounced value
    [debouncedQ, query.language, query.gender, query.accent, query.native]
  )
  const key = useMemo(() => buildParams(effective, limit).toString(), [effective, limit])

  const [entry, setEntry] = useState<{ key: string; voices: Voice[]; nextCursor: string | null } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<VoiceApiError | null>(null)
  const [loadMoreFailure, setLoadMoreFailure] = useState<{ key: string; error: VoiceApiError } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!enabled) return
    controllerRef.current?.abort()
    const cached = cache.get(key)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setEntry({ key, voices: cached.voices, nextCursor: cached.nextCursor })
      setError(null)
      setIsLoading(false)
      return
    }
    const controller = new AbortController()
    controllerRef.current = controller
    setIsLoading(true)
    setError(null)
    fetchJson<VoicesPage>(`/api/voices?${key}`, { signal: controller.signal, cache: changeVersion > 0 ? 'reload' : 'default' })
      .then((page) => {
        const voices = dedupe(page.voices)
        cache.set(key, { voices, nextCursor: page.next_cursor, at: Date.now() })
        setEntry({ key, voices, nextCursor: page.next_cursor })
      })
      .catch((err: unknown) => {
        if (isAbort(err)) return
        setError(err instanceof VoiceApiError ? err : new VoiceApiError(0, 'unknown', errorMessage(err)))
      })
      .finally(() => {
        if (controllerRef.current === controller) {
          controllerRef.current = null
          setIsLoading(false)
        }
      })
    return () => controller.abort()
  }, [key, enabled, attempt, changeVersion])

  const current = entry?.key === key ? entry : null

  const loadMore = useCallback(() => {
    if (!current?.nextCursor || isLoadingMore) return
    const controller = new AbortController()
    controllerRef.current?.abort()
    controllerRef.current = controller
    setIsLoadingMore(true)
    setLoadMoreFailure(null)
    const params = new URLSearchParams(key)
    params.set('cursor', current.nextCursor)
    fetchJson<VoicesPage>(`/api/voices?${params.toString()}`, { signal: controller.signal })
      .then((page) => {
        const voices = dedupe([...current.voices, ...page.voices])
        cache.set(key, { voices, nextCursor: page.next_cursor, at: Date.now() })
        setEntry({ key, voices, nextCursor: page.next_cursor })
      })
      .catch((err: unknown) => {
        if (isAbort(err)) return
        setLoadMoreFailure({ key, error: err instanceof VoiceApiError ? err : new VoiceApiError(0, 'unknown', errorMessage(err)) })
      })
      .finally(() => {
        if (controllerRef.current === controller) controllerRef.current = null
        setIsLoadingMore(false)
      })
  }, [current, isLoadingMore, key])

  const retry = useCallback(() => {
    cache.delete(key)
    setAttempt((n) => n + 1)
  }, [key])

  return {
    voices: current?.voices ?? [],
    isLoading: enabled && (isLoading || (!current && !error)),
    isLoadingMore,
    error,
    loadMoreError: loadMoreFailure?.key === key ? loadMoreFailure.error : null,
    hasMore: Boolean(current?.nextCursor),
    isSearchPending: query.q !== debouncedQ,
    loadMore,
    retry,
  }
}

// ─── useVoiceClones ──────────────────────────────────────────────────────────

export interface CloningInfo {
  entitled: boolean
  required_plan: Plan
  count: number
  max: number
}

export function useVoiceClones(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true
  const changeVersion = useVoicesVersion()
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${changeVersion}:${attempt}`
  // The last settled response; earlier data stays on screen while a refetch runs.
  const [result, setResult] = useState<{
    key: string
    clones: Voice[]
    cloning: CloningInfo | null
    error: VoiceApiError | null
  } | null>(null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    fetchJson<VoicesPage & { cloning: CloningInfo }>('/api/voices?owner=mine', { signal: controller.signal, cache: 'no-store' })
      .then((data) => setResult({ key: requestKey, clones: data.voices, cloning: data.cloning, error: null }))
      .catch((err: unknown) => {
        if (isAbort(err)) return
        const error = err instanceof VoiceApiError ? err : new VoiceApiError(0, 'unknown', errorMessage(err))
        setResult((previous) => ({ key: requestKey, clones: previous?.clones ?? [], cloning: previous?.cloning ?? null, error }))
      })
    return () => controller.abort()
  }, [enabled, requestKey])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return {
    clones: result?.clones ?? [],
    cloning: result?.cloning ?? null,
    isLoading: enabled && result === null,
    isRefreshing: enabled && result !== null && result.key !== requestKey,
    error: result?.key === requestKey ? result.error : null,
    retry,
  }
}

// ─── useAccents ──────────────────────────────────────────────────────────────

export interface AccentOption {
  id: string
  name: string
  locale: string
  language: string
}

const accentCache = new Map<string, AccentOption[]>()

export function useAccents(language: string | null, options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true
  const cacheKey = language ?? '*'
  const [settled, setSettled] = useState<{ key: string; accents: AccentOption[]; failed: boolean } | null>(null)

  useEffect(() => {
    if (!enabled || accentCache.has(cacheKey)) return
    const controller = new AbortController()
    const params = language ? `?language=${encodeURIComponent(language)}` : ''
    fetchJson<{ accents: AccentOption[] }>(`/api/voices/accents${params}`, { signal: controller.signal })
      .then((data) => {
        accentCache.set(cacheKey, data.accents)
        setSettled({ key: cacheKey, accents: data.accents, failed: false })
      })
      .catch((err: unknown) => {
        if (isAbort(err)) return
        // Accent names are a nicety: chips fall back to readable ids.
        setSettled({ key: cacheKey, accents: [], failed: true })
      })
    return () => controller.abort()
  }, [cacheKey, language, enabled])

  const cached = accentCache.get(cacheKey)
  const current = settled?.key === cacheKey ? settled : null
  const accents = useMemo(() => cached ?? current?.accents ?? [], [cached, current])
  const names = useMemo(() => Object.fromEntries(accents.map((a) => [a.id, a.name])), [accents])
  return { accents, names, isLoading: enabled && !cached && !current, failed: current?.failed ?? false }
}
