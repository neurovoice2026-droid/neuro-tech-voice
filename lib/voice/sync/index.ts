import 'server-only'
import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Agent, ProviderSyncEntry, ProviderSyncState } from '@/types'
import { ApiError } from '@/lib/api/http'
import { isCartesiaConfigured, isElevenLabsConfigured, isSupabaseAdminConfigured } from '@/lib/env'
import { kvDel, kvGet, kvIncr, kvSet } from '@/lib/kv'
import { createAdminClient } from '@/lib/supabase/admin'
import { defaultCartesiaVoice } from '@/lib/voice/voice-map'
import {
  cartesiaSyncHash,
  deleteCartesiaAgent,
  isEntryCurrent,
  syncCartesiaAgent,
} from '@/lib/voice/sync/cartesia-agent'
import { deleteElevenLabsAgent, elevenLabsSyncHash, syncElevenLabsStandby } from '@/lib/voice/sync/elevenlabs-standby'
import { loadSyncContexts, type AgentSyncContext, type SyncOrg } from '@/lib/voice/sync/context'
import { isMissingRelationError } from '@/lib/voice/sync/db'
import { loadAgentById, loadAgentPage, loadSyncOrg, loadSyncOrgs } from '@/lib/voice/sync/agent-store'
import { getVoiceFacts, type VoiceFacts } from '@/lib/voice/sync/voices'
import { attachAgentKnowledge } from '@/lib/knowledge/providers'

// Provider sync for an agent row: the Cartesia Managed Agent (used once model
// credits run out) and the ElevenLabs standby (fallback). Both run in
// parallel and independently; one failing never blocks the other or the
// user's save. The database row stays the source of truth: every outcome is
// written to agents.provider_sync with a readable error.

// A sync runs inside after() of a 60 s route: a lock that outlives a killed
// function by more than a few seconds would silently swallow the next saves.
const LOCK_TTL_SECONDS = 75
const DIRTY_TTL_SECONDS = 300
// Saves that land while a pass runs trigger another pass; bounded so a save
// loop can't keep one invocation busy (the daily resync catches the rest).
const MAX_PASSES = 4

const SYNC_FAILED_MESSAGE = 'We couldn’t update your voice agent just now. We’ll try again automatically.'
const RESYNC_BATCH = 25
// Each page's ids travel in `in.(…)` query strings; 100 UUIDs keep the URL
// well under the API gateway's 8 KB request-line limit.
const RESYNC_PAGE_SIZE = 100
const RESYNC_MAX_SCANNED = 2000
const DEFAULT_RESYNC_BUDGET_MS = 30_000

export type ProviderName = 'cartesia' | 'elevenlabs'

function lockKey(agentId: string): string {
  return `lock:agent-sync:${agentId}`
}

function dirtyKey(agentId: string): string {
  return `agent-sync:dirty:${agentId}`
}

function adminClient(): SupabaseClient {
  if (!isSupabaseAdminConfigured()) {
    throw new ApiError(503, 'not_configured', 'The database service key isn’t configured, so the voice agent can’t be updated.')
  }
  return createAdminClient()
}

export function providerConfigured(provider: ProviderName): boolean {
  return provider === 'cartesia' ? isCartesiaConfigured() : isElevenLabsConfigured()
}

/**
 * provider_sync with every configured provider marked pending, keeping the
 * last successful hash so an unchanged config still short-circuits.
 * Unconfigured providers read `disabled`.
 */
export function pendingSyncState(current: ProviderSyncState | null | undefined): ProviderSyncState {
  const next: ProviderSyncState = {}
  for (const provider of ['cartesia', 'elevenlabs'] as const) {
    const previous = current?.[provider]
    const base: ProviderSyncEntry = {
      status: 'pending',
      synced_at: previous?.synced_at ?? null,
      error: previous?.error ?? null,
      hash: previous?.hash ?? null,
      version_id: previous?.version_id ?? null,
    }
    next[provider] = providerConfigured(provider) ? base : { ...base, status: 'disabled', error: null }
  }
  return next
}

