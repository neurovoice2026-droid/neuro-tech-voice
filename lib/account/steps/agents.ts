import 'server-only'
// The organization's external agents, and their deletion.
//
// Ids come only from the organization's own rows (agent_provider_resources,
// plus the legacy agents.elevenlabs_agent_id column). Every workspace is
// shared by all tenants (and possibly by several deployments), so each id is
// also checked at the provider before it is listed or deleted: an ElevenLabs
// agent tagged for another environment, organization or local agent
// (ntv-env:/ntv-org:/ntv-agent: tags), or a Cartesia agent whose marker names
// another local agent, is "foreign": never listed, never deleted (our
// reference to it is dropped). Agents are never looked up by name or search.

import * as el from '@/lib/elevenlabs/client'
import * as ct from '@/lib/cartesia/client'
import { agentTags } from '@/lib/elevenlabs/agent-config'
import type { VoiceProvider } from '@/lib/voice-providers/errors'
import type { StepOutcome } from '../deletion-plan'
import type { AgentCursor, StepContext } from '../job'
import { isGone, isNotConfigured } from './util'

const CARTESIA_MARKER = /^ntv-agent:([0-9a-f-]{36})$/i

/** This deployment's `ntv-env:` agent tag (same source as the agent builder). */
function envTag(): string {
  return agentTags({ orgId: '', localAgentId: '' }).find((t) => t.startsWith('ntv-env:')) as string
}

export function providerConfigured(provider: VoiceProvider): boolean {
  return provider === 'elevenlabs' ? el.isConfigured() : ct.isConfigured()
}

export interface OrgAgents {
  localIds: string[]
  /** External ids per provider (resources rows and the legacy column). */
  external: Record<VoiceProvider, string[]>
  resources: Array<{ id: string; agent_id: string; provider: VoiceProvider; external_id: string | null }>
}

export async function loadOrgAgents(ctx: Pick<StepContext, 'db' | 'orgId'>): Promise<OrgAgents> {
  const [{ data: agents, error: agentErr }, { data: resources, error: resErr }] = await Promise.all([
    ctx.db.from('agents').select('id, elevenlabs_agent_id').eq('org_id', ctx.orgId),
    ctx.db.from('agent_provider_resources').select('id, agent_id, provider, external_id').eq('org_id', ctx.orgId),
  ])
  if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
  if (resErr) throw new Error(`agent_provider_resources read failed: ${resErr.message}`)
  const rows = (resources ?? []) as OrgAgents['resources']
  const external: Record<VoiceProvider, Set<string>> = { elevenlabs: new Set(), cartesia: new Set() }
  for (const r of rows) if (r.external_id && (r.provider === 'elevenlabs' || r.provider === 'cartesia')) external[r.provider].add(r.external_id)
  for (const a of agents ?? []) if (a.elevenlabs_agent_id) external.elevenlabs.add(a.elevenlabs_agent_id as string)
  return {
    localIds: (agents ?? []).map((a) => a.id as string),
    external: { elevenlabs: [...external.elevenlabs], cartesia: [...external.cartesia] },
    resources: rows,
  }
}

/** Whether an external agent belongs to this organization (see the header). Throws on provider errors other than 404. */
export async function verifyAgent(ctx: StepContext, provider: VoiceProvider, externalId: string, localIds: readonly string[]): Promise<AgentCursor['verdict']> {
  try {
    if (provider === 'elevenlabs') {
      const agent = await el.agents.get(externalId, { orgId: ctx.orgId })
      const tags = agent.tags ?? []
      const env = tags.find((t) => t.startsWith('ntv-env:'))
      const org = tags.find((t) => t.startsWith('ntv-org:'))
      const local = tags.find((t) => t.startsWith('ntv-agent:'))
      // Another deployment's agent (a database copied between environments): never touched.
      if (env && env !== envTag()) return 'foreign'
      if (org && org !== `ntv-org:${ctx.orgId}`) return 'foreign'
      if (local && !localIds.includes(local.slice('ntv-agent:'.length))) return 'foreign'
      return 'ours'
    }
    const agent = await ct.agents.get(externalId, { orgId: ctx.orgId })
    const m = CARTESIA_MARKER.exec(agent.description ?? '')
    if (m && !localIds.includes(m[1].toLowerCase()) && !localIds.includes(m[1])) return 'foreign'
    return 'ours'
  } catch (err) {
    if (isGone(err)) return 'gone'
    throw err
  }
}

