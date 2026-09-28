import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/api/http'
import { isCartesiaConfigured, isElevenLabsConfigured, isOpenAIConfigured, isSupabaseAdminConfigured } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import type { KnowledgeDocument, ProviderSyncEntry } from '@/types'
import {
  KNOWLEDGE_MAX_DOCUMENTS,
  KNOWLEDGE_MAX_FILE_BYTES,
  REFRESHING_MESSAGE,
  WAITING_FOR_AI_MESSAGE,
  type KnowledgeCapabilities,
  type KnowledgeDocumentView,
  type KnowledgeFileType,
  type KnowledgeListResponse,
} from './shared'

// Rows, views and storage paths for knowledge documents. Reads for the
// dashboard go through the user's session (RLS); every write uses the service
// role with an explicit org_id filter (after migration 011 the browser role
// can only SELECT knowledge_documents).

/** Every KnowledgeDocument column (migration 010), so nothing selects '*'. */
export const KNOWLEDGE_DOCUMENT_COLUMNS = [
  'id', 'agent_id', 'org_id', 'elevenlabs_doc_id', 'cartesia_doc_id', 'name', 'type', 'url', 'storage_path',
  'size_bytes', 'character_count', 'chunk_count', 'content_sha256', 'extracted_text_path', 'status',
  'error_message', 'provider_sync', 'created_at', 'updated_at',
].join(', ')

// Before migration 010 the list still works with the original 002 columns.
const LEGACY_DOCUMENT_COLUMNS = [
  'id', 'agent_id', 'org_id', 'elevenlabs_doc_id', 'name', 'type', 'url', 'storage_path', 'size_bytes',
  'character_count', 'status', 'error_message', 'created_at',
].join(', ')

/** Processing this long without an update means the background run died. */
export const STUCK_AFTER_MS = 10 * 60_000

/** Cartesia keeps one folder per agent and may split a long document into parts. */
export interface CartesiaDocumentSync extends ProviderSyncEntry {
  folder_id?: string | null
  doc_ids?: string[]
  /** The folder is attached to the agent's managed agent. */
  attached?: boolean
  /**
   * Cartesia refused to link folders to this managed agent (kb_agent_not_found:
   * knowledge bases are "coming soon" for v1 Managed Agents). Not an error: the
   * agent answers from the document through the search_knowledge tool. Holds
   * the agent id, so a new managed agent is tried again.
   */
  attach_unsupported_for?: string | null
}

export interface ElevenLabsDocumentSync extends ProviderSyncEntry {
  /** Listed in the standby agent's knowledge_base. */
  attached?: boolean
  rag_indexed?: boolean
  /** Embedding model of the RAG index; it must match the agent's RAG model to be used. */
  rag_model?: string | null
  /** Previous version still attached to the agent until the new one replaces it. */
  stale_doc_id?: string | null
}

export interface KnowledgeProviderSync {
  cartesia?: CartesiaDocumentSync
  elevenlabs?: ElevenLabsDocumentSync
}

