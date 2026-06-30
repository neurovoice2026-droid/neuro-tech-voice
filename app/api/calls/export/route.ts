import { createClient } from '@/lib/supabase/server'
import { conversations, isConfigured as elConfigured } from '@/lib/elevenlabs/client'
import type { TranscriptEntry } from '@/types'

interface ExportCall {
  id: string
  caller_number: string | null
  direction: string
  duration_seconds: number
  status: string
  sentiment: string | null
  summary: string | null
  transcript: TranscriptEntry[]
  created_at: string | null
  agent_name?: string
}

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return new Response('Not found', { status: 404 })

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'csv'
  const columns = (searchParams.get('columns') ?? 'caller_number,direction,duration_seconds,status,sentiment,created_at').split(',')

  const { data: agent } = await supabase
    .from('agents')
    .select('name, elevenlabs_agent_id')
    .eq('org_id', org.id)
    .single()

  let rows: ExportCall[] = []

  // Try ElevenLabs
  if (elConfigured() && agent?.elevenlabs_agent_id) {
    try {
      // Fetch all conversations (paginate up to 200 for export)
      const data = await conversations.list({
        agent_id: agent.elevenlabs_agent_id,
        page_size: 100,
      })

      rows = (data.conversations ?? []).map((c) => {
        const startedAt = c.start_time_unix
          ? new Date(c.start_time_unix * 1000).toISOString()
          : null

        let sentiment: string | null = 'neutral'
        if (c.call_successful === 'true') sentiment = 'positive'
        else if (c.call_successful === 'false') sentiment = 'negative'

        const source = c.conversation_initiation_source ?? ''
        const direction = source === 'outbound' || source === 'phone_outbound'
          ? 'outbound' : 'inbound'

        return {
          id: c.conversation_id,
          caller_number: c.from_phone_number ?? c.to_phone_number ?? null,
          direction,
          duration_seconds: Math.round(c.call_duration_secs ?? 0),
          status: 'completed',
          sentiment,
          summary: null,
          transcript: [],
          created_at: startedAt,
          agent_name: agent.name ?? '',
        }
      })
    } catch {
      // Fall through to DB
    }
  }

  // Fallback or supplement from DB
  if (rows.length === 0) {
    const { data: calls } = await supabase
      .from('calls')
      .select('*, agents(name)')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })

    rows = (calls ?? []).map((c) => ({
      id: c.id,
      caller_number: c.caller_number,
      direction: c.direction,
      duration_seconds: c.duration_seconds,
      status: c.status,
      sentiment: c.sentiment,
      summary: c.summary,
      transcript: c.transcript ?? [],
      created_at: c.created_at,
      agent_name: (c.agents as { name?: string } | null)?.name ?? '',
    }))
  }

  const date = new Date().toISOString().slice(0, 10)

  if (format === 'json') {
    return new Response(JSON.stringify(rows, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="calls-${date}.json"`,
      },
    })
  }

  // CSV
  const COLUMN_LABELS: Record<string, string> = {
    caller_number: 'Phone Number',
    direction: 'Direction',
    duration_seconds: 'Duration (s)',
    status: 'Status',
    sentiment: 'Sentiment',
    created_at: 'Date & Time',
    summary: 'AI Summary',
    transcript: 'Transcript',
    agent_name: 'Agent',
  }

  const header = columns.map((c) => COLUMN_LABELS[c] ?? c).join(',')

  function escapeCSV(val: unknown): string {
    const s = val === null || val === undefined ? '' : String(val)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  function flattenTranscript(transcript: TranscriptEntry[]): string {
    return transcript.map((t) => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.message}`).join('\n')
  }

  const dataRows = rows.map((call) => {
    return columns.map((col) => {
      if (col === 'transcript') return escapeCSV(flattenTranscript(call.transcript ?? []))
      if (col === 'agent_name') return escapeCSV(call.agent_name ?? '')
      if (col === 'duration_seconds') return escapeCSV(call.duration_seconds)
      return escapeCSV((call as unknown as Record<string, unknown>)[col])
    }).join(',')
  })

  const csv = [header, ...dataRows].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="calls-${date}.csv"`,
    },
  })
}
