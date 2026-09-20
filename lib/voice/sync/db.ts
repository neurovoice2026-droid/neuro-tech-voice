// Database error helpers shared by the agent routes and the sync job.

/**
 * Postgres undefined_table / undefined_column as relayed by PostgREST (and the
 * schema-cache variants): the migration that adds them isn't applied yet.
 */
export function isMissingRelationError(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === '42703' || error?.code === 'PGRST205' || error?.code === 'PGRST204'
}
