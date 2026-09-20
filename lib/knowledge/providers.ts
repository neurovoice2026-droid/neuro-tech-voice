import 'server-only'
import {
  CARTESIA_API_BASE,
  CARTESIA_API_VERSION,
  CartesiaError,
  cartesia,
  isCartesiaQuotaError,
  parseCartesiaError,
} from '@/lib/cartesia/client'
import {
  ELEVENLABS_RAG_MODEL,
  ELEVENLABS_RAG_THRESHOLD_CHARS,
  ElevenLabsKnowledgeError,
  computeElevenLabsRagIndex,
  createElevenLabsTextDocument,
  deleteElevenLabsDocument,
  getElevenLabsAgentKnowledge,
  ragModelForAgent,
  updateElevenLabsAgentKnowledge,
  type ElevenLabsKnowledgeLocator,
} from '@/lib/elevenlabs/knowledge'
import { env, isCartesiaConfigured, isElevenLabsConfigured } from '@/lib/env'
import { kvGet, kvSet } from '@/lib/kv'
import { sha256Hex } from '@/lib/security/crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { KnowledgeDocument } from '@/types'
import {
  providerSyncOf,
  requireKnowledgeAdmin,
  type CartesiaDocumentSync,
  type ElevenLabsDocumentSync,
  type KnowledgeProviderSync,
} from './documents'
import { withLock } from './lock'
import { splitUtf8Parts } from './text'

// Copies of each document in the voice providers' own knowledge bases. Our
// search_knowledge tool (pgvector) is how the agent answers in every Cartesia
// mode, so these copies are best effort: a failure is stored on the document
// (provider_sync) and logged, never fails the document.
//   Cartesia:   one folder per agent ("ntv-<agent_id>"), the text split into
//               ≤ 900 KB documents, the folder attached to the managed agent.
//   ElevenLabs: one text document attached to the standby agent's
//               knowledge_base, RAG-indexed when the text is long.

/** Cartesia caps a document at 1 MB of JSON; stay well under after escaping. */
export const CARTESIA_PART_MAX_BYTES = 900_000

const FOLDER_ID_CACHE_SECONDS = 24 * 60 * 60

export interface KnowledgeAgentRef {
  id: string
  org_id: string
  cartesia_agent_id: string | null
  elevenlabs_agent_id: string | null
}

