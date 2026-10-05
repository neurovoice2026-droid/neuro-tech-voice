import { describe, expect, it } from 'vitest'
import { normalizeCartesiaCall, normalizeCartesiaEnvelope, readCartesiaEnvelope, verifyCartesiaSecret } from './webhook'

const SECRET = 'cartesia_whsec_0123456789'
const START = '2026-10-05T10:00:00.000Z'
const END = '2026-10-05T10:02:05.400Z'
const EVENT_TS = '2026-10-05T10:02:06.000Z'

type CallInput = Parameters<typeof normalizeCartesiaCall>[0]

function call(over: Record<string, unknown> = {}): CallInput {
  return {
    id: 'call_c1',
    agent_id: 'agent_c1',
    status: 'completed',
    start_time: START,
    end_time: END,
    end_reason: 'user_hangup',
    summary: 'Caller asked for opening hours.',
    transcript: [
      { role: 'assistant', text: 'Hi, NeuroTech Dental.', start_timestamp: 0.4 },
      { role: 'user', text: 'When are you open?', start_timestamp: 2.6 },
      { role: 'system', text: 'tool output' },
      { role: 'user', text: '   ', start_timestamp: 4 },
      { role: 'assistant', text: 'We open at nine.' },
    ],
    telephony_params: {
      direction: 'inbound',
      from: '+40712345123',
      to: '+40312345678',
      headers: { 'X-NTV-Call-Id': 'local-from-header' },
    },
    dynamic_variables: {},
    ...over,
  }
}

describe('verifyCartesiaSecret', () => {
  it('accepts the exact shared secret', () => {
    expect(verifyCartesiaSecret(SECRET, SECRET)).toBe(true)
  })

  it.each([
    ['a different secret of the same length', SECRET.replace(/.$/, 'X')],
    ['a prefix of the secret', SECRET.slice(0, 10)],
    ['a longer value', `${SECRET}0`],
    ['different case', SECRET.toUpperCase()],
  ])('rejects %s', (_label, header) => {
    expect(verifyCartesiaSecret(header, SECRET)).toBe(false)
  })

  it('rejects a missing or empty header', () => {
    expect(verifyCartesiaSecret(null, SECRET)).toBe(false)
    expect(verifyCartesiaSecret('', SECRET)).toBe(false)
  })

  it('never accepts anything when no secret is configured', () => {
    expect(verifyCartesiaSecret('', '')).toBe(false)
    expect(verifyCartesiaSecret('anything', '')).toBe(false)
  })
})

describe('readCartesiaEnvelope', () => {
  it('reads the top-level ids, request id and timestamp', () => {
    const body = { type: 'call_completed', call_id: 'call_c1', agent_id: 'agent_c1', webhook_request_id: 'wr_1', timestamp: EVENT_TS, call: call() }
    const env = readCartesiaEnvelope(body)
    expect(env).toMatchObject({ type: 'call_completed', callId: 'call_c1', agentId: 'agent_c1', requestId: 'wr_1', timestamp: EVENT_TS, analysis: null })
    expect(env.call).toBe(body.call)
  })

  it('falls back to the ids inside the call object', () => {
    const env = readCartesiaEnvelope({ type: 'call_started', call: { id: 'call_x', agent_id: 'agent_x', status: 'started' } })
    expect(env).toMatchObject({ callId: 'call_x', agentId: 'agent_x', requestId: null, timestamp: null })
  })

  it('keeps the analysis object of post_call_analysis', () => {
    const env = readCartesiaEnvelope({ type: 'post_call_analysis', call_id: 'call_c1', analysis: { summary: 'S' } })
    expect(env).toMatchObject({ type: 'post_call_analysis', callId: 'call_c1', call: null, analysis: { summary: 'S' } })
  })

  it.each([null, undefined, 'x', 1, []])('returns an empty envelope for %j', (input) => {
    expect(readCartesiaEnvelope(input)).toEqual({ type: '', callId: null, agentId: null, requestId: null, timestamp: null, call: null, analysis: null })
  })
})

