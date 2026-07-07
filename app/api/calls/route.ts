import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { conversations, isConfigured as elConfigured } from '@/lib/elevenlabs/client'
import type { ELConversationListItem } from '@/lib/elevenlabs/client'

// Map ElevenLabs conversation to our Call shape. started_at is left null
// (rather than a fabricated "now" or epoch) when ElevenLabs doesn't supply
// start_time_unix - the frontend must handle a missing date, not compute a
// relative time from a made-up value.
function mapConversation(c: ELConversationListItem, agentName: string | null) {
  const startedAt = c.start_time_unix
    ? new Date(c.start_time_unix * 1000).toISOString()
    : null
  const endedAt = c.end_time_unix
    ? new Date(c.end_time_unix * 1000).toISOString()
    : null

  // Determine status
  let status = 'completed'
  if (c.status === 'processing' || c.status === 'in-progress') status = 'in-progress'
  else if (c.status === 'failed') status = 'failed'

  // Determine sentiment from call_successful
  let sentiment: string | null = 'neutral'
  if (c.call_successful === 'true') sentiment = 'positive'
  else if (c.call_successful === 'false') sentiment = 'negative'

  // Determine direction
  const source = c.conversation_initiation_source ?? ''
  const direction = source === 'outbound' || source === 'phone_outbound'
    ? 'outbound' : 'inbound'

  return {
    id: c.conversation_id,
    elevenlabs_conversation_id: c.conversation_id,
    agent_id: c.agent_id,
    agent_name: agentName,
    caller_number: c.from_phone_number ?? c.to_phone_number ?? null,
    direction,
    duration_seconds: Math.round(c.call_duration_secs ?? 0),
    status,
    sentiment,
    started_at: startedAt,
    ended_at: endedAt,
    created_at: startedAt ?? new Date(0).toISOString(),
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.min(Number(searchParams.get('limit') ?? 25), 100)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? 'all'
  const direction = searchParams.get('direction') ?? 'all'
  const sentiment = searchParams.get('sentiment') ?? 'all'
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo = searchParams.get('dateTo') ?? ''
  const minDuration = Number(searchParams.get('minDuration') ?? 0)
  const sortBy = searchParams.get('sortBy') ?? 'created_at'
  const sortOrder = searchParams.get('sortOrder') === 'asc'

  // Get the org's agent to scope by ElevenLabs agent_id
  const { data: agent } = await supabase
    .from('agents')
    .select('name, elevenlabs_agent_id')
    .eq('org_id', org.id)
    .single()

  // If ElevenLabs is configured and agent has an EL ID, fetch from ElevenLabs
  if (elConfigured() && agent?.elevenlabs_agent_id) {
    try {
      const elParams: Record<string, unknown> = {
        agent_id: agent.elevenlabs_agent_id,
      }

      if (search) elParams.search = search
      if (dateFrom) elParams.call_start_after_unix = Math.floor(new Date(dateFrom).getTime() / 1000)
      if (dateTo) elParams.call_start_before_unix = Math.floor(new Date(dateTo).getTime() / 1000)
      if (minDuration > 0) elParams.call_duration_min_secs = minDuration

      // ElevenLabs paginates by cursor. Follow cursors (capped) so page numbers
      // beyond the first work and totals are accurate, then slice locally.
      const MAX_FETCH = 500
      const accumulated: ELConversationListItem[] = []
      let cursor: string | undefined
      let hasMoreUpstream = false
      do {
        const data = await conversations.list({
          ...(elParams as Parameters<typeof conversations.list>[0]),
          page_size: 100,
          cursor,
        })
        accumulated.push(...(data.conversations ?? []))
        cursor = data.next_cursor
        if (accumulated.length >= MAX_FETCH && cursor) { hasMoreUpstream = true; break }
      } while (cursor)

      let calls = accumulated.map((c) => mapConversation(c, agent.name ?? null))

      // Client-side filtering for fields ElevenLabs doesn't filter
      if (status !== 'all') calls = calls.filter((c) => c.status === status)
      if (direction !== 'all') calls = calls.filter((c) => c.direction === direction)
      if (sentiment !== 'all') calls = calls.filter((c) => c.sentiment === sentiment)

      // Sort
      calls.sort((a, b) => {
        let aVal: string | number = ''
        let bVal: string | number = ''
        if (sortBy === 'duration_seconds') {
          aVal = a.duration_seconds; bVal = b.duration_seconds
        } else if (sortBy === 'caller_number') {
          aVal = a.caller_number ?? ''; bVal = b.caller_number ?? ''
        } else {
          aVal = a.started_at ?? ''; bVal = b.started_at ?? ''
        }
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return sortOrder ? cmp : -cmp
      })

      const total = calls.length
      const totalPages = Math.max(1, Math.ceil(total / limit))
      const from = (page - 1) * limit
      const paged = calls.slice(from, from + limit)

      return NextResponse.json({
        calls: paged,
        total,
        page,
        totalPages,
        hasMore: page < totalPages || hasMoreUpstream,
      })
    } catch (err) {
      console.error('ElevenLabs conversations.list failed, falling back to DB:', err)
    }
  }

  // Fallback: read from Supabase
  let query = supabase
    .from('calls')
    .select('*, agents(name, voice_name)', { count: 'exact' })
    .eq('org_id', org.id)

  if (search) query = query.ilike('caller_number', `%${search}%`)
  if (status !== 'all') query = query.eq('status', status)
  if (direction !== 'all') query = query.eq('direction', direction)
  if (sentiment !== 'all') query = query.eq('sentiment', sentiment)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)
  if (minDuration > 0) query = query.gte('duration_seconds', minDuration)

  query = query.order(sortBy as 'created_at', { ascending: sortOrder })

  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data: calls, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten the joined agents(name) into a top-level agent_name, matching the
  // shape mapConversation() returns above, so the frontend only ever needs to
  // read one consistent field regardless of which path served the data.
  const flattened = (calls ?? []).map((c) => {
    const { agents, ...rest } = c as typeof c & { agents?: { name?: string | null } | null }
    return { ...rest, agent_name: agents?.name ?? null }
  })

  return NextResponse.json({
    calls: flattened,
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
    hasMore: page < Math.ceil((count ?? 0) / limit),
  })
}