export function cartesiaFolderName(agentId: string): string {
  return `ntv-${agentId}`
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

/** The agent's provider ids, read fresh (they change when the agent sync runs). Works before migration 010. */
export async function loadKnowledgeAgent(admin: SupabaseClient, orgId: string, agentId: string): Promise<KnowledgeAgentRef | null> {
  // select('*'): cartesia_agent_id only exists after migration 010.
  const { data, error } = await admin.from('agents').select('*').eq('id', agentId).eq('org_id', orgId).maybeSingle()
  if (error) {
    console.error('[knowledge] agent lookup failed', error.code, error.message)
    throw new Error('Agent lookup failed')
  }
  if (!data) return null
  const row = data as Record<string, unknown>
  return {
    id: agentId,
    org_id: orgId,
    cartesia_agent_id: str(row.cartesia_agent_id),
    elevenlabs_agent_id: str(row.elevenlabs_agent_id),
  }
}

function logProviderError(provider: 'cartesia' | 'elevenlabs', action: string, documentId: string | null, error: unknown): void {
  if (error instanceof CartesiaError) {
    console.error(`[knowledge] ${provider} ${action} failed`, {
      documentId,
      endpoint: error.endpoint,
      status: error.status,
      code: error.errorCode,
      requestId: error.requestId,
    })
  } else if (error instanceof ElevenLabsKnowledgeError) {
    console.error(`[knowledge] ${provider} ${action} failed`, {
      documentId,
      endpoint: error.endpoint,
      status: error.status,
      detail: error.detail,
    })
  } else {
    console.error(`[knowledge] ${provider} ${action} failed`, { documentId, error: error instanceof Error ? error.message : String(error) })
  }
}

function cartesiaMessage(error: unknown): string {
  if (isCartesiaQuotaError(error)) return 'Cartesia’s plan limit was reached, so its copy of this document wasn’t updated.'
  if (error instanceof CartesiaError) {
    if (error.status === 401 || error.status === 403) return 'Cartesia didn’t accept our credentials, so its copy of this document wasn’t updated.'
    if (error.status === 413) return 'This document is too large for Cartesia’s knowledge base.'
    if (error.status === 0 || error.status === 429 || error.status >= 500) {
      return 'Cartesia couldn’t be reached. Its copy will be updated the next time this document is refreshed.'
    }
  }
  return 'Cartesia couldn’t store a copy of this document.'
}

function elevenLabsMessage(error: unknown): string {
  if (error instanceof ElevenLabsKnowledgeError) {
    if (error.status === 401 || error.status === 403) return 'ElevenLabs didn’t accept our credentials, so the backup agent’s copy wasn’t updated.'
    if (error.status === 413) return 'This document is too large for the backup agent’s knowledge base.'
    if (error.status === 0 || error.status === 429 || error.status >= 500) {
      return 'ElevenLabs couldn’t be reached. The backup agent’s copy will be updated the next time this document is refreshed.'
    }
  }
  return 'The backup agent’s copy of this document couldn’t be updated.'
}

// ─── Cartesia ────────────────────────────────────────────────────────────────

function folderCacheKey(agentId: string): string {
  return `kb:cartesia-folder:${agentId}`
}

function isDuplicateFolderError(error: unknown): boolean {
  return error instanceof CartesiaError && (error.errorCode === 'kb_folder_duplicate_name' || error.status === 409)
}

function isFolderMissingError(error: unknown): boolean {
  return error instanceof CartesiaError && (error.errorCode === 'kb_folder_not_found' || (error.status === 404 && error.endpoint.includes('folders')))
}

/** GET /agents/folders is not in the shared client yet; paged lookup by exact name. */
async function findCartesiaFolderByName(name: string): Promise<string | null> {
  const apiKey = env.CARTESIA_API_KEY
  if (!apiKey) return null
  let startingAfter: string | null = null
  for (let page = 0; page < 20; page++) {
    const url = new URL('/agents/folders', CARTESIA_API_BASE)
    url.searchParams.set('limit', '100')
    url.searchParams.set('depth', '1')
    if (startingAfter) url.searchParams.set('starting_after', startingAfter)
    let res: Response
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Cartesia-Version': CARTESIA_API_VERSION },
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store',
      })
    } catch (error) {
      throw new CartesiaError({ status: 0, errorCode: 'network_error', endpoint: 'GET /agents/folders', message: 'Cartesia GET /agents/folders could not be reached', cause: error })
    }
    if (!res.ok) throw await parseCartesiaError(res, 'GET /agents/folders')
    const body = (await res.json().catch(() => null)) as { data?: unknown; has_more?: unknown; next_page?: unknown } | null
    const folders = Array.isArray(body?.data) ? (body.data as { id?: unknown; name?: unknown }[]) : []
    const match = folders.find((folder) => folder.name === name && typeof folder.id === 'string')
    if (match) return match.id as string
    const next = str(body?.next_page) ?? str(folders.at(-1)?.id)
    if (body?.has_more !== true || !next) return null
    startingAfter = next
  }
  return null
}

async function knownCartesiaFolderId(admin: SupabaseClient, agent: KnowledgeAgentRef): Promise<string | null> {
  const cached = await kvGet<string>(folderCacheKey(agent.id))
  if (typeof cached === 'string' && cached) return cached
  const { data, error } = await admin
    .from('knowledge_documents')
    .select('provider_sync')
    .eq('org_id', agent.org_id)
    .eq('agent_id', agent.id)
    .not('provider_sync->cartesia->>folder_id', 'is', null)
    .limit(1)
  if (error) {
    console.warn('[knowledge] cartesia folder lookup failed', error.code, error.message)
    return null
  }
  const row = (data ?? [])[0] as { provider_sync?: KnowledgeProviderSync } | undefined
  return str(row?.provider_sync?.cartesia?.folder_id)
}

