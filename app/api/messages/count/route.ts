import { NextResponse } from 'next/server'
import { ApiError, handleRoute, noStore } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'

export const runtime = 'nodejs'

// Lightweight unread counter for the navigation badge (head request, no rows).
export const GET = handleRoute(async () => {
  const ctx = await requireOrgContext()
  const { count, error, status } = await ctx.supabase
    .from('agent_messages')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.org.id)
    .in('status', ['new', 'notified'])

  if (error) {
    // HEAD responses carry no body, so a missing table shows up only as a 404.
    if (error.code === '42P01' || error.code === 'PGRST205' || status === 404) {
      return noStore(NextResponse.json({ unread: 0 }))
    }
    console.error('[messages] unread count failed', error.code, error.message)
    throw new ApiError(500, 'load_failed', 'Could not count unread messages.')
  }
  return noStore(NextResponse.json({ unread: count ?? 0 }))
})