/** Postgres/PostgREST codes for a column, table or function that migration 010 adds. */
export function isMissingSchemaError(error: { code?: string } | null | undefined): boolean {
  return ['42703', '42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(error?.code ?? '')
}

export function requireKnowledgeAdmin(): SupabaseClient {
  if (!isSupabaseAdminConfigured()) {
    throw new ApiError(503, 'not_configured', 'The knowledge base isn’t available right now. Please try again later.')
  }
  return createAdminClient()
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function withDocumentDefaults(row: Record<string, unknown>): KnowledgeDocument {
  const doc = row as Partial<KnowledgeDocument>
  return {
    ...(doc as KnowledgeDocument),
    elevenlabs_doc_id: doc.elevenlabs_doc_id ?? null,
    cartesia_doc_id: doc.cartesia_doc_id ?? null,
    url: doc.url ?? null,
    storage_path: doc.storage_path ?? null,
    size_bytes: asNumber(doc.size_bytes),
    character_count: asNumber(doc.character_count),
    chunk_count: asNumber(doc.chunk_count),
    content_sha256: doc.content_sha256 ?? null,
    extracted_text_path: doc.extracted_text_path ?? null,
    status: doc.status ?? 'processing',
    error_message: doc.error_message ?? null,
    provider_sync: (doc.provider_sync && typeof doc.provider_sync === 'object' ? doc.provider_sync : {}) as KnowledgeDocument['provider_sync'],
    updated_at: doc.updated_at ?? null,
  }
}

export function providerSyncOf(doc: Pick<KnowledgeDocument, 'provider_sync'>): KnowledgeProviderSync {
  return (doc.provider_sync ?? {}) as KnowledgeProviderSync
}

/** Shown on a ready document whose refresh never finished (the background run died). */
export const REFRESH_UNFINISHED_MESSAGE =
  'The last refresh didn’t finish. Your agent keeps using the version it already had. Try again.'

export function toDocumentView(doc: KnowledgeDocument, now: number = Date.now()): KnowledgeDocumentView {
  const waiting = doc.status === 'processing' && doc.error_message === WAITING_FOR_AI_MESSAGE
  const refreshing = doc.status === 'ready' && doc.error_message === REFRESHING_MESSAGE
  const lastTouched = Date.parse(doc.updated_at ?? doc.created_at)
  const overdue = Number.isFinite(lastTouched) && now - lastTouched > STUCK_AFTER_MS
  const stuck = ((doc.status === 'processing' && !waiting) || refreshing) && overdue
  const sync = providerSyncOf(doc)
  const providerError = [sync.cartesia, sync.elevenlabs].find((entry) => entry?.status === 'error')?.error ?? null

  let state: KnowledgeDocumentView['state'] = doc.status
  let errorMessage = doc.error_message
  if (waiting) state = 'waiting_for_ai'
  else if (refreshing) {
    state = stuck ? 'ready' : 'refreshing'
    errorMessage = stuck ? REFRESH_UNFINISHED_MESSAGE : null
  }

  return {
    id: doc.id,
    name: doc.name,
    type: doc.type,
    url: doc.url,
    size_bytes: doc.size_bytes,
    character_count: doc.character_count,
    chunk_count: doc.chunk_count,
    status: doc.status,
    state,
    error_message: errorMessage,
    stuck,
    providers: {
      cartesia: sync.cartesia?.status ?? null,
      elevenlabs: sync.elevenlabs?.status ?? null,
      error: providerError,
    },
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  }
}

export function knowledgeCapabilities(): KnowledgeCapabilities {
  return {
    search: isOpenAIConfigured(),
    backups: { cartesia: isCartesiaConfigured(), elevenlabs: isElevenLabsConfigured() },
  }
}

export function listResponse(documents: KnowledgeDocument[]): KnowledgeListResponse {
  const now = Date.now()
  return {
    documents: documents.map((doc) => toDocumentView(doc, now)),
    capabilities: knowledgeCapabilities(),
    limits: { max_documents: KNOWLEDGE_MAX_DOCUMENTS, max_file_bytes: KNOWLEDGE_MAX_FILE_BYTES },
  }
}

let warnedLegacySchema = false

/** Newest first, scoped by org and agent. Works before migration 010 with defaults. */
export async function listAgentDocuments(
  client: SupabaseClient,
  orgId: string,
  agentId: string
): Promise<KnowledgeDocument[]> {
  const query = (columns: string) =>
    client
      .from('knowledge_documents')
      .select(columns)
      .eq('org_id', orgId)
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(KNOWLEDGE_MAX_DOCUMENTS * 2)

  const { data, error } = await query(KNOWLEDGE_DOCUMENT_COLUMNS)
  if (!error) return ((data ?? []) as unknown as Record<string, unknown>[]).map(withDocumentDefaults)
  if (!isMissingSchemaError(error)) {
    console.error('[knowledge] list failed', error.code, error.message)
    throw new ApiError(500, 'knowledge_unavailable', 'We couldn’t load your documents. Please refresh the page.')
  }
  if (!warnedLegacySchema) {
    warnedLegacySchema = true
    console.warn('[knowledge] knowledge_documents is missing migration 010 columns; listing with defaults')
  }
  const legacy = await query(LEGACY_DOCUMENT_COLUMNS)
  if (legacy.error) {
    console.error('[knowledge] list failed', legacy.error.code, legacy.error.message)
    throw new ApiError(500, 'knowledge_unavailable', 'We couldn’t load your documents. Please refresh the page.')
  }
  return ((legacy.data ?? []) as unknown as Record<string, unknown>[]).map(withDocumentDefaults)
}

/** One document of this organisation, through the service role. */
export async function loadDocument(admin: SupabaseClient, orgId: string, documentId: string): Promise<KnowledgeDocument | null> {
  const { data, error } = await admin
    .from('knowledge_documents')
    .select(KNOWLEDGE_DOCUMENT_COLUMNS)
    .eq('id', documentId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) {
    console.error('[knowledge] document lookup failed', error.code, error.message)
    if (isMissingSchemaError(error)) {
      throw new ApiError(503, 'not_configured', 'The knowledge base needs a database update before it can be used.')
    }
    throw new ApiError(500, 'knowledge_unavailable', 'We couldn’t load this document. Please try again.')
  }
  return data ? withDocumentDefaults(data as unknown as Record<string, unknown>) : null
}

export async function assertDocumentCapacity(
  admin: SupabaseClient,
  orgId: string,
  agentId: string,
  extra = 0
): Promise<void> {
  const { count, error } = await admin
    .from('knowledge_documents')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('agent_id', agentId)
  if (error) {
    console.error('[knowledge] document count failed', error.code, error.message)
    throw new ApiError(500, 'knowledge_unavailable', 'We couldn’t check your documents. Please try again.')
  }
  if ((count ?? 0) - extra >= KNOWLEDGE_MAX_DOCUMENTS) {
    throw new ApiError(
      409,
      'document_limit_reached',
      `Your agent already has ${KNOWLEDGE_MAX_DOCUMENTS} documents. Remove ones you no longer need, or combine smaller files, before adding more.`
    )
  }
}

// ─── Storage paths ───────────────────────────────────────────────────────────

/** Every object of an agent lives under <org_id>/<agent_id>/ (the storage policy checks the org folder). */
export function knowledgeStoragePrefix(orgId: string, agentId: string): string {
  return `${orgId}/${agentId}/`
}

export function extractedTextPath(orgId: string, agentId: string, documentId: string): string {
  return `${knowledgeStoragePrefix(orgId, agentId)}extracted/${documentId}.txt`
}

/** ASCII-only object name with the right extension; storage keys reject many characters. */
export function safeStorageFileName(name: string, type: KnowledgeFileType): string {
  const base = name
    .replace(/\.[a-z0-9]+$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
  return `${base || 'document'}.${type}`
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UPLOAD_OBJECT = new RegExp(`^${UUID}-[A-Za-z0-9._-]{1,90}\\.(pdf|docx|txt|md)$`)

/** The file type of an upload path we issued for this org and agent, or null when the path isn't one. */
export function uploadedFileType(path: string, orgId: string, agentId: string): KnowledgeFileType | null {
  const prefix = knowledgeStoragePrefix(orgId, agentId)
  if (!path.startsWith(prefix)) return null
  const match = UPLOAD_OBJECT.exec(path.slice(prefix.length))
  return match ? (match[1] as KnowledgeFileType) : null
}

/** Display name: no control characters or runs of whitespace, at most 200 characters. */
export function cleanDocumentName(name: string): string {
  const clean = name.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim()
  return clean.length > 200 ? `${clean.slice(0, 199)}…` : clean
}
