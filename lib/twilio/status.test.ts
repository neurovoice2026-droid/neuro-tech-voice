import { describe, expect, it } from 'vitest'
import { isTerminalTwilioStatus, mapTwilioCallStatus, planStatusCallback, type StatusCallbackFacts } from './status'

const NOW = new Date('2026-09-17T10:00:00.000Z')

function facts(overrides: Omit<Partial<StatusCallbackFacts>, 'row'> & { row?: Partial<StatusCallbackFacts['row']> } = {}): StatusCallbackFacts {
  const { row, ...rest } = overrides
  return {
    twilioStatus: 'completed',
    durationSeconds: 95,
    streamStarted: true,
    now: NOW,
    ...rest,
    row: {
      status: 'in-progress',
      duration_seconds: 0,
      ended_at: null,
      end_reason: null,
      is_test: false,
      direction: 'inbound',
      pipeline_mode: 'cartesia_self',
      fallback_used: false,
      outcome: null,
      ...row,
    },
  }
}

describe('status mapping', () => {
  it('recognises terminal statuses only', () => {
    for (const s of ['completed', 'busy', 'no-answer', 'canceled', 'failed']) expect(isTerminalTwilioStatus(s)).toBe(true)
    for (const s of ['queued', 'ringing', 'in-progress', 'initiated', '', undefined]) expect(isTerminalTwilioStatus(s)).toBe(false)
  })

  it('maps canceled to no-answer (the table has no canceled)', () => {
    expect(mapTwilioCallStatus('completed')).toBe('completed')
    expect(mapTwilioCallStatus('busy')).toBe('busy')
    expect(mapTwilioCallStatus('failed')).toBe('failed')
    expect(mapTwilioCallStatus('no-answer')).toBe('no-answer')
    expect(mapTwilioCallStatus('canceled')).toBe('no-answer')
  })
})

describe('planStatusCallback', () => {
  it('bills an answered gateway call and stores status, duration and end time', () => {
    const plan = planStatusCallback(facts())
    expect(plan).toEqual({
      update: { status: 'completed', duration_seconds: 95, ended_at: NOW.toISOString() },
      bill: true,
      missed: false,
      fireMissedWorkflows: false,
    })
  })

  it('keeps a longer duration and the ended_at finalize already stored', () => {
    const plan = planStatusCallback(facts({ durationSeconds: 60, row: { duration_seconds: 64, ended_at: '2026-09-17T09:59:00.000Z' } }))
    expect(plan.update.duration_seconds).toBe(64)
    expect(plan.update.ended_at).toBe('2026-09-17T09:59:00.000Z')
  })

  it('bills ElevenLabs register-call calls without a stream marker', () => {
    expect(planStatusCallback(facts({ streamStarted: false, row: { pipeline_mode: 'elevenlabs' } })).bill).toBe(true)
  })

  it('treats a caller who hung up before the agent picked up as missed, not billed', () => {
    const plan = planStatusCallback(facts({ durationSeconds: 4, streamStarted: false }))
    expect(plan).toMatchObject({ bill: false, missed: true, fireMissedWorkflows: true })
    expect(plan.update.status).toBe('completed')
  })

  it('counts a stream-ended hand-over to ElevenLabs as answered', () => {
    expect(planStatusCallback(facts({ streamStarted: false, row: { fallback_used: true } })).bill).toBe(true)
  })

  it('bills a hand-over to ElevenLabs even after the failed gateway leg wrote error and its own mode', () => {
    const row = { end_reason: 'error', pipeline_mode: 'cartesia_self' as const, fallback_used: true, outcome: null }
    expect(planStatusCallback(facts({ handedOff: true, row }))).toMatchObject({ bill: true, missed: false })
    // Without the hand-over marker the same row is a platform failure.
    expect(planStatusCallback(facts({ handedOff: false, row }))).toMatchObject({ bill: false, missed: true })
    // A hand-over the caller hung up on before it connected is still not billed.
    expect(planStatusCallback(facts({ handedOff: true, durationSeconds: 0, row })).bill).toBe(false)
  })

  it('never bills test calls or fires their workflows', () => {
    expect(planStatusCallback(facts({ row: { is_test: true } }))).toMatchObject({ bill: false, missed: false, fireMissedWorkflows: false })
    expect(planStatusCallback(facts({ twilioStatus: 'no-answer', row: { is_test: true } })).missed).toBe(false)
  })

  it('keeps the status the router chose for refused calls and does nothing else', () => {
    const plan = planStatusCallback(facts({ row: { status: 'no-answer', end_reason: 'trial_expired', outcome: 'missed' } }))
    expect(plan).toMatchObject({ bill: false, missed: false, fireMissedWorkflows: false })
    expect(plan.update.status).toBe('no-answer')
  })

  it('does not bill platform failures but marks them missed when nobody took the call', () => {
    const plan = planStatusCallback(facts({ row: { end_reason: 'no_provider', pipeline_mode: null } }))
    expect(plan).toMatchObject({ bill: false, missed: true, fireMissedWorkflows: true })
    // A hand-off the on-call contact answered already set the outcome.
    expect(planStatusCallback(facts({ row: { end_reason: 'error', outcome: 'transferred' } })).missed).toBe(false)
  })

  it('marks unanswered outbound calls missed without firing call_missed workflows', () => {
    const plan = planStatusCallback(facts({ twilioStatus: 'no-answer', durationSeconds: 0, row: { direction: 'outbound' } }))
    expect(plan).toMatchObject({ bill: false, missed: true, fireMissedWorkflows: false })
    expect(plan.update.status).toBe('no-answer')
  })

  it('does not overwrite an outcome finalize already set', () => {
    expect(planStatusCallback(facts({ durationSeconds: 0, row: { outcome: 'answered' } })).missed).toBe(false)
  })

  it('handles busy, failed and bad durations', () => {
    expect(planStatusCallback(facts({ twilioStatus: 'busy', durationSeconds: 0 })).update.status).toBe('busy')
    expect(planStatusCallback(facts({ twilioStatus: 'failed', durationSeconds: Number.NaN })).update.duration_seconds).toBe(0)
  })
})
