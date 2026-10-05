// Human-readable labels for call history: who handled a call, why it was
// routed that way, provider failover reasons, statuses and outcomes.
//
// Client-safe: type-only imports, no server modules. Shared by the calls page,
// the dashboard and the CSV export so every surface says the same thing.
//
// Rule: raw internal codes ("elevenlabs:circuit_open", "no_provider") are never
// shown on their own. Unknown values fall back to a generic, honest label.

import type {
  Call,
  CallFilters,
  CallOutcome,
  CallStatus,
  RoutingReason,
  VoiceProviderId,
} from '@/types'

function hasKey<K extends string>(map: Record<K, unknown>, key: string | null | undefined): key is K {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(map, key)
}

// ─── Value lists (runtime) ───────────────────────────────────────────────────

export const CALL_STATUS_VALUES: readonly CallStatus[] = [
  'completed',
  'failed',
  'busy',
  'no-answer',
  'in-progress',
  'ringing',
  'canceled',
  'after-hours',
  'transferred',
] as const

export const ROUTING_REASON_VALUES: readonly RoutingReason[] = [
  'primary',
  'provider_fallback',
  'after_hours',
  'transferred',
  'no_provider',
  'agent_inactive',
  'number_inactive',
] as const

export const VOICE_PROVIDER_VALUES: readonly VoiceProviderId[] = ['elevenlabs', 'cartesia'] as const

/** Statuses of a call that has not finished yet. */
export const LIVE_CALL_STATUSES: readonly CallStatus[] = ['ringing', 'in-progress'] as const

// ─── Filters / list types shared by the calls page ───────────────────────────

export type CallProviderFilter = 'all' | VoiceProviderId

/** The calls page filters: the shared CallFilters plus the provider filter. */
export interface CallListFilters extends CallFilters {
  provider: CallProviderFilter
}

/** A call as list endpoints return it (transcript and analysis are detail-only). */
export type CallListItem = Omit<Call, 'transcript' | 'analysis'>

// ─── Providers ────────────────────────────────────────────────────────────────

export const PROVIDER_LABEL: Record<VoiceProviderId, string> = {
  elevenlabs: 'ElevenLabs',
  cartesia: 'Cartesia',
}

export function providerLabel(provider: string | null | undefined): string | null {
  return hasKey(PROVIDER_LABEL, provider) ? PROVIDER_LABEL[provider] : null
}

// ─── Routing reasons ──────────────────────────────────────────────────────────

export const ROUTING_REASON_LABEL: Record<RoutingReason, string> = {
  primary: 'Answered by AI',
  provider_fallback: 'Backup voice agent (Cartesia)',
  after_hours: 'After-hours handling',
  transferred: 'Transferred to a person',
  no_provider: 'No agent available',
  agent_inactive: 'Agent paused',
  number_inactive: 'Agent paused',
}

export const ROUTING_REASON_DESCRIPTION: Record<RoutingReason, string> = {
  primary: 'Your AI agent answered on the primary voice provider.',
  provider_fallback: 'The primary voice provider could not take the call, so the backup voice agent answered instead.',
  after_hours: 'The call came in outside your working hours and got your after-hours handling.',
  transferred: 'The call was handed over to a person.',
  no_provider: 'No voice agent could take this call. The caller heard an apology or was forwarded.',
  agent_inactive: 'Your agent was paused, so it did not take this call.',
  number_inactive: 'This phone number was paused, so the agent did not take this call.',
}

export function routingReasonLabel(reason: string | null | undefined): string | null {
  return hasKey(ROUTING_REASON_LABEL, reason) ? ROUTING_REASON_LABEL[reason] : null
}

export function routingReasonDescription(reason: string | null | undefined): string | null {
  return hasKey(ROUTING_REASON_DESCRIPTION, reason) ? ROUTING_REASON_DESCRIPTION[reason] : null
}

// ─── Failover reasons ─────────────────────────────────────────────────────────
// Stored by the router as a comma-separated list of `<provider>:<code>` tokens,
// e.g. "elevenlabs:circuit_open", "elevenlabs:connect_timeout",
// "elevenlabs:stream_failed_early", "cartesia:dial_busy".

type Role = 'Primary' | 'Backup' | 'Voice'

function roleFor(provider: string | null, primary: VoiceProviderId): Role {
  if (!provider || !hasKey(PROVIDER_LABEL, provider)) return 'Voice'
  return provider === primary ? 'Primary' : 'Backup'
}

