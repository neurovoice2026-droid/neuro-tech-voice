import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseSearchParams } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'

export const runtime = 'nodejs'

const MESSAGE_COLUMNS =
  'id, org_id, agent_id, call_id, recipient_contact_id, recipient_name, caller_name, caller_number, callback_number, body, urgency, status, notified_at, created_at'

// "unread" covers both new messages and ones the team was alerted about but
// nobody has opened in the dashboard yet.
const STATUS_FILTERS = {
  unread: ['new', 'notified'],
  read: ['read'],
  done: ['done'],
  all: ['new', 'notified', 'read', 'done'],
} as const

const querySchema = z.object({
  status: z.enum(['unread', 'read', 'done', 'all']).default('unread'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  // Rows already shown. "Show more" sends it instead of a page number, so rows
  // that left the filter after being marked read or done don't shift the next page.
  offset: z.coerce.number().int().min(0).max(100_000).optional(),
})

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export const GET = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  const query = parseSearchParams(req.nextUrl, querySchema)
  const from = query.offset ?? (query.page - 1) * query.page_size

  const count = (statuses: readonly string[]) =>
    ctx.supabase
      .from('agent_messages')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ctx.org.id)
      .in('status', [...statuses])

  const [list, unread, read, done] = await Promise.all([
    ctx.supabase
      .from('agent_messages')
      .select(MESSAGE_COLUMNS, { count: 'exact' })
      .eq('org_id', ctx.org.id)
      .in('status', [...STATUS_FILTERS[query.status]])
      // Urgent first ('urgent' sorts after 'normal'), then newest.
      .order('urgency', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + query.page_size - 1),
    count(STATUS_FILTERS.unread),
    count(STATUS_FILTERS.read),
    count(STATUS_FILTERS.done),
  ])

  const firstError = list.error ?? unread.error ?? read.error ?? done.error
  if (firstError) {
    if (isMissingTable(firstError)) {
      return noStore(
        NextResponse.json({
          messages: [],
          total: 0,
          page: query.page,
          page_size: query.page_size,
          counts: { unread: 0, read: 0, done: 0 },
          available: false,
        })
      )
    }
    console.error('[messages] list failed', firstError.code, firstError.message)
    throw new ApiError(500, 'load_failed', 'We couldn’t load your messages. Please try again.')
  }

  return noStore(
    NextResponse.json({
      messages: list.data ?? [],
      total: list.count ?? 0,
      page: query.page,
      page_size: query.page_size,
      counts: { unread: unread.count ?? 0, read: read.count ?? 0, done: done.count ?? 0 },
      available: true,
    })
  )
})
