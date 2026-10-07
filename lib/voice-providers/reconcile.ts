import 'server-only'
// Reconciliation between our DB and the providers' workspaces (admin job /
// runbook). Dry-run by default: it only reports. With `apply`, agents whose
// external resource is missing, failed, degraded or duplicated are re-synced
// (the sync engine adopts tagged agents or recreates missing ones). With
// `deleteOrphans`, ElevenLabs agents tagged for THIS environment whose local
// agent no longer exists are deleted. Cartesia orphans are only reported:
// their marker carries no environment, so a shared key could belong to
// another deployment.

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger, type Logger } from '@/lib/observability/logger'
import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { agentTags } from '@/lib/elevenlabs/agent-config'
import { LIFECYCLES } from './adapters'
import { providersFor, syncAgent } from './agent-sync'
import { isProviderError, toProviderError, VOICE_PROVIDERS, type VoiceProvider } from './errors'
import { deleteOrphanAgentKnowledge, type OrphanKnowledgeReport } from '@/lib/account/orphan-knowledge'

export interface ReconcileOptions {
  apply: boolean
  deleteOrphans: boolean
  /** Max local agents inspected per run. */
  limit: number
  log?: Logger
}

export interface ReconcileIssue {
  agentId: string
  provider: VoiceProvider
  kind:
    | 'not_created'
    | 'missing_remote'
    | 'unrecorded_remote'
    | 'duplicates'
    | 'failed'
    | 'degraded'
    | 'pending'
    /** The recorded agent exists but lacks this environment's tag (legacy): a sync re-tags it. */
    | 'untagged_remote'
    /** The recorded agent is tagged for another environment or local agent: never touched (report only). */
    | 'foreign_remote'
    /** The remote agent reads analysis items, not our legacy evaluation/data collection (report only). */
    | 'analysis_items_migrated'
  externalIds?: string[]
  action?: string
}

