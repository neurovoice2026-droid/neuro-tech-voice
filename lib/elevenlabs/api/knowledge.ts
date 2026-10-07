import 'server-only'
// ElevenLabs knowledge-base endpoints beyond the basic create/delete in
// lib/elevenlabs/client.ts: summaries, edits, refresh, folders, bulk delete
// and move, website crawls, RAG indexes and the agent's RAG query.
// Field names, enums and limits verified against the official OpenAPI spec
// (2026-10). Everything here acts on ids the caller resolved server-side from
// the organization's own rows: the workspace is shared by every tenant, so no
// function proxies a workspace-wide listing to a tenant.

import { NO_RETRY } from '@/lib/voice-providers/http'
import { req, T, type Ctx } from '../client'
import { readTextPrefix } from './body'

const KB = '/v1/convai/knowledge-base'
const enc = encodeURIComponent

/** Spec limits (maxItems) per batch endpoint. */
export const KB_LIMITS = {
  summariesPerCall: 100,
  ragBatchPerCall: 100,
  bulkDeletePerCall: 20,
  bulkMovePerCall: 20,
  listPageSize: 100,
} as const

export type EmbeddingModel = 'e5_mistral_7b_instruct' | 'multilingual_e5_large_instruct'
export const EMBEDDING_MODELS: readonly EmbeddingModel[] = ['e5_mistral_7b_instruct', 'multilingual_e5_large_instruct']

export type RagIndexStatus =
  | 'new'
  | 'created'
  | 'processing'
  | 'failed'
  | 'succeeded'
  | 'rag_limit_exceeded'
  | 'document_too_small'
  | 'cannot_index_folder'
export const RAG_INDEX_STATUSES: readonly RagIndexStatus[] = [
  'new',
  'created',
  'processing',
  'failed',
  'succeeded',
  'rag_limit_exceeded',
  'document_too_small',
  'cannot_index_folder',
]

export type DocumentUsageMode = 'prompt' | 'auto'
export type KnowledgeDocumentType = 'file' | 'url' | 'text' | 'folder'

export interface AutoSyncInfo {
  minimum_frequency_days?: number
  auto_remove?: boolean
  auto_discover?: boolean
  consec_failures?: number
  next_refresh_by?: number | null
}

/** GetKnowledgeBaseSummary{URL,File,Text,Folder}ResponseModel (deprecated dependent_agents is never read). */
export interface KnowledgeSummary {
  id: string
  name: string
  type: string
  metadata: { created_at_unix_secs: number; last_updated_at_unix_secs: number; size_bytes: number }
  supported_usages: DocumentUsageMode[]
  folder_parent_id?: string | null
  folder_path?: Array<{ id: string; name?: string | null }>
  url?: string
  auto_sync_info?: AutoSyncInfo | null
  children_count?: number
  document_count?: number
}

/** GetKnowledgeBase{URL,File,Text}ResponseModel: a summary plus the full extracted content. */
export interface KnowledgeDocumentFull extends KnowledgeSummary {
  extracted_inner_html?: string
  content_format?: 'html' | 'markdown'
  filename?: string
}

export interface BatchFailure {
  status: 'failure'
  error_code: number
  error_status: string
  error_message: string
}
export type BatchResult<D> = { status: 'success'; data: D } | BatchFailure

export interface RagDocumentIndex {
  id: string
  model: EmbeddingModel
  status: RagIndexStatus
  progress_percentage: number
  document_model_index_usage: { used_bytes: number }
}

export interface RagIndexOverview {
  total_used_bytes: number
  total_max_bytes: number
  models: Array<{ model: EmbeddingModel; used_bytes: number }>
}

export type CrawlStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'skipped' | 'cancelled'
export const CRAWL_STATUSES: readonly CrawlStatus[] = ['queued', 'processing', 'succeeded', 'failed', 'skipped', 'cancelled']

/** CreateCrawlJobResponseModel (status is a free string in the spec). */
export interface CrawlJobCreated {
  id: string
  type: 'discovery' | 'sitemap'
  root_folder_id: string
  status: string
  created_at: number
}

/** GetCrawlJobResponseModel */
export interface CrawlJob {
  id: string
  seed_url: string
  max_pages: number
  status?: CrawlStatus
  pages_identified?: number
  pages_scraped?: number
  pages_skipped?: number
  pages_failed?: number
  root_folder_id: string
  updated_at: number
  created_at: number
}

