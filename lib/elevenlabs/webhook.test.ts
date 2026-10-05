import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  SIGNATURE_TOLERANCE_FUTURE_S,
  SIGNATURE_TOLERANCE_PAST_S,
  elevenLabsDedupeKey,
  normalizeElevenLabsEvent,
  readEnvelope,
  verifyElevenLabsSignature,
} from './webhook'
import { mergeCallEvent, type StoredCall } from '@/lib/voice-providers/call-merge'

const SECRET = 'wsec_test_0123456789abcdef'
const NOW_MS = Date.parse('2026-10-05T12:00:00.000Z')
const NOW_S = Math.floor(NOW_MS / 1000)

/** Builds the header exactly like ElevenLabs: HMAC-SHA256(secret, `${t}.${rawBody}`), hex. */
function sign(rawBody: string, t: number = NOW_S, secret: string = SECRET): string {
  const v0 = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  return `t=${t},v0=${v0}`
}

const START_S = NOW_S - 600

function transcriptionPayload(over: { data?: Record<string, unknown>; metadata?: Record<string, unknown>; analysis?: Record<string, unknown>; phone?: Record<string, unknown> } = {}) {
  return {
    type: 'post_call_transcription',
    event_timestamp: NOW_S,
    data: {
      agent_id: 'agent_el_1',
      conversation_id: 'conv_123',
      status: 'done',
      has_audio: true,
      transcript: [
        { role: 'agent', message: 'Hello, NeuroTech Dental, how can I help?', time_in_call_secs: 0 },
        { role: 'user', message: 'I need an appointment.', time_in_call_secs: 3 },
        { role: 'agent', message: null, tool_calls: [{ tool_name: 'book' }], time_in_call_secs: 5 },
        { role: 'user', message: '   ', time_in_call_secs: 6 },
        { role: 'user', message: 'Tomorrow at ten?' },
      ],
      metadata: {
        start_time_unix_secs: START_S,
        call_duration_secs: 95,
        cost: 812,
        cost_fiat: 0.42,
        termination_reason: 'Call ended by remote party',
        phone_call: {
          type: 'twilio',
          direction: 'inbound',
          agent_number: '+40312345678',
          external_number: '+40712345123',
          call_sid: 'CA0123456789',
          ...over.phone,
        },
        ...over.metadata,
      },
      analysis: {
        call_successful: 'success',
        transcript_summary: 'Caller booked an appointment for tomorrow at 10.',
        call_summary_title: 'Appointment booking',
        evaluation_criteria_results: {
          booked: { criteria_id: 'booked', result: 'success', rationale: 'Appointment confirmed' },
          polite: { criteria_id: 'polite', result: 'failure' },
          broken: 'not-an-object',
        },
        data_collection_results: {
          outcome: { data_collection_id: 'outcome', value: 'booked' },
          patient_name: { value: 'Ana' },
          party_size: { value: 2 },
          insured: { value: true },
          missing: { value: null },
          slots: { value: { day: 'mon', hour: 10 } },
        },
        ...over.analysis,
      },
      conversation_initiation_client_data: {
        dynamic_variables: { ntv_call_id: '7c0f3a52-9d0e-4c1b-8e8e-1f2a3b4c5d6e', system__caller_id: '+40712345123' },
      },
      ...over.data,
    },
  }
}

