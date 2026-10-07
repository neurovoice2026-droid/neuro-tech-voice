// ElevenLabs post-call webhooks: signature verification and normalization.
// Format verified against the official SDKs and docs (2026-10):
//   ElevenLabs-Signature: t=<unix seconds>,v0=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>
// The SDK tolerates 30 minutes of age; we also reject timestamps more than
// 5 minutes in the future and compare in constant time.
// Event types: post_call_transcription, post_call_audio, call_initiation_failure.
// The same normalizer applies a conversation fetched with
// GET /v1/convai/conversations/{id} (reconciliation, re-analysis): its shape
// is the post_call_transcription `data`.

import crypto from 'crypto'
import type { NormalizedCallEvent, NormalizedTranscriptTurn } from '@/lib/voice-providers/types'
import { PLATFORM_VARIABLES } from '@/lib/voice-providers/prompt'
import {
  MAX_ERROR_REASON,
  MAX_TOOL_EVENTS,
  MAX_WARNING_LENGTH,
  MAX_WARNINGS,
  type CallChannel,
  type CallMetadata,
  type CallToolEvent,
  type ToolEventKind,
} from '@/lib/voice-providers/call-metadata'

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

export type RotatingSignatureCheck =
  | { ok: true; timestamp: number; /** 0 = current secret, 1 = previous secret (rotation in progress). */ secretIndex: number }
  | { ok: false; reason: 'missing' | 'malformed' | 'stale' | 'future' | 'mismatch'; /** Age of a stale signature, to tell retries that keep the original timestamp apart. */ ageSeconds?: number }

/**
 * Verifies against the current secret, then the previous one
 * (ELEVENLABS_WEBHOOK_SECRET_PREVIOUS), so the secret can be rotated without
 * rejecting deliveries signed with the old one. Format and age failures are
 * the same for every secret and are reported once.
 */
export function verifyElevenLabsSignatureRotating(rawBody: string, header: string | null, secrets: string[], nowMs = Date.now()): RotatingSignatureCheck {
  const usable = secrets.filter((s) => s.length > 0)
  if (usable.length === 0) return { ok: false, reason: 'mismatch' }
  let last: Extract<SignatureCheck, { ok: false }> = { ok: false, reason: 'mismatch' }
  for (const [i, secret] of usable.entries()) {
    const check = verifyElevenLabsSignature(rawBody, header, secret, nowMs)
    if (check.ok) return { ok: true, timestamp: check.timestamp, secretIndex: i }
    last = check
    // Format and age failures are the same for every secret.
    if (check.reason !== 'mismatch') break
  }
  if (last.reason === 'stale') {
    const t = /(?:^|,)\s*t=(\d+)/.exec(header ?? '')?.[1]
    return { ok: false, reason: 'stale', ageSeconds: t ? Math.floor(nowMs / 1000) - Number(t) : undefined }
  }
  return { ok: false, reason: last.reason }
}

/** Webhook secrets in verification order: current, then the previous one during a rotation. */
export function webhookSecrets(env: Record<string, string | undefined> = process.env): string[] {
  return [env.ELEVENLABS_WEBHOOK_SECRET, env.ELEVENLABS_WEBHOOK_SECRET_PREVIOUS].map((s) => (s ?? '').trim()).filter(Boolean)
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

/** Tool name → timeline kind (system tools by name, our platform transfer tool too). */
function toolKind(name: string, resultType: string | null): ToolEventKind {
  const r = resultType ?? ''
  if (r.startsWith('transfer_to_number') || name === 'transfer_to_number' || name === 'transfer_to_human') return 'transfer'
  if (r.startsWith('voicemail_detection') || name === 'voicemail_detection') return 'voicemail'
  if (r.startsWith('end_call') || name === 'end_call') return 'end_call'
  if (r.startsWith('language_detection') || name === 'language_detection') return 'language'
  if (r.startsWith('skip_turn') || name === 'skip_turn') return 'skip_turn'
  if (r.startsWith('knowledge_base')) return 'knowledge'
  return 'other'
}

const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,64}$/

/**
 * Redacted tool timeline from transcript[].tool_calls / tool_results: tool
 * name, ok, system result_type and turn time only. Parameters, results,
 * URLs, headers and bodies (tokens, PII) are never read.
 */
export function toolEventsOf(raw: unknown): CallToolEvent[] {
  if (!Array.isArray(raw)) return []
  const out: CallToolEvent[] = []
  const answered = new Set<string>()
  for (const turn of raw.map((t) => obj(t))) {
    for (const r of Array.isArray(turn.tool_results) ? turn.tool_results.map((x) => obj(x)) : []) {
      const id = str(r.request_id)
      if (id) answered.add(id)
    }
  }
  for (const turn of raw.map((t) => obj(t))) {
    const at = Math.max(0, Math.round(num(turn.time_in_call_secs) ?? 0))
    for (const r of Array.isArray(turn.tool_results) ? turn.tool_results.map((x) => obj(x)) : []) {
      const name = str(r.tool_name)
      if (!name || !TOOL_NAME.test(name)) continue
      const resultType = str(obj(r.result).result_type)
      const safeResult = resultType && /^[a-z0-9_]{1,64}$/.test(resultType) ? resultType : null
      const failed = r.is_error === true || r.is_blocked === true || (safeResult?.endsWith('_error') ?? false) || obj(r.result).status === 'error'
      out.push({ tool: name, kind: toolKind(name, safeResult), ok: !failed, result_type: safeResult, at_secs: at })
    }
    // A call without any result in the transcript (e.g. the call ended first).
    for (const c of Array.isArray(turn.tool_calls) ? turn.tool_calls.map((x) => obj(x)) : []) {
      const name = str(c.tool_name)
      const id = str(c.request_id)
      if (!name || !TOOL_NAME.test(name) || (id && answered.has(id))) continue
      out.push({ tool: name, kind: toolKind(name, null), ok: true, result_type: null, at_secs: at })
    }
    if (out.length >= MAX_TOOL_EVENTS) break
  }
  return out.slice(0, MAX_TOOL_EVENTS)
}