/** The verdicts recorded in the job state (provider key → external id → cursor). */
export function agentCursors(ctx: StepContext, provider: VoiceProvider): Record<string, AgentCursor> {
  const key = provider === 'elevenlabs' ? 'el_agents' : 'ct_agents'
  ctx.state[key] ??= {}
  return ctx.state[key] as Record<string, AgentCursor>
}

/** Verifies every external agent not verified yet; providers without a key are skipped (reported). */
export async function verifyOrgAgents(ctx: StepContext, agents: OrgAgents): Promise<{ notConfigured: number }> {
  let notConfigured = 0
  for (const provider of ['elevenlabs', 'cartesia'] as const) {
    const cursors = agentCursors(ctx, provider)
    for (const id of agents.external[provider]) {
      if (cursors[id]) continue
      if (!providerConfigured(provider)) {
        notConfigured++
        continue
      }
      try {
        cursors[id] = { verdict: await verifyAgent(ctx, provider, id, agents.localIds) }
      } catch (err) {
        if (isNotConfigured(err)) {
          notConfigured++
          continue
        }
        throw err
      }
      if (cursors[id].verdict === 'foreign') ctx.log.error('account_deletion.foreign_agent_skipped', undefined, { provider })
    }
  }
  return { notConfigured }
}

/**
 * delete_agents: the ElevenLabs and Cartesia agents (after their call records
 * were collected). A resource row is removed only after the provider
 * confirmed (or answered 404), so a failure is retried.
 */
export async function deleteAgents(ctx: StepContext): Promise<StepOutcome> {
  const agents = await loadOrgAgents(ctx)
  const verify = await verifyOrgAgents(ctx, agents)
  const counts = { deleted: 0, already_gone: 0, foreign_skipped: 0, not_configured: verify.notConfigured, failed: 0 }
  const handled = new Set<string>()

  const deleteRemote = async (provider: VoiceProvider, externalId: string): Promise<boolean> => {
    const verdict = agentCursors(ctx, provider)[externalId]?.verdict
    if (verdict === 'foreign') {
      counts.foreign_skipped++
      return true
    }
    if (verdict === 'gone') {
      counts.already_gone++
      return true
    }
    if (!providerConfigured(provider)) return true // counted by verifyOrgAgents
    try {
      if (provider === 'elevenlabs') await el.agents.delete(externalId, { orgId: ctx.orgId })
      else await ct.agents.delete(externalId, { orgId: ctx.orgId })
      counts.deleted++
      return true
    } catch (err) {
      if (isGone(err)) {
        counts.already_gone++
        return true
      }
      counts.failed++
      ctx.log.error('account_deletion.agent_delete_failed', err, { provider })
      return false
    }
  }

  for (const r of agents.resources) {
    const ok = r.external_id ? await deleteRemote(r.provider, r.external_id) : true
    if (r.external_id) handled.add(`${r.provider}:${r.external_id}`)
    if (!ok) continue
    const { error } = await ctx.db.from('agent_provider_resources').delete().eq('id', r.id).eq('org_id', ctx.orgId)
    if (error) throw new Error(`agent_provider_resources delete failed: ${error.message}`)
  }
  // Legacy column only (created before resources were tracked).
  for (const id of agents.external.elevenlabs) {
    if (handled.has(`elevenlabs:${id}`)) continue
    if (!(await deleteRemote('elevenlabs', id))) continue
    const { error } = await ctx.db.from('agents').update({ elevenlabs_agent_id: null }).eq('org_id', ctx.orgId).eq('elevenlabs_agent_id', id)
    if (error) throw new Error(`agents update failed: ${error.message}`)
  }
  // Conversation-sweep watermarks of these agents (slice D, keyed by local agent id) are no longer needed.
  const sweepKeys = agents.localIds.map((id) => `conversation_sweep:${id}`)
  if (sweepKeys.length) {
    const { error } = await ctx.db.from('maintenance_state').delete().in('key', sweepKeys)
    if (error) ctx.log.warn('account_deletion.sweep_state_cleanup_failed', { message: error.message.slice(0, 120) })
  }
  if (counts.failed) throw new Error(`${counts.failed} agent(s) could not be deleted at the provider`)
  return { status: 'done', counts }
}
