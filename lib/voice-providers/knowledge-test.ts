import 'server-only'
// "Test your knowledge base": runs the organization's own ElevenLabs agent's
// exact RAG retrieval for a question (POST /agents/{id}/knowledge-base/
// rag-query, no conversation, no call) and shows which passages it would use.
//
// Isolation: the external agent id comes from agent_provider_resources for the
// authorized org (never from the browser), and every returned chunk is checked
// against the org's own documents and website folders before it is shown —
// chunks of anything else are dropped (defence in depth: the workspace is
// shared by every tenant).

import type { SupabaseClient } from '@supabase/supabase-js'
import * as kb from '@/lib/elevenlabs/api/knowledge'
import { RequestError } from '@/lib/api/http'
import type { Logger } from '@/lib/observability/logger'
import { toPlainText } from './knowledge'

export const TEST_QUERY_MAX_CHARS = 500
const MAX_CHUNKS = 8
const MAX_CHUNK_CHARS = 1_200

export interface TestChunk {
  /** Our document id for documents; null for pages of an imported website. */
  document_id: string | null
  document_name: string
  source: 'document' | 'website'
  source_url: string | null
  text: string
  /** Smaller is closer; null when the retrieval strategy does not expose it. */
  distance: number | null
}

export interface TestResult {
  chunks: TestChunk[]
  /** Chunks dropped because they did not belong to this organization. */
  dropped: number
}

function cleanText(raw: unknown): string {
  const text = toPlainText(typeof raw === 'string' ? raw : '')
  return text.length > MAX_CHUNK_CHARS ? `${text.slice(0, MAX_CHUNK_CHARS - 1)}…` : text
}

function httpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !URL.canParse(raw)) return null
  const u = new URL(raw)
  return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
}

/**
 * @param supabase user-scoped client (RLS) of the authorized org
 */
export async function testKnowledge(supabase: SupabaseClient, orgId: string, query: string, log: Logger): Promise<TestResult> {
  const { data: resource, error: resErr } = await supabase
    .from('agent_provider_resources')
    .select('agent_id, external_id, status')
    .eq('org_id', orgId)
    .eq('provider', 'elevenlabs')
    .not('external_id', 'is', null)
    .maybeSingle()
  if (resErr) throw new Error(`agent_provider_resources read failed: ${resErr.message}`)
  if (!resource?.external_id || !['ready', 'degraded'].includes(String(resource.status))) {
    throw new RequestError('conflict', 'Your agent is not set up with the voice provider yet. Save your agent and try again.', 409)
  }
  const agentId = resource.agent_id as string

  const [{ data: docs, error: docErr }, { data: crawls, error: crawlErr }] = await Promise.all([
    supabase.from('knowledge_documents').select('id, name, elevenlabs_doc_id, url').eq('org_id', orgId).not('elevenlabs_doc_id', 'is', null).is('deleting_at', null),
    supabase.from('knowledge_crawls').select('host, root_folder_id').eq('org_id', orgId).eq('status', 'succeeded').not('root_folder_id', 'is', null),
  ])
  if (docErr) throw new Error(`knowledge_documents read failed: ${docErr.message}`)
  if (crawlErr) throw new Error(`knowledge_crawls read failed: ${crawlErr.message}`)
  if (!(docs ?? []).length && !(crawls ?? []).length) {
    throw new RequestError('conflict', 'Add a document or import your website first.', 409)
  }

  const res = await kb.ragQuery(resource.external_id as string, { query, use_agent_defaults: true }, { orgId, agentId })
  const raw = Array.isArray(res?.chunks) ? res.chunks : []

  const ownDocs = new Map((docs ?? []).map((d) => [d.elevenlabs_doc_id as string, d]))
  const websiteFolders = new Map((crawls ?? []).map((c) => [c.root_folder_id as string, String(c.host)]))
  // Pages of imported websites have no rows: confirm they sit inside one of the org's website folders.
  const unknownIds = [...new Set(raw.map((c) => c?.document_id).filter((id): id is string => typeof id === 'string' && !!id && !ownDocs.has(id)))]
  const pageHost = new Map<string, string>()
  if (unknownIds.length && websiteFolders.size) {
    const summaries = await kb.summaries(unknownIds.slice(0, 100), { orgId, agentId })
    for (const id of unknownIds) {
      const s = summaries[id]
      if (s?.status !== 'success') continue
      const ancestors = [...(s.data.folder_path ?? []).map((p) => p.id), s.data.folder_parent_id ?? '']
      const root = ancestors.find((a) => websiteFolders.has(a))
      if (root) pageHost.set(id, websiteFolders.get(root) as string)
    }
  }

  const chunks: TestChunk[] = []
  let dropped = 0
  for (const c of raw) {
    if (chunks.length >= MAX_CHUNKS) break
    const id = typeof c?.document_id === 'string' ? c.document_id : ''
    const distance = typeof c?.vector_distance === 'number' && Number.isFinite(c.vector_distance) ? Math.round(c.vector_distance * 1000) / 1000 : null
    const own = ownDocs.get(id)
    if (own) {
      chunks.push({
        document_id: own.id as string,
        document_name: String(own.name),
        source: 'document',
        source_url: httpUrl(own.url),
        text: cleanText(c.text),
        distance,
      })
      continue
    }
    const host = pageHost.get(id)
    if (host) {
      chunks.push({
        document_id: null,
        document_name: typeof c.document_name === 'string' && c.document_name.trim() ? c.document_name.trim().slice(0, 200) : `Website ${host}`,
        source: 'website',
        source_url: httpUrl(c.source_url),
        text: cleanText(c.text),
        distance,
      })
      continue
    }
    dropped++
  }
  if (dropped) log.warn('knowledge.test_foreign_chunks_dropped', { dropped })
  log.info('knowledge.tested', { chunks: chunks.length, queryChars: query.length })
  return { chunks, dropped }
}
