import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  conversationMayUpdateCall,
  mapElevenLabsTranscript,
  mapInitiationFailureEvent,
  mapTranscriptionEvent,
  readDynamicVariables,
  readPhoneCall,
  sentimentFromCallSuccessful,
  transcriptionAction,
  verifyElevenLabsSignature,
  WebhookEnvelopeSchema,
} from './payload'

const SECRET = 'wsec_test_secret_value'
const NOW = 1_758_100_000

function sign(body: string, t = NOW, secret = SECRET) {
  return `t=${t},v0=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`
}

describe('verifyElevenLabsSignature', () => {
  const body = JSON.stringify({ type: 'post_call_transcription', data: { conversation_id: 'conv_1' } })

  it('accepts a valid signature', () => {
    expect(verifyElevenLabsSignature(body, sign(body), SECRET, NOW)).toBe(true)
  })

  it('rejects a tampered body, another secret, a missing header and malformed parts', () => {
    expect(verifyElevenLabsSignature(`${body} `, sign(body), SECRET, NOW)).toBe(false)
    expect(verifyElevenLabsSignature(body, sign(body, NOW, 'other'), SECRET, NOW)).toBe(false)
    expect(verifyElevenLabsSignature(body, null, SECRET, NOW)).toBe(false)
    expect(verifyElevenLabsSignature(body, 'v0=abc', SECRET, NOW)).toBe(false)
    expect(verifyElevenLabsSignature(body, `t=abc,v0=${'0'.repeat(64)}`, SECRET, NOW)).toBe(false)
    expect(verifyElevenLabsSignature(body, sign(body), '', NOW)).toBe(false)
  })

  it('rejects stale and future timestamps beyond 30 minutes', () => {
    expect(verifyElevenLabsSignature(body, sign(body, NOW - 1801), SECRET, NOW)).toBe(false)
    expect(verifyElevenLabsSignature(body, sign(body, NOW + 1801), SECRET, NOW)).toBe(false)
    expect(verifyElevenLabsSignature(body, sign(body, NOW - 1799), SECRET, NOW)).toBe(true)
  })
})

describe('sentimentFromCallSuccessful', () => {
  it('maps the real ElevenLabs values (success | failure | unknown)', () => {
    expect(sentimentFromCallSuccessful('success')).toBe('positive')
    expect(sentimentFromCallSuccessful('failure')).toBe('negative')
    expect(sentimentFromCallSuccessful('unknown')).toBe('neutral')
  })

  it('ignores the old true/false values and anything else', () => {
    expect(sentimentFromCallSuccessful('true')).toBeNull()
    expect(sentimentFromCallSuccessful(true)).toBeNull()
    expect(sentimentFromCallSuccessful(undefined)).toBeNull()
  })
})

const transcriptionData = {
  agent_id: 'agent_abc123',
  conversation_id: 'conv_01jabc',
  status: 'done',
  has_audio: true,
  transcript: [
    { role: 'agent', message: 'Bună ziua! Cu ce vă pot ajuta?', time_in_call_secs: 0, tool_calls: null },
    { role: 'user', message: 'Aș vrea o programare.', time_in_call_secs: 3.26 },
    { role: 'agent', message: null, time_in_call_secs: 5, tool_calls: [{ tool_name: 'x' }] },
    { role: 'user', message: '  ', time_in_call_secs: 6 },
  ],
  metadata: {
    start_time_unix_secs: 1_758_099_000,
    call_duration_secs: 42.6,
    phone_call: {
      type: 'twilio',
      direction: 'inbound',
      external_number: '+40722123456',
      agent_number: '+40312345678',
      call_sid: 'CA0123456789abcdef0123456789abcdef',
      stream_sid: 'MZ1',
    },
  },
  analysis: { call_successful: 'success', transcript_summary: 'Caller wanted an appointment.' },
  conversation_initiation_client_data: {
    dynamic_variables: {
      call_id: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
      org_id: '11111111-2222-4333-8444-555555555555',
      twilio_call_sid: 'CAffffffffffffffffffffffffffffffff',
      failover_reason: 'self_breaker_open',
      prior_transcript: '',
    },
  },
}

