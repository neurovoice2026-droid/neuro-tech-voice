import 'server-only'
import crypto from 'crypto'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { RequestError } from '@/lib/api/http'

export interface OrgContext {
  supabase: SupabaseClient
  user: User
  org: { id: string; name: string | null; timezone: string | null; plan: string | null }
}

/**
 * Resolves the signed-in user and their organization with the user-scoped
 * client, so every subsequent query is still bounded by RLS. Throws a
 * RequestError (401/404) that route handlers turn into a JSON response.
 */
export async function requireOrg(): Promise<OrgContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new RequestError('unauthorized', 'Unauthorized', 401)
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name, timezone, plan')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw new RequestError('internal', 'Could not load your organization.', 500)
  if (!org) throw new RequestError('not_found', 'Organization not found', 404)
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
