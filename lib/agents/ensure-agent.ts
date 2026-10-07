import 'server-only'
// Agent service helpers shared by the agent API routes, the agent page and
// onboarding:
//
//   • ensureAgent        find-or-create the org's single agent. Lazy creation
//                        happens in several places (GET /api/agent, the agent
//                        page, onboarding); the unique index agents(org_id)
//                        plus the 23505 re-select make it duplicate-free.
//   • syncAgentProviders bump the config revision and push a saved change to
//                        the primary provider now, the fallback provider after
//                        the response. A provider failure is reported, never
//                        thrown: the change itself is already saved.
//   • rebindStaleNumbers re-apply number routing once an external agent exists
//                        or was re-created (replaces lib/phone/link.ts).
//   • buildAgentStatusView the client-safe provider / voice / number status.
//
// SECURITY: every function takes an org id the caller has ALREADY authorized
// with requireOrg(). Admin-client queries are always scoped by that org id.

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AGENT_LANGUAGES, type AgentLanguageCode } from '@/lib/agent-languages'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { bumpRevision, providersFor, syncAgent, type ProviderSyncResult } from '@/lib/voice-providers/agent-sync'
import { lifecycleFor } from '@/lib/voice-providers/adapters'
import { safeMessageFor, type VoiceProvider } from '@/lib/voice-providers/errors'
import { applyNumberRouting } from '@/lib/telephony/binding'
import { redactText } from '@/lib/security/redact'
import { PLATFORM_VARIABLE_MESSAGE, hasNoPlatformVariables, stripPlatformVariables } from '@/lib/voice-providers/template-variables'
import { tenantName } from '@/lib/voice-providers/settings'
import type {
  Agent,
  AgentStatusView,
  ProviderResourceStatus,
  ProviderResourceView,
  VoiceSyncStatus,
} from '@/types'

// ─── Input schemas shared by the agent and onboarding routes ─────────────────

export const AGENT_NAME_MAX = 100
export const COMPANY_NAME_MAX = 100
export const FIRST_MESSAGE_MAX = 1_000
export const SYSTEM_PROMPT_MAX = 20_000
export const FALLBACK_MESSAGE_MAX = 500

const LANGUAGE_CODES = AGENT_LANGUAGES.map((l) => l.value) as unknown as readonly [AgentLanguageCode, ...AgentLanguageCode[]]

export const AgentLanguageSchema = z.enum(LANGUAGE_CODES)

/**
 * Agent and company names reach the agent (greetings, prompt, the
 * {{business_name}} variable): like other tenant text they may not reference
 * platform variables ({{ntv_*}}, {{secret__*}}, most {{system__*}}).
 */
export const AgentNameSchema = tenantName(AGENT_NAME_MAX)
export const CompanyNameSchema = tenantName(COMPANY_NAME_MAX)

/** Personality / tone slug kept in agents.metadata.personality (UI-only, not sent to providers). */
export const PersonalitySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z_-]{0,39}$/, 'Unknown personality')

/** "" (or whitespace) → undefined, so optional form fields can be sent empty. */
export function emptyAsUndefined<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional())
}

function withProtocol(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function isWebsite(value: string): boolean {
  // An explicit non-http scheme ("ftp://…") must not be turned into "https://ftp://…".
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) return false
  const url = withProtocol(value)
  if (!URL.canParse(url)) return false
  const { protocol } = new URL(url)
  return protocol === 'http:' || protocol === 'https:'
}

/** Company website: "", "site.com", "www.site.com" or a full http(s) URL → normalized URL or null. */
export const WebsiteSchema = z
  .string()
  .trim()
  .max(300)
  .nullable()
  .refine((v) => v === null || v === '' || isWebsite(v), 'Enter a valid URL (e.g. www.yoursite.com)')
  .transform((v) => (v ? withProtocol(v) : null))

export const OnboardingCompanySchema = z.object({
  name: CompanyNameSchema,
  industry: z.string().trim().min(1).max(60),
  website: WebsiteSchema.optional(),
  description: z.string().trim().max(1_000).optional(),
})

export const OnboardingAgentSchema = z.object({
  name: AgentNameSchema,
  language: AgentLanguageSchema,
  system_prompt: z.string().max(SYSTEM_PROMPT_MAX).refine(hasNoPlatformVariables, PLATFORM_VARIABLE_MESSAGE).nullable().optional(),
  first_message: z.string().trim().max(FIRST_MESSAGE_MAX).refine(hasNoPlatformVariables, PLATFORM_VARIABLE_MESSAGE).nullable().optional(),
  personality: PersonalitySchema.optional(),
})

