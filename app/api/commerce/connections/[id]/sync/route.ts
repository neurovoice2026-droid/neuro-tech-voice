// POST /api/commerce/connections/[id]/sync — queue a manual sync ({ resource?: 'all' | ... }); 409 when one is already queued or running.
import { z } from 'zod'
import { RequestError, assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import { commerceRoute, noStore, ownedConnection, requireCommerceOrg } from '@/lib/commerce/api'
import { enqueueSyncJob, writeAudit } from '@/lib/commerce/store'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

const Body = z.object({ resource: z.enum(['all', 'products', 'customers', 'orders', 'carts']).default('all') })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return commerceRoute(request, 'connections.sync', async (log) => {
    assertSameOrigin(request)
    const ctx = await requireCommerceOrg(log)
    const row = await ownedConnection(ctx.db, ctx.org.id, (await params).id)
    const body = request.headers.get('content-length') && request.headers.get('content-length') !== '0' ? await parseJsonBody(request, Body, 2 * 1024) : { resource: 'all' as const }
    if (row.status !== 'active' && row.status !== 'degraded') throw new RequestError('precondition_failed', 'Conexiunea nu este activă.', 409, { reason: 'connection_inactive' })
    await enforceRateLimit(RATE_LIMITS.commerceSync, row.id, 'Prea multe sincronizări manuale. Încearcă din nou în câteva minute.')
    const res = await enqueueSyncJob(ctx.db, { orgId: ctx.org.id, connectionId: row.id, kind: 'manual', resource: body.resource })
    if (res === 'already_active') throw new RequestError('conflict', 'O sincronizare este deja în curs.', 409, { reason: 'already_running' })
    await writeAudit(ctx.db, { orgId: ctx.org.id, actor: 'user', actorUserId: ctx.user.id, action: 'sync.requested', connectionId: row.id, metadata: { resource: body.resource } }, ctx.log)
    return noStore({ queued: true }, 202)
  })
}
