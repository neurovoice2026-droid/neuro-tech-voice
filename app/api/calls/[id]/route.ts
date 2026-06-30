import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { conversations, isConfigured as elConfigured } from '@/lib/elevenlabs/client'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Try ElevenLabs first — the id could be an elevenlabs_conversation_id
  if (elConfigured()) {
    try {
      const conv = await conversations.get(id)

      // Verify this conversation belongs to the user's org
      const { data: agent } = await supabase
        .from('agents')
        .select('id, name, voice_name')
        .eq('elevenlabs_agent_id', conv.agent_id)
        .eq('org_id', org.id)
        .single()

      if (agent) {
        const metadata = conv.metadata ?? {}
        const analysis = conv.analysis ?? {}

        const startedAt = metadata.start_time_unix
          ? new Date(metadata.start_time_unix * 1000).toISOString()
          : null
        const endedAt = metadata.end_time_unix
          ? new Date(metadata.end_time_unix * 1000).toISOString()
          : null

        let sentiment: string | null = 'neutral'
        if (analysis.call_successful === 'true') sentiment = 'positive'
        else if (analysis.call_successful === 'false') sentiment = 'negative'

        const source = String(conv.conversation_initiation_client_data?.source ?? metadata.direction ?? '')
        const direction = source === 'outbound' ? 'outbound' : 'inbound'

        return NextResponse.json({
          id: conv.conversation_id,
          elevenlabs_conversation_id: conv.conversation_id,
          org_id: org.id,
          agent_id: agent.id,
          caller_number: metadata.from_number ?? null,
          direction,
          duration_seconds: Math.round(metadata.call_duration_secs ?? 0),
          status: conv.status === 'done' ? 'completed' : conv.status ?? 'completed',
          transcript: (conv.transcript ?? []).map((t) => ({
            role: t.role === 'agent' ? 'agent' : 'user',
            message: t.message,
            time_in_call_secs: t.time_in_call_secs ?? 0,
          })),
          sentiment,
          summary: analysis.transcript_summary ?? null,
          recording_url: null, // Audio fetched separately
          started_at: startedAt,
          ended_at: endedAt,
          created_at: startedAt,
          agents: { name: agent.name, voice_name: agent.voice_name },
        })
      }
    } catch {
      // Not found in ElevenLabs or not authorized — fall through to DB
    }
  }

  // Fallback: read from Supabase
  const { data: call, error } = await supabase
    .from('calls')
    .select('*, agents(name, voice_name)')
    .eq('id', id)
    .eq('org_id', org.id)
    .single()

  if (error || !call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

  return NextResponse.json(call)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete from ElevenLabs
  if (elConfigured()) {
    try {
      await conversations.delete(id)
    } catch {
      // May not exist in EL — continue to delete from DB
    }
  }

  // Also delete from local DB cache (by conversation_id or by uuid)
  await supabase
    .from('calls')
    .delete()
    .eq('org_id', org.id)
    .or(`id.eq.${id},elevenlabs_conversation_id.eq.${id}`)

  return NextResponse.json({ success: true })
}
