import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { APIError as OpenAIAPIError } from 'openai'
import { isOpenAIConfigured } from '@/lib/env'
import { classifyOpenAIError, embedTexts, openAIEmbeddingModel } from '@/lib/openai/client'
import { sha256Hex } from '@/lib/security/crypto'
import type { KnowledgeDocument } from '@/types'
import { CHUNKER_VERSION, chunkDocument, embeddingInputFor, type TextChunk } from './chunk'
import { deleteKnowledgeDocument } from './delete'
import {
  cleanDocumentName,
  extractedTextPath,
  isMissingSchemaError,
  loadDocument,
  requireKnowledgeAdmin,
} from './documents'
import { KnowledgeIngestError } from './errors'
import { extractDocumentText, type ExtractedDocument } from './extract'
import { fetchWebDocument } from './fetch-url'
import { ingestLockKey, releaseLock, tryAcquireLock } from './lock'
import { loadKnowledgeAgent, removeDocumentFromProviders, syncDocumentToProviders } from './providers'
import { resyncAgentIfKnowledgeFlipped } from './readiness'
import { invalidateKnowledgeCache } from './search'
import {
  KNOWLEDGE_BUCKET,
  KNOWLEDGE_MAX_FILE_BYTES,
  WAITING_FOR_AI_MESSAGE,
  defaultUrlDocumentName,
} from './shared'

// The ingest pipeline, run in after() by the upload, URL and resync routes:
//   read (storage download or safeFetch) → verify → extract → normalise →
//   hash (skip re-embedding when unchanged) → chunk → embed → insert the new
//   chunks, then delete the old ones → ready → provider copies.
// Without OpenAI the text is still read and copied to the providers, and the
// document waits (status processing + WAITING_FOR_AI_MESSAGE) until a resync.
// It never throws: every failure ends on the row as a plain error_message.

/** Longer than a function run (maxDuration 60 s), so a crashed run frees it on its own. */
export const INGEST_LOCK_SECONDS = 120

const INSERT_BATCH = 50
const DELETE_BATCH = 100

class KnowledgeDbError extends Error {
  readonly code: string | null
  constructor(action: string, error: { code?: string; message?: string }) {
    super(`${action}: ${error.code ?? ''} ${error.message ?? ''}`.trim())
    this.name = 'KnowledgeDbError'
    this.code = error.code ?? null
  }
}

export interface IngestInput {
  orgId: string
  documentId: string
  /** Status before this run: a failed refresh of a ready document keeps the version the agent already uses. */
  previousStatus?: KnowledgeDocument['status'] | null
  /** A document this upload replaces; removed once the new version is in place. */
  replacesDocumentId?: string | null
  /** The route already holds the ingest lock. */
  lockAcquired?: boolean
}

function messageFor(error: unknown): string {
  if (error instanceof KnowledgeIngestError) return error.message
  if (error instanceof KnowledgeDbError && isMissingSchemaError({ code: error.code ?? undefined })) {
    return 'The knowledge base needs a database update before it can read documents. Please contact support.'
  }
  // Connection, timeout and abort errors of the SDK are APIError subclasses too.
  if (error instanceof OpenAIAPIError) {
    const kind = classifyOpenAIError(error)
    if (kind === 'retry' || kind === 'timeout') return 'The AI service is busy right now. Please try again in a few minutes.'
    return 'We couldn’t prepare this document for search. Please try again later.'
  }
  return 'Something went wrong while reading this document. Please try again.'
}

async function updateRow(
  admin: SupabaseClient,
  doc: Pick<KnowledgeDocument, 'id' | 'org_id'>,
  patch: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await admin
    .from('knowledge_documents')
    .update(patch)
    .eq('id', doc.id)
    .eq('org_id', doc.org_id)
    .select('id')
  if (error) throw new KnowledgeDbError('document update', error)
  return (data ?? []).length > 0
}