async function ensureCartesiaFolder(admin: SupabaseClient, agent: KnowledgeAgentRef, opts: { fresh?: boolean } = {}): Promise<string> {
  return withLock(`kb:cartesia-folder-lock:${agent.id}`, { ttlSeconds: 60, waitMs: 8_000 }, async () => {
    if (!opts.fresh) {
      const known = await knownCartesiaFolderId(admin, agent)
      if (known) return known
    }
    const name = cartesiaFolderName(agent.id)
    let folderId: string | null = null
    try {
      folderId = (await cartesia.knowledge.createFolder(name)).id
    } catch (error) {
      if (!isDuplicateFolderError(error)) throw error
      folderId = await findCartesiaFolderByName(name)
      if (!folderId) throw error
    }
    await kvSet(folderCacheKey(agent.id), folderId, FOLDER_ID_CACHE_SECONDS)
    return folderId
  })
}

async function deleteCartesiaDocumentQuietly(id: string, documentId: string | null): Promise<boolean> {
  try {
    await cartesia.knowledge.deleteDocument(id)
    return true
  } catch (error) {
    if (error instanceof CartesiaError && error.status === 404) return true
    logProviderError('cartesia', 'document delete', documentId, error)
    return false
  }
}

async function writeCartesiaParts(input: {
  folderId: string
  doc: KnowledgeDocument
  parts: string[]
  existingIds: string[]
}): Promise<string[]> {
  const { folderId, doc, parts, existingIds } = input
  const ids: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const name = parts.length > 1 ? `${doc.name} (part ${i + 1} of ${parts.length})` : doc.name
    const existing = existingIds[i]
    if (existing) {
      try {
        await cartesia.knowledge.updateDocument(existing, { name, content: parts[i] })
        ids.push(existing)
        continue
      } catch (error) {
        // Deleted on Cartesia's side: create it again below.
        if (!(error instanceof CartesiaError && error.status === 404)) throw error
      }
    }
    const created = await cartesia.knowledge.createDocument({
      folderId,
      name,
      content: parts[i],
      metadata: { ntv_document_id: doc.id, ntv_part: String(i + 1) },
    })
    ids.push(created.id)
  }
  for (const stale of existingIds.slice(parts.length)) {
    await deleteCartesiaDocumentQuietly(stale, doc.id)
  }
  return ids
}

async function syncCartesia(input: {
  admin: SupabaseClient
  doc: KnowledgeDocument
  agent: KnowledgeAgentRef
  text: string
  textHash: string
  force: boolean
}): Promise<{ entry: CartesiaDocumentSync; primaryId: string | null }> {
  const { admin, doc, agent, text, textHash, force } = input
  const prev = providerSyncOf(doc).cartesia
  const existingIds = prev?.doc_ids?.length ? prev.doc_ids : doc.cartesia_doc_id ? [doc.cartesia_doc_id] : []
  const base: CartesiaDocumentSync = {
    status: prev?.status ?? 'pending',
    synced_at: prev?.synced_at ?? null,
    error: prev?.error ?? null,
    hash: prev?.hash ?? null,
    folder_id: prev?.folder_id ?? null,
    doc_ids: existingIds,
    attached: prev?.attached ?? false,
  }

  if (!isCartesiaConfigured()) {
    return { entry: { ...base, status: 'disabled', error: null }, primaryId: existingIds[0] ?? null }
  }
  const managedAgentId = agent.cartesia_agent_id
  const attachUnsupported = !!managedAgentId && prev?.attach_unsupported_for === managedAgentId
  const contentCurrent = !force && prev?.hash === textHash && existingIds.length > 0 && !!prev?.folder_id
  if (contentCurrent && prev?.status === 'synced' && (!managedAgentId || prev.attached || attachUnsupported)) {
    return { entry: prev, primaryId: existingIds[0] }
  }

  try {
    let folderId = prev?.folder_id ?? (await ensureCartesiaFolder(admin, agent))
    let ids = existingIds
    if (!contentCurrent) {
      const parts = splitUtf8Parts(text, CARTESIA_PART_MAX_BYTES)
      try {
        ids = await writeCartesiaParts({ folderId, doc, parts, existingIds })
      } catch (error) {
        if (!isFolderMissingError(error)) throw error
        // The folder was removed on Cartesia's side (with its documents): start over.
        folderId = await ensureCartesiaFolder(admin, agent, { fresh: true })
        ids = await writeCartesiaParts({ folderId, doc, parts, existingIds: [] })
      }
    }

    let attached = prev?.attached === true && prev.folder_id === folderId
    let unsupportedFor: string | null = attachUnsupported ? managedAgentId : null
    let error: string | null = null
    if (managedAgentId && !attached && !attachUnsupported) {
      try {
        await cartesia.knowledge.attachFolderToAgent(folderId, managedAgentId)
        attached = true
      } catch (attachError) {
        if (attachError instanceof CartesiaError && attachError.status === 400 && attachError.errorCode === 'kb_agent_not_found') {
          // Managed Agents can't use folders yet; don't show an error or retry on every sync.
          console.info('[knowledge] Cartesia does not link folders to this managed agent; it answers through search_knowledge', doc.id)
          unsupportedFor = managedAgentId
        } else {
          logProviderError('cartesia', 'folder attach', doc.id, attachError)
          error = 'The document was copied to Cartesia, but linking it to the Cartesia agent failed. Your agent still answers from this document.'
        }
      }
    }
    return {
      entry: {
        status: error ? 'error' : 'synced',
        synced_at: new Date().toISOString(),
        error,
        hash: textHash,
        folder_id: folderId,
        doc_ids: ids,
        attached,
        ...(unsupportedFor ? { attach_unsupported_for: unsupportedFor } : {}),
      },
      primaryId: ids[0] ?? null,
    }
  } catch (error) {
    logProviderError('cartesia', 'sync', doc.id, error)
    return { entry: { ...base, status: 'error', error: cartesiaMessage(error) }, primaryId: existingIds[0] ?? null }
  }
}

