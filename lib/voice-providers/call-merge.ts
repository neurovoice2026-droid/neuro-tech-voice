// Pure merge of a normalized provider event into a stored call row.
//
// Precedence (lifecycle_rank) prevents out-of-order or partial events from
// overwriting better data:
//   10 started/ringing < 20 routed/in-progress < 30 initiation failure
//   < 40 finalized from telephony data only (no provider result yet) < 50 completed
// - A completed call is never downgraded by a later failure/started event.
// - post_call_audio (recording_available) only touches recording fields.
// - Fields are only filled, never blanked, by a later event of equal rank
//   (a webhook retry carries the same data, so re-applying is a no-op).

import type { NormalizedCallEvent, NormalizedCallStatus } from './types'
import { CALL_OUTCOMES, type CallOutcome } from '@/types'

export interface StoredCall {
  status: string
  lifecycle_rank: number
  provider: string | null
  provider_call_id: string | null
  elevenlabs_conversation_id: string | null
  cartesia_call_id: string | null
  transcript: unknown
  summary: string | null
  duration_seconds: number | null
  started_at: string | null
  ended_at: string | null
  routing_reason: string | null
  outcome: string | null
}

export const RANK = { started: 10, routed: 20, failedToStart: 30, finalizedWithoutProvider: 40, completed: 50 } as const

function sentimentFor(callSuccessful: NormalizedCallEvent['callSuccessful']): 'positive' | 'negative' | 'neutral' | null {
  if (callSuccessful === 'success') return 'positive'
  if (callSuccessful === 'failure') return 'negative'
  if (callSuccessful === 'unknown') return 'neutral'
  return null
}

export function outcomeFrom(event: NormalizedCallEvent): CallOutcome | null {
  const raw = event.analysis?.data?.outcome
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase().replace(/[\s-]+/g, '_') as CallOutcome
    if ((CALL_OUTCOMES as readonly string[]).includes(v)) return v
  }
  if (event.kind === 'call.initiation_failed') return 'missed'
  return null
}

/** True when the stored call is served by a different provider than the event's. */
export function isFromOtherProvider(current: Pick<StoredCall, 'provider'> | null, event: Pick<NormalizedCallEvent, 'provider'>): boolean {
  return !!current?.provider && current.provider !== event.provider
}

/** Returns the column patch to apply, or null when the event changes nothing. */
export function mergeCallEvent(current: StoredCall | null, event: NormalizedCallEvent): Record<string, unknown> | null {
  const rank = current?.lifecycle_rank ?? 0
  const patch: Record<string, unknown> = {}

  // The call is served by another provider (e.g. ElevenLabs failed in the
  // first seconds and Cartesia took over): the abandoned conversation must
  // not overwrite status, transcript, duration or billing. Keep only its id.
  if (isFromOtherProvider(current, event)) {
    if (event.provider === 'elevenlabs' && !current?.elevenlabs_conversation_id) patch.elevenlabs_conversation_id = event.providerCallId
    if (event.provider === 'cartesia' && !current?.cartesia_call_id) patch.cartesia_call_id = event.providerCallId
    return Object.keys(patch).length ? patch : null
  }

  // Provider identity: always safe to fill.
  if (!current?.provider) patch.provider = event.provider
  if (!current?.provider_call_id) patch.provider_call_id = event.providerCallId
  if (event.provider === 'elevenlabs' && !current?.elevenlabs_conversation_id) patch.elevenlabs_conversation_id = event.providerCallId
  if (event.provider === 'cartesia' && !current?.cartesia_call_id) patch.cartesia_call_id = event.providerCallId

  if (event.kind === 'call.recording_available') {
    patch.has_recording = true
    patch.recording_status = 'available'
    return patch
  }

  if (event.kind === 'call.analysis_available') {
    if (event.summary && !current?.summary) patch.summary = event.summary
    if (event.analysis) patch.analysis = event.analysis
    return Object.keys(patch).length ? patch : null
  }

  if (event.kind === 'call.started') {
    if (rank < RANK.started) {
      patch.lifecycle_rank = RANK.started
      patch.status = 'in-progress'
      if (event.startedAt && !current?.started_at) patch.started_at = event.startedAt
    }
    return Object.keys(patch).length ? patch : null
  }

  if (event.kind === 'call.initiation_failed') {
    if (rank >= RANK.completed) return Object.keys(patch).length ? patch : null
    patch.lifecycle_rank = Math.max(rank, RANK.failedToStart)
    patch.status = event.status === 'busy' || event.status === 'no-answer' ? event.status : 'failed'
    patch.duration_seconds = 0
    if (!current?.ended_at) patch.ended_at = event.startedAt ?? new Date().toISOString()
    if (event.failureReason) patch.termination_reason = event.failureReason.slice(0, 200)
    const outcome = outcomeFrom(event)
    if (outcome && !current?.outcome) patch.outcome = outcome
    return patch
  }

  // call.completed
  patch.lifecycle_rank = RANK.completed
  const keepStatus: NormalizedCallStatus[] = ['transferred', 'after-hours']
  patch.status = current && keepStatus.includes(current.status as NormalizedCallStatus) ? current.status : event.status
  if (event.transcript && event.transcript.length) patch.transcript = event.transcript
  if (event.summary) patch.summary = event.summary
  if (event.summaryTitle) patch.summary_title = event.summaryTitle.slice(0, 200)
  if (event.callSuccessful) {
    patch.call_successful = event.callSuccessful
    patch.sentiment = sentimentFor(event.callSuccessful)
  }
  if (event.analysis) patch.analysis = event.analysis
  if (event.terminationReason) patch.termination_reason = event.terminationReason.slice(0, 200)
  if (typeof event.durationSeconds === 'number' && event.durationSeconds >= 0) patch.duration_seconds = Math.round(event.durationSeconds)
  if (event.startedAt) {
    patch.started_at = current?.started_at ?? event.startedAt
    if (typeof event.durationSeconds === 'number') {
      patch.ended_at = new Date(Date.parse(event.startedAt) + Math.round(event.durationSeconds) * 1000).toISOString()
    }
  }
  if (event.costCredits !== null) patch.cost_credits = event.costCredits
  if (event.costUsd !== null) patch.cost_usd = event.costUsd
  if (event.hasRecording !== null) {
    patch.has_recording = event.hasRecording
    patch.recording_status = event.hasRecording ? 'available' : 'unavailable'
  }
  if (event.direction) patch.direction = event.direction
  if (event.fromNumber) patch.from_number = event.fromNumber
  if (event.toNumber) patch.to_number = event.toNumber
  const outcome = outcomeFrom(event)
  if (outcome && !current?.outcome) patch.outcome = outcome
  return patch
}