/** Blank text → null (the provider spec then uses its localized default). */
export function blankToNull(value: string | null): string | null {
  return value === null || value.trim() === '' ? null : value
}

/** Merges `patch` into the agent's existing metadata object (never replaces it). */
export function mergeMetadata(current: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const base = current && typeof current === 'object' && !Array.isArray(current) ? (current as Record<string, unknown>) : {}
  return { ...base, ...patch }
}

// ─── Find-or-create ──────────────────────────────────────────────────────────

const UNIQUE_VIOLATION = '23505'

/** "<Company> Agent", or "My Agent" when the company has no name yet (platform variables stripped). */
export function defaultAgentName(orgName: string | null | undefined): string {
  const base = typeof orgName === 'string' ? stripPlatformVariables(orgName).trim() : ''
  return (base ? `${base} Agent` : 'My Agent').slice(0, AGENT_NAME_MAX)
}

async function selectOldestAgent(db: SupabaseClient, orgId: string): Promise<Agent | null> {
  const { data, error } = await db
    .from('agents')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`agents read failed: ${error.message}`)
  return (data as Agent | null) ?? null
}

/**
 * Returns the org's agent (the oldest one if legacy duplicates exist),
 * creating it when there is none. Safe under concurrency: a parallel insert
 * that loses the unique-index race re-selects the winner's row.
 */
export async function ensureAgent(orgId: string, defaultName: string): Promise<Agent> {
  const db = createAdminClient()
  const existing = await selectOldestAgent(db, orgId)
  if (existing) return existing

  const name = stripPlatformVariables(defaultName).trim().slice(0, AGENT_NAME_MAX) || 'My Agent'
  const { data, error } = await db
    .from('agents')
    // No voice yet, so the voice is not "synced" (see migration 010).
    .insert({ org_id: orgId, name, voice_sync_status: 'pending' })
    .select('*')
    .single()
  if (!error && data) return data as Agent

  if (error?.code === UNIQUE_VIOLATION) {
    const winner = await selectOldestAgent(db, orgId)
    if (winner) return winner
  }
  throw new Error(`agents insert failed: ${error?.message ?? 'no row returned'}`)
}

// ─── Provider sync ───────────────────────────────────────────────────────────

export type AgentSyncStatus = ProviderSyncResult['status']

/** What a route returns to the browser about one provider sync. */
export interface AgentSyncReport {
  provider: VoiceProvider
  status: AgentSyncStatus
  /** Sanitized, product-level message (never an upstream body). */
  error: string | null
}

const SYNC_FAILED_MESSAGE = 'Synchronisation with the voice provider failed. Please try again.'

function toReport(r: ProviderSyncResult): AgentSyncReport {
  const error =
    r.error ?? (r.status === 'skipped' && r.errorCode === 'not_configured' ? safeMessageFor('not_configured') : null)
  return { provider: r.provider, status: r.status, error }
}

/**
 * Runs the sync engine and turns the outcome into reports. Provider failures
 * come back as results; an unexpected error (database, lease) is logged and
 * reported as a failed sync for the requested providers.
 */
export async function runAgentSync(
  agentId: string,
  opts: { providers: VoiceProvider[]; force?: boolean; log: Logger },
): Promise<AgentSyncReport[]> {
  try {
    const results = await syncAgent(agentId, { providers: opts.providers, force: opts.force, log: opts.log })
    for (const r of results) {
      if (r.status === 'failed' || r.status === 'degraded') {
        opts.log.warn('agent.sync_unsuccessful', { agentId, provider: r.provider, status: r.status, errorCode: r.errorCode })
      }
    }
    return results.map(toReport)
  } catch (err) {
    opts.log.error('agent.sync_error', err, { agentId, providers: opts.providers })
    return opts.providers.map((provider) => ({ provider, status: 'failed' as const, error: SYNC_FAILED_MESSAGE }))
  }
}

type ExternalIds = Partial<Record<VoiceProvider, string | null>>

async function externalIds(db: SupabaseClient, orgId: string, agentId: string): Promise<ExternalIds> {
  const { data, error } = await db
    .from('agent_provider_resources')
    .select('provider, external_id')
    .eq('org_id', orgId)
    .eq('agent_id', agentId)
  if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
  const out: ExternalIds = {}
  for (const r of data ?? []) out[r.provider as VoiceProvider] = (r.external_id as string | null) ?? null
  return out
}

/**
 * The org's providers in order: [primary, fallback when enabled]. Read with the
 * caller's user-scoped client, so the agent/org lookup stays RLS-bounded.
 */
export async function activeProviders(supabase: SupabaseClient, agentId: string): Promise<VoiceProvider[]> {
  return providersFor(supabase, agentId)
}

