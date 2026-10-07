// GET /api/messages?status=open|done|all&limit=1..100 → messages the agent
// took during calls (call_messages), newest first, plus the number still open.
// Read with the signed-in user's client: RLS and an explicit org filter.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrg } from '@/lib/api/auth'
import { apiError, errorResponse, RequestError, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom } from '@/lib/observability/logger'
import { MESSAGE_COLUMNS, toMessageView } from '@/lib/voice-tools/message-view'

const Query = z.object({
  status: z.enum(['open', 'done', 'all']).default('open'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log = createLogger({ requestId, route: 'messages.list' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const url = new URL(request.url)
    const parsed = Query.safeParse({ status: url.searchParams.get('status') ?? undefined, limit: url.searchParams.get('limit') ?? undefined })
    if (!parsed.success) return apiError('invalid_request', 'Invalid filters.', 400, { requestId })
    const { status, limit } = parsed.data

    let query = supabase.from('call_messages').select(MESSAGE_COLUMNS).eq('org_id', org.id).order('created_at', { ascending: false }).limit(limit)
    if (status !== 'all') query = query.eq('status', status)
    const [{ data, error }, { count, error: countErr }] = await Promise.all([
      query,
      supabase.from('call_messages').select('id', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'open'),
    ])
    if (error) throw new Error(`call_messages read failed: ${error.message}`)
    if (countErr) throw new Error(`call_messages count failed: ${countErr.message}`)
    return NextResponse.json({ messages: (data ?? []).map((r) => toMessageView(r as Record<string, unknown>)), open_count: count ?? 0 })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'messages.list_failed', requestId)
  }
}
