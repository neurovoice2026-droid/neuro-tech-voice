import 'server-only'
// Monitoring of the platform ElevenLabs webhook tools:
//   • executions (GET /v1/convai/tools/{id}/executions, last 24 h): error
//     count, error rate, error types, last error time. ElevenLabs records
//     failures that never reached our server (wrong URL, timeouts, auth).
//     Executions carry request/response payloads and webhook headers/body:
//     only counts, error_type tallies and timestamps are kept, never payloads,
//     error messages or conversation ids;
//   • dependents (GET /v1/convai/tools/{id}/dependent-agents): every ready,
//     active, app-routed ElevenLabs agent with human transfer configured must
//     reference the transfer tool; missing ones are reported and re-synced.
// The maintenance step stores the summary on the platform_resources row
// (monitor column, migration 016); admin diagnostics read it, or recompute it
// live with ?probe=1.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitProviderEvent } from '@/lib/observability/telemetry'
import type { Logger } from '@/lib/observability/logger'
import * as el from '@/lib/elevenlabs/client'
import * as toolsApi from '@/lib/elevenlabs/api/tools'
import { PLATFORM_TOOL_KEYS, PLATFORM_WEBHOOK_TOOLS } from '@/lib/elevenlabs/tools/definitions'
import { buildWebhookToolConfig } from '@/lib/elevenlabs/tools/webhook-tool'
import { toolConfigHash } from '@/lib/elevenlabs/tools/hash'
import { toolSecretProblems, toolSecretValue } from '@/lib/elevenlabs/tools/secret-config'
import { rateLimit } from '@/lib/security/rate-limit'
import { publicBaseUrl, type ConfigProblem } from './config'
import { toProviderError } from './errors'
import { readTransferSettings } from './settings'
import { isReadyRow, pinnedResourceId, readResourceRow, writeResourceMonitor } from './platform-resources'
import { TRANSFER_TOOL_DEGRADED, reconcilePlatformTools, type PlatformToolReport } from './platform-tools'

const DAY_MS = 86_400_000
const ERROR_PAGES = 5
const ALL_PAGES = 10
const DEPENDENT_PAGES = 50
/** A spike: at least this many failed executions in 24 h ... */
export const TOOL_ERROR_ALERT_MIN = 3
/** ... that are at least this share of all executions. */
export const TOOL_ERROR_ALERT_RATE = 0.2
/** Agents re-synced per maintenance run when they do not reference the tool. */
const REPAIR_LIMIT = 5

export interface ExecutionSummary {
  window_hours: number
  total: number
  errors: number
  error_rate: number | null
  error_types: Record<string, number>
  last_error_at: string | null
  agents_with_errors: number
  /** A page cap was reached: counts are lower bounds. */
  truncated: boolean
  spike: boolean
}

export function isErrorSpike(errors: number, total: number): boolean {
  return errors >= TOOL_ERROR_ALERT_MIN && errors / Math.max(total, errors, 1) >= TOOL_ERROR_ALERT_RATE
}

/** Counts of the last 24 h of executions (never payloads). */
export async function summarizeToolExecutions(toolId: string, now = Date.now()): Promise<ExecutionSummary> {
  const start = Math.floor((now - DAY_MS) / 1000)
  const page = (isError: boolean | undefined) => (cursor: string | null) =>
    toolsApi.toolExecutions(toolId, { is_error: isError, start_time: start, cursor }).then((r) => ({ items: r.executions ?? [], next_cursor: r.next_cursor, has_more: r.has_more }))
  const failed = await toolsApi.collectPages(page(true), ERROR_PAGES)
  const all = await toolsApi.collectPages(page(undefined), ALL_PAGES)
  const errorTypes: Record<string, number> = {}
  let last = 0
  const agents = new Set<string>()
  for (const e of failed.items) {
    const type = /^[a-z_]{1,40}$/.test(e.error_type ?? '') ? (e.error_type as string) : 'unknown'
    errorTypes[type] = (errorTypes[type] ?? 0) + 1
    if (typeof e.timestamp === 'number' && e.timestamp > last) last = e.timestamp
    if (e.agent_id) agents.add(e.agent_id)
  }
  const errors = failed.items.length
  const total = Math.max(all.items.length, errors)
  return {
    window_hours: 24,
    total,
    errors,
    error_rate: total > 0 ? Math.round((errors / total) * 1000) / 1000 : null,
    error_types: errorTypes,
    last_error_at: last > 0 ? new Date(last * 1000).toISOString() : null,
    agents_with_errors: agents.size,
    truncated: failed.truncated || all.truncated,
    spike: isErrorSpike(errors, total),
  }
}

