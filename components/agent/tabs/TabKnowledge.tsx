'use client'

import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileText, Globe, Trash2, Upload, Link2, CheckCircle2,
  AlertCircle, Loader2, Info, RefreshCw,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { KnowledgeDocument } from '@/types'
import type { useKnowledge, UploadingFile } from '@/hooks/useKnowledge'
import { formatFileSize } from '@/lib/utils'

type KnowledgeHook = ReturnType<typeof useKnowledge>

const ACCEPTED = '.pdf,.txt,.docx,.md'
const MAX_SIZE_MB = 10
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

interface TabKnowledgeProps {
  hook: KnowledgeHook
}

export function TabKnowledge({ hook }: TabKnowledgeProps) {
  const { docs, isLoading, uploading, uploadFiles, addUrl, deleteDoc, refetch } = hook
  const [urlInput, setUrlInput] = useState('')
  const [isAddingUrl, setIsAddingUrl] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFiles = (files: File[]): File[] => {
    const valid: File[] = []
    for (const f of files) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (!['pdf', 'txt', 'docx', 'md'].includes(ext)) {
        continue
      }
      if (f.size > MAX_SIZE_BYTES) {
        continue
      }
      valid.push(f)
    }
    return valid
  }

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    const valid = validateFiles(arr)
    if (valid.length === 0) return
    await uploadFiles(valid)
  }, [uploadFiles])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return
    setIsAddingUrl(true)
    const ok = await addUrl(urlInput.trim())
    if (ok) setUrlInput('')
    setIsAddingUrl(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteDoc(deleteTarget.id)
    setDeleteTarget(null)
  }

  const totalDocs = docs.length
  const totalSize = docs.reduce((acc, d) => acc + d.size_bytes, 0)

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
            <p className="text-xs text-muted-foreground mt-0.5">Total size</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="py-4">
            <p className="text-2xl font-bold">{docs.filter(d => d.status === 'ready').length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ready</p>
          </CardContent>
        </Card>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Files</CardTitle>
          <CardDescription>
            Supported: PDF, TXT, DOCX, MD — max {MAX_SIZE_MB}MB per file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={[
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30',
            ].join(' ')}
          >
            <Upload className={['size-8 mb-3', isDragging ? 'text-primary' : 'text-muted-foreground'].join(' ')} />
            <p className="text-sm font-medium">
              {isDragging ? 'Drop files here' : 'Click or drag & drop files'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, TXT, DOCX, MD up to {MAX_SIZE_MB}MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)}
            />
          </div>

          {/* Upload progress */}
          {uploading.length > 0 && (
            <div className="space-y-2">
              {uploading.map(u => (
                <UploadProgress key={u.id} item={u} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add URL</CardTitle>
          <CardDescription>Scrape a webpage and add it to your knowledge base.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://example.com/faq"
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
            />
            <Button
              onClick={handleAddUrl}
              disabled={!urlInput.trim() || isAddingUrl}
              className="shrink-0"
            >
              {isAddingUrl ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              <span className="ml-1.5">{isAddingUrl ? 'Adding…' : 'Add URL'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Knowledge Base</CardTitle>
            <CardDescription>Files and URLs your agent can reference.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={refetch}>
            <RefreshCw className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                Upload files or add URLs to help your agent answer questions.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => (
                <DocRow key={doc.id} doc={doc} onDelete={() => setDeleteTarget(doc)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="border-dashed">
        <CardContent className="py-4 flex gap-3">
          <Info className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Your agent uses these documents to answer caller questions accurately.</p>
            <p>For best results: use clear, well-structured documents. Avoid scanned images.</p>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; will be removed from your agent&apos;s knowledge base. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
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
        <span className="text-xs text-muted-foreground shrink-0">
          {item.status === 'error' ? 'Failed' : item.status === 'done' ? 'Done' : `${item.progress}%`}
        </span>
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

function DocRow({ doc, onDelete }: { doc: KnowledgeDocument; onDelete: () => void }) {
  const Icon = doc.type === 'url' ? Globe : FileText
  const statusIcon = {
    ready: <CheckCircle2 className="size-3.5 text-green-500" />,
    processing: <Loader2 className="size-3.5 animate-spin text-muted-foreground" />,
    failed: <AlertCircle className="size-3.5 text-destructive" />,
  }[doc.status]

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
      <Icon className="size-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {statusIcon}
          <span className="text-xs text-muted-foreground capitalize">{doc.status}</span>
          {doc.size_bytes > 0 && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{formatFileSize(doc.size_bytes)}</span>
            </>
          )}
          <Badge variant="outline" className="text-xs">{doc.type.toUpperCase()}</Badge>
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
        title="Delete document"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}
