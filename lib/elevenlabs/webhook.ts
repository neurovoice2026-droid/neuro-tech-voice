// ElevenLabs post-call webhooks: signature verification and normalization.
// Format verified against the official SDKs and docs (2026-10):
//   ElevenLabs-Signature: t=<unix seconds>,v0=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>
// The SDK tolerates 30 minutes of age; we also reject timestamps more than
// 5 minutes in the future and compare in constant time.
// Event types: post_call_transcription, post_call_audio, call_initiation_failure.

import crypto from 'crypto'
import type { NormalizedCallEvent, NormalizedTranscriptTurn } from '@/lib/voice-providers/types'
import { PLATFORM_VARIABLES } from '@/lib/voice-providers/prompt'

export const SIGNATURE_TOLERANCE_PAST_S = 30 * 60
export const SIGNATURE_TOLERANCE_FUTURE_S = 5 * 60

export type SignatureCheck = { ok: true; timestamp: number } | { ok: false; reason: 'missing' | 'malformed' | 'stale' | 'future' | 'mismatch' }

export function verifyElevenLabsSignature(rawBody: string, header: string | null, secret: string, nowMs = Date.now()): SignatureCheck {
  if (!header) return { ok: false, reason: 'missing' }
  let t: string | undefined
  let v0: string | undefined
  for (const part of header.split(',')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === 't') t = rest.join('=')
    else if (k === 'v0') v0 = rest.join('=')
  }
  if (!t || !v0 || !/^\d+$/.test(t) || !/^[0-9a-f]+$/i.test(v0)) return { ok: false, reason: 'malformed' }
  const ts = Number(t)
  const now = Math.floor(nowMs / 1000)
  if (now - ts > SIGNATURE_TOLERANCE_PAST_S) return { ok: false, reason: 'stale' }
  if (ts - now > SIGNATURE_TOLERANCE_FUTURE_S) return { ok: false, reason: 'future' }
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest()
  const given = Buffer.from(v0, 'hex')
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: 'mismatch' }
  return { ok: true, timestamp: ts }
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null)

export interface ElevenLabsEnvelope {
  type: string
  eventTimestamp: number | null
  conversationId: string | null
  agentId: string | null
  data: Obj
}

export function readEnvelope(body: unknown): ElevenLabsEnvelope {
  const b = obj(body)
  const data = obj(b.data)
  return {
    type: str(b.type) ?? '',
    eventTimestamp: num(b.event_timestamp),
    conversationId: str(data.conversation_id),
    agentId: str(data.agent_id),
    data,
  }
}

function transcriptOf(raw: unknown): NormalizedTranscriptTurn[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t) => obj(t))
    .filter((t) => typeof t.message === 'string' && t.message.trim().length > 0)
    .map((t) => ({
      role: t.role === 'agent' ? ('agent' as const) : ('user' as const),
      message: String(t.message),
      time_in_call_secs: num(t.time_in_call_secs) ?? 0,
    }))
}

function analysisOf(raw: Obj): NormalizedCallEvent['analysis'] {
  const evaluation: Record<string, { result: string; rationale: string | null }> = {}
  for (const [id, v] of Object.entries(obj(raw.evaluation_criteria_results))) {
    const o = obj(v)
    evaluation[id] = { result: str(o.result) ?? 'unknown', rationale: str(o.rationale) }
  }
  const data: Record<string, string | number | boolean | null> = {}
  for (const [id, v] of Object.entries(obj(raw.data_collection_results))) {
    const value = obj(v).value
    data[id] = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : value == null ? null : JSON.stringify(value).slice(0, 500)
  }
  return Object.keys(evaluation).length || Object.keys(data).length ? { evaluation, data } : null
}

/** Maps one ElevenLabs webhook to a normalized event (null for unknown types). */
export function normalizeElevenLabsEvent(env: ElevenLabsEnvelope): NormalizedCallEvent | null {
  if (!env.conversationId) return null
  const d = env.data
  const meta = obj(d.metadata)
  const phone = obj(meta.phone_call)
  const vars = obj(obj(d.conversation_initiation_client_data).dynamic_variables)
  const localCallId = str(vars[PLATFORM_VARIABLES.callId])
  const base = {
    provider: 'elevenlabs' as const,
    providerCallId: env.conversationId,
    externalAgentId: env.agentId,
    localCallId: localCallId && localCallId !== 'unknown' ? localCallId : null,
    localCallToken: str(vars[PLATFORM_VARIABLES.callToken]),
    twilioCallSid: str(phone.call_sid),
    eventTimestamp: env.eventTimestamp,
  }

  if (env.type === 'post_call_transcription') {
    const direction = phone.direction === 'outbound' ? 'outbound' : phone.direction === 'inbound' ? 'inbound' : null
    // agent_number is our line, external_number the other party.
    const ours = str(phone.agent_number)
    const theirs = str(phone.external_number)
    const start = num(meta.start_time_unix_secs)
    const analysis = obj(d.analysis)
    const cs = str(analysis.call_successful)
    return {
      ...base,
      kind: 'call.completed',
      direction,
      fromNumber: direction === 'outbound' ? ours : theirs,
      toNumber: direction === 'outbound' ? theirs : ours,
      startedAt: start ? new Date(start * 1000).toISOString() : null,
      durationSeconds: num(meta.call_duration_secs),
      status: str(d.status) === 'failed' ? 'failed' : 'completed',
      transcript: transcriptOf(d.transcript),
      summary: str(analysis.transcript_summary),
      summaryTitle: str(analysis.call_summary_title),
      callSuccessful: cs === 'success' || cs === 'failure' || cs === 'unknown' ? cs : null,
      analysis: analysisOf(analysis),
      terminationReason: str(meta.termination_reason),
      costCredits: num(meta.cost),
      costUsd: num(meta.cost_fiat),
      hasRecording: typeof d.has_audio === 'boolean' ? d.has_audio : null,
      failureReason: null,
    }
  }

  if (env.type === 'post_call_audio') {
    // Only marks the recording as available; never touches transcript data.
    return {
      ...base,
      kind: 'call.recording_available',
      direction: null,
      fromNumber: null,
      toNumber: null,
      startedAt: null,
      durationSeconds: null,
      status: 'completed',
      transcript: null,
      summary: null,
      summaryTitle: null,
      callSuccessful: null,
      analysis: null,
      terminationReason: null,
      costCredits: null,
      costUsd: null,
      hasRecording: true,
      failureReason: null,
    }
  }

  if (env.type === 'call_initiation_failure') {
    const reason = str(d.failure_reason) ?? 'unknown'
    const body = obj(obj(d.metadata).body)
    return {
      ...base,
      twilioCallSid: base.twilioCallSid ?? str(body.CallSid),
      kind: 'call.initiation_failed',
      direction: 'outbound',
      fromNumber: str(body.From),
      toNumber: str(body.To),
      startedAt: env.eventTimestamp ? new Date(env.eventTimestamp * 1000).toISOString() : null,
      durationSeconds: 0,
      status: reason === 'busy' ? 'busy' : reason === 'no-answer' ? 'no-answer' : 'failed',
      transcript: null,
      summary: null,
      summaryTitle: null,
      callSuccessful: null,
      analysis: null,
      terminationReason: `initiation_failure:${reason}`,
      costCredits: null,
      costUsd: null,
      hasRecording: false,
      failureReason: reason,
    }
  }
  return null
}

/** Dedupe key: retries carry an identical payload, so type + conversation is unique. */
export function elevenLabsDedupeKey(env: ElevenLabsEnvelope): string {
  return `${env.type}:${env.conversationId ?? 'none'}`
}
