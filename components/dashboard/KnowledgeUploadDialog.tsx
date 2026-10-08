'use client'

import { useEffect, useRef, useState } from 'react'
import { UploadCloud, FileText, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { OrbInline } from '@/components/shared/OrbLoader'
import { cn, formatFileSize } from '@/lib/utils'
import {
  KNOWLEDGE_LIMITS, KnowledgeApiError, retryKnowledgeDocument, uploadKnowledgeFile, validateKnowledgeFile,
  type KnowledgeDoc, type UploadStage,
} from '@/hooks/useKnowledge'

interface KnowledgeUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface QueuedFile {
  key: string
  file: File
  stage: UploadStage | 'queued'
  error?: string
  /** Set once the server created the document: a retry re-runs it instead of uploading a duplicate. */
  docId?: string
}

const STAGE_LABEL: Record<QueuedFile['stage'], string> = {
  queued: '',
  preparing: 'Preparing…',
  uploading: 'Uploading…',
  processing: 'Adding to agent…',
  done: 'Added',
  error: 'Failed',
}

const CLOSE_DELAY_MS = 1_500

function fileKey(f: File): string {
  return `${f.name}:${f.size}:${f.lastModified}`
}

export function KnowledgeUploadDialog({ open, onOpenChange }: KnowledgeUploadDialogProps) {
  const [files, setFiles] = useState<QueuedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [finished, setFinished] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  function reset() {
    setFiles([])
    setFinished(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next && isUploading) return // keep the dialog while uploads are running
    if (!next) reset()
    onOpenChange(next)
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return
    const accepted: QueuedFile[] = []
    for (const f of Array.from(incoming)) {
      const problem = validateKnowledgeFile(f)
      if (problem) toast.error(`"${f.name}": ${problem}`)
      else accepted.push({ key: fileKey(f), file: f, stage: 'queued' })
    }
    setFinished(false)
    setFiles((prev) => {
      const keys = new Set(prev.map((q) => q.key))
      return [...prev.filter((q) => q.stage !== 'done'), ...accepted.filter((q) => !keys.has(q.key))]
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  function setEntry(key: string, patch: Partial<QueuedFile>) {
    if (mounted.current) setFiles((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)))
  }

  async function handleUpload() {
    const pending = files.filter((q) => q.stage === 'queued' || q.stage === 'error')
    if (pending.length === 0 || isUploading) return
    setIsUploading(true)
    let failures = 0
    for (const item of pending) {
      setEntry(item.key, { stage: item.docId ? 'processing' : 'preparing', error: undefined })
      try {
        let doc: KnowledgeDoc | null
        if (item.docId) {
          doc = await retryKnowledgeDocument(item.docId)
          if (!doc) throw new KnowledgeApiError('This document is already being processed. Check the Knowledge tab.', 409)
        } else {
          doc = await uploadKnowledgeFile(item.file, {
            onCreated: (created) => setEntry(item.key, { docId: created.id }),
            onStage: (stage) => setEntry(item.key, { stage }),
          })
        }
        if (doc.status === 'failed') {
          failures++
          setEntry(item.key, { stage: 'error', error: doc.error_message ?? 'Processing failed.' })
        } else {
          setEntry(item.key, { stage: 'done' })
        }
      } catch (err) {
        failures++
        // status 0: the file never reached storage and its row was removed, so a retry uploads again.
        const discarded = err instanceof KnowledgeApiError && err.status === 0
        setEntry(item.key, {
          stage: 'error',
          error: err instanceof Error ? err.message : 'Upload failed.',
          ...(discarded ? { docId: undefined } : {}),
        })
      }
    }
    if (!mounted.current) return
    setIsUploading(false)
    setFinished(true)
    if (failures === 0) {
      toast.success(`${pending.length} document${pending.length > 1 ? 's' : ''} added to your agent`)
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null
        if (!mounted.current) return
        reset()
        onOpenChange(false)
      }, CLOSE_DELAY_MS)
    } else {
      toast.error(`${failures} of ${pending.length} document${pending.length > 1 ? 's' : ''} could not be added`)
    }
  }

  const pendingCount = files.filter((q) => q.stage === 'queued' || q.stage === 'error').length
  const allDone = finished && files.length > 0 && files.every((q) => q.stage === 'done')

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload knowledge base</DialogTitle>
          <DialogDescription>
            Add documents to give your agent context about your business.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            data-drag={isDragging ? 'true' : undefined}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                inputRef.current?.click()
              }
            }}
            className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-input bg-band px-6 py-10 text-center transition-[background-color,border-color] duration-200 outline-none hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring data-[drag=true]:border-foreground/40 data-[drag=true]:bg-secondary"
          >
            <span className="mb-3 grid size-11 place-items-center rounded-full bg-white shadow-hair">
              <UploadCloud className="size-5 text-foreground" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
            <p className="mt-1 text-xs leading-4 text-muted-foreground">
              {KNOWLEDGE_LIMITS.typesLabel} — max {KNOWLEDGE_LIMITS.maxFileMb} MB each
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={KNOWLEDGE_LIMITS.accept}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <ul className="overflow-hidden rounded-2xl bg-white shadow-hair" aria-label="Files to upload">
              {files.map((q) => {
                const extension = q.file.name.includes('.') ? q.file.name.split('.').pop() : null
                const busy = q.stage === 'preparing' || q.stage === 'uploading' || q.stage === 'processing'
                return (
                  <li key={q.key} className="border-b border-rule px-4 py-3 last:border-b-0">
                    <div className="flex items-center gap-3">
                      {q.stage === 'done' ? (
                        <CheckCircle2 className="size-4 shrink-0 text-success-dot" aria-hidden="true" />
                      ) : q.stage === 'error' ? (
                        <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                      ) : busy ? (
                        <OrbInline state={q.stage === 'processing' ? 'weaving' : 'working'} className="-mx-0.5" />
                      ) : extension ? (
                        <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                          {extension}
                        </span>
                      ) : (
                        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{q.file.name}</span>
                      <span
                        className={cn(
                          'shrink-0 text-xs tabular-nums',
                          q.stage === 'error' ? 'text-destructive' : q.stage === 'done' ? 'text-success' : 'text-muted-foreground'
                        )}
                      >
                        {q.stage === 'queued' ? formatFileSize(q.file.size) : STAGE_LABEL[q.stage]}
                      </span>
                      {(q.stage === 'queued' || q.stage === 'error') && !isUploading && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => { e.stopPropagation(); setFiles((p) => p.filter((x) => x.key !== q.key)) }}
                          className="tap-44 -mr-1.5 shrink-0 text-muted-foreground"
                          aria-label={`Remove ${q.file.name}`}
                        >
                          <X aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                    {q.stage === 'error' && q.error && (
                      <p className="mt-1.5 text-xs text-destructive">{q.error}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <Button
            className="w-full"
            disabled={pendingCount === 0 || allDone}
            loading={isUploading}
            loadingText="Uploading…"
            onClick={() => void handleUpload()}
          >
            {allDone ? (
              <><CheckCircle2 aria-hidden="true" />Added!</>
            ) : files.some((q) => q.stage === 'error') ? (
              `Retry ${pendingCount} file${pendingCount === 1 ? '' : 's'}`
            ) : (
              `Upload ${pendingCount > 0 ? `${pendingCount} file${pendingCount > 1 ? 's' : ''}` : 'files'}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
