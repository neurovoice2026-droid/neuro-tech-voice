'use client'

import Link from 'next/link'
import { ArrowRight, BellRing, Inbox, MessageSquare } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useUnreadMessages } from '@/components/inbox/unread'
import { SkillSection } from '@/components/skills/SkillSection'
import { cn } from '@/lib/utils'
import type { EscalationContact } from '@/types'

interface MessagesSkillProps {
  contacts: EscalationContact[] | null
  /** The team list couldn't be loaded (the Team section shows the error). */
  contactsFailed?: boolean
}

export function MessagesSkill({ contacts, contactsFailed = false }: MessagesSkillProps) {
  const unread = useUnreadMessages()
  const alerted = (contacts ?? []).filter((c) => (c.notify_sms && c.phone) || (c.notify_email && c.email))

  return (
    <SkillSection
      id="messages"
      icon={MessageSquare}
      title="Messages"
      description="When the person a caller needs isn’t available, your agent takes a message instead of letting the call go nowhere."
      status={{ label: 'Always on', tone: 'on' }}
    >
      <div className="space-y-4">
        <ol className="space-y-3 text-sm">
          <Step n={1} title="Your agent takes the details">
            The caller’s name, a number to call back on, and what they need, read back to them to make sure it’s right.
          </Step>
          <Step n={2} title="It goes to the right person">
            If the caller asks for someone on your team, the message is addressed to them. Urgent matters are marked urgent.
          </Step>
          <Step n={3} title="You’re told straight away">
            The person it’s for gets a text or email if they have alerts on. If they can’t be reached, your on-call people are
            alerted, then anyone else with alerts on. Every message also lands in your Inbox.
          </Step>
        </ol>

        <div className="rounded-lg border p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <BellRing className="size-4 text-muted-foreground" aria-hidden="true" />
            Who gets alerts
          </p>
          {contactsFailed ? (
            <p className="mt-1 text-xs text-muted-foreground">We couldn’t load your team right now.</p>
          ) : contacts === null ? (
            <Skeleton className="mt-2 h-4 w-48" />
          ) : alerted.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              No one on your team has alerts turned on, so messages are emailed to the account owner. Add alerts under Team
              and transfers.
            </p>
          ) : (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {alerted.map((c) => (
                <li key={c.id} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                  {c.name}
                  <span className="text-muted-foreground">
                    {' '}
                    ({[c.notify_sms && c.phone ? 'text' : null, c.notify_email && c.email ? 'email' : null].filter(Boolean).join(' + ')})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Inbox className="size-4" aria-hidden="true" />
            {unread === 0 ? 'No unread messages.' : `${unread} unread message${unread === 1 ? '' : 's'}.`}
          </p>
          <Link href="/inbox" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'self-start sm:self-auto')}>
            Open Inbox
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </SkillSection>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
        aria-hidden="true"
      >
        {n}
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-muted-foreground">{children}</span>
      </span>
    </li>
  )
}
