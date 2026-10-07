'use client'

// Voice catalog client shared by onboarding (Step3Voice) and the dashboard
// (TabVoice): one data source (GET /api/voices), one set of filters, one way to
// save the agent's voice (PUT /api/agent/voice). Client-only — talks to our own
// API routes, never to a provider.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Agent, VoiceOption } from '@/types'

// ─── API error helpers ────────────────────────────────────────────────────────

/** An error response from one of our API routes (`{ error, code }` body). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
    /** Seconds from the `Retry-After` header (429/503), when present. */
    readonly retryAfter: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function fallbackMessageFor(status: number, fallback: string): string {
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'This action is not allowed for your account.'
  if (status === 413) return 'The upload is too large.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status === 503) return 'The voice service is temporarily unavailable. Please try again shortly.'
  return fallback
}

/** Reads `{ error, code }` from a failed response into an ApiError (never throws). */
export async function parseApiError(res: Response, fallback: string): Promise<ApiError> {
  // A non-JSON body (proxy error page, empty body) is expected here, so a parse
  // failure just means "no server message" and we use the status-based copy.
  const body: unknown = await res.json().catch(() => null)
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const serverMessage = typeof record?.error === 'string' && record.error.trim() ? record.error.trim() : null
  const code = typeof record?.code === 'string' ? record.code : null
  const retryHeader = Number(res.headers.get('retry-after'))
  const retryAfter = Number.isFinite(retryHeader) && retryHeader > 0 ? Math.ceil(retryHeader) : null
  return new ApiError(serverMessage ?? fallbackMessageFor(res.status, fallback), res.status, code, retryAfter)
}

/** A user-facing message for anything thrown by a fetch. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof TypeError) return 'Network error. Check your connection and try again.'
  return fallback
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

// ─── Saving the agent's voice (shared by onboarding and dashboard) ────────────

export interface LibraryRefBody {
  public_owner_id: string
  voice_id: string
}

export interface AgentVoiceBody {
  voice_id: string
  voice_name: string
  library_ref?: LibraryRefBody
}

export interface AgentVoiceSaveResult {
  agent: Agent
  voice_sync_status: 'synced' | 'failed' | 'pending'
  error?: string
}

/** `voice.libraryRef` in the request shape PUT /api/agent/voice expects. */
export function libraryRefBody(voice: VoiceOption): LibraryRefBody | undefined {
  return voice.libraryRef
    ? { public_owner_id: voice.libraryRef.publicOwnerId, voice_id: voice.libraryRef.voiceId }
    : undefined
}

export function agentVoiceBody(voice: VoiceOption): AgentVoiceBody {
  const library_ref = libraryRefBody(voice)
  return { voice_id: voice.voiceId, voice_name: voice.name, ...(library_ref ? { library_ref } : {}) }
}

/** PUT /api/agent/voice. Throws ApiError on a non-2xx response. */
export async function saveAgentVoice(body: AgentVoiceBody): Promise<AgentVoiceSaveResult> {
  const res = await fetch('/api/agent/voice', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await parseApiError(res, 'Could not save this voice. Please try again.')
  const data = (await res.json()) as Partial<AgentVoiceSaveResult>
  if (!data.agent || !data.voice_sync_status) {
    throw new ApiError('Unexpected response while saving the voice.', res.status)
  }
  return {
    agent: data.agent,
    voice_sync_status: data.voice_sync_status,
    ...(typeof data.error === 'string' ? { error: data.error } : {}),
  }
}

// ─── Catalog invalidation (e.g. after a clone is created or deleted) ─────────

export type VoiceCatalogSource = 'workspace' | 'library'

const catalogVersions: Record<VoiceCatalogSource, number> = { workspace: 0, library: 0 }
const catalogListeners = new Set<() => void>()

function subscribeCatalog(listener: () => void): () => void {
  catalogListeners.add(listener)
  return () => {
    catalogListeners.delete(listener)
  }
}

/** Makes every mounted catalog of this source refetch its first page. */
export function invalidateVoiceCatalog(source: VoiceCatalogSource = 'workspace'): void {
  catalogVersions[source] += 1
  for (const listener of catalogListeners) listener()
}

// ─── useVoiceCatalog ──────────────────────────────────────────────────────────

export type VoiceGenderFilter = 'all' | 'female' | 'male' | 'neutral'

/** Voice Library-only filters (GET /api/voices?source=library). */
export interface LibraryFilters {
  /** 'conversational' (phone-ready voices, the default) or 'all'. */
  useCase?: 'conversational' | 'all'
  /** An accent value from GET /api/voices/accents, or 'all'. */
  accent?: string
  /** 'young' | 'middle_aged' | 'old' | 'all'. */
  age?: string
  /** Studio-quality voices only. */
  highQuality?: boolean
  /** cloned_by_count (default) | trending | created_date | usage_character_count_1y. */
  sort?: string
}

export interface UseVoiceCatalogOptions {
  source: VoiceCatalogSource
  /** Raw search box value; debounced here (350 ms). */
  search?: string
  /** 'all' or an ISO 639-1 code. */
  language?: string
  gender?: VoiceGenderFilter
  /** Applied to the library source only. */
  library?: LibraryFilters
  pageSize?: number
  /** When false nothing is fetched (e.g. the tab is hidden); cached results stay. */
  enabled?: boolean
}

export interface VoiceCatalog {
  voices: VoiceOption[]
  /** First page for the current filters is in flight (voices may be the previous results). */
  isLoading: boolean
  /** The search box changed and the debounce has not fired yet. */
  isDebouncing: boolean
  isLoadingMore: boolean
  error: string | null
  loadMoreError: string | null
  hasMore: boolean
  loadMore: () => void
  /** Refetches the first page (after an error, or to refresh). */
  retry: () => void
}

interface VoicesResponse {
  voices: VoiceOption[]
  next_page_token: string | null
}

interface PageState {
  key: string | null
  voices: VoiceOption[]
  nextToken: string | null
  error: string | null
}

interface MoreState {
  key: string | null
  loading: boolean
  error: string | null
}

const SEARCH_DEBOUNCE_MS = 350
const MAX_SEARCH_LENGTH = 100

async function fetchVoicesPage(url: string, signal: AbortSignal): Promise<VoicesResponse> {
  const res = await fetch(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } })
  if (!res.ok) throw await parseApiError(res, 'Could not load voices. Please try again.')
  const data = (await res.json()) as Partial<VoicesResponse>
  return {
    voices: Array.isArray(data.voices) ? data.voices : [],
    next_page_token:
      typeof data.next_page_token === 'string' && data.next_page_token ? data.next_page_token : null,
  }
}

