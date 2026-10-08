'use client'

import { useState } from 'react'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { cn } from '@/lib/utils'
import { CardError } from './CardError'
import { MessagesListDialog } from './MessagesListDialog'
import { OpenMessagesList, useOpenMessages } from './OpenMessagesList'

// Messages the agent took during calls (take_message tool) that are still
// open, newest first, with mark-as-done (and undo). The card stays compact;
// "Show all" opens every open message (up to 100) in a dialog.

export function MessagesToFollowUpCard({ limit = 5, className }: { limit?: number; className?: string }) {
  const { data, failed, busyId, reload, markDone } = useOpenMessages(limit)
  const [showAll, setShowAll] = useState(false)

  const messages = data?.messages ?? []
  const hidden = data ? Math.max(0, data.open_count - messages.length) : 0
  return (
    <Card className={cn('@container/messages gap-0 pb-0', className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          Messages to follow up
          {data && data.open_count > 0 && (
            <Badge variant="secondary" className="tabular-nums" aria-label={`${data.open_count} open`}>
              {data.open_count}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Messages your agent took during calls.</CardDescription>
        {/* Always rendered (empty without hidden messages) so the header keeps its height. */}
        <CardAction className="self-center">
          {hidden > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="-my-1 -mr-2"
              onClick={() => setShowAll(true)}
              aria-haspopup="dialog"
              aria-label={`Show all ${data?.open_count ?? ''} open messages`}
            >
              Show all
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <div className="border-t border-rule">
        {!data && !failed ? (
          // Reserves the rows it replaces (up to `limit`: about 125 px each while the card is
          // narrow, where the reason wraps, and 107 px from 640 px), so the cards below do not jump.
          <div
            className="grid min-h-[calc(var(--rows)*125px)] @min-[640px]/messages:min-h-[calc(var(--rows)*107px)]"
            style={{ '--rows': limit } as React.CSSProperties}
          >
            <OrbLoader label="Loading messages…" />
          </div>
        ) : failed && !data ? (
          <CardError message="Messages could not be loaded." onRetry={reload} />
        ) : messages.length === 0 ? (
          <p className="px-5 py-4 text-[13px] leading-[19px] text-muted-foreground">
            Nothing to follow up. Messages appear here when your agent takes one.
          </p>
        ) : (
          <>
            <OpenMessagesList messages={messages} busyId={busyId} onDone={markDone} />
            {hidden > 0 && (
              <p className="border-t border-rule px-5 py-3 text-xs text-muted-foreground">
                {hidden} more open message{hidden === 1 ? '' : 's'} not shown here.
              </p>
            )}
          </>
        )}
      </div>

      <MessagesListDialog open={showAll} onOpenChange={setShowAll} onChanged={reload} />
    </Card>
  )
}
