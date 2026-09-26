'use client'

import { useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
          toast.error(body?.error?.message ?? 'We couldn’t delete this call. Please try again.')
          return
        }
        toast.success('Call deleted')
        onDeleted(callId)
        onOpenChange(false)
      } catch {
        toast.error('We couldn’t reach the server. Check your connection and try again.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="rounded-full bg-red-100 p-1.5">
              <Trash2 aria-hidden="true" className="size-4 text-red-600" />
            </span>
            Delete this call?
          </DialogTitle>
          <DialogDescription>
            The transcript, summary and recording are removed for good, including the copies kept by our voice
            providers. Bookings and messages from the call stay in place. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        {/* flex-1 only side by side: in the stacked phone layout it would collapse the buttons to their text height. */}
        <div className="flex flex-col-reverse gap-2 pt-2 max-sm:[&_[data-slot=button]]:h-10 sm:flex-row sm:gap-3">
          <Button variant="outline" className="sm:flex-1" onClick={() => onOpenChange(false)} disabled={isPending}>
            Keep call
          </Button>
          <Button variant="destructive" className="sm:flex-1" onClick={handleDelete} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                Deleting…
              </>
            ) : (
              'Delete call'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
