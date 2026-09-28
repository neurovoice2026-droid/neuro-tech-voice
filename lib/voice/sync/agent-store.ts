import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Agent } from '@/types'
import { ApiError } from '@/lib/api/http'
import { withAgentDefaults } from '@/lib/api/auth'
import type { SyncOrg } from '@/lib/voice/sync/context'
import { isMissingRelationError } from '@/lib/voice/sync/db'

// Agent and organisation reads for the agent routes and the sync job, with
// explicit column lists. Until migration 010 is applied the new columns don't
// exist, so every read retries once with the legacy column set and fills the
// gaps with withAgentDefaults (the same defaults the migration uses).

/** Every Agent field. */
export const AGENT_COLUMNS = [
  'id', 'org_id', 'elevenlabs_agent_id', 'cartesia_agent_id', 'name', 'voice_id', 'voice_name',
  'cartesia_voice_id', 'cartesia_voice_name', 'language', 'system_prompt', 'first_message',
  'is_active', 'working_hours', 'fallback_message', 'tone', 'voice_speed', 'voice_emotion',
  'keyterms', 'lead_fields', 'recording_notice', 'pipeline_mode_override', 'provider_sync',
  'metadata', 'created_at', 'updated_at',
].join(', ')

const LEGACY_AGENT_COLUMNS = [
  'id', 'org_id', 'elevenlabs_agent_id', 'name', 'voice_id', 'voice_name', 'language',
  'system_prompt', 'first_message', 'is_active', 'working_hours', 'fallback_message',
  'metadata', 'created_at', 'updated_at',
].join(', ')

/** Columns migration 010 adds to agents; writes that touch them fail before it is applied. */
export const AGENT_010_COLUMNS: readonly string[] = [
  'cartesia_agent_id', 'cartesia_voice_id', 'cartesia_voice_name', 'tone', 'voice_speed',
  'voice_emotion', 'keyterms', 'lead_fields', 'recording_notice', 'pipeline_mode_override',
  'provider_sync',
]

const SYNC_ORG_COLUMNS = 'id, name, timezone, plan, sms_enabled, onboarding_completed'
const LEGACY_SYNC_ORG_COLUMNS = 'id, name, plan, onboarding_completed'

type DbError = { code?: string; message: string } | null

/** Row → Agent with defaults and numeric columns coerced (PostgREST may send numeric as a string). */
export function toAgent(row: Record<string, unknown>): Agent {
  const agent = withAgentDefaults(row)
  const speed = agent.voice_speed === null || agent.voice_speed === undefined ? null : Number(agent.voice_speed)
  return { ...agent, voice_speed: Number.isFinite(speed) ? speed : null }
}

export function toSyncOrg(row: Record<string, unknown>): SyncOrg {
  return {
    id: String(row.id),
    name: typeof row.name === 'string' ? row.name : null,
    timezone: typeof row.timezone === 'string' && row.timezone ? row.timezone : 'UTC',
    plan: (typeof row.plan === 'string' ? row.plan : 'trial') as SyncOrg['plan'],
    sms_enabled: typeof row.sms_enabled === 'boolean' ? row.sms_enabled : true,
    onboarding_completed: row.onboarding_completed === true,
  }
}

function lookupFailed(label: string, error: NonNullable<DbError>): Error {
  console.error('[agent-sync]', `${label} failed`, error.code, error.message)
  return new Error(`${label} failed`)
}

async function withLegacyFallback<T>(
  label: string,
  run: (columns: string) => PromiseLike<{ data: T; error: DbError }>,
  columns: string,
  legacyColumns: string
): Promise<T> {
  const first = await run(columns)
  if (!first.error) return first.data
  if (!isMissingRelationError(first.error)) throw lookupFailed(label, first.error)
  const legacy = await run(legacyColumns)
  if (legacy.error) throw lookupFailed(label, legacy.error)
  return legacy.data
}

/** Newest agent of the organisation, or null. */
export async function loadOrgAgent(client: SupabaseClient, orgId: string): Promise<Agent | null> {
  const row = await withLegacyFallback<Record<string, unknown> | null>(
    'agent lookup',
    (columns) =>
      client
        .from('agents')
        .select(columns)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as unknown as PromiseLike<{ data: Record<string, unknown> | null; error: DbError }>,
    AGENT_COLUMNS,
    LEGACY_AGENT_COLUMNS
  )
  return row ? toAgent(row) : null
}

