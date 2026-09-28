import 'server-only'
import { ApiError } from '@/lib/api/http'

// Error mapping shared by the calls and dashboard routes.

interface PostgrestLikeError {
  code?: string
  message?: string
}

// undefined column / function / table, and PostgREST's schema-cache variants.
const OUTDATED_SCHEMA_CODES = new Set(['42703', '42883', '42P01', 'PGRST202', 'PGRST204', 'PGRST205'])

let warnedOutdated = false

/**
 * Maps a failed query to an ApiError. A database that hasn't had migration 010
 * applied yet gets a calm 503 instead of a generic failure (and one log line).
 */
export function dbError(error: PostgrestLikeError, context: string): ApiError {
  if (error.code && OUTDATED_SCHEMA_CODES.has(error.code)) {
    if (!warnedOutdated) {
      warnedOutdated = true
      console.error('[calls] database schema is out of date (apply supabase/migrations/010_voice_platform.sql)', context, error.code)
    }
    return new ApiError(
      503,
      'schema_outdated',
      'Call history is being upgraded. Please try again in a few minutes.'
    )
  }
  console.error('[calls]', context, error.code, error.message)
  return new ApiError(500, 'internal_error', 'We couldn’t load your calls right now. Please try again.')
}
