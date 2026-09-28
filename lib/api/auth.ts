import 'server-only'
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { ApiError } from '@/lib/api/http'
import { normalizeTone } from '@/lib/voice/tone'
import { AGENT_TONES, type Agent, type AgentTone, type Organization } from '@/types'

// Per-request auth + organisation lookup shared by layouts, pages and route
// handlers. React cache() dedupes it within one server render, so a layout and
// its page do a single getUser() round trip and a single organizations query.

export interface OrgContext {
  user: { id: string; email: string | null }
  org: Organization
  supabase: SupabaseClient
}

/** Every Organization field, so callers never need select('*'). */
export const ORGANIZATION_COLUMNS = [
  'id', 'user_id', 'name', 'industry', 'website', 'description', 'logo_url',
  'onboarding_completed', 'onboarding_step', 'plan', 'stripe_customer_id',
  'stripe_subscription_id', 'minutes_used', 'minutes_limit', 'timezone',
  'trial_ends_at', 'billing_interval', 'usage_period_start', 'usage_period_end',
  'sms_enabled', 'created_at', 'updated_at',
].join(', ')

// Columns that exist before migration 010. Used only when the new columns are
// missing, so the dashboard keeps working until the owner applies 010.
const LEGACY_ORGANIZATION_COLUMNS = [
  'id', 'user_id', 'name', 'industry', 'website', 'description', 'logo_url',
  'onboarding_completed', 'onboarding_step', 'plan', 'stripe_customer_id',
  'stripe_subscription_id', 'minutes_used', 'minutes_limit', 'created_at', 'updated_at',
].join(', ')

const TRIAL_DAYS = 14

type SessionState =
  | { kind: 'anonymous'; supabase: SupabaseClient }
  | { kind: 'no_org'; supabase: SupabaseClient; user: OrgContext['user'] }
  | { kind: 'ok'; context: OrgContext }

let warnedLegacySchema = false

/** Postgres undefined_column, as relayed by PostgREST. */
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === '42703'
}

/** Fills the fields migration 010 adds with the same defaults the migration uses. */
export function withOrganizationDefaults(row: Record<string, unknown>): Organization {
  const org = row as Partial<Organization> & Record<string, unknown>
  const createdAt = typeof org.created_at === 'string' ? org.created_at : null
  const trialEnd =
    org.plan === 'trial' && createdAt
      ? new Date(Date.parse(createdAt) + TRIAL_DAYS * 86_400_000).toISOString()
      : null
  return {
    ...(org as Organization),
    timezone: org.timezone ?? 'UTC',
    trial_ends_at: org.trial_ends_at !== undefined ? org.trial_ends_at : trialEnd,
    billing_interval: org.billing_interval ?? null,
    usage_period_start: org.usage_period_start ?? null,
    usage_period_end: org.usage_period_end ?? null,
    sms_enabled: org.sms_enabled ?? true,
  }
}

