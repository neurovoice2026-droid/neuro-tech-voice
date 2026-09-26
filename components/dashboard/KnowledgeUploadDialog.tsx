'use client'

import Link from 'next/link'
import { UploadCloud } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { FileDropZone, KnowledgeUploadRow } from '@/components/agent/tabs/TabKnowledge'
import { useKnowledge } from '@/hooks/useKnowledge'

interface KnowledgeUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Quick upload from the dashboard. Same upload path as the Knowledge tab
 * (signed upload straight to storage, then indexing), and it shows how reading
 * each file went, not just that the bytes arrived.
 */
export function KnowledgeUploadDialog({ open, onOpenChange }: KnowledgeUploadDialogProps) {
  const kb = useKnowledge({ enabled: open, keepFinishedUploads: true })
  const uploading = kb.uploads.some((u) => u.stage !== 'done' && u.stage !== 'error')
  const readingIds = new Set(
    kb.docs.filter((d) => d.state === 'processing' && !d.stuck).map((d) => d.id)
  )
  const stillReading = kb.uploads.some((u) => u.documentId !== null && readingIds.has(u.documentId))

  const handleOpenChange = (next: boolean) => {
    // Uploads keep going in the background; finished results are cleared on close.
    if (!next) kb.clearFinishedUploads()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 p-1.5">
              <UploadCloud className="size-4 text-primary" aria-hidden="true" />
            </span>
            Add to your knowledge base
          </DialogTitle>
          <DialogDescription>
            Price lists, policies, FAQs and menus. Your agent answers callers from them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FileDropZone compact onFiles={(files) => kb.addFiles(files)} />

          {kb.uploads.length > 0 && (
            <ul className="max-h-64 space-y-2 overflow-y-auto" aria-live="polite">
              {kb.uploads.map((item) => (
                <KnowledgeUploadRow
                  key={item.id}
                  item={item}
                  doc={item.documentId ? kb.docs.find((d) => d.id === item.documentId) ?? null : null}
                  onRetry={() => kb.retryUpload(item.id)}
                  onCancel={() => kb.cancelUpload(item.id)}
                  onDismiss={() => kb.dismissUpload(item.id)}
                />
              ))}
            </ul>
          )}

          {uploading ? (
            <p className="text-xs text-muted-foreground">
              Stay on this page until the uploads finish. Reading them carries on by itself after that.
            </p>
          ) : stillReading ? (
            <p className="text-xs text-muted-foreground">
              You can close this window. Reading carries on, and results appear on the Agent page.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {uploading ? (
            <Button variant="outline" disabled>
              Manage documents
            </Button>
          ) : (
            <Link href="/agent?tab=knowledge" className={buttonVariants({ variant: 'outline' })} onClick={() => handleOpenChange(false)}>
              Manage documents
            </Link>
          )}
          <Button onClick={() => handleOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