export interface SyncAgentProvidersParams {
  /** The request's user-scoped client (RLS-bounded reads). */
  supabase: SupabaseClient
  orgId: string
  agentId: string
  /** The agent's primary provider, used to report a failure before the sync could start. */
  primaryProvider: VoiceProvider
  /** A provider-relevant field changed: bump agents.config_revision first. */
  bump: boolean
  /** Push to the primary provider now (awaited). */
  primary: boolean
  /** Push to the fallback provider after the response (when enabled). */
  fallback: boolean
  log: Logger
}

/**
 * Propagates a saved agent change. The primary result is returned; the
 * fallback provider is synced after the response (reported as 'pending'),
 * then numbers whose routing became stale are re-bound.
 */
export async function syncAgentProviders(params: SyncAgentProvidersParams): Promise<AgentSyncReport[]> {
  const { orgId, agentId, log } = params
  const db = createAdminClient()

  if (params.bump) {
    try {
      await bumpRevision(agentId)
    } catch (err) {
      // The push below still carries the new config (its hash differs); only
      // the catch-up bookkeeping is affected, so report it and continue.
      log.error('agent.revision_bump_failed', err, { agentId })
    }
  }

  let providers: VoiceProvider[]
  let before: ExternalIds
  try {
    ;[providers, before] = await Promise.all([activeProviders(params.supabase, agentId), externalIds(db, orgId, agentId)])
  } catch (err) {
    log.error('agent.sync_prepare_failed', err, { agentId })
    return params.primary ? [{ provider: params.primaryProvider, status: 'failed', error: SYNC_FAILED_MESSAGE }] : []
  }

  const [primary, ...fallbacks] = providers
  const reports: AgentSyncReport[] = params.primary && primary ? await runAgentSync(agentId, { providers: [primary], log }) : []

  const deferred = params.fallback ? fallbacks : []
  for (const provider of deferred) reports.push({ provider, status: 'pending', error: null })

  deferBackground(
    (async () => {
      if (deferred.length) await runAgentSync(agentId, { providers: deferred, log })
      await rebindStaleNumbers(orgId, agentId, before, log)
    })().catch((err: unknown) => log.error('agent.background_sync_failed', err, { agentId })),
  )
  return reports
}

/** True when the provider already holds an external agent for this local agent. */
export async function hasExternalAgent(
  supabase: SupabaseClient,
  orgId: string,
  agentId: string,
  provider: VoiceProvider,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('agent_provider_resources')
    .select('external_id')
    .eq('org_id', orgId)
    .eq('agent_id', agentId)
    .eq('provider', provider)
    .maybeSingle()
  if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
  return !!data?.external_id
}

// ─── Number routing ──────────────────────────────────────────────────────────

/**
 * Re-applies routing for the org's numbers that are not bound to the current
 * external agents: never bound, bound to another/no local agent, not 'ready',
 * or whose provider agent was created/re-created since `before`.
 */
export async function rebindStaleNumbers(
  orgId: string,
  agentId: string,
  before: ExternalIds,
  log: Logger,
): Promise<Array<{ phoneNumberId: string; status: 'ready' | 'degraded' | 'failed' }>> {
  const db = createAdminClient()
  const [after, numbersRes] = await Promise.all([
    externalIds(db, orgId, agentId),
    db
      .from('phone_numbers')
      .select('id, twilio_sid, agent_id, routing_mode, routing_status, cartesia_phone_number_id, elevenlabs_phone_number_id')
      .eq('org_id', orgId),
  ])
  if (numbersRes.error) throw new Error(`phone_numbers read failed: ${numbersRes.error.message}`)

  const recreated = (p: VoiceProvider) => !!after[p] && after[p] !== (before[p] ?? null)
  const out: Array<{ phoneNumberId: string; status: 'ready' | 'degraded' | 'failed' }> = []

  for (const n of numbersRes.data ?? []) {
    const sid = typeof n.twilio_sid === 'string' ? n.twilio_sid : ''
    if (!sid || sid.startsWith('mock')) continue
    const native = n.routing_mode === 'native_elevenlabs'
    const stale =
      n.agent_id !== agentId ||
      n.routing_status !== 'ready' ||
      (!native && (recreated('cartesia') || (!!after.cartesia && !n.cartesia_phone_number_id))) ||
      (native && (recreated('elevenlabs') || (!!after.elevenlabs && !n.elevenlabs_phone_number_id)))
    if (!stale) continue

    const phoneNumberId = n.id as string
    try {
      const result = await applyNumberRouting(phoneNumberId, log)
      out.push({ phoneNumberId, status: result.status })
    } catch (err) {
      log.error('agent.number_rebind_failed', err, { phoneNumberId })
      out.push({ phoneNumberId, status: 'failed' })
    }
  }
  if (out.length) log.info('agent.numbers_rebound', { agentId, results: out })
  return out
}

