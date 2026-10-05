import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { CALL_LIST_COLUMNS, dbError, limitQuerySchema, parseQuery, serializeListItem, type CallRow } from '@/lib/calls/serialize'

const QuerySchema = limitQuerySchema(50, 20)

// GET /api/dashboard/recent-calls?limit= — newest calls of the org (both
// providers), from the `calls` table. Response: CallListItem[].
export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'dashboard.recent_calls' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const { limit } = parseQuery(request, QuerySchema)

    const { data, error } = await supabase
      .from('calls')
      .select(CALL_LIST_COLUMNS)
      .eq('org_id', org.id)
      .order('started_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw dbError('recent calls', error)

    return NextResponse.json(((data ?? []) as unknown as CallRow[]).map(serializeListItem))
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'dashboard.recent_calls.failed', requestId)
  }
}
