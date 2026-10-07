'use client'

import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileText, Globe, Trash2, Upload, Link2, CheckCircle2, AlertCircle, Loader2, Info,
  RefreshCw, RotateCw, Type, Bot, Clock, Pencil, FileUp, RefreshCcw,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  KNOWLEDGE_LIMITS, canPinToPrompt, isProcessing, validateKnowledgeFile,
  type useKnowledge, type KnowledgeDoc, type KnowledgeUsage, type UploadingFile,
} from '@/hooks/useKnowledge'
import { useKnowledgeWebsite } from '@/hooks/useKnowledgeWebsite'
import { EditDocumentDialog } from '@/components/agent/knowledge/EditDocumentDialog'
import { KnowledgeTestCard } from '@/components/agent/knowledge/KnowledgeTestCard'
import { RagBadge, SyncBadge, UsageModeBadge } from '@/components/agent/knowledge/KnowledgeBadges'
import { WebsiteImportCard } from '@/components/agent/knowledge/WebsiteImportCard'
import { cn, formatDate, formatFileSize } from '@/lib/utils'
import { toast } from 'sonner'

type KnowledgeHook = ReturnType<typeof useKnowledge>

interface TabKnowledgeProps {
  hook: KnowledgeHook
}

const STAGE_LABEL: Record<UploadingFile['stage'], string> = {
  preparing: 'Preparing…',
  uploading: 'Uploading…',
  processing: 'Adding to your agent…',
  done: 'Done',
  error: 'Failed',
}

