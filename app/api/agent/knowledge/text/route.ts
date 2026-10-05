// POST /api/agent/knowledge/text  { name, text } → 201 KnowledgeDocument
//
// Adds pasted text (≤ 300,000 characters, about what fits in an agent prompt).
// The text is also stored as a UTF-8 .txt object in the org's Storage folder so
// a failed run can be retried without asking for it again.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, assertSameOrigin, errorResponse, parseJsonBody, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { defaultAgentName, ensureAgent } from '@/lib/agents/ensure-agent'
import {
  KNOWLEDGE_BUCKET,
  KNOWLEDGE_MAX_NAME_CHARS,
  KNOWLEDGE_MAX_TEXT_CHARS,
  assertDocumentCapacity,
  cleanDisplayName,
  newDocumentId,
  processDocument,
  safeFileName,
  storagePathFor,
  toDocumentView,
} from '@/lib/voice-providers/knowledge'

export const maxDuration = 120

// 300k characters can be up to ~1.2 MB of UTF-8, more once JSON-escaped.
const MAX_BODY_BYTES = 2 * 1024 * 1024

const BodySchema = z.object({
  name: z.string().trim().min(1, 'Give the text a name.').max(KNOWLEDGE_MAX_NAME_CHARS, 'The name is too long.'),
  text: z
    .string()
    .max(KNOWLEDGE_MAX_TEXT_CHARS, `The text can be up to ${KNOWLEDGE_MAX_TEXT_CHARS.toLocaleString('en-US')} characters.`)
    .refine((t) => t.trim().length > 0, 'Enter some text.')
    .refine((t) => !t.includes('\u0000'), 'The text contains invalid characters.'),
})

export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.text' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    await enforceRateLimit(RATE_LIMITS.knowledgeUpload, org.id, 'Too many uploads. Please wait a while and try again.')

    const body = await parseJsonBody(request, BodySchema, MAX_BODY_BYTES)
    const name = cleanDisplayName(body.name)
    if (!name) throw new RequestError('invalid_request', 'Give the text a name.', 400)
    const text = body.text.replace(/\r\n?/g, '\n')
    const bytes = new TextEncoder().encode(text)

    const agent = await ensureAgent(org.id, defaultAgentName(org.name))
    log = log.child({ agentId: agent.id })
    await assertDocumentCapacity(supabase, org.id, agent.id)

    const id = newDocumentId()
    const storagePath = storagePathFor(org.id, agent.id, id, safeFileName(name, 'txt'))
    const admin = createAdminClient()
    const { error: uploadErr } = await admin.storage
      .from(KNOWLEDGE_BUCKET)
      .upload(storagePath, new Blob([bytes], { type: 'text/plain;charset=utf-8' }), {
        contentType: 'text/plain;charset=utf-8',
        upsert: false,
      })
    if (uploadErr) {
      log.error('agent.knowledge.storage_upload_failed', uploadErr)
      throw new RequestError('internal', 'The text could not be stored. Please try again.', 500)
    }

    const { error: insertErr } = await createAdminClient().from('knowledge_documents').insert({
      id,
      agent_id: agent.id,
      org_id: org.id,
      name,
      type: 'text',
      storage_path: storagePath,
      size_bytes: bytes.byteLength,
      character_count: text.length,
      mime_type: 'text/plain',
      status: 'processing',
    })
    if (insertErr) {
      const { error: removeErr } = await admin.storage.from(KNOWLEDGE_BUCKET).remove([storagePath])
      if (removeErr) log.error('agent.knowledge.storage_cleanup_failed', removeErr, { docId: id })
      throw new Error(`knowledge_documents insert failed: ${insertErr.message}`)
    }

    log.info('agent.knowledge.text_added', { docId: id, chars: text.length })
    const doc = await processDocument(org.id, id, log)
    return NextResponse.json(toDocumentView(doc), { status: 201 })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.text_failed', requestId)
  }
}
