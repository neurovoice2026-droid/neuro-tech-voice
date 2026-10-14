// GET /api/commerce/runs?automation_id&connection_id&status&call_id&cursor&limit — automation run history.
import { z } from 'zod'
import { RequestError } from '@/lib/api/http'
import { commerceRoute, noStore, pageQuery, requireCommerceOrg, uuid } from '@/lib/commerce/api'
import { RUN_COLUMNS_WITH_REFS, RUN_STATUSES, type RunRow, encodeCursor, runDto } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

export async function GET(request: Request) {
  return commerceRoute(request, 'runs.list', async (log) => {
    const ctx = await requireCommerceOrg(log)
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    const url = new URL(request.url)
    const page = pageQuery(url)
    let q = ctx.db.from('commerce_automation_runs').select(RUN_COLUMNS_WITH_REFS).eq('org_id', ctx.org.id)
    for (const key of ['automation_id', 'connection_id', 'call_id'] as const) {
      const v = url.searchParams.get(key)
      if (v) {
        if (!uuid.safeParse(v).success) throw new RequestError('invalid_request', 'Invalid identifier.', 400)
        q = q.eq(key, v)
      }
    }
    const status = z.enum(RUN_STATUSES as [string, ...string[]]).safeParse(url.searchParams.get('status'))
    if (status.success) q = q.eq('status', status.data)
    // Runs page by creation time (their updated_at moves on every state change).
    if (page.cursor) q = q.or(`created_at.lt.${page.cursor.updated_at},and(created_at.eq.${page.cursor.updated_at},id.lt.${page.cursor.id})`)
    const { data, error } = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(page.limit + 1)
    if (error) throw new Error(`commerce_automation_runs read failed: ${error.message}`)
    const rows = (data ?? []) as RunRow[]
    const slice = rows.slice(0, page.limit)
    const last = slice[slice.length - 1]
    return noStore({ items: slice.map(runDto), next_cursor: rows.length > page.limit && last ? encodeCursor({ updated_at: last.created_at, id: last.id }) : null, total: null })
  })
}
