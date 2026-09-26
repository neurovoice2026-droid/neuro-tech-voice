import 'server-only'
import { getOrgAgent, type OrgContext } from '@/lib/api/auth'
import { syncAgentAfterResponse } from '@/lib/voice/sync'

/**
 * Organisation-level settings (business name, time zone, services, team
 * contacts) are baked into the agent's configuration at the voice providers.
 * Marks the agent's providers pending and pushes the change after the
 * response; the outcome is recorded on agents.provider_sync and shown on the
 * agent page. A failure here never fails the save that triggered it.
 */
export async function resyncOrgAgentAfterResponse(ctx: OrgContext, reason: string): Promise<void> {
  try {
    const agent = await getOrgAgent(ctx)
    if (agent) await syncAgentAfterResponse(agent)
  } catch (err) {
    console.error(`[settings] agent resync after ${reason} failed`, err instanceof Error ? err.message : err)
  }
}
