import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trustedLocalCallId } from './call-store'
import { isFromOtherProvider, mergeCallEvent, type StoredCall } from './call-merge'
import { signCallToken } from '@/lib/telephony/tokens'
import type { NormalizedCallEvent } from './types'

const CALL_ID = '6f1c2a4e-1b2c-4d3e-8f90-123456789abc'
const OTHER_CALL_ID = '0a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d'

function event(over: Partial<NormalizedCallEvent> = {}): NormalizedCallEvent {
  return {
    provider: 'elevenlabs',
    kind: 'call.completed',
    providerCallId: 'conv_1',
    externalAgentId: 'agent_1',
    localCallId: CALL_ID,
    twilioCallSid: null,
    direction: 'inbound',
    fromNumber: '+40712345123',
    toNumber: '+40312345678',
    startedAt: '2026-10-05T11:50:00.000Z',
    durationSeconds: 4,
    status: 'completed',
    transcript: [{ role: 'agent', message: 'Hi', time_in_call_secs: 0 }],
    summary: 'stub',
    summaryTitle: null,
    callSuccessful: 'unknown',
    analysis: null,
    terminationReason: null,
    costCredits: null,
    costUsd: null,
    hasRecording: true,
    failureReason: null,
    eventTimestamp: null,
    ...over,
  }
}

beforeEach(() => {
  vi.stubEnv('VOICE_TOKEN_SECRET', 'test-secret-0123456789-abcdefghijklmnop')
})

describe('trustedLocalCallId (webhook correlation)', () => {
  it('ignores a bare ntv_call_id: a client-started session can send any dynamic variables', () => {
    expect(trustedLocalCallId(event({ localCallToken: null }))).toBeNull()
    expect(trustedLocalCallId(event({ localCallToken: 'none' }))).toBeNull()
  })

  it('accepts the id when the signed call token we injected verifies to the same call', () => {
    const token = signCallToken(CALL_ID, 'transfer', 3600)
    expect(trustedLocalCallId(event({ localCallToken: token }))).toBe(CALL_ID)
  })

  it('rejects a valid token issued for another call', () => {
    const token = signCallToken(OTHER_CALL_ID, 'transfer', 3600)
    expect(trustedLocalCallId(event({ localCallToken: token }))).toBeNull()
  })

  it('still correlates after the token expired (webhook retries can be hours later)', () => {
    const token = signCallToken(CALL_ID, 'transfer', 60, Date.now() - 24 * 3600_000)
    expect(trustedLocalCallId(event({ localCallToken: token }))).toBe(CALL_ID)
  })

  it('trusts ids set by our own code (poll, SIP header from our trunk) and rejects malformed ids', () => {
    expect(trustedLocalCallId(event({ provider: 'cartesia', localCallIdTrusted: true }))).toBe(CALL_ID)
    expect(trustedLocalCallId(event({ localCallId: 'not-a-uuid', localCallIdTrusted: true }))).toBeNull()
  })
})

describe('merge across providers (early failover)', () => {
  const servedByCartesia: StoredCall = {
    status: 'in-progress',
    lifecycle_rank: 20,
    provider: 'cartesia',
    provider_call_id: null,
    elevenlabs_conversation_id: null,
    cartesia_call_id: null,
    transcript: null,
    summary: null,
    duration_seconds: null,
    started_at: null,
    ended_at: null,
    routing_reason: 'provider_fallback',
    outcome: null,
  }

  it('records only the abandoned ElevenLabs conversation id on a Cartesia-served call', () => {
    expect(isFromOtherProvider(servedByCartesia, event())).toBe(true)
    expect(mergeCallEvent(servedByCartesia, event())).toEqual({ elevenlabs_conversation_id: 'conv_1' })
    expect(mergeCallEvent(servedByCartesia, event({ kind: 'call.initiation_failed', status: 'failed' }))).toEqual({ elevenlabs_conversation_id: 'conv_1' })
  })

  it('merges normally when the event comes from the serving provider', () => {
    const patch = mergeCallEvent(servedByCartesia, event({ provider: 'cartesia', providerCallId: 'call_c1', durationSeconds: 600 }))
    expect(patch).toMatchObject({ lifecycle_rank: 50, duration_seconds: 600, cartesia_call_id: 'call_c1' })
  })
})

describe('legacySentimentFromVerdict', () => {
  it('maps the AI verdict to the sentiment workflows used to receive', async () => {
    const { legacySentimentFromVerdict } = await import('@/lib/calls/legacy-sentiment')
    expect(legacySentimentFromVerdict('success')).toBe('positive')
    expect(legacySentimentFromVerdict('failure')).toBe('negative')
    expect(legacySentimentFromVerdict('unknown')).toBe('neutral')
    expect(legacySentimentFromVerdict(null)).toBeNull()
  })
})
