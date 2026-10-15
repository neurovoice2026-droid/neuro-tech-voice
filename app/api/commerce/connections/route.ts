// GET  /api/commerce/connections — the organization's store connections (DTOs, never a secret).
// POST /api/commerce/connections — connect a store: validated against the
// real platform, secrets encrypted at rest, webhooks registered, first import
// queued and its first slice run right after the response.
import { z } from 'zod'
import { RequestError, assertSameOrigin, parseJsonBody } from '@/lib/api/http'
import { commerceRoute, noStore, requireCommerceOrg } from '@/lib/commerce/api'
import { connectStore } from '@/lib/commerce/connections'
import { summarizeCommerceConfig } from '@/lib/commerce/config'
import { PLATFORM_CATALOG } from '@/lib/commerce/platforms'
import { connectionDto, listConnections } from '@/lib/commerce/store'
import { scheduleInitialSyncKick } from '@/lib/commerce/sync'
import { COMMERCE_PLATFORMS } from '@/lib/commerce/types'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'

// Room for the connect itself plus the first import slice (lib/commerce/sync.ts KICK_SLICE_MS) run after the response.
export const maxDuration = 120

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
    // `config` (booleans only) lets the connect cards say up front what this deployment cannot connect yet (Shopify without its app).
    return noStore({ items: await Promise.all(rows.map((r) => connectionDto(ctx.db, r))), config: summarizeCommerceConfig() })
  })
}

export async function POST(request: Request) {
  return commerceRoute(request, 'connections.create', async (log) => {
    assertSameOrigin(request)
    const ctx = await requireCommerceOrg(log)
    const body = await parseJsonBody(request, Body, 32 * 1024)
    const platform = body.platform as (typeof COMMERCE_PLATFORMS)[number]
    if (platform === 'shopify') throw new RequestError('invalid_request', 'Shopify connects through OAuth authorization, not through keys.', 400)
    // Only the catalog's field keys are accepted (a stray key never reaches the encrypted blob).
    const allowed = new Set(PLATFORM_CATALOG[platform].fields.filter((f) => f.key !== 'store_url').map((f) => f.key))
    const secrets = Object.fromEntries(Object.entries(body.secrets).filter(([k, v]) => allowed.has(k) && v.trim() !== '').map(([k, v]) => [k, v.trim()]))
    for (const f of PLATFORM_CATALOG[platform].fields) {
      if (f.required && f.key !== 'store_url' && !secrets[f.key]) throw new RequestError('invalid_request', `Fill in the "${f.label}" field.`, 400, [{ path: f.key, message: 'required' }])
    }
    await enforceRateLimit(RATE_LIMITS.commerceConnect, ctx.org.id, 'Too many connection attempts. Try again in a few minutes.')
    const row = await connectStore(ctx.db, { orgId: ctx.org.id, userId: ctx.user.id, platform, storeUrl: body.store_url, displayName: body.display_name ?? null, secrets }, ctx.log)
    scheduleInitialSyncKick(ctx.db, row.id, ctx.log)
    return noStore({ connection: await connectionDto(ctx.db, row) }, 201)
  })
}
