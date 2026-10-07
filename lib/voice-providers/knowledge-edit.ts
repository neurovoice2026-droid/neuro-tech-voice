import 'server-only'
// In-place changes to an existing knowledge document (same provider id, so
// no re-upload and no new locator):
//   • rename (any type): pushed to the provider and to the agent's locator;
//   • text edit (pasted text): Storage copy overwritten first (retries keep
//     working), then PATCH content; the provider re-embeds it;
//   • usage mode: 'prompt' pins a small document into every prompt, within a
//     per-organization character cap computed from server-written columns;
//   • refresh (URL): the provider re-fetches the page now;
//   • replace file: a new file uploaded through a signed URL swaps the source
//     (PATCH update-file), keeping the id and its agent attachment.
// Every function takes an org id the caller authorized with requireOrg().

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import * as kb from '@/lib/elevenlabs/api/knowledge'
import { RequestError } from '@/lib/api/http'
import { describeError, type Logger } from '@/lib/observability/logger'
import { normalizeAgentLanguage } from '@/lib/voice/languages'
import { isProviderError } from './errors'
import {
  EXCERPT_SOURCE_MAX_BYTES,
  KNOWLEDGE_BUCKET,
  KNOWLEDGE_DOC_COLUMNS,
  KNOWLEDGE_MAX_DOCS_PER_AGENT,
  KNOWLEDGE_MAX_FILE_BYTES,
  KnowledgeError,
  attachToAgent,
  cleanDisplayName,
  cleanFileDisplayName,
  excerptPatch,
  isOrgStoragePath,
  newDocumentId,
  readCapped,
  resolveFileType,
  safeFileName,
  scheduleFallbackSync,
  startRagIndex,
  storagePathFor,
  validateContent,
  type KnowledgeDocumentRow,
} from './knowledge'
import { assertBytesFit, orgKnowledgeUsage, promptCharBudget, promptDocMaxBytes } from './knowledge-limits'
import { assertWorkspaceRagHeadroom } from './knowledge-rag'
import { summaryPatch } from './knowledge-reconcile'

const FILE_TYPES = new Set(['pdf', 'docx', 'txt', 'md', 'html', 'epub'])
const STORAGE_TIMEOUT_MS = 45_000

