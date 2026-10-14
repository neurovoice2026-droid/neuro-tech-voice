import 'server-only'
// Shared plumbing of the /api/commerce/* routes: the signed-in store
// organization, ownership checks, paging, and the one error path.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { requireOrg, type OrgContext } from '@/lib/api/auth'
import { RequestError, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'
import { readCommerceProfile, type CommerceProfile } from './profile'
import { type ConnectionRow, decodeCursor, encodeCursor, loadConnection, type PageCursor } from './store'

export interface CommerceOrgContext extends OrgContext {
  db: SupabaseClient
  businessType: 'services' | 'ecommerce' | null
  profile: CommerceProfile
  log: Logger
}

/**
 * The signed-in organization for a commerce route. `allowAnyType` lets the
 * onboarding state route answer before the business type is chosen; every
 * other route requires an e-commerce organization (403 otherwise).
 */
export async function requireCommerceOrg(log: Logger, opts: { allowAnyType?: boolean } = {}): Promise<CommerceOrgContext> {
  const ctx = await requireOrg()
  const db = createAdminClient()
  const { data, error } = await db.from('organizations').select('business_type, commerce_profile').eq('id', ctx.org.id).maybeSingle()
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') throw new RequestError('not_configured', 'Funcțiile pentru magazine nu sunt disponibile încă.', 503)
    throw new Error(`organizations read failed: ${error.message}`)
  }
  const businessType = (data?.business_type as 'services' | 'ecommerce' | null) ?? null
  if (!opts.allowAnyType && businessType !== 'ecommerce') throw new RequestError('forbidden', 'Această funcție este disponibilă doar magazinelor online.', 403)
  return { ...ctx, db, businessType, profile: readCommerceProfile(data?.commerce_profile), log: log.child({ orgId: ctx.org.id }) }
}

/** Runs a commerce route handler with the standard logging and error mapping. */
export async function commerceRoute(request: Request, name: string, handler: (log: Logger, requestId: string) => Promise<NextResponse>): Promise<NextResponse> {
  const requestId = requestIdFrom(request)
  const log = createLogger({ requestId, route: `commerce.${name}` })
  try {
    return await handler(log, requestId)
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, `commerce.${name}_failed`, requestId)
  }
}

export const uuid = z.string().uuid()

/** A connection of this organization, or 404 (never reveals other tenants' ids). */
export async function ownedConnection(db: SupabaseClient, orgId: string, id: string): Promise<ConnectionRow> {
  if (!uuid.safeParse(id).success) throw new RequestError('not_found', 'Conexiunea nu există.', 404)
  const row = await loadConnection(db, id, orgId)
  if (!row) throw new RequestError('not_found', 'Conexiunea nu există.', 404)
  return row
}

export const PAGE_LIMIT_MAX = 50

export interface PageQuery {
  limit: number
  cursor: PageCursor | null
  q: string | null
}

/** Parses limit / cursor / q from the URL; a bad cursor starts over. */
export function pageQuery(url: URL): PageQuery {
  const limitRaw = Number(url.searchParams.get('limit') ?? '25')
  const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= PAGE_LIMIT_MAX ? limitRaw : 25
  const q = (url.searchParams.get('q') ?? '').replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || null
  return { limit, cursor: decodeCursor(url.searchParams.get('cursor')), q }
}

/** Applies the (updated_at desc, id desc) keyset to a PostgREST query builder. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyKeyset<Q extends { or: (f: string) => Q; order: (c: string, o: any) => Q; limit: (n: number) => Q }>(q: Q, page: PageQuery): Q {
  let out = q
  if (page.cursor) {
    out = out.or(`updated_at.lt.${page.cursor.updated_at},and(updated_at.eq.${page.cursor.updated_at},id.lt.${page.cursor.id})`)
  }
  return out.order('updated_at', { ascending: false }).order('id', { ascending: false }).limit(page.limit + 1)
}

export function pageResult<T extends { updated_at: string; id: string }, D>(rows: T[], page: PageQuery, map: (row: T) => D, total: number | null = null): { items: D[]; next_cursor: string | null; total: number | null } {
  const slice = rows.slice(0, page.limit)
  const last = slice[slice.length - 1]
  return { items: slice.map(map), next_cursor: rows.length > page.limit && last ? encodeCursor({ updated_at: last.updated_at, id: last.id }) : null, total }
}

export function noStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
