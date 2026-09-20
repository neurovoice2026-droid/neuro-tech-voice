import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { InboxPageClient } from '@/components/inbox/InboxPageClient'
import { parseInboxTab } from '@/components/inbox/inbox-tabs'
import { getOrgContext } from '@/lib/api/auth'

export const metadata: Metadata = {
  title: 'Inbox',
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [ctx, params] = await Promise.all([getOrgContext(), searchParams])
  if (!ctx) redirect('/login')

  return <InboxPageClient timezone={ctx.org.timezone} initialTab={parseInboxTab(params.tab)} />
}