export interface CreateCrawlParams {
  url: string
  max_pages: number
  /** Syntax undocumented in the spec; validated in staging (see docs/elevenlabs/E.md). */
  pattern?: string | null
  parent_folder_id?: string | null
  enable_auto_sync: boolean
  /** Always false: a temporarily unreachable page must not delete documents behind our back. */
  auto_remove: false
  auto_discover: boolean
  minimum_frequency_days?: number | null
}

export interface RagQueryChunk {
  document_id: string
  document_name: string
  source_url: string | null
  chunk_id: string
  text: string
  vector_distance: number | null
  content_format: 'html' | 'markdown'
  document_type: KnowledgeDocumentType
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** De-duplicated, non-empty ids (the batch endpoints reject duplicates and blanks). */
function cleanIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))]
}

// ─── Documents ───────────────────────────────────────────────────────────────

/**
 * GET /summaries for any number of ids, 100 per call (spec maxItems). Light
 * metadata only (no extracted content): existence checks, sizes, supported
 * usages and auto-sync state. Per-id results: success, or a failure whose
 * error_code 404 means the document no longer exists.
 */
export async function summaries(ids: readonly string[], ctx?: Ctx): Promise<Record<string, BatchResult<KnowledgeSummary>>> {
  const out: Record<string, BatchResult<KnowledgeSummary>> = {}
  for (const part of chunk(cleanIds(ids), KB_LIMITS.summariesPerCall)) {
    const res = await req<Record<string, BatchResult<KnowledgeSummary>>>('kb.summaries', `${KB}/summaries`, {
      query: { document_ids: part },
      ctx,
    })
    Object.assign(out, res ?? {})
  }
  return out
}

/** True for a per-id batch failure that says the document does not exist. */
export function isMissing(result: BatchResult<unknown> | undefined): boolean {
  return !!result && result.status === 'failure' && Number(result.error_code) === 404
}

/**
 * PATCH /{id}: rename and/or replace the content. Content edits work for text
 * and file documents and URL documents without auto-sync. Re-sending the same
 * edit is harmless, so it may be retried.
 */
export function updateDocument(id: string, patch: { name?: string; content?: string }, ctx?: Ctx) {
  return req<KnowledgeDocumentFull>('kb.update', `${KB}/${enc(id)}`, { method: 'PATCH', body: patch, idempotent: true, timeoutMs: T.upload, ctx })
}

/** PATCH /{id}/update-file (multipart): swaps the source file, keeping the id and agent attachments. */
export function updateFile(id: string, file: Blob, filename: string, ctx?: Ctx) {
  const form = new FormData()
  form.append('file', file, filename)
  return req<KnowledgeDocumentFull>('kb.update_file', `${KB}/${enc(id)}/update-file`, {
    method: 'PATCH',
    body: form,
    timeoutMs: T.upload,
    retry: NO_RETRY,
    ctx,
  })
}

/** POST /{id}/refresh: re-fetches a URL document now (same id; re-indexed for RAG). */
export function refreshUrlDocument(id: string, ctx?: Ctx) {
  return req<KnowledgeDocumentFull>('kb.refresh', `${KB}/${enc(id)}/refresh`, { method: 'POST', timeoutMs: T.upload, retry: NO_RETRY, ctx })
}

/** GET /knowledge-base filtered to one folder (direct children or the whole subtree). */
export function listDocuments(
  params: {
    parent_folder_id?: string
    ancestor_folder_id?: string
    types?: KnowledgeDocumentType[]
    search?: string
    cursor?: string | null
    page_size?: number
  },
  ctx?: Ctx,
) {
  return req<{ documents: KnowledgeSummary[]; next_cursor?: string | null; has_more: boolean }>('kb.list', KB, {
    query: {
      parent_folder_id: params.parent_folder_id,
      ancestor_folder_id: params.ancestor_folder_id,
      types: params.types,
      search: params.search,
      cursor: params.cursor ?? undefined,
      page_size: Math.min(params.page_size ?? KB_LIMITS.listPageSize, KB_LIMITS.listPageSize),
    },
    ctx,
  })
}

/**
 * Every document under a folder (paginated), up to maxItems. Only ever called
 * with a folder id read from the organization's own rows.
 */