export interface ExpectedAgent {
  agentId: string
  externalId: string
}

/**
 * Ready ElevenLabs agents that must reference the transfer tool: active,
 * human transfer enabled with a destination, and at least one app-routed
 * number (or none yet: new orgs default to app routing) — the same rule as
 * the agent builder (agent-spec.ts + adapters.ts).
 */
export async function expectedTransferAgents(db: SupabaseClient): Promise<ExpectedAgent[]> {
  const { data: rows, error } = await db
    .from('agent_provider_resources')
    .select('agent_id, org_id, external_id')
    .eq('provider', 'elevenlabs')
    .eq('status', 'ready')
    .not('external_id', 'is', null)
    .limit(5000)
  if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
  const list = (rows ?? []) as Array<{ agent_id: string; org_id: string; external_id: string }>
  if (!list.length) return []
  const agents = new Map<string, { is_active: boolean | null; transfer_settings: unknown }>()
  const modes = new Map<string, string[]>()
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200)
    const { data: a, error: aErr } = await db.from('agents').select('id, is_active, transfer_settings').in('id', chunk.map((r) => r.agent_id))
    if (aErr) throw new Error(`agents read failed: ${aErr.message}`)
    for (const r of a ?? []) agents.set(r.id as string, { is_active: r.is_active as boolean | null, transfer_settings: r.transfer_settings })
    const orgIds = [...new Set(chunk.map((r) => r.org_id))]
    const { data: n, error: nErr } = await db.from('phone_numbers').select('org_id, routing_mode').in('org_id', orgIds)
    if (nErr) throw new Error(`phone_numbers read failed: ${nErr.message}`)
    for (const r of n ?? []) modes.set(r.org_id as string, [...(modes.get(r.org_id as string) ?? []), String(r.routing_mode)])
  }
  return list
    .filter((r) => {
      const agent = agents.get(r.agent_id)
      if (!agent || agent.is_active === false) return false
      const transfer = readTransferSettings(agent.transfer_settings)
      if (!transfer.enabled || !transfer.number) return false
      const orgModes = modes.get(r.org_id) ?? []
      return orgModes.length === 0 || orgModes.includes('app_routed')
    })
    .map((r) => ({ agentId: r.agent_id, externalId: r.external_id }))
}

export interface DependentsSummary {
  expected: number
  referencing: number
  missing: number
  /** Agents referencing the tool that we do not expect to (another deployment's or hand-made agents). */
  unexpected: number
  truncated: boolean
  /** Internal agent ids (never remote ids), at most 20: for the repair step and admins. */
  missing_agent_ids: string[]
}

export async function checkToolDependents(db: SupabaseClient, toolId: string): Promise<DependentsSummary> {
  const deps = await toolsApi.collectPages(
    (cursor) => toolsApi.toolDependentAgents(toolId, { cursor }).then((r) => ({ items: r.agents ?? [], next_cursor: r.next_cursor, has_more: r.has_more })),
    DEPENDENT_PAGES,
  )
  const referencing = new Set(deps.items.map((a) => a.id))
  const expected = await expectedTransferAgents(db)
  const expectedIds = new Set(expected.map((e) => e.externalId))
  const missing = expected.filter((e) => !referencing.has(e.externalId))
  return {
    expected: expected.length,
    referencing: referencing.size,
    // A truncated listing cannot prove an agent is missing.
    missing: deps.truncated ? 0 : missing.length,
    unexpected: [...referencing].filter((id) => !expectedIds.has(id)).length,
    truncated: deps.truncated,
    missing_agent_ids: deps.truncated ? [] : missing.slice(0, 20).map((m) => m.agentId),
  }
}

