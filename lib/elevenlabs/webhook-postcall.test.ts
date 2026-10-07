import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  classifyChannel,
  evidenceOutcomeOf,
  normalizeElevenLabsEvent,
  readEnvelope,
  toolEventsOf,
  verifyElevenLabsSignatureRotating,
  webhookSecrets,
} from './webhook'

// Slice D: conversation classification, redacted tool timeline, telephony
// metadata, provider cost kept apart, secret rotation.

const NOW_MS = Date.parse('2026-10-07T12:00:00.000Z')
const NOW_S = Math.floor(NOW_MS / 1000)

function payload(data: Record<string, unknown>, metadata: Record<string, unknown> = {}) {
  return {
    type: 'post_call_transcription',
    event_timestamp: NOW_S,
    data: {
      agent_id: 'agent_el_1',
      conversation_id: 'conv_1',
      status: 'done',
      has_audio: true,
      transcript: [{ role: 'agent', message: 'Hello', time_in_call_secs: 0 }],
      metadata: { start_time_unix_secs: NOW_S - 120, call_duration_secs: 60, ...metadata },
      analysis: { call_successful: 'success', transcript_summary: 's', call_success_score: 0.8 },
      ...data,
    },
  }
}

const TWILIO = { type: 'twilio', direction: 'inbound', phone_number_id: 'pn_1', agent_number: '+40312345678', external_number: '+40712345123', call_sid: 'CA1', stream_sid: 'MZ1' }

describe('conversation channel classification', () => {
  it.each([
    [{ phone_call: TWILIO }, 'phone'],
    [{ conversation_initiation_source: 'twilio' }, 'phone'],
    [{ conversation_initiation_source: 'sip_trunk' }, 'phone'],
    [{ conversation_initiation_source: 'react_sdk' }, 'web'],
    [{ conversation_initiation_source: 'widget' }, 'web'],
    [{ conversation_initiation_source: 'template_preview' }, 'web'],
    [{ conversation_initiation_source: 'whatsapp' }, 'other'],
    [{ conversation_initiation_source: 'unknown' }, 'other'],
    [{}, 'other'],
  ] as const)('%j → %s', (meta, channel) => {
    expect(classifyChannel(meta as Record<string, unknown>)).toBe(channel)
  })

  it('puts the channel and the initiation source on the event and its metadata', () => {
    const web = normalizeElevenLabsEvent(readEnvelope(payload({}, { conversation_initiation_source: 'react_sdk', authorization_method: 'signed_url' })))
    expect(web?.channel).toBe('web')
    expect(web?.metadata).toMatchObject({ channel: 'web', initiation_source: 'react_sdk' })
    const phone = normalizeElevenLabsEvent(readEnvelope(payload({}, { phone_call: TWILIO, conversation_initiation_source: 'twilio' })))
    expect(phone?.channel).toBe('phone')
    expect(phone?.metadata?.phone_number_external_id).toBe('pn_1')
  })

  it('leaves call_initiation_failure unclassified (its Twilio data is in metadata.body)', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope({ type: 'call_initiation_failure', data: { conversation_id: 'c', agent_id: 'a', failure_reason: 'busy', metadata: { body: { CallSid: 'CA9' } } } }))
    expect(ev?.kind).toBe('call.initiation_failed')
    expect(ev?.channel).toBeUndefined()
  })
})

describe('redacted tool timeline', () => {
  const transcript = [
    { role: 'user', message: 'Put me through to a person', time_in_call_secs: 10 },
    {
      role: 'agent',
      message: null,
      time_in_call_secs: 12,
      tool_calls: [{ tool_name: 'transfer_to_number', request_id: 'r1', params_as_json: '{"transfer_number":"+40700000000","token":"secret"}', tool_details: { headers: { Authorization: 'Bearer x' } } }],
      tool_results: [{ tool_name: 'transfer_to_number', request_id: 'r1', is_error: false, type: 'system', result_value: '{"transfer_number":"+40700000000"}', result: { result_type: 'transfer_to_number_twilio_success', status: 'success', transfer_number: '+40700000000' } }],
    },
    { role: 'agent', message: null, time_in_call_secs: 20, tool_calls: [{ tool_name: 'book_slot', request_id: 'r2', params_as_json: '{"name":"Ana"}' }] },
    { role: 'agent', message: null, time_in_call_secs: 21, tool_results: [{ tool_name: 'book_slot', request_id: 'r2', is_error: true, type: 'webhook', result_value: 'Ana Popescu 0712' }] },
    { role: 'agent', message: null, time_in_call_secs: 30, tool_calls: [{ tool_name: 'end_call', request_id: 'r3' }] },
    { role: 'agent', message: 'Bye', time_in_call_secs: 31, tool_results: [{ tool_name: 'end_call', request_id: 'r3', is_error: false, type: 'system', result: { result_type: 'end_call_success' } }] },
  ]

  it('keeps tool name, ok, result type and time — never parameters, results, numbers or headers', () => {
    const events = toolEventsOf(transcript)
    expect(events).toEqual([
      { tool: 'transfer_to_number', kind: 'transfer', ok: true, result_type: 'transfer_to_number_twilio_success', at_secs: 12 },
      { tool: 'book_slot', kind: 'other', ok: false, result_type: null, at_secs: 21 },
      { tool: 'end_call', kind: 'end_call', ok: true, result_type: 'end_call_success', at_secs: 31 },
    ])
    expect(JSON.stringify(events)).not.toMatch(/\+407|secret|Bearer|Ana|0712/)
  })

  it('a successful native transfer proves the outcome; a failed one does not', () => {
    expect(evidenceOutcomeOf(toolEventsOf(transcript))).toBe('transferred')
    const failed = [{ role: 'agent', time_in_call_secs: 5, tool_results: [{ tool_name: 'transfer_to_number', is_error: true, result: { result_type: 'transfer_to_number_error', status: 'error' } }] }]
    expect(evidenceOutcomeOf(toolEventsOf(failed))).toBeNull()
  })

  it('voicemail detection sets the voicemail outcome; tool-only turns stay out of the spoken transcript', () => {
    const vm = [{ role: 'agent', message: null, time_in_call_secs: 4, tool_results: [{ tool_name: 'voicemail_detection', is_error: false, result: { result_type: 'voicemail_detection_success' } }] }]
    const ev = normalizeElevenLabsEvent(readEnvelope(payload({ transcript: [...vm, { role: 'agent', message: 'Hi', time_in_call_secs: 5 }] })))
    expect(ev?.evidenceOutcome).toBe('voicemail')
    expect(ev?.transcript).toEqual([{ role: 'agent', message: 'Hi', time_in_call_secs: 5 }])
    expect(ev?.metadata?.tool_events?.[0]).toMatchObject({ kind: 'voicemail', ok: true })
  })

  it('ignores malformed tool names and caps the timeline', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ role: 'agent', time_in_call_secs: i, tool_results: [{ tool_name: i === 0 ? 'bad name with spaces' : 'lookup', is_error: false }] }))
    const events = toolEventsOf(many)
    expect(events.length).toBe(50)
    expect(events.every((e) => e.tool === 'lookup')).toBe(true)
  })
})

