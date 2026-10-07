import 'server-only'
// Platform config rollout. Changes to what the platform owns in an agent
// (the builder in lib/elevenlabs/agent-config.ts, PLATFORM_AGENT_CONFIG_VERSION,
// env such as the LLM, guardrails or call limits, an org's plan) change the
// agent's config hash but trigger no sync by themselves. This step finds
// ElevenLabs agents whose current hash differs from the one they were synced
// with and re-syncs a bounded batch per run:
//   • only agents that already exist at ElevenLabs (status ready, remote id);
//     the sync runs with noCreate, so the rollout never creates an agent;
//   • the least recently checked first (rollout_checked_at, migration 014);
//   • at most ELEVENLABS_ROLLOUT_BATCH re-syncs per run (default 10, 0 = off),
//     after scanning at most ELEVENLABS_ROLLOUT_SCAN agents (default 100);
//   • not at all while the ElevenLabs API circuit is not closed;
//   • not at all while the LLM catalogue cannot be read (llm-selection.ts
//     reason catalog_unavailable / unknown_without_catalog): the hash would
//     then be computed from the fallback LLM choice, a read that flaps
//     between instances would mark every agent drifted and re-sync them all;
//   • ELEVENLABS_ROLLOUT_CANARY_ORGS (comma-separated org ids) limits the
//     rollout to those organizations, to watch a change on a few first.
// Safe to run concurrently (cron and the admin endpoint): every write goes
// through syncAgent, which holds the per-agent lease and skips no-op updates.
// Paused agents are included: their spec IS the paused variant, so a rollout
// keeps them paused (it never resumes an agent).

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import { PLATFORM_AGENT_CONFIG_VERSION } from '@/lib/elevenlabs/agent-config'
import { effectiveAgentLlm, type LlmSelectionReason } from '@/lib/elevenlabs/llm-selection'
import { LIFECYCLES } from './adapters'
import { buildAgentSpec, loadAgentRow } from './agent-spec'
import { syncAgent } from './agent-sync'
import { peek } from './circuit-registry'

type Env = Record<string, string | undefined>

export const DEFAULT_ROLLOUT_BATCH = 10
export const DEFAULT_ROLLOUT_SCAN = 100
const MAX_ROLLOUT_BATCH = 100
const MAX_ROLLOUT_SCAN = 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** LLM selections made without the catalogue: not a trustworthy basis for drift. */
const CATALOG_UNREADABLE: ReadonlySet<LlmSelectionReason> = new Set(['catalog_unavailable', 'unknown_without_catalog'])

function intIn(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const v = Number(raw)
  return Number.isInteger(v) && v >= min && v <= max ? v : fallback
}

export function rolloutBatch(env: Env = process.env): number {
  return intIn(env.ELEVENLABS_ROLLOUT_BATCH, DEFAULT_ROLLOUT_BATCH, 0, MAX_ROLLOUT_BATCH)
}

export function rolloutScan(env: Env = process.env): number {
  return intIn(env.ELEVENLABS_ROLLOUT_SCAN, DEFAULT_ROLLOUT_SCAN, 1, MAX_ROLLOUT_SCAN)
}

/** Canary org ids (invalid entries ignored); empty = every organization. */
export function rolloutCanaryOrgs(env: Env = process.env): string[] {
  return (env.ELEVENLABS_ROLLOUT_CANARY_ORGS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => UUID.test(s))
}

export interface RolloutOptions {
  /** Report drift only, never sync. */
  dryRun: boolean
  /** Max re-syncs (defaults to ELEVENLABS_ROLLOUT_BATCH). */
  limit?: number
  /** Max agents compared (defaults to ELEVENLABS_ROLLOUT_SCAN). */
  scan?: number
  log?: Logger
}

export interface RolloutReport {
  platformVersion: number
  dryRun: boolean
  /** Why nothing was done: 'disabled' (batch 0), 'not_configured', 'circuit_<state>', 'llm_catalog_unavailable'. */
  skipped: string | null
  canary: boolean
  scanned: number
  inSync: number
  drifted: number
  /** Agent ids re-synced in this run, with the sync outcome. */
  synced: Array<{ agentId: string; status: string }>
  /** Drifted agents left for a later run (batch full, circuit opened mid-run). */
  deferred: number
  errors: number
}

interface CandidateRow {
  id: string
  agent_id: string
  config_hash: string | null
  synced_revision: number | null
}

