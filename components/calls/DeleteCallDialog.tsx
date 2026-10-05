'use client'

import { useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { readApiError } from '@/hooks/useCalls'

interface DeleteCallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  callId: string
  onDeleted: (id: string) => void
}

export function DeleteCallDialog({ open, onOpenChange, callId, onDeleted }: DeleteCallDialogProps) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/calls/${encodeURIComponent(callId)}`, { method: 'DELETE' })
        if (!res.ok) {
          toast.error(await readApiError(res, 'Failed to delete the call record'))
          return
        }
        toast.success('Call record deleted')
        onDeleted(callId)
        onOpenChange(false)
      } catch (e) {
        toast.error(e instanceof Error && e.message ? `Failed to delete the call record: ${e.message}` : 'Failed to delete the call record')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-full bg-red-100 p-1.5">
              <Trash2 className="h-4 w-4 text-red-600" />
            </div>
            Delete call record?
          </DialogTitle>
          <DialogDescription>
            This permanently deletes the call, its transcript and its recording, here and at the
            voice provider that handled it. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</>
            ) : (
              'Delete call'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
