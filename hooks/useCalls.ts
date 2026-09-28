'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CALL_OUTCOMES, type Call, type CallFilters, type CallOutcome } from '@/types'

/** A row of the calls list: every column except the transcript and analysis. */
export type CallListItem = Pick<
  Call,
  | 'id' | 'org_id' | 'agent_id' | 'phone_number_id' | 'provider_call_id' | 'voice_provider' | 'pipeline_mode'
  | 'caller_number' | 'from_number' | 'to_number' | 'direction' | 'is_test' | 'duration_seconds' | 'status'
  | 'end_reason' | 'fallback_used' | 'fallback_reason' | 'sentiment' | 'summary' | 'outcome' | 'intent'
  | 'tags' | 'recording_url' | 'started_at' | 'ended_at' | 'created_at'
> & { agent_name: string | null }

interface CallsResponse {
  calls: CallListItem[]
  total: number
  page: number
  totalPages: number
  hasMore: boolean
}

export const DEFAULT_CALL_FILTERS: CallFilters = {
  search: '',
  status: 'all',
  direction: 'all',
  sentiment: 'all',
  outcome: 'all',
  tag: '',
  dateFrom: '',
  dateTo: '',
  minDuration: 0,
  sortBy: 'created_at',
  sortOrder: 'desc',
}

export const PAGE_SIZES = [10, 25, 50, 100] as const
const DEFAULT_PAGE_SIZE = 25

const STATUSES: readonly CallFilters['status'][] = ['all', 'completed', 'failed', 'busy', 'no-answer']
const DIRECTIONS: readonly CallFilters['direction'][] = ['all', 'inbound', 'outbound']
const SENTIMENTS: readonly CallFilters['sentiment'][] = ['all', 'positive', 'neutral', 'negative']
const SORTS: readonly CallFilters['sortBy'][] = ['created_at', 'duration_seconds', 'caller_number']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function int(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value)
  return value !== null && Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

export interface CallsListState {
  filters: CallFilters
  page: number
  pageSize: number
  /** Dashboard test calls are hidden from the list unless the owner asks for them. */
  includeTest: boolean
}

/**
 * Reads filters from the page URL (?q=&status=&outcome=&tag=&from=&to=&min=&sort=&order=&page=&size=&test=1).
 * Tolerant: a hand-edited or stale link falls back to defaults instead of failing.
 */
export function listStateFromSearchParams(params: URLSearchParams): CallsListState {
  const outcome = params.get('outcome')
  const size = int(params.get('size'), DEFAULT_PAGE_SIZE, 1, 100)
  return {
    filters: {
      search: (params.get('q') ?? '').slice(0, 200),
      status: pick(params.get('status'), STATUSES, 'all'),
      direction: pick(params.get('direction'), DIRECTIONS, 'all'),
      sentiment: pick(params.get('sentiment'), SENTIMENTS, 'all'),
      outcome: outcome && (CALL_OUTCOMES as readonly string[]).includes(outcome) ? (outcome as CallOutcome) : 'all',
      tag: (params.get('tag') ?? '').slice(0, 64),
      dateFrom: DATE_RE.test(params.get('from') ?? '') ? (params.get('from') as string) : '',
      dateTo: DATE_RE.test(params.get('to') ?? '') ? (params.get('to') as string) : '',
      minDuration: int(params.get('min'), 0, 0, 86_400),
      sortBy: pick(params.get('sort'), SORTS, 'created_at'),
      sortOrder: params.get('order') === 'asc' ? 'asc' : 'desc',
    },
    page: int(params.get('page'), 1, 1, 100_000),
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
    includeTest: params.get('test') === '1',
  }
}

/** Only non-default values, so a plain /calls link stays clean. */
export function listStateToSearchParams(state: CallsListState): URLSearchParams {
  const { filters: f } = state
  const out = new URLSearchParams()
  if (f.search.trim()) out.set('q', f.search.trim())
  if (f.status !== 'all') out.set('status', f.status)
  if (f.direction !== 'all') out.set('direction', f.direction)
  if (f.sentiment !== 'all') out.set('sentiment', f.sentiment)
  if (f.outcome !== 'all') out.set('outcome', f.outcome)
  if (f.tag.trim()) out.set('tag', f.tag.trim())
  if (f.dateFrom) out.set('from', f.dateFrom)
  if (f.dateTo) out.set('to', f.dateTo)
  if (f.minDuration > 0) out.set('min', String(f.minDuration))
  if (f.sortBy !== 'created_at') out.set('sort', f.sortBy)
  if (f.sortOrder !== 'desc') out.set('order', f.sortOrder)
  if (state.page > 1) out.set('page', String(state.page))
  if (state.pageSize !== DEFAULT_PAGE_SIZE) out.set('size', String(state.pageSize))
  if (state.includeTest) out.set('test', '1')
  return out
}