/** Maintenance step `platform_tools`: reconcile, then monitor (summaries stored), repair missing references. */
export async function runPlatformToolMaintenance(log: Logger, now = Date.now()) {
  if (!el.isConfigured()) return { skipped: 'not_configured' }
  const reconcile = await reconcilePlatformTools({ log })
  const db = createAdminClient()
  const monitored: Record<string, unknown> = {}
  for (const t of reconcile.tools) {
    if (t.status !== 'ok' || !t.toolId) continue
    const monitor: Record<string, unknown> = { checked_at: new Date(now).toISOString() }
    try {
      const ex = await summarizeToolExecutions(t.toolId, now)
      monitor.executions = ex
      emitProviderEvent({
        system: 'elevenlabs',
        kind: 'health_check',
        operation: 'tools.executions',
        ok: !ex.spike,
        errorCode: ex.spike ? 'tool_error_spike' : null,
        details: { tool: t.key, errors: ex.errors, total: ex.total, error_types: ex.error_types },
      })
      if (ex.spike) log.error('platform_tool.error_spike', undefined, { key: t.key, errors: ex.errors, total: ex.total, rate: ex.error_rate, errorTypes: ex.error_types })
    } catch (err) {
      log.error('platform_tool.executions_failed', err, { key: t.key })
      monitor.executions = { error: toProviderError(err, 'elevenlabs', 'tools.executions').code }
    }
    if (t.key === 'elevenlabs.transfer_tool') {
      try {
        const deps = await checkToolDependents(db, t.toolId)
        monitor.dependents = { ...deps, missing_agent_ids: undefined }
        if (deps.missing > 0) {
          log.error('platform_tool.agents_missing_tool', undefined, { key: t.key, missing: deps.missing, expected: deps.expected })
          monitor.repaired = await repairMissingReferences(deps.missing_agent_ids.slice(0, REPAIR_LIMIT), log)
        }
      } catch (err) {
        log.error('platform_tool.dependents_failed', err, { key: t.key })
        monitor.dependents = { error: toProviderError(err, 'elevenlabs', 'tools.dependent_agents').code }
      }
    }
    await writeResourceMonitor(t.key, monitor)
    monitored[t.key] = monitor
  }
  return { reconcile: redactReport(reconcile), monitored }
}

/** A ready agent without the tool (synced before this fix, or edited in the dashboard): push its config again. */
async function repairMissingReferences(agentIds: string[], log: Logger): Promise<number> {
  if (!agentIds.length) return 0
  const { syncAgent } = await import('./agent-sync')
  let done = 0
  for (const agentId of agentIds) {
    try {
      const [res] = await syncAgent(agentId, { providers: ['elevenlabs'], force: true, noCreate: true, log })
      if (res?.status === 'ready') done++
    } catch (err) {
      log.error('platform_tool.repair_failed', err, { agentId })
    }
  }
  return done
}

/** The report without provider ids (logged and returned to the cron). */
function redactReport(r: PlatformToolReport) {
  return { ...r, tools: r.tools.map((t) => ({ key: t.key, status: t.status, action: t.action, code: t.code, message: t.message })) }
}

// ─── Admin diagnostics ───────────────────────────────────────────────────────

const PROBE_RULE = { name: 'admin_tool_probe', limit: 20, windowSeconds: 600 }
const MONITOR_STALE_MS = 2 * DAY_MS

export interface PlatformToolDiagnostics {
  problems: ConfigProblem[]
  summary: Record<string, unknown>
}

/**
 * DB-only by default (stored monitor summary, config drift, degraded agents);
 * `probe` also asks ElevenLabs live (tool exists, usage stats, executions,
 * dependent agents), rate limited platform-wide. Never returns secret values.
 */
