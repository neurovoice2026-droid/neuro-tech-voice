'use client'

// Fetch helpers and the two generic hooks of the Store section, modelled on
// hooks/useDashboardMetrics.ts: AbortController per request, the server's
// `{ error, code, details }` body as the message, the last good data kept on
// a failed refresh. Nothing here touches browser storage: server state is
// the source of truth and every page reads it on mount.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PagedDto } from '@/lib/commerce/types'

export const NETWORK_ERROR = 'The connection failed. Check your internet connection and try again.'
export const TIMEOUT_ERROR = 'The server did not respond in time. Try again.'
/** Default budget of one request; callers that wait on the store (connect, test) pass a longer one. */
export const DEFAULT_TIMEOUT_MS = 30_000

/** An error response from one of our API routes (lib/api/http.ts apiError). */
export class CommerceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
    readonly details: unknown = undefined,
  ) {
    super(message)
    this.name = 'CommerceApiError'
  }

  /** `details.reason` of a 409 precondition failure, when the route gave one. */
  get reason(): string | null {
    const d = this.details
    if (d && typeof d === 'object' && 'reason' in d && typeof (d as { reason: unknown }).reason === 'string') {
      return (d as { reason: string }).reason
    }
    return null
  }
}

/** What a failed response reads as when the route sent no message of its own. */
export const STATUS_FALLBACK: Readonly<Record<number, string>> = {
  401: 'Your session has expired. Sign in again.',
  403: 'This action is not allowed for this account.',
  404: 'The item was not found. It may have been deleted in the meantime.',
  429: 'Too many requests. Wait a moment and try again.',
  503: 'The service is unavailable right now. Try again in a few minutes.',
}

function fallbackByStatus(status: number, fallback: string): string {
  return STATUS_FALLBACK[status] ?? fallback
}

/** Reads a failed response into a CommerceApiError (never throws; a non-JSON body means "no server message"). */
export async function readCommerceError(res: Response, fallback: string): Promise<CommerceApiError> {
  const body: unknown = await res.json().catch(() => null)
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const message = typeof record?.error === 'string' && record.error.trim() ? record.error.trim() : null
  const code = typeof record?.code === 'string' ? record.code : null
  return new CommerceApiError(message ?? fallbackByStatus(res.status, fallback), res.status, code, record?.details)
}

export interface CommerceRequestInit {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** JSON body (sets Content-Type). */
  json?: unknown
  signal?: AbortSignal
  /** Message when the route gives none. */
  fallback: string
  /** Milliseconds before the request is abandoned with TIMEOUT_ERROR (default DEFAULT_TIMEOUT_MS; 0 = no limit). */
  timeoutMs?: number
}

/**
 * One JSON request to our API: throws CommerceApiError on a non-2xx status,
 * returns the parsed body (or undefined when empty). Every request has a time
 * budget, so a stalled route never leaves a spinner or a disabled form behind;
 * the caller's own signal still aborts it early.
 */
export async function commerceRequest<T>(path: string, init: CommerceRequestInit): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.json !== undefined) headers['Content-Type'] = 'application/json'
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const ctrl = new AbortController()
  const outer = init.signal
  const onOuterAbort = () => ctrl.abort(outer?.reason)
  if (outer?.aborted) ctrl.abort(outer.reason)
  else outer?.addEventListener('abort', onOuterAbort, { once: true })
  let timedOut = false
  const timer = timeoutMs > 0
    ? setTimeout(() => {
        timedOut = true
        ctrl.abort()
      }, timeoutMs)
    : null
  try {
    const res = await fetch(path, {
      method: init.method ?? 'GET',
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    })
    if (!res.ok) throw await readCommerceError(res, init.fallback)
    const text = await res.text()
    return (text ? JSON.parse(text) : undefined) as T
  } catch (err) {
    if (timedOut) throw new CommerceApiError(TIMEOUT_ERROR, 0, 'timeout')
    throw err
  } finally {
    if (timer) clearTimeout(timer)
    outer?.removeEventListener('abort', onOuterAbort)
  }
}

/** A user-facing message for anything a request threw. */
export function commerceErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof CommerceApiError) return err.message
  if (err instanceof TypeError) return NETWORK_ERROR
  if (err instanceof DOMException) {
    // Abort / timeout reasons carry the browser's own wording; never show that.
    if (err.name === 'TimeoutError') return TIMEOUT_ERROR
    if (err.name === 'AbortError') return fallback
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** Query string from a params object, skipping empty values; stable for identical inputs. */
export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams()
  for (const key of Object.keys(params).sort()) {
    const value = params[key]
    if (value === undefined || value === null || value === '' || value === false) continue
    sp.set(key, value === true ? '1' : String(value))
  }
  return sp.toString()
}