export interface ReconcileReport {
  dryRun: boolean
  agentsChecked: number
  issues: ReconcileIssue[]
  orphans: Array<{ provider: VoiceProvider; externalId: string; localAgentId: string | null; deleted: boolean; note?: string; knowledge?: OrphanKnowledgeReport }>
  errors: Array<{ provider: VoiceProvider; step: string; error: string }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function envTag(): string {
  return agentTags({ orgId: '', localAgentId: '' }).find((t) => t.startsWith('ntv-env:')) as string
}

interface RemoteInventory {
  agents: Array<{ id: string; localId: string | null }>
  /** The listing stopped before its end: absence cannot be proven from it. */
  truncated: boolean
}

/** Hard stop for a runaway cursor (100 agents per page): reported as truncation, never silent. */
const MAX_LIST_PAGES = 500

/**
 * Every agent tagged for THIS environment. The tags filter matches ANY of
 * the given tags (spec: "Repeat the parameter to match any of several
 * tags"), so only the environment tag is sent: adding 'ntv' would page
 * through every environment's agents.
 */
async function remoteElevenLabsAgents(maxPages = MAX_LIST_PAGES): Promise<RemoteInventory> {
  const out: Array<{ id: string; localId: string | null }> = []
  const env = envTag()
  let cursor: string | null = null
  for (let page = 0; page < maxPages; page++) {
    const res = await el.agents.list({ tags: [env], cursor, page_size: 100 })
    for (const a of res.agents ?? []) {
      const tags = a.tags ?? []
      if (!tags.includes(env)) continue
      const local = tags.find((t) => t.startsWith('ntv-agent:'))?.slice('ntv-agent:'.length) ?? null
      out.push({ id: a.agent_id, localId: local && UUID.test(local) ? local : null })
    }
    if (!res.has_more) return { agents: out, truncated: false }
    if (!res.next_cursor) return { agents: out, truncated: true }
    cursor = res.next_cursor
  }
  return { agents: out, truncated: true }
}

/**
 * Direct GET of a recorded id: 'exists' (untagged legacy agent, or tagged for
 * this environment and local agent), 'foreign' (tagged for another environment
 * or another local agent: a sync would hijack it), 'missing' (404) or
 * 'unknown' (any other failure).
 */
async function remoteAgentState(externalId: string, localAgentId: string, log: Logger): Promise<'exists' | 'foreign' | 'missing' | 'unknown'> {
  try {
    const remote = await el.agents.get(externalId)
    const tags = remote.tags ?? []
    const env = tags.find((t) => t.startsWith('ntv-env:'))
    const local = tags.find((t) => t.startsWith('ntv-agent:'))
    if ((env && env !== envTag()) || (local && local !== `ntv-agent:${localAgentId}`)) return 'foreign'
    return 'exists'
  } catch (err) {
    if (isProviderError(err) && err.code === 'not_found') return 'missing'
    log.warn('reconcile.agent_get_failed', { externalAgentId: externalId, code: isProviderError(err) ? err.code : 'unknown' })
    return 'unknown'
  }
}

async function remoteCartesiaAgents(maxPages = 20): Promise<RemoteInventory> {
  const out: Array<{ id: string; localId: string | null }> = []
  let after: string | null = null
  for (let page = 0; page < maxPages; page++) {
    const res = await ct.agents.list({ q: 'ntv-agent:', starting_after: after, limit: 100 })
    for (const a of res.data ?? []) {
      const m = /^ntv-agent:([0-9a-f-]{36})$/i.exec(a.description ?? '')
      if (m) out.push({ id: a.id, localId: m[1] })
    }
    if (!res.has_more || !res.data?.length) return { agents: out, truncated: false }
    after = res.data[res.data.length - 1].id
  }
  return { agents: out, truncated: true }
}

export async function reconcileVoiceProviders(opts: ReconcileOptions): Promise<ReconcileReport> {
  const log = (opts.log ?? createLogger()).child({ component: 'reconcile' })
  const db = createAdminClient()
  const report: ReconcileReport = { dryRun: !opts.apply, agentsChecked: 0, issues: [], orphans: [], errors: [] }

  const { data: agents, error } = await db.from('agents').select('id').order('created_at', { ascending: true }).limit(opts.limit)
  if (error) throw new Error(`agents read failed: ${error.message}`)
  const agentIds = (agents ?? []).map((a) => a.id as string)
  const { data: resources, error: resErr } = agentIds.length
    ? await db.from('agent_provider_resources').select('agent_id, provider, external_id, status, details').in('agent_id', agentIds)
    : { data: [], error: null }
  if (resErr) throw new Error(`agent_provider_resources read failed: ${resErr.message}`)

  // Remote inventories (one listing per provider instead of one call per agent).
  const remote: Partial<Record<VoiceProvider, Array<{ id: string; localId: string | null }>>> = {}
  const truncated = new Set<VoiceProvider>()
  for (const p of VOICE_PROVIDERS) {
    if (!LIFECYCLES[p].isConfigured()) continue
    try {
      const inventory = p === 'elevenlabs' ? await remoteElevenLabsAgents() : await remoteCartesiaAgents()
      remote[p] = inventory.agents
      if (inventory.truncated) {
        // A partial listing cannot prove that an agent is missing or orphaned.
        truncated.add(p)
        log.error('reconcile.list_truncated', undefined, { provider: p, listed: inventory.agents.length })
        report.errors.push({ provider: p, step: 'list', error: 'The agent listing was truncated: missing and orphan checks were skipped.' })
      }
    } catch (err) {
      const pe = toProviderError(err, p, 'reconcile.list')
      log.error('reconcile.list_failed', err, { provider: p })
      report.errors.push({ provider: p, step: 'list', error: pe.safeMessage })
    }
  }

  const duplicateCandidates: Array<{ agentId: string; provider: VoiceProvider; remoteIds: string[] }> = []
  for (const agentId of agentIds) {
    report.agentsChecked++
    let wanted: VoiceProvider[]
    try {
      wanted = await providersFor(db, agentId)
    } catch (err) {
      log.error('reconcile.providers_failed', err, { agentId })
      continue
    }
    const needsSync: VoiceProvider[] = []
    for (const p of wanted) {
      if (!LIFECYCLES[p].isConfigured() || !remote[p]) continue
      const row = (resources ?? []).find((r) => r.agent_id === agentId && r.provider === p)
      const remoteIds = remote[p]!.filter((r) => r.localId === agentId).map((r) => r.id)
      const recorded = (row?.external_id as string | null) ?? null
      const push = (kind: ReconcileIssue['kind'], externalIds?: string[]) => {
        report.issues.push({ agentId, provider: p, kind, ...(externalIds ? { externalIds } : {}) })
        if (!needsSync.includes(p)) needsSync.push(p)
      }
      // A truncated listing may hide the agent: the sync adopts it by tag instead of creating a duplicate.
      if (!recorded && remoteIds.length === 0) push('not_created')
      else if (!recorded && remoteIds.length > 0) push('unrecorded_remote', remoteIds)
      else if (recorded && !remoteIds.includes(recorded) && !truncated.has(p)) {
        // Not in this environment's listing: a legacy agent created before
        // the environment tag existed is still there. Only a 404 proves absence.
        const state = p === 'elevenlabs' ? await remoteAgentState(recorded, agentId, log) : 'missing'
        if (state === 'missing') push('missing_remote', [recorded])
        else if (state === 'exists') push('untagged_remote', [recorded])
        else if (state === 'foreign') {
          log.error('reconcile.foreign_remote', undefined, { agentId, externalAgentId: recorded })
          report.issues.push({ agentId, provider: p, kind: 'foreign_remote', externalIds: [recorded], action: 'report_only' })
        }
        else report.errors.push({ provider: p, step: 'verify_agent', error: 'Could not verify a recorded agent; it was left alone.' })
      }
      if (p === 'elevenlabs' && (row?.details as Record<string, unknown> | null | undefined)?.analysis_items_migrated === true) {
        // A re-sync does not change this: report only (see docs/elevenlabs/A2.md).
        report.issues.push({ agentId, provider: p, kind: 'analysis_items_migrated', externalIds: recorded ? [recorded] : undefined, action: 'report_only' })
      }
      // Duplicates are decided after the sync below (which may adopt one of
      // them): deleting against the pre-sync record could remove the agent
      // that was just adopted.
      if (remoteIds.length > 1) duplicateCandidates.push({ agentId, provider: p, remoteIds })
      if (row && ['failed', 'degraded', 'pending'].includes(row.status as string)) push(row.status as 'failed' | 'degraded' | 'pending')
    }
    if (opts.apply && needsSync.length) {
      const results = await syncAgent(agentId, { providers: needsSync, force: true, log })
      for (const r of results) {
        for (const issue of report.issues) if (issue.agentId === agentId && issue.provider === r.provider && !issue.action) issue.action = `synced:${r.status}`
      }
    }
  }

  if (duplicateCandidates.length) {
    const { data: fresh, error: freshErr } = await db
      .from('agent_provider_resources')
      .select('agent_id, provider, external_id')
      .in('agent_id', duplicateCandidates.map((d) => d.agentId))
    if (freshErr) throw new Error(`agent_provider_resources re-read failed: ${freshErr.message}`)
    for (const d of duplicateCandidates) {
      const recorded = (fresh ?? []).find((r) => r.agent_id === d.agentId && r.provider === d.provider)?.external_id as string | undefined
      if (!recorded || !d.remoteIds.includes(recorded)) {
        // No confirmed live agent to keep: report only, never delete.
        report.issues.push({ agentId: d.agentId, provider: d.provider, kind: 'duplicates', externalIds: d.remoteIds, action: 'unresolved' })
        continue
      }
      const extras = d.remoteIds.filter((id) => id !== recorded)
      report.issues.push({ agentId: d.agentId, provider: d.provider, kind: 'duplicates', externalIds: extras })
      for (const id of extras) report.orphans.push({ provider: d.provider, externalId: id, localAgentId: d.agentId, deleted: false, note: 'duplicate' })
    }
  }

  // Orphans: remote agents whose local agent no longer exists. Only checked
  // when every local agent was inspected (a partial page can't prove absence).
  if (agentIds.length < opts.limit) {
    const known = new Set(agentIds)
    for (const p of VOICE_PROVIDERS) {
      if (truncated.has(p)) continue
      for (const r of remote[p] ?? []) {
        if (r.localId && known.has(r.localId)) continue
        report.orphans.push({ provider: p, externalId: r.id, localAgentId: r.localId, deleted: false, note: p === 'cartesia' ? 'report_only' : undefined })
      }
    }
  }

  if (opts.apply && opts.deleteOrphans) {
    for (const o of report.orphans) {
      if (o.provider !== 'elevenlabs') continue
      try {
        // A true orphan's documents went unreferenced with its rows (slice H); a duplicate shares the live agent's.
        if (o.note !== 'duplicate') o.knowledge = await deleteOrphanAgentKnowledge(o.externalId, log)
        await LIFECYCLES.elevenlabs.delete(o.externalId)
        o.deleted = true
        log.warn('reconcile.orphan_deleted', { provider: o.provider, externalAgentId: o.externalId })
      } catch (err) {
        const pe = toProviderError(err, o.provider, 'reconcile.delete_orphan')
        log.error('reconcile.orphan_delete_failed', err, { externalAgentId: o.externalId })
        report.errors.push({ provider: o.provider, step: 'delete_orphan', error: pe.safeMessage })
      }
    }
  }

  log.info('reconcile.done', { dryRun: report.dryRun, agents: report.agentsChecked, issues: report.issues.length, orphans: report.orphans.length })
  return report
}
