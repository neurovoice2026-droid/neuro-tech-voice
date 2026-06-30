'use client'

import { useState, useRef, useTransition } from 'react'
import { UploadCloud, FileText, X, CheckCircle2, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface KnowledgeUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ACCEPTED = '.pdf,.txt,.md,.docx'
const MAX_MB = 10

export function KnowledgeUploadDialog({ open, onOpenChange }: KnowledgeUploadDialogProps) {
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(incoming: FileList | null) {
    if (!incoming) return
    const valid = Array.from(incoming).filter(
      (f) => f.size <= MAX_MB * 1024 * 1024
    )
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name))
      return [...prev, ...valid.filter((f) => !names.has(f.name))]
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  function handleUpload() {
    if (files.length === 0) return
    startTransition(async () => {
      const form = new FormData()
      files.forEach((f) => form.append('files', f))
      await fetch('/api/agent/knowledge', { method: 'POST', body: form })
      setUploaded(true)
      setTimeout(() => {
        setFiles([])
        setUploaded(false)
        onOpenChange(false)
      }, 1500)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
              isDragging ? 'border-primary bg-purple-50' : 'border-border hover:border-purple-300 hover:bg-purple-50/30'
            )}
          >
            <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, TXT, MD, DOCX — max {MAX_MB}MB each</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((f) => (
                <div key={f.name} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate text-sm">{f.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(f.size / 1024).toFixed(0)}KB
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFiles((p) => p.filter((x) => x.name !== f.name)) }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            className="w-full purple-glow"
            disabled={files.length === 0 || isPending || uploaded}
            onClick={handleUpload}
          >
            {uploaded ? (
              <><CheckCircle2 className="mr-2 h-4 w-4 text-green-400" />Uploaded!</>
            ) : isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
            ) : (
              `Upload ${files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'files'}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
