import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RANK, mergeCallEvent, outcomeFrom, type StoredCall } from './call-merge'
import type { NormalizedCallEvent } from './types'

const NOW = '2026-10-05T12:00:00.000Z'
const STARTED_AT = '2026-10-05T11:50:00.000Z'

/** A stored row plus the extra columns a patch may write. */
type Row = StoredCall & Record<string, unknown>

function row(over: Partial<Row> = {}): Row {
  return {
    status: 'in-progress',
    lifecycle_rank: RANK.routed,
    provider: 'elevenlabs',
    provider_call_id: 'conv_1',
    elevenlabs_conversation_id: 'conv_1',
    cartesia_call_id: null,
    transcript: null,
    summary: null,
    duration_seconds: null,
    started_at: STARTED_AT,
    ended_at: null,
    routing_reason: 'primary',
    outcome: null,
    ...over,
  }
}

const TRANSCRIPT = [
  { role: 'agent' as const, message: 'Hello!', time_in_call_secs: 0 },
  { role: 'user' as const, message: 'Hi, I would like to book.', time_in_call_secs: 2 },
]

function completed(over: Partial<NormalizedCallEvent> = {}): NormalizedCallEvent {
  return {
    provider: 'elevenlabs',
    kind: 'call.completed',
    providerCallId: 'conv_1',
    externalAgentId: 'agent_el_1',
    localCallId: null,
    twilioCallSid: 'CA1',
    direction: 'inbound',
    fromNumber: '+40712345123',
    toNumber: '+40312345678',
    startedAt: STARTED_AT,
    durationSeconds: 95,
    status: 'completed',
    transcript: TRANSCRIPT,
    summary: 'Booked a cleaning.',
    summaryTitle: 'Booking',
    callSuccessful: 'success',
    analysis: { evaluation: { booked: { result: 'success', rationale: null } }, data: { outcome: 'booked' } },
    terminationReason: 'remote hangup',
    costCredits: 812,
    costUsd: 0.42,
    hasRecording: true,
    failureReason: null,
    eventTimestamp: 1791201600,
    ...over,
  }
}

const EMPTY: Omit<NormalizedCallEvent, 'kind' | 'provider' | 'providerCallId' | 'status'> = {
  externalAgentId: null,
  localCallId: null,
  twilioCallSid: null,
  direction: null,
  fromNumber: null,
  toNumber: null,
  startedAt: null,
  durationSeconds: null,
  transcript: null,
  summary: null,
  summaryTitle: null,
  callSuccessful: null,
  analysis: null,
  terminationReason: null,
  costCredits: null,
  costUsd: null,
  hasRecording: null,
  failureReason: null,
  eventTimestamp: null,
}

function started(over: Partial<NormalizedCallEvent> = {}): NormalizedCallEvent {
  return { ...EMPTY, provider: 'elevenlabs', providerCallId: 'conv_1', kind: 'call.started', status: 'in-progress', startedAt: STARTED_AT, ...over }
}

function recording(over: Partial<NormalizedCallEvent> = {}): NormalizedCallEvent {
  return { ...EMPTY, provider: 'elevenlabs', providerCallId: 'conv_1', kind: 'call.recording_available', status: 'completed', hasRecording: true, ...over }
}

function analysisEvent(over: Partial<NormalizedCallEvent> = {}): NormalizedCallEvent {
  return { ...EMPTY, provider: 'elevenlabs', providerCallId: 'conv_1', kind: 'call.analysis_available', status: 'completed', summary: 'Late summary.', ...over }
}

function initiationFailed(over: Partial<NormalizedCallEvent> = {}): NormalizedCallEvent {
  return {
    ...EMPTY,
    provider: 'elevenlabs',
    providerCallId: 'conv_1',
    kind: 'call.initiation_failed',
    status: 'busy',
    direction: 'outbound',
    startedAt: NOW,
    durationSeconds: 0,
    hasRecording: false,
    failureReason: 'busy',
    terminationReason: 'initiation_failure:busy',
    ...over,
  }
}

