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
// - Provider cost is never written to calls (tenant-readable): call-store
//   records it in the service-only call_provider_costs table.
// - A call whose content was purged by the privacy retention
//   (retention_applied_at) never gets transcript, summary or analysis back.
// - calls.sentiment is no longer derived from call_successful (the AI's
//   verdict on the call's goal is not the caller's sentiment); the column is
//   kept for older rows.

import type { NormalizedCallEvent, NormalizedCallStatus } from './types'
import { CALL_OUTCOMES, type CallOutcome } from '@/types'
import type { CallMetadata } from './call-metadata'

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
  /** Migration 017 (optional so callers that predate it still type-check). */
  call_metadata?: unknown
  recording_status?: string | null
  retention_applied_at?: string | null
}

export const RANK = { started: 10, routed: 20, failedToStart: 30, finalizedWithoutProvider: 40, completed: 50 } as const

/** Outcomes the platform sets from evidence (tool results, telephony), never from the AI's data collection alone. */
export const EVIDENCE_OUTCOMES: ReadonlySet<string> = new Set(['transferred', 'voicemail', 'missed'])

export function outcomeFrom(event: NormalizedCallEvent): CallOutcome | null {
  if (event.evidenceOutcome) return event.evidenceOutcome
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

function metadataObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

/** Provider metadata merged over what is stored (new keys win); null when nothing changes. */
export function mergeMetadata(current: unknown, incoming: CallMetadata | null | undefined, opts: { purged?: boolean } = {}): Record<string, unknown> | null {
  if (!incoming) return null
  const next: Record<string, unknown> = { ...metadataObject(current) }
  let changed = false
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue
    // Free text that may quote the caller is not restored after a retention purge.
    if (opts.purged && (k === 'provider_error' || k === 'warnings')) continue
    if (JSON.stringify(next[k]) !== JSON.stringify(v)) {
      next[k] = v
      changed = true
    }
  }
  return changed ? next : null
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

  const purged = !!current?.retention_applied_at
  // A recording the provider already reported gone (404 on the audio route) or
  // removed by retention stays gone: a re-fetched conversation still says
  // has_audio, but the player would always fail.
  const recordingGone = current?.recording_status === 'deleted' || (current?.recording_status === 'unavailable' && rank >= RANK.completed)

  if (event.kind === 'call.recording_available') {
    if (purged || current?.recording_status === 'deleted') return Object.keys(patch).length ? patch : null
    patch.has_recording = true
    patch.recording_status = 'available'
    return patch
  }

  if (event.kind === 'call.analysis_available') {
    if (purged) return Object.keys(patch).length ? patch : null
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
  if (!purged) {
    if (event.transcript && event.transcript.length) patch.transcript = event.transcript
    if (event.summary) patch.summary = event.summary
    if (event.summaryTitle) patch.summary_title = event.summaryTitle.slice(0, 200)
    if (event.analysis) patch.analysis = event.analysis
  }
  if (event.callSuccessful) patch.call_successful = event.callSuccessful
  const metadata = mergeMetadata(current?.call_metadata, event.metadata, { purged })
  if (metadata) patch.call_metadata = metadata
  if (event.terminationReason) patch.termination_reason = event.terminationReason.slice(0, 200)
  if (typeof event.durationSeconds === 'number' && event.durationSeconds >= 0) patch.duration_seconds = Math.round(event.durationSeconds)
  if (event.startedAt) {
    patch.started_at = current?.started_at ?? event.startedAt
    if (typeof event.durationSeconds === 'number') {
      patch.ended_at = new Date(Date.parse(event.startedAt) + Math.round(event.durationSeconds) * 1000).toISOString()
    }
  }
  if (event.hasRecording !== null && !purged && !recordingGone) {
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