/** Outcome proven by a system tool result (never by the AI's own words). */
export function evidenceOutcomeOf(events: CallToolEvent[]): 'transferred' | 'voicemail' | null {
  if (events.some((e) => e.ok && e.result_type !== null && /^transfer_to_number_[a-z_]*success$/.test(e.result_type))) return 'transferred'
  if (events.some((e) => e.ok && e.result_type === 'voicemail_detection_success')) return 'voicemail'
  return null
}

/** ConversationInitiationSource values that are telephony. */
const PHONE_SOURCES = new Set(['twilio', 'sip_trunk', 'exotel', 'genesys', 'avaya', 'audiocodes'])
/** Browser, app and dashboard sessions (SDKs, widget, dashboard preview, agent tests). */
const WEB_SOURCES = new Set([
  'android_sdk', 'node_js_sdk', 'react_native_sdk', 'react_sdk', 'js_sdk', 'python_sdk', 'swift_sdk', 'flutter_sdk', 'widget', 'template_preview',
])

/**
 * Telephony vs everything else. A conversation is a phone call when the
 * provider reports phone_call metadata or a telephony initiation source;
 * SDK/widget/dashboard sessions are 'web'; messaging, integrations, sub-agent
 * calls and unknown sources without phone metadata are 'other'.
 */
export function classifyChannel(meta: Obj): CallChannel {
  const phone = obj(meta.phone_call)
  const source = str(meta.conversation_initiation_source)
  if (Object.keys(phone).length > 0 || (source && PHONE_SOURCES.has(source))) return 'phone'
  if (source && WEB_SOURCES.has(source)) return 'web'
  return 'other'
}

const clip = (s: string | null, max: number) => (s === null ? null : s.slice(0, max))

function metadataOf(d: Obj, channel: CallChannel, toolEvents: CallToolEvent[]): CallMetadata {
  const meta = obj(d.metadata)
  const phone = obj(meta.phone_call)
  const analysis = obj(d.analysis)
  const features: string[] = []
  for (const [name, v] of Object.entries(obj(meta.features_usage))) {
    if (obj(v).used === true && /^[a-z0-9_]{1,40}$/.test(name)) features.push(name)
  }
  const error = obj(meta.error)
  const errorCode = num(error.code)
  const warnings = Array.isArray(meta.warnings)
    ? meta.warnings.filter((w): w is string => typeof w === 'string' && w.trim().length > 0).slice(0, MAX_WARNINGS).map((w) => w.slice(0, MAX_WARNING_LENGTH))
    : []
  const out: CallMetadata = { channel }
  const lang = str(meta.main_language)
  if (lang && /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?$/.test(lang)) out.main_language = lang
  const source = str(meta.conversation_initiation_source)
  if (source && /^[a-z0-9_]{1,40}$/.test(source)) out.initiation_source = source
  if (typeof meta.text_only === 'boolean') out.text_only = meta.text_only
  const queue = num(meta.queue_wait_secs)
  if (queue !== null && queue >= 0) out.queue_wait_secs = Math.round(queue * 10) / 10
  const version = str(d.version_id)
  if (version) out.version_id = version.slice(0, 80)
  const branch = str(d.branch_id)
  if (branch) out.branch_id = branch.slice(0, 80)
  const numberId = str(phone.phone_number_id)
  if (numberId) out.phone_number_external_id = numberId.slice(0, 80)
  if (features.length) out.features_used = features.slice(0, 20)
  const score = num(analysis.call_success_score)
  if (score !== null) out.call_success_score = score
  // Guardrail triggers (types only, never the text that triggered them).
  const guardrails = new Set<string>()
  for (const turn of Array.isArray(d.transcript) ? d.transcript.map((t) => obj(t)) : []) {
    for (const g of Array.isArray(turn.triggered_guardrails) ? turn.triggered_guardrails.map((x) => obj(x)) : []) {
      const type = str(g.guardrail_type)
      if (type && /^[a-z_]{1,40}$/.test(type)) guardrails.add(type)
    }
  }
  if (guardrails.size) out.guardrails_triggered = [...guardrails].slice(0, 10)
  if (toolEvents.length) out.tool_events = toolEvents
  if (errorCode !== null) out.provider_error = { code: errorCode, reason: clip(str(error.reason), MAX_ERROR_REASON) }
  if (warnings.length) out.warnings = warnings
  return out
}

function chargingOf(meta: Obj): NormalizedCallEvent['charging'] {
  const c = obj(meta.charging)
  if (Object.keys(c).length === 0) return null
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : null)
  return {
    isBurst: bool(c.is_burst),
    tier: clip(str(c.tier), 40),
    devDiscount: bool(c.dev_discount),
    llmPrice: num(c.llm_price),
    platformPrice: num(c.platform_price),
  }
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
    const channel = classifyChannel(meta)
    const toolEvents = toolEventsOf(d.transcript)
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
      channel,
      metadata: metadataOf(d, channel, toolEvents),
      evidenceOutcome: evidenceOutcomeOf(toolEvents),
      charging: chargingOf(meta),
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