describe('telephony metadata, errors, cost', () => {
  it('keeps support metadata (language, queue, features, score) and truncates error text', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(payload({ version_id: 'agtvrsn_1', branch_id: 'agtbrch_1' }, {
      phone_call: TWILIO,
      main_language: 'ro',
      queue_wait_secs: 3.25,
      text_only: false,
      features_usage: { transfer_to_number: { enabled: true, used: true }, voicemail_detection: { enabled: true, used: false } },
      error: { code: 1011, reason: 'x'.repeat(500) },
      warnings: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    })))
    expect(ev?.metadata).toMatchObject({
      main_language: 'ro',
      queue_wait_secs: 3.3,
      text_only: false,
      version_id: 'agtvrsn_1',
      branch_id: 'agtbrch_1',
      features_used: ['transfer_to_number'],
      call_success_score: 0.8,
      provider_error: { code: 1011 },
    })
    expect(ev?.metadata?.provider_error?.reason?.length).toBe(200)
    expect(ev?.metadata?.warnings).toHaveLength(5)
  })

  it('carries charging separately and never inside metadata (metadata is tenant-readable)', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(payload({}, { cost: 900, cost_fiat: 0.5, charging: { is_burst: true, tier: 'business', dev_discount: false, llm_price: 0.02, platform_price: 0.1 } })))
    expect(ev?.charging).toEqual({ isBurst: true, tier: 'business', devDiscount: false, llmPrice: 0.02, platformPrice: 0.1 })
    expect(ev).toMatchObject({ costCredits: 900, costUsd: 0.5 })
    expect(JSON.stringify(ev?.metadata)).not.toMatch(/burst|charging|0\.5|900/)
  })

  it('rejects a malformed language code', () => {
    const ev = normalizeElevenLabsEvent(readEnvelope(payload({}, { main_language: '<script>' })))
    expect(ev?.metadata?.main_language).toBeUndefined()
  })
})

describe('signature verification with a rotating secret', () => {
  const body = JSON.stringify({ type: 'post_call_transcription' })
  const sign = (secret: string, t = NOW_S) => `t=${t},v0=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`

  it('accepts the current secret, then the previous one, and says which', () => {
    expect(verifyElevenLabsSignatureRotating(body, sign('new-secret'), ['new-secret', 'old-secret'], NOW_MS)).toEqual({ ok: true, timestamp: NOW_S, secretIndex: 0 })
    expect(verifyElevenLabsSignatureRotating(body, sign('old-secret'), ['new-secret', 'old-secret'], NOW_MS)).toEqual({ ok: true, timestamp: NOW_S, secretIndex: 1 })
    expect(verifyElevenLabsSignatureRotating(body, sign('other'), ['new-secret', 'old-secret'], NOW_MS)).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('reports the age of a stale signature (retries that keep the original timestamp)', () => {
    const res = verifyElevenLabsSignatureRotating(body, sign('new-secret', NOW_S - 2400), ['new-secret'], NOW_MS)
    expect(res).toEqual({ ok: false, reason: 'stale', ageSeconds: 2400 })
  })

  it('fails closed without any secret and reads the env in order', () => {
    expect(verifyElevenLabsSignatureRotating(body, sign('x'), [], NOW_MS)).toEqual({ ok: false, reason: 'mismatch' })
    expect(webhookSecrets({ ELEVENLABS_WEBHOOK_SECRET: ' cur ', ELEVENLABS_WEBHOOK_SECRET_PREVIOUS: 'prev' })).toEqual(['cur', 'prev'])
    expect(webhookSecrets({ ELEVENLABS_WEBHOOK_SECRET: 'cur' })).toEqual(['cur'])
  })
})