/** Applies the merge the way the call store does: patch columns onto the row. */
function apply(current: Row | null, event: NormalizedCallEvent): Row {
  const patch = mergeCallEvent(current, event)
  return { ...(current ?? row({ provider: null, provider_call_id: null, elevenlabs_conversation_id: null, lifecycle_rank: 0, status: 'ringing', started_at: null })), ...(patch ?? {}) } as Row
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('mergeCallEvent — completed', () => {
  it('fills every column for a call the store has never seen', () => {
    const patch = mergeCallEvent(null, completed())
    expect(patch).toEqual({
      provider: 'elevenlabs',
      provider_call_id: 'conv_1',
      elevenlabs_conversation_id: 'conv_1',
      lifecycle_rank: RANK.completed,
      status: 'completed',
      transcript: TRANSCRIPT,
      summary: 'Booked a cleaning.',
      summary_title: 'Booking',
      call_successful: 'success',
      sentiment: 'positive',
      analysis: { evaluation: { booked: { result: 'success', rationale: null } }, data: { outcome: 'booked' } },
      termination_reason: 'remote hangup',
      duration_seconds: 95,
      started_at: STARTED_AT,
      ended_at: '2026-10-05T11:51:35.000Z',
      cost_credits: 812,
      cost_usd: 0.42,
      has_recording: true,
      recording_status: 'available',
      direction: 'inbound',
      from_number: '+40712345123',
      to_number: '+40312345678',
      outcome: 'booked',
    })
  })

  it('upgrades a started / routed call to completed and keeps the router start time', () => {
    const current = row({ status: 'in-progress', lifecycle_rank: RANK.started, started_at: '2026-10-05T11:49:58.000Z' })
    const patch = mergeCallEvent(current, completed())
    expect(patch).toMatchObject({
      lifecycle_rank: RANK.completed,
      status: 'completed',
      transcript: TRANSCRIPT,
      duration_seconds: 95,
      started_at: '2026-10-05T11:49:58.000Z',
      ended_at: '2026-10-05T11:51:35.000Z',
    })
    // Identity already known: not rewritten.
    expect(patch).not.toHaveProperty('provider')
    expect(patch).not.toHaveProperty('provider_call_id')
    expect(patch).not.toHaveProperty('elevenlabs_conversation_id')
  })

  it('upgrades an initiation failure that later completed', () => {
    const current = row({ status: 'busy', lifecycle_rank: RANK.failedToStart, duration_seconds: 0 })
    expect(mergeCallEvent(current, completed())).toMatchObject({ lifecycle_rank: RANK.completed, status: 'completed', duration_seconds: 95 })
  })

  it.each(['transferred', 'after-hours'])('keeps the %s status set by the router', (status) => {
    const patch = mergeCallEvent(row({ status, lifecycle_rank: RANK.routed }), completed())
    expect(patch?.status).toBe(status)
    expect(patch?.lifecycle_rank).toBe(RANK.completed)
  })

  it('records a provider-side failure status', () => {
    expect(mergeCallEvent(row(), completed({ status: 'failed' }))?.status).toBe('failed')
  })

  it('never blanks existing data with empty or missing fields', () => {
    const current = row({ transcript: TRANSCRIPT, summary: 'Existing', duration_seconds: 60, outcome: 'answered' })
    const patch = mergeCallEvent(
      current,
      completed({
        transcript: [],
        summary: null,
        summaryTitle: null,
        callSuccessful: null,
        analysis: null,
        terminationReason: null,
        durationSeconds: null,
        startedAt: null,
        costCredits: null,
        costUsd: null,
        hasRecording: null,
        direction: null,
        fromNumber: null,
        toNumber: null,
      }),
    )
    expect(patch).toEqual({ lifecycle_rank: RANK.completed, status: 'completed' })
  })

  it('does not overwrite an outcome the call already has', () => {
    const patch = mergeCallEvent(row({ outcome: 'transferred' }), completed())
    expect(patch).not.toHaveProperty('outcome')
  })

  it('rounds the duration and truncates long text columns', () => {
    const patch = mergeCallEvent(row(), completed({ durationSeconds: 61.6, summaryTitle: 't'.repeat(300), terminationReason: 'r'.repeat(300) }))
    expect(patch?.duration_seconds).toBe(62)
    expect(patch?.ended_at).toBe('2026-10-05T11:51:02.000Z')
    expect((patch?.summary_title as string).length).toBe(200)
    expect((patch?.termination_reason as string).length).toBe(200)
  })

  it('records an explicit "no recording"', () => {
    expect(mergeCallEvent(row(), completed({ hasRecording: false }))).toMatchObject({ has_recording: false, recording_status: 'unavailable' })
  })

  it('fills cartesia_call_id (not the ElevenLabs id) for Cartesia events', () => {
    const patch = mergeCallEvent(null, completed({ provider: 'cartesia', providerCallId: 'call_c1' }))
    expect(patch).toMatchObject({ provider: 'cartesia', provider_call_id: 'call_c1', cartesia_call_id: 'call_c1' })
    expect(patch).not.toHaveProperty('elevenlabs_conversation_id')
  })

  it('is idempotent: a duplicate delivery leaves the row unchanged', () => {
    const once = apply(row(), completed())
    const twice = apply(once, completed())
    expect(twice).toEqual(once)
    const thrice = apply(twice, completed())
    expect(thrice).toEqual(once)
  })
})

describe('mergeCallEvent — sentiment', () => {
  it.each([
    ['success', 'positive'],
    ['failure', 'negative'],
    ['unknown', 'neutral'],
  ] as const)('derives %s → %s', (callSuccessful, sentiment) => {
    expect(mergeCallEvent(row(), completed({ callSuccessful }))).toMatchObject({ call_successful: callSuccessful, sentiment })
  })

  it('leaves sentiment alone when the provider gives no verdict', () => {
    const patch = mergeCallEvent(row(), completed({ callSuccessful: null }))
    expect(patch).not.toHaveProperty('call_successful')
    expect(patch).not.toHaveProperty('sentiment')
  })
})

describe('mergeCallEvent — late / partial events never downgrade a completed call', () => {
  const done = () => apply(row(), completed())

  it('ignores a late call.started', () => {
    const current = done()
    expect(mergeCallEvent(current, started({ startedAt: '2026-10-05T11:59:00.000Z' }))).toBeNull()
    expect(apply(current, started())).toEqual(current)
  })

  it('a recording event only sets the recording columns', () => {
    const current = done()
    const patch = mergeCallEvent(current, recording())
    expect(patch).toEqual({ has_recording: true, recording_status: 'available' })
    const after = apply(current, recording())
    expect(after).toMatchObject({ status: 'completed', lifecycle_rank: RANK.completed, duration_seconds: 95, transcript: TRANSCRIPT, summary: 'Booked a cleaning.' })
  })

  it('a recording event never writes status, duration or transcript even if it carried them', () => {
    const current = row({ status: 'in-progress', lifecycle_rank: RANK.routed })
    const patch = mergeCallEvent(current, recording({ status: 'failed', durationSeconds: 1, transcript: [], summary: 'x' }))
    expect(patch).toEqual({ has_recording: true, recording_status: 'available' })
  })

  it('an analysis event does not replace an existing summary nor touch status/duration/transcript', () => {
    const current = done()
    expect(mergeCallEvent(current, analysisEvent())).toBeNull()
    const withAnalysis = analysisEvent({ analysis: { evaluation: {}, data: { outcome: 'booked', lead: true } } })
    expect(mergeCallEvent(current, withAnalysis)).toEqual({ analysis: { evaluation: {}, data: { outcome: 'booked', lead: true } } })
  })

  it('an analysis event fills a missing summary only', () => {
    const current = apply(row(), completed({ summary: null }))
    expect(mergeCallEvent(current, analysisEvent())).toEqual({ summary: 'Late summary.' })
  })

  it('an analysis event that arrives first is kept when the completed event has no summary', () => {
    const early = apply(null, analysisEvent({ provider: 'cartesia', providerCallId: 'call_c1' }))
    expect(early).toMatchObject({ summary: 'Late summary.', status: 'ringing', lifecycle_rank: 0 })
    const after = apply(early, completed({ provider: 'cartesia', providerCallId: 'call_c1', summary: null, summaryTitle: null }))
    expect(after).toMatchObject({ summary: 'Late summary.', status: 'completed', lifecycle_rank: RANK.completed })
  })

  it('ignores an initiation failure after completion', () => {
    const current = done()
    expect(mergeCallEvent(current, initiationFailed())).toBeNull()
    expect(apply(current, initiationFailed({ status: 'no-answer' }))).toEqual(current)
  })

  it('reaches the same final state whatever order the events arrive in', () => {
    const events = [started(), completed(), recording(), analysisEvent()]
    const permutations = (xs: NormalizedCallEvent[]): NormalizedCallEvent[][] =>
      xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]))
    const finals = permutations(events).map((order) => order.reduce<Row>((acc, ev) => apply(acc, ev), row({ status: 'ringing', lifecycle_rank: 0, started_at: null })))
    expect(finals).toHaveLength(24)
    for (const final of finals) {
      expect(final).toMatchObject({
        status: 'completed',
        lifecycle_rank: RANK.completed,
        duration_seconds: 95,
        transcript: TRANSCRIPT,
        summary: 'Booked a cleaning.',
        has_recording: true,
        recording_status: 'available',
        started_at: STARTED_AT,
        ended_at: '2026-10-05T11:51:35.000Z',
      })
      expect(final).toEqual(finals[0])
    }
  })
})

