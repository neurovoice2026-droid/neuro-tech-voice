// PATCH /api/messages/[id] {status: 'open' | 'done'} → marks a message taken
// during a call as followed up (or re-opens it). The id must be one of the
// org's own messages; the write uses the service role scoped by org id
// (tenants cannot write call_messages, migration 018).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { apiError, assertSameOrigin, errorResponse, parseJsonBody, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { MESSAGE_COLUMNS, toMessageView } from '@/lib/voice-tools/message-view'

type RouteParams = { params: Promise<{ id: string }> }

const Body = z.strictObject({ status: z.enum(['open', 'done']) })
const Id = z.uuid()

export async function PATCH(request: Request, { params }: RouteParams) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'messages.update' })
  try {
    assertSameOrigin(request)
    const { org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const id = Id.safeParse((await params).id)
    if (!id.success) return apiError('invalid_request', 'Invalid message id.', 400, { requestId })
    const body = await parseJsonBody(request, Body, 1024)

    const { data, error } = await createAdminClient()
      .from('call_messages')
      .update({ status: body.status, done_at: body.status === 'done' ? new Date().toISOString() : null })
      .eq('id', id.data)
      .eq('org_id', org.id)
      .select(MESSAGE_COLUMNS)
      .maybeSingle()
    if (error) throw new Error(`call_messages update failed: ${error.message}`)
    if (!data) return apiError('not_found', 'Message not found', 404, { requestId })
    log.info('messages.updated', { status: body.status })
    return NextResponse.json({ message: toMessageView(data as Record<string, unknown>) })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'messages.update_failed', requestId)
  }
}
