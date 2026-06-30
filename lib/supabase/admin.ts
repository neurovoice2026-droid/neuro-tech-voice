import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

/**
 * Service-role Supabase client for server-to-server contexts (webhooks, cron
 * jobs, background tasks) where there is NO authenticated user and Row Level
 * Security must be bypassed.
 *
 * SECURITY: this uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely.
 * - NEVER import this into a Client Component or any code shipped to the browser.
 * - ALWAYS scope queries explicitly by org_id — RLS will not do it for you here.
 */
export function createAdminClient(): SupabaseClient {
  if (_admin) return _admin

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set'
    )
  }

  _admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return _admin
}
