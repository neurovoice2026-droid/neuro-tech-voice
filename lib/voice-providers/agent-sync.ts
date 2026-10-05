import 'server-only'
// Idempotent external-agent lifecycle, one external agent per (local agent, provider).
//
// Guarantees:
// - Exactly-one creation: a row in agent_provider_resources is leased (lock
//   token + expiry, atomic UPDATE … WHERE lease free) before any create, so
//   concurrent saves/onboarding/lazy-creation cannot create duplicates.
// - Crash safety: before creating, agents tagged with our local id are
//   looked up at the provider and adopted (create succeeded but the DB write
//   didn't).
// - Full-config writes only; a no-op (same hash + revision) is skipped.
// - Edits made while a sync runs are not lost: the lease holder loops while
//   agents.config_revision moved ahead of what it pushed.
// - Failures leave a sanitized error, an attempt counter and a jittered
//   next_retry_at for the maintenance job; nothing is swallowed.

import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import { buildAgentSpec, loadAgentRow } from './agent-spec'
import { lifecycleFor, type SyncedAgent } from './adapters'
import { isProviderError, toProviderError, type VoiceProvider } from './errors'
import { platformFallbackEnabled } from './config'
import type { ResourceStatus } from './types'
import { applyNumberRouting } from '@/lib/telephony/binding'

const LEASE_MS = 90_000
const MAX_CATCH_UP_LOOPS = 3

export interface ResourceRow {
  id: string
  org_id: string
  agent_id: string
  provider: VoiceProvider
  external_id: string | null
  external_version: string | null
  status: ResourceStatus
  last_error_code: string | null
  last_error: string | null
  last_synced_at: string | null
  attempt_count: number
  synced_revision: number | null
  config_hash: string | null
  details: Record<string, unknown>
}

export interface ProviderSyncResult {
  provider: VoiceProvider
  status: ResourceStatus | 'in_progress' | 'skipped'
  externalId: string | null
  appliedVoiceId: string | null
  errorCode: string | null
  error: string | null
  /** A new external agent was created (or adopted) in this sync. */
  created?: boolean
}

/** Exponential backoff with full jitter for the maintenance job: 1 min … 1 h. */
export function nextRetryDelayMs(attempt: number, random = Math.random): number {
  const ceiling = Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, attempt - 1))
  return Math.max(30_000, Math.floor(random() * ceiling))
}

async function ensureRow(db: SupabaseClient, orgId: string, agentId: string, provider: VoiceProvider): Promise<void> {
  const { error } = await db
    .from('agent_provider_resources')
    .upsert({ org_id: orgId, agent_id: agentId, provider, status: 'pending' }, { onConflict: 'agent_id,provider', ignoreDuplicates: true })
  if (error) throw new Error(`agent_provider_resources upsert failed: ${error.message}`)
}

async function acquireLease(db: SupabaseClient, agentId: string, provider: VoiceProvider): Promise<{ token: string; row: ResourceRow } | null> {
  const token = crypto.randomUUID()
  const now = new Date()
  const { data, error } = await db
    .from('agent_provider_resources')
    .update({ lock_token: token, lock_expires_at: new Date(now.getTime() + LEASE_MS).toISOString(), last_attempt_at: now.toISOString() })
    .eq('agent_id', agentId)
    .eq('provider', provider)
    .or(`lock_expires_at.is.null,lock_expires_at.lt."${now.toISOString()}"`)
    .select('*')
  if (error) throw new Error(`lease acquire failed: ${error.message}`)
  const row = data?.[0] as ResourceRow | undefined
  return row ? { token, row } : null
}

async function releaseLease(db: SupabaseClient, rowId: string, token: string, log: Logger) {
  const { error } = await db.from('agent_provider_resources').update({ lock_token: null, lock_expires_at: null }).eq('id', rowId).eq('lock_token', token)
  if (error) log.error('agent_sync.lease_release_failed', error, { rowId })
}