export async function listFolderDocuments(
  folderId: string,
  opts: { types?: KnowledgeDocumentType[]; maxItems: number },
  ctx?: Ctx,
): Promise<{ documents: KnowledgeSummary[]; complete: boolean }> {
  const documents: KnowledgeSummary[] = []
  let cursor: string | null = null
  for (let page = 0; page < 50; page++) {
    const res = await listDocuments({ ancestor_folder_id: folderId, types: opts.types, cursor }, ctx)
    documents.push(...(res?.documents ?? []))
    cursor = res?.next_cursor ?? null
    if (!res?.has_more || !cursor) return { documents, complete: true }
    if (documents.length >= opts.maxItems) return { documents: documents.slice(0, opts.maxItems), complete: false }
  }
  return { documents, complete: false }
}

// ─── Folders ─────────────────────────────────────────────────────────────────

/** POST /folder. Never retried: a retry after a late success would create a second folder. */
export function createFolder(params: { name: string; parent_folder_id?: string | null }, ctx?: Ctx) {
  return req<{ id: string; name: string }>('kb.create_folder', `${KB}/folder`, { method: 'POST', body: params, retry: NO_RETRY, ctx })
}

/** POST /bulk-move, 20 ids per call (spec maxItems). Moving twice is harmless. */
export async function bulkMove(ids: readonly string[], moveTo: string, ctx?: Ctx): Promise<void> {
  for (const part of chunk(cleanIds(ids), KB_LIMITS.bulkMovePerCall)) {
    await req<unknown>('kb.bulk_move', `${KB}/bulk-move`, {
      method: 'POST',
      body: { document_ids: part, move_to: moveTo },
      idempotent: true,
      responseKind: 'none',
      ctx,
    })
  }
}

/** POST /{id}/move (one entity). */
export function moveDocument(id: string, moveTo: string, ctx?: Ctx) {
  return req<unknown>('kb.move', `${KB}/${enc(id)}/move`, { method: 'POST', body: { move_to: moveTo }, idempotent: true, responseKind: 'none', ctx })
}

/**
 * POST /bulk-delete, 20 ids per call (spec maxItems). force=true also detaches
 * documents from agents and deletes folder subtrees. Per-id results; a 404
 * failure means the entity is already gone. Re-deleting is harmless.
 */
export async function bulkDelete(ids: readonly string[], force: boolean, ctx?: Ctx): Promise<Record<string, BatchResult<{ id: string }>>> {
  const out: Record<string, BatchResult<{ id: string }>> = {}
  for (const part of chunk(cleanIds(ids), KB_LIMITS.bulkDeletePerCall)) {
    const res = await req<Record<string, BatchResult<{ id: string }>>>('kb.bulk_delete', `${KB}/bulk-delete`, {
      method: 'POST',
      body: { document_ids: part, force },
      idempotent: true,
      ctx,
    })
    Object.assign(out, res ?? {})
  }
  return out
}

/** DELETE /{id}?force= (documents and folders; force deletes a folder's subtree). */
export function deleteEntity(id: string, force: boolean, ctx?: Ctx) {
  return req<void>('kb.delete', `${KB}/${enc(id)}`, { method: 'DELETE', query: { force }, responseKind: 'none', ctx })
}

// ─── Content ─────────────────────────────────────────────────────────────────

/**
 * GET /{id}/content, bounded: at most maxBytes are read (the endpoint returns
 * the whole document), under a separate body deadline. One attempt only: the
 * excerpt it feeds is best-effort and rebuilt on the next refresh, and
 * maintenance must stay within its time budget.
 */
export async function contentPrefix(id: string, opts: { maxBytes: number; bodyTimeoutMs?: number }, ctx?: Ctx) {
  const res = await req<Response>('kb.content', `${KB}/${enc(id)}/content`, { responseKind: 'response', timeoutMs: 30_000, retry: NO_RETRY, ctx })
  return readTextPrefix(res, { maxBytes: opts.maxBytes, timeoutMs: opts.bodyTimeoutMs ?? 20_000, system: 'elevenlabs', operation: 'kb.content' })
}

// ─── RAG indexes ─────────────────────────────────────────────────────────────

