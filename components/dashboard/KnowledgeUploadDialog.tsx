'use client'

import { useEffect, useRef, useState } from 'react'
import { UploadCloud, FileText, X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-full bg-purple-100 p-1.5">
              <UploadCloud className="h-4 w-4 text-purple-600" />
            </div>
            Upload Knowledge Base
          </DialogTitle>
          <DialogDescription>
            Add documents to give your agent context about your business.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
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
            className={cn(
              'cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              isDragging ? 'border-primary bg-purple-50' : 'border-border hover:border-purple-300 hover:bg-purple-50/30'
            )}
          >
            <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">
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
            <div className="space-y-1.5">
              {files.map((q) => (
                <div key={q.key} className="rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2">
                    {q.stage === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : q.stage === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    ) : q.stage === 'queued' ? (
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate text-sm">{q.file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {q.stage === 'queued' ? formatFileSize(q.file.size) : STAGE_LABEL[q.stage]}
                    </span>
                    {(q.stage === 'queued' || q.stage === 'error') && !isUploading && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFiles((p) => p.filter((x) => x.key !== q.key)) }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Remove ${q.file.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {q.stage === 'error' && q.error && (
                    <p className="mt-1 text-xs text-destructive">{q.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <Button
            className="w-full purple-glow"
            disabled={pendingCount === 0 || isUploading || allDone}
            onClick={() => void handleUpload()}
          >
            {allDone ? (
              <><CheckCircle2 className="mr-2 h-4 w-4 text-green-400" />Added!</>
            ) : isUploading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
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