async function writeRow(db: SupabaseClient, rowId: string, token: string, patch: Record<string, unknown>) {
  const { error } = await db.from('agent_provider_resources').update(patch).eq('id', rowId).eq('lock_token', token)
  if (error) throw new Error(`agent_provider_resources update failed: ${error.message}`)
}

async function currentRevision(db: SupabaseClient, agentId: string): Promise<number> {
  const { data, error } = await db.from('agents').select('config_revision').eq('id', agentId).single()
  if (error) throw new Error(`agents revision read failed: ${error.message}`)
  return (data?.config_revision as number) ?? 1
}

/** Pushes the agent's current config to one provider (create or update). */
async function syncOne(db: SupabaseClient, agentId: string, orgId: string, provider: VoiceProvider, opts: { force: boolean; log: Logger }): Promise<ProviderSyncResult> {
  const lifecycle = lifecycleFor(provider)
  const log = opts.log.child({ provider })
  if (!lifecycle.isConfigured()) {
    return { provider, status: 'skipped', externalId: null, appliedVoiceId: null, errorCode: 'not_configured', error: null }
  }

  await ensureRow(db, orgId, agentId, provider)
  const lease = await acquireLease(db, agentId, provider)
  if (!lease) {
    log.info('agent_sync.in_progress', { agentId })
    return { provider, status: 'in_progress', externalId: null, appliedVoiceId: null, errorCode: null, error: null }
  }

  let row = lease.row
  const previousExternalId = row.external_id
  let result: ProviderSyncResult = { provider, status: row.status, externalId: row.external_id, appliedVoiceId: null, errorCode: null, error: null }
  try {
    for (let loop = 0; loop < MAX_CATCH_UP_LOOPS; loop++) {
      const agent = await loadAgentRow(db, agentId)
      if (!agent) throw new Error('agent row disappeared during sync')
      const spec = await buildAgentSpec(db, agent)
      const ctx = { orgId, agentId }

      let synced: SyncedAgent
      if (!row.external_id) {
        const adopted = await lifecycle.findByLocalAgent(agentId).catch((err: unknown) => {
          log.warn('agent_sync.adopt_lookup_failed', { error: String((err as Error)?.message ?? err) })
          return [] as string[]
        })
        if (adopted.length > 1) log.warn('agent_sync.duplicate_remote_agents', { count: adopted.length, externalIds: adopted })
        synced = adopted[0] ? await lifecycle.update(adopted[0], spec) : await lifecycle.create(spec)
        log.info(adopted[0] ? 'agent_sync.adopted' : 'agent_sync.created', { externalId: synced.externalId, ...ctx })
      } else {
        const hash = await lifecycle.hash(spec)
        if (!opts.force && hash === row.config_hash && row.synced_revision === spec.revision && row.status === 'ready') {
          result = { provider, status: 'ready', externalId: row.external_id, appliedVoiceId: null, errorCode: null, error: null }
          break
        }
        try {
          synced = await lifecycle.update(row.external_id, spec)
        } catch (err) {
          if (isProviderError(err) && err.code === 'not_found') {
            // Deleted out of band at the provider: recreate once.
            log.warn('agent_sync.remote_missing_recreating', { externalId: row.external_id })
            synced = await lifecycle.create(spec)
          } else {
            throw err
          }
        }
      }

      const patch = {
        external_id: synced.externalId,
        external_version: synced.version,
        status: 'ready' as const,
        last_error: null,
        last_error_code: null,
        last_synced_at: new Date().toISOString(),
        attempt_count: 0,
        next_retry_at: null,
        synced_revision: spec.revision,
        config_hash: synced.configHash,
        details: { ...(row.details ?? {}), ...synced.details },
      }
      await writeRow(db, row.id, lease.token, patch)
      row = { ...row, ...patch }
      if (provider === 'elevenlabs') {
        const { error } = await db.from('agents').update({ elevenlabs_agent_id: synced.externalId }).eq('id', agentId)
        if (error) log.error('agent_sync.compat_column_failed', error)
      }
      emitProviderEvent({ system: provider, kind: 'sync_success', ok: true, orgId, agentId, details: { revision: spec.revision } })
      result = { provider, status: 'ready', externalId: synced.externalId, appliedVoiceId: synced.appliedVoiceId, errorCode: null, error: null, created: synced.externalId !== previousExternalId }

      if ((await currentRevision(db, agentId)) <= spec.revision) break
      log.info('agent_sync.catch_up', { pushed: spec.revision })
    }
  } catch (e) {
    const err = toProviderError(e, provider, 'agent.sync')
    const attempt = (row.attempt_count ?? 0) + 1
    // An existing remote agent keeps serving calls with its previous config.
    const status: ResourceStatus = row.external_id ? 'degraded' : 'failed'
    log.error('agent_sync.failed', e, { agentId, attempt, status })
    emitProviderEvent({ system: provider, kind: 'sync_failure', ok: false, errorCode: err.code, orgId, agentId, details: { attempt } })
    try {
      await writeRow(db, row.id, lease.token, {
        status,
        last_error_code: err.code,
        last_error: err.code === 'unknown' ? 'Synchronisation failed. It will be retried automatically.' : err.safeMessage,
        attempt_count: attempt,
        next_retry_at: new Date(Date.now() + nextRetryDelayMs(attempt)).toISOString(),
      })
    } catch (writeErr) {
      log.error('agent_sync.status_write_failed', writeErr)
    }
    result = { provider, status, externalId: row.external_id, appliedVoiceId: null, errorCode: err.code, error: err.safeMessage }
  } finally {
    await releaseLease(db, row.id, lease.token, log)
  }
  return result
}