/** Marks the agent's providers pending right after a save, so the dashboard can show progress. */
export async function markAgentSyncPending(agent: Pick<Agent, 'id' | 'org_id' | 'provider_sync'>): Promise<ProviderSyncState> {
  const state = pendingSyncState(agent.provider_sync)
  const admin = adminClient()
  const { error } = await admin.from('agents').update({ provider_sync: state }).eq('id', agent.id).eq('org_id', agent.org_id)
  if (error) {
    // Before migration 010 there is no provider_sync column; the sync still runs.
    if (isMissingRelationError(error)) return state
    console.error('[agent-sync]', 'could not mark sync pending', error.code, error.message)
    throw new Error('Marking provider sync pending failed')
  }
  return state
}

/**
 * For route handlers after a save: marks the providers pending and runs the
 * sync once the response is sent (next/server after()). Returns the
 * provider_sync to send back. Must be called inside a request scope.
 */
export async function syncAgentAfterResponse(agent: Pick<Agent, 'id' | 'org_id' | 'provider_sync'>): Promise<ProviderSyncState> {
  if (!isSupabaseAdminConfigured()) {
    console.warn('[agent-sync]', 'SUPABASE_SERVICE_ROLE_KEY is missing; provider agents are not updated', agent.id)
    return agent.provider_sync ?? {}
  }
  let state: ProviderSyncState = agent.provider_sync ?? {}
  try {
    state = await markAgentSyncPending(agent)
  } catch (error) {
    // The sync below still runs and records its own outcome.
    console.error('[agent-sync]', 'pending state not recorded', agent.id, error instanceof Error ? error.message : error)
  }
  after(async () => {
    try {
      await syncAgentProviders(agent.id)
    } catch (error) {
      console.error('[agent-sync]', 'sync after save failed', agent.id, error instanceof Error ? error.message : error)
    }
  })
  return state
}

/**
 * For org-level changes that alter what the provider agents may do (plan,
 * Google Calendar connection, knowledge becoming ready or empty): marks every
 * agent of the org pending and syncs them after the response. Never throws, so
 * the change that triggered it is never failed by it. Request scope only.
 */
export async function resyncOrgAgentsAfterResponse(orgId: string, reason: string): Promise<void> {
  if (!isSupabaseAdminConfigured() || (!isCartesiaConfigured() && !isElevenLabsConfigured())) return
  try {
    const admin = createAdminClient()
    let result = await admin.from('agents').select('id, org_id, provider_sync').eq('org_id', orgId).limit(20)
    // Before migration 010 there is no provider_sync column.
    if (result.error && isMissingRelationError(result.error)) {
      result = (await admin.from('agents').select('id, org_id').eq('org_id', orgId).limit(20)) as typeof result
    }
    if (result.error) {
      console.error('[agent-sync]', `agent lookup for a resync after ${reason} failed`, result.error.code, result.error.message)
      return
    }
    for (const agent of (result.data ?? []) as Pick<Agent, 'id' | 'org_id' | 'provider_sync'>[]) {
      await syncAgentAfterResponse(agent)
    }
  } catch (error) {
    console.error('[agent-sync]', `resync after ${reason} failed`, orgId, error instanceof Error ? error.message : error)
  }
}

async function voiceFactsFor(agent: Agent): Promise<VoiceFacts | null | undefined> {
  if (!isCartesiaConfigured()) return undefined
  const voiceId = agent.cartesia_voice_id || defaultCartesiaVoice(agent.language).voice_id
  try {
    return await getVoiceFacts(voiceId)
  } catch (error) {
    console.warn('[cartesia]', 'voice lookup failed during sync', voiceId, error instanceof Error ? error.message : error)
    return undefined
  }
}

