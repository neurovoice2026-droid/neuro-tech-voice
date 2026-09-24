import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeWorkflows, type CallContext } from '@/lib/workflows/executor'
import { maybeSendUsageAlert } from '@/lib/billing/usage-alert'
import { analyseCall } from '@/lib/orchestrator/analysis'
import {
  calls as telnyxCalls,
  decodeClientState,
  isConfigured,
  isWebhookConfigured,
  verifyWebhookSignature,
  type TelnyxTranscriptionPayload,
  type TelnyxWebhookEvent,
} from '@/lib/telnyx/client'
import type { TranscriptEntry } from '@/types'

// Telnyx drives the call through webhooks rather than a single post-call
// report, so this route is a state machine, not a logger:
//
//   call.initiated → resolve the agent, answer, fork audio to the orchestrator
//   call.answered  → start recording if the agent is configured for it
//   call.hangup    → summarise, persist, fire workflows
//
// The transcript itself is written by the orchestrator process (which is the
// only thing that ever sees the audio); this route fills in everything around
// it. Whichever finishes first creates the row — see persistCall() in
// lib/orchestrator/server.ts for the other half of that handshake.

export async function POST(request: Request) {
  const rawBody = await request.text()

  if (
    isWebhookConfigured() &&
    !verifyWebhookSignature(
      rawBody,
      request.headers.get('telnyx-signature-ed25519'),
      request.headers.get('telnyx-timestamp')
    )
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: TelnyxWebhookEvent
  try {
    body = JSON.parse(rawBody) as TelnyxWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = body.data?.event_type ?? ''
  const payload = body.data?.payload

  if (!payload) return NextResponse.json({ received: true })

  try {
    switch (eventType) {
      case 'call.initiated':
        await handleInitiated(payload)
        break
      case 'call.answered':
        await handleAnswered(payload)
        break
      case 'call.transcription':
        await handleTranscription(payload as unknown as TelnyxTranscriptionPayload)
        break
      case 'call.hangup':
        await handleHangup(payload)
        break
    }
  } catch (err) {
    // Always 200 back to Telnyx. A non-2xx triggers their retry, and retrying
    // a call-control command that already partially applied does more damage
    // than dropping the event.
    console.error(`Telnyx webhook (${eventType}) failed:`, err instanceof Error ? err.message : err)
  }

  return NextResponse.json({ received: true })
}

// ─── call.initiated ──────────────────────────────────────────────────────────

async function handleInitiated(payload: TelnyxWebhookEvent['data']['payload']) {
  // Outbound legs we placed ourselves already carry their routing in
  // client_state and were dialled with streaming configured, so there is
  // nothing to answer here.
  if (payload.direction === 'outgoing') return
  if (!isConfigured()) return

  const supabase = createAdminClient()

  // The dialled number identifies the agent. Telnyx sends E.164; numbers are
  // stored the same way, so this is a direct match rather than a normalise-and-
  // compare.
  const { data: phoneNumber } = await supabase
    .from('phone_numbers')
    .select('id, org_id, agent_id, is_active')
    .eq('number', payload.to)
    .maybeSingle()

  if (!phoneNumber?.agent_id || !phoneNumber.is_active) {
    console.warn(`Telnyx: no active agent for ${payload.to}, hanging up`)
    await telnyxCalls.hangup(payload.call_control_id)
    return
  }

  const streamUrl = process.env.TELNYX_STREAM_URL
  if (!streamUrl) {
    console.error('TELNYX_STREAM_URL is not set — cannot route call to orchestrator')
    await telnyxCalls.hangup(payload.call_control_id)
    return
  }

  // Everything the orchestrator needs to identify this call travels in the
  // stream URL, because Telnyx's media-stream `start` frame carries no
  // application data of ours.
  const url = new URL(streamUrl)
  url.searchParams.set('agent', phoneNumber.agent_id as string)
  url.searchParams.set('org', phoneNumber.org_id as string)
  url.searchParams.set('ccid', payload.call_control_id)
  url.searchParams.set('csid', payload.call_session_id)
  url.searchParams.set('dir', 'inbound')
  url.searchParams.set('pn', phoneNumber.id as string)
  if (payload.from) url.searchParams.set('from', payload.from)

  await telnyxCalls.answer(payload.call_control_id, {
    stream_url: url.toString(),
    client_state: JSON.stringify({
      agentId: phoneNumber.agent_id,
      orgId: phoneNumber.org_id,
      phoneNumberId: phoneNumber.id,
    }),
  })
}

// ─── call.answered ───────────────────────────────────────────────────────────

async function handleAnswered(payload: TelnyxWebhookEvent['data']['payload']) {
  const state = parseClientState(payload.client_state)
  if (!state?.agentId) return

  const supabase = createAdminClient()
  const { data: agent } = await supabase
    .from('agents')
    .select('metadata, language')
    .eq('id', state.agentId)
    .single()

  const behaviour = (agent?.metadata as Record<string, unknown> | null)?.behavior as
    | { record_calls?: boolean }
    | undefined

  // Streaming transcription on the call leg. This is what removes the batch
  // ASR round trip from every reply — the engine transcribes while the caller
  // is still speaking instead of after they stop.
  if (process.env.STT_SOURCE !== 'fish') {
    await telnyxCalls.transcriptionStart(payload.call_control_id, {
      engine: (process.env.TELNYX_STT_ENGINE as 'Deepgram') ?? 'Deepgram',
      language: (agent?.language as string) ?? 'ro',
      transcription_tracks: 'inbound',
      // Interim results are not consumed — the session ignores non-final
      // transcripts anyway, so requesting them would only add webhook traffic.
      interim_results: false,
    })
  }

  if (behaviour?.record_calls) {
    await telnyxCalls.recordStart(payload.call_control_id, { channels: 'dual', format: 'mp3' })
  }
}

// ─── call.transcription ──────────────────────────────────────────────────────

/**
 * Relay a transcript to the orchestrator process, which holds the live session.
 *
 * This hop exists because Telnyx delivers transcripts as webhooks to one
 * configured URL, while the conversation state lives in a different process.
 * It is on the critical path for every reply, so it is deliberately thin: no
 * database round trip, no signature re-derivation, just a forward.
 */
async function handleTranscription(payload: TelnyxTranscriptionPayload) {
  const url = process.env.ORCHESTRATOR_URL
  if (!url) return

  const data = payload.transcription_data
  if (!data?.is_final || !data.transcript?.trim()) return

  try {
    await fetch(`${url.replace(/\/$/, '')}/transcription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ORCHESTRATOR_SECRET
          ? { 'x-orchestrator-secret': process.env.ORCHESTRATOR_SECRET }
          : {}),
      },
      body: JSON.stringify({
        call_control_id: payload.call_control_id,
        transcript: data.transcript,
        is_final: data.is_final,
      }),
    })
  } catch (err) {
    console.error('Failed to relay transcript:', err instanceof Error ? err.message : err)
  }
}

// ─── call.hangup ─────────────────────────────────────────────────────────────

async function handleHangup(payload: TelnyxWebhookEvent['data']['payload']) {
  const state = parseClientState(payload.client_state)
  const supabase = createAdminClient()

  // The orchestrator writes the transcript; read back whatever it recorded so
  // the summary is generated from real content. If it has not landed yet, this
  // still persists the call metadata and leaves summary/sentiment null rather
  // than blocking.
  const { data: existing } = await supabase
    .from('calls')
    .select('id, org_id, agent_id, transcript, duration_seconds, caller_number, direction')
    .eq('telnyx_call_session_id', payload.call_session_id)
    .maybeSingle()

  const orgId = (existing?.org_id as string) ?? state?.orgId
  const agentId = (existing?.agent_id as string) ?? state?.agentId
  if (!orgId) return

  const transcript = (existing?.transcript ?? []) as TranscriptEntry[]
  const duration = Number(existing?.duration_seconds ?? 0)
  const hangupCause = String(payload.hangup_cause ?? '')

  const status =
    duration > 0 ? 'completed'
    : hangupCause === 'busy' ? 'busy'
    : hangupCause === 'no_answer' || hangupCause === 'timeout' ? 'no-answer'
    : 'failed'

  const { summary, sentiment } = transcript.length
    ? await analyseCall(transcript)
    : { summary: null, sentiment: null }

  const now = new Date().toISOString()
  const { data: upserted, error } = await supabase
    .from('calls')
    .upsert(
      {
        org_id: orgId,
        agent_id: agentId ?? null,
        phone_number_id: state?.phoneNumberId ?? null,
        telnyx_call_control_id: payload.call_control_id,
        telnyx_call_session_id: payload.call_session_id,
        caller_number: (existing?.caller_number as string) ?? payload.from ?? null,
        direction: payload.direction === 'outgoing' ? 'outbound' : 'inbound',
        duration_seconds: Math.round(duration),
        status,
        transcript,
        sentiment,
        summary,
        ended_at: now,
      },
      { onConflict: 'telnyx_call_session_id', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error) {
    console.error('Telnyx: failed to upsert call:', error.message)
  }

  // Minutes are incremented by the orchestrator when it persists the call —
  // doing it here as well would double-bill every answered call. Calls that
  // never reached the orchestrator have zero duration and owe nothing, so the
  // only remaining job is the threshold alert for the minutes it did add.
  if (duration > 0) {
    await maybeSendUsageAlert(supabase, orgId, Math.max(1, Math.ceil(duration / 60)))
  }

  const callCtx: CallContext = {
    call_id: upserted?.id,
    org_id: orgId,
    conversation_id: payload.call_session_id,
    caller_number: (existing?.caller_number as string) ?? payload.from ?? null,
    direction: payload.direction === 'outgoing' ? 'outbound' : 'inbound',
    duration_seconds: Math.round(duration),
    status,
    sentiment,
    summary,
    transcript,
    started_at: now,
  }

  try {
    if (status === 'completed') {
      await executeWorkflows(orgId, 'call_ended', callCtx)
      if (sentiment === 'negative') await executeWorkflows(orgId, 'sentiment_negative', callCtx)
      if (transcript.length > 0) await executeWorkflows(orgId, 'keyword_detected', callCtx)
    } else {
      await executeWorkflows(orgId, 'call_missed', callCtx)
    }
  } catch (wfErr) {
    console.error('Workflow execution error:', wfErr)
  }
}

interface ClientState {
  agentId?: string
  orgId?: string
  phoneNumberId?: string
}

function parseClientState(raw: string | null | undefined): ClientState | null {
  const decoded = decodeClientState(raw)
  if (!decoded) return null
  try {
    return JSON.parse(decoded) as ClientState
  } catch {
    return null
  }
}