export async function runConfigRollout(opts: RolloutOptions): Promise<RolloutReport> {
  const log = (opts.log ?? createLogger()).child({ component: 'config_rollout' })
  const limit = opts.limit ?? rolloutBatch()
  const canary = rolloutCanaryOrgs()
  const report: RolloutReport = {
    platformVersion: PLATFORM_AGENT_CONFIG_VERSION,
    dryRun: opts.dryRun,
    skipped: null,
    canary: canary.length > 0,
    scanned: 0,
    inSync: 0,
    drifted: 0,
    synced: [],
    deferred: 0,
    errors: 0,
  }
  const lifecycle = LIFECYCLES.elevenlabs
  if (!lifecycle.isConfigured()) return { ...report, skipped: 'not_configured' }
  if (limit <= 0 && !opts.dryRun) return { ...report, skipped: 'disabled' }
  const circuit = await peek('elevenlabs')
  if (circuit.state !== 'closed') {
    log.warn('config_rollout.skipped_circuit', { state: circuit.state })
    return { ...report, skipped: `circuit_${circuit.state}` }
  }
  const catalogUnreadable = async () => CATALOG_UNREADABLE.has((await effectiveAgentLlm(log)).reason)
  if (await catalogUnreadable()) {
    // Drift would be measured against the fallback LLM choice: nothing is compared or marked.
    log.warn('config_rollout.skipped_llm_catalog_unavailable')
    return { ...report, skipped: 'llm_catalog_unavailable' }
  }

  const db = createAdminClient()
  let q = db
    .from('agent_provider_resources')
    .select('id, agent_id, config_hash, synced_revision')
    .eq('provider', 'elevenlabs')
    .eq('status', 'ready')
    .not('external_id', 'is', null)
  if (canary.length) q = q.in('org_id', canary)
  const { data, error } = await q.order('rollout_checked_at', { ascending: true, nullsFirst: true }).limit(opts.scan ?? rolloutScan())
  if (error) throw new Error(`agent_provider_resources scan failed: ${error.message}`)

  const markChecked = async (rowId: string) => {
    const { error: updErr } = await db.from('agent_provider_resources').update({ rollout_checked_at: new Date().toISOString() }).eq('id', rowId)
    if (updErr) log.error('config_rollout.mark_failed', updErr, { rowId })
  }

  for (const row of (data ?? []) as CandidateRow[]) {
    report.scanned++
    let drifted: boolean
    try {
      const agent = await loadAgentRow(db, row.agent_id)
      if (!agent) {
        await markChecked(row.id)
        continue
      }
      const spec = await buildAgentSpec(db, agent)
      const hash = await lifecycle.hash(spec)
      drifted = hash !== row.config_hash || row.synced_revision !== spec.revision
    } catch (err) {
      report.errors++
      log.error('config_rollout.hash_failed', err, { agentId: row.agent_id })
      await markChecked(row.id)
      continue
    }
    if (!drifted) {
      report.inSync++
      await markChecked(row.id)
      continue
    }
    report.drifted++
    if (opts.dryRun) {
      await markChecked(row.id)
      continue
    }
    if (report.synced.length >= limit) {
      // Left unmarked: still the oldest check, first in line next run.
      report.deferred++
      continue
    }
    // The circuit can open while we work (live calls failing): stop pushing.
    const now = await peek('elevenlabs')
    if (now.state !== 'closed') {
      report.deferred++
      report.skipped = `circuit_${now.state}`
      log.warn('config_rollout.stopped_circuit', { state: now.state })
      break
    }
    // Same for the LLM catalogue (a cold instance whose catalogue read fails).
    if (await catalogUnreadable()) {
      report.deferred++
      report.skipped = 'llm_catalog_unavailable'
      log.warn('config_rollout.stopped_llm_catalog_unavailable')
      break
    }
    try {
      const [res] = await syncAgent(row.agent_id, { providers: ['elevenlabs'], noCreate: true, log })
      report.synced.push({ agentId: row.agent_id, status: res?.status ?? 'unknown' })
      if (res && res.status !== 'ready' && res.status !== 'in_progress') report.errors++
    } catch (err) {
      report.errors++
      report.synced.push({ agentId: row.agent_id, status: 'error' })
      log.error('config_rollout.sync_failed', err, { agentId: row.agent_id })
    }
    await markChecked(row.id)
  }

  log.info('config_rollout.done', {
    dryRun: report.dryRun,
    scanned: report.scanned,
    drifted: report.drifted,
    synced: report.synced.length,
    deferred: report.deferred,
    errors: report.errors,
    platformVersion: report.platformVersion,
  })
  return report
}
