import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeWorkflows, type CallContext } from '@/lib/workflows/executor'
import { isWebhookConfigured, verifyWebhookSignature } from '@/lib/elevenlabs/client'

// ElevenLabs sends webhook events when conversations complete
export async function POST(request: Request) {
  const rawBody = await request.text()

  // Verify HMAC signature when a webhook secret is configured.
  if (
    isWebhookConfigured() &&
    !verifyWebhookSignature(rawBody, request.headers.get('elevenlabs-signature'))
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = body.type ?? body.event_type ?? ''
  const data = body.data ?? body

  // Handle conversation.completed event
  if (eventType === 'conversation.completed' || data.conversation_id) {
    try {
      // Webhook context (no user) → service-role client to bypass RLS.
      const supabase = createAdminClient()
      const conversationId = data.conversation_id ?? ''
      const agentId = data.agent_id ?? ''

      if (!conversationId || !agentId) {
        return NextResponse.json({ received: true })
      }

      // Find the agent in our DB to get org_id
      const { data: agent } = await supabase
        .from('agents')
        .select('id, org_id')
        .eq('elevenlabs_agent_id', agentId)
        .single()

      if (!agent) {
        console.warn(`Webhook: agent ${agentId} not found in DB`)
        return NextResponse.json({ received: true })
      }

      // Extract conversation data
      const transcript = (data.transcript ?? []).map((t: Record<string, unknown>) => ({
        role: t.role === 'agent' ? 'agent' : 'user',
        message: String(t.message ?? ''),
        time_in_call_secs: Number(t.time_in_call_secs ?? 0),
      }))

      const metadata = data.metadata ?? {}
      const analysis = data.analysis ?? {}

      const duration = Number(metadata.call_duration_secs ?? data.call_duration_secs ?? 0)
      const callerNumber = metadata.from_number ?? data.from_phone_number ?? null
      const direction = (metadata.direction ?? data.conversation_initiation_source ?? 'inbound')
        === 'outbound' ? 'outbound' : 'inbound'

      // Determine sentiment from analysis
      let sentiment: string | null = null
      if (analysis.call_successful === 'true' || analysis.call_successful === true) {
        sentiment = 'positive'
      } else if (analysis.call_successful === 'false' || analysis.call_successful === false) {
        sentiment = 'negative'
      } else {
        sentiment = 'neutral'
      }

      const startedAt = metadata.start_time_unix
        ? new Date(metadata.start_time_unix * 1000).toISOString()
        : new Date().toISOString()
      const endedAt = metadata.end_time_unix
        ? new Date(metadata.end_time_unix * 1000).toISOString()
        : new Date().toISOString()

      // Upsert call record — use elevenlabs_conversation_id as unique key
      const { error } = await supabase
        .from('calls')
        .upsert(
          {
            org_id: agent.org_id,
            agent_id: agent.id,
            elevenlabs_conversation_id: conversationId,
            caller_number: callerNumber,
            direction,
            duration_seconds: Math.round(duration),
            status: 'completed',
            transcript,
            sentiment,
            summary: analysis.transcript_summary ?? null,
            started_at: startedAt,
            ended_at: endedAt,
          },
          { onConflict: 'elevenlabs_conversation_id', ignoreDuplicates: false }
        )

      if (error) {
        console.error('Webhook: failed to upsert call:', error)
      }

      // Update org minutes_used
      if (duration > 0) {
        const minutesUsed = Math.ceil(duration / 60)
        const { error: rpcErr } = await supabase.rpc('increment_minutes_used', {
          p_org_id: agent.org_id,
          p_minutes: minutesUsed,
        })
        if (rpcErr) {
          console.error('Webhook: increment_minutes_used RPC failed:', rpcErr.message)
        }
      }

      // ── Trigger workflows ─────────────────────────────────────────────
      const callCtx: CallContext = {
        call_id: undefined, // Will be filled below if upsert returned an id
        org_id: agent.org_id,
        conversation_id: conversationId,
        caller_number: callerNumber,
        direction,
        duration_seconds: Math.round(duration),
        status: 'completed',
        sentiment,
        summary: analysis.transcript_summary ?? null,
        transcript,
        started_at: startedAt,
      }

      // Try to get the call_id from the upserted row
      if (!error) {
        const { data: upserted } = await supabase
          .from('calls')
          .select('id')
          .eq('elevenlabs_conversation_id', conversationId)
          .single()
        if (upserted) callCtx.call_id = upserted.id
      }

      // Determine trigger type based on call outcome
      try {
        await executeWorkflows('call_ended', callCtx)

        if (sentiment === 'negative') {
          await executeWorkflows('sentiment_negative', callCtx)
        }

        if (transcript.length > 0) {
          await executeWorkflows('keyword_detected', callCtx)
        }
      } catch (wfErr) {
        console.error('Workflow execution error:', wfErr)
      }
    } catch (err) {
      console.error('Webhook processing error:', err)
    }
  }

  return NextResponse.json({ received: true })
}
