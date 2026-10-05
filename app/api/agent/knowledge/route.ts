// GET  /api/agent/knowledge → KnowledgeDocument[] for the org's agent (newest first).
// POST /api/agent/knowledge (legacy, multipart: file) → 201 KnowledgeDocument.
//   Small files only (≤ 4 MB: Vercel caps request bodies at 4.5 MB). Larger
//   files go through POST /api/agent/knowledge/upload-url (browser → Storage)
//   and then POST /api/agent/knowledge/[docId]/process.

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { defaultAgentName, ensureAgent } from '@/lib/agents/ensure-agent'
import {
  KNOWLEDGE_BUCKET,
  KNOWLEDGE_DOC_COLUMNS,
  KNOWLEDGE_LEGACY_MAX_FILE_BYTES,
  KNOWLEDGE_TYPES_LABEL,
  assertDocumentCapacity,
  cleanFileDisplayName,
  newDocumentId,
  processDocument,
  resolveFileType,
  safeFileName,
  storagePathFor,
  toDocumentView,
  validateContent,
  type KnowledgeDocumentRow,
} from '@/lib/voice-providers/knowledge'

// Upload to the provider + agent sync + RAG index + excerpt.
export const maxDuration = 120

/** 4 MB of file plus multipart overhead, under Vercel's 4.5 MB cap. */
const MAX_LEGACY_BODY_BYTES = KNOWLEDGE_LEGACY_MAX_FILE_BYTES + 256 * 1024

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.list' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })

    // Same agent ensureAgent() resolves to (oldest one), looked up by org under RLS.
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id')
      .eq('org_id', org.id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (agentErr) throw new Error(`agents read failed: ${agentErr.message}`)
    if (!agent) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

    const { data: docs, error } = await supabase
      .from('knowledge_documents')
      .select(KNOWLEDGE_DOC_COLUMNS)
      .eq('org_id', org.id)
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`knowledge_documents read failed: ${error.message}`)

    const now = Date.now()
    const view = ((docs ?? []) as unknown as KnowledgeDocumentRow[]).map((d) => toDocumentView(d, now))
    return NextResponse.json(view, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.list_failed', requestId)
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.upload_legacy' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit(RATE_LIMITS.knowledgeUpload, org.id, 'Too many uploads. Please wait a while and try again.')

    const contentType = (request.headers.get('content-type') ?? '').toLowerCase()
    if (!contentType.includes('multipart/form-data')) {
      throw new RequestError('unsupported_media_type', 'Expected a multipart/form-data upload.', 415)
    }
    const declared = Number(request.headers.get('content-length') ?? '0')
    if (declared > MAX_LEGACY_BODY_BYTES) {
      throw new RequestError('payload_too_large', 'Files over 4 MB must be added with the uploader in the Knowledge tab.', 413)
    }

    let form: FormData
    try {
      form = await request.formData()
    } catch (err) {
      throw new RequestError('invalid_request', 'The upload could not be read.', 400, {
        parse_error: err instanceof Error ? err.name : 'invalid multipart body',
      })
    }
    const entry = form.get('file')
    if (!entry || typeof entry === 'string') throw new RequestError('invalid_request', 'No file provided.', 400)
    const file = entry

    if (file.size > KNOWLEDGE_LEGACY_MAX_FILE_BYTES) {
      throw new RequestError('payload_too_large', 'Files over 4 MB must be added with the uploader in the Knowledge tab.', 413)
    }
    const name = cleanFileDisplayName(file.name)
    const type = resolveFileType(file.name, file.type)
    if (!name || !type) {
      throw new RequestError('unsupported_media_type', `Unsupported file type. Use ${KNOWLEDGE_TYPES_LABEL}.`, 415)
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    const problem = validateContent(type.kind, bytes)
    if (problem) throw new RequestError('unsupported_media_type', problem, 415)

    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    log = log.child({ agentId: agent.id })
    await assertDocumentCapacity(supabase, org.id, agent.id)

    const id = newDocumentId()
    const storagePath = storagePathFor(org.id, agent.id, id, safeFileName(name, type.ext))
    const admin = createAdminClient()
    const { error: uploadErr } = await admin.storage
      .from(KNOWLEDGE_BUCKET)
      .upload(storagePath, new Blob([bytes], { type: type.mime }), { contentType: type.mime, upsert: false })
    if (uploadErr) {
      log.error('agent.knowledge.storage_upload_failed', uploadErr)
      throw new RequestError('internal', 'The file could not be stored. Please try again.', 500)
    }

    const { error: insertErr } = await createAdminClient().from('knowledge_documents').insert({
      id,
      agent_id: agent.id,
      org_id: org.id,
      name,
      type: type.kind,
      storage_path: storagePath,
      size_bytes: bytes.byteLength,
      mime_type: type.mime,
      status: 'processing',
    })
    if (insertErr) {
      const { error: removeErr } = await admin.storage.from(KNOWLEDGE_BUCKET).remove([storagePath])
      if (removeErr) log.error('agent.knowledge.storage_cleanup_failed', removeErr, { docId: id })
      throw new Error(`knowledge_documents insert failed: ${insertErr.message}`)
    }

    log.info('agent.knowledge.uploaded_legacy', { docId: id, type: type.kind, bytes: bytes.byteLength })
    const doc = await processDocument(org.id, id, log)
    return NextResponse.json(toDocumentView(doc), { status: 201 })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.upload_legacy_failed', requestId)
  }
}
