'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  KNOWLEDGE_MAX_DOCUMENTS,
  KNOWLEDGE_MAX_FILE_BYTES,
  isDocumentInProgress,
  validateKnowledgeFile,
  type KnowledgeCapabilities,
  type KnowledgeDocumentView,
  type KnowledgeListResponse,
  type KnowledgeSearchResponse,
  type KnowledgeSearchResult,
  type KnowledgeUploadTarget,
} from '@/lib/knowledge/shared'

// Knowledge base state for the Knowledge tab and the dashboard upload dialog:
// the document list (polled while something is being read), an upload queue
// that sends files straight to Supabase Storage through signed URLs with real
// per-file progress, and the document actions (add page, refresh, replace,
// delete).

export type UploadStage = 'queued' | 'preparing' | 'uploading' | 'registering' | 'done' | 'error'

export interface UploadItem {
  id: string
  name: string
  size: number
  stage: UploadStage
  /** 0–100 while uploading. */
  progress: number
  error: string | null
  /** The document created for this upload, once registered. */
  documentId: string | null
  /** Replacing this document once the new version is ready. */
  replacesId: string | null
}

export interface UseKnowledgeOptions {
  /** Load and poll the document list (the dialog only does while open). */
  enabled?: boolean
  /** Keep finished uploads listed until dismissed (the dialog shows their results). */
  keepFinishedUploads?: boolean
}

const POLL_INTERVAL_MS = 3000
const MAX_PARALLEL_UPLOADS = 2
const DONE_UPLOAD_LINGER_MS = 2500

interface ErrorBody {
  error?: { code?: string; message?: string } | string
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ErrorBody
    if (typeof body.error === 'string') return body.error
    if (body.error?.message) return body.error.message
  } catch {
    // Not JSON (proxy error page); use the fallback.
  }
  return fallback
}

