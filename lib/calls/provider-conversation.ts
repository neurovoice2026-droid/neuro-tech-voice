import 'server-only'
// Server-side resolution of an org's ElevenLabs agent and of the provider
// conversation behind one of its calls. Every id comes from OUR rows, scoped
// by the org resolved from the signed-in user, never from the browser; a
// conversation is used only when its agent_id is the org's own agent (all
// tenants share one ElevenLabs workspace).

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { findConversationsByCallId } from '@/lib/elevenlabs/api/conversations'

/** The org's ElevenLabs agent id for `agentId` (null when not synced or not the org's). */
export async function orgElevenLabsAgentId(orgId: string, agentId: string | null, db: SupabaseClient = createAdminClient()): Promise<string | null> {
  if (!agentId) return null
  const { data, error } = await db
    .from('agent_provider_resources')
    .select('external_id')
    .eq('org_id', orgId)
    .eq('agent_id', agentId)
    .eq('provider', 'elevenlabs')
    .maybeSingle()
  if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
  return (data?.external_id as string | undefined) ?? null
}

/** The org's (single) ElevenLabs agent, for org-level views (topics, live count). */
export async function orgPrimaryElevenLabsAgentId(orgId: string, db: SupabaseClient = createAdminClient()): Promise<string | null> {
  const { data, error } = await db
    .from('agent_provider_resources')
    .select('external_id')
    .eq('org_id', orgId)
    .eq('provider', 'elevenlabs')
    .not('external_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`agent_provider_resources read failed: ${error.message}`)
  return (data?.external_id as string | undefined) ?? null
}

/**
 * Conversation ids of a call that has none stored (app-routed calls never get
 * the id from register-call; a lost webhook leaves it empty): the org's own
 * agent, filtered on ntv_call_id = calls.id, each confirmed through GET.
 */
export async function lookupCallConversationIds(
  call: { id: string; org_id: string; agent_id: string | null; started_at: string | null; created_at: string },
  db: SupabaseClient = createAdminClient(),
): Promise<string[]> {
  const agent = await orgElevenLabsAgentId(call.org_id, call.agent_id, db)
  if (!agent) return []
  const startS = Math.floor(Date.parse(call.started_at ?? call.created_at) / 1000)
  const found = await findConversationsByCallId(agent, call.id, {
    callStartAfterUnix: Number.isFinite(startS) ? startS - 3600 : undefined,
    ctx: { orgId: call.org_id, callId: call.id },
  })
  return found.map((c) => c.conversation_id)
}