async function writeSyncResult(
  admin: SupabaseClient,
  agent: Agent,
  state: ProviderSyncState,
  ids: { cartesia_agent_id: string | null; elevenlabs_agent_id: string | null }
): Promise<void> {
  const update: Record<string, unknown> = { provider_sync: state }
  if (ids.cartesia_agent_id !== agent.cartesia_agent_id) update.cartesia_agent_id = ids.cartesia_agent_id
  if (ids.elevenlabs_agent_id !== agent.elevenlabs_agent_id) update.elevenlabs_agent_id = ids.elevenlabs_agent_id

  const { error } = await admin.from('agents').update(update).eq('id', agent.id).eq('org_id', agent.org_id)
  if (!error) return
  if (isMissingRelationError(error)) {
    // Pre-010 schema: only the ElevenLabs id has a column.
    const legacy = await admin
      .from('agents')
      .update({ elevenlabs_agent_id: ids.elevenlabs_agent_id })
      .eq('id', agent.id)
      .eq('org_id', agent.org_id)
    if (!legacy.error) return
    console.error('[agent-sync]', 'saving the legacy sync result failed', legacy.error.code, legacy.error.message)
  } else {
    console.error('[agent-sync]', 'saving the sync result failed', error.code, error.message)
  }
  // The provider agents exist but the row doesn't point at them: log the ids
  // so they can be linked or removed (Cartesia agents are also found again by
  // their description on the next sync).
  console.error('[agent-sync]', 'unrecorded provider agents', { agent: agent.id, ...ids })
  throw new Error('Saving the provider sync result failed')
}

/**
 * provider_sync after a sync that couldn't finish (database or lookup
 * failure): entries still marked pending become errors, so the dashboard
 * stops waiting and the daily resync picks the agent up.
 */
export function failedSyncState(current: ProviderSyncState | null | undefined): ProviderSyncState {
  const next: ProviderSyncState = { ...(current ?? {}) }
  for (const provider of ['cartesia', 'elevenlabs'] as const) {
    const entry = next[provider]
    if (entry?.status === 'pending') next[provider] = { ...entry, status: 'error', error: SYNC_FAILED_MESSAGE }
  }
  return next
}

async function recordSyncFailure(admin: SupabaseClient, agent: Agent): Promise<void> {
  const state = failedSyncState(agent.provider_sync)
  // Nothing was pending (a manual sync of a settled agent): leave the row alone.
  if (JSON.stringify(state) === JSON.stringify(agent.provider_sync ?? {})) return
  try {
    const { error } = await admin.from('agents').update({ provider_sync: state }).eq('id', agent.id).eq('org_id', agent.org_id)
    if (error && !isMissingRelationError(error)) {
      console.error('[agent-sync]', 'recording the sync failure failed', error.code, error.message)
    }
  } catch (error) {
    console.error('[agent-sync]', 'recording the sync failure failed', error instanceof Error ? error.message : error)
  }
}

