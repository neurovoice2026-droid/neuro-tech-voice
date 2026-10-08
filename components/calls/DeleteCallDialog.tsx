'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
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
      <DialogContent>
        <DialogHeader>
          <span className="mb-2 grid size-10 place-items-center rounded-full bg-destructive-soft text-destructive" aria-hidden="true">
            <Trash2 className="size-[18px]" />
          </span>
          <DialogTitle>Delete call record?</DialogTitle>
          <DialogDescription>
            This permanently deletes the call, its transcript and its recording, here and at the
            voice provider that handled it. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive-solid"
            onClick={handleDelete}
            loading={isPending}
            loadingText="Deleting…"
          >
            Delete call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
