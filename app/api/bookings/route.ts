import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, handleRoute, noStore, parseSearchParams } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'

export const runtime = 'nodejs'

const BOOKING_COLUMNS =
  'id, org_id, agent_id, call_id, calendar_id, google_event_id, caller_name, caller_phone, caller_email, service, starts_at, ends_at, timezone, status, notes, confirmation_sent_at, reminder_sent_at, created_at, updated_at'

const isoDate = z
  .string()
  .max(40)
  .refine((v) => Number.isFinite(Date.parse(v)), 'Must be a date')

const querySchema = z
  .object({
    // upcoming: not finished yet (soonest first); past: finished (latest first).
    range: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
    from: isoDate.optional(),
    to: isoDate.optional(),
    status: z.enum(['active', 'booked', 'rescheduled', 'cancelled', 'completed', 'no_show']).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine((q) => !q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), {
    message: 'from must be before to',
    path: ['to'],
  })

export const GET = handleRoute(async (req) => {
  const ctx = await requireOrgContext()
  const query = parseSearchParams(req.nextUrl, querySchema)
  const nowIso = new Date().toISOString()
  const offset = (query.page - 1) * query.page_size

  let builder = ctx.supabase
    .from('bookings')
    .select(BOOKING_COLUMNS, { count: 'exact' })
    .eq('org_id', ctx.org.id)

  if (query.range === 'upcoming') builder = builder.gte('ends_at', nowIso)
  if (query.range === 'past') builder = builder.lt('ends_at', nowIso)
  if (query.from) builder = builder.gte('starts_at', new Date(query.from).toISOString())
  if (query.to) builder = builder.lte('starts_at', new Date(query.to).toISOString())
  if (query.status === 'active') builder = builder.in('status', ['booked', 'rescheduled'])
  else if (query.status) builder = builder.eq('status', query.status)

  const { data, error, count } = await builder
    .order('starts_at', { ascending: query.range !== 'past' })
    .range(offset, offset + query.page_size - 1)

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return noStore(NextResponse.json({ bookings: [], total: 0, page: query.page, page_size: query.page_size, available: false }))
    }
    console.error('[bookings] list failed', error.code, error.message)
    throw new ApiError(500, 'load_failed', 'We couldn’t load your bookings. Please try again.')
  }

  return noStore(
    NextResponse.json({
      bookings: data ?? [],
      total: count ?? 0,
      page: query.page,
      page_size: query.page_size,
      available: true,
    })
  )
})
