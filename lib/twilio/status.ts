// Pure decisions for Twilio's call status callback: which status the call row
// gets, whether its minutes are billed and whether it counts as missed.
// Kept free of I/O so every branch is unit-tested (lib/twilio/status.test.ts).

import type { CallStatus, VoicePipelineMode } from '@/types'

export type TerminalTwilioStatus = 'completed' | 'busy' | 'no-answer' | 'canceled' | 'failed'

const TERMINAL: ReadonlySet<string> = new Set(['completed', 'busy', 'no-answer', 'canceled', 'failed'])

export function isTerminalTwilioStatus(status: string | null | undefined): status is TerminalTwilioStatus {
  return typeof status === 'string' && TERMINAL.has(status)
}

/** Twilio CallStatus → calls.status (the table has no 'canceled'). */
export function mapTwilioCallStatus(status: TerminalTwilioStatus): Exclude<CallStatus, 'in-progress'> {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'busy':
      return 'busy'
    case 'failed':
      return 'failed'
    case 'no-answer':
    case 'canceled':
      return 'no-answer'
  }
}

/** Reasons the router refused a call with a message (or hung up on voicemail); never billed. */
export const ROUTER_REFUSAL_REASONS: ReadonlySet<string> = new Set([
  'agent_inactive',
  'number_inactive',
  'trial_expired',
  'minutes_exhausted',
  'org_not_onboarded',
  'outside_hours',
  'voicemail',
])

/** The platform couldn't serve the call (apology, maybe a hand-off to the team); not billed. */
export const PLATFORM_FAILURE_REASONS: ReadonlySet<string> = new Set(['no_provider', 'error'])

const REFUSED_STATUSES: ReadonlySet<string> = new Set(['no-answer', 'failed', 'busy'])

export interface StatusCallbackFacts {
  twilioStatus: TerminalTwilioStatus
  /** CallDuration in seconds (0 when absent). */
  durationSeconds: number
  row: {
    status: CallStatus
    duration_seconds: number | null
    ended_at: string | null
    end_reason: string | null
    is_test: boolean
    direction: 'inbound' | 'outbound'
    pipeline_mode: VoicePipelineMode | null
    fallback_used: boolean
    outcome: string | null
  }
  /** The gateway reported stream_started for this call. */
  streamStarted: boolean
  /**
   * The app handed the live caller to ElevenLabs (stream-ended or the voice
   * fallback URL). Kept outside the row because the gateway's finalize can
   * write its own mode and end_reason='error' back after the hand-over.
   */
  handedOff?: boolean
  now: Date
}

export interface StatusCallbackPlan {
  update: { status: CallStatus; duration_seconds: number; ended_at: string }
  /** Record usage (minutes) for this call. */
  bill: boolean
  /** Mark outcome 'missed' (only when nothing set an outcome yet). */
  missed: boolean
  /** Fire the call_missed workflows (inbound, real calls only). */
  fireMissedWorkflows: boolean
}

export function planStatusCallback(facts: StatusCallbackFacts): StatusCallbackPlan {
  const { row, twilioStatus } = facts
  const duration = Math.max(0, Math.floor(Number.isFinite(facts.durationSeconds) ? facts.durationSeconds : 0))
  const mapped = mapTwilioCallStatus(twilioStatus)

  // The router already answered with a message and decided the status
  // (refused, outside hours, voicemail, no provider): keep it.
  const refusedByRouter =
    row.end_reason !== null && ROUTER_REFUSAL_REASONS.has(row.end_reason) && REFUSED_STATUSES.has(row.status)

  const update = {
    status: refusedByRouter ? row.status : mapped,
    // finalize may already have stored a longer, gateway-measured duration.
    duration_seconds: Math.max(row.duration_seconds ?? 0, duration),
    ended_at: row.ended_at ?? facts.now.toISOString(),
  }

  if (row.is_test || refusedByRouter) {
    return { update, bill: false, missed: false, fireMissedWorkflows: false }
  }

  const handedOff = facts.handedOff === true
  // A hand-over that connected is not a platform failure, whatever end_reason
  // the failed gateway leg left behind.
  const platformFailure = !handedOff && row.end_reason !== null && PLATFORM_FAILURE_REASONS.has(row.end_reason)

  // Did the caller ever reach an agent? Register-call (ElevenLabs) answers in
  // Twilio directly; gateway modes are answered once the stream started; a
  // stream-ended hand-over to ElevenLabs also means an agent took over.
  const reachedAgent =
    !platformFailure &&
    mapped === 'completed' &&
    duration > 0 &&
    (handedOff || row.pipeline_mode === 'elevenlabs' || facts.streamStarted || row.fallback_used)

  // An outcome already set (finalize, a transfer that reached the team) wins.
  const missed = !reachedAgent && row.outcome === null
  return {
    update,
    bill: reachedAgent,
    missed,
    fireMissedWorkflows: missed && row.direction === 'inbound',
  }
}