const voiceKey = (v: VoiceOption) => `${v.provider}:${v.voiceId}`

function mergeVoices(existing: VoiceOption[], incoming: VoiceOption[]): VoiceOption[] {
  const seen = new Set(existing.map(voiceKey))
  const merged = existing.slice()
  for (const v of incoming) {
    const k = voiceKey(v)
    if (!seen.has(k)) {
      seen.add(k)
      merged.push(v)
    }
  }
  return merged
}

export function useVoiceCatalog({
  source,
  search = '',
  language = 'all',
  gender = 'all',
  library,
  pageSize = 24,
  enabled = true,
}: UseVoiceCatalogOptions): VoiceCatalog {
  const trimmed = search.trim().slice(0, MAX_SEARCH_LENGTH)
  const [debouncedSearch, setDebouncedSearch] = useState(trimmed)

  useEffect(() => {
    // Clearing the box applies at once; typing waits for a pause.
    const timer = setTimeout(() => setDebouncedSearch(trimmed), trimmed ? SEARCH_DEBOUNCE_MS : 0)
    return () => clearTimeout(timer)
  }, [trimmed])

  const version = useSyncExternalStore(
    subscribeCatalog,
    () => catalogVersions[source],
    () => 0,
  )
  const [reloadToken, setReloadToken] = useState(0)

  const params = new URLSearchParams({ source, page_size: String(pageSize) })
  if (debouncedSearch) params.set('search', debouncedSearch)
  if (language && language !== 'all') params.set('language', language)
  if (gender !== 'all') params.set('gender', gender)
  if (source === 'library' && library) {
    if (library.useCase === 'all') params.set('use_case', 'all')
    if (library.accent && library.accent !== 'all') params.set('accent', library.accent)
    if (library.age && library.age !== 'all') params.set('age', library.age)
    if (library.highQuality) params.set('high_quality', 'true')
    if (library.sort && library.sort !== 'cloned_by_count') params.set('sort', library.sort)
  }
  const baseUrl = `/api/voices?${params.toString()}`
  const key = `${baseUrl}#${version}#${reloadToken}`

  const [page, setPage] = useState<PageState>({ key: null, voices: [], nextToken: null, error: null })
  const [more, setMore] = useState<MoreState>({ key: null, loading: false, error: null })
  const loadedKeyRef = useRef<string | null>(null)
  const moreControllerRef = useRef<AbortController | null>(null)

  // First page: one AbortController per query; a newer query aborts the stale one.
  useEffect(() => {
    if (!enabled || loadedKeyRef.current === key) return
    const controller = new AbortController()
    fetchVoicesPage(baseUrl, controller.signal)
      .then((res) => {
        loadedKeyRef.current = key
        setPage({ key, voices: res.voices, nextToken: res.next_page_token, error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return
        setPage({ key, voices: [], nextToken: null, error: errorMessage(err, 'Could not load voices.') })
      })
    return () => controller.abort()
  }, [enabled, key, baseUrl])

  // A "load more" in flight belongs to the query that started it.
  useEffect(() => () => moreControllerRef.current?.abort(), [key])

  const pageIsCurrent = page.key === key
  const isLoadingMore = more.loading && more.key === key

  const loadMore = useCallback(() => {
    if (!pageIsCurrent || !page.nextToken || isLoadingMore) return
    const startedFor = key
    moreControllerRef.current?.abort()
    const controller = new AbortController()
    moreControllerRef.current = controller
    setMore({ key: startedFor, loading: true, error: null })
    const url = `${baseUrl}&page_token=${encodeURIComponent(page.nextToken)}`
    fetchVoicesPage(url, controller.signal)
      .then((res) => {
        setPage((prev) =>
          prev.key === startedFor
            ? { ...prev, voices: mergeVoices(prev.voices, res.voices), nextToken: res.next_page_token }
            : prev,
        )
        setMore({ key: startedFor, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) {
          setMore((prev) => (prev.key === startedFor ? { key: startedFor, loading: false, error: null } : prev))
          return
        }
        setMore({ key: startedFor, loading: false, error: errorMessage(err, 'Could not load more voices.') })
      })
  }, [pageIsCurrent, page.nextToken, isLoadingMore, key, baseUrl])

  const retry = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  return {
    voices: page.voices,
    isLoading: enabled && !pageIsCurrent,
    isDebouncing: trimmed !== debouncedSearch,
    isLoadingMore,
    error: pageIsCurrent ? page.error : null,
    loadMoreError: more.key === key ? more.error : null,
    hasMore: pageIsCurrent && !!page.nextToken,
    loadMore,
    retry,
  }
}