/** POST /{id}/rag-index: starts indexing when missing, otherwise returns the current status. */
export function ragIndex(id: string, model: EmbeddingModel, ctx?: Ctx) {
  return req<RagDocumentIndex>('kb.rag_index', `${KB}/${enc(id)}/rag-index`, { method: 'POST', body: { model }, idempotent: true, ctx })
}

/**
 * POST /rag-index (batch, 100 items per call). create_if_missing=false only
 * reads; true starts indexing for documents that have no index for the model.
 */
export async function ragIndexBatch(
  items: ReadonlyArray<{ document_id: string; model: EmbeddingModel; create_if_missing: boolean }>,
  ctx?: Ctx,
  /** `fast`: one short attempt, for reads made while a dashboard request waits. */
  opts: { fast?: boolean } = {},
): Promise<Record<string, BatchResult<RagDocumentIndex>>> {
  const seen = new Set<string>()
  const unique = items.filter((i) => i.document_id && !seen.has(i.document_id) && seen.add(i.document_id))
  const out: Record<string, BatchResult<RagDocumentIndex>> = {}
  for (const part of chunk(unique, KB_LIMITS.ragBatchPerCall)) {
    const res = await req<Record<string, BatchResult<RagDocumentIndex>>>('kb.rag_index_batch', `${KB}/rag-index`, {
      method: 'POST',
      body: { items: part },
      idempotent: true,
      ...(opts.fast ? { timeoutMs: 5_000, retry: NO_RETRY } : {}),
      ctx,
    })
    Object.assign(out, res ?? {})
  }
  return out
}

/** GET /{id}/rag-index: every index of the document (one per embedding model). */
export function ragIndexes(id: string, ctx?: Ctx) {
  return req<{ indexes: RagDocumentIndex[] }>('kb.rag_indexes', `${KB}/${enc(id)}/rag-index`, { ctx })
}

/** DELETE /{id}/rag-index/{rag_index_id}: frees the quota an index uses. */
export function deleteRagIndex(id: string, ragIndexId: string, ctx?: Ctx) {
  return req<RagDocumentIndex>('kb.rag_index_delete', `${KB}/${enc(id)}/rag-index/${enc(ragIndexId)}`, { method: 'DELETE', ctx })
}

/** GET /rag-index: workspace-wide RAG usage vs the plan limit. Platform diagnostics only, never shown to tenants. */
export function ragOverview() {
  return req<RagIndexOverview>('kb.rag_overview', `${KB}/rag-index`)
}

// ─── Website crawls ──────────────────────────────────────────────────────────

/**
 * POST /crawl. Never retried (a duplicate job would crawl twice). The
 * deprecated max_depth is never sent.
 */
export function createCrawl(params: CreateCrawlParams, ctx?: Ctx) {
  return req<CrawlJobCreated>('kb.crawl_create', `${KB}/crawl`, { method: 'POST', body: params, retry: NO_RETRY, timeoutMs: T.write, ctx })
}

/** GET /crawl/{id}: only with a job id read from the organization's own row. */
export function getCrawl(jobId: string, ctx?: Ctx) {
  return req<CrawlJob>('kb.crawl_get', `${KB}/crawl/${enc(jobId)}`, { ctx })
}

/** POST /crawl/{id}/cancel: stops the job and deletes its documents and folders. */
export function cancelCrawl(jobId: string, ctx?: Ctx) {
  return req<unknown>('kb.crawl_cancel', `${KB}/crawl/${enc(jobId)}/cancel`, { method: 'POST', idempotent: true, responseKind: 'none', ctx })
}

// ─── Agent RAG query ─────────────────────────────────────────────────────────

/**
 * POST /agents/{id}/knowledge-base/rag-query: the agent's exact retrieval for a
 * test question, without a conversation. The response "may evolve": callers
 * parse it defensively.
 */
export function ragQuery(
  agentId: string,
  body: { query: string; use_agent_defaults?: boolean; max_documents_length?: number; max_retrieved_rag_chunks_count?: number },
  ctx?: Ctx,
) {
  return req<{ retrieval_query?: string; chunks?: RagQueryChunk[] }>(
    'agents.rag_query',
    `/v1/convai/agents/${enc(agentId)}/knowledge-base/rag-query`,
    { method: 'POST', body, idempotent: true, timeoutMs: T.write, ctx },
  )
}
