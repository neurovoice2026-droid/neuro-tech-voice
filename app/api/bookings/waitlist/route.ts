import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseSearchParams } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'

export const runtime = 'nodejs'

const WAITLIST_COLUMNS =
  'id, org_id, agent_id, call_id, caller_name, caller_phone, service, preferred_times, status, offered_at, created_at'

const querySchema = z.object({
  // active = still waiting for a slot (waiting or offered one).
  status: z.enum(['active', 'waiting', 'offered', 'booked', 'removed', 'all']).default('active'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
  // Rows already shown; "Show more" sends it so entries marked booked or
  // removed meanwhile don't shift the next page.
  offset: z.coerce.number().int().min(0).max(100_000).optional(),
})

export const GET = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  const query = parseSearchParams(req.nextUrl, querySchema)
  const offset = query.offset ?? (query.page - 1) * query.page_size

  let builder = ctx.supabase
    .from('waitlist_entries')
    .select(WAITLIST_COLUMNS, { count: 'exact' })
    .eq('org_id', ctx.org.id)
  if (query.status === 'active') builder = builder.in('status', ['waiting', 'offered'])
  else if (query.status !== 'all') builder = builder.eq('status', query.status)

  // First come, first served: the oldest entry is offered a freed slot first.
  const { data, error, count } = await builder
    .order('created_at', { ascending: query.status === 'active' || query.status === 'waiting' || query.status === 'offered' })
    .range(offset, offset + query.page_size - 1)

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return noStore(NextResponse.json({ entries: [], total: 0, page: query.page, page_size: query.page_size, available: false }))
    }
    console.error('[waitlist] list failed', error.code, error.message)
    throw new ApiError(500, 'load_failed', 'We couldn’t load your waitlist. Please try again.')
  }

  return noStore(
    NextResponse.json({ entries: data ?? [], total: count ?? 0, page: query.page, page_size: query.page_size, available: true })
  )
})