async function runSync(admin: SupabaseClient, agentId: string, force: boolean): Promise<ProviderSyncState> {
  const agent = await loadAgentById(admin, agentId)
  if (!agent) throw new ApiError(404, 'agent_not_found', 'This agent no longer exists.')

  try {
    const org = await loadSyncOrg(admin, agent.org_id)
    if (!org) throw new ApiError(404, 'org_not_found', 'This agent’s organization no longer exists.')

    const contexts = await loadSyncContexts(admin, [{ agent, org }])
    const ctx = contexts.get(agent.id)
    if (!ctx) throw new Error('Agent sync context missing')

    const voice = await voiceFactsFor(agent)
    const now = new Date()
    const [cartesiaResult, elevenLabsResult] = await Promise.all([
      // `voice` is always passed (undefined = lookup failed), so it isn't looked up twice.
      syncCartesiaAgent({ agent, org, ctx, voice, force, now }),
      syncElevenLabsStandby({
        agent,
        org,
        ctx,
        voiceGender: voice?.gender ?? null,
        // Without Cartesia the gender is never knowable, so the default voice is final.
        voiceGenderResolved: voice !== undefined || !isCartesiaConfigured(),
        force,
        now,
      }),
    ])

    const state: ProviderSyncState = { cartesia: cartesiaResult.entry, elevenlabs: elevenLabsResult.entry }
    await writeSyncResult(admin, agent, state, {
      cartesia_agent_id: cartesiaResult.cartesiaAgentId,
      elevenlabs_agent_id: elevenLabsResult.elevenLabsAgentId,
    })
    // A provider agent that was just created (first sync or recreated after a
    // 404) has no knowledge documents yet. attachAgentKnowledge never throws.
    const created =
      (!!cartesiaResult.cartesiaAgentId && cartesiaResult.cartesiaAgentId !== agent.cartesia_agent_id) ||
      (!!elevenLabsResult.elevenLabsAgentId && elevenLabsResult.elevenLabsAgentId !== agent.elevenlabs_agent_id)
    if (created) await attachAgentKnowledge(agent.org_id, agent.id)
    return state
  } catch (error) {
    await recordSyncFailure(admin, agent)
    throw error
  }
}

/**
 * Pushes the agent's current configuration to Cartesia and ElevenLabs.
 * Concurrent calls for the same agent collapse: a call that finds a sync in
 * progress flags it dirty and returns the stored state; the running sync then
 * does another pass with the fresh row (up to MAX_PASSES), so the last save
 * wins. Only the first pass honours `force`; later passes skip unchanged configs.
 */
export async function syncAgentProviders(agentId: string, opts?: { force?: boolean }): Promise<ProviderSyncState> {
  const admin = adminClient()
  const holders = await kvIncr(lockKey(agentId), LOCK_TTL_SECONDS)
  if (holders > 1) {
    await kvSet(dirtyKey(agentId), true, DIRTY_TTL_SECONDS)
    const agent = await loadAgentById(admin, agentId)
    return agent?.provider_sync ?? {}
  }

  try {
    let state: ProviderSyncState = {}
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      await kvDel(dirtyKey(agentId))
      state = await runSync(admin, agentId, pass === 0 && opts?.force === true)
      if (!(await kvGet<boolean>(dirtyKey(agentId)))) break
      if (pass === MAX_PASSES - 1) {
        console.warn('[agent-sync]', 'saves kept arriving during the sync; the daily resync will finish it', agentId)
      }
    }
    return state
  } finally {
    await kvDel(lockKey(agentId))
  }
}

/** True when a configured provider has no agent yet, last failed, is still pending or would get a different config. */
export function isAgentStale(agent: Agent, org: SyncOrg, ctx: AgentSyncContext): boolean {
  const sync = agent.provider_sync ?? {}
  if (isCartesiaConfigured()) {
    // A pending entry with an unchanged hash means the sync after a save never
    // finished (function cut off): the dashboard would show "updating" forever.
    if (!agent.cartesia_agent_id || sync.cartesia?.status === 'pending') return true
    if (!isEntryCurrent(sync.cartesia, cartesiaSyncHash(agent, org, ctx))) return true
  }
  if (isElevenLabsConfigured()) {
    if (!agent.elevenlabs_agent_id || sync.elevenlabs?.status === 'pending') return true
    if (!isEntryCurrent(sync.elevenlabs, elevenLabsSyncHash(agent, org, ctx))) return true
  }
  return false
}

function hasFailedEntry(state: ProviderSyncState): boolean {
  return state.cartesia?.status === 'error' || state.elevenlabs?.status === 'error'
}

/**
 * Daily reconciliation (cron): finds agents of onboarded organisations whose
 * provider agents are missing, failed, stuck pending or out of date, and syncs
 * up to 25 of them. No new sync starts after `deadline` (epoch ms; default 30 s
 * from now, inside the cron route's 60 s limit): an agent sync cut off by the
 * platform would leave its lock and row half-done. Agents left over are
 * reported as `deferred` and picked up by the next run.
 */
