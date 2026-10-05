// DELETE /api/agent/knowledge/[docId] → { success: true, warnings: string[] }
//
// Order matters so a failure can always be retried:
//   1. Provider document (force=true also detaches it from any agent using it).
//      "Not found" counts as done; any other failure → 502 and the row is kept.
//   2. Storage object (a failure is logged and reported as a warning).
//   3. Database row.
//   4. Agent config revision bump + re-sync of every active provider after the
//      response (the fallback agent's knowledge excerpt changes too).

import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, apiError, assertSameOrigin, errorResponse, requestErrorResponse } from '@/lib/api/http'
import * as el from '@/lib/elevenlabs/client'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { deferBackground } from '@/lib/observability/telemetry'
import { createAdminClient } from '@/lib/supabase/admin'
import { bumpRevision, syncAgent } from '@/lib/voice-providers/agent-sync'
import { isProviderError } from '@/lib/voice-providers/errors'
import { KNOWLEDGE_BUCKET, isOrgStoragePath, parseDocId } from '@/lib/voice-providers/knowledge'

export const maxDuration = 60

const PROVIDER_DELETE_FAILED = "The document could not be removed from your agent's voice provider. Please try again."
const STORAGE_WARNING = 'The stored copy of the file could not be removed. It will not be used by your agent.'

export async function DELETE(request: Request, { params }: { params: Promise<{ docId: string }> }) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'agent.knowledge.delete' })
  try {
    assertSameOrigin(request)
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const docId = parseDocId((await params).docId)

    const { data: doc, error: readErr } = await supabase
      .from('knowledge_documents')
      .select('id, agent_id, storage_path, elevenlabs_doc_id')
      .eq('id', docId)
      .eq('org_id', org.id)
      .maybeSingle()
    if (readErr) throw new Error(`knowledge_documents read failed: ${readErr.message}`)
    if (!doc) throw new RequestError('not_found', 'Document not found.', 404)
    const agentId = doc.agent_id as string
    log = log.child({ docId, agentId })

    // 1. Provider copy.
    const elDocId = doc.elevenlabs_doc_id as string | null
    if (elDocId) {
      try {
        await el.knowledgeBase.delete(elDocId, true, { orgId: org.id, agentId })
      } catch (err) {
        if (isProviderError(err) && err.code === 'not_found') {
          log.info('agent.knowledge.remote_already_gone', { elevenlabsDocId: elDocId })
        } else {
          log.error('agent.knowledge.remote_delete_failed', err, { elevenlabsDocId: elDocId })
          return apiError('provider_error', PROVIDER_DELETE_FAILED, 502, {
            requestId,
            details: isProviderError(err) ? { provider: err.system, code: err.code } : undefined,
          })
        }
      }
    }

    // 2. Stored file (only ever inside the org's own folder).
    const warnings: string[] = []
    const storagePath = doc.storage_path as string | null
    if (storagePath) {
      if (!isOrgStoragePath(org.id, storagePath)) {
        log.error('agent.knowledge.storage_path_outside_org', undefined)
        warnings.push(STORAGE_WARNING)
      } else {
        const { error: removeErr } = await createAdminClient().storage.from(KNOWLEDGE_BUCKET).remove([storagePath])
        if (removeErr) {
          log.error('agent.knowledge.storage_remove_failed', removeErr)
          warnings.push(STORAGE_WARNING)
        }
      }
    }

    // 3. Row.
    const { error: deleteErr } = await createAdminClient().from('knowledge_documents').delete().eq('id', docId).eq('org_id', org.id)
    if (deleteErr) throw new Error(`knowledge_documents delete failed: ${deleteErr.message}`)

    // 4. Agent config: the document is gone from the spec (and the fallback excerpt).
    try {
      await bumpRevision(agentId)
    } catch (err) {
      // The re-sync below still pushes the new config (its hash differs).
      log.error('agent.knowledge.revision_bump_failed', err)
    }
    deferBackground(
      syncAgent(agentId, { log })
        .then((results) => {
          for (const r of results) {
            if (r.status === 'failed' || r.status === 'degraded') {
              log.warn('agent.knowledge.delete_sync_unsuccessful', { provider: r.provider, status: r.status, errorCode: r.errorCode })
            }
          }
        })
        .catch((err: unknown) => log.error('agent.knowledge.delete_sync_failed', err)),
    )

    log.info('agent.knowledge.deleted', { hadProviderDoc: !!elDocId, warnings: warnings.length })
    return NextResponse.json({ success: true, warnings })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'agent.knowledge.delete_failed', requestId)
  }
}