export async function loadAgentById(client: SupabaseClient, agentId: string): Promise<Agent | null> {
  const row = await withLegacyFallback<Record<string, unknown> | null>(
    'agent lookup',
    (columns) =>
      client.from('agents').select(columns).eq('id', agentId).maybeSingle() as unknown as PromiseLike<{
        data: Record<string, unknown> | null
        error: DbError
      }>,
    AGENT_COLUMNS,
    LEGACY_AGENT_COLUMNS
  )
  return row ? toAgent(row) : null
}

export async function loadSyncOrg(client: SupabaseClient, orgId: string): Promise<SyncOrg | null> {
  const row = await withLegacyFallback<Record<string, unknown> | null>(
    'organization lookup',
    (columns) =>
      client.from('organizations').select(columns).eq('id', orgId).maybeSingle() as unknown as PromiseLike<{
        data: Record<string, unknown> | null
        error: DbError
      }>,
    SYNC_ORG_COLUMNS,
    LEGACY_SYNC_ORG_COLUMNS
  )
  return row ? toSyncOrg(row) : null
}

/** One page of agents for the daily resync, oldest update first so every agent gets its turn. */
export async function loadAgentPage(client: SupabaseClient, offset: number, pageSize: number): Promise<Agent[]> {
  const rows = await withLegacyFallback<Record<string, unknown>[] | null>(
    'agent page lookup',
    (columns) =>
      client
        .from('agents')
        .select(columns)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: DbError }>,
    AGENT_COLUMNS,
    LEGACY_AGENT_COLUMNS
  )
  return (rows ?? []).map(toAgent)
}

export async function loadSyncOrgs(client: SupabaseClient, orgIds: string[]): Promise<Map<string, SyncOrg>> {
  if (orgIds.length === 0) return new Map()
  const rows = await withLegacyFallback<Record<string, unknown>[] | null>(
    'organization page lookup',
    (columns) =>
      client.from('organizations').select(columns).in('id', orgIds) as unknown as PromiseLike<{
        data: Record<string, unknown>[] | null
        error: DbError
      }>,
    SYNC_ORG_COLUMNS,
    LEGACY_SYNC_ORG_COLUMNS
  )
  return new Map((rows ?? []).map((row) => [String(row.id), toSyncOrg(row)]))
}

/**
 * Writes agent columns with the given client (the user's session for their
 * own settings) and maps database failures to messages the dashboard can
 * show. Before migration 010, compatibility-only columns are dropped and the
 * write retried; a column the user explicitly changed answers 503.
 */
export async function saveAgentColumns(
  client: SupabaseClient,
  ids: { orgId: string; agentId: string },
  plan: { update: Record<string, unknown>; derived: Set<string> }
): Promise<void> {
  let update = plan.update
  for (let attempt = 0; attempt < 2; attempt++) {
    if (Object.keys(update).length === 0) return
    const { data, error } = await client
      .from('agents')
      .update(update)
      .eq('id', ids.agentId)
      .eq('org_id', ids.orgId)
      .select('id')
    if (!error) {
      if (!Array.isArray(data) || data.length === 0) {
        throw new ApiError(404, 'agent_not_found', 'Your AI agent hasn’t been set up yet. Please finish onboarding first.')
      }
      return
    }
    if (isMissingRelationError(error)) {
      const newColumns = Object.keys(update).filter((key) => AGENT_010_COLUMNS.includes(key))
      const requested = newColumns.filter((key) => !plan.derived.has(key))
      if (attempt === 0 && newColumns.length > 0 && requested.length === 0) {
        update = Object.fromEntries(Object.entries(update).filter(([key]) => !plan.derived.has(key)))
        continue
      }
      if (requested.length > 0) {
        console.warn('[agent]', 'agent settings need migration 010', requested.join(', '))
        throw new ApiError(503, 'migration_pending', 'This setting needs a database update that hasn’t been applied yet. Please contact support.')
      }
    }
    if (error.code === '23514' || error.code === '22P02' || error.code === '22003') {
      throw new ApiError(400, 'validation_error', 'Some of these settings aren’t valid. Please check them and try again.')
    }
    console.error('[agent]', 'saving agent settings failed', error.code, error.message)
    throw new ApiError(500, 'save_failed', 'We couldn’t save your changes. Please try again.')
  }
}