async function readSource(admin: SupabaseClient, doc: KnowledgeDocument): Promise<ExtractedDocument & { sizeBytes: number }> {
  if (doc.type === 'url') {
    if (!doc.url) throw new KnowledgeIngestError('missing_url', 'This page has no address. Remove it and add the page again.')
    const page = await fetchWebDocument(doc.url)
    const extracted = await extractDocumentText({ kind: page.kind, bytes: page.bytes, charset: page.charset })
    return { ...extracted, sizeBytes: page.bytes.byteLength }
  }

  if (!doc.storage_path) {
    throw new KnowledgeIngestError('file_missing', 'We couldn’t find the uploaded file. Please upload it again.')
  }
  const { data: blob, error } = await admin.storage.from(KNOWLEDGE_BUCKET).download(doc.storage_path)
  if (error || !blob) {
    console.error('[knowledge] storage download failed', { documentId: doc.id, message: error?.message })
    throw new KnowledgeIngestError('file_missing', 'We couldn’t open the uploaded file. Please upload it again.')
  }
  if (blob.size > KNOWLEDGE_MAX_FILE_BYTES) {
    throw new KnowledgeIngestError('file_too_large', 'This file is larger than 10 MB. Split it into smaller files and upload them separately.')
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const extracted = await extractDocumentText({ kind: doc.type, bytes })
  return { ...extracted, sizeBytes: bytes.byteLength }
}

async function saveExtractedText(admin: SupabaseClient, doc: KnowledgeDocument, text: string): Promise<string | null> {
  const path = extractedTextPath(doc.org_id, doc.agent_id, doc.id)
  const { error } = await admin.storage
    .from(KNOWLEDGE_BUCKET)
    .upload(path, text, { contentType: 'text/plain', upsert: true })
  if (error) {
    // Only a convenience for later provider re-syncs; the pipeline doesn't depend on it.
    console.warn('[knowledge] extracted text not saved', { documentId: doc.id, message: error.message })
    return doc.extracted_text_path
  }
  return path
}

async function listChunkIds(admin: SupabaseClient, doc: KnowledgeDocument): Promise<string[]> {
  const ids: string[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('knowledge_chunks')
      .select('id')
      .eq('document_id', doc.id)
      .eq('org_id', doc.org_id)
      .order('id')
      .range(from, from + 999)
    if (error) throw new KnowledgeDbError('chunk listing', error)
    const page = (data ?? []) as { id: string }[]
    ids.push(...page.map((row) => row.id))
    if (page.length < 1000) return ids
  }
}

async function deleteChunkIds(admin: SupabaseClient, orgId: string, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += DELETE_BATCH) {
    const { error } = await admin
      .from('knowledge_chunks')
      .delete()
      .eq('org_id', orgId)
      .in('id', ids.slice(i, i + DELETE_BATCH))
    if (error) throw new KnowledgeDbError('chunk delete', error)
  }
}

/** Inserts the new chunks first, then removes the previous ones, so a failure never leaves the document empty. */
async function replaceChunks(
  admin: SupabaseClient,
  doc: KnowledgeDocument,
  chunks: TextChunk[],
  embeddings: number[][]
): Promise<void> {
  const previous = await listChunkIds(admin, doc)
  const inserted: string[] = []
  try {
    for (let i = 0; i < chunks.length; i += INSERT_BATCH) {
      const rows = chunks.slice(i, i + INSERT_BATCH).map((chunk, offset) => ({
        org_id: doc.org_id,
        agent_id: doc.agent_id,
        document_id: doc.id,
        chunk_index: chunk.index,
        heading: chunk.heading,
        content: chunk.content,
        token_count: chunk.token_count,
        embedding: embeddings[i + offset],
      }))
      const { data, error } = await admin.from('knowledge_chunks').insert(rows).select('id')
      if (error) throw new KnowledgeDbError('chunk insert', error)
      inserted.push(...((data ?? []) as { id: string }[]).map((row) => row.id))
    }
  } catch (error) {
    await deleteChunkIds(admin, doc.org_id, inserted).catch((cleanupError: unknown) =>
      console.error('[knowledge] cleanup of partial chunks failed', { documentId: doc.id, error: String(cleanupError) })
    )
    throw error
  }
  await deleteChunkIds(admin, doc.org_id, previous)
}

async function chunkCount(admin: SupabaseClient, doc: KnowledgeDocument): Promise<number> {
  const { count, error } = await admin
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', doc.id)
    .eq('org_id', doc.org_id)
  if (error) throw new KnowledgeDbError('chunk count', error)
  return count ?? 0
}

function contentHash(name: string, text: string): string {
  return sha256Hex(`chunker:${CHUNKER_VERSION}|model:${openAIEmbeddingModel()}|name:${name}|${text}`)
}

async function replacePreviousVersion(orgId: string, replacesDocumentId: string | null | undefined): Promise<void> {
  if (!replacesDocumentId) return
  try {
    await deleteKnowledgeDocument({ orgId, documentId: replacesDocumentId })
  } catch (error) {
    console.error('[knowledge] replaced document not removed', { replacesDocumentId, error: error instanceof Error ? error.message : String(error) })
  }
}