describe('verifyElevenLabsSignature', () => {
  const body = JSON.stringify(transcriptionPayload())

  it('exposes the documented tolerances (30 min past, 5 min future)', () => {
    expect(SIGNATURE_TOLERANCE_PAST_S).toBe(1800)
    expect(SIGNATURE_TOLERANCE_FUTURE_S).toBe(300)
  })

  it('accepts a valid HMAC over "t.rawBody" and returns the timestamp', () => {
    expect(verifyElevenLabsSignature(body, sign(body), SECRET, NOW_MS)).toEqual({ ok: true, timestamp: NOW_S })
  })

  it('accepts reordered parts, whitespace after commas and upper-case hex', () => {
    const v0 = crypto.createHmac('sha256', SECRET).update(`${NOW_S}.${body}`).digest('hex').toUpperCase()
    expect(verifyElevenLabsSignature(body, `v0=${v0}, t=${NOW_S}`, SECRET, NOW_MS)).toEqual({ ok: true, timestamp: NOW_S })
  })

  it('verifies the exact raw bytes: re-serialized JSON with different whitespace does not match', () => {
    const pretty = JSON.stringify(JSON.parse(body), null, 2)
    expect(verifyElevenLabsSignature(pretty, sign(body), SECRET, NOW_MS)).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('rejects a tampered body', () => {
    const tampered = body.replace('conv_123', 'conv_999')
    expect(tampered).not.toBe(body)
    expect(verifyElevenLabsSignature(tampered, sign(body), SECRET, NOW_MS)).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('rejects a signature made with a different secret', () => {
    expect(verifyElevenLabsSignature(body, sign(body, NOW_S, 'another-secret'), SECRET, NOW_MS)).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('rejects a timestamp swapped after signing (t is part of the signed message)', () => {
    const v0 = sign(body).split('v0=')[1]
    expect(verifyElevenLabsSignature(body, `t=${NOW_S - 1},v0=${v0}`, SECRET, NOW_MS)).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('rejects a truncated or over-long signature without throwing', () => {
    const v0 = sign(body).split('v0=')[1]
    expect(verifyElevenLabsSignature(body, `t=${NOW_S},v0=${v0.slice(0, 32)}`, SECRET, NOW_MS)).toEqual({ ok: false, reason: 'mismatch' })
    expect(verifyElevenLabsSignature(body, `t=${NOW_S},v0=${v0}00`, SECRET, NOW_MS)).toEqual({ ok: false, reason: 'mismatch' })
    expect(verifyElevenLabsSignature(body, `t=${NOW_S},v0=${v0.slice(1)}`, SECRET, NOW_MS)).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('accepts a timestamp exactly 30 minutes old but rejects one older than that as stale', () => {
    const edge = NOW_S - SIGNATURE_TOLERANCE_PAST_S
    expect(verifyElevenLabsSignature(body, sign(body, edge), SECRET, NOW_MS)).toEqual({ ok: true, timestamp: edge })
    expect(verifyElevenLabsSignature(body, sign(body, edge - 1), SECRET, NOW_MS)).toEqual({ ok: false, reason: 'stale' })
    expect(verifyElevenLabsSignature(body, sign(body, NOW_S - 24 * 3600), SECRET, NOW_MS)).toEqual({ ok: false, reason: 'stale' })
  })

  it('accepts up to 5 minutes of clock skew into the future but rejects more', () => {
    const edge = NOW_S + SIGNATURE_TOLERANCE_FUTURE_S
    expect(verifyElevenLabsSignature(body, sign(body, edge), SECRET, NOW_MS)).toEqual({ ok: true, timestamp: edge })
    expect(verifyElevenLabsSignature(body, sign(body, edge + 1), SECRET, NOW_MS)).toEqual({ ok: false, reason: 'future' })
  })

  it('checks the age before the HMAC so a stale replay is reported as stale', () => {
    const old = NOW_S - 3600
    expect(verifyElevenLabsSignature(body, sign(body, old, 'wrong'), SECRET, NOW_MS)).toEqual({ ok: false, reason: 'stale' })
  })

  it('uses the injected clock (defaults to Date.now)', () => {
    const t = NOW_S - 3600
    expect(verifyElevenLabsSignature(body, sign(body, t), SECRET, NOW_MS)).toEqual({ ok: false, reason: 'stale' })
    expect(verifyElevenLabsSignature(body, sign(body, t), SECRET, t * 1000)).toEqual({ ok: true, timestamp: t })
  })

  it('reports a missing header', () => {
    expect(verifyElevenLabsSignature(body, null, SECRET, NOW_MS)).toEqual({ ok: false, reason: 'missing' })
    expect(verifyElevenLabsSignature(body, '', SECRET, NOW_MS)).toEqual({ ok: false, reason: 'missing' })
  })

  it.each([
    ['garbage', 'not-a-signature'],
    ['only t', `t=${NOW_S}`],
    ['only v0', `v0=${'a'.repeat(64)}`],
    ['non-numeric t', `t=abc,v0=${'a'.repeat(64)}`],
    ['negative t', `t=-5,v0=${'a'.repeat(64)}`],
    ['fractional t', `t=${NOW_S}.5,v0=${'a'.repeat(64)}`],
    ['non-hex v0', `t=${NOW_S},v0=zz${'a'.repeat(62)}`],
    ['empty v0', `t=${NOW_S},v0=`],
    ['other scheme only', `t=${NOW_S},v1=${'a'.repeat(64)}`],
  ])('rejects a malformed header (%s)', (_label, header) => {
    expect(verifyElevenLabsSignature(body, header, SECRET, NOW_MS)).toEqual({ ok: false, reason: 'malformed' })
  })
})

describe('readEnvelope', () => {
  it('extracts type, timestamp and the conversation/agent ids', () => {
    const payload = transcriptionPayload()
    const env = readEnvelope(payload)
    expect(env.type).toBe('post_call_transcription')
    expect(env.eventTimestamp).toBe(NOW_S)
    expect(env.conversationId).toBe('conv_123')
    expect(env.agentId).toBe('agent_el_1')
    expect(env.data).toBe(payload.data)
  })

  it('accepts a numeric-string event_timestamp', () => {
    expect(readEnvelope({ type: 'post_call_audio', event_timestamp: String(NOW_S), data: {} }).eventTimestamp).toBe(NOW_S)
  })

  it.each([null, undefined, 'text', 42, [], { type: 7, data: [] }, { type: '', data: 'x' }])(
    'returns a safe empty envelope for unusable input (%j)',
    (input) => {
      const env = readEnvelope(input)
      expect(env.type).toBe('')
      expect(env.eventTimestamp).toBeNull()
      expect(env.conversationId).toBeNull()
      expect(env.agentId).toBeNull()
      expect(env.data).toEqual({})
    },
  )

  it('ignores non-finite or empty timestamps', () => {
    expect(readEnvelope({ type: 'x', event_timestamp: '', data: {} }).eventTimestamp).toBeNull()
    expect(readEnvelope({ type: 'x', event_timestamp: 'soon', data: {} }).eventTimestamp).toBeNull()
    expect(readEnvelope({ type: 'x', event_timestamp: Number.NaN, data: {} }).eventTimestamp).toBeNull()
  })
})

describe('normalizeElevenLabsEvent — post_call_transcription', () => {
  it('maps a completed inbound call', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(transcriptionPayload()))
    expect(ev).not.toBeNull()
    expect(ev).toMatchObject({
      provider: 'elevenlabs',
      kind: 'call.completed',
      providerCallId: 'conv_123',
      externalAgentId: 'agent_el_1',
      localCallId: '7c0f3a52-9d0e-4c1b-8e8e-1f2a3b4c5d6e',
      twilioCallSid: 'CA0123456789',
      direction: 'inbound',
      // Inbound: the caller (external_number) called our line (agent_number).
      fromNumber: '+40712345123',
      toNumber: '+40312345678',
      startedAt: new Date(START_S * 1000).toISOString(),
      durationSeconds: 95,
      status: 'completed',
      summary: 'Caller booked an appointment for tomorrow at 10.',
      summaryTitle: 'Appointment booking',
      callSuccessful: 'success',
      terminationReason: 'Call ended by remote party',
      costCredits: 812,
      costUsd: 0.42,
      hasRecording: true,
      failureReason: null,
      eventTimestamp: NOW_S,
    })
  })

  it('keeps only spoken turns, maps roles and defaults a missing time to 0', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(transcriptionPayload()))
    expect(ev?.transcript).toEqual([
      { role: 'agent', message: 'Hello, NeuroTech Dental, how can I help?', time_in_call_secs: 0 },
      { role: 'user', message: 'I need an appointment.', time_in_call_secs: 3 },
      { role: 'user', message: 'Tomorrow at ten?', time_in_call_secs: 0 },
    ])
  })

  it('returns an empty transcript when the provider sent none', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(transcriptionPayload({ data: { transcript: null } })))
    expect(ev?.transcript).toEqual([])
  })

  it('swaps from/to for outbound calls (agent_number is always our line)', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(transcriptionPayload({ phone: { direction: 'outbound' } })))
    expect(ev).toMatchObject({ direction: 'outbound', fromNumber: '+40312345678', toNumber: '+40712345123' })
  })

  it('leaves direction null for non-phone (web/widget) conversations', () => {
    const payload = transcriptionPayload()
    const meta = payload.data.metadata as Record<string, unknown>
    delete meta.phone_call
    const ev = normalizeElevenLabsEvent(readEnvelope(payload))
    expect(ev).toMatchObject({ direction: null, fromNumber: null, toNumber: null, twilioCallSid: null })
  })

  it('maps a provider-side failed status to failed', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(transcriptionPayload({ data: { status: 'failed' } })))
    expect(ev?.kind).toBe('call.completed')
    expect(ev?.status).toBe('failed')
  })

  it.each([
    ['success', 'success'],
    ['failure', 'failure'],
    ['unknown', 'unknown'],
    ['maybe', null],
    ['', null],
    [undefined, null],
  ] as const)('maps call_successful %j to %j', (raw, expected) => {
    const ev = normalizeElevenLabsEvent(readEnvelope(transcriptionPayload({ analysis: { call_successful: raw } })))
    expect(ev?.callSuccessful).toBe(expected)
  })

  it('normalizes evaluation criteria and data collection results', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(transcriptionPayload()))
    expect(ev?.analysis).toEqual({
      evaluation: {
        booked: { result: 'success', rationale: 'Appointment confirmed' },
        polite: { result: 'failure', rationale: null },
        broken: { result: 'unknown', rationale: null },
      },
      data: {
        outcome: 'booked',
        patient_name: 'Ana',
        party_size: 2,
        insured: true,
        missing: null,
        slots: JSON.stringify({ day: 'mon', hour: 10 }),
      },
    })
  })

  it('truncates structured data-collection values to 500 chars', () => {
    const big = { list: 'x'.repeat(2000) }
    const ev = normalizeElevenLabsEvent(readEnvelope(transcriptionPayload({ analysis: { evaluation_criteria_results: {}, data_collection_results: { big: { value: big } } } })))
    const value = ev?.analysis?.data.big
    expect(typeof value).toBe('string')
    expect((value as string).length).toBe(500)
  })

  it('returns null analysis when there are no criteria and no collected data', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(transcriptionPayload({ analysis: { evaluation_criteria_results: {}, data_collection_results: {} } })))
    expect(ev?.analysis).toBeNull()
  })

  it('handles a payload without analysis or metadata', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope({ type: 'post_call_transcription', data: { conversation_id: 'conv_min' } }))
    expect(ev).toMatchObject({
      kind: 'call.completed',
      providerCallId: 'conv_min',
      externalAgentId: null,
      localCallId: null,
      status: 'completed',
      transcript: [],
      summary: null,
      summaryTitle: null,
      callSuccessful: null,
      analysis: null,
      startedAt: null,
      durationSeconds: null,
      costCredits: null,
      costUsd: null,
      hasRecording: null,
      eventTimestamp: null,
    })
  })

  it('parses numeric strings for duration and cost', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(transcriptionPayload({ metadata: { call_duration_secs: '61', cost: '300', cost_fiat: 'n/a' } })))
    expect(ev).toMatchObject({ durationSeconds: 61, costCredits: 300, costUsd: null })
  })

  it('reports has_audio=false as no recording', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(transcriptionPayload({ data: { has_audio: false } })))
    expect(ev?.hasRecording).toBe(false)
  })

  it.each([
    ['missing', undefined],
    ['the "unknown" placeholder', 'unknown'],
    ['empty', ''],
    ['non-string', 123],
  ])('does not use a %s ntv_call_id as localCallId', (_label, value) => {
    const ev = normalizeElevenLabsEvent(
      readEnvelope(transcriptionPayload({ data: { conversation_initiation_client_data: { dynamic_variables: { ntv_call_id: value } } } })),
    )
    expect(ev?.localCallId).toBeNull()
  })

  it('returns null when the conversation id is missing', () => {
    const payload = transcriptionPayload({ data: { conversation_id: undefined } })
    expect(normalizeElevenLabsEvent(readEnvelope(payload))).toBeNull()
  })

  it('returns null for event types it does not handle', () => {
    expect(normalizeElevenLabsEvent(readEnvelope({ ...transcriptionPayload(), type: 'conversation_started' }))).toBeNull()
    expect(normalizeElevenLabsEvent(readEnvelope({ ...transcriptionPayload(), type: '' }))).toBeNull()
  })
})

