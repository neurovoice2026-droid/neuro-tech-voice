// Cartesia call-event webhooks: verification and normalization.
// Per the docs (2026-10) Cartesia authenticates deliveries only with a static
// shared secret in `x-webhook-secret` (no HMAC, no timestamp), retries up to
// 3 times and keeps `webhook_request_id` stable across retries. We compare in
// constant time and dedupe on webhook_request_id. Because there is no
// timestamp, replay protection relies on that dedupe plus idempotent merges.

import crypto from 'crypto'
import type { NormalizedCallEvent, NormalizedTranscriptTurn } from '@/lib/voice-providers/types'
import type { CartesiaCall } from './client'

export function verifyCartesiaSecret(header: string | null, secret: string): boolean {
  if (!header || !secret) return false
  const a = crypto.createHash('sha256').update(header).digest()
  const b = crypto.createHash('sha256').update(secret).digest()
  return crypto.timingSafeEqual(a, b)
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null)

export interface CartesiaEnvelope {
  type: string
  callId: string | null
  agentId: string | null
  requestId: string | null
  timestamp: string | null
  call: Obj | null
  analysis: Obj | null
}

export function readCartesiaEnvelope(body: unknown): CartesiaEnvelope {
  const b = obj(body)
  return {
    type: str(b.type) ?? '',
    callId: str(b.call_id) ?? str(obj(b.call).id),
    agentId: str(b.agent_id) ?? str(obj(b.call).agent_id),
    requestId: str(b.webhook_request_id),
    timestamp: str(b.timestamp),
    call: b.call ? obj(b.call) : null,
    analysis: b.analysis ? obj(b.analysis) : null,
  }
}

function transcriptOf(raw: unknown): NormalizedTranscriptTurn[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t) => obj(t))
    .filter((t) => (t.role === 'assistant' || t.role === 'user') && typeof t.text === 'string' && t.text.trim().length > 0)
    .map((t) => ({
      role: t.role === 'assistant' ? ('agent' as const) : ('user' as const),
      message: String(t.text),
      time_in_call_secs: typeof t.start_timestamp === 'number' ? Math.round(t.start_timestamp) : 0,
    }))
}

const FAILED_TO_CONNECT = new Set(['dial_no_answer', 'dial_busy', 'dial_failed', 'dial_timeout', 'concurrency_limit'])

/** Normalizes a Cartesia call object (from a webhook or GET /agents/calls/{id}). */
export function normalizeCartesiaCall(call: Partial<CartesiaCall> & Obj, extras: { summary?: string | null; eventTimestamp?: number | null } = {}): NormalizedCallEvent | null {
  const id = str(call.id)
  if (!id) return null
  const tp = obj(call.telephony_params)
  const start = str(call.start_time)
  const end = str(call.end_time)
  const duration = start && end ? Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000)) : null
  const endReason = str(call.end_reason)
  const status = str(call.status)
  const dynamic = obj(call.dynamic_variables)
  const headers = obj(tp.headers)
  const localCallId = str(dynamic.ntv_call_id) ?? str(headers['X-NTV-Call-Id']) ?? str(headers['x-ntv-call-id'])
  const direction: 'inbound' | 'outbound' | null = tp.direction === 'outbound' ? 'outbound' : tp.direction === 'inbound' ? 'inbound' : null
  const base = {
    provider: 'cartesia' as const,
    providerCallId: id,
    externalAgentId: str(call.agent_id),
    localCallId,
    twilioCallSid: null,
    direction,
    fromNumber: str(tp.from),
    toNumber: str(tp.to),
    startedAt: start,
    eventTimestamp: extras.eventTimestamp ?? null,
  }

  if (status === 'failed' && (endReason === null || FAILED_TO_CONNECT.has(endReason)) && !duration) {
    return {
      ...base,
      kind: 'call.initiation_failed',
      durationSeconds: 0,
      status: endReason === 'dial_busy' ? 'busy' : endReason === 'dial_no_answer' || endReason === 'dial_timeout' ? 'no-answer' : 'failed',
      transcript: null,
      summary: null,
      summaryTitle: null,
      callSuccessful: null,
      analysis: null,
      terminationReason: endReason,
      costCredits: null,
      costUsd: null,
      hasRecording: false,
      failureReason: endReason ?? str(call.error_message) ?? 'failed',
    }
  }
  if (status === 'completed' || status === 'failed') {
    return {
      ...base,
      kind: 'call.completed',
      durationSeconds: duration,
      status: status === 'failed' ? 'failed' : 'completed',
      transcript: transcriptOf(call.transcript),
      summary: extras.summary ?? str(call.summary),
      summaryTitle: null,
      callSuccessful: null,
      analysis: null,
      terminationReason: endReason,
      costCredits: null,
      costUsd: null,
      // Cartesia records every call by default; the audio endpoint serves it.
      hasRecording: status === 'completed',
      failureReason: status === 'failed' ? str(call.error_message) : null,
    }
  }
  if (status === 'started') {
    return { ...base, kind: 'call.started', durationSeconds: null, status: 'in-progress', transcript: null, summary: null, summaryTitle: null, callSuccessful: null, analysis: null, terminationReason: null, costCredits: null, costUsd: null, hasRecording: null, failureReason: null }
  }
  return null
}

export function normalizeCartesiaEnvelope(env: CartesiaEnvelope): NormalizedCallEvent | null {
  const ts = env.timestamp ? Math.floor(Date.parse(env.timestamp) / 1000) : null
  if (env.type === 'call_started' || env.type === 'call_completed' || env.type === 'call_failed') {
    return env.call ? normalizeCartesiaCall(env.call as Partial<CartesiaCall> & Obj, { eventTimestamp: ts }) : null
  }
  if (env.type === 'post_call_analysis' && env.callId) {
    const summary = str(obj(env.analysis).summary)
    if (!summary) return null
    // Only adds the summary (may arrive before or after call_completed).
    return {
      provider: 'cartesia',
      kind: 'call.analysis_available',
      providerCallId: env.callId,
      externalAgentId: env.agentId,
      localCallId: null,
      twilioCallSid: null,
      direction: null,
      fromNumber: null,
      toNumber: null,
      startedAt: null,
      durationSeconds: null,
      status: 'completed',
      transcript: null,
      summary,
      summaryTitle: null,
      callSuccessful: null,
      analysis: null,
      terminationReason: null,
      costCredits: null,
      costUsd: null,
      hasRecording: null,
      failureReason: null,
      eventTimestamp: ts,
    }
  }
  return null // call_turn and unknown types: acknowledged, not stored
}
