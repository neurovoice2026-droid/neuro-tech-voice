import 'server-only'
import crypto from 'crypto'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { RequestError } from '@/lib/api/http'
import type { BusinessType } from '@/types'

export interface OrgContext {
  supabase: SupabaseClient
  user: User
  org: {
    id: string
    name: string | null
    timezone: string | null
    plan: string | null
    deletion_requested_at?: string | null
    /** 'ecommerce' for an online store (it buys store plans), 'services' otherwise; null until chosen. */
    business_type?: BusinessType | null
  }
}

/**
 * The organization columns every tenant route needs, newest migration first:
 * a database still behind on a migration (024: business_type, 021:
 * deletion_requested_at) answers "undefined column" and gets the next list.
 */
const ORG_SELECTS = [
  'id, name, timezone, plan, deletion_requested_at, business_type',
  'id, name, timezone, plan, deletion_requested_at',
  'id, name, timezone, plan',
] as const

function isUndefinedColumn(error: { code?: string } | null): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204')
}

/** 403 for every tenant API call of an organization whose deletion was requested (lib/account). */
export const ACCOUNT_DELETING_MESSAGE = 'This account is being deleted.'

/**
 * Resolves the signed-in user and their organization with the user-scoped
 * client, so every subsequent query is still bounded by RLS. Throws a
 * RequestError (401/404) that route handlers turn into a JSON response, and
 * 403 once the account's deletion was requested (nothing may re-create
 * provider resources while it runs) unless `allowDeleting` is set.
 */
export async function requireOrg(opts: { allowDeleting?: boolean } = {}): Promise<OrgContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new RequestError('unauthorized', 'Unauthorized', 401)
  let org: unknown = null
  let error: { code?: string; message: string } | null = null
  for (const columns of ORG_SELECTS) {
    ;({ data: org, error } = await supabase.from('organizations').select(columns).eq('user_id', user.id).maybeSingle())
    // A missing column means the column's migration is not applied: nothing can
    // be in deletion, no business type was chosen. Any other error is final.
    if (!isUndefinedColumn(error)) break
  }
  if (error) throw new RequestError('internal', 'Could not load your organization.', 500)
  if (!org) throw new RequestError('not_found', 'Organization not found', 404)
  if ((org as OrgContext['org']).deletion_requested_at && !opts.allowDeleting) {
    throw new RequestError('forbidden', ACCOUNT_DELETING_MESSAGE, 403, { reason: 'account_deleting' })
  }
  return { supabase, user, org: org as OrgContext['org'] }
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

export interface AdminContext {
  kind: 'token' | 'user'
  userId: string | null
}

/**
 * Platform-admin gate for diagnostics, reconciliation and circuit overrides.
 * Accepts either `Authorization: Bearer $ADMIN_API_TOKEN` (cron/scripts) or a
 * signed-in user whose id is listed in PLATFORM_ADMIN_USER_IDS. Customers are
 * never admins by default; with neither variable set, every call is refused.
 */
export async function requireAdmin(request: Request): Promise<AdminContext> {
  const token = process.env.ADMIN_API_TOKEN
  const header = request.headers.get('authorization') ?? ''
  if (token && token.length >= 32 && header.startsWith('Bearer ')) {
    if (constantTimeEqual(header.slice(7).trim(), token)) return { kind: 'token', userId: null }
    throw new RequestError('forbidden', 'Forbidden', 403)
  }
  const allowList = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (allowList.length) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user && allowList.includes(user.id)) return { kind: 'user', userId: user.id }
  }
  throw new RequestError('forbidden', 'Forbidden', 403)
}
