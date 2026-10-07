import 'server-only'
// Calls search over OUR database: titles, summaries and what was said
// (transcripts), with the GIN full-text index of migration 017
// (public.call_search_vector, public.search_org_calls). Tenant-scoped by the
// org id resolved from the signed-in user. The workspace-wide ElevenLabs
// message search is never used (it would span every tenant).

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RateLimitRule } from '@/lib/security/rate-limit'

/** Full-text searches per org (each one scans the org's calls). */
export const CALL_SEARCH_LIMIT: RateLimitRule = { name: 'calls_text_search', limit: 60, windowSeconds: 60 }

/** Most recent matches considered by one search (they feed an id filter of the list query). */
export const SEARCH_MAX_IDS = 200

const MAX_TERMS = 8
const MIN_TERM = 2
const MAX_TERM = 40

/**
 * A safe tsquery from free text: letters and digits only (any script), each
 * word as a prefix match, all words required. null when nothing searchable
 * remains, or for phone-number-like input (searched on the number columns).
 */
export function buildTsQuery(raw: string | undefined | null): string | null {
  const input = (raw ?? '').trim()
  if (!input || /^[+\d\s().-]+$/.test(input)) return null
  const terms = [...input.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)]
    .map((m) => m[0].slice(0, MAX_TERM))
    .filter((t) => t.length >= MIN_TERM)
  const unique = [...new Set(terms)].slice(0, MAX_TERMS)
  if (unique.length === 0) return null
  return unique.map((t) => `${t}:*`).join(' & ')
}

/** Ids of the org's calls whose title, summary or transcript match (newest first). */
export async function searchCallIds(orgId: string, raw: string, db: SupabaseClient = createAdminClient()): Promise<string[] | null> {
  const tsquery = buildTsQuery(raw)
  if (!tsquery) return null
  const { data, error } = await db.rpc('search_org_calls', { p_org_id: orgId, p_tsquery: tsquery, p_limit: SEARCH_MAX_IDS })
  if (error) throw new Error(`call search failed: ${error.message}`)
  return ((data ?? []) as Array<{ call_id: string }>).map((r) => r.call_id).filter((id) => typeof id === 'string')
}
