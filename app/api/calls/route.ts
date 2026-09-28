import { NextResponse, type NextRequest } from 'next/server'
import { handleRoute, noStore, parseSearchParams } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { dbError } from './_lib/db'
import { buildCallFilterOps, CALL_LIST_COLUMNS, CallListQuerySchema, safeTimeZone, sortColumn } from './_lib/query'

// GET /api/calls — the organisation's call history from the database, filtered
// (status, direction, sentiment, outcome, tag, dates in the org's time zone,
// full-text search) and paginated with an exact count. Test calls are hidden
// unless include_test=1. The transcript is loaded only by the detail route.

export const runtime = 'nodejs'

// Typed as string so supabase-js doesn't try to parse the column list at the type level.
const LIST_SELECT: string = `${CALL_LIST_COLUMNS}, agents(name)`

export const GET = handleRoute(async (req: NextRequest) => {
  const ctx = await requireOrgContext()
  const params = parseSearchParams(req.nextUrl, CallListQuerySchema)
  const timeZone = safeTimeZone(ctx.org.timezone)

  const from = (params.page - 1) * params.limit
  const to = from + params.limit - 1
  const ascending = params.sortOrder === 'asc'

  let query = ctx.supabase
    .from('calls')
    .select(LIST_SELECT, { count: 'exact' })
    .eq('org_id', ctx.org.id)
  for (const op of buildCallFilterOps(params, timeZone)) {
    switch (op.op) {
      case 'eq':
        query = query.eq(op.column, op.value)
        break
      case 'gte':
        query = query.gte(op.column, op.value)
        break
      case 'lt':
        query = query.lt(op.column, op.value)
        break
      case 'or':
        query = query.or(op.value)
        break
      case 'contains':
        query = query.contains(op.column, op.value)
        break
      case 'in':
        query = query.in(op.column, op.value)
        break
    }
  }

  const { data, count, error } = await query
    .order(sortColumn(params.sortBy), { ascending, nullsFirst: false })
    .order('id', { ascending })
    .range(from, to)

  if (error) {
    // PostgREST answers 416-style PGRST103 when the page is past the end.
    if (error.code === 'PGRST103') {
      return noStore(NextResponse.json({ calls: [], total: count ?? 0, page: params.page, totalPages: Math.max(1, Math.ceil((count ?? 0) / params.limit)), hasMore: false }))
    }
    throw dbError(error, 'list calls')
  }

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / params.limit))
  const calls = (data ?? []).map((row) => {
    const { agents, ...rest } = row as unknown as Record<string, unknown> & { agents?: { name?: string | null } | null }
    return { ...rest, agent_name: agents?.name ?? null }
  })

  return noStore(
    NextResponse.json({
      calls,
      total,
      page: params.page,
      totalPages,
      hasMore: params.page < totalPages,
    })
  )
})