describe('normalizeElevenLabsEvent — post_call_audio', () => {
  const audio = {
    type: 'post_call_audio',
    event_timestamp: NOW_S + 5,
    data: { agent_id: 'agent_el_1', conversation_id: 'conv_123', full_audio: 'SUQzBAAAAAAA' },
  }

  it('only announces the recording and carries nothing that could overwrite call data', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(audio))
    expect(ev).toMatchObject({
      provider: 'elevenlabs',
      kind: 'call.recording_available',
      providerCallId: 'conv_123',
      externalAgentId: 'agent_el_1',
      hasRecording: true,
      eventTimestamp: NOW_S + 5,
    })
    expect(ev).toMatchObject({
      transcript: null,
      summary: null,
      summaryTitle: null,
      callSuccessful: null,
      analysis: null,
      durationSeconds: null,
      startedAt: null,
      direction: null,
      fromNumber: null,
      toNumber: null,
      terminationReason: null,
      costCredits: null,
      costUsd: null,
      failureReason: null,
    })
  })

  it('arriving after the transcription only flips recording fields on the stored call', () => {
    const completed = normalizeElevenLabsEvent(readEnvelope(transcriptionPayload()))
    const audioEvent = normalizeElevenLabsEvent(readEnvelope(audio))
    if (!completed || !audioEvent) throw new Error('expected events')
    const base: StoredCall = {
      status: 'in-progress',
      lifecycle_rank: 20,
      provider: null,
      provider_call_id: null,
      elevenlabs_conversation_id: null,
      cartesia_call_id: null,
      transcript: null,
      summary: null,
      duration_seconds: null,
      started_at: null,
      ended_at: null,
      routing_reason: 'primary',
      outcome: null,
    }
    const afterCompleted = { ...base, ...mergeCallEvent(base, completed) } as StoredCall
    expect(afterCompleted.status).toBe('completed')
    expect(mergeCallEvent(afterCompleted, audioEvent)).toEqual({ has_recording: true, recording_status: 'available' })
  })
})

