import 'server-only'
// Knowledge copies of an ORPHAN ElevenLabs agent (its local agent and
// organization rows are gone: knowledge_documents cascaded away with them).
// Called by the admin reconcile before it deletes the orphan agent, so the
// documents do not stay in the shared workspace for good.
//
// Only the agent's own knowledge_base locators are considered, and an id is
// deleted only when NO row of ours (any organization) still references it as
// a document, a website-import folder or an organization folder: a document
// still used by a live agent is never touched. Never throws.

import * as el from '@/lib/elevenlabs/client'
import * as kb from '@/lib/elevenlabs/api/knowledge'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Logger } from '@/lib/observability/logger'
import { isProviderError } from '@/lib/voice-providers/errors'

const KB_ID = /^[A-Za-z0-9_-]{1,128}$/

export interface OrphanKnowledgeReport {
  found: number
  deleted: number
  kept: number
  failed: number
}

async function referencedIds(ids: string[]): Promise<Set<string>> {
  const db = createAdminClient()
  const [docs, crawls, folders] = await Promise.all([
    db.from('knowledge_documents').select('elevenlabs_doc_id').in('elevenlabs_doc_id', ids),
    db.from('knowledge_crawls').select('root_folder_id').in('root_folder_id', ids),
    db.from('knowledge_folders').select('folder_id').in('folder_id', ids),
  ])
  for (const r of [docs, crawls, folders]) if (r.error) throw new Error(`knowledge reference read failed: ${r.error.message}`)
  const out = new Set<string>()
  for (const r of docs.data ?? []) if (r.elevenlabs_doc_id) out.add(r.elevenlabs_doc_id as string)
  for (const r of crawls.data ?? []) if (r.root_folder_id) out.add(r.root_folder_id as string)
  for (const r of folders.data ?? []) if (r.folder_id) out.add(r.folder_id as string)
  return out
}

export async function deleteOrphanAgentKnowledge(externalAgentId: string, log: Logger): Promise<OrphanKnowledgeReport> {
  const report: OrphanKnowledgeReport = { found: 0, deleted: 0, kept: 0, failed: 0 }
  try {
    const agent = await el.agents.get(externalAgentId)
    const locators = agent.conversation_config?.agent?.prompt?.knowledge_base ?? []
    const ids = [...new Set(locators.map((l) => l.id).filter((id): id is string => typeof id === 'string' && KB_ID.test(id)))]
    report.found = ids.length
    if (!ids.length) return report
    const referenced = await referencedIds(ids)
    const orphaned = ids.filter((id) => !referenced.has(id))
    report.kept = ids.length - orphaned.length
    if (!orphaned.length) return report
    const results = await kb.bulkDelete(orphaned, true)
    for (const id of orphaned) {
      const r = results[id]
      if (r?.status === 'success' || kb.isMissing(r)) report.deleted++
      else report.failed++
    }
  } catch (err) {
    // The agent is already gone: nothing left to read its documents from.
    if (isProviderError(err) && err.code === 'not_found') return report
    report.failed++
    log.error('reconcile.orphan_knowledge_failed', err, { externalAgentId })
  }
  if (report.found) log.warn('reconcile.orphan_knowledge', { externalAgentId, ...report })
  return report
}