// ─── ElevenLabs ──────────────────────────────────────────────────────────────

function elevenLabsAgentLock(agentId: string): string {
  return `kb:elevenlabs-agent:${agentId}`
}

async function syncElevenLabs(input: {
  doc: KnowledgeDocument
  agent: KnowledgeAgentRef
  text: string
  textHash: string
  force: boolean
}): Promise<{ entry: ElevenLabsDocumentSync; docId: string | null }> {
  const { doc, agent, text, textHash, force } = input
  const prev = providerSyncOf(doc).elevenlabs
  const base: ElevenLabsDocumentSync = {
    status: prev?.status ?? 'pending',
    synced_at: prev?.synced_at ?? null,
    error: prev?.error ?? null,
    hash: prev?.hash ?? null,
    attached: prev?.attached ?? false,
    rag_indexed: prev?.rag_indexed ?? false,
    rag_model: prev?.rag_model ?? null,
    stale_doc_id: prev?.stale_doc_id ?? null,
  }
  if (!isElevenLabsConfigured()) {
    return { entry: { ...base, status: 'disabled', error: null }, docId: doc.elevenlabs_doc_id }
  }

  const standbyAgentId = agent.elevenlabs_agent_id
  const needsRag = text.length > ELEVENLABS_RAG_THRESHOLD_CHARS
  const contentCurrent = !force && prev?.hash === textHash && !!doc.elevenlabs_doc_id
  const indexedModel = prev?.rag_indexed ? (prev.rag_model ?? ELEVENLABS_RAG_MODEL) : null
  if (
    contentCurrent &&
    prev?.status !== 'error' &&
    (!standbyAgentId || prev?.attached) &&
    // A long document on a standby agent re-checks the agent's RAG model below.
    (!needsRag || (indexedModel !== null && !standbyAgentId)) &&
    !prev?.stale_doc_id
  ) {
    return { entry: prev as ElevenLabsDocumentSync, docId: doc.elevenlabs_doc_id }
  }

  let docId = doc.elevenlabs_doc_id
  let staleId = prev?.stale_doc_id ?? null
  let ragModel = contentCurrent ? indexedModel : null
  let attached = contentCurrent ? prev?.attached === true : false
  try {
    if (!contentCurrent) {
      if (staleId) {
        // An older version that never got replaced: remove it before adding another.
        try {
          await deleteElevenLabsDocument(staleId)
          staleId = null
        } catch (error) {
          logProviderError('elevenlabs', 'old version delete', doc.id, error)
        }
      }
      const created = await createElevenLabsTextDocument({ name: doc.name, text })
      // The previous version stays attached until the new one replaces it.
      if (docId && docId !== created.id) staleId = docId
      docId = created.id
    }

    const problems: string[] = []
    if (needsRag && docId) {
      try {
        // The index must use the standby agent's RAG model or retrieval skips the document.
        const wanted = standbyAgentId
          ? ragModelForAgent((await getElevenLabsAgentKnowledge(standbyAgentId)).rag)
          : ELEVENLABS_RAG_MODEL
        if (ragModel !== wanted) {
          ragModel = null
          await computeElevenLabsRagIndex(docId, wanted)
          ragModel = wanted
        }
      } catch (error) {
        logProviderError('elevenlabs', 'rag index', doc.id, error)
        problems.push('The backup agent couldn’t index this long document, so it may not find every answer in it.')
      }
    }

    if (standbyAgentId && docId) {
      const locator: ElevenLabsKnowledgeLocator = { type: 'text', name: doc.name, id: docId, usage_mode: 'auto' }
      await withLock(elevenLabsAgentLock(standbyAgentId), { ttlSeconds: 30, waitMs: 10_000 }, () =>
        updateElevenLabsAgentKnowledge(standbyAgentId, {
          add: [locator],
          remove: staleId ? [staleId] : [],
          enableRagModel: needsRag && ragModel ? ragModel : null,
        })
      )
      attached = true
    }

    if (staleId && (attached || !standbyAgentId)) {
      try {
        await deleteElevenLabsDocument(staleId)
        staleId = null
      } catch (error) {
        logProviderError('elevenlabs', 'old version delete', doc.id, error)
      }
    }

    return {
      entry: {
        status: problems.length > 0 ? 'error' : standbyAgentId ? 'synced' : 'pending',
        synced_at: new Date().toISOString(),
        error: problems[0] ?? null,
        hash: textHash,
        attached,
        rag_indexed: ragModel !== null,
        rag_model: ragModel,
        stale_doc_id: staleId,
      },
      docId,
    }
  } catch (error) {
    logProviderError('elevenlabs', 'sync', doc.id, error)
    return {
      entry: {
        ...base,
        status: 'error',
        error: elevenLabsMessage(error),
        // Remember a document we already created so a retry attaches it instead of creating another.
        hash: docId !== doc.elevenlabs_doc_id ? textHash : base.hash,
        attached,
        rag_indexed: ragModel !== null,
        rag_model: ragModel,
        stale_doc_id: staleId,
      },
      docId,
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ProviderSyncResult {
  provider_sync: KnowledgeProviderSync
  cartesia_doc_id: string | null
  elevenlabs_doc_id: string | null
}

/** Pushes the document's extracted text to Cartesia and ElevenLabs. Never throws. */
export async function syncDocumentToProviders(input: {
  doc: KnowledgeDocument
  agent: KnowledgeAgentRef
  text: string
  force?: boolean
}): Promise<ProviderSyncResult> {
  const admin = requireKnowledgeAdmin()
  const textHash = sha256Hex(input.text)
  const force = input.force === true
  const [cartesiaResult, elevenLabsResult] = await Promise.all([
    syncCartesia({ admin, doc: input.doc, agent: input.agent, text: input.text, textHash, force }),
    syncElevenLabs({ doc: input.doc, agent: input.agent, text: input.text, textHash, force }),
  ])
  return {
    provider_sync: { ...providerSyncOf(input.doc), cartesia: cartesiaResult.entry, elevenlabs: elevenLabsResult.entry },
    cartesia_doc_id: cartesiaResult.primaryId,
    elevenlabs_doc_id: elevenLabsResult.docId,
  }
}

/**
 * Deletes the provider copies of a document. Returns what couldn't be removed
 * (already logged); the caller still deletes the document locally.
 */
export async function removeDocumentFromProviders(doc: KnowledgeDocument): Promise<string[]> {
  const sync = providerSyncOf(doc)

  // Every copy is deleted in parallel: each request has its own 15 s timeout,
  // and the delete route must finish well inside its function budget.
  const removeCartesia = async (): Promise<boolean> => {
    const ids = [...new Set([...(sync.cartesia?.doc_ids ?? []), doc.cartesia_doc_id].filter((id): id is string => !!id))]
    if (ids.length === 0) return true
    if (!isCartesiaConfigured()) {
      console.warn('[knowledge] cartesia copies left behind: Cartesia is not configured', { documentId: doc.id, count: ids.length })
      return false
    }
    const results = await Promise.all(ids.map((id) => deleteCartesiaDocumentQuietly(id, doc.id)))
    return !results.includes(false)
  }

  const removeElevenLabs = async (): Promise<boolean> => {
    const ids = [...new Set([doc.elevenlabs_doc_id, sync.elevenlabs?.stale_doc_id].filter((id): id is string => !!id))]
    if (ids.length === 0) return true
    if (!isElevenLabsConfigured()) {
      console.warn('[knowledge] elevenlabs copies left behind: ElevenLabs is not configured', { documentId: doc.id, count: ids.length })
      return false
    }
    // force=true also detaches the document from the standby agent.
    const results = await Promise.all(
      ids.map((id) =>
        deleteElevenLabsDocument(id).then(
          () => true,
          (error: unknown) => {
            logProviderError('elevenlabs', 'document delete', doc.id, error)
            return false
          }
        )
      )
    )
    return !results.includes(false)
  }

  const [cartesiaDone, elevenLabsDone] = await Promise.all([removeCartesia(), removeElevenLabs()])
  const warnings: string[] = []
  if (!cartesiaDone) warnings.push('cartesia')
  if (!elevenLabsDone) warnings.push('elevenlabs')
  return warnings
}

/**
 * Attaches the knowledge an agent already has to its provider agents. For the
 * agent sync (S4) to call after it creates a Cartesia managed agent or an
 * ElevenLabs standby agent. Best effort; never throws.
 */
export async function attachAgentKnowledge(orgId: string, agentId: string): Promise<{ cartesia: boolean; elevenlabs: boolean }> {
  const result = { cartesia: false, elevenlabs: false }
  let admin: SupabaseClient
  let agent: KnowledgeAgentRef | null
  try {
    admin = requireKnowledgeAdmin()
    agent = await loadKnowledgeAgent(admin, orgId, agentId)
  } catch (error) {
    console.error('[knowledge] attach: agent lookup failed', { agentId, error: error instanceof Error ? error.message : String(error) })
    return result
  }
  if (!agent) return result

  if (isCartesiaConfigured() && agent.cartesia_agent_id) {
    try {
      const folderId = await knownCartesiaFolderId(admin, agent)
      if (folderId) {
        await cartesia.knowledge.attachFolderToAgent(folderId, agent.cartesia_agent_id)
        result.cartesia = true
      }
    } catch (error) {
      logProviderError('cartesia', 'folder attach', null, error)
    }
  }

  if (isElevenLabsConfigured() && agent.elevenlabs_agent_id) {
    try {
      const { data, error } = await admin
        .from('knowledge_documents')
        .select('id, name, elevenlabs_doc_id, character_count')
        .eq('org_id', orgId)
        .eq('agent_id', agentId)
        .not('elevenlabs_doc_id', 'is', null)
      if (error) throw new Error(`${error.code}: ${error.message}`)
      const rows = (data ?? []) as { id: string; name: string; elevenlabs_doc_id: string; character_count: number | null }[]
      const locators: ElevenLabsKnowledgeLocator[] = rows.map((row) => ({
        type: 'text',
        name: row.name,
        id: row.elevenlabs_doc_id,
        usage_mode: 'auto',
      }))
      if (locators.length > 0) {
        const standbyAgentId = agent.elevenlabs_agent_id
        // Long documents are only usable through RAG, indexed with this agent's model.
        const longDocs = rows.filter((row) => (row.character_count ?? 0) > ELEVENLABS_RAG_THRESHOLD_CHARS)
        let ragModel: string | null = null
        if (longDocs.length > 0) {
          const model = ragModelForAgent((await getElevenLabsAgentKnowledge(standbyAgentId)).rag)
          const indexed = await Promise.all(
            longDocs.map((row) =>
              computeElevenLabsRagIndex(row.elevenlabs_doc_id, model).then(
                () => true,
                (indexError: unknown) => {
                  logProviderError('elevenlabs', 'rag index', row.id, indexError)
                  return false
                }
              )
            )
          )
          if (indexed.includes(true)) ragModel = model
        }
        await withLock(elevenLabsAgentLock(standbyAgentId), { ttlSeconds: 30, waitMs: 10_000 }, () =>
          updateElevenLabsAgentKnowledge(standbyAgentId, { add: locators, enableRagModel: ragModel })
        )
      }
      result.elevenlabs = true
    } catch (error) {
      logProviderError('elevenlabs', 'agent attach', null, error)
    }
  }
  return result
}
