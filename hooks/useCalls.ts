'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CallListFilters, CallListItem } from '@/lib/calls/labels'

interface CallsResponse {
  calls: CallListItem[]
  total: number
  page: number
  totalPages: number
  hasMore: boolean
}

export const DEFAULT_CALL_FILTERS: CallListFilters = {
  search: '',
  status: 'all',
  direction: 'all',
  sentiment: 'all',
  provider: 'all',
  dateFrom: '',
  dateTo: '',
  minDuration: 0,
  sortBy: 'created_at',
  sortOrder: 'desc',
}

/** The `error` message of an API error response, or `fallback`. */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    return typeof body.error === 'string' && body.error ? body.error : fallback
  } catch (err) {
    // Not JSON (proxy error page, empty body): the status-based fallback is all we have.
    if (err instanceof SyntaxError || err instanceof TypeError) return fallback
    throw err
  }
}

/** Query string shared by the list and the export (filters only). */
export function callFilterParams(f: CallListFilters): URLSearchParams {
  return new URLSearchParams({
    search: f.search,
    status: f.status,
    direction: f.direction,
    sentiment: f.sentiment,
    provider: f.provider,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
    minDuration: String(f.minDuration),
    sortBy: f.sortBy,
    sortOrder: f.sortOrder,
  })
}

export function useCalls() {
  const [calls, setCalls] = useState<CallListItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<CallListFilters>(DEFAULT_CALL_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef<AbortController | null>(null)

  const fetchCalls = useCallback(async (f: CallListFilters, p: number, ps: number) => {
    inFlightRef.current?.abort()
    const ctrl = new AbortController()
    inFlightRef.current = ctrl
    setIsLoading(true)
    setError(null)

    const params = callFilterParams(f)
    params.set('page', String(p))
    params.set('limit', String(ps))

    try {
      const res = await fetch(`/api/calls?${params}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error(await readApiError(res, 'Could not load calls.'))
      const data: CallsResponse = await res.json()
      if (ctrl.signal.aborted) return
      setCalls(data.calls)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (e) {
      // A newer request replaced this one: its result is irrelevant.
      if (ctrl.signal.aborted) return
      setError(e instanceof Error ? e.message : 'Could not load calls.')
    } finally {
      if (inFlightRef.current === ctrl) {
        inFlightRef.current = null
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchCalls(filters, page, pageSize)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filters, page, pageSize, fetchCalls])

  useEffect(() => () => inFlightRef.current?.abort(), [])

  const setFilters = useCallback((next: CallListFilters) => {
    setFiltersState(next)
    setPage(1)
  }, [])

  const changePageSize = useCallback((next: number) => {
    setPageSize(next)
    setPage(1)
  }, [])

  const deleteCall = useCallback((id: string) => {
    setCalls((prev) => prev.filter((c) => c.id !== id))
    setTotal((t) => Math.max(0, t - 1))
  }, [])

  const refetch = useCallback(() => {
    void fetchCalls(filters, page, pageSize)
  }, [fetchCalls, filters, page, pageSize])

  return {
    calls,
    total,
    totalPages,
    isLoading,
    error,
    filters,
    page,
    pageSize,
    setFilters,
    setPage,
    setPageSize: changePageSize,
    deleteCall,
    refetch,
  }
}