export interface SyncOptions {
  /** Restrict to these providers (default: primary + fallback when enabled). */
  providers?: VoiceProvider[]
  force?: boolean
  log?: Logger
}

/** Which providers an agent needs external resources on. */
export async function providersFor(db: SupabaseClient, agentId: string): Promise<VoiceProvider[]> {
  const { data, error } = await db
    .from('agents')
    .select('primary_provider, fallback_provider, organizations(voice_fallback_enabled)')
    .eq('id', agentId)
    .single()
  if (error) throw new Error(`agents read failed: ${error.message}`)
  const primary = (data.primary_provider as VoiceProvider) ?? 'elevenlabs'
  const fallback = data.fallback_provider as VoiceProvider | null
  const org = (Array.isArray(data.organizations) ? data.organizations[0] : data.organizations) as { voice_fallback_enabled?: boolean } | null
  const out: VoiceProvider[] = [primary]
  if (fallback && fallback !== primary && platformFallbackEnabled() && org?.voice_fallback_enabled !== false) out.push(fallback)
  return out
}

/** Synchronises the agent with each provider, sequentially (primary first). */
export async function syncAgent(agentId: string, opts: SyncOptions = {}): Promise<ProviderSyncResult[]> {
  const db = createAdminClient()
  const log = (opts.log ?? createLogger()).child({ agentId, component: 'agent_sync' })
  const { data: agent, error } = await db.from('agents').select('id, org_id').eq('id', agentId).maybeSingle()
  if (error) throw new Error(`agents read failed: ${error.message}`)
  if (!agent) return []
  const providers = opts.providers ?? (await providersFor(db, agentId))
  const results: ProviderSyncResult[] = []
  for (const provider of providers) {
    results.push(await syncOne(db, agentId, agent.org_id as string, provider, { force: !!opts.force, log }))
  }
  const el = results.find((r) => r.provider === 'elevenlabs')
  if (el) await reconcileVoiceStatus(db, agentId, el, log)
  const created = results.filter((r) => r.created).map((r) => r.provider)
  if (created.length) await rebindNumbers(db, agent.org_id as string, created, log)
  return results
}