const CONNECT_CODE_TEXT: Record<string, (role: Role) => string> = {
  timeout: (r) => `${r} provider timed out`,
  network: (r) => `${r} provider unreachable`,
  upstream: (r) => `${r} provider error`,
  bad_response: (r) => `${r} provider error`,
  unknown: (r) => `${r} provider error`,
  rate_limited: (r) => `${r} provider busy`,
  quota: (r) => `${r} provider quota exhausted`,
  auth: (r) => `${r} provider authentication failed`,
  circuit_open: (r) => `${r} provider degraded`,
  not_configured: (r) => `${r} provider not set up`,
  validation: (r) => `${r} provider rejected the call`,
  not_found: (r) => `${r} provider rejected the call`,
  conflict: (r) => `${r} provider rejected the call`,
}

const DIAL_STATUS_TEXT: Record<string, (role: Role) => string> = {
  busy: (r) => `${r} agent line busy`,
  'no-answer': (r) => `${r} agent did not answer`,
  canceled: (r) => `Caller hung up before the ${r.toLowerCase()} agent answered`,
  failed: (r) => `${r} agent connection failed`,
}

const SKIP_CODE_TEXT: Record<string, (role: Role) => string> = {
  circuit_open: (r) => `${r} provider degraded`,
  not_configured: (r) => `${r} provider not set up`,
  resource_missing: (r) => `${r} agent not ready yet`,
  fallback_disabled: () => 'Backup voice agent turned off',
  forced_elsewhere: (r) => `Calls temporarily routed away from the ${r.toLowerCase()} provider`,
  stream_failed_early: (r) => `${r} call failed to start`,
}

function describeToken(token: string, primary: VoiceProviderId): string {
  const sep = token.indexOf(':')
  const provider = sep >= 0 ? token.slice(0, sep) : null
  const code = (sep >= 0 ? token.slice(sep + 1) : token).trim()
  const role = roleFor(provider, primary)
  if (code.startsWith('connect_')) {
    const sub = code.slice('connect_'.length)
    return hasKey(CONNECT_CODE_TEXT, sub) ? CONNECT_CODE_TEXT[sub](role) : `${role} provider error`
  }
  if (code.startsWith('dial_')) {
    const sub = code.slice('dial_'.length)
    return hasKey(DIAL_STATUS_TEXT, sub) ? DIAL_STATUS_TEXT[sub](role) : `${role} agent connection failed`
  }
  if (hasKey(SKIP_CODE_TEXT, code)) return SKIP_CODE_TEXT[code](role)
  return `${role} provider issue`
}

/** Friendly, de-duplicated explanations for a stored failover_reason. */
export function describeFailoverReason(
  raw: string | null | undefined,
  primary: VoiceProviderId | null | undefined = 'elevenlabs',
): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const token of raw.split(',')) {
    const t = token.trim()
    if (!t) continue
    const text = describeToken(t, primary ?? 'elevenlabs')
    if (!out.includes(text)) out.push(text)
  }
  return out
}

/** One-line version of describeFailoverReason (null when there is none). */
export function failoverReasonLabel(
  raw: string | null | undefined,
  primary: VoiceProviderId | null | undefined = 'elevenlabs',
): string | null {
  const parts = describeFailoverReason(raw, primary)
  return parts.length ? parts.join(' · ') : null
}

// ─── Statuses ─────────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<CallStatus, string> = {
  completed: 'Completed',
  failed: 'Failed',
  busy: 'Busy',
  'no-answer': 'No answer',
  'in-progress': 'In progress',
  ringing: 'Ringing',
  canceled: 'Canceled',
  'after-hours': 'After hours',
  transferred: 'Transferred',
}

export function statusLabel(status: string | null | undefined): string {
  return hasKey(STATUS_LABEL, status) ? STATUS_LABEL[status] : 'Unknown'
}

export function isLiveStatus(status: string | null | undefined): boolean {
  return status === 'ringing' || status === 'in-progress'
}

// ─── Outcomes and analysis ────────────────────────────────────────────────────

export const OUTCOME_LABEL: Record<CallOutcome, string> = {
  booked: 'Appointment booked',
  rescheduled: 'Appointment moved',
  cancelled: 'Appointment cancelled',
  answered: 'Question answered',
  message_taken: 'Message taken',
  transferred: 'Transferred',
  flagged: 'Flagged for follow-up',
  missed: 'Missed',
  spam: 'Spam',
  other: 'Other',
}

export function outcomeLabel(outcome: string | null | undefined): string | null {
  return hasKey(OUTCOME_LABEL, outcome) ? OUTCOME_LABEL[outcome] : null
}

const CALL_RESULT_LABEL: Record<'success' | 'failure' | 'unknown', string> = {
  success: 'Successful',
  failure: 'Not successful',
  unknown: 'Unclear',
}

export function callResultLabel(value: string | null | undefined): string | null {
  return hasKey(CALL_RESULT_LABEL, value) ? CALL_RESULT_LABEL[value] : null
}

const EVALUATION_RESULT_LABEL: Record<'success' | 'failure' | 'unknown', string> = {
  success: 'Passed',
  failure: 'Not met',
  unknown: 'Unclear',
}

