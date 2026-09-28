'use client'

import { useCallback, useState } from 'react'
import { CalendarCheck, ListOrdered, MessageSquare } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessagesPanel } from '@/components/inbox/MessagesPanel'
import { BookingsPanel } from '@/components/inbox/BookingsPanel'
import { WaitlistPanel } from '@/components/inbox/WaitlistPanel'
import { INBOX_TABS, type InboxTab } from '@/components/inbox/inbox-tabs'
import { useUnreadMessages } from '@/components/inbox/unread'

interface InboxPageClientProps {
  timezone: string
  initialTab: InboxTab
}

export function InboxPageClient({ timezone, initialTab }: InboxPageClientProps) {
  const [tab, setTab] = useState<InboxTab>(initialTab)
  const [panelUnread, setPanelUnread] = useState<number | null>(null)
  const onUnreadChange = useCallback((count: number) => setPanelUnread(count), [])
  // The Messages panel reports its own count once loaded; until then (or when
  // the page opens on another tab) the lightweight counter fills the badge.
  const counterUnread = useUnreadMessages()
  const unread = panelUnread ?? counterUnread

  const changeTab = (value: unknown) => {
    const next = INBOX_TABS.find((t) => t === value)
    if (!next) return
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    window.history.replaceState(window.history.state, '', url)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Messages your agent took, appointments it booked, and callers waiting for a free slot.
        </p>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList variant="line" className="w-full group-data-horizontal/tabs:h-11 justify-start gap-0 overflow-x-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="messages" className="h-full shrink-0 rounded-none px-3 sm:px-4">
            <MessageSquare className="size-4" aria-hidden="true" />
            Messages
            {unread > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
                {unread > 99 ? '99+' : unread}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="bookings" className="h-full shrink-0 rounded-none px-3 sm:px-4">
            <CalendarCheck className="size-4" aria-hidden="true" />
            Bookings
          </TabsTrigger>
          <TabsTrigger value="waitlist" className="h-full shrink-0 rounded-none px-3 sm:px-4">
            <ListOrdered className="size-4" aria-hidden="true" />
            Waitlist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="pt-4">
          <MessagesPanel timezone={timezone} onUnreadChange={onUnreadChange} />
        </TabsContent>
        <TabsContent value="bookings" className="pt-4">
          <BookingsPanel timezone={timezone} />
        </TabsContent>
        <TabsContent value="waitlist" className="pt-4">
          <WaitlistPanel timezone={timezone} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