function storageUploadMessage(status: number, responseText: string): string {
  const text = responseText.toLowerCase()
  if (status === 413 || text.includes('maximum allowed size') || text.includes('too large')) {
    return 'This file is larger than 10 MB.'
  }
  if (status === 415 || text.includes('mime')) return 'This type of file isn’t accepted. Upload a PDF, Word, .txt or .md file.'
  if (text.includes('exp') || text.includes('signature') || status === 403) {
    return 'The upload link expired. Please try again.'
  }
  return 'The upload didn’t go through. Please try again.'
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useKnowledge(options: UseKnowledgeOptions = {}) {
  const enabled = options.enabled ?? true
  const keepFinished = options.keepFinishedUploads ?? false

  const [docs, setDocs] = useState<KnowledgeDocumentView[]>([])
  const [capabilities, setCapabilities] = useState<KnowledgeCapabilities | null>(null)
  const [limits, setLimits] = useState({ max_documents: KNOWLEDGE_MAX_DOCUMENTS, max_file_bytes: KNOWLEDGE_MAX_FILE_BYTES })
  const [isLoading, setIsLoading] = useState(enabled)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [busyIds, setBusyIds] = useState<string[]>([])
  // New document id → the document it replaces (removed server-side once the new one is ready).
  const [replacements, setReplacements] = useState<Record<string, string>>({})

  const files = useRef(new Map<string, File>())
  const requests = useRef(new Map<string, XMLHttpRequest>())
  const started = useRef(new Set<string>())
  const cancelled = useRef(new Set<string>())
  const autoResumed = useRef(new Set<string>())
  const mounted = useRef(true)
  /** Bumped on every local change to the list. */
  const localChanges = useRef(0)

  useEffect(() => {
    mounted.current = true
    const pending = requests.current
    return () => {
      mounted.current = false
      pending.forEach((xhr) => xhr.abort())
    }
  }, [])

  // ─── List ────────────────────────────────────────────────────────────────

  const load = useCallback(async (mode: 'initial' | 'manual' | 'silent') => {
    if (mode === 'manual') setIsRefreshing(true)
    const startedAt = localChanges.current
    try {
      const res = await fetch('/api/agent/knowledge', { cache: 'no-store' })
      if (!res.ok) throw new Error(await errorMessage(res, 'We couldn’t load your documents.'))
      const data = (await res.json()) as KnowledgeListResponse
      if (!mounted.current) return
      // A background poll that started before a local change (a document just
      // added or removed) would briefly undo it; the next poll catches up.
      if (mode === 'silent' && startedAt !== localChanges.current) return
      setDocs(data.documents)
      setCapabilities(data.capabilities)
      setLimits(data.limits)
      setLoadError(null)
      setHasLoaded(true)
    } catch (error) {
      if (!mounted.current) return
      const message = error instanceof Error ? error.message : 'We couldn’t load your documents.'
      // A failed background poll keeps what is on screen.
      if (mode !== 'silent') setLoadError(message)
      if (mode === 'manual') toast.error(message)
    } finally {
      if (mounted.current) {
        setIsLoading(false)
        if (mode === 'manual') setIsRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void load('initial')
  }, [enabled, load])

  const refetch = useCallback(() => load('manual'), [load])

  // A replacement is settled once its new version failed (the old one stays) or
  // the old one is gone from the list.
  const pendingReplacements = Object.entries(replacements).filter(([newId, oldId]) => {
    const next = docs.find((d) => d.id === newId)
    return next !== undefined && next.state !== 'failed' && docs.some((d) => d.id === oldId)
  })
  const settledReplacementIds = Object.keys(replacements).filter(
    (newId) => !pendingReplacements.some(([pendingId]) => pendingId === newId)
  )
  const settledReplacementKey = settledReplacementIds.join(',')
  useEffect(() => {
    if (!settledReplacementKey) return
    const settled = settledReplacementKey.split(',')
    setReplacements((prev) => Object.fromEntries(Object.entries(prev).filter(([newId]) => !settled.includes(newId))))
  }, [settledReplacementKey])

  // Poll while a document is being read (or read again), and until a replaced
  // document has left the list, so the old version doesn't linger on screen.
  const polling = enabled && (docs.some(isDocumentInProgress) || pendingReplacements.length > 0)
  useEffect(() => {
    if (!polling) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load('silent')
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [polling, load])

  // Pick up changes made elsewhere when the tab becomes visible again.
  useEffect(() => {
    if (!enabled) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load('silent')
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [enabled, load])

  const markBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((prev) => (busy ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)))
  }, [])

  const upsertDoc = useCallback((doc: KnowledgeDocumentView) => {
    localChanges.current++
    setDocs((prev) => {
      const index = prev.findIndex((d) => d.id === doc.id)
      if (index === -1) return [doc, ...prev]
      const next = [...prev]
      next[index] = doc
      return next
    })
  }, [])

  // ─── Uploads ─────────────────────────────────────────────────────────────

  const updateUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }, [])

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id))
    files.current.delete(id)
  }, [])

  const putFile = useCallback((id: string, target: KnowledgeUploadTarget, file: File) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      requests.current.set(id, xhr)
      xhr.open('PUT', target.signed_url)
      xhr.setRequestHeader('x-upsert', 'false')
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (anonKey) xhr.setRequestHeader('apikey', anonKey)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          updateUpload(id, { progress: Math.min(99, Math.round((event.loaded / event.total) * 100)) })
        }
      }
      xhr.onload = () => {
        requests.current.delete(id)
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(storageUploadMessage(xhr.status, xhr.responseText)))
      }
      xhr.onerror = () => {
        requests.current.delete(id)
        reject(new Error('The upload was interrupted. Check your connection and try again.'))
      }
      xhr.onabort = () => {
        requests.current.delete(id)
        reject(new DOMException('Upload cancelled', 'AbortError'))
      }
      // Same request as supabase-js uploadToSignedUrl, with XHR for progress events.
      // The part carries the canonical type so the bucket's allowed-types check passes
      // even when the browser didn't know the file type.
      const form = new FormData()
      form.append('cacheControl', '3600')
      form.append('', new File([file], file.name, { type: target.content_type }))
      xhr.send(form)
    })
  }, [updateUpload])

  const runUpload = useCallback(async (item: UploadItem) => {
    try {
      const file = files.current.get(item.id)
      if (!file) throw new Error('This file is no longer available. Choose it again.')
      updateUpload(item.id, { stage: 'preparing', progress: 0, error: null })
      const prepared = await fetch('/api/agent/knowledge/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size, type: file.type, replaces_document_id: item.replacesId }),
      })
      if (!prepared.ok) throw new Error(await errorMessage(prepared, 'We couldn’t prepare the upload.'))
      const target = (await prepared.json()) as KnowledgeUploadTarget
      if (cancelled.current.has(item.id)) throw new DOMException('Upload cancelled', 'AbortError')

      updateUpload(item.id, { stage: 'uploading' })
      await putFile(item.id, target, file)

      // Past this point the document is created; cancelling is no longer offered.
      if (cancelled.current.has(item.id)) throw new DOMException('Upload cancelled', 'AbortError')
      updateUpload(item.id, { stage: 'registering', progress: 100 })
      const registered = await fetch('/api/agent/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: target.path, name: file.name, replaces_document_id: item.replacesId }),
      })
      if (!registered.ok) throw new Error(await errorMessage(registered, 'We couldn’t add this document.'))
      const doc = (await registered.json()) as KnowledgeDocumentView
      if (!mounted.current) return
      upsertDoc(doc)
      if (item.replacesId) {
        const replacedId = item.replacesId
        setReplacements((prev) => ({ ...prev, [doc.id]: replacedId }))
      }
      updateUpload(item.id, { stage: 'done', documentId: doc.id })
      files.current.delete(item.id)
      if (!keepFinished) setTimeout(() => mounted.current && removeUpload(item.id), DONE_UPLOAD_LINGER_MS)
    } catch (error) {
      if (!mounted.current) return
      if (error instanceof DOMException && error.name === 'AbortError') {
        removeUpload(item.id)
        return
      }
      const message = error instanceof Error ? error.message : 'The upload didn’t go through. Please try again.'
      updateUpload(item.id, { stage: 'error', error: message })
    } finally {
      started.current.delete(item.id)
      cancelled.current.delete(item.id)
    }
  }, [keepFinished, putFile, removeUpload, updateUpload, upsertDoc])

  // Leaving the page cancels uploads in progress; ask first.
  const uploadsInFlight = uploads.some((u) => u.stage !== 'done' && u.stage !== 'error')
  useEffect(() => {
    if (!uploadsInFlight) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploadsInFlight])

  // Start queued uploads, a couple at a time.
  useEffect(() => {
    // started holds every upload whose run hasn't finished yet.
    const free = MAX_PARALLEL_UPLOADS - started.current.size
    if (free <= 0) return
    uploads
      .filter((u) => u.stage === 'queued' && !started.current.has(u.id))
      .slice(0, free)
      .forEach((u) => {
        started.current.add(u.id)
        void runUpload(u)
      })
  }, [uploads, runUpload])

  /** Queues files; invalid ones are reported in a toast and skipped. */
  const addFiles = useCallback((incoming: File[] | FileList, opts?: { replaces?: KnowledgeDocumentView | null }) => {
    const list = Array.from(incoming)
    const accepted: UploadItem[] = []
    const rejected: string[] = []
    for (const file of opts?.replaces ? list.slice(0, 1) : list) {
      const problem = validateKnowledgeFile(file)
      if (problem) {
        rejected.push(problem)
        continue
      }
      const id = newId()
      files.current.set(id, file)
      accepted.push({
        id,
        name: file.name,
        size: file.size,
        stage: 'queued',
        progress: 0,
        error: null,
        documentId: null,
        replacesId: opts?.replaces?.id ?? null,
      })
    }
    if (rejected.length === 1) toast.error(rejected[0])
    if (rejected.length > 1) {
      toast.error(`${rejected.length} files couldn’t be added`, { description: rejected.slice(0, 3).join(' ') })
    }
    if (accepted.length > 0) setUploads((prev) => [...prev, ...accepted])
    return accepted.length
  }, [])

  const retryUpload = useCallback((id: string) => {
    updateUpload(id, { stage: 'queued', progress: 0, error: null })
  }, [updateUpload])

  const cancelUpload = useCallback((id: string) => {
    const xhr = requests.current.get(id)
    if (xhr) {
      xhr.abort()
      return
    }
    // Still preparing: the run stops at its next step. Queued: it never starts.
    if (started.current.has(id)) cancelled.current.add(id)
    removeUpload(id)
  }, [removeUpload])

  const clearFinishedUploads = useCallback(() => {
    setUploads((prev) => {
      const keep = prev.filter((u) => u.stage !== 'done' && u.stage !== 'error')
      prev.filter((u) => !keep.includes(u)).forEach((u) => files.current.delete(u.id))
      return keep
    })
  }, [])

  // ─── Document actions ────────────────────────────────────────────────────

  const addUrl = useCallback(async (url: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/agent/knowledge/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) {
        toast.error(await errorMessage(res, 'We couldn’t add this page.'))
        return false
      }
      upsertDoc((await res.json()) as KnowledgeDocumentView)
      toast.success('Page added', { description: 'We’re reading it now. This usually takes a few seconds.' })
      return true
    } catch {
      toast.error('We couldn’t reach the server. Check your connection and try again.')
      return false
    }
  }, [upsertDoc])

  const deleteDoc = useCallback(async (docId: string): Promise<boolean> => {
    markBusy(docId, true)
    try {
      const res = await fetch(`/api/agent/knowledge/${docId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) {
        toast.error(await errorMessage(res, 'We couldn’t remove this document.'))
        return false
      }
      const body = res.ok ? ((await res.json()) as { warnings?: string[] }) : { warnings: [] }
      localChanges.current++
      setDocs((prev) => prev.filter((d) => d.id !== docId))
      if (body.warnings && body.warnings.length > 0) {
        toast.warning('Document removed', {
          description: 'A copy kept by one of our voice providers couldn’t be deleted right now. Contact support if you need it gone immediately.',
        })
      } else {
        toast.success('Document removed')
      }
      return true
    } catch {
      toast.error('We couldn’t reach the server. Check your connection and try again.')
      return false
    } finally {
      markBusy(docId, false)
    }
  }, [markBusy])

  const resyncDoc = useCallback(async (docId: string, opts?: { quiet?: boolean }): Promise<boolean> => {
    markBusy(docId, true)
    try {
      const res = await fetch(`/api/agent/knowledge/${docId}/resync`, { method: 'POST' })
      if (!res.ok) {
        if (!opts?.quiet) toast.error(await errorMessage(res, 'We couldn’t start the refresh.'))
        return false
      }
      const doc = (await res.json()) as KnowledgeDocumentView
      upsertDoc(doc)
      if (!opts?.quiet) {
        toast.success(doc.type === 'url' ? 'Refreshing the page' : 'Reading the document again', {
          description: 'Your agent picks up any changes as soon as it’s ready.',
        })
      }
      return true
    } catch {
      if (!opts?.quiet) toast.error('We couldn’t reach the server. Check your connection and try again.')
      return false
    } finally {
      markBusy(docId, false)
    }
  }, [markBusy, upsertDoc])

  // Documents that waited for the AI service finish on their own once it's on.
  useEffect(() => {
    if (!enabled || !capabilities?.search) return
    docs
      .filter((d) => d.state === 'waiting_for_ai' && !autoResumed.current.has(d.id))
      .slice(0, 5)
      .forEach((d) => {
        autoResumed.current.add(d.id)
        void resyncDoc(d.id, { quiet: true })
      })
  }, [enabled, capabilities?.search, docs, resyncDoc])

  return {
    docs,
    capabilities,
    limits,
    isLoading: enabled && isLoading && !hasLoaded,
    hasLoaded,
    isRefreshing,
    loadError,
    refetch,
    uploads,
    addFiles,
    retryUpload,
    cancelUpload,
    dismissUpload: removeUpload,
    clearFinishedUploads,
    addUrl,
    deleteDoc,
    resyncDoc,
    busyIds,
  }
}

export type KnowledgeHook = ReturnType<typeof useKnowledge>

/** The "Ask your documents" test box: the passages the agent would answer from. */
export function useKnowledgeSearch() {
  const [results, setResults] = useState<KnowledgeSearchResult[] | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const search = useCallback(async (query: string) => {
    const q = query.trim()
    if (q.length < 2) return
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setIsSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/agent/knowledge/search?q=${encodeURIComponent(q)}`, {
        signal: current.signal,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(await errorMessage(res, 'We couldn’t search your documents right now.'))
      const data = (await res.json()) as KnowledgeSearchResponse
      setResults(data.results)
      setLastQuery(data.query)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setResults(null)
      setError(err instanceof Error ? err.message : 'We couldn’t search your documents right now.')
    } finally {
      if (controller.current === current) setIsSearching(false)
    }
  }, [])

  const reset = useCallback(() => {
    controller.current?.abort()
    setResults(null)
    setError(null)
    setLastQuery('')
    setIsSearching(false)
  }, [])

  return { results, lastQuery, isSearching, error, search, reset }
}
