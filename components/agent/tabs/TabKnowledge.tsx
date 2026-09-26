'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  AlertCircle, AlertTriangle, BookOpen, CheckCircle2, ExternalLink, FileText, Globe, Link2, Loader2,
  MoreHorizontal, RefreshCw, Replace, RotateCcw, Search, Sparkles, Trash2, Upload, X,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/shared/EmptyState'
import { useKnowledge, useKnowledgeSearch, type KnowledgeHook, type UploadItem } from '@/hooks/useKnowledge'
import {
  KNOWLEDGE_ACCEPT,
  KNOWLEDGE_MAX_FILE_BYTES,
  KNOWLEDGE_MAX_QUERY_LENGTH,
  formatMegabytes,
  isDocumentInProgress,
  isSearchableDocument,
  matchStrength,
  type KnowledgeDocumentView,
  type KnowledgeSearchResult,
} from '@/lib/knowledge/shared'
import { cn, formatFileSize } from '@/lib/utils'

interface TabKnowledgeProps {
  /** Shared with the page (tab badge); the tab creates its own when omitted. */
  hook?: KnowledgeHook
}

const TYPE_LABELS: Record<KnowledgeDocumentView['type'], string> = {
  pdf: 'PDF',
  docx: 'Word',
  txt: 'Text',
  md: 'Markdown',
  url: 'Web page',
}

