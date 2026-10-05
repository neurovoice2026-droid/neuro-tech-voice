'use client'

// Knowledge base state for the agent's Knowledge tab (and the dashboard's quick
// upload dialog, through uploadKnowledgeFile).
//
// Files never pass through our API body (Vercel caps it at 4.5 MB):
//   1. POST /api/agent/knowledge/upload-url → document row + one-time signed URL
//   2. browser → Supabase Storage (uploadToSignedUrl)
//   3. POST /api/agent/knowledge/[docId]/process → server validates, uploads to
//      the voice provider and attaches the document to the agent.
// While any document is processing, the list is re-fetched every 5 seconds.

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { KnowledgeDocument } from '@/types'

/** A document as the knowledge API returns it. */
export type KnowledgeDoc = KnowledgeDocument & {
  /** Server-computed: failed, abandoned mid-way, or uploaded but not attached → can be retried now. */
  can_retry?: boolean
  attempt_count?: number
  updated_at?: string
}

/** Keep in step with lib/voice-providers/knowledge.ts (server-side limits). */
export const KNOWLEDGE_LIMITS = {
  maxFileMb: 20,
  maxFileBytes: 20 * 1024 * 1024,
  maxTextChars: 300_000,
  maxNameChars: 200,
  extensions: ['pdf', 'docx', 'txt', 'md', 'markdown', 'html', 'htm', 'epub'],
  accept: '.pdf,.docx,.txt,.md,.markdown,.html,.htm,.epub',
  typesLabel: 'PDF, DOCX, TXT, MD, HTML, EPUB',
} as const

const BUCKET = 'knowledge-documents'
const POLL_INTERVAL_MS = 5_000
const UPLOAD_CONCURRENCY = 3
const DONE_ENTRY_TTL_MS = 2_500

export type UploadStage = 'preparing' | 'uploading' | 'processing' | 'done' | 'error'

export interface UploadingFile {
  id: string
  name: string
  progress: number
  status: 'uploading' | 'done' | 'error'
  stage: UploadStage
  error?: string
}

const STAGE_PROGRESS: Record<UploadStage, number> = {
  preparing: 10,
  uploading: 40,
  processing: 80,
  done: 100,
  error: 100,
}

export class KnowledgeApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'KnowledgeApiError'
  }
}

function fallbackFor(status: number, fallback: string): string {
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 429) return 'Too many uploads. Please wait a while and try again.'
  if (status === 413) return `Files can be up to ${KNOWLEDGE_LIMITS.maxFileMb} MB.`
  return fallback
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data: unknown = await res.json().catch(() => null)
  const message = data && typeof data === 'object' ? (data as { error?: unknown }).error : null
  return typeof message === 'string' && message ? message : fallbackFor(res.status, fallback)
}

