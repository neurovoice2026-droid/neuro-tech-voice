'use client'

import { useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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
    <Card className={cn('border shadow-sm', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <MessageSquareText className="size-4 text-purple-600" aria-hidden="true" />
          Messages to follow up
          {data && data.open_count > 0 && (
            <Badge variant="secondary" className="text-xs" aria-label={`${data.open_count} open`}>
              {data.open_count}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Messages your agent took during calls.</CardDescription>
        {hidden > 0 && (
          <CardAction>
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0"
              onClick={() => setShowAll(true)}
              aria-haspopup="dialog"
              aria-label={`Show all ${data?.open_count ?? ''} open messages`}
            >
              Show all
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {!data && !failed ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading messages">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : failed && !data ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" role="alert">
            Messages could not be loaded.
            <Button variant="outline" size="sm" onClick={reload}>
              Retry
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to follow up. Messages appear here when your agent takes one.</p>
        ) : (
          <>
            <OpenMessagesList messages={messages} busyId={busyId} onDone={markDone} />
            {hidden > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {hidden} more open message{hidden === 1 ? '' : 's'} not shown here.
              </p>
            )}
          </>
        )}
      </CardContent>

      <MessagesListDialog open={showAll} onOpenChange={setShowAll} onChanged={reload} />
    </Card>
  )
}