describe('normalizeCartesiaCall', () => {
  it('maps a completed call (duration, numbers, transcript, recording)', () => {
    const ev = normalizeCartesiaCall(call())
    expect(ev).toMatchObject({
      provider: 'cartesia',
      kind: 'call.completed',
      providerCallId: 'call_c1',
      externalAgentId: 'agent_c1',
      localCallId: 'local-from-header',
      twilioCallSid: null,
      direction: 'inbound',
      fromNumber: '+40712345123',
      toNumber: '+40312345678',
      startedAt: START,
      durationSeconds: 125,
      status: 'completed',
      summary: 'Caller asked for opening hours.',
      summaryTitle: null,
      callSuccessful: null,
      analysis: null,
      terminationReason: 'user_hangup',
      costCredits: null,
      costUsd: null,
      hasRecording: true,
      failureReason: null,
      eventTimestamp: null,
    })
    expect(ev?.transcript).toEqual([
      { role: 'agent', message: 'Hi, NeuroTech Dental.', time_in_call_secs: 0 },
      { role: 'user', message: 'When are you open?', time_in_call_secs: 3 },
      { role: 'agent', message: 'We open at nine.', time_in_call_secs: 0 },
    ])
  })

  it('prefers the ntv_call_id dynamic variable over the SIP header', () => {
    expect(normalizeCartesiaCall(call({ dynamic_variables: { ntv_call_id: 'local-from-var' } }))?.localCallId).toBe('local-from-var')
  })

  it('reads the call id from a lower-case SIP header too', () => {
    const ev = normalizeCartesiaCall(call({ telephony_params: { direction: 'outbound', headers: { 'x-ntv-call-id': 'local-lc' } } }))
    expect(ev).toMatchObject({ localCallId: 'local-lc', direction: 'outbound', fromNumber: null, toNumber: null })
  })

  it('has no local call id or direction when the provider gives none', () => {
    const ev = normalizeCartesiaCall(call({ telephony_params: null, dynamic_variables: null }))
    expect(ev).toMatchObject({ localCallId: null, direction: null, fromNumber: null, toNumber: null })
  })

  it('lets a separately delivered summary override the call summary and passes the event timestamp', () => {
    const ev = normalizeCartesiaCall(call(), { summary: 'From analysis', eventTimestamp: 1791201726 })
    expect(ev).toMatchObject({ summary: 'From analysis', eventTimestamp: 1791201726 })
  })

  it('has no duration without both start and end times and never a negative one', () => {
    expect(normalizeCartesiaCall(call({ end_time: null }))?.durationSeconds).toBeNull()
    expect(normalizeCartesiaCall(call({ end_time: '2026-10-05T09:59:00.000Z' }))?.durationSeconds).toBe(0)
  })

  it('maps a failed call that did connect as a completed lifecycle with failed status', () => {
    const ev = normalizeCartesiaCall(call({ status: 'failed', end_reason: 'error', error_message: 'LLM timeout' }))
    expect(ev).toMatchObject({ kind: 'call.completed', status: 'failed', durationSeconds: 125, hasRecording: false, failureReason: 'LLM timeout', terminationReason: 'error' })
  })

  it.each([
    ['dial_busy', 'busy'],
    ['dial_no_answer', 'no-answer'],
    ['dial_timeout', 'no-answer'],
    ['dial_failed', 'failed'],
    ['concurrency_limit', 'failed'],
  ])('maps a %s failure to an initiation failure with status %s', (endReason, status) => {
    const ev = normalizeCartesiaCall(call({ status: 'failed', end_reason: endReason, start_time: null, end_time: null, transcript: [] }))
    expect(ev).toMatchObject({
      provider: 'cartesia',
      kind: 'call.initiation_failed',
      providerCallId: 'call_c1',
      durationSeconds: 0,
      status,
      transcript: null,
      summary: null,
      hasRecording: false,
      terminationReason: endReason,
      failureReason: endReason,
    })
  })

  it('treats a failed call without an end reason or duration as an initiation failure', () => {
    const ev = normalizeCartesiaCall(call({ status: 'failed', end_reason: null, start_time: null, end_time: null, error_message: 'SIP 503' }))
    expect(ev).toMatchObject({ kind: 'call.initiation_failed', status: 'failed', failureReason: 'SIP 503', terminationReason: null })
    const bare = normalizeCartesiaCall(call({ status: 'failed', end_reason: null, start_time: null, end_time: null, error_message: null }))
    expect(bare?.failureReason).toBe('failed')
  })

  it('maps a started call to call.started (in progress, nothing final)', () => {
    const ev = normalizeCartesiaCall(call({ status: 'started', end_time: null, end_reason: null, transcript: null }))
    expect(ev).toMatchObject({
      kind: 'call.started',
      status: 'in-progress',
      startedAt: START,
      durationSeconds: null,
      transcript: null,
      summary: null,
      hasRecording: null,
      terminationReason: null,
    })
  })

  it('returns null for a call that was only created, has an unknown status or has no id', () => {
    expect(normalizeCartesiaCall(call({ status: 'created' }))).toBeNull()
    expect(normalizeCartesiaCall(call({ status: 'weird' }))).toBeNull()
    expect(normalizeCartesiaCall(call({ id: '' }))).toBeNull()
    expect(normalizeCartesiaCall(call({ id: undefined }))).toBeNull()
  })
})