/** Query string for GET /api/calls and the export (API parameter names). */
export function filtersToApiParams(filters: CallFilters, includeTest = false): URLSearchParams {
  const params = new URLSearchParams({
    search: filters.search.trim(),
    status: filters.status,
    direction: filters.direction,
    sentiment: filters.sentiment,
    outcome: filters.outcome,
    tag: filters.tag.trim(),
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    minDuration: String(filters.minDuration),
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  })
  if (includeTest) params.set('include_test', '1')
  return params
}

export function activeFilterCount(filters: CallFilters): number {
  return [
    filters.search.trim() !== '',
    filters.status !== 'all',
    filters.direction !== 'all',
    filters.sentiment !== 'all',
    filters.outcome !== 'all',
    filters.tag.trim() !== '',
    filters.dateFrom !== '',
    filters.dateTo !== '',
    filters.minDuration > 0,
  ].filter(Boolean).length
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null
  return typeof body?.error?.message === 'string' ? body.error.message : fallback
}

type Result = { key: string; data: CallsResponse; error: null } | { key: string; data: null; error: string }

export function useCalls() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const state = useMemo(() => listStateFromSearchParams(new URLSearchParams(query)), [query])

  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  // Rows deleted in this session, hidden until the next fetch confirms it.
  const [removed, setRemoved] = useState<{ key: string; ids: Set<string> }>({ key: '', ids: new Set() })

  const requestKey = `${query}#${reload}`

  useEffect(() => {
    const controller = new AbortController()
    const params = filtersToApiParams(state.filters, state.includeTest)
    params.set('page', String(state.page))
    params.set('limit', String(state.pageSize))

    fetch(`/api/calls?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, 'We couldn’t load your calls. Please try again.'))
        return (await res.json()) as CallsResponse
      })
      .then((data) => setResult({ key: requestKey, data, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message = err instanceof Error && err.message ? err.message : 'We couldn’t load your calls. Please try again.'
        setResult({ key: requestKey, data: null, error: message })
      })

    return () => controller.abort()
  }, [requestKey, state])

  const navigate = useCallback(
    (next: CallsListState) => {
      const qs = listStateToSearchParams(next).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router]
  )

  const setFilters = useCallback(
    (filters: CallFilters) => navigate({ ...state, filters, page: 1 }),
    [navigate, state]
  )
  const setPage = useCallback((page: number) => navigate({ ...state, page: Math.max(1, page) }), [navigate, state])
  const setPageSize = useCallback(
    (pageSize: number) => navigate({ ...state, pageSize, page: 1 }),
    [navigate, state]
  )
  const setIncludeTest = useCallback(
    (includeTest: boolean) => navigate({ ...state, includeTest, page: 1 }),
    [navigate, state]
  )
  const refetch = useCallback(() => setReload((n) => n + 1), [])

  const lastData = result?.data ?? null
  const hidden = removed.key === (result?.key ?? '') ? removed.ids : null

  const removeCall = useCallback(
    (id: string) => {
      setRemoved((prev) => {
        const ids = new Set(prev.key === (result?.key ?? '') ? prev.ids : [])
        ids.add(id)
        return { key: result?.key ?? '', ids }
      })
    },
    [result?.key]
  )

  const calls = useMemo(
    () => (lastData?.calls ?? []).filter((c) => !hidden?.has(c.id)),
    [lastData, hidden]
  )
  const hiddenCount = hidden ? (lastData?.calls ?? []).filter((c) => hidden.has(c.id)).length : 0
  const isLoading = result?.key !== requestKey

  return {
    calls,
    total: Math.max(0, (lastData?.total ?? 0) - hiddenCount),
    totalPages: lastData?.totalPages ?? 1,
    /** True while a request for the current filters is in flight. */
    isLoading,
    /** True until the first response arrives (show skeletons, not stale rows). */
    isInitialLoading: isLoading && !lastData,
    error: result?.key === requestKey ? result.error : null,
    filters: state.filters,
    page: state.page,
    pageSize: state.pageSize,
    includeTest: state.includeTest,
    setFilters,
    setPage,
    setPageSize,
    setIncludeTest,
    removeCall,
    refetch,
  }
}
