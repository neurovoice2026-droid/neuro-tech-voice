import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// A managed Cartesia agent only gets the search_knowledge tool while its agent
// has at least one ready document. The provider agents are re-synced when that
// flips: the first document becomes ready, or the last ready one goes away.
// Later documents don't change the tool list, so they don't trigger a sync.

async function readyDocumentCount(admin: SupabaseClient, orgId: string, agentId: string): Promise<number | null> {
  const { count, error } = await admin
    .from('knowledge_documents')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('agent_id', agentId)
    .eq('status', 'ready')
    .gt('chunk_count', 0)
  if (error) {
    console.error('[knowledge] ready document count failed', error.code, error.message)
    return null
  }
  return count ?? 0
}

/** Never throws: a failed check leaves the agent to the daily resync. */
export async function resyncAgentIfKnowledgeFlipped(
  admin: SupabaseClient,
  doc: { org_id: string; agent_id: string },
  change: 'became_ready' | 'removed_ready'
): Promise<void> {
  try {
    const count = await readyDocumentCount(admin, doc.org_id, doc.agent_id)
    if (count === null) return
    const flipped = change === 'became_ready' ? count === 1 : count === 0
    if (!flipped) return
    const { resyncOrgAgentsAfterResponse } = await import('@/lib/voice/sync')
    await resyncOrgAgentsAfterResponse(doc.org_id, change === 'became_ready' ? 'the first ready document' : 'removing the last ready document')
  } catch (error) {
    console.error('[knowledge] agent resync after a knowledge change failed', error instanceof Error ? error.message : error)
  }
}