describe('normalizeCartesiaEnvelope', () => {
  const tsSeconds = Math.floor(Date.parse(EVENT_TS) / 1000)

  it('normalizes call_completed with the envelope timestamp', () => {
    const env = readCartesiaEnvelope({ type: 'call_completed', webhook_request_id: 'wr_1', timestamp: EVENT_TS, call: call() })
    expect(normalizeCartesiaEnvelope(env)).toMatchObject({ kind: 'call.completed', providerCallId: 'call_c1', status: 'completed', eventTimestamp: tsSeconds })
  })

  it('normalizes call_started', () => {
    const env = readCartesiaEnvelope({ type: 'call_started', timestamp: START, call: call({ status: 'started', end_time: null }) })
    expect(normalizeCartesiaEnvelope(env)).toMatchObject({ kind: 'call.started', status: 'in-progress', eventTimestamp: Math.floor(Date.parse(START) / 1000) })
  })

  it('normalizes call_failed (busy / no answer) as an initiation failure', () => {
    const busy = readCartesiaEnvelope({ type: 'call_failed', call: call({ status: 'failed', end_reason: 'dial_busy', start_time: null, end_time: null }) })
    expect(normalizeCartesiaEnvelope(busy)).toMatchObject({ kind: 'call.initiation_failed', status: 'busy', eventTimestamp: null })
    const noAnswer = readCartesiaEnvelope({ type: 'call_failed', call: call({ status: 'failed', end_reason: 'dial_no_answer', start_time: null, end_time: null }) })
    expect(normalizeCartesiaEnvelope(noAnswer)).toMatchObject({ kind: 'call.initiation_failed', status: 'no-answer' })
  })

  it('returns null for a call event without a call object', () => {
    expect(normalizeCartesiaEnvelope(readCartesiaEnvelope({ type: 'call_completed', call_id: 'call_c1' }))).toBeNull()
  })

  it('maps post_call_analysis to call.analysis_available carrying only the summary', () => {
    const env = readCartesiaEnvelope({
      type: 'post_call_analysis',
      call_id: 'call_c1',
      agent_id: 'agent_c1',
      webhook_request_id: 'wr_2',
      timestamp: EVENT_TS,
      analysis: { summary: 'The caller booked a cleaning.', sentiment: 'positive' },
    })
    expect(normalizeCartesiaEnvelope(env)).toEqual({
      provider: 'cartesia',
      kind: 'call.analysis_available',
      providerCallId: 'call_c1',
      externalAgentId: 'agent_c1',
      localCallId: null,
      twilioCallSid: null,
      direction: null,
      fromNumber: null,
      toNumber: null,
      startedAt: null,
      durationSeconds: null,
      status: 'completed',
      transcript: null,
      summary: 'The caller booked a cleaning.',
      summaryTitle: null,
      callSuccessful: null,
      analysis: null,
      terminationReason: null,
      costCredits: null,
      costUsd: null,
      hasRecording: null,
      failureReason: null,
      eventTimestamp: tsSeconds,
    })
  })

  it('ignores post_call_analysis without a summary or without a call id', () => {
    expect(normalizeCartesiaEnvelope(readCartesiaEnvelope({ type: 'post_call_analysis', call_id: 'call_c1', analysis: {} }))).toBeNull()
    expect(normalizeCartesiaEnvelope(readCartesiaEnvelope({ type: 'post_call_analysis', call_id: 'call_c1', analysis: { summary: '' } }))).toBeNull()
    expect(normalizeCartesiaEnvelope(readCartesiaEnvelope({ type: 'post_call_analysis', analysis: { summary: 'S' } }))).toBeNull()
  })

  it('acknowledges but does not normalize call_turn and unknown types', () => {
    expect(normalizeCartesiaEnvelope(readCartesiaEnvelope({ type: 'call_turn', call_id: 'call_c1', call: call() }))).toBeNull()
    expect(normalizeCartesiaEnvelope(readCartesiaEnvelope({ type: 'something_new', call: call() }))).toBeNull()
  })
})