export function TabKnowledge({ hook }: TabKnowledgeProps) {
  const {
    docs, isLoading, uploading, retrying, busy, usage, uploadFiles, addUrl, addText, retryDoc, deleteDoc, refetch, clearErrorUploads,
    refreshDoc, updateDoc, loadDocText, replaceFile, refreshUsage,
  } = hook
  const websiteHook = useKnowledgeWebsite(() => void refreshUsage())
  const [editTarget, setEditTarget] = useState<KnowledgeDoc | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [isAddingUrl, setIsAddingUrl] = useState(false)
  const [textName, setTextName] = useState('')
  const [textBody, setTextBody] = useState('')
  const [isAddingText, setIsAddingText] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDoc | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const valid: File[] = []
    for (const f of Array.from(files)) {
      const problem = validateKnowledgeFile(f)
      if (problem) toast.error(`"${f.name}": ${problem}`)
      else valid.push(f)
    }
    if (valid.length > 0) await uploadFiles(valid)
  }, [uploadFiles])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  const handleAddUrl = async () => {
    const url = urlInput.trim()
    if (!url || isAddingUrl) return
    if (!/^https?:\/\//i.test(url)) {
      toast.error('Enter a full web address, starting with https://')
      return
    }
    setIsAddingUrl(true)
    const ok = await addUrl(url)
    if (ok) setUrlInput('')
    setIsAddingUrl(false)
  }

  const textTooLong = textBody.length > KNOWLEDGE_LIMITS.maxTextChars
  const canAddText = !!textName.trim() && !!textBody.trim() && !textTooLong && !isAddingText

  const handleAddText = async () => {
    if (!canAddText) return
    setIsAddingText(true)
    const ok = await addText(textName.trim(), textBody)
    if (ok) {
      setTextName('')
      setTextBody('')
    }
    setIsAddingText(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    await deleteDoc(deleteTarget.id)
    setIsDeleting(false)
    setDeleteTarget(null)
  }

  const totalDocs = docs.length
  const totalSize = usage?.bytes_used ?? docs.reduce((acc, d) => acc + (d.size_bytes ?? 0), 0)
  const attachedCount = docs.filter((d) => d.status === 'ready' && !!d.attached_at).length
  const hasUploadErrors = uploading.some((u) => u.status === 'error')
  const hasKnowledge = attachedCount > 0 || websiteHook.websites.some((w) => w.status === 'succeeded')

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex gap-4">
        <Card className="flex-1">
          <CardContent className="py-4">
            <p className="text-2xl font-bold">{totalDocs}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Documents</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="py-4">
            <p className="text-2xl font-bold">{formatFileSize(totalSize)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {usage ? `of ${formatFileSize(usage.bytes_limit)} used` : 'Total size'}
            </p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="py-4">
            <p className="text-2xl font-bold">{attachedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">On your agent</p>
          </CardContent>
        </Card>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Files</CardTitle>
          <CardDescription>
            Supported: {KNOWLEDGE_LIMITS.typesLabel} — max {KNOWLEDGE_LIMITS.maxFileMb} MB per file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30',
            )}
          >
            <Upload className={cn('size-8 mb-3', isDragging ? 'text-primary' : 'text-muted-foreground')} />
            <p className="text-sm font-medium">
              {isDragging ? 'Drop files here' : 'Click or drag & drop files'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {KNOWLEDGE_LIMITS.typesLabel} up to {KNOWLEDGE_LIMITS.maxFileMb} MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={KNOWLEDGE_LIMITS.accept}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {/* Upload progress */}
          {uploading.length > 0 && (
            <div className="space-y-2">
              {uploading.map((u) => (
                <UploadProgress key={u.id} item={u} />
              ))}
              {hasUploadErrors && (
                <Button variant="ghost" size="sm" onClick={clearErrorUploads} className="text-xs">
                  Clear failed uploads
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add URL</CardTitle>
          <CardDescription>Import a public web page into your knowledge base.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/faq"
              className="flex-1"
              inputMode="url"
              maxLength={2048}
              disabled={isAddingUrl}
              onKeyDown={(e) => e.key === 'Enter' && void handleAddUrl()}
            />
            <Button
              onClick={() => void handleAddUrl()}
              disabled={!urlInput.trim() || isAddingUrl}
              className="shrink-0"
            >
              {isAddingUrl ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              <span className="ml-1.5">{isAddingUrl ? 'Adding…' : 'Add URL'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import a whole website */}
      <WebsiteImportCard hook={websiteHook} maxPages={usage?.crawl_max_pages ?? 25} />

      {/* Add text */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Text</CardTitle>
          <CardDescription>Paste opening hours, prices, policies or FAQs directly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={textName}
            onChange={(e) => setTextName(e.target.value)}
            placeholder="Name, e.g. Opening hours & prices"
            maxLength={KNOWLEDGE_LIMITS.maxNameChars}
            disabled={isAddingText}
          />
          <Textarea
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            placeholder="Paste or type the information your agent should know…"
            className="min-h-32 max-h-80 overflow-y-auto"
            disabled={isAddingText}
            aria-invalid={textTooLong || undefined}
          />
          <div className="flex items-center justify-between gap-2">
            <p className={cn('text-xs', textTooLong ? 'text-destructive' : 'text-muted-foreground')}>
              {textBody.length.toLocaleString()} / {KNOWLEDGE_LIMITS.maxTextChars.toLocaleString()} characters
            </p>
            <Button onClick={() => void handleAddText()} disabled={!canAddText} className="shrink-0">
              {isAddingText ? <Loader2 className="size-4 animate-spin" /> : <Type className="size-4" />}
              <span className="ml-1.5">{isAddingText ? 'Adding…' : 'Add text'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Knowledge Base</CardTitle>
            <CardDescription>Files, pages and text your agent can reference.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void refetch()} title="Refresh">
            <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && docs.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No documents yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload files, add pages or paste text to help your agent answer questions.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  usage={usage}
                  isRetrying={retrying.includes(doc.id)}
                  isBusy={busy.includes(doc.id)}
                  onRetry={() => void retryDoc(doc.id)}
                  onDelete={() => setDeleteTarget(doc)}
                  onEdit={() => setEditTarget(doc)}
                  onRefresh={() => void refreshDoc(doc.id)}
                  onReplace={(file) => void replaceFile(doc.id, file)}
                  onUsageMode={(mode) =>
                    void updateDoc(doc.id, { usage_mode: mode }, mode === 'prompt' ? `"${doc.name}" is now always included` : `"${doc.name}" is used when relevant`)
                  }
                />
              ))}
            </div>
          )}
          {usage && usage.prompt_chars_used > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Always included: {usage.prompt_chars_used.toLocaleString()} of {usage.prompt_chars_limit.toLocaleString()} characters.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ask the knowledge base */}
      <KnowledgeTestCard disabled={!hasKnowledge} />

      <EditDocumentDialog
        doc={editTarget}
        onClose={() => setEditTarget(null)}
        loadText={loadDocText}
        onSave={(docId, patch) => updateDoc(docId, patch)}
      />

      {/* Tips */}
      <Card className="border-dashed">
        <CardContent className="py-4 flex gap-3">
          <Info className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Your agent uses these documents to answer caller questions accurately.</p>
            <p>
              Turn on &quot;Always include&quot; for short, key facts (opening hours, prices, address) so your agent knows them on every call.
              Web pages and imported websites are re-read automatically every week.
            </p>
            <p>
              Accepted: {KNOWLEDGE_LIMITS.typesLabel} up to {KNOWLEDGE_LIMITS.maxFileMb} MB each, public web pages, and pasted
              text up to {KNOWLEDGE_LIMITS.maxTextChars.toLocaleString()} characters.
            </p>
            <p>For best results: use clear, well-structured, text-based documents. Scanned images can&apos;t be read.</p>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; will be removed from your agent&apos;s knowledge base. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
              {isDeleting && <Loader2 className="size-4 animate-spin mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UploadProgress({ item }: { item: UploadingFile }) {
  return (
    <div className="space-y-1.5 rounded-lg border p-3 bg-muted/30">
      <div className="flex items-center gap-2 text-sm">
        {item.status === 'error' ? (
          <AlertCircle className="size-4 text-destructive shrink-0" />
        ) : item.status === 'done' ? (
          <CheckCircle2 className="size-4 text-green-500 shrink-0" />
        ) : (
          <Loader2 className="size-4 animate-spin shrink-0" />
        )}
        <span className="truncate flex-1 font-medium">{item.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{STAGE_LABEL[item.stage]}</span>
      </div>
      {item.status === 'uploading' && (
        <Progress value={item.progress} className="h-1" />
      )}
      {item.status === 'error' && item.error && (
        <p className="text-xs text-destructive">{item.error}</p>
      )}
    </div>
  )
}

const STATUS_STYLE = {
  processing: 'border-blue-200 bg-blue-50 text-blue-700',
  stalled: 'border-amber-300 bg-amber-50 text-amber-800',
  ready: 'border-green-200 bg-green-50 text-green-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
} as const

function StatusBadge({ doc }: { doc: KnowledgeDoc }) {
  if (doc.deleting_at) {
    return (
      <Badge variant="outline" className="gap-1 text-xs" title="This document is being removed. Delete it again if it stays here.">
        <Loader2 aria-hidden="true" className="animate-spin" />
        Removing
      </Badge>
    )
  }
  if (doc.status === 'processing') {
    const stalled = !isProcessing(doc)
    return (
      <Badge
        variant="outline"
        className={cn('gap-1 text-xs', stalled ? STATUS_STYLE.stalled : STATUS_STYLE.processing)}
        title={stalled ? 'Processing stopped before it finished. Retry to continue.' : 'Uploading to your agent'}
      >
        {stalled ? <Clock aria-hidden="true" /> : <Loader2 aria-hidden="true" className="animate-spin" />}
        {stalled ? 'Stalled' : 'Processing'}
      </Badge>
    )
  }
  if (doc.status === 'failed') {
    return (
      <Badge variant="outline" className={cn('gap-1 text-xs', STATUS_STYLE.failed)}>
        <AlertCircle aria-hidden="true" />
        Failed
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className={cn('gap-1 text-xs', STATUS_STYLE.ready)}>
      <CheckCircle2 aria-hidden="true" />
      Ready
    </Badge>
  )
}

function AttachedIndicator({ doc }: { doc: KnowledgeDoc }) {
  if (doc.attached_at && doc.status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700" title={`Added to your agent on ${formatDate(doc.attached_at)}`}>
        <Bot className="size-3.5" aria-hidden="true" />
        On your agent
      </span>
    )
  }
  if (doc.status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700" title="This document is not part of your agent yet. Retry to add it.">
        <Bot className="size-3.5" aria-hidden="true" />
        Not on your agent yet
      </span>
    )
  }
  return null
}

const FILE_TYPES = new Set(['pdf', 'docx', 'txt', 'md', 'html', 'epub'])

interface DocRowProps {
  doc: KnowledgeDoc
  usage: KnowledgeUsage | null
  isRetrying: boolean
  isBusy: boolean
  onRetry: () => void
  onDelete: () => void
  onEdit: () => void
  onRefresh: () => void
  onReplace: (file: File) => void
  onUsageMode: (mode: 'auto' | 'prompt') => void
}

function DocRow({ doc, usage, isRetrying, isBusy, onRetry, onDelete, onEdit, onRefresh, onReplace, onUsageMode }: DocRowProps) {
  const Icon = doc.type === 'url' ? Globe : doc.type === 'text' ? Type : FileText
  const showRetry = !!doc.can_retry || isRetrying
  const settled = doc.status === 'ready' && !!doc.elevenlabs_doc_id && !doc.deleting_at
  const working = isRetrying || isBusy
  const replaceInput = useRef<HTMLInputElement>(null)
  const pinned = doc.usage_mode === 'prompt'
  const canPin = pinned || canPinToPrompt(doc, usage)
  const iconButton = 'p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50'

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
      <Icon className="size-5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" title={doc.url ?? doc.name}>{doc.name}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <StatusBadge doc={doc} />
          {doc.size_bytes > 0 && (
            <span className="text-xs text-muted-foreground">{formatFileSize(doc.size_bytes)}</span>
          )}
          <Badge variant="outline" className="text-xs">{doc.type.toUpperCase()}</Badge>
          <AttachedIndicator doc={doc} />
          {settled && <RagBadge status={doc.rag_status} progress={doc.rag_progress} />}
          <UsageModeBadge doc={doc} />
          {settled && <SyncBadge doc={doc} />}
        </div>
        {doc.status === 'failed' && doc.error_message && (
          <p className="text-xs text-destructive mt-1.5">{doc.error_message}</p>
        )}
        {settled && canPin && (
          <div className="mt-2 flex items-center gap-2">
            <Switch
              id={`kb-pin-${doc.id}`}
              size="sm"
              checked={pinned}
              disabled={working}
              onCheckedChange={(checked) => onUsageMode(checked ? 'prompt' : 'auto')}
              aria-label={`Always include ${doc.name} in every call`}
            />
            <label htmlFor={`kb-pin-${doc.id}`} className="text-xs text-muted-foreground">
              Always include (for short key facts)
            </label>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {showRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={working}
            title={doc.status === 'ready' ? (doc.attached_at ? 'Index this document again' : 'Add this document to your agent') : 'Try processing this document again'}
          >
            {isRetrying ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
            <span className="ml-1">{isRetrying ? 'Retrying…' : 'Retry'}</span>
          </Button>
        )}
        {isBusy && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />}
        {settled && doc.type === 'url' && (
          <button type="button" onClick={onRefresh} disabled={working} className={iconButton} title="Re-read this page now" aria-label={`Refresh ${doc.name}`}>
            <RefreshCcw className="size-4" />
          </button>
        )}
        {settled && FILE_TYPES.has(doc.type) && (
          <>
            <button type="button" onClick={() => replaceInput.current?.click()} disabled={working} className={iconButton} title="Replace with a new version of the file" aria-label={`Replace the file ${doc.name}`}>
              <FileUp className="size-4" />
            </button>
            <input
              ref={replaceInput}
              type="file"
              accept={KNOWLEDGE_LIMITS.accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                const problem = validateKnowledgeFile(file)
                if (problem) toast.error(`"${file.name}": ${problem}`)
                else onReplace(file)
              }}
            />
          </>
        )}
        {!doc.deleting_at && doc.status !== 'processing' && (
          <button
            type="button"
            onClick={onEdit}
            disabled={working}
            className={iconButton}
            title={doc.type === 'text' ? 'Edit text' : 'Rename'}
            aria-label={doc.type === 'text' ? `Edit ${doc.name}` : `Rename ${doc.name}`}
          >
            <Pencil className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={working}
          className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
          title="Delete document"
          aria-label={`Delete ${doc.name}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}