/**
 * Keeps agents.voice_sync_status honest after any ElevenLabs sync that read
 * the agent back: "synced" only when the provider really uses the selected
 * voice. A save in progress (PUT /api/agent/voice, status 'saving') decides
 * its own outcome and is left alone.
 */
async function reconcileVoiceStatus(db: SupabaseClient, agentId: string, result: ProviderSyncResult, log: Logger) {
  if (result.status !== 'ready' || !result.appliedVoiceId) return
  const { data, error } = await db.from('agents').select('voice_id, voice_sync_status').eq('id', agentId).single()
  if (error) {
    log.error('agent_sync.voice_status_read_failed', error)
    return
  }
  if (!data?.voice_id || data.voice_sync_status === 'saving') return
  const applied = result.appliedVoiceId === data.voice_id
  const next = applied ? 'synced' : 'failed'
  if (data.voice_sync_status === next) return
  const { error: updErr } = await db
    .from('agents')
    .update({
      voice_sync_status: next,
      voice_sync_error: applied ? null : 'The selected voice could not be applied to your agent. Choose another voice or retry.',
    })
    .eq('id', agentId)
  if (updErr) log.error('agent_sync.voice_status_write_failed', updErr)
  else log.info('agent_sync.voice_status', { status: next })
}

/**
 * A newly created external agent must be wired to the org's numbers: the
 * Cartesia SIP import is assigned to the fallback agent (app-routed numbers)
 * and native numbers are assigned to the ElevenLabs agent. Runs for every
 * caller (routes, maintenance retries, provisioning). Failures are recorded on
 * the number (routing_status) by applyNumberRouting and logged here.
 */
async function rebindNumbers(db: SupabaseClient, orgId: string, created: VoiceProvider[], log: Logger) {
  const { data, error } = await db.from('phone_numbers').select('id, twilio_sid, routing_mode').eq('org_id', orgId)
  if (error) {
    log.error('agent_sync.numbers_read_failed', error)
    return
  }
  for (const n of data ?? []) {
    if (!n.twilio_sid || String(n.twilio_sid).startsWith('mock')) continue
    const native = n.routing_mode === 'native_elevenlabs'
    if (!(native ? created.includes('elevenlabs') : created.includes('cartesia'))) continue
    try {
      const res = await applyNumberRouting(n.id as string, log)
      log.info('agent_sync.number_rebound', { phoneNumberId: n.id, status: res.status })
    } catch (err) {
      log.error('agent_sync.number_rebind_failed', err, { phoneNumberId: n.id })
    }
  }
}

/** Increments agents.config_revision (provider-managed column) and returns the new value. */
export async function bumpRevision(agentId: string): Promise<number> {
  const { data, error } = await createAdminClient().rpc('bump_agent_revision', { p_agent_id: agentId })
  if (error) throw new Error(`bump_agent_revision failed: ${error.message}`)
  return Number(data)
}

/**
 * Deletes the external agents for a local agent (account deletion / cleanup).
 * Remote "not found" counts as success; rows are removed only after the
 * provider confirmed, so a failure can be retried.
 */
export async function deleteExternalAgents(agentId: string, log: Logger = createLogger()): Promise<Array<{ provider: VoiceProvider; ok: boolean; error?: string }>> {
  const db = createAdminClient()
  const { data: rows, error } = await db.from('agent_provider_resources').select('id, provider, external_id').eq('agent_id', agentId)
  if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
  const out: Array<{ provider: VoiceProvider; ok: boolean; error?: string }> = []
  for (const r of rows ?? []) {
    const provider = r.provider as VoiceProvider
    try {
      if (r.external_id) await lifecycleFor(provider).delete(r.external_id as string)
      const { error: delErr } = await db.from('agent_provider_resources').delete().eq('id', r.id)
      if (delErr) throw new Error(delErr.message)
      out.push({ provider, ok: true })
    } catch (e) {
      log.error('agent_delete.failed', e, { provider, agentId })
      out.push({ provider, ok: false, error: toProviderError(e, provider, 'agent.delete').safeMessage })
    }
  }
  return out
}
