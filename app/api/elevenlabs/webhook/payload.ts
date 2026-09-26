import '@/lib/zod-setup'
import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { timingSafeEqualString } from '@/lib/security/signing'
import { normalizeE164 } from '@/lib/phone/e164'
import type { CallDirection, CallStatus, Sentiment, TranscriptEntry } from '@/types'

// Pure parsing of ElevenLabs post-call webhooks (kept apart from the route so
// it can be unit tested). Payload reference:
// https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks
// Phone details live in data.metadata.phone_call.{external_number, agent_number,
// direction, call_sid}; our router passes dynamic_variables.{call_id, org_id,
// twilio_call_sid, failover_reason} through register-call.

/** How far an ElevenLabs-Signature timestamp may drift, as in their SDK. */
export const SIGNATURE_TOLERANCE_SECONDS = 30 * 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROVIDER_ID_RE = /^[A-Za-z0-9_-]{1,128}$/
const CALL_SID_RE = /^CA[0-9a-fA-F]{32}$/
const MAX_TURNS = 2_000
const MAX_MESSAGE_CHARS = 8_000
const MAX_CALL_SECONDS = 6 * 60 * 60

/**
 * `ElevenLabs-Signature: t=<unix>,v0=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`.
 * Constant-time compare, stale timestamps rejected.
 */
export function verifyElevenLabsSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!header || !secret) return false
  let timestamp: string | null = null
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const [key, ...rest] = part.trim().split('=')
    const value = rest.join('=')
    if (key === 't') timestamp = value
    else if (key === 'v0' && value) signatures.push(value)
  }
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || signatures.length === 0) return false
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  return signatures.some((candidate) => timingSafeEqualString(candidate.toLowerCase(), expected))
}

export const WebhookEnvelopeSchema = z.object({
  type: z.string().max(64),
  event_timestamp: z.number().finite().optional(),
  data: z.record(z.string(), z.unknown()),
})

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function str(value: unknown, max = 256): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function providerId(value: unknown): string | null {
  const s = str(value, 128)
  return s && PROVIDER_ID_RE.test(s) ? s : null
}

function phone(value: unknown): string | null {
  const s = str(value, 32)
  if (!s) return null
  return normalizeE164(s.startsWith('+') || s.startsWith('00') ? s : `+${s}`)
}

/**
 * ElevenLabs' goal evaluation: `success | failure | unknown`. It measures
 * whether the agent met its goal, not the caller's mood, so it is only used as
 * a stand-in sentiment when OpenAI analysis isn't available.
 */
export function sentimentFromCallSuccessful(value: unknown): Sentiment | null {
  if (value === 'success') return 'positive'
  if (value === 'failure') return 'negative'
  if (value === 'unknown') return 'neutral'
  return null
}

export function mapElevenLabsTranscript(value: unknown): TranscriptEntry[] {
  if (!Array.isArray(value)) return []
  const out: TranscriptEntry[] = []
  for (const raw of value) {
    const turn = record(raw)
    const message = typeof turn.message === 'string' ? turn.message.trim().slice(0, MAX_MESSAGE_CHARS) : ''
    // Tool-only turns have a null message; they carry nothing a person reads.
    if (!message) continue
    const seconds = num(turn.time_in_call_secs)
    const entry: TranscriptEntry = {
      role: turn.role === 'agent' ? 'agent' : 'user',
      message,
      time_in_call_secs: seconds !== null && seconds > 0 ? Math.round(seconds * 10) / 10 : 0,
    }
    if (turn.interrupted === true) entry.interrupted = true
    out.push(entry)
    if (out.length >= MAX_TURNS) break
  }
  return out
}

export interface DynamicVariables {
  callId: string | null
  orgId: string | null
  twilioCallSid: string | null
  failoverReason: string | null
}

export function readDynamicVariables(data: Record<string, unknown>): DynamicVariables {
  const vars = record(record(data.conversation_initiation_client_data).dynamic_variables)
  const callId = str(vars.call_id, 64)
  const orgId = str(vars.org_id, 64)
  const sid = str(vars.twilio_call_sid, 64) ?? str(vars.system__call_sid, 64)
  return {
    callId: callId && UUID_RE.test(callId) ? callId : null,
    orgId: orgId && UUID_RE.test(orgId) ? orgId : null,
    twilioCallSid: sid && CALL_SID_RE.test(sid) ? sid : null,
    failoverReason: str(vars.failover_reason, 100),
  }
}

/**
 * May this conversation write to the call row it points at? Dynamic variables
 * travel through the client side of a conversation, so they only locate the
 * row: the ElevenLabs agent that actually served the conversation (set by
 * ElevenLabs, not the client) must belong to the row's organisation.
 */
export function conversationMayUpdateCall(input: {
  rowOrgId: string
  agentOrgId: string | null
  dynamicOrgId: string | null
}): boolean {
  if (input.dynamicOrgId && input.dynamicOrgId !== input.rowOrgId) return false
  return !!input.agentOrgId && input.agentOrgId === input.rowOrgId
}

/**
 * What to do with a post-call transcription:
 * - `update` the call row our router or gateway created;
 * - `skip` a conversation that names one of our calls we can't find (deleted,
 *   or another environment's): importing it would store and bill it twice;
 * - `import` a legacy conversation from a number still imported into ElevenLabs.
 */
