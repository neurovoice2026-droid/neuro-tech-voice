// GET /api/phone — the organization's numbers with their routing state.
import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/api/auth'
import { RequestError, errorResponse, requestErrorResponse } from '@/lib/api/http'
import { createLogger, requestIdFrom, type Logger } from '@/lib/observability/logger'

export async function GET(request: Request) {
  const requestId = requestIdFrom(request)
  let log: Logger = createLogger({ requestId, route: 'phone.list' })
  try {
    const { supabase, org } = await requireOrg()
    log = log.child({ orgId: org.id })
    const { data: numbers, error } = await supabase
      .from('phone_numbers')
      .select('*, agents(name)')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`phone_numbers read failed: ${error.message}`)
    return NextResponse.json(numbers ?? [], { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    if (err instanceof RequestError) return requestErrorResponse(err, requestId)
    return errorResponse(err, log, 'phone.list_failed', requestId)
  }
}