/** Snapshot of the external ids, taken before a sync to detect re-creation. */
export async function snapshotExternalIds(orgId: string, agentId: string): Promise<ExternalIds> {
  return externalIds(createAdminClient(), orgId, agentId)
}

// ─── Status view ─────────────────────────────────────────────────────────────

const MAX_ERROR_CHARS = 300

function sanitizeError(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return redactText(value.trim()).slice(0, MAX_ERROR_CHARS)
}

const RESOURCE_STATUSES: readonly ProviderResourceStatus[] = ['pending', 'ready', 'failed', 'degraded']
const VOICE_STATUSES: readonly VoiceSyncStatus[] = ['pending', 'saving', 'synced', 'failed']

function asResourceStatus(value: unknown): ProviderResourceStatus {
  return RESOURCE_STATUSES.includes(value as ProviderResourceStatus) ? (value as ProviderResourceStatus) : 'pending'
}

function asProvider(value: unknown): VoiceProvider | null {
  return value === 'elevenlabs' || value === 'cartesia' ? value : null
}

/**
 * Builds the client-safe status of the org's agent with the user-scoped
 * client (RLS-bounded reads). Errors shown are the sanitized messages the sync
 * engine and the number binding stored, redacted once more.
 */
export async function buildAgentStatusView(supabase: SupabaseClient, orgId: string, agentId: string): Promise<AgentStatusView> {
  const [agentRes, orgRes, resourcesRes, numbersRes, enabledProviders] = await Promise.all([
    supabase
      .from('agents')
      .select('primary_provider, fallback_provider, voice_sync_status, voice_sync_error')
      .eq('id', agentId)
      .eq('org_id', orgId)
      .single(),
    supabase.from('organizations').select('voice_fallback_enabled').eq('id', orgId).single(),
    supabase
      .from('agent_provider_resources')
      .select('provider, status, last_synced_at, last_error')
      .eq('org_id', orgId)
      .eq('agent_id', agentId),
    supabase
      .from('phone_numbers')
      .select('id, number, routing_mode, routing_status, routing_error')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true }),
    providersFor(supabase, agentId),
  ])
  if (agentRes.error) throw new Error(`agents read failed: ${agentRes.error.message}`)
  if (orgRes.error) throw new Error(`organizations read failed: ${orgRes.error.message}`)
  if (resourcesRes.error) throw new Error(`agent_provider_resources read failed: ${resourcesRes.error.message}`)
  if (numbersRes.error) throw new Error(`phone_numbers read failed: ${numbersRes.error.message}`)

  const agent = agentRes.data
  const primary: VoiceProvider = asProvider(agent.primary_provider) ?? 'elevenlabs'
  const fallbackCandidate = asProvider(agent.fallback_provider)
  const fallback = fallbackCandidate && fallbackCandidate !== primary ? fallbackCandidate : null

  const view = (provider: VoiceProvider, role: 'primary' | 'fallback'): ProviderResourceView => {
    const configured = lifecycleFor(provider).isConfigured()
    const enabled = enabledProviders.includes(provider)
    const row = (resourcesRes.data ?? []).find((r) => r.provider === provider)
    const status: ProviderResourceView['status'] = !configured
      ? 'not_configured'
      : !enabled
        ? 'disabled'
        : asResourceStatus(row?.status)
    return {
      provider,
      role,
      enabled,
      configured,
      status,
      last_synced_at: (row?.last_synced_at as string | null | undefined) ?? null,
      last_error: status === 'ready' ? null : sanitizeError(row?.last_error),
    }
  }

  const providers: ProviderResourceView[] = [view(primary, 'primary')]
  if (fallback) providers.push(view(fallback, 'fallback'))

  const voiceStatus = VOICE_STATUSES.includes(agent.voice_sync_status as VoiceSyncStatus)
    ? (agent.voice_sync_status as VoiceSyncStatus)
    : 'pending'

  return {
    providers,
    voice: { status: voiceStatus, error: sanitizeError(agent.voice_sync_error) },
    numbers: (numbersRes.data ?? []).map((n) => ({
      id: n.id as string,
      number: n.number as string,
      routing_mode: n.routing_mode === 'native_elevenlabs' ? 'native_elevenlabs' : 'app_routed',
      routing_status: asResourceStatus(n.routing_status),
      routing_error: sanitizeError(n.routing_error),
    })),
    fallback_enabled: orgRes.data.voice_fallback_enabled !== false,
  }
}
