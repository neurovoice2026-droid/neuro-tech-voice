// GET  /api/commerce/connections — the organization's store connections (DTOs, never a secret).
// POST /api/commerce/connections — connect a store: validated against the
// real platform, secrets encrypted at rest, webhooks registered, first import queued.
import { z } from 'zod'
import { RequestError, assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import { commerceRoute, noStore, requireCommerceOrg } from '@/lib/commerce/api'
import { connectStore } from '@/lib/commerce/connections'
import { PLATFORM_CATALOG } from '@/lib/commerce/platforms'
import { connectionDto, listConnections } from '@/lib/commerce/store'
import { COMMERCE_PLATFORMS } from '@/lib/commerce/types'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

const Body = z.object({
  platform: z.enum(COMMERCE_PLATFORMS as [string, ...string[]]),
  store_url: z.string().trim().min(4).max(500),
  display_name: z.string().trim().max(100).optional(),
  secrets: z.record(z.string().regex(/^[a-z_]{1,40}$/), z.string().max(4096)).default({}),
})

export async function GET(request: Request) {
  return commerceRoute(request, 'connections.list', async (log) => {
    const ctx = await requireCommerceOrg(log)
    await enforceRateLimit(RATE_LIMITS.commerceRead, ctx.org.id)
    const rows = await listConnections(ctx.db, ctx.org.id)
    return noStore({ items: await Promise.all(rows.map((r) => connectionDto(ctx.db, r))) })
  })
}

export async function POST(request: Request) {
  return commerceRoute(request, 'connections.create', async (log) => {
    assertSameOrigin(request)
    const ctx = await requireCommerceOrg(log)
    const body = await parseJsonBody(request, Body, 32 * 1024)
    const platform = body.platform as (typeof COMMERCE_PLATFORMS)[number]
    if (platform === 'shopify') throw new RequestError('invalid_request', 'Shopify se conectează prin autorizare OAuth, nu prin chei.', 400)
    // Only the catalog's field keys are accepted (a stray key never reaches the encrypted blob).
    const allowed = new Set(PLATFORM_CATALOG[platform].fields.filter((f) => f.key !== 'store_url').map((f) => f.key))
    const secrets = Object.fromEntries(Object.entries(body.secrets).filter(([k, v]) => allowed.has(k) && v.trim() !== '').map(([k, v]) => [k, v.trim()]))
    for (const f of PLATFORM_CATALOG[platform].fields) {
      if (f.required && f.key !== 'store_url' && !secrets[f.key]) throw new RequestError('invalid_request', `Completează câmpul „${f.label}”.`, 400, [{ path: f.key, message: 'required' }])
    }
    await enforceRateLimit(RATE_LIMITS.commerceConnect, ctx.org.id, 'Prea multe încercări de conectare. Încearcă din nou în câteva minute.')
    const row = await connectStore(ctx.db, { orgId: ctx.org.id, userId: ctx.user.id, platform, storeUrl: body.store_url, displayName: body.display_name ?? null, secrets }, ctx.log)
    return noStore({ connection: await connectionDto(ctx.db, row) }, 201)
  })
}