export async function platformToolDiagnostics(db: SupabaseClient, log: Logger, opts: { probe?: boolean } = {}): Promise<PlatformToolDiagnostics> {
  const problems: ConfigProblem[] = [...toolSecretProblems()]
  const summary: Record<string, unknown> = {}
  const base = publicBaseUrl()
  let secretRow: Awaited<ReturnType<typeof readResourceRow>> = null
  try {
    secretRow = await readResourceRow('elevenlabs.tool_secret')
  } catch (err) {
    log.error('platform_tool.diagnostics_read_failed', err, { key: 'elevenlabs.tool_secret' })
  }
  summary.tool_secret = {
    configured: !!toolSecretValue(),
    stored: isReadyRow(secretRow),
    rotated_at: (secretRow?.details?.rotated_at as string | undefined) ?? null,
    checked_at: secretRow?.checked_at ?? null,
  }

  const { count: degradedCount, error: degErr } = await db
    .from('agent_provider_resources')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'elevenlabs')
    .eq('status', 'degraded')
    .eq('last_error_code', TRANSFER_TOOL_DEGRADED.code)
  if (degErr) log.error('platform_tool.diagnostics_degraded_failed', degErr)
  if ((degradedCount ?? 0) > 0) {
    problems.push({
      key: 'PLATFORM_TOOLS',
      severity: 'error',
      message: `${degradedCount} agent(s) cannot transfer calls because the platform transfer tool is unavailable; they offer to take a message. Fix the tool error below, then POST /api/admin/voice/tools {"resync_degraded": true}.`,
    })
  }
  summary.agents_without_transfer_tool = degradedCount ?? 0

  const probeAllowed = opts.probe ? (await rateLimit(PROBE_RULE, 'platform')).allowed : false
  if (opts.probe && !probeAllowed) summary.probe = 'rate_limited'

  for (const key of PLATFORM_TOOL_KEYS) {
    const out: Record<string, unknown> = { pinned: !!pinnedResourceId(key) }
    let row: Awaited<ReturnType<typeof readResourceRow>> = null
    try {
      row = await readResourceRow(key)
    } catch (err) {
      log.error('platform_tool.diagnostics_read_failed', err, { key })
    }
    const toolId = pinnedResourceId(key) ?? (isReadyRow(row) ? row.external_id : null)
    out.stored = !!toolId
    out.status = row?.status ?? (row ? 'ready' : 'missing')
    out.checked_at = row?.checked_at ?? null
    out.header_auth = row?.details?.auth === 'headers'
    // Config drift without a provider call: the stored secret id is enough to rebuild the config.
    if (base && toolId) {
      try {
        const desired = buildWebhookToolConfig(PLATFORM_WEBHOOK_TOOLS[key], { baseUrl: base, toolKeySecretId: isReadyRow(secretRow) ? secretRow.external_id : null })
        out.config_current = row?.details?.config_hash === toolConfigHash(desired)
      } catch (err) {
        log.error('platform_tool.diagnostics_config_failed', err, { key })
      }
    }
    if (!toolId && el.isConfigured()) {
      problems.push({ key: 'PLATFORM_TOOLS', severity: 'warning', message: `${key} has not been created yet: it is created at the next agent sync or POST /api/admin/voice/tools.` })
    } else if (out.config_current === false) {
      problems.push({ key: 'PLATFORM_TOOLS', severity: 'warning', message: `${key} runs an older configuration: it is updated at the next agent sync, maintenance run or POST /api/admin/voice/tools.` })
    }

    // The column defaults to {} (never monitored yet).
    let monitor = row?.monitor && Object.keys(row.monitor).length > 0 ? (row.monitor as Record<string, unknown>) : null
    if (probeAllowed && toolId) {
      try {
        const remote = await toolsApi.getTool(toolId)
        out.usage = { total_calls: remote.usage_stats?.total_calls ?? null, avg_latency_secs: remote.usage_stats?.avg_latency_secs ?? null }
        monitor = { checked_at: new Date().toISOString(), live: true, executions: await summarizeToolExecutions(toolId) }
        if (key === 'elevenlabs.transfer_tool') monitor.dependents = await checkToolDependents(db, toolId)
      } catch (err) {
        const e = toProviderError(err, 'elevenlabs', 'tools.probe')
        log.error('platform_tool.probe_failed', err, { key })
        out.probe_error = e.code
        problems.push({ key: 'PLATFORM_TOOLS', severity: 'error', message: e.code === 'not_found' ? `${key} no longer exists at ElevenLabs: it is recreated at the next agent sync or maintenance run.` : `${key} could not be checked (${e.code}).` })
      }
    }
    if (monitor) {
      out.monitor = monitor
      const ex = monitor.executions as Partial<ExecutionSummary> | undefined
      if (ex?.spike) {
        problems.push({ key: 'PLATFORM_TOOLS', severity: 'error', message: `${key}: ${ex.errors} of ${ex.total} executions failed in the last 24 h (${Object.keys(ex.error_types ?? {}).join(', ') || 'unknown'}).` })
      }
      const deps = monitor.dependents as Partial<DependentsSummary> | undefined
      if (deps && (deps.missing ?? 0) > 0) {
        problems.push({ key: 'PLATFORM_TOOLS', severity: 'error', message: `${deps.missing} of ${deps.expected} app-routed agents with human transfer do not reference ${key}; they are re-synced by maintenance.` })
      }
      if (deps?.truncated) problems.push({ key: 'PLATFORM_TOOLS', severity: 'warning', message: `${key}: the dependent-agent listing was too long to verify completely.` })
      const checkedAt = Date.parse(String(monitor.checked_at ?? ''))
      if (!monitor.live && (!Number.isFinite(checkedAt) || Date.now() - checkedAt > MONITOR_STALE_MS)) {
        problems.push({ key: 'PLATFORM_TOOLS', severity: 'warning', message: `${key}: tool monitoring has not run for more than 48 h (maintenance step platform_tools).` })
      }
    } else if (toolId) {
      problems.push({ key: 'PLATFORM_TOOLS', severity: 'warning', message: `${key}: no monitoring data yet (maintenance step platform_tools, or ?probe=1).` })
    }
    // Never expose internal agent ids or provider ids in the summary.
    if (out.monitor && (out.monitor as Record<string, unknown>).dependents) {
      const d = (out.monitor as Record<string, unknown>).dependents as Record<string, unknown>
      out.monitor = { ...(out.monitor as Record<string, unknown>), dependents: { ...d, missing_agent_ids: undefined } }
    }
    summary[key] = out
  }
  return { problems, summary }
}
