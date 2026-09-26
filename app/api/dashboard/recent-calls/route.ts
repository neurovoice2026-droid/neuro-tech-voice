import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { handleRoute, noStore, parseSearchParams } from '@/lib/api/http'
import { requireOrgContext } from '@/lib/api/auth'
import { dbError } from '@/app/api/calls/_lib/db'
import { CALL_LIST_COLUMNS } from '@/app/api/calls/_lib/query'

// GET /api/dashboard/recent-calls?limit=20 — newest real calls (test calls
// excluded) for the dashboard table and live activity feed.

export const runtime = 'nodejs'

const LIST_SELECT: string = `${CALL_LIST_COLUMNS}, agents(name)`

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

export const GET = handleRoute(async (req: NextRequest) => {
  const ctx = await requireOrgContext()
  const { limit } = parseSearchParams(req.nextUrl, QuerySchema)

  const { data, error } = await ctx.supabase
    .from('calls')
    .select(LIST_SELECT)
    .eq('org_id', ctx.org.id)
    .eq('is_test', false)
    .order('started_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw dbError(error, 'recent calls')

  const calls = (data ?? []).map((row) => {
    const { agents, ...rest } = row as unknown as Record<string, unknown> & { agents?: { name?: string | null } | null }
    return { ...rest, agent_name: agents?.name ?? null }
  })
  return noStore(NextResponse.json(calls))
})
