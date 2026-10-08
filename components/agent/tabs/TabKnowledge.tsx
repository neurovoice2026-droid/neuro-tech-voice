'use client'

import { useState, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  AlertCircle, Bot, CheckCircle2, Clock, FileText, FileUp, Globe, Link2, MoreHorizontal, Pencil, RefreshCcw,
  RefreshCw, RotateCw, Trash2, Type, Upload,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/shared/EmptyState'
import { Field, FormSection } from '@/components/shared/FormSection'
import { OrbInline, OrbLoader } from '@/components/shared/OrbLoader'
import { StatTile } from '@/components/shared/StatTile'
import { StatusChip } from '@/components/shared/StatusChip'
import {
  KNOWLEDGE_LIMITS, canPinToPrompt, isProcessing, validateKnowledgeFile,
  type useKnowledge, type KnowledgeDoc, type KnowledgeUsage, type UploadingFile,
} from '@/hooks/useKnowledge'
import { useKnowledgeWebsite } from '@/hooks/useKnowledgeWebsite'
import { EditDocumentDialog, canEditDocumentText } from '@/components/agent/knowledge/EditDocumentDialog'
import { KnowledgeTestCard } from '@/components/agent/knowledge/KnowledgeTestCard'
import { RagBadge, SyncBadge, UsageModeBadge, hasRagBadge } from '@/components/agent/knowledge/KnowledgeBadges'
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

/** Overline label (11 px, tracked, uppercase, muted). */
const OVERLINE = 'text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase'

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
  const firstLoad = isLoading && docs.length === 0
  const refreshing = isLoading && docs.length > 0
  const storagePct = usage && usage.bytes_limit > 0 ? (totalSize / usage.bytes_limit) * 100 : null
  const acceptedTypes = KNOWLEDGE_LIMITS.typesLabel.split(', ')

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 pb-8 sm:grid-cols-3">
        <StatTile size="sm" label="Documents" value={totalDocs} loading={firstLoad} hint="Files, pages and text" />
        <StatTile size="sm" label="On your agent" value={attachedCount} loading={firstLoad} hint="Ready to use on calls" />
        <StatTile
          size="sm"
          className="col-span-2 sm:col-span-1"
          label="Storage"
          value={formatFileSize(totalSize)}
          loading={firstLoad}
          hint={usage ? `of ${formatFileSize(usage.bytes_limit)} used` : 'Total size'}
          meter={
            storagePct !== null
              ? {
                  value: storagePct,
                  tone: storagePct >= 100 ? 'danger' : storagePct >= 80 ? 'warning' : 'default',
                  label: 'Knowledge storage used',
                }
              : undefined
          }
        />
      </div>

      {/* Upload zone */}
      <FormSection
        title="Upload files"
        description={`Supported: ${KNOWLEDGE_LIMITS.typesLabel} — max ${KNOWLEDGE_LIMITS.maxFileMb} MB per file.`}
      >
        <div
          role="button"
          tabIndex={0}
          data-drag={isDragging ? 'true' : undefined}
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
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#d6d4dc] bg-band px-6 py-10 text-center transition-colors outline-none hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid data-[drag=true]:border-foreground/40 data-[drag=true]:bg-secondary"
        >
          <span className="mb-3 grid size-11 place-items-center rounded-full bg-white shadow-hair" aria-hidden="true">
            <Upload className="size-5 text-foreground" />
          </span>
          <p className="text-sm font-medium">
            {isDragging ? 'Drop files here' : 'Click or drag & drop files'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
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
            <ul className="overflow-hidden rounded-2xl bg-white shadow-hair" aria-label="Uploads">
              {uploading.map((u) => (
                <UploadProgress key={u.id} item={u} />
              ))}
            </ul>
            {hasUploadErrors && (
              <Button variant="ghost" size="sm" className="tap-44" onClick={clearErrorUploads}>
                Clear failed uploads
              </Button>
            )}
          </div>
        )}
      </FormSection>

      {/* Document list */}
      <section aria-labelledby="kb-documents-title" className="border-t border-rule py-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 id="kb-documents-title" className="text-[15px] leading-[22px] font-medium">Knowledge base</h2>
            <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">Files, pages and text your agent can reference.</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {refreshing && <OrbInline state="breathing" label="Updating…" />}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void refetch()}
              title="Refresh"
              aria-label="Refresh documents"
              className="tap-44 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw />
            </Button>
          </div>
        </div>

        {firstLoad ? (
          <Card className="py-0">
            {/* About five rows: closer to a typical list (69 px a row) than the empty state, so less moves when it arrives. */}
            <OrbLoader label="Loading documents…" className="min-h-[360px]" />
          </Card>
        ) : docs.length === 0 ? (
          <Card className="py-0">
            <EmptyState
              bare
              icon={FileText}
              title="No documents yet"
              description="Upload files, add pages or paste text to help your agent answer questions."
              className="py-10"
            />
          </Card>
        ) : (
          <Card className="gap-0 py-0">
            <ul className={cn('transition-opacity duration-200', refreshing && 'opacity-60')} aria-busy={refreshing || undefined}>
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
            </ul>
            {usage && usage.prompt_chars_used > 0 && (
              <p className="border-t border-rule px-4 py-3 text-xs text-muted-foreground tabular-nums sm:px-5">
                Always included: {usage.prompt_chars_used.toLocaleString()} of {usage.prompt_chars_limit.toLocaleString()} characters.
              </p>
            )}
          </Card>
        )}
      </section>

      {/* Add URL */}
      <FormSection title="Add a web page" description="Import a public web page into your knowledge base.">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/faq"
              aria-label="Web page address"
              className="pl-9"
              inputMode="url"
              maxLength={2048}
              disabled={isAddingUrl}
              onKeyDown={(e) => e.key === 'Enter' && void handleAddUrl()}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => void handleAddUrl()}
            disabled={!urlInput.trim()}
            loading={isAddingUrl}
            loadingText="Adding…"
            className="h-10"
          >
            Add URL
          </Button>
        </div>
      </FormSection>

      {/* Import a whole website */}
      <WebsiteImportCard hook={websiteHook} maxPages={usage?.crawl_max_pages ?? 25} />

      {/* Add text */}
      <FormSection title="Add text" description="Paste opening hours, prices, policies or FAQs directly.">
        <Field label="Name" htmlFor="kb-text-name">
          <Input
            id="kb-text-name"
            value={textName}
            onChange={(e) => setTextName(e.target.value)}
            placeholder="e.g. Opening hours & prices"
            maxLength={KNOWLEDGE_LIMITS.maxNameChars}
            disabled={isAddingText}
          />
        </Field>
        <Field label="Text" htmlFor="kb-text-body">
          <Textarea
            id="kb-text-body"
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            placeholder="Paste or type the information your agent should know…"
            className="min-h-32 max-h-80 overflow-y-auto"
            disabled={isAddingText}
            aria-invalid={textTooLong || undefined}
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <p className={cn('text-xs tabular-nums', textTooLong ? 'text-destructive' : 'text-muted-foreground')}>
            {textBody.length.toLocaleString()} / {KNOWLEDGE_LIMITS.maxTextChars.toLocaleString()} characters
          </p>
          <Button variant="outline" onClick={() => void handleAddText()} disabled={!canAddText} loading={isAddingText} loadingText="Adding…">
            <Type aria-hidden="true" />
            Add text
          </Button>
        </div>
      </FormSection>

      {/* Ask the knowledge base */}
      <KnowledgeTestCard disabled={!hasKnowledge} />

      <EditDocumentDialog
        doc={editTarget}
        onClose={() => setEditTarget(null)}
        loadText={loadDocText}
        onSave={(docId, patch) => updateDoc(docId, patch)}
      />

      {/* Tips */}
      <section aria-label="Tips for your knowledge base" className="rounded-2xl bg-secondary p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn(OVERLINE, 'mr-1.5')}>Accepted</span>
          {[...acceptedTypes, 'Web page', 'Text'].map((t) => (
            <Badge key={t} variant="outline">{t}</Badge>
          ))}
        </div>
        <p className="mt-2.5 text-xs leading-[18px] text-muted-foreground">
          Files up to {KNOWLEDGE_LIMITS.maxFileMb} MB each, public web pages, and pasted text up to{' '}
          {KNOWLEDGE_LIMITS.maxTextChars.toLocaleString()} characters.
        </p>
        <div className="mt-4 space-y-1.5 border-t border-[#e2e0e8] pt-4 text-[13px] leading-[19px] text-muted-foreground">
          <p>Your agent uses these documents to answer caller questions accurately.</p>
          <p>
            Turn on &quot;Always include&quot; for short, key facts (opening hours, prices, address) so your agent knows them on every call.
            Web pages and imported websites are re-read automatically every week.
          </p>
          <p>For best results: use clear, well-structured, text-based documents. Scanned images can&apos;t be read.</p>
        </div>
      </section>

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
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive-solid" onClick={() => void handleDelete()} loading={isDeleting} loadingText="Deleting…">
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
    <li className="space-y-2 border-b border-rule px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-3 text-sm">
        <span className="grid size-5 shrink-0 place-items-center">
          {item.status === 'error' ? (
            <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
          ) : item.status === 'done' ? (
            <CheckCircle2 className="size-4 text-success-dot" aria-hidden="true" />
          ) : (
            <OrbInline state="weaving" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
        <span className={cn('shrink-0 text-xs', item.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
          {STAGE_LABEL[item.stage]}
        </span>
      </div>
      {item.status === 'uploading' && (
        <Progress value={item.progress} aria-label={`Upload progress for ${item.name}`} className="pl-8" />
      )}
      {item.status === 'error' && item.error && (
        <p className="pl-8 text-xs text-destructive">{item.error}</p>
      )}
    </li>
  )
}

function StatusBadge({ doc }: { doc: KnowledgeDoc }) {
  if (doc.deleting_at) {
    return (
      <StatusChip tone="muted" icon={<OrbInline state="working" />} title="This document is being removed. Delete it again if it stays here.">
        Removing
      </StatusChip>
    )
  }
  if (doc.status === 'processing') {
    const stalled = !isProcessing(doc)
    return stalled ? (
      <StatusChip tone="warning" icon={<Clock aria-hidden="true" />} title="Processing stopped before it finished. Retry to continue.">
        Stalled
      </StatusChip>
    ) : (
      <StatusChip tone="neutral" icon={<OrbInline state="weaving" />} title="Uploading to your agent">
        Processing
      </StatusChip>
    )
  }
  if (doc.status === 'failed') {
    return (
      <StatusChip tone="danger" icon={<AlertCircle aria-hidden="true" />}>
        Failed
      </StatusChip>
    )
  }
  return (
    <StatusChip tone="success" dot>
      Ready
    </StatusChip>
  )
}

function AttachedIndicator({ doc }: { doc: KnowledgeDoc }) {
  if (doc.attached_at && doc.status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1" title={`Added to your agent on ${formatDate(doc.attached_at)}`}>
        <Bot className="size-3.5" aria-hidden="true" />
        On your agent
      </span>
    )
  }
  if (doc.status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 text-warning" title="This document is not part of your agent yet. Retry to add it.">
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
  const canRefresh = settled && doc.type === 'url'
  const canReplace = settled && FILE_TYPES.has(doc.type)
  const canEdit = !doc.deleting_at && doc.status !== 'processing'
  const editLabel = canEditDocumentText(doc) ? 'Edit text' : 'Rename'
  // Chips under the name: the status chip moves here below `sm` (it sits next to the menu from `sm`).
  const extraChips = (settled && hasRagBadge(doc.rag_status)) || pinned
  const showError = doc.status === 'failed' && !!doc.error_message
  const showPin = settled && canPin
  const desktopExtras = extraChips || showError || showPin || showRetry

  const extras = (
    <>
      <div className={cn('flex flex-wrap items-center gap-1.5', !extraChips && 'sm:hidden')}>
        <span className="contents sm:hidden">
          <StatusBadge doc={doc} />
        </span>
        {settled && <RagBadge status={doc.rag_status} progress={doc.rag_progress} />}
        <UsageModeBadge doc={doc} />
      </div>
      {showError && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {doc.error_message}
        </p>
      )}
      {showPin && (
        <div className="flex items-center gap-2">
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
      {showRetry && (
        <div>
          <Button
            variant="outline"
            size="sm"
            className="tap-44"
            onClick={onRetry}
            disabled={working && !isRetrying}
            loading={isRetrying}
            loadingText="Retrying…"
            title={doc.status === 'ready' ? (doc.attached_at ? 'Index this document again' : 'Add this document to your agent') : 'Try processing this document again'}
          >
            <RotateCw aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}
    </>
  )

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-rule px-4 py-3.5 last:border-b-0 sm:px-5">
      <span className="mt-0.5 grid size-9 place-items-center rounded-full bg-secondary" aria-hidden="true">
        <Icon className="size-4 text-foreground" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm leading-5 font-medium" title={doc.url ?? doc.name}>{doc.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-muted-foreground">
          <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] leading-3 tracking-wide uppercase">{doc.type}</span>
          {doc.size_bytes > 0 && <span className="tabular-nums">{formatFileSize(doc.size_bytes)}</span>}
          <AttachedIndicator doc={doc} />
          {settled && <SyncBadge doc={doc} />}
        </div>
      </div>
      <div className="-mr-1.5 flex items-center gap-1.5">
        {isBusy && <OrbInline state="working" label="Saving" />}
        <span className="hidden sm:contents">
          <StatusBadge doc={doc} />
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${doc.name}`}
            disabled={working}
            render={<Button variant="ghost" size="icon-sm" className="tap-44 text-muted-foreground hover:text-foreground aria-expanded:text-foreground" />}
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              {canRefresh && (
                <DropdownMenuItem onClick={onRefresh}>
                  <RefreshCcw /> Re-read this page now
                </DropdownMenuItem>
              )}
              {canReplace && (
                <DropdownMenuItem onClick={() => replaceInput.current?.click()}>
                  <FileUp /> Replace with a new version
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil /> {editLabel}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            {(canRefresh || canReplace || canEdit) && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 /> Delete document
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {canReplace && (
          <input
            ref={replaceInput}
            type="file"
            accept={KNOWLEDGE_LIMITS.accept}
            className="hidden"
            aria-label={`Replace the file ${doc.name}`}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              const problem = validateKnowledgeFile(file)
              if (problem) toast.error(`"${file.name}": ${problem}`)
              else onReplace(file)
            }}
          />
        )}
      </div>
      <div className={cn('col-start-2 col-end-4 mt-2.5 space-y-2.5', !desktopExtras && 'sm:hidden')}>{extras}</div>
    </li>
  )
}