export async function resyncStaleAgents(opts?: { deadline?: number }): Promise<{ synced: number; failed: number; deferred: number }> {
  if (!isSupabaseAdminConfigured() || (!isCartesiaConfigured() && !isElevenLabsConfigured())) {
    return { synced: 0, failed: 0, deferred: 0 }
  }
  const deadline = opts?.deadline ?? Date.now() + DEFAULT_RESYNC_BUDGET_MS
  const admin = createAdminClient()
  const stale: string[] = []

  for (let offset = 0; offset < RESYNC_MAX_SCANNED && stale.length < RESYNC_BATCH; offset += RESYNC_PAGE_SIZE) {
    if (Date.now() >= deadline) break
    const agents = await loadAgentPage(admin, offset, RESYNC_PAGE_SIZE)
    if (agents.length === 0) break
    const orgs = await loadSyncOrgs(admin, [...new Set(agents.map((a) => a.org_id))])
    const entries = agents.flatMap((agent) => {
      const org = orgs.get(agent.org_id)
      return org && org.onboarding_completed ? [{ agent, org }] : []
    })
    const contexts = await loadSyncContexts(admin, entries)
    for (const { agent, org } of entries) {
      const ctx = contexts.get(agent.id)
      if (!ctx) continue
      let staleAgent: boolean
      try {
        staleAgent = isAgentStale(agent, org, ctx)
      } catch (error) {
        console.error('[agent-sync]', 'stale check failed', agent.id, error)
        staleAgent = true
      }
      if (staleAgent) stale.push(agent.id)
      if (stale.length >= RESYNC_BATCH) break
    }
    if (agents.length < RESYNC_PAGE_SIZE) break
  }

  let synced = 0
  let failed = 0
  let deferred = 0
  // Sequential on purpose: tool reconciliation and provider rate limits are per account.
  for (const [index, agentId] of stale.entries()) {
    if (Date.now() >= deadline) {
      deferred = stale.length - index
      console.warn('[agent-sync]', 'resync time budget used up; the rest continues on the next run', { deferred })
      break
    }
    try {
      const state = await syncAgentProviders(agentId)
      if (hasFailedEntry(state)) failed++
      else synced++
    } catch (error) {
      failed++
      console.error('[agent-sync]', 'resync failed', agentId, error instanceof Error ? error.message : error)
    }
  }
  return { synced, failed, deferred }
}

/**
 * Removes the agent's provider agents (account or agent deletion). Missing
 * agents count as removed. Both deletions are always attempted; failures are
 * logged with the provider id for manual cleanup and then thrown together, so
 * the caller can report an incomplete cleanup and carry on.
 */
export async function deleteAgentProviders(agent: Agent): Promise<void> {
  const failures: string[] = []
  const attempt = async (provider: ProviderName, providerAgentId: string, run: () => Promise<void>) => {
    try {
      if (!providerConfigured(provider)) throw new Error(`${provider} is not configured`)
      await run()
    } catch (error) {
      failures.push(provider)
      console.error(`[${provider}]`, 'provider agent deletion failed; delete it manually', {
        agent: agent.id,
        provider_agent_id: providerAgentId,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const tasks: Promise<void>[] = []
  const cartesiaId = agent.cartesia_agent_id
  if (cartesiaId) tasks.push(attempt('cartesia', cartesiaId, () => deleteCartesiaAgent(cartesiaId)))
  const elevenLabsId = agent.elevenlabs_agent_id
  if (elevenLabsId) tasks.push(attempt('elevenlabs', elevenLabsId, () => deleteElevenLabsAgent(elevenLabsId)))
  await Promise.all(tasks)

  if (failures.length > 0) throw new Error(`Provider agent deletion failed: ${failures.join(', ')}`)
}
