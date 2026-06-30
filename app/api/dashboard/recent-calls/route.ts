import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { conversations, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: agent } = await supabase
    .from('agents')
    .select('elevenlabs_agent_id')
    .eq('org_id', org.id)
    .single()

  // Try ElevenLabs
  if (elConfigured() && agent?.elevenlabs_agent_id) {
    try {
      const data = await conversations.list({
        agent_id: agent.elevenlabs_agent_id,
        page_size: limit,
      })

      const calls = (data.conversations ?? []).map((c) => {
        const startedAt = c.start_time_unix
          ? new Date(c.start_time_unix * 1000).toISOString()
          : new Date().toISOString()
        const endedAt = c.end_time_unix
          ? new Date(c.end_time_unix * 1000).toISOString()
          : null

        let sentiment: string | null = 'neutral'
        if (c.call_successful === 'true') sentiment = 'positive'
        else if (c.call_successful === 'false') sentiment = 'negative'

        const source = c.conversation_initiation_source ?? ''
        const direction = source === 'outbound' || source === 'phone_outbound'
          ? 'outbound' : 'inbound'

        return {
          id: c.conversation_id,
          elevenlabs_conversation_id: c.conversation_id,
          org_id: org.id,
          agent_id: c.agent_id,
          caller_number: c.from_phone_number ?? c.to_phone_number ?? null,
          direction,
          duration_seconds: Math.round(c.call_duration_secs ?? 0),
          status: c.status === 'done' || c.call_duration_secs ? 'completed' : c.status ?? 'completed',
          sentiment,
          started_at: startedAt,
          ended_at: endedAt,
          created_at: startedAt,
        }
      })

      return NextResponse.json(calls)
    } catch (err) {
      console.error('ElevenLabs recent-calls failed, falling back to DB:', err)
    }
  }

  // Fallback: Supabase
  const { data: calls } = await supabase
    .from('calls')
    .select('*')
    .eq('org_id', org.id)
    .order('started_at', { ascending: false })
    .limit(limit)

  return NextResponse.json(calls ?? [])
}