export function transcriptionAction(input: { routedRowFound: boolean; dynamicCallId: string | null }): 'update' | 'import' | 'skip' {
  if (input.routedRowFound) return 'update'
  return input.dynamicCallId ? 'skip' : 'import'
}

export interface PhoneCallDetails {
  direction: CallDirection
  /** The customer's number. */
  externalNumber: string | null
  /** Our (the business's) number. */
  agentNumber: string | null
  callSid: string | null
  fromNumber: string | null
  toNumber: string | null
}

export function readPhoneCall(metadata: Record<string, unknown>): PhoneCallDetails {
  const call = record(metadata.phone_call)
  const direction: CallDirection = call.direction === 'outbound' ? 'outbound' : 'inbound'
  const externalNumber = phone(call.external_number)
  const agentNumber = phone(call.agent_number)
  const sid = str(call.call_sid, 64)
  return {
    direction,
    externalNumber,
    agentNumber,
    callSid: sid && CALL_SID_RE.test(sid) ? sid : null,
    fromNumber: direction === 'inbound' ? externalNumber : agentNumber,
    toNumber: direction === 'inbound' ? agentNumber : externalNumber,
  }
}

export interface TranscriptionEvent {
  conversationId: string
  agentId: string
  transcript: TranscriptEntry[]
  summary: string | null
  callSuccessful: 'success' | 'failure' | 'unknown' | null
  durationSeconds: number
  startedAt: string
  endedAt: string
  hasAudio: boolean
  phone: PhoneCallDetails
  dynamic: DynamicVariables
}

/** null when the payload lacks the ids needed to store anything. */
export function mapTranscriptionEvent(
  data: Record<string, unknown>,
  eventTimestamp?: number,
  now: Date = new Date()
): TranscriptionEvent | null {
  const conversationId = providerId(data.conversation_id)
  const agentId = providerId(data.agent_id)
  if (!conversationId || !agentId) return null

  const metadata = record(data.metadata)
  const analysis = record(data.analysis)
  const rawDuration = num(metadata.call_duration_secs) ?? 0
  const durationSeconds = Math.min(MAX_CALL_SECONDS, Math.max(0, Math.round(rawDuration)))

  const startUnix = num(metadata.start_time_unix_secs)
  const fallbackEnd = eventTimestamp && eventTimestamp > 0 ? eventTimestamp * 1000 : now.getTime()
  const startMs = startUnix && startUnix > 0 ? startUnix * 1000 : fallbackEnd - durationSeconds * 1000
  const successful = analysis.call_successful

  return {
    conversationId,
    agentId,
    transcript: mapElevenLabsTranscript(data.transcript),
    summary: str(analysis.transcript_summary, 2_000),
    callSuccessful: successful === 'success' || successful === 'failure' || successful === 'unknown' ? successful : null,
    durationSeconds,
    startedAt: new Date(startMs).toISOString(),
    endedAt: new Date(startMs + durationSeconds * 1000).toISOString(),
    hasAudio: data.has_audio === true,
    phone: readPhoneCall(metadata),
    dynamic: readDynamicVariables(data),
  }
}

export interface InitiationFailureEvent {
  conversationId: string
  agentId: string
  status: Extract<CallStatus, 'busy' | 'no-answer' | 'failed'>
  failureReason: string
  direction: CallDirection
  fromNumber: string | null
  toNumber: string | null
  /** The customer's number. */
  externalNumber: string | null
  callSid: string | null
  occurredAt: string
}

/**
 * call_initiation_failure: a call ElevenLabs tried to place never connected.
 * Twilio metadata.body is a StatusCallback body (From/To/CallSid/Direction);
 * SIP metadata.body has from_number/to_number/call_sid.
 */
export function mapInitiationFailureEvent(
  data: Record<string, unknown>,
  eventTimestamp?: number,
  now: Date = new Date()
): InitiationFailureEvent | null {
  const conversationId = providerId(data.conversation_id)
  const agentId = providerId(data.agent_id)
  if (!conversationId || !agentId) return null

  const reason = str(data.failure_reason, 64) ?? 'unknown'
  const status = reason === 'busy' ? 'busy' : reason === 'no-answer' ? 'no-answer' : 'failed'
  const metadata = record(data.metadata)
  const body = record(metadata.body)

  const from = phone(body.From ?? body.from ?? body.from_number)
  const to = phone(body.To ?? body.to ?? body.to_number)
  const rawDirection = str(body.Direction ?? body.direction, 32) ?? 'outbound'
  // These webhooks are for calls ElevenLabs places; Twilio reports them as outbound-api.
  const direction: CallDirection = rawDirection.startsWith('inbound') ? 'inbound' : 'outbound'
  const sid = str(body.CallSid ?? body.call_sid, 64)
  const at = eventTimestamp && eventTimestamp > 0 ? new Date(eventTimestamp * 1000) : now

  return {
    conversationId,
    agentId,
    status,
    failureReason: reason,
    direction,
    fromNumber: from,
    toNumber: to,
    externalNumber: direction === 'inbound' ? from : to,
    callSid: sid && CALL_SID_RE.test(sid) ? sid : null,
    occurredAt: at.toISOString(),
  }
}