describe('normalizeElevenLabsEvent — call_initiation_failure', () => {
  function failure(reason: unknown, extra: Record<string, unknown> = {}) {
    return {
      type: 'call_initiation_failure',
      event_timestamp: NOW_S,
      data: {
        agent_id: 'agent_el_1',
        conversation_id: 'conv_fail',
        failure_reason: reason,
        metadata: {
          type: 'twilio',
          body: { CallSid: 'CA9999', From: '+40312345678', To: '+40712345123', CallStatus: 'busy' },
        },
        conversation_initiation_client_data: { dynamic_variables: { ntv_call_id: 'local-call-1' } },
        ...extra,
      },
    }
  }

  it('maps busy to a busy outbound initiation failure', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(failure('busy')))
    expect(ev).toMatchObject({
      provider: 'elevenlabs',
      kind: 'call.initiation_failed',
      providerCallId: 'conv_fail',
      localCallId: 'local-call-1',
      twilioCallSid: 'CA9999',
      direction: 'outbound',
      fromNumber: '+40312345678',
      toNumber: '+40712345123',
      startedAt: new Date(NOW_MS).toISOString(),
      durationSeconds: 0,
      status: 'busy',
      transcript: null,
      summary: null,
      callSuccessful: null,
      analysis: null,
      hasRecording: false,
      failureReason: 'busy',
      terminationReason: 'initiation_failure:busy',
    })
  })

  it('maps no-answer to no-answer', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(failure('no-answer')))
    expect(ev).toMatchObject({ status: 'no-answer', failureReason: 'no-answer' })
  })

  it.each([
    ['unknown', 'unknown'],
    [undefined, 'unknown'],
    ['', 'unknown'],
    ['sip-503', 'sip-503'],
  ])('maps failure_reason %j to failed (reason %j)', (raw, reason) => {
    const ev = normalizeElevenLabsEvent(readEnvelope(failure(raw)))
    expect(ev).toMatchObject({ kind: 'call.initiation_failed', status: 'failed', failureReason: reason, terminationReason: `initiation_failure:${reason}` })
  })

  it('tolerates SIP metadata without a Twilio body', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(failure('busy', { metadata: { type: 'sip', body: { sip_status: 486 } } })))
    expect(ev).toMatchObject({ status: 'busy', twilioCallSid: null, fromNumber: null, toNumber: null })
  })

  it('has no start time when the event timestamp is missing', () => {
    const payload = failure('busy')
    const ev = normalizeElevenLabsEvent(readEnvelope({ ...payload, event_timestamp: undefined }))
    expect(ev?.startedAt).toBeNull()
  })
})

describe('elevenLabsDedupeKey', () => {
  it('combines event type and conversation id', () => {
    expect(elevenLabsDedupeKey(readEnvelope(transcriptionPayload()))).toBe('post_call_transcription:conv_123')
  })

  it('is identical for a retried delivery and distinct per event type', () => {
    const a = elevenLabsDedupeKey(readEnvelope(transcriptionPayload()))
    const retry = elevenLabsDedupeKey(readEnvelope(JSON.parse(JSON.stringify(transcriptionPayload()))))
    const audio = elevenLabsDedupeKey(readEnvelope({ type: 'post_call_audio', data: { conversation_id: 'conv_123' } }))
    expect(retry).toBe(a)
    expect(audio).toBe('post_call_audio:conv_123')
    expect(audio).not.toBe(a)
  })

  it('uses a placeholder when the conversation id is missing', () => {
    expect(elevenLabsDedupeKey(readEnvelope({ type: 'post_call_audio', data: {} }))).toBe('post_call_audio:none')
  })
})
