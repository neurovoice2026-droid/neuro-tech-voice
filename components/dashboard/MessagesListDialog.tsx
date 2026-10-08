'use client'

// "Show all" for the dashboard's Messages to follow up card: every open
// message (the 100 newest), each with mark-as-done.

import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { OpenMessagesList, useOpenMessages } from './OpenMessagesList'

/** The API's maximum page size (GET /api/messages limit 1..100). */
const ALL_MESSAGES_LIMIT = 100

interface MessagesListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A message was marked done or re-opened here (the card refreshes). */
  onChanged?: () => void
}

export function MessagesListDialog({ open, onOpenChange, onChanged }: MessagesListDialogProps) {
  const { data, failed, busyId, reload, markDone } = useOpenMessages(ALL_MESSAGES_LIMIT, { enabled: open, onChanged })
  const messages = data?.messages ?? []
  const truncated = !!data && data.open_count > messages.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Messages to follow up</DialogTitle>
          <DialogDescription>
            {data
              ? `${data.open_count} open message${data.open_count === 1 ? '' : 's'}, newest first. Mark one as done once you have followed up.`
              : 'Messages your agent took during calls, newest first.'}
          </DialogDescription>
        </DialogHeader>

        {!data && !failed ? (
          <OrbLoader size={32} label="Loading messages…" className="min-h-[160px]" />
        ) : failed && !data ? (
          <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-secondary px-4 py-3 text-[13px] text-muted-foreground">
            Messages could not be loaded.
            <Button variant="outline" size="sm" onClick={reload}>
              <RotateCw aria-hidden="true" /> Retry
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <p className="rounded-2xl bg-secondary px-4 py-6 text-center text-[13px] text-muted-foreground">Nothing to follow up.</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl bg-white shadow-hair">
              <OpenMessagesList messages={messages} busyId={busyId} onDone={markDone} />
            </div>
            {truncated && (
              <p className="text-xs text-muted-foreground">
                Showing the {messages.length} newest of {data.open_count} open messages. Mark some as done to see older ones.
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