export function TabKnowledge({ hook }: TabKnowledgeProps) {
  const own = useKnowledge({ enabled: !hook })
  const kb = hook ?? own
  const { docs, capabilities, isLoading, loadError } = kb

  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocumentView | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const replaceInput = useRef<HTMLInputElement>(null)
  const [replaceTarget, setReplaceTarget] = useState<KnowledgeDocumentView | null>(null)

  // Documents being refreshed still answer calls with their current version.
  const readyDocs = docs.filter(isSearchableDocument)
  const passages = readyDocs.reduce((total, d) => total + d.chunk_count, 0)
  const aiOff = capabilities !== null && !capabilities.search

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    const ok = await kb.deleteDoc(deleteTarget.id)
    setIsDeleting(false)
    if (ok) setDeleteTarget(null)
  }

  const startReplace = (doc: KnowledgeDocumentView) => {
    setReplaceTarget(doc)
    replaceInput.current?.click()
  }

  const onReplaceFile = (files: FileList | null) => {
    if (files && files.length > 0 && replaceTarget) {
      const queued = kb.addFiles(files, { replaces: replaceTarget })
      if (queued > 0) {
        toast.info(`Uploading the new version of “${replaceTarget.name}”`, {
          description: 'Your agent keeps using the current version until the new one is ready.',
        })
      }
    }
    setReplaceTarget(null)
    if (replaceInput.current) replaceInput.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <SummaryStat label="Documents" value={isLoading ? null : docs.length} />
        <SummaryStat label="Ready for calls" value={isLoading ? null : readyDocs.length} />
        <SummaryStat label="Passages" value={isLoading ? null : passages} />
      </div>

      {aiOff && (
        <Alert>
          <Sparkles aria-hidden="true" />
          <AlertTitle>Documents are saved, answers come next</AlertTitle>
          <AlertDescription>
            We read and store everything you add right away. Your agent starts answering from it as soon as the
            AI service is switched on, and waiting documents finish automatically the next time you open this page.
          </AlertDescription>
        </Alert>
      )}

      <AddKnowledgeCard kb={kb} />

      {/* Documents */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">Your documents</CardTitle>
            <CardDescription>What your agent can answer callers from.</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void kb.refetch()}
            disabled={kb.isRefreshing || isLoading}
            aria-label="Refresh the list"
          >
            <RefreshCw className={cn('size-3.5', kb.isRefreshing && 'animate-spin')} aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading documents">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                  <Skeleton className="size-9 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : loadError && docs.length === 0 ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => void kb.refetch()} disabled={kb.isRefreshing}>
                {kb.isRefreshing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                Try again
              </Button>
            </div>
          ) : docs.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Teach your agent about your business"
              description="Add your price list, opening hours, policies, FAQs or menu, as files or web pages. Your agent answers callers from them, in its own words."
            />
          ) : (
            <ul className="space-y-2">
              {docs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  busy={kb.busyIds.includes(doc.id)}
                  searchAvailable={capabilities?.search ?? false}
                  onRetry={() => void kb.resyncDoc(doc.id)}
                  onReplace={() => startReplace(doc)}
                  onDelete={() => setDeleteTarget(doc)}
                />
              ))}
            </ul>
          )}
          <input
            ref={replaceInput}
            type="file"
            accept={KNOWLEDGE_ACCEPT}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => onReplaceFile(e.target.files)}
          />
        </CardContent>
      </Card>

      <AskDocumentsCard readyCount={readyDocs.length} aiOff={aiOff} loading={isLoading} />

      <Card className="border-dashed">
        <CardContent className="flex gap-3 text-xs text-muted-foreground">
          <BookOpen className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p>Clear headings and short sections help your agent find the right answer. Text-based PDFs work; scanned pages don’t.</p>
            <p>Your agent doesn’t learn from calls and never reads a document out word for word. When something isn’t written down, it says so and offers to take a message.</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this document?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.name}” will be removed from your agent’s knowledge. Calls from now on won’t use it.
              This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isDeleting ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: number | null }) {
  return (
    <Card size="sm">
      <CardContent className="px-3 sm:px-4">
        {value === null ? (
          <Skeleton className="h-7 w-10" />
        ) : (
          <p className="text-xl font-semibold tabular-nums sm:text-2xl">{value.toLocaleString('en-US')}</p>
        )}
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

// ─── Add files and pages ─────────────────────────────────────────────────────

function AddKnowledgeCard({ kb }: { kb: KnowledgeHook }) {
  const [url, setUrl] = useState('')
  const [isAddingUrl, setIsAddingUrl] = useState(false)
  const urlId = useId()
  const hintId = useId()

  const submitUrl = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!url.trim() || isAddingUrl) return
    setIsAddingUrl(true)
    const ok = await kb.addUrl(url.trim())
    setIsAddingUrl(false)
    if (ok) setUrl('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add knowledge</CardTitle>
        <CardDescription>Anything a caller might ask about: prices, services, hours, policies, directions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <FileDropZone onFiles={(files) => kb.addFiles(files)} />

        {kb.uploads.length > 0 && (
          <ul className="space-y-2" aria-live="polite">
            {kb.uploads.map((item) => (
              <KnowledgeUploadRow
                key={item.id}
                item={item}
                onRetry={() => kb.retryUpload(item.id)}
                onCancel={() => kb.cancelUpload(item.id)}
                onDismiss={() => kb.dismissUpload(item.id)}
              />
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          or add a web page
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={(e) => void submitUrl(e)} className="space-y-2">
          <Label htmlFor={urlId}>Web page address</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={urlId}
              type="text"
              inputMode="url"
              autoComplete="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourbusiness.com/faq"
              aria-describedby={hintId}
              className="h-9 sm:flex-1"
              maxLength={2048}
            />
            <Button type="submit" className="h-9 shrink-0" disabled={!url.trim() || isAddingUrl}>
              {isAddingUrl ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />}
              {isAddingUrl ? 'Adding…' : 'Add page'}
            </Button>
          </div>
          <p id={hintId} className="text-xs text-muted-foreground">
            We read the page as it is now. When it changes, use Refresh on it.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

export function FileDropZone({ onFiles, compact = false }: { onFiles: (files: File[]) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const hintId = useId()

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files.length > 0) onFiles(Array.from(event.dataTransfer.files))
  }, [onFiles])

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        aria-describedby={hintId}
        className={cn(
          'flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          compact ? 'px-4 py-6' : 'px-4 py-8 sm:py-10',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
        )}
      >
        <Upload className={cn('mb-3 size-7', isDragging ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
        <span className="text-sm font-medium">{isDragging ? 'Drop to upload' : 'Drop files here or choose them'}</span>
        <span id={hintId} className="mt-1 text-xs text-muted-foreground">
          PDF, Word, TXT or Markdown · up to {formatMegabytes(KNOWLEDGE_MAX_FILE_BYTES)} each
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={KNOWLEDGE_ACCEPT}
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
    </>
  )
}

const UPLOAD_STAGE_LABELS: Record<UploadItem['stage'], string> = {
  queued: 'Waiting…',
  preparing: 'Preparing…',
  uploading: 'Uploading',
  registering: 'Saving…',
  done: 'Uploaded',
  error: 'Failed',
}

export function KnowledgeUploadRow({
  item,
  doc,
  onRetry,
  onCancel,
  onDismiss,
}: {
  item: UploadItem
  /** The document created by this upload, to show how reading it went. */
  doc?: KnowledgeDocumentView | null
  onRetry: () => void
  onCancel: () => void
  onDismiss: () => void
}) {
  const inFlight = item.stage !== 'done' && item.stage !== 'error'
  // Once the file is being saved as a document it can't be cancelled (remove the document instead).
  const cancellable = item.stage === 'queued' || item.stage === 'preparing' || item.stage === 'uploading'
  return (
    <li className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm">
        {item.stage === 'error' ? (
          <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
        ) : item.stage === 'done' ? (
          <CheckCircle2 className="size-4 shrink-0 text-green-600" aria-hidden="true" />
        ) : (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium" title={item.name}>
          {item.name}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {item.stage === 'uploading' ? `${item.progress}%` : UPLOAD_STAGE_LABELS[item.stage]}
        </span>
        {inFlight ? (
          cancellable ? (
            <Button variant="ghost" size="icon-xs" onClick={onCancel} aria-label={`Cancel upload of ${item.name}`}>
              <X aria-hidden="true" />
            </Button>
          ) : (
            <span className="size-6 shrink-0" aria-hidden="true" />
          )
        ) : (
          <Button variant="ghost" size="icon-xs" onClick={onDismiss} aria-label={`Dismiss ${item.name}`}>
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      {inFlight && (
        <Progress
          value={item.stage === 'uploading' || item.stage === 'registering' ? item.progress : null}
          className="mt-2"
          aria-label={`Upload progress for ${item.name}`}
        />
      )}
      {item.stage === 'error' && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-destructive">{item.error}</p>
          <Button variant="outline" size="xs" onClick={onRetry}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}
      {item.stage === 'done' && doc && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <KnowledgeStatusPill doc={doc} />
          {doc.state === 'failed' && doc.error_message && <span className="text-destructive">{doc.error_message}</span>}
        </div>
      )}
    </li>
  )
}

// ─── Documents ───────────────────────────────────────────────────────────────

export function KnowledgeStatusPill({ doc }: { doc: KnowledgeDocumentView }) {
  if (doc.state === 'ready') {
    return (
      <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400">
        <CheckCircle2 aria-hidden="true" />
        Ready · {doc.chunk_count.toLocaleString('en-US')} {doc.chunk_count === 1 ? 'passage' : 'passages'}
      </Badge>
    )
  }
  if (doc.state === 'failed') {
    return (
      <Badge variant="destructive">
        <AlertCircle aria-hidden="true" />
        Couldn’t read
      </Badge>
    )
  }
  if (doc.state === 'refreshing') {
    return (
      <Badge variant="secondary">
        <Loader2 className="animate-spin" aria-hidden="true" />
        {doc.type === 'url' ? 'Refreshing page…' : 'Reading again…'}
      </Badge>
    )
  }
  if (doc.state === 'waiting_for_ai') {
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300">
        <Sparkles aria-hidden="true" />
        Waiting for AI setup
      </Badge>
    )
  }
  if (doc.stuck) {
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300">
        <AlertTriangle aria-hidden="true" />
        Taking longer than usual
      </Badge>
    )
  }
  return (
    <Badge variant="secondary">
      <Loader2 className="animate-spin" aria-hidden="true" />
      {doc.type === 'url' ? 'Reading page…' : 'Reading…'}
    </Badge>
  )
}

function updatedLabel(doc: KnowledgeDocumentView): string | null {
  const at = Date.parse(doc.updated_at ?? doc.created_at)
  if (!Number.isFinite(at)) return null
  return `Updated ${formatDistanceToNow(at, { addSuffix: true })}`
}

function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function DocumentRow({
  doc,
  busy,
  searchAvailable,
  onRetry,
  onReplace,
  onDelete,
}: {
  doc: KnowledgeDocumentView
  busy: boolean
  searchAvailable: boolean
  onRetry: () => void
  onReplace: () => void
  onDelete: () => void
}) {
  const Icon = doc.type === 'url' ? Globe : FileText
  const updated = updatedLabel(doc)
  const host = hostOf(doc.url)
  const processing = isDocumentInProgress(doc)
  const showRetry = doc.state === 'failed' || doc.stuck || (doc.state === 'waiting_for_ai' && searchAvailable)
  const refreshWarning = doc.state === 'ready' && doc.error_message

  return (
    <li className="rounded-lg border p-3 transition-colors hover:bg-muted/30">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted" aria-hidden="true">
          <Icon className="size-4 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={doc.name}>
            {doc.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <KnowledgeStatusPill doc={doc} />
            <span>{TYPE_LABELS[doc.type]}</span>
            {host && <span className="max-w-[12rem] truncate">{host}</span>}
            {doc.size_bytes > 0 && <span>{formatFileSize(doc.size_bytes)}</span>}
            {updated && <span className="hidden sm:inline">{updated}</span>}
          </div>

          {doc.state === 'failed' && doc.error_message && (
            <p className="mt-2 text-xs text-destructive">{doc.error_message}</p>
          )}
          {doc.state === 'waiting_for_ai' && (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
              {searchAvailable
                ? 'The AI service is on now. Finish this document so your agent can use it.'
                : 'Read and saved. Your agent can use it once the AI service is switched on.'}
            </p>
          )}
          {doc.state === 'refreshing' && (
            <p className="mt-2 text-xs text-muted-foreground">
              {`Your agent keeps answering from the current version until this finishes${
                doc.type === 'url' ? ', then uses what the page says now' : ''
              }.`}
            </p>
          )}
          {doc.state === 'processing' && doc.stuck && (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
              {doc.type === 'url'
                ? 'This is taking longer than it should. Try again, and if it keeps happening, add a more specific page.'
                : 'This is taking longer than it should. Try again, and if it keeps happening, upload a smaller file.'}
            </p>
          )}
          {refreshWarning && <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">{doc.error_message}</p>}
          {doc.state === 'ready' && !refreshWarning && doc.providers.error && (
            <p className="mt-2 text-xs text-muted-foreground">{doc.providers.error}</p>
          )}

          {showRetry && (
            <Button variant="outline" size="xs" className="mt-2" onClick={onRetry} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
              {doc.state === 'waiting_for_ai' ? 'Finish now' : 'Try again'}
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-8 shrink-0 items-center justify-center rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            aria-label={`Actions for ${doc.name}`}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <MoreHorizontal className="size-4" aria-hidden="true" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onRetry} disabled={processing}>
              <RefreshCw aria-hidden="true" />
              {doc.type === 'url' ? 'Refresh from website' : 'Read again'}
            </DropdownMenuItem>
            {doc.type !== 'url' && (
              <DropdownMenuItem onClick={onReplace} disabled={processing}>
                <Replace aria-hidden="true" />
                Replace with new file
              </DropdownMenuItem>
            )}
            {doc.url && (
              <DropdownMenuItem onClick={() => window.open(doc.url ?? '', '_blank', 'noopener,noreferrer')}>
                <ExternalLink aria-hidden="true" />
                Open page
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 aria-hidden="true" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

// ─── Ask your documents ──────────────────────────────────────────────────────

const STRENGTH_LABELS = { strong: 'Strong match', good: 'Good match', possible: 'Possible match' } as const

function AskDocumentsCard({ readyCount, aiOff, loading }: { readyCount: number; aiOff: boolean; loading: boolean }) {
  const { results, lastQuery, isSearching, error, search } = useKnowledgeSearch()
  const [query, setQuery] = useState('')
  const inputId = useId()
  const disabled = loading || aiOff || readyCount === 0

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!disabled && query.trim().length >= 2) void search(query)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ask your documents</CardTitle>
        <CardDescription>
          Type a question a caller might ask. You’ll see the passages your agent would answer from.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="space-y-2">
          <Label htmlFor={inputId} className="sr-only">
            Question
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={inputId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Do you have parking?"
              maxLength={KNOWLEDGE_MAX_QUERY_LENGTH}
              disabled={disabled}
              className="h-9 sm:flex-1"
            />
            <Button type="submit" variant="secondary" className="h-9 shrink-0" disabled={disabled || isSearching || query.trim().length < 2}>
              {isSearching ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
              {isSearching ? 'Searching…' : 'Search'}
            </Button>
          </div>
          {!loading && aiOff && (
            <p className="text-xs text-muted-foreground">Available once the AI service is switched on.</p>
          )}
          {!loading && !aiOff && readyCount === 0 && (
            <p className="text-xs text-muted-foreground">Once a document is ready, you can test questions here.</p>
          )}
        </form>

        <div aria-live="polite" aria-busy={isSearching}>
          {isSearching && !results ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : results && results.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm">
              <p className="font-medium">Nothing in your documents answers “{lastQuery}”.</p>
              <p className="mt-1 text-muted-foreground">
                On a call, your agent would say it doesn’t have that information and offer to take a message.
                Add a document that covers it if callers ask this often.
              </p>
            </div>
          ) : results ? (
            <ol className={cn('space-y-3', isSearching && 'opacity-60')}>
              {results.map((result, index) => (
                <SearchResultItem key={result.chunk_id} result={result} rank={index + 1} />
              ))}
            </ol>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function SearchResultItem({ result, rank }: { result: KnowledgeSearchResult; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const strength = matchStrength(result.similarity)
  const long = result.content.length > 320
  const text = expanded || !long ? result.content : `${result.content.slice(0, 300).trimEnd()}…`

  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Result {rank}: </span>
          <span className="truncate">{result.document_name}</span>
        </p>
        <Badge
          variant="outline"
          className={cn(
            strength === 'strong' && 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
            strength === 'possible' && 'text-muted-foreground'
          )}
        >
          {STRENGTH_LABELS[strength]} · {Math.round(result.similarity * 100)}%
        </Badge>
      </div>
      {result.heading && <p className="mt-1 truncate text-xs text-muted-foreground">{result.heading}</p>}
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{text}</p>
      {long && (
        <Button variant="link" size="xs" className="mt-1 h-auto px-0" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? 'Show less' : 'Show the whole passage'}
        </Button>
      )}
    </li>
  )
}