describe('mergeCallEvent — started', () => {
  it('marks a new call in progress with its start time', () => {
    expect(mergeCallEvent(null, started())).toEqual({
      provider: 'elevenlabs',
      provider_call_id: 'conv_1',
      elevenlabs_conversation_id: 'conv_1',
      lifecycle_rank: RANK.started,
      status: 'in-progress',
      started_at: STARTED_AT,
    })
  })

  it('does not move a routed call backwards', () => {
    expect(mergeCallEvent(row({ lifecycle_rank: RANK.routed }), started())).toBeNull()
  })
})

describe('mergeCallEvent — initiation failure', () => {
  it('marks a routed call busy with zero duration and a missed outcome', () => {
    const patch = mergeCallEvent(row({ lifecycle_rank: RANK.routed }), initiationFailed())
    expect(patch).toEqual({
      lifecycle_rank: RANK.failedToStart,
      status: 'busy',
      duration_seconds: 0,
      ended_at: NOW,
      termination_reason: 'busy',
      outcome: 'missed',
    })
  })

  it('maps no-answer through and any other status to failed', () => {
    expect(mergeCallEvent(row(), initiationFailed({ status: 'no-answer' }))?.status).toBe('no-answer')
    expect(mergeCallEvent(row(), initiationFailed({ status: 'failed' }))?.status).toBe('failed')
    expect(mergeCallEvent(row(), initiationFailed({ status: 'canceled' }))?.status).toBe('failed')
  })

  it('uses the current time when the event has no timestamp, and never moves an existing end time', () => {
    expect(mergeCallEvent(row(), initiationFailed({ startedAt: null }))?.ended_at).toBe(NOW)
    expect(mergeCallEvent(row({ ended_at: '2026-10-05T11:55:00.000Z' }), initiationFailed())).not.toHaveProperty('ended_at')
  })

  it('keeps an existing outcome and truncates the failure reason', () => {
    const patch = mergeCallEvent(row({ outcome: 'spam' }), initiationFailed({ failureReason: 'x'.repeat(250) }))
    expect(patch).not.toHaveProperty('outcome')
    expect((patch?.termination_reason as string).length).toBe(200)
  })

  it('is idempotent on a duplicate delivery', () => {
    const once = apply(row(), initiationFailed())
    expect(apply(once, initiationFailed())).toEqual(once)
  })
})

describe('outcomeFrom', () => {
  it.each([
    ['booked', 'booked'],
    ['  Message Taken ', 'message_taken'],
    ['message-taken', 'message_taken'],
    ['RESCHEDULED', 'rescheduled'],
    ['not-a-real-outcome', null],
  ])('normalizes %j to %j', (raw, expected) => {
    expect(outcomeFrom(completed({ analysis: { evaluation: {}, data: { outcome: raw } } }))).toBe(expected)
  })

  it('ignores non-string values and missing analysis', () => {
    expect(outcomeFrom(completed({ analysis: { evaluation: {}, data: { outcome: 3 } } }))).toBeNull()
    expect(outcomeFrom(completed({ analysis: null }))).toBeNull()
  })

  it('treats an initiation failure as missed unless analysis says otherwise', () => {
    expect(outcomeFrom(initiationFailed())).toBe('missed')
    expect(outcomeFrom(initiationFailed({ analysis: { evaluation: {}, data: { outcome: 'spam' } } }))).toBe('spam')
  })
})