async function loadOrganization(supabase: SupabaseClient, userId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select(ORGANIZATION_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()
  if (!error) return data ? withOrganizationDefaults(data as unknown as Record<string, unknown>) : null

  if (!isMissingColumn(error)) {
    console.error('[auth] organization lookup failed', error.code, error.message)
    throw new Error('Organization lookup failed')
  }
  if (!warnedLegacySchema) {
    warnedLegacySchema = true
    console.warn('[auth] organizations is missing columns from migration 010; using defaults until it is applied')
  }
  const legacy = await supabase
    .from('organizations')
    .select(LEGACY_ORGANIZATION_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()
  if (legacy.error) {
    console.error('[auth] organization lookup failed', legacy.error.code, legacy.error.message)
    throw new Error('Organization lookup failed')
  }
  return legacy.data ? withOrganizationDefaults(legacy.data as unknown as Record<string, unknown>) : null
}

const loadSessionState = cache(async (): Promise<SessionState> => {
  const supabase: SupabaseClient = await createClient()
  // getUser() verifies the JWT with the Auth server; an error here simply
  // means there is no valid session.
  const { data } = await supabase.auth.getUser()
  const authUser = data?.user
  if (!authUser) return { kind: 'anonymous', supabase }

  const user = { id: authUser.id, email: authUser.email ?? null }
  const org = await loadOrganization(supabase, user.id)
  if (!org) return { kind: 'no_org', supabase, user }
  return { kind: 'ok', context: { user, org, supabase } }
})

/** The signed-in user even without an organization yet (onboarding). */
export const getSessionUser = cache(
  async (): Promise<{ user: OrgContext['user']; supabase: SupabaseClient } | null> => {
    const state = await loadSessionState()
    if (state.kind === 'anonymous') return null
    if (state.kind === 'no_org') return { user: state.user, supabase: state.supabase }
    return { user: state.context.user, supabase: state.context.supabase }
  }
)

export const getOrgContext: () => Promise<OrgContext | null> = cache(async () => {
  const state = await loadSessionState()
  return state.kind === 'ok' ? state.context : null
})

export async function requireOrgContext(): Promise<OrgContext> {
  const state = await loadSessionState()
  if (state.kind === 'anonymous') {
    throw new ApiError(401, 'unauthorized', 'Please sign in to continue.')
  }
  if (state.kind === 'no_org') {
    throw new ApiError(404, 'org_not_found', 'We couldn’t find your organization. Please finish onboarding first.')
  }
  return state.context
}

function isAgentTone(value: unknown): value is AgentTone {
  return typeof value === 'string' && (AGENT_TONES as readonly string[]).includes(value)
}

/**
 * Fills the agent fields migration 010 adds, so rows read before it is applied
 * still satisfy the Agent type. Values present on the row always win.
 */
export function withAgentDefaults(row: Record<string, unknown>): Agent {
  const agent = row as Partial<Agent> & Record<string, unknown>
  const metadata = (agent.metadata && typeof agent.metadata === 'object' ? agent.metadata : {}) as Record<string, unknown>
  return {
    ...(agent as Agent),
    elevenlabs_agent_id: agent.elevenlabs_agent_id ?? null,
    cartesia_agent_id: agent.cartesia_agent_id ?? null,
    cartesia_voice_id: agent.cartesia_voice_id ?? null,
    cartesia_voice_name: agent.cartesia_voice_name ?? null,
    // Same mapping as migration 010's backfill: 'Friendly' → friendly, legacy 'educational' → professional.
    tone: isAgentTone(agent.tone) ? agent.tone : normalizeTone(metadata.personality),
    voice_speed: agent.voice_speed ?? null,
    voice_emotion: agent.voice_emotion ?? null,
    keyterms: Array.isArray(agent.keyterms) ? agent.keyterms : [],
    lead_fields: Array.isArray(agent.lead_fields) ? agent.lead_fields : [],
    recording_notice: agent.recording_notice ?? false,
    pipeline_mode_override: agent.pipeline_mode_override ?? null,
    provider_sync: agent.provider_sync ?? {},
    metadata,
  }
}

/** Newest agent of the organization (every org has one agent today). */
export async function getOrgAgent(ctx: OrgContext): Promise<Agent | null> {
  // select('*') on purpose: agents is small and the column set differs before
  // and after migration 010; withAgentDefaults covers the gap.
  const { data, error } = await ctx.supabase
    .from('agents')
    .select('*')
    .eq('org_id', ctx.org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[auth] agent lookup failed', error.code, error.message)
    throw new Error('Agent lookup failed')
  }
  return data ? withAgentDefaults(data as Record<string, unknown>) : null
}

export async function requireOrgAgent(ctx: OrgContext): Promise<Agent> {
  const agent = await getOrgAgent(ctx)
  if (!agent) {
    throw new ApiError(404, 'agent_not_found', 'Your AI agent hasn’t been set up yet. Please finish onboarding first.')
  }
  return agent
}
