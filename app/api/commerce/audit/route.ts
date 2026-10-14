// GET /api/commerce/audit?cursor&limit — the organization's commerce audit trail (redacted metadata).
import { commerceRoute, noStore, pageQuery, requireCommerceOrg } from '@/lib/commerce/api'
import { encodeCursor } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

interface AuditRow {
  id: string
  actor: string
  action: string
  created_at: string
  metadata: Record<string, unknown>
  connection_id: string | null
  automation_id: string | null
  run_id: string | null
  call_id: string | null
}

export async function GET(request: Request) {
  return commerceRoute(request, 'audit.list', async (log) => {
    const ctx = await requireCommerceOrg(log)
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    const page = pageQuery(new URL(request.url))
    let q = ctx.db.from('commerce_audit_log').select('id, actor, action, created_at, metadata, connection_id, automation_id, run_id, call_id').eq('org_id', ctx.org.id)
    if (page.cursor) q = q.or(`created_at.lt.${page.cursor.updated_at},and(created_at.eq.${page.cursor.updated_at},id.lt.${page.cursor.id})`)
    const { data, error } = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(page.limit + 1)
    if (error) throw new Error(`commerce_audit_log read failed: ${error.message}`)
    const rows = (data ?? []) as AuditRow[]
    const slice = rows.slice(0, page.limit)
    const last = slice[slice.length - 1]
    return noStore({
      items: slice.map((r) => ({ ...r, metadata: Object.fromEntries(Object.entries(r.metadata ?? {}).filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v))) })),
      next_cursor: rows.length > page.limit && last ? encodeCursor({ updated_at: last.created_at, id: last.id }) : null,
      total: null,
    })
  })
}