async function postJson(url: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** Client-side pre-check (the server validates again, including the file's content). */
export function validateKnowledgeFile(file: File): string | null {
  if (!(KNOWLEDGE_LIMITS.extensions as readonly string[]).includes(extensionOf(file.name))) {
    return `Unsupported file type. Use ${KNOWLEDGE_LIMITS.typesLabel}.`
  }
  if (file.size === 0) return 'The file is empty.'
  if (file.size > KNOWLEDGE_LIMITS.maxFileBytes) return `Files can be up to ${KNOWLEDGE_LIMITS.maxFileMb} MB.`
  return null
}

/** Whether the document still has server work in progress (drives polling and spinners). */
export function isProcessing(doc: KnowledgeDoc): boolean {
  return doc.status === 'processing' && !doc.can_retry
}

function sortDocs(list: KnowledgeDoc[]): KnowledgeDoc[] {
  return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

function upsertInto(list: KnowledgeDoc[], doc: KnowledgeDoc): KnowledgeDoc[] {
  const i = list.findIndex((d) => d.id === doc.id)
  if (i < 0) return sortDocs([doc, ...list])
  const next = [...list]
  next[i] = doc
  return next
}

async function discardDocument(docId: string): Promise<void> {
  const res = await fetch(`/api/agent/knowledge/${encodeURIComponent(docId)}`, { method: 'DELETE' })
  if (!res.ok) throw new KnowledgeApiError(await readError(res, 'Could not remove the incomplete upload.'), res.status)
}

export interface UploadCallbacks {
  /** The document row exists (status 'processing'); the file is not uploaded yet. */
  onCreated?: (doc: KnowledgeDoc) => void
  onStage?: (stage: UploadStage) => void
}

/**
 * Uploads one file through a signed Storage URL and has the server process it.
 * Resolves with the processed document ('ready' or 'failed' with
 * error_message); a document another request is still processing resolves as
 * 'processing'. Rejects with KnowledgeApiError when the upload itself fails.
 */
export async function uploadKnowledgeFile(file: File, callbacks: UploadCallbacks = {}): Promise<KnowledgeDoc> {
  const problem = validateKnowledgeFile(file)
  if (problem) throw new KnowledgeApiError(problem, 400)

  callbacks.onStage?.('preparing')
  const res = await postJson('/api/agent/knowledge/upload-url', { name: file.name, size: file.size, mime: file.type })
  if (!res.ok) throw new KnowledgeApiError(await readError(res, 'Could not start the upload.'), res.status)
  const { document, upload } = (await res.json()) as {
    document: KnowledgeDoc
    upload: { path: string; token: string; signedUrl: string }
  }
  callbacks.onCreated?.(document)

  callbacks.onStage?.('uploading')
  const { error: storageError } = await createClient().storage.from(BUCKET).uploadToSignedUrl(upload.path, upload.token, file)
  if (storageError) {
    // The row would otherwise sit in 'processing' until it is considered abandoned.
    await discardDocument(document.id).catch((cleanupErr: unknown) => {
      console.warn('[knowledge] could not remove the incomplete upload', cleanupErr)
    })
    throw new KnowledgeApiError('The file could not be uploaded. Check your connection and try again.', 0)
  }

  callbacks.onStage?.('processing')
  const processed = await postJson(`/api/agent/knowledge/${encodeURIComponent(document.id)}/process`)
  if (processed.status === 409) return document // another request is processing it; polling picks it up
  if (!processed.ok) throw new KnowledgeApiError(await readError(processed, 'The file was uploaded but could not be processed.'), processed.status)
  return (await processed.json()) as KnowledgeDoc
}

/**
 * Re-runs a failed, abandoned or unattached document. Resolves null when
 * another request is already processing it (409).
 */
export async function retryKnowledgeDocument(docId: string): Promise<KnowledgeDoc | null> {
  const res = await postJson(`/api/agent/knowledge/${encodeURIComponent(docId)}/retry`)
  if (res.status === 409) return null
  if (!res.ok) throw new KnowledgeApiError(await readError(res, 'Retry failed.'), res.status)
  return (await res.json()) as KnowledgeDoc
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<unknown>): Promise<void> {
  const queue = [...items]
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await worker(item)
  })
  await Promise.all(runners)
}

export function useKnowledge() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploading, setUploading] = useState<UploadingFile[]>([])
  const [retrying, setRetrying] = useState<string[]>([])

  const mounted = useRef(true)
  const listRequest = useRef<AbortController | null>(null)
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    mounted.current = true
    const pending = timers.current
    return () => {
      mounted.current = false
      listRequest.current?.abort()
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  /**
   * Loads the list. `spinner` shows the skeleton; `quiet` (polling) reports
   * failures to the console instead of a toast every 5 seconds.
   */
  const loadDocs = useCallback(async (opts: { spinner?: boolean; quiet?: boolean } = {}) => {
    listRequest.current?.abort()
    const ctrl = new AbortController()
    listRequest.current = ctrl
    if (opts.spinner) setIsLoading(true)
    try {
      const res = await fetch('/api/agent/knowledge', { cache: 'no-store', signal: ctrl.signal })
      if (!res.ok) {
        const message = await readError(res, 'Could not load your knowledge base.')
        if (opts.quiet) console.warn('[knowledge] refresh failed', res.status, message)
        else toast.error(message)
        return
      }
      const data = (await res.json()) as KnowledgeDoc[]
      if (mounted.current && !ctrl.signal.aborted) setDocs(sortDocs(data))
    } catch (err) {
      if (ctrl.signal.aborted) return // superseded by a newer request or unmounted
      if (opts.quiet) console.warn('[knowledge] refresh failed', err)
      else toast.error('Could not load your knowledge base. Check your connection.')
    } finally {
      if (listRequest.current === ctrl) listRequest.current = null
      if (mounted.current && !ctrl.signal.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDocs()
  }, [loadDocs])

  // Poll while the server is still working on something; stop as soon as nothing is.
  const hasProcessing = docs.some(isProcessing)
  useEffect(() => {
    if (!hasProcessing) return
    const timer = setInterval(() => {
      if (!listRequest.current) void loadDocs({ quiet: true })
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [hasProcessing, loadDocs])

  const refetch = useCallback(() => loadDocs({ spinner: true }), [loadDocs])

  const upsertDoc = useCallback((doc: KnowledgeDoc) => {
    if (mounted.current) setDocs((prev) => upsertInto(prev, doc))
  }, [])

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t)
      if (mounted.current) fn()
    }, ms)
    timers.current.add(t)
  }, [])

  const updateEntry = useCallback((id: string, patch: Partial<UploadingFile>) => {
    if (mounted.current) setUploading((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }, [])

  const uploadFile = useCallback(
    async (file: File): Promise<KnowledgeDoc | null> => {
      const entryId = crypto.randomUUID()
      const problem = validateKnowledgeFile(file)
      if (problem) {
        toast.error(`"${file.name}": ${problem}`)
        return null
      }
      setUploading((prev) => [...prev, { id: entryId, name: file.name, progress: STAGE_PROGRESS.preparing, status: 'uploading', stage: 'preparing' }])
      try {
        const doc = await uploadKnowledgeFile(file, {
          onCreated: upsertDoc,
          onStage: (stage) => updateEntry(entryId, { stage, progress: STAGE_PROGRESS[stage] }),
        })
        upsertDoc(doc)
        if (doc.status === 'failed') {
          const message = doc.error_message ?? 'Processing failed.'
          updateEntry(entryId, { status: 'error', stage: 'error', progress: 100, error: message })
          toast.error(`"${file.name}" could not be added: ${message}`)
        } else {
          updateEntry(entryId, { status: 'done', stage: 'done', progress: 100 })
          toast.success(doc.status === 'ready' ? `"${file.name}" was added to your agent` : `"${file.name}" uploaded. Still processing…`)
          later(() => setUploading((prev) => prev.filter((u) => u.id !== entryId)), DONE_ENTRY_TTL_MS)
        }
        return doc
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.'
        updateEntry(entryId, { status: 'error', stage: 'error', progress: 100, error: message })
        toast.error(`Failed to upload "${file.name}": ${message}`)
        void loadDocs({ quiet: true }) // show the server's view (e.g. a removed or failed row)
        return null
      }
    },
    [later, loadDocs, updateEntry, upsertDoc],
  )

  const uploadFiles = useCallback(
    async (files: File[]) => {
      await runPool(files, UPLOAD_CONCURRENCY, uploadFile)
    },
    [uploadFile],
  )

  /** Shared by URL and text: the route processes synchronously and returns the document. */
  const addDocument = useCallback(
    async (url: string, body: unknown, labels: { failed: string; added: string }): Promise<boolean> => {
      try {
        const res = await postJson(url, body)
        if (!res.ok) {
          toast.error(await readError(res, labels.failed))
          return false
        }
        const doc = (await res.json()) as KnowledgeDoc
        upsertDoc(doc)
        if (doc.status === 'failed') toast.error(`${labels.failed} ${doc.error_message ?? ''}`.trim())
        else toast.success(labels.added)
        return true
      } catch (err) {
        console.warn('[knowledge] request failed', err)
        toast.error('Network error. Check your connection and try again.')
        return false
      }
    },
    [upsertDoc],
  )

  const addUrl = useCallback(
    (url: string) =>
      addDocument('/api/agent/knowledge/url', { url }, { failed: 'Could not add this page.', added: 'Page added to your agent' }),
    [addDocument],
  )

  const addText = useCallback(
    (name: string, text: string) =>
      addDocument('/api/agent/knowledge/text', { name, text }, { failed: 'Could not add this text.', added: 'Text added to your agent' }),
    [addDocument],
  )

  const retryDoc = useCallback(
    async (docId: string): Promise<boolean> => {
      setRetrying((prev) => (prev.includes(docId) ? prev : [...prev, docId]))
      try {
        const doc = await retryKnowledgeDocument(docId)
        if (!doc) {
          toast.info('This document is already being processed.')
          void loadDocs({ quiet: true })
          return false
        }
        upsertDoc(doc)
        if (doc.status === 'failed') toast.error(doc.error_message ?? 'Processing failed again.')
        else if (doc.status === 'ready') toast.success(`"${doc.name}" is on your agent`)
        return doc.status !== 'failed'
      } catch (err) {
        if (err instanceof KnowledgeApiError) {
          toast.error(err.message)
        } else {
          console.warn('[knowledge] retry failed', err)
          toast.error('Network error. Check your connection and try again.')
        }
        return false
      } finally {
        if (mounted.current) setRetrying((prev) => prev.filter((id) => id !== docId))
      }
    },
    [loadDocs, upsertDoc],
  )

  const deleteDoc = useCallback(
    async (docId: string): Promise<boolean> => {
      const snapshot = docs.find((d) => d.id === docId)
      setDocs((prev) => prev.filter((d) => d.id !== docId))
      const restore = () => {
        if (snapshot && mounted.current) setDocs((prev) => upsertInto(prev, snapshot))
      }
      try {
        const res = await fetch(`/api/agent/knowledge/${encodeURIComponent(docId)}`, { method: 'DELETE' })
        if (!res.ok) {
          restore()
          toast.error(await readError(res, 'Failed to delete the document.'))
          return false
        }
        const data = (await res.json().catch(() => null)) as { warnings?: string[] } | null
        const warning = data?.warnings?.[0]
        if (warning) toast.warning(`Document removed. ${warning}`)
        else toast.success('Document removed')
        return true
      } catch (err) {
        console.warn('[knowledge] delete failed', err)
        restore()
        toast.error('Network error. Check your connection and try again.')
        return false
      }
    },
    [docs],
  )

  const clearErrorUploads = useCallback(() => {
    setUploading((prev) => prev.filter((u) => u.status !== 'error'))
  }, [])

  return {
    docs,
    isLoading,
    uploading,
    retrying,
    isPolling: hasProcessing,
    uploadFile,
    uploadFiles,
    addUrl,
    addText,
    retryDoc,
    deleteDoc,
    refetch,
    clearErrorUploads,
  }
}
