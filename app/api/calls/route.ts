import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { enforceRateLimit } from '@/lib/security/rate-limit'
import { CALL_SEARCH_LIMIT, buildTsQuery, searchCallIds } from '@/lib/calls/search'
import {
  applyCallFilters,
  CALL_LIST_COLUMNS,
  CallListQuerySchema,
  dbError,
  parseQuery,
  safeTimeZone,
  serializeListItem,
  type CallRow,
} from '@/lib/calls/serialize'

const ID_COLUMN: string = 'id'

// GET /api/calls — paginated call history for the signed-in org, read from the
// `calls` table (single source of truth for both voice providers).
// Response: { calls, total, page, totalPages, hasMore }.
export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'calls.list' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const q = parseQuery(request, CallListQuerySchema)
    const tz = safeTimeZone(org.timezone)

    // A text search also looks at what was said (transcripts): our own
    // full-text index, scoped to this org, rate limited (it scans the org's calls).
    let fullTextIds: string[] | null = null
    if (buildTsQuery(q.search)) {
      await enforceRateLimit(CALL_SEARCH_LIMIT, org.id, 'Too many searches in a short time. Please wait a moment.')
      fullTextIds = await searchCallIds(org.id, q.search ?? '')
    }

    const from = (q.page - 1) * q.limit
    let query = applyCallFilters(
      supabase.from('calls').select(CALL_LIST_COLUMNS, { count: 'exact' }).eq('org_id', org.id),
      q,
      tz,
      fullTextIds,
    )

    const ascending = q.sortOrder === 'asc'
    if (q.sortBy === 'duration_seconds') {
      query = query.order('duration_seconds', { ascending, nullsFirst: false })
    } else if (q.sortBy === 'caller_number') {
      query = query.order('caller_number', { ascending, nullsFirst: false })
    }
    // Date order (and the tie-break for the other sorts): started_at, then created_at.
    const dateAscending = q.sortBy === 'created_at' || q.sortBy === 'started_at' ? ascending : false
    query = query
      .order('started_at', { ascending: dateAscending, nullsFirst: false })
      .order('created_at', { ascending: dateAscending })
      .order('id', { ascending: dateAscending })
      .range(from, from + q.limit - 1)

    const { data, count, error } = await query
    let total = count ?? 0
    let rows = (data ?? []) as unknown as CallRow[]

    if (error) {
      // PGRST103: the requested page is past the end. Return an empty page with the real total.
      if (error.code !== 'PGRST103') throw dbError('calls list', error)
      const head = await applyCallFilters(
        supabase.from('calls').select(ID_COLUMN, { count: 'exact', head: true }).eq('org_id', org.id),
        q,
        tz,
        fullTextIds,
      )
      if (head.error) throw dbError('calls count', head.error)
      total = head.count ?? 0
      rows = []
    }

    const totalPages = Math.max(1, Math.ceil(total / q.limit))
    return NextResponse.json({
      calls: rows.map(serializeListItem),
      total,
      page: q.page,
      totalPages,
      hasMore: q.page < totalPages,
    })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'calls.list.failed', requestId)
  }
}
