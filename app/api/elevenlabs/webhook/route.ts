import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeWorkflows, type CallContext } from '@/lib/workflows/executor'
import { isWebhookConfigured, verifyWebhookSignature } from '@/lib/elevenlabs/client'
import { sendEmail } from '@/lib/email/client'
import { usageAlertEmail } from '@/lib/email/templates'
import { PLANS } from '@/types'
import type { Plan } from '@/types'

// Email the org owner once when usage first crosses 80% of the monthly limit.
const USAGE_ALERT_THRESHOLD = 0.8

async function maybeSendUsageAlert(
  supabase: SupabaseClient,
  orgId: string,
  minutesJustAdded: number
) {
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('user_id, plan, minutes_used, minutes_limit')
      .eq('id', orgId)
      .single()
    if (!org || !org.minutes_limit || org.minutes_limit <= 0) return

    const after = org.minutes_used ?? 0
    const before = after - minutesJustAdded
    const threshold = org.minutes_limit * USAGE_ALERT_THRESHOLD

    // Only fire on the call that first crosses the threshold (and not at 100%,
    // which is its own situation), so the owner gets exactly one heads-up.
    if (before >= threshold || after < threshold || after >= org.minutes_limit) return

    const { data: userRes } = await supabase.auth.admin.getUserById(org.user_id)
    const email = userRes?.user?.email
    if (!email) return

    await sendEmail({
      to: email,
      ...usageAlertEmail({
        minutesUsed: after,
        minutesLimit: org.minutes_limit,
        planName: PLANS[(org.plan ?? 'trial') as Plan]?.name,
      }),
    })
  } catch (err) {
    console.error('Usage alert failed:', err instanceof Error ? err.message : err)
  }
}

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

  // ElevenLabs sends 3 distinct post-call event types: post_call_transcription
  // (the one with transcript/metadata/analysis, handled below), post_call_audio
  // (only agent_id/conversation_id/full_audio, no transcript, must NOT be
  // processed as a full call record or it would overwrite the real one with
  // empty data, so it's silently ignored), and call_initiation_failure
  // (busy/no-answer/unknown, handled further below).
  if (eventType === 'post_call_transcription') {
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
        } else {
          await maybeSendUsageAlert(supabase, agent.org_id, minutesUsed)
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
  } else if (eventType === 'call_initiation_failure') {
    // A call that never connected (busy/no-answer/unknown), logged as a call
    // record with no transcript, and triggers the "call_missed" workflow
    // trigger (previously dead: the workflow builder let Customers pick this
    // trigger, but nothing ever fired it after telephony moved to native
    // ElevenLabs and this event type went unhandled).
    try {
      const supabase = createAdminClient()
      const agentId = data.agent_id ?? ''
      const conversationId = data.conversation_id ?? ''
      if (!agentId) return NextResponse.json({ received: true })

      const { data: agent } = await supabase
        .from('agents')
        .select('id, org_id')
        .eq('elevenlabs_agent_id', agentId)
        .single()

      if (!agent) return NextResponse.json({ received: true })

      const failureReason = String(data.failure_reason ?? 'unknown')
      const status = failureReason === 'busy' ? 'busy' : failureReason === 'no-answer' ? 'no-answer' : 'failed'

      const meta = (data.metadata ?? {}) as Record<string, unknown>
      const providerBody = (meta.body ?? {}) as Record<string, unknown>
      const callerNumber = (providerBody.From ?? providerBody.from ?? null) as string | null
      const now = new Date().toISOString()

      const callCtx: CallContext = {
        org_id: agent.org_id,
        conversation_id: conversationId,
        caller_number: callerNumber,
        direction: 'inbound',
        duration_seconds: 0,
        status,
        sentiment: null,
        summary: null,
        transcript: [],
        started_at: now,
      }

      if (conversationId) {
        const { data: upserted, error } = await supabase
          .from('calls')
          .upsert(
            {
              org_id: agent.org_id,
              agent_id: agent.id,
              elevenlabs_conversation_id: conversationId,
              caller_number: callerNumber,
              direction: 'inbound',
              duration_seconds: 0,
              status,
              transcript: [],
              sentiment: null,
              summary: null,
              started_at: now,
              ended_at: now,
            },
            { onConflict: 'elevenlabs_conversation_id', ignoreDuplicates: false }
          )
          .select('id')
          .single()
        if (error) console.error('Webhook: failed to upsert missed call:', error)
        if (upserted) callCtx.call_id = upserted.id
      }

      await executeWorkflows('call_missed', callCtx)
    } catch (err) {
      console.error('Webhook call_initiation_failure processing error:', err)
    }
  }

  return NextResponse.json({ received: true })
}