describe('mapTranscriptionEvent', () => {
  it('maps phone_call metadata, timing, analysis and dynamic variables', () => {
    const event = mapTranscriptionEvent(transcriptionData, 1_758_099_100)
    expect(event).toEqual({
      conversationId: 'conv_01jabc',
      agentId: 'agent_abc123',
      transcript: [
        { role: 'agent', message: 'Bună ziua! Cu ce vă pot ajuta?', time_in_call_secs: 0 },
        { role: 'user', message: 'Aș vrea o programare.', time_in_call_secs: 3.3 },
      ],
      summary: 'Caller wanted an appointment.',
      callSuccessful: 'success',
      durationSeconds: 43,
      startedAt: new Date(1_758_099_000 * 1000).toISOString(),
      endedAt: new Date((1_758_099_000 + 43) * 1000).toISOString(),
      hasAudio: true,
      phone: {
        direction: 'inbound',
        externalNumber: '+40722123456',
        agentNumber: '+40312345678',
        callSid: 'CA0123456789abcdef0123456789abcdef',
        fromNumber: '+40722123456',
        toNumber: '+40312345678',
      },
      dynamic: {
        callId: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
        orgId: '11111111-2222-4333-8444-555555555555',
        twilioCallSid: 'CAffffffffffffffffffffffffffffffff',
        failoverReason: 'self_breaker_open',
      },
    })
  })

  it('returns null without the ids needed to store anything', () => {
    expect(mapTranscriptionEvent({ ...transcriptionData, conversation_id: '' })).toBeNull()
    expect(mapTranscriptionEvent({ ...transcriptionData, agent_id: 'bad id with spaces' })).toBeNull()
  })

  it('falls back to the event time when the start time is missing', () => {
    const event = mapTranscriptionEvent({ ...transcriptionData, metadata: { call_duration_secs: 10 } }, 1_758_099_100)
    expect(event?.endedAt).toBe(new Date(1_758_099_100 * 1000).toISOString())
    expect(event?.startedAt).toBe(new Date((1_758_099_100 - 10) * 1000).toISOString())
    expect(event?.phone.externalNumber).toBeNull()
    expect(event?.phone.direction).toBe('inbound')
  })
})

describe('readPhoneCall', () => {
  it('orients from/to by direction for outbound calls', () => {
    expect(readPhoneCall({ phone_call: { direction: 'outbound', external_number: '40722123456', agent_number: '+40312345678' } })).toMatchObject({
      direction: 'outbound',
      externalNumber: '+40722123456',
      fromNumber: '+40312345678',
      toNumber: '+40722123456',
      callSid: null,
    })
  })

  it('drops values that are not phone numbers', () => {
    expect(readPhoneCall({ phone_call: { external_number: 'anonymous', call_sid: 'not-a-sid' } })).toMatchObject({
      externalNumber: null,
      callSid: null,
    })
  })
})

describe('readDynamicVariables', () => {
  it('only trusts well-formed ids and falls back to the system call sid', () => {
    expect(
      readDynamicVariables({
        conversation_initiation_client_data: { dynamic_variables: { call_id: 'x', org_id: 42, system__call_sid: 'CA0123456789abcdef0123456789abcdef' } },
      })
    ).toEqual({ callId: null, orgId: null, twilioCallSid: 'CA0123456789abcdef0123456789abcdef', failoverReason: null })
    expect(readDynamicVariables({})).toEqual({ callId: null, orgId: null, twilioCallSid: null, failoverReason: null })
  })
})

describe('mapElevenLabsTranscript', () => {
  it('returns [] for non-arrays and keeps interrupted markers', () => {
    expect(mapElevenLabsTranscript(null)).toEqual([])
    expect(mapElevenLabsTranscript([{ role: 'agent', message: 'Hi', time_in_call_secs: -1, interrupted: true }])).toEqual([
      { role: 'agent', message: 'Hi', time_in_call_secs: 0, interrupted: true },
    ])
  })
})

