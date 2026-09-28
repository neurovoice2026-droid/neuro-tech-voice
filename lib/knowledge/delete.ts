import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { KnowledgeDocument } from '@/types'
import { KNOWLEDGE_DOCUMENT_COLUMNS, loadDocument, requireKnowledgeAdmin, withDocumentDefaults } from './documents'
import { removeDocumentFromProviders } from './providers'
import { resyncAgentIfKnowledgeFlipped } from './readiness'
import { invalidateKnowledgeCache } from './search'
import { KNOWLEDGE_BUCKET } from './shared'

// Removing a document removes every copy: provider documents (Cartesia,
// ElevenLabs), the row (chunks cascade with it) and the stored file plus its
// extracted text. Provider or storage problems are logged and reported as
// warnings; the document is still deleted locally so the agent stops using it.

const AGENT_DELETE_CONCURRENCY = 5

async function removeStoredObjects(admin: SupabaseClient, doc: KnowledgeDocument): Promise<boolean> {
  const paths = [doc.storage_path, doc.extracted_text_path].filter((p): p is string => !!p)
  if (paths.length === 0) return true
  const { error } = await admin.storage.from(KNOWLEDGE_BUCKET).remove(paths)
  if (error) {
    console.error('[knowledge] storage cleanup failed', { documentId: doc.id, message: error.message })
    return false
  }
  return true
}

async function deleteLoadedDocument(admin: SupabaseClient, doc: KnowledgeDocument): Promise<string[]> {
  const warnings = await removeDocumentFromProviders(doc)

  const { error } = await admin.from('knowledge_documents').delete().eq('id', doc.id).eq('org_id', doc.org_id)
  if (error) {
    console.error('[knowledge] document delete failed', { documentId: doc.id, code: error.code, message: error.message })
    throw new Error('Knowledge document delete failed')
  }
  if (!(await removeStoredObjects(admin, doc))) warnings.push('storage')
  await invalidateKnowledgeCache(doc.agent_id)
  return warnings
}

/** A single document removed from the dashboard (not account deletion, where the agents go too). */
async function deleteDocumentAndResync(admin: SupabaseClient, doc: KnowledgeDocument): Promise<string[]> {
  const warnings = await deleteLoadedDocument(admin, doc)
  if (doc.status === 'ready' && doc.chunk_count > 0) await resyncAgentIfKnowledgeFlipped(admin, doc, 'removed_ready')
  return warnings
}

export async function deleteKnowledgeDocument(input: {
  orgId: string
  documentId: string
}): Promise<{ deleted: boolean; warnings: string[] }> {
  const admin = requireKnowledgeAdmin()
  const doc = await loadDocument(admin, input.orgId, input.documentId)
  if (!doc) return { deleted: false, warnings: [] }
  return { deleted: true, warnings: await deleteDocumentAndResync(admin, doc) }
}

/**
 * Every document of an agent, provider copies included. For account or agent
 * deletion, where the database cascade alone would leave provider copies and
 * stored files behind.
 */
export async function deleteAgentKnowledge(orgId: string, agentId: string): Promise<{ deleted: number; warnings: string[] }> {
  const admin = requireKnowledgeAdmin()
  const { data, error } = await admin
    .from('knowledge_documents')
    .select(KNOWLEDGE_DOCUMENT_COLUMNS)
    .eq('org_id', orgId)
    .eq('agent_id', agentId)
  if (error) {
    console.error('[knowledge] agent documents lookup failed', error.code, error.message)
    throw new Error('Knowledge documents lookup failed')
  }
  const warnings = new Set<string>()
  let deleted = 0
  const docs = ((data ?? []) as unknown as Record<string, unknown>[]).map(withDocumentDefaults)
  // A few at a time: up to 100 documents, each with provider copies to delete.
  for (let i = 0; i < docs.length; i += AGENT_DELETE_CONCURRENCY) {
    const batch = await Promise.all(docs.slice(i, i + AGENT_DELETE_CONCURRENCY).map((doc) => deleteLoadedDocument(admin, doc)))
    for (const docWarnings of batch) docWarnings.forEach((warning) => warnings.add(warning))
    deleted += batch.length
  }

  // Anything left in the agent's folder (extracted text of failed uploads, abandoned uploads).
  const prefix = `${orgId}/${agentId}`
  for (const folder of [prefix, `${prefix}/extracted`]) {
    const { data: objects, error: listError } = await admin.storage.from(KNOWLEDGE_BUCKET).list(folder, { limit: 1000 })
    if (listError) {
      console.error('[knowledge] storage listing failed', { agentId, message: listError.message })
      warnings.add('storage')
      continue
    }
    const files = (objects ?? []).filter((object) => object.id !== null).map((object) => `${folder}/${object.name}`)
    if (files.length === 0) continue
    const { error: removeError } = await admin.storage.from(KNOWLEDGE_BUCKET).remove(files)
    if (removeError) {
      console.error('[knowledge] storage cleanup failed', { agentId, message: removeError.message })
      warnings.add('storage')
    }
  }
  return { deleted, warnings: [...warnings] }
}
