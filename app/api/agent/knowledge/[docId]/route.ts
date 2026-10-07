// GET    /api/agent/knowledge/[docId] → { document, text? } (text: pasted-text documents, for editing)
// PATCH  /api/agent/knowledge/[docId] { name?, text?, usage_mode? } → { document, warning }
//   In-place edits that keep the provider id: rename (pushed to the provider
//   and the agent), text edit (pasted text only), usage mode ('prompt' =
//   "Always include", for small documents within a per-organization cap).
// DELETE /api/agent/knowledge/[docId] → { success: true, warnings: string[] }
//   The document leaves the agent spec first (deleting_at + revision bump),
//   then the provider copy (force), the stored file and the row; the agent is
//   re-synced after the response. A provider failure → 502, document kept.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, apiError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { isProviderError } from '@/lib/voice-providers/errors'
import {
  KNOWLEDGE_BUCKET,
  KNOWLEDGE_DOC_COLUMNS,
  KNOWLEDGE_MAX_NAME_CHARS,
  KNOWLEDGE_MAX_TEXT_CHARS,
  isOrgStoragePath,
  parseDocId,
  readCapped,
  toDocumentView,
  type KnowledgeDocumentRow,
} from '@/lib/voice-providers/knowledge'
import { PROVIDER_DELETE_FAILED, ProviderDeleteError, deleteKnowledgeDocument } from '@/lib/voice-providers/knowledge-delete'
import { updateKnowledgeDocument } from '@/lib/voice-providers/knowledge-edit'
import { KNOWLEDGE_RATE_LIMITS } from '@/lib/voice-providers/knowledge-limits'

export const maxDuration = 60

// 300k characters can be up to ~1.2 MB of UTF-8, more once JSON-escaped.
const MAX_BODY_BYTES = 2 * 1024 * 1024
const TEXT_READ_MAX_BYTES = 2 * 1024 * 1024

const PatchSchema = z
  .strictObject({
    name: z.string().trim().min(1, 'Give the document a name.').max(KNOWLEDGE_MAX_NAME_CHARS, 'The name is too long.').optional(),
    text: z
      .string()
      .max(KNOWLEDGE_MAX_TEXT_CHARS, `The text can be up to ${KNOWLEDGE_MAX_TEXT_CHARS.toLocaleString('en-US')} characters.`)
      .refine((t) => t.trim().length > 0, 'Enter some text.')
      .refine((t) => !t.includes('\u0000'), 'The text contains invalid characters.')
      .optional(),
    usage_mode: z.enum(['auto', 'prompt']).optional(),
  })
  .refine((b) => b.name !== undefined || b.text !== undefined || b.usage_mode !== undefined, 'Nothing to change.')

export async function GET(request: Request, { params }: { params: Promise<{ docId: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.get' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const docId = parseDocId((await params).docId)
    // Under RLS: only the organization's own document.
    const { data, error } = await supabase.from('knowledge_documents').select(KNOWLEDGE_DOC_COLUMNS).eq('id', docId).eq('org_id', org.id).maybeSingle()
    if (error) throw new Error(`knowledge_documents read failed: ${error.message}`)
    if (!data) throw new RequestError('not_found', 'Document not found.', 404)
    const doc = data as unknown as KnowledgeDocumentRow
    let text: string | null = null
    if (doc.type === 'text' && doc.storage_path && isOrgStoragePath(org.id, doc.storage_path)) {
      const { data: stream, error: dlErr } = await createAdminClient()
        .storage.from(KNOWLEDGE_BUCKET)
        .download(doc.storage_path, {}, { signal: AbortSignal.timeout(20_000) })
        .asStream()
      if (dlErr || !stream) log.warn('agent.knowledge.text_read_failed', { error: dlErr?.message ?? 'no data' })
      else text = new TextDecoder('utf-8').decode(await readCapped(stream as ReadableStream<Uint8Array>, TEXT_READ_MAX_BYTES)).replace(/^﻿/, '')
    }
    return NextResponse.json({ document: toDocumentView(doc), text }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.get_failed', requestId)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ docId: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.patch' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const docId = parseDocId((await params).docId)
    log = log.child({ docId })

    // Ownership check under RLS before any service-role work.
    const { data: owned, error: ownErr } = await supabase.from('knowledge_documents').select('id').eq('id', docId).eq('org_id', org.id).maybeSingle()
    if (ownErr) throw new Error(`knowledge_documents read failed: ${ownErr.message}`)
    if (!owned) throw new RequestError('not_found', 'Document not found.', 404)

    const body = await parseJsonBody(request, PatchSchema, MAX_BODY_BYTES)
    // A content edit re-embeds the document: it counts against the upload budget too.
    await enforceRateLimit(KNOWLEDGE_RATE_LIMITS.edit, org.id, 'Too many changes. Please wait a while and try again.')
    if (body.text !== undefined) await enforceRateLimit(RATE_LIMITS.knowledgeUpload, org.id, 'Too many uploads. Please wait a while and try again.')

    const result = await updateKnowledgeDocument(org.id, docId, body, log)
    return NextResponse.json({ document: toDocumentView(result.document), warning: result.warning }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.patch_failed', requestId)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ docId: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.delete' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const docId = parseDocId((await params).docId)

    // Ownership check under RLS before any service-role work.
    const { data: doc, error: readErr } = await supabase
      .from('knowledge_documents')
      .select('id, agent_id')
      .eq('id', docId)
      .eq('org_id', org.id)
      .maybeSingle()
    if (readErr) throw new Error(`knowledge_documents read failed: ${readErr.message}`)
    if (!doc) throw new RequestError('not_found', 'Document not found.', 404)
    log = log.child({ docId, agentId: doc.agent_id as string })

    let result
    try {
      result = await deleteKnowledgeDocument(org.id, docId, log)
    } catch (err) {
      if (!(err instanceof ProviderDeleteError)) throw err
      const cause = err.cause
      return apiError('provider_error', PROVIDER_DELETE_FAILED, 502, {
        requestId,
        details: isProviderError(cause) ? { provider: cause.system, code: cause.code } : undefined,
      })
    }

    log.info('agent.knowledge.deleted', { hadProviderDoc: result.hadProviderDoc, warnings: result.warnings.length })
    return NextResponse.json({ success: true, warnings: result.warnings })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.delete_failed', requestId)
  }
}
