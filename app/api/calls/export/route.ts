import type { NextRequest } from 'next/server'
import { ApiError, handleRoute, parseJson, parseSearchParams } from '@/lib/api/http'
import { requireOrgContext, type OrgContext } from '@/lib/api/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { dbError } from '../_lib/db'
import { toCsv, toJsonRows, type ExportCallRow } from '../_lib/csv'
import {
  buildCallFilterOps,
  CallFiltersSchema,
  chunk,
  EXPORT_ROW_LIMIT,
  ExportBodySchema,
  exportBodyToSearchParams,
  ExportQuerySchema,
  safeTimeZone,
  SELECTED_IDS_PER_QUERY,
  sortColumn,
} from '../_lib/query'

// GET  /api/calls/export?format=csv|json&scope=all|filtered|selected&columns=…
// POST /api/calls/export { format, scope, columns, …filters, selectedIds: [] }
// Exports from the database. Scopes: every call (tests excluded), the list's
// current filters, or the selected ids. Capped at 5,000 rows; the response
// headers say when the cap cut the export short. The dashboard posts, because
// a few hundred selected ids don't fit in a URL.

export const runtime = 'nodejs'
export const maxDuration = 60

const PAGE_SIZE = 1_000

type ExportParams = ReturnType<typeof ExportQuerySchema.parse>

function toExportRow(raw: unknown): ExportCallRow {
  const { agents, ...row } = raw as Record<string, unknown> & { agents?: { name?: string | null } | null }
  return { ...(row as unknown as Omit<ExportCallRow, 'agent_name'>), agent_name: agents?.name ?? null }
}

function newestFirst(a: ExportCallRow, b: ExportCallRow): number {
  const at = Date.parse(a.started_at ?? a.created_at) || 0
  const bt = Date.parse(b.started_at ?? b.created_at) || 0
  return bt - at || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
}

async function exportCalls(ctx: OrgContext, params: ExportParams): Promise<Response> {
  const timeZone = safeTimeZone(ctx.org.timezone)
  const withTranscript = params.columns.includes('transcript')
  const select: string = [
    'id', 'caller_number', 'direction', 'duration_seconds', 'status', 'outcome', 'intent', 'sentiment',
    'tags', 'started_at', 'created_at', 'summary', 'extracted', ...(withTranscript ? ['transcript'] : []),
    'agents(name)',
  ].join(', ')

  const rows: ExportCallRow[] = []
  let total = 0

  if (params.scope === 'selected') {
    if (params.selectedIds.length === 0) {
      throw new ApiError(400, 'nothing_selected', 'Select at least one call to export.')
    }
    // At most 500 ids, fetched in small batches so no request URL grows too long.
    for (const ids of chunk(params.selectedIds, SELECTED_IDS_PER_QUERY)) {
      const { data, error } = await ctx.supabase
        .from('calls')
        .select(select)
        .eq('org_id', ctx.org.id)
        .in('id', ids)
      if (error) throw dbError(error, 'export selected calls')
      for (const raw of data ?? []) rows.push(toExportRow(raw))
    }
    rows.sort(newestFirst)
    total = rows.length
  } else {
    const ops = params.scope === 'all'
      ? buildCallFilterOps(CallFiltersSchema.parse({}), timeZone)
      : buildCallFilterOps(params, timeZone)
    const ascending = params.scope === 'filtered' ? params.sortOrder === 'asc' : false
    const orderColumn = params.scope === 'filtered' ? sortColumn(params.sortBy) : 'started_at'

    for (let offset = 0; offset < EXPORT_ROW_LIMIT; offset += PAGE_SIZE) {
      const end = Math.min(offset + PAGE_SIZE, EXPORT_ROW_LIMIT) - 1
      let query = ctx.supabase
        .from('calls')
        .select(select, offset === 0 ? { count: 'exact' } : undefined)
        .eq('org_id', ctx.org.id)
      for (const op of ops) {
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
      const { data, error, count } = await query
        .order(orderColumn, { ascending, nullsFirst: false })
        .order('id', { ascending })
        .range(offset, end)
      if (error) throw dbError(error, 'export calls')
      if (offset === 0) total = count ?? 0

      for (const raw of data ?? []) rows.push(toExportRow(raw))
      if (!data || data.length < end - offset + 1) break
    }
  }

  const truncated = total > rows.length
  const date = new Date().toISOString().slice(0, 10)
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'X-Export-Row-Limit': String(EXPORT_ROW_LIMIT),
    'X-Export-Rows': String(rows.length),
    'X-Export-Total': String(total),
    'X-Export-Truncated': truncated ? 'true' : 'false',
    'Access-Control-Expose-Headers': 'X-Export-Row-Limit, X-Export-Rows, X-Export-Total, X-Export-Truncated',
  })

  if (params.format === 'json') {
    headers.set('Content-Type', 'application/json; charset=utf-8')
    headers.set('Content-Disposition', `attachment; filename="calls-${date}.json"`)
    const body = {
      exported_at: new Date().toISOString(),
      rows: rows.length,
      total_matching: total,
      truncated,
      row_limit: EXPORT_ROW_LIMIT,
      calls: toJsonRows(rows, params.columns),
    }
    return new Response(JSON.stringify(body, null, 2), { headers })
  }

  headers.set('Content-Type', 'text/csv; charset=utf-8')
  headers.set('Content-Disposition', `attachment; filename="calls-${date}.csv"`)
  return new Response(toCsv(rows, params.columns), { headers })
}

export const GET = handleRoute(async (req: NextRequest) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  return exportCalls(ctx, parseSearchParams(req.nextUrl, ExportQuerySchema))
})

export const POST = handleRoute(async (req: NextRequest) => {
  const ctx = await requireOrgContext()
  await enforceRateLimit(RATE_LIMITS.apiWrite, ctx.user.id)
  const body = await parseJson(req, ExportBodySchema, { maxBytes: 64 * 1024 })
  const url = new URL(req.nextUrl.pathname, req.nextUrl.origin)
  url.search = exportBodyToSearchParams(body).toString()
  return exportCalls(ctx, parseSearchParams(url, ExportQuerySchema))
})
