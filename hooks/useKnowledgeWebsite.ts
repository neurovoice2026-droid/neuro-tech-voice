'use client'

// Website imports for the Knowledge tab: list (polled every 5 s while one is
// running), start an import (with the owner's consent) and remove one.

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export type WebsiteImportStatus = 'starting' | 'queued' | 'processing' | 'succeeded' | 'failed' | 'skipped' | 'cancelled' | 'deleting'

export interface WebsiteImport {
  id: string
  seed_url: string
  host: string
  max_pages: number
  status: WebsiteImportStatus
  pages_identified: number
  pages_scraped: number
  pages_skipped: number
  pages_failed: number
  page_count: number
  size_bytes: number
  rag_status: string | null
  rag_progress: number | null
  sync_failures: number
  error_message: string | null
  consent_at: string | null
  attached_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

const POLL_MS = 5_000
const INDEX_POLL_MS = 30_000
const ACTIVE = new Set<WebsiteImportStatus>(['starting', 'queued', 'processing'])
const RAG_PENDING = new Set(['new', 'created', 'processing'])

export function isWebsiteImportRunning(w: WebsiteImport): boolean {
  return ACTIVE.has(w.status)
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data: unknown = await res.json().catch((err: unknown) => {
    console.warn('[knowledge] unreadable error response', res.status, err)
    return null
  })
  const message = data && typeof data === 'object' ? (data as { error?: unknown }).error : null
  if (typeof message === 'string' && message) return message
  if (res.status === 429) return 'Too many website imports. Please try again later.'
  return fallback
}

/**
 * Starts an import without waiting for it (used by onboarding: the request
 * survives the page navigating away). Errors are reported to the console only.
 */
export function startWebsiteImportInBackground(url: string): void {
  fetch('/api/agent/knowledge/website', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, consent: true }),
    keepalive: true,
  })
    .then(async (res) => {
      if (!res.ok) console.warn('[knowledge] website import not started', res.status, await readError(res, ''))
    })
    .catch((err: unknown) => console.warn('[knowledge] website import request failed', err))
}

export function useKnowledgeWebsite(onChanged?: () => void) {
  const [websites, setWebsites] = useState<WebsiteImport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [removing, setRemoving] = useState<string[]>([])
  const mounted = useRef(true)
  const inFlight = useRef(false)
  const latest = useRef<WebsiteImport[]>([])
  useEffect(() => {
    latest.current = websites
  }, [websites])
  const onChangedRef = useRef(onChanged)
  useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(async (quiet = false) => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const res = await fetch('/api/agent/knowledge/website', { cache: 'no-store' })
      if (!res.ok) {
        const message = await readError(res, 'Could not load your website imports.')
        if (quiet) console.warn('[knowledge] website refresh failed', res.status, message)
        else toast.error(message)
        return
      }
      const data = (await res.json()) as { websites: WebsiteImport[] }
      if (!mounted.current) return
      // A finished import changes the agent's knowledge (and the usage numbers).
      const prev = latest.current
      const finished = data.websites.some((w) => !isWebsiteImportRunning(w) && prev.some((p) => p.id === w.id && isWebsiteImportRunning(p)))
      latest.current = data.websites
      setWebsites(data.websites)
      if (finished) onChangedRef.current?.()
    } catch (err) {
      if (quiet) console.warn('[knowledge] website refresh failed', err)
      else toast.error('Could not load your website imports. Check your connection.')
    } finally {
      inFlight.current = false
      if (mounted.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const running = websites.some(isWebsiteImportRunning)
  // Pages of a finished import may still be indexing: check again, more slowly.
  const indexing = websites.some((w) => w.status === 'succeeded' && !!w.rag_status && RAG_PENDING.has(w.rag_status))
  useEffect(() => {
    if (!running && !indexing) return
    const timer = setInterval(() => void load(true), running ? POLL_MS : INDEX_POLL_MS)
    return () => clearInterval(timer)
  }, [running, indexing, load])

  const importWebsite = useCallback(
    async (url: string): Promise<boolean> => {
      setIsImporting(true)
      try {
        const res = await fetch('/api/agent/knowledge/website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, consent: true }),
        })
        if (!res.ok) {
          toast.error(await readError(res, 'The website could not be imported.'))
          return false
        }
        const created = (await res.json()) as WebsiteImport
        if (mounted.current) setWebsites((prev) => [created, ...prev.filter((w) => w.id !== created.id)])
        toast.success('Import started. This usually takes a few minutes.')
        onChangedRef.current?.()
        return true
      } catch (err) {
        console.warn('[knowledge] website import failed', err)
        toast.error('Network error. Check your connection and try again.')
        return false
      } finally {
        if (mounted.current) setIsImporting(false)
      }
    },
    [],
  )

  const removeWebsite = useCallback(
    async (id: string): Promise<boolean> => {
      setRemoving((prev) => [...prev, id])
      try {
        const res = await fetch(`/api/agent/knowledge/website/${encodeURIComponent(id)}`, { method: 'DELETE' })
        if (!res.ok) {
          toast.error(await readError(res, 'The website could not be removed.'))
          return false
        }
        if (mounted.current) setWebsites((prev) => prev.filter((w) => w.id !== id))
        toast.success('Website removed from your agent')
        onChangedRef.current?.()
        return true
      } catch (err) {
        console.warn('[knowledge] website remove failed', err)
        toast.error('Network error. Check your connection and try again.')
        return false
      } finally {
        if (mounted.current) setRemoving((prev) => prev.filter((x) => x !== id))
      }
    },
    [],
  )

  return { websites, isLoading, isImporting, removing, importWebsite, removeWebsite, refetch: () => load() }
}