export function evaluationResultLabel(result: string | null | undefined): string {
  const key = typeof result === 'string' ? result.trim().toLowerCase() : ''
  return hasKey(EVALUATION_RESULT_LABEL, key) ? EVALUATION_RESULT_LABEL[key] : 'Unclear'
}

export function evaluationResultTone(result: string | null | undefined): 'success' | 'failure' | 'unknown' {
  const key = typeof result === 'string' ? result.trim().toLowerCase() : ''
  return key === 'success' || key === 'failure' ? key : 'unknown'
}

const TERMINATION_TEXT: Record<string, string> = {
  agent_hangup: 'The agent ended the call',
  client_hangup: 'The caller hung up',
  client_disconnected: 'The caller disconnected',
  voicemail_detected: 'Voicemail detected',
  max_duration: 'Maximum call length reached',
  call_inactivity: 'Ended after a long silence',
  client_inactivity: 'Ended after a long silence',
  dial_no_answer: 'No answer',
  dial_busy: 'Line busy',
  dial_failed: 'The call could not be placed',
  dial_timeout: 'The call could not be placed',
  api_cancelled: 'Cancelled',
  concurrency_limit: 'Too many simultaneous calls',
  agent_error: 'Ended because of an error',
  network_error: 'Ended because of an error',
  config_error: 'Ended because of an error',
  error: 'Ended because of an error',
}

/** Provider end reasons: known codes get a sentence, free text is tidied up. */
export function terminationReasonLabel(raw: string | null | undefined): string | null {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return null
  const key = value.toLowerCase()
  if (hasKey(TERMINATION_TEXT, key)) return TERMINATION_TEXT[key]
  const text = /\s/.test(value) ? value : value.replace(/[_-]+/g, ' ')
  const clean = text.replace(/\.$/, '')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/** "customer_name" → "Customer name" (data collection / evaluation ids). */
export function humanizeKey(key: string): string {
  const spaced = key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase()
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key
}

export function formatCollectedValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const s = String(value).trim()
  return s || '—'
}

// ─── "Handled by" ─────────────────────────────────────────────────────────────

export type HandledByKind =
  | 'ai'
  | 'fallback'
  | 'after_hours'
  | 'transferred'
  | 'failed'
  | 'paused'
  | 'not_connected'
  | 'connecting'
  | 'unknown'

export interface HandledBy {
  kind: HandledByKind
  label: string
  description: string
}

export type HandledByInput = Pick<Call, 'status'> &
  Partial<Pick<Call, 'provider' | 'routing_reason' | 'elevenlabs_conversation_id'>>

/** Who (or what) handled the call, for the "Handled by" badge. */
export function handledBy(call: HandledByInput): HandledBy {
  const reason = call.routing_reason ?? null
  const status = call.status

  if (reason === 'transferred' || status === 'transferred') {
    return { kind: 'transferred', label: 'Transferred', description: ROUTING_REASON_DESCRIPTION.transferred }
  }
  if (reason === 'after_hours' || status === 'after-hours') {
    return { kind: 'after_hours', label: 'After hours', description: ROUTING_REASON_DESCRIPTION.after_hours }
  }
  if (reason === 'agent_inactive' || reason === 'number_inactive') {
    return { kind: 'paused', label: 'Agent paused', description: ROUTING_REASON_DESCRIPTION[reason] }
  }
  if (reason === 'no_provider') {
    return { kind: 'failed', label: 'Failed', description: ROUTING_REASON_DESCRIPTION.no_provider }
  }

  const provider = call.provider ?? (call.elevenlabs_conversation_id ? 'elevenlabs' : null)
  const name = providerLabel(provider)

  if (status === 'failed') {
    return {
      kind: 'failed',
      label: 'Failed',
      description: name ? `The call could not be completed on ${name}.` : 'The call could not be connected to the voice agent.',
    }
  }
  if (status === 'busy' || status === 'no-answer' || status === 'canceled') {
    return {
      kind: 'not_connected',
      label: 'Not connected',
      description: status === 'busy' ? 'The line was busy.' : status === 'no-answer' ? 'Nobody answered.' : 'The call was canceled before it connected.',
    }
  }
  if (reason === 'provider_fallback') {
    return {
      kind: 'fallback',
      label: `Fallback · ${name ?? PROVIDER_LABEL.cartesia}`,
      description: ROUTING_REASON_DESCRIPTION.provider_fallback,
    }
  }
  if (name) {
    return { kind: 'ai', label: `AI · ${name}`, description: ROUTING_REASON_DESCRIPTION.primary }
  }
  if (isLiveStatus(status)) {
    return { kind: 'connecting', label: 'Connecting', description: 'The call is being connected to your voice agent.' }
  }
  return { kind: 'unknown', label: 'Unknown', description: 'Routing details were not recorded for this call.' }
}