/** Appends a page to a list without repeating an id already shown (a row may move between pages). */
export function appendUnique<T extends { id: string }>(current: T[], next: T[]): T[] {
  const seen = new Set(current.map((item) => item.id))
  return [...current, ...next.filter((item) => !seen.has(item.id))]
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

// ─── useCommerceQuery ─────────────────────────────────────────────────────────

interface QueryState<T> {
  key: string | null
  data: T | null
  loaded: boolean
  error: string | null
}

export interface CommerceQuery<T> {
  data: T | null
  /** True until the first response for the current path. */
  isLoading: boolean
  /** The last failed request (data already shown is kept). */
  error: string | null
  refetch: () => void
  /** Local update after a successful mutation (the server's row is the truth). */
  setData: (updater: (prev: T | null) => T | null) => void
}

/**
 * GET `path` on mount and whenever it changes; `null` means "nothing to load
 * yet". `refreshMs` polls in the background (the last good data stays while a
 * refresh fails).
 */
export function useCommerceQuery<T>(path: string | null, options: { fallback: string; refreshMs?: number }): CommerceQuery<T> {
  const { fallback, refreshMs } = options
  const [state, setState] = useState<QueryState<T>>({ key: null, data: null, loaded: false, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!path) return
    const ctrl = new AbortController()
    commerceRequest<T>(path, { signal: ctrl.signal, fallback })
      .then((data) => {
        if (!ctrl.signal.aborted) setState({ key: path, data, loaded: true, error: null })
      })
      .catch((e: unknown) => {
        // Aborted: unmounted, path changed or a newer refresh replaced this one.
        if (ctrl.signal.aborted) return
        setState((prev) => ({
          key: path,
          data: prev.key === path ? prev.data : null,
          loaded: true,
          error: commerceErrorMessage(e, fallback),
        }))
      })
    return () => ctrl.abort()
  }, [path, reloadKey, fallback])

  useEffect(() => {
    if (!refreshMs || !path) return
    const id = setInterval(() => setReloadKey((k) => k + 1), refreshMs)
    return () => clearInterval(id)
  }, [refreshMs, path])

  const refetch = useCallback(() => setReloadKey((k) => k + 1), [])
  const setData = useCallback(
    (updater: (prev: T | null) => T | null) => setState((prev) => ({ ...prev, data: updater(prev.data) })),
    [],
  )

  const current = path !== null && state.key === path
  return {
    data: current ? state.data : null,
    isLoading: path !== null && !(current && state.loaded),
    error: current ? state.error : null,
    refetch,
    setData,
  }
}

// ─── useCommercePaged ─────────────────────────────────────────────────────────

interface PagedState<T> {
  key: string | null
  items: T[]
  total: number | null
  nextCursor: string | null
  loaded: boolean
  error: string | null
  loadingMore: boolean
  loadMoreError: string | null
}

export interface CommercePaged<T> {
  items: T[]
  total: number | null
  hasMore: boolean
  /** True until the first page of the current query. */
  isLoading: boolean
  error: string | null
  isLoadingMore: boolean
  loadMoreError: string | null
  loadMore: () => void
  refetch: () => void
  replaceItem: (id: string, next: T) => void
  removeItem: (id: string) => void
}

/**
 * Cursor-paged list (PagedDto<T>): the first page reloads whenever the base
 * path or the params change; `loadMore` appends the next page. Rows are
 * keyed by id, so a row that moved between pages is not shown twice.
 */
export function useCommercePaged<T extends { id: string }>(
  basePath: string | null,
  params: Record<string, string | number | boolean | null | undefined>,
  options: { fallback: string; limit?: number },
): CommercePaged<T> {
  const { fallback, limit = 25 } = options
  // Params are compared by value: callers pass a fresh object every render.
  const paramsKey = JSON.stringify(params)
  const key = useMemo(() => {
    if (!basePath) return null
    const query = buildQuery({ ...(JSON.parse(paramsKey) as Record<string, string>), limit })
    return `${basePath}?${query}`
  }, [basePath, paramsKey, limit])

  const [state, setState] = useState<PagedState<T>>({
    key: null, items: [], total: null, nextCursor: null, loaded: false, error: null, loadingMore: false, loadMoreError: null,
  })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!key) return
    const ctrl = new AbortController()
    commerceRequest<PagedDto<T>>(key, { signal: ctrl.signal, fallback })
      .then((page) => {
        if (ctrl.signal.aborted) return
        setState({
          key, items: page.items, total: page.total, nextCursor: page.next_cursor,
          loaded: true, error: null, loadingMore: false, loadMoreError: null,
        })
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setState((prev) => ({
          key,
          items: prev.key === key ? prev.items : [],
          total: prev.key === key ? prev.total : null,
          nextCursor: prev.key === key ? prev.nextCursor : null,
          loaded: true,
          error: commerceErrorMessage(e, fallback),
          loadingMore: false,
          loadMoreError: null,
        }))
      })
    return () => ctrl.abort()
  }, [key, reloadKey, fallback])

  const current = key !== null && state.key === key
  const nextCursor = current ? state.nextCursor : null

  const loadMore = useCallback(() => {
    if (!key || !nextCursor) return
    setState((prev) => ({ ...prev, loadingMore: true, loadMoreError: null }))
    commerceRequest<PagedDto<T>>(`${key}&cursor=${encodeURIComponent(nextCursor)}`, { fallback })
      .then((page) => {
        setState((prev) => {
          // The query changed while this page was loading: it belongs to the old list.
          if (prev.key !== key) return prev
          return {
            ...prev,
            items: appendUnique(prev.items, page.items),
            total: page.total ?? prev.total,
            nextCursor: page.next_cursor,
            loadingMore: false,
          }
        })
      })
      .catch((e: unknown) => {
        setState((prev) => (prev.key !== key ? prev : { ...prev, loadingMore: false, loadMoreError: commerceErrorMessage(e, fallback) }))
      })
  }, [key, nextCursor, fallback])

  const refetch = useCallback(() => setReloadKey((k) => k + 1), [])
  const replaceItem = useCallback(
    (id: string, next: T) => setState((prev) => ({ ...prev, items: prev.items.map((item) => (item.id === id ? next : item)) })),
    [],
  )
  const removeItem = useCallback(
    (id: string) =>
      setState((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
        total: typeof prev.total === 'number' ? Math.max(0, prev.total - 1) : prev.total,
      })),
    [],
  )

  return {
    items: current ? state.items : [],
    total: current ? state.total : null,
    hasMore: nextCursor !== null,
    isLoading: key !== null && !(current && state.loaded),
    error: current ? state.error : null,
    isLoadingMore: current && state.loadingMore,
    loadMoreError: current ? state.loadMoreError : null,
    loadMore,
    refetch,
    replaceItem,
    removeItem,
  }
}