async function recordFailure(admin: SupabaseClient, doc: KnowledgeDocument, input: IngestInput, error: unknown): Promise<void> {
  const message = messageFor(error)
  if (error instanceof KnowledgeIngestError) {
    console.warn('[knowledge] document not ingested', { documentId: doc.id, code: error.code })
  } else {
    console.error('[knowledge] ingest failed', { documentId: doc.id, error: error instanceof Error ? error.message : String(error) })
  }

  let keepPrevious = false
  if (input.previousStatus === 'ready' && doc.chunk_count > 0) {
    keepPrevious = await chunkCount(admin, doc).then((n) => n > 0, () => false)
  }
  // Only columns that exist before migration 010, so even a schema problem is reported on the row.
  const patch = keepPrevious
    ? { status: 'ready', error_message: `We couldn’t refresh this document. ${message} Your agent keeps using the version it already had.` }
    : { status: 'failed', error_message: message }
  try {
    await updateRow(admin, doc, patch)
    if (keepPrevious) await invalidateKnowledgeCache(doc.agent_id)
  } catch (updateError) {
    console.error('[knowledge] failure status not saved', { documentId: doc.id, error: String(updateError) })
  }
}

async function run(admin: SupabaseClient, doc: KnowledgeDocument, input: IngestInput): Promise<void> {
  const agent = await loadKnowledgeAgent(admin, doc.org_id, doc.agent_id)
  if (!agent) return

  const source = await readSource(admin, doc)
  const text = source.text
  const pageTitle = source.title ? cleanDocumentName(source.title) : ''
  const name = doc.type === 'url' ? pageTitle || defaultUrlDocumentName(doc.url ?? '') : doc.name
  const extractedPath = await saveExtractedText(admin, doc, text)
  const details = {
    name,
    size_bytes: source.sizeBytes,
    character_count: text.length,
    extracted_text_path: extractedPath,
  }
  const current: KnowledgeDocument = { ...doc, ...details }

  if (!isOpenAIConfigured()) {
    const providers = await syncDocumentToProviders({ doc: current, agent, text })
    const exists = await updateRow(admin, doc, {
      ...details,
      ...providers,
      status: 'processing',
      error_message: WAITING_FOR_AI_MESSAGE,
      chunk_count: 0,
      content_sha256: null,
    })
    if (!exists) {
      await removeDocumentFromProviders({ ...current, ...providers })
      return
    }
    await invalidateKnowledgeCache(doc.agent_id)
    // The new version is what every provider copy uses now; the old one would only duplicate it.
    await replacePreviousVersion(doc.org_id, input.replacesDocumentId)
    return
  }

  const hash = contentHash(name, text)
  let chunks = doc.chunk_count
  const unchanged = doc.content_sha256 === hash && doc.chunk_count > 0 && (await chunkCount(admin, doc)) > 0
  if (!unchanged) {
    const pieces = chunkDocument(text)
    if (pieces.length === 0) {
      throw new KnowledgeIngestError('empty_document', 'We couldn’t find any text to use in this document.')
    }
    const embeddings = await embedTexts(pieces.map((chunk) => embeddingInputFor(chunk, name)))
    await replaceChunks(admin, doc, pieces, embeddings)
    chunks = pieces.length
  }

  const exists = await updateRow(admin, doc, {
    ...details,
    status: 'ready',
    error_message: null,
    chunk_count: chunks,
    content_sha256: hash,
  })
  if (!exists) return
  await invalidateKnowledgeCache(doc.agent_id)
  await replacePreviousVersion(doc.org_id, input.replacesDocumentId)
  if (doc.status !== 'ready') await resyncAgentIfKnowledgeFlipped(admin, doc, 'became_ready')

  const providers = await syncDocumentToProviders({ doc: { ...current, chunk_count: chunks, content_sha256: hash }, agent, text })
  const stillExists = await updateRow(admin, doc, { ...providers })
  if (!stillExists) await removeDocumentFromProviders({ ...current, ...providers })
}

export async function ingestKnowledgeDocument(input: IngestInput): Promise<void> {
  const lockKey = ingestLockKey(input.documentId)
  let admin: SupabaseClient
  try {
    admin = requireKnowledgeAdmin()
  } catch (error) {
    console.error('[knowledge] ingest skipped: service role is not configured', String(error))
    return
  }

  if (!input.lockAcquired && !(await tryAcquireLock(lockKey, INGEST_LOCK_SECONDS))) {
    console.warn('[knowledge] ingest already running; skipped', { documentId: input.documentId })
    return
  }

  let doc: KnowledgeDocument | null = null
  try {
    doc = await loadDocument(admin, input.orgId, input.documentId)
    if (!doc) return
    await run(admin, doc, input)
  } catch (error) {
    if (doc) await recordFailure(admin, doc, input, error)
    else console.error('[knowledge] ingest failed before loading the document', { documentId: input.documentId, error: String(error) })
  } finally {
    await releaseLock(lockKey)
  }
}
