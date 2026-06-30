'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Call, CallFilters } from '@/types'

interface CallsResponse {
  calls: Call[]
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
  dateFrom: '',
  dateTo: '',
  minDuration: 0,
  sortBy: 'created_at',
  sortOrder: 'desc',
}

export function useCalls() {
  const [calls, setCalls] = useState<Call[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<CallFilters>(DEFAULT_CALL_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCalls = useCallback(async (f: CallFilters, p: number, ps: number) => {
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams({
      page:        String(p),
      limit:       String(ps),
      search:      f.search,
      status:      f.status,
      direction:   f.direction,
      sentiment:   f.sentiment,
      dateFrom:    f.dateFrom,
      dateTo:      f.dateTo,
      minDuration: String(f.minDuration),
      sortBy:      f.sortBy,
      sortOrder:   f.sortOrder,
    })

    try {
      const res = await fetch(`/api/calls?${params}`)
      if (!res.ok) throw new Error('Failed to fetch calls')
      const data: CallsResponse = await res.json()
      setCalls(data.calls)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchCalls(filters, page, pageSize)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filters, page, pageSize, fetchCalls])

  const setFilters = useCallback((next: CallFilters) => {
    setFiltersState(next)
    setPage(1)
  }, [])

  const deleteCall = useCallback((id: string) => {
    setCalls((prev) => prev.filter((c) => c.id !== id))
    setTotal((t) => Math.max(0, t - 1))
  }, [])

  const refetch = useCallback(() => {
    fetchCalls(filters, page, pageSize)
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
    setPageSize,
    deleteCall,
    refetch,
  }
}