async function loadOwned(db: SupabaseClient, orgId: string, docId: string): Promise<KnowledgeDocumentRow & { pending_storage_path: string | null }> {
  const { data, error } = await db
    .from('knowledge_documents')
    .select(`${KNOWLEDGE_DOC_COLUMNS}, pending_storage_path`)
    .eq('id', docId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw new Error(`knowledge_documents read failed: ${error.message}`)
  if (!data) throw new RequestError('not_found', 'Document not found.', 404)
  return data as unknown as KnowledgeDocumentRow & { pending_storage_path: string | null }
}

async function patchRow(db: SupabaseClient, orgId: string, docId: string, patch: Record<string, unknown>): Promise<KnowledgeDocumentRow> {
  const { data, error } = await db.from('knowledge_documents').update(patch).eq('id', docId).eq('org_id', orgId).select(KNOWLEDGE_DOC_COLUMNS).maybeSingle()
  if (error) throw new Error(`knowledge_documents update failed: ${error.message}`)
  if (!data) throw new RequestError('not_found', 'This document was deleted.', 404)
  return data as unknown as KnowledgeDocumentRow
}

/** Only settled documents can be edited in place (no run in flight, not being deleted). */
function assertEditable(doc: KnowledgeDocumentRow): string {
  if (doc.deleting_at) throw new RequestError('conflict', 'This document is being deleted.', 409)
  if (doc.status === 'processing') throw new RequestError('conflict', 'This document is still being processed. Try again in a moment.', 409)
  if (doc.status !== 'ready' || !doc.elevenlabs_doc_id) {
    throw new RequestError('conflict', 'This document is not on your agent yet. Retry it first.', 409)
  }
  return doc.elevenlabs_doc_id
}

/** Pushes the agent config after a locator change (name or usage mode). Returns a warning instead of failing. */
async function pushLocatorChange(db: SupabaseClient, orgId: string, agentId: string, log: Logger): Promise<string | null> {
  try {
    await attachToAgent(db, orgId, agentId, log)
    return null
  } catch (err) {
    log.warn('knowledge.locator_push_failed', { error: describeError(err) })
    return err instanceof KnowledgeError ? err.message : 'The change is saved and will reach your agent shortly.'
  }
}

export interface UpdateDocumentInput {
  name?: string
  text?: string
  usage_mode?: 'auto' | 'prompt'
}

export interface UpdateResult {
  document: KnowledgeDocumentRow
  warning: string | null
}

/**
 * Applies a rename, a text edit and/or a usage-mode change. Throws RequestError
 * for anything the owner can fix and ProviderError when the provider refuses.
 */
export async function updateKnowledgeDocument(orgId: string, docId: string, input: UpdateDocumentInput, log: Logger): Promise<UpdateResult> {
  const db = createAdminClient()
  let doc: KnowledgeDocumentRow = await loadOwned(db, orgId, docId)
  const ctx = { orgId, agentId: doc.agent_id }

  const name = input.name !== undefined ? cleanDisplayName(input.name) : undefined
  if (input.name !== undefined && !name) throw new RequestError('invalid_request', 'Give the document a name.', 400)
  const renamed = name !== undefined && name !== doc.name
  const textChanged = input.text !== undefined
  const modeChanged = input.usage_mode !== undefined && input.usage_mode !== (doc.usage_mode ?? 'auto')
  if (!renamed && !textChanged && !modeChanged) return { document: doc, warning: null }

  // A document without a provider copy (failed upload) can still be renamed locally.
  if (renamed && !textChanged && !modeChanged && (doc.status === 'failed' || !doc.elevenlabs_doc_id) && !doc.deleting_at && doc.status !== 'processing') {
    return { document: await patchRow(db, orgId, docId, { name }), warning: null }
  }
  const elId = assertEditable(doc)

  if (textChanged) {
    if (doc.type !== 'text') throw new RequestError('invalid_request', 'Only pasted text can be edited. Replace the file or refresh the page instead.', 400)
    const text = (input.text as string).replace(/\r\n?/g, '\n')
    const bytes = new TextEncoder().encode(text)
    const usage = await orgKnowledgeUsage(db, orgId, KNOWLEDGE_MAX_DOCS_PER_AGENT)
    assertBytesFit(usage, bytes.byteLength - Number(doc.size_bytes ?? 0))
    if (doc.usage_mode === 'prompt' && usage.promptChars - Number(doc.character_count ?? 0) + text.length > usage.promptCharsLimit) {
      throw new RequestError('conflict', 'This text is too long to stay "Always include". Shorten it or switch it to automatic first.', 409)
    }
    // Storage first: a later re-upload (heal, retry) must use the new text.
    if (!doc.storage_path || !isOrgStoragePath(orgId, doc.storage_path)) {
      log.error('knowledge.edit_storage_path_invalid', undefined)
      throw new RequestError('conflict', 'The text of this document is missing. Delete it and add it again.', 409)
    }
    const { error: uploadErr } = await db.storage
      .from(KNOWLEDGE_BUCKET)
      .upload(doc.storage_path, new Blob([bytes], { type: 'text/plain;charset=utf-8' }), { contentType: 'text/plain;charset=utf-8', upsert: true })
    if (uploadErr) {
      log.error('knowledge.edit_storage_failed', uploadErr)
      throw new RequestError('internal', 'The text could not be saved. Please try again.', 500)
    }
    await kb.updateDocument(elId, { content: text, ...(renamed ? { name } : {}) }, ctx)
    doc = await patchRow(db, orgId, docId, {
      ...(renamed ? { name } : {}),
      size_bytes: bytes.byteLength,
      ...excerptPatch(text, false),
      last_synced_at: new Date().toISOString(),
    })
    log.info('knowledge.text_edited', { chars: text.length, renamed })
    const language = await agentLanguage(db, orgId, doc.agent_id)
    doc = await startRagIndex(db, doc, elId, language, ctx, log)
  } else if (renamed) {
    await kb.updateDocument(elId, { name }, ctx)
    doc = await patchRow(db, orgId, docId, { name })
    log.info('knowledge.renamed')
  }

  if (modeChanged) doc = await applyUsageMode(db, orgId, doc, elId, input.usage_mode as 'auto' | 'prompt', log)

  let warning: string | null = null
  // The locator carries the name and the usage mode; content edits keep the id.
  if (renamed || modeChanged) warning = await pushLocatorChange(db, orgId, doc.agent_id, log)
  if (textChanged) scheduleFallbackSync(doc.agent_id, log)
  return { document: doc, warning }
}

async function agentLanguage(db: SupabaseClient, orgId: string, agentId: string): Promise<string> {
  const { data, error } = await db.from('agents').select('language').eq('id', agentId).eq('org_id', orgId).maybeSingle()
  if (error) throw new Error(`agents read failed: ${error.message}`)
  return normalizeAgentLanguage((data?.language as string | null) ?? null)
}

/**
 * 'prompt' only for small documents the provider allows in the prompt, and
 * within the organization's character cap. Checked again after the write: two
 * concurrent pins cannot both slip past the cap.
 */
async function applyUsageMode(
  db: SupabaseClient,
  orgId: string,
  doc: KnowledgeDocumentRow,
  elId: string,
  mode: 'auto' | 'prompt',
  log: Logger,
): Promise<KnowledgeDocumentRow> {
  if (mode === 'auto') return patchRow(db, orgId, doc.id, { usage_mode: 'auto' })

  if (doc.type !== 'text' && Number(doc.size_bytes ?? 0) > promptDocMaxBytes()) {
    throw new RequestError('conflict', 'Only short documents can be always included. Use pasted text for key facts like hours and prices.', 409)
  }
  const chars = Number(doc.character_count ?? 0)
  if (chars <= 0) throw new RequestError('conflict', 'This document is still being read. Try again in a moment.', 409)
  const summary = (await kb.summaries([elId], { orgId, agentId: doc.agent_id }))[elId]
  if (!summary || summary.status !== 'success') {
    if (kb.isMissing(summary)) throw new RequestError('conflict', 'This document is no longer at the voice provider. Retry it first.', 409)
    throw new RequestError('provider_error', 'The voice provider did not answer. Please try again.', 502)
  }
  const supported = summary.data.supported_usages ?? []
  const refreshed = await patchRow(db, orgId, doc.id, summaryPatch(summary.data, { includeSize: doc.type === 'url' }))
  if (!supported.includes('prompt')) {
    throw new RequestError('conflict', 'The voice provider cannot always include this document. It stays automatic.', 409)
  }
  const limit = promptCharBudget()
  const used = await promptCharsUsed(db, orgId, doc.id)
  if (used + chars > limit) {
    throw new RequestError(
      'conflict',
      `"Always include" is limited to ${limit.toLocaleString('en-US')} characters in total (${used.toLocaleString('en-US')} used). Switch another document to automatic or shorten this one.`,
      409,
    )
  }
  const pinned = await patchRow(db, orgId, refreshed.id, { usage_mode: 'prompt' })
  if ((await promptCharsUsed(db, orgId, null)) > limit) {
    // Lost a race with another pin: undo ours.
    log.warn('knowledge.prompt_cap_race_reverted')
    await patchRow(db, orgId, doc.id, { usage_mode: 'auto' })
    throw new RequestError('conflict', 'Another change used the "Always include" space. Please try again.', 409)
  }
  return pinned
}

async function promptCharsUsed(db: SupabaseClient, orgId: string, excludeId: string | null): Promise<number> {
  const { data, error } = await db.from('knowledge_documents').select('id, character_count, deleting_at').eq('org_id', orgId).eq('usage_mode', 'prompt')
  if (error) throw new Error(`knowledge_documents read failed: ${error.message}`)
  return (data ?? []).filter((d) => d.id !== excludeId && !d.deleting_at).reduce((sum, d) => sum + Math.max(0, Number(d.character_count ?? 0)), 0)
}

// ─── Refresh (URL) ───────────────────────────────────────────────────────────

/** Re-fetches a URL document now (same id). The excerpt is built from the response: no second content call. */
export async function refreshUrlKnowledgeDocument(orgId: string, docId: string, log: Logger): Promise<KnowledgeDocumentRow> {
  const db = createAdminClient()
  const doc = await loadOwned(db, orgId, docId)
  if (doc.type !== 'url') throw new RequestError('invalid_request', 'Only web pages can be refreshed.', 400)
  const elId = assertEditable(doc)
  const ctx = { orgId, agentId: doc.agent_id }
  let res: kb.KnowledgeDocumentFull
  try {
    res = await kb.refreshUrlDocument(elId, ctx)
  } catch (err) {
    if (isProviderError(err) && err.code === 'validation') {
      throw new RequestError('conflict', 'This page could not be refreshed. Check that it is still public and reachable.', 409)
    }
    throw err
  }
  const raw = typeof res?.extracted_inner_html === 'string' ? res.extracted_inner_html : ''
  const truncated = raw.length > EXCERPT_SOURCE_MAX_BYTES
  let updated = await patchRow(db, orgId, docId, {
    ...summaryPatch(res, { includeSize: true }),
    ...excerptPatch(truncated ? raw.slice(0, EXCERPT_SOURCE_MAX_BYTES) : raw, truncated),
    last_synced_at: new Date().toISOString(),
  })
  log.info('knowledge.url_refreshed', { sizeBytes: updated.size_bytes })
  updated = await startRagIndex(db, updated, elId, await agentLanguage(db, orgId, doc.agent_id), ctx, log)
  scheduleFallbackSync(doc.agent_id, log)
  return updated
}

// ─── Replace file ────────────────────────────────────────────────────────────

export interface ReplaceStart {
  document: KnowledgeDocumentRow
  upload: { path: string; token: string; signedUrl: string }
}

/** Step 1: a signed upload URL for the new file, in the organization's folder. */
export async function startFileReplacement(
  supabase: SupabaseClient,
  orgId: string,
  docId: string,
  file: { name: string; size: number; mime: string },
  log: Logger,
): Promise<ReplaceStart> {
  const db = createAdminClient()
  const doc = await loadOwned(db, orgId, docId)
  if (!FILE_TYPES.has(doc.type)) throw new RequestError('invalid_request', 'Only uploaded files can be replaced.', 400)
  assertEditable(doc)
  if (file.size > KNOWLEDGE_MAX_FILE_BYTES) throw new RequestError('payload_too_large', 'Files can be up to 20 MB.', 413)
  const type = resolveFileType(file.name, file.mime)
  const name = cleanFileDisplayName(file.name)
  if (!type || !name) throw new RequestError('unsupported_media_type', 'Unsupported file type.', 415)
  const usage = await orgKnowledgeUsage(supabase, orgId, KNOWLEDGE_MAX_DOCS_PER_AGENT)
  assertBytesFit(usage, file.size - Number(doc.size_bytes ?? 0))
  await assertWorkspaceRagHeadroom(log)

  const path = storagePathFor(orgId, doc.agent_id, newDocumentId(), safeFileName(name, type.ext))
  const previousPending = doc.pending_storage_path
  const updated = await patchRow(db, orgId, docId, { pending_storage_path: path })
  if (previousPending && isOrgStoragePath(orgId, previousPending)) {
    const { error } = await db.storage.from(KNOWLEDGE_BUCKET).remove([previousPending])
    if (error) log.warn('knowledge.replace_stale_pending_remove_failed', { error: error.message })
  }
  const { data: signed, error: signErr } = await db.storage.from(KNOWLEDGE_BUCKET).createSignedUploadUrl(path)
  if (signErr || !signed) {
    log.error('knowledge.replace_signed_url_failed', signErr)
    await patchRow(db, orgId, docId, { pending_storage_path: null })
    throw new RequestError('internal', 'Could not prepare the upload. Please try again.', 500)
  }
  log.info('knowledge.replace_started', { type: type.kind, bytes: file.size })
  return { document: updated, upload: { path: signed.path, token: signed.token, signedUrl: signed.signedUrl } }
}

/**
 * Step 2: validates the uploaded file, swaps it at the provider (same id, same
 * agent attachment), then makes it the document's stored source.
 */
export async function completeFileReplacement(orgId: string, docId: string, displayName: string | null, log: Logger): Promise<UpdateResult> {
  const db = createAdminClient()
  const doc = await loadOwned(db, orgId, docId)
  const elId = assertEditable(doc)
  const pending = doc.pending_storage_path
  if (!pending) throw new RequestError('conflict', 'No replacement file was uploaded.', 409)
  if (!isOrgStoragePath(orgId, pending)) {
    log.error('knowledge.replace_path_outside_org', undefined)
    throw new RequestError('conflict', 'No replacement file was uploaded.', 409)
  }
  // Claim the pending upload so two completions cannot both apply it.
  const { data: claimed, error: claimErr } = await db
    .from('knowledge_documents')
    .update({ pending_storage_path: null })
    .eq('id', docId)
    .eq('org_id', orgId)
    .eq('pending_storage_path', pending)
    .select('id')
  if (claimErr) throw new Error(`knowledge_documents claim failed: ${claimErr.message}`)
  if (!claimed?.length) throw new RequestError('conflict', 'This replacement is already being applied.', 409)

  const removePending = async () => {
    const { error } = await db.storage.from(KNOWLEDGE_BUCKET).remove([pending])
    if (error) log.warn('knowledge.replace_pending_remove_failed', { error: error.message })
  }
  /** A transient failure: hand the upload back so the owner can retry the completion. */
  const restorePending = async () => {
    const { error } = await db.from('knowledge_documents').update({ pending_storage_path: pending }).eq('id', docId).eq('org_id', orgId).is('pending_storage_path', null)
    if (error) log.error('knowledge.replace_restore_pending_failed', error)
  }

  const ext = pending.slice(pending.lastIndexOf('.') + 1)
  const type = resolveFileType(`file.${ext}`, '')
  if (!type) {
    await removePending()
    throw new RequestError('unsupported_media_type', 'Unsupported file type.', 415)
  }
  let bytes: Uint8Array<ArrayBuffer>
  try {
    const { data: stream, error: dlErr } = await db.storage
      .from(KNOWLEDGE_BUCKET)
      .download(pending, {}, { signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS) })
      .asStream()
    if (dlErr || !stream) {
      const status = Number(dlErr?.status ?? dlErr?.statusCode ?? 0)
      if (status === 400 || status === 404) throw new RequestError('conflict', 'The upload did not complete. Please upload the file again.', 409)
      throw new Error(`storage download failed: ${dlErr?.message ?? 'no data'}`)
    }
    bytes = await readCapped(stream as ReadableStream<Uint8Array>, KNOWLEDGE_MAX_FILE_BYTES)
  } catch (err) {
    if (err instanceof KnowledgeError) {
      await removePending()
      throw new RequestError('payload_too_large', err.message, 413)
    }
    if (!(err instanceof RequestError)) await restorePending()
    throw err
  }
  const problem = validateContent(type.kind, bytes)
  if (problem) {
    await removePending()
    throw new RequestError('unsupported_media_type', problem, 415)
  }
  const usage = await orgKnowledgeUsage(db, orgId, KNOWLEDGE_MAX_DOCS_PER_AGENT)
  try {
    assertBytesFit(usage, bytes.byteLength - Number(doc.size_bytes ?? 0))
  } catch (err) {
    await removePending()
    throw err
  }

  const name = cleanFileDisplayName(displayName ?? '') || doc.name
  const ctx = { orgId, agentId: doc.agent_id }
  let res: kb.KnowledgeDocumentFull
  try {
    res = await kb.updateFile(elId, new Blob([bytes], { type: type.mime }), safeFileName(name, type.ext), ctx)
  } catch (err) {
    // Keep the upload so the owner can retry the completion.
    await restorePending()
    if (isProviderError(err) && err.code === 'validation') {
      throw new RequestError('unsupported_media_type', 'The document could not be read. Check that it is not empty, password-protected or damaged.', 415)
    }
    throw err
  }

  const previousPath = doc.storage_path
  const raw = typeof res?.extracted_inner_html === 'string' ? res.extracted_inner_html : ''
  const truncated = raw.length > EXCERPT_SOURCE_MAX_BYTES
  let updated = await patchRow(db, orgId, docId, {
    storage_path: pending,
    size_bytes: bytes.byteLength,
    type: type.kind,
    mime_type: type.mime,
    name,
    ...excerptPatch(truncated ? raw.slice(0, EXCERPT_SOURCE_MAX_BYTES) : raw, truncated),
    ...(res ? summaryPatch(res, { includeSize: false }) : {}),
    last_synced_at: new Date().toISOString(),
  })
  if (previousPath && previousPath !== pending && isOrgStoragePath(orgId, previousPath)) {
    const { error } = await db.storage.from(KNOWLEDGE_BUCKET).remove([previousPath])
    if (error) log.warn('knowledge.replace_old_remove_failed', { error: error.message })
  }
  log.info('knowledge.file_replaced', { type: type.kind, bytes: bytes.byteLength })
  updated = await startRagIndex(db, updated, elId, await agentLanguage(db, orgId, doc.agent_id), ctx, log)
  // The locator carries our name (every file kind maps to locator type 'file').
  const warning = name !== doc.name ? await pushLocatorChange(db, orgId, doc.agent_id, log) : null
  scheduleFallbackSync(doc.agent_id, log)
  return { document: updated, warning }
}