describe('mapInitiationFailureEvent', () => {
  it('maps a Twilio StatusCallback body for an outbound call', () => {
    const event = mapInitiationFailureEvent(
      {
        agent_id: 'agent_abc123',
        conversation_id: 'conv_fail',
        failure_reason: 'no-answer',
        metadata: {
          type: 'twilio',
          body: { From: '+40312345678', To: '+40722123456', CallSid: 'CA0123456789abcdef0123456789abcdef', Direction: 'outbound-api' },
        },
      },
      1_758_099_100
    )
    expect(event).toEqual({
      conversationId: 'conv_fail',
      agentId: 'agent_abc123',
      status: 'no-answer',
      failureReason: 'no-answer',
      direction: 'outbound',
      fromNumber: '+40312345678',
      toNumber: '+40722123456',
      externalNumber: '+40722123456',
      callSid: 'CA0123456789abcdef0123456789abcdef',
      occurredAt: new Date(1_758_099_100 * 1000).toISOString(),
    })
  })

  it('maps SIP bodies and unknown reasons to failed', () => {
    const event = mapInitiationFailureEvent({
      agent_id: 'agent_abc123',
      conversation_id: 'conv_sip',
      failure_reason: 'unknown',
      metadata: { type: 'sip', body: { from_number: 40312345678, to_number: 40722123456, call_sid: 'sip-1' } },
    })
    expect(event).toMatchObject({ status: 'failed', fromNumber: '+40312345678', toNumber: '+40722123456', callSid: null })
  })
})

describe('WebhookEnvelopeSchema', () => {
  it('requires a type and an object data payload', () => {
    expect(WebhookEnvelopeSchema.safeParse({ type: 'post_call_audio', data: { full_audio: '...' } }).success).toBe(true)
    expect(WebhookEnvelopeSchema.safeParse({ type: 'x', data: [] }).success).toBe(false)
    expect(WebhookEnvelopeSchema.safeParse({ data: {} }).success).toBe(false)
  })
})

describe('conversationMayUpdateCall', () => {
  const ORG = '11111111-2222-4333-8444-555555555555'
  const OTHER = '99999999-2222-4333-8444-555555555555'

  it('accepts a conversation served by an agent of the call organisation', () => {
    expect(conversationMayUpdateCall({ rowOrgId: ORG, agentOrgId: ORG, dynamicOrgId: ORG })).toBe(true)
    expect(conversationMayUpdateCall({ rowOrgId: ORG, agentOrgId: ORG, dynamicOrgId: null })).toBe(true)
  })

  it('never trusts client-side dynamic variables on their own', () => {
    // A conversation on another tenant's agent that names our call and org in its variables.
    expect(conversationMayUpdateCall({ rowOrgId: ORG, agentOrgId: OTHER, dynamicOrgId: ORG })).toBe(false)
    expect(conversationMayUpdateCall({ rowOrgId: ORG, agentOrgId: null, dynamicOrgId: ORG })).toBe(false)
    expect(conversationMayUpdateCall({ rowOrgId: ORG, agentOrgId: ORG, dynamicOrgId: OTHER })).toBe(false)
  })
})

describe('transcriptionAction', () => {
  it('updates a routed call, skips a missing routed call and imports legacy conversations', () => {
    const callId = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'
    expect(transcriptionAction({ routedRowFound: true, dynamicCallId: callId })).toBe('update')
    expect(transcriptionAction({ routedRowFound: true, dynamicCallId: null })).toBe('update')
    // Importing it would store the call twice and bill its minutes again.
    expect(transcriptionAction({ routedRowFound: false, dynamicCallId: callId })).toBe('skip')
    expect(transcriptionAction({ routedRowFound: false, dynamicCallId: null })).toBe('import')
  })
})
