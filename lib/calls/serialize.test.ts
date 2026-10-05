import { describe, expect, it } from 'vitest'
import { csvCell, searchExpression, timeRangeExpression, combineOrGroups, zonedDayStart, rangeStart, rangeEnd, parseCallId, CallListQuerySchema, serializeListItem, providerTargets, wallTime, shiftMonths } from '@/lib/calls/serialize'
import { describeFailoverReason, handledBy, failoverReasonLabel, terminationReasonLabel, humanizeKey } from '@/lib/calls/labels'

describe('csv', () => {
  it('neutralises formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('+40712345678')).toBe("'+40712345678")
    expect(csvCell('-1')).toBe("'-1")
    expect(csvCell('@x')).toBe("'@x")
    expect(csvCell('\tx')).toBe("'\tx")
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=a,"b"')).toBe('"\'=a,""b"""')
    expect(csvCell(null)).toBe('')
    expect(csvCell(42)).toBe('42')
    expect(csvCell('Bună ziua\nce faceți')).toBe('"Bună ziua\nce faceți"')
  })
})
describe('search', () => {
  it('phone', () => {
    expect(searchExpression('+40 712')).toBe('caller_number.ilike."*40712*",from_number.ilike."*40712*",to_number.ilike."*40712*"')
    expect(searchExpression('12')).toBeNull()
  })
  it('text sanitized', () => {
    expect(searchExpression('programare ștefan')).toBe('summary_title.ilike."*programare ștefan*",summary.ilike."*programare ștefan*"')
    expect(searchExpression('a),id.eq.x,(b')).toBe('summary_title.ilike."*a id eq x b*",summary.ilike."*a id eq x b*"')
    expect(searchExpression('"\\')).toBeNull()
  })
})
describe('time', () => {
  it('bucharest midnight', () => {
    expect(zonedDayStart({ year: 2026, month: 10, day: 5 }, 'Europe/Bucharest').toISOString()).toBe('2026-10-04T21:00:00.000Z')
    expect(zonedDayStart({ year: 2026, month: 1, day: 5 }, 'Europe/Bucharest').toISOString()).toBe('2026-01-04T22:00:00.000Z')
    expect(zonedDayStart({ year: 2026, month: 3, day: 29 }, 'Europe/Bucharest').toISOString()).toBe('2026-03-28T22:00:00.000Z')
    expect(zonedDayStart({ year: 2026, month: 3, day: 8 }, 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(zonedDayStart({ year: 2026, month: 3, day: 9 }, 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z')
    expect(rangeStart('2026-10-05', 'UTC').toISOString()).toBe('2026-10-05T00:00:00.000Z')
    expect(rangeEnd('2026-10-05', 'UTC').toISOString()).toBe('2026-10-06T00:00:00.000Z')
    expect(shiftMonths({ year: 2026, month: 1, day: 15 }, -1)).toEqual({ year: 2025, month: 12, day: 1 })
    expect(wallTime(new Date('2026-10-05T21:30:00Z'), 'Europe/Bucharest')).toMatchObject({ day: 6, hour: 0, minute: 30, weekday: 2 })
  })
  it('range expr', () => {
    const e = timeRangeExpression(new Date('2026-10-01T00:00:00Z'), new Date('2026-10-02T00:00:00Z'))
    expect(e).toBe('and(started_at.gte."2026-10-01T00:00:00.000Z",started_at.lt."2026-10-02T00:00:00.000Z"),and(started_at.is.null,created_at.gte."2026-10-01T00:00:00.000Z",created_at.lt."2026-10-02T00:00:00.000Z")')
    expect(combineOrGroups(['a.eq.1,b.eq.2', null, 'c.eq.3'])).toBe('and(or(a.eq.1,b.eq.2),or(c.eq.3))')
  })
})
describe('ids + query', () => {
  it('parse', () => {
    expect(parseCallId('3F2504E0-4F89-11D3-9A0C-0305E82C3301')).toEqual({ value: '3f2504e0-4f89-11d3-9a0c-0305e82c3301', isUuid: true })
    expect(parseCallId('conv_abc123')).toEqual({ value: 'conv_abc123', isUuid: false })
    expect(() => parseCallId('x),id.eq.1')).toThrow()
    expect(() => parseCallId('abc')).toThrow()
  })
  it('query', () => {
    const r = CallListQuerySchema.safeParse({ page: '2', limit: '50', search: '', status: 'after-hours', dateFrom: '', dateTo: '2026-10-05', minDuration: '0', sortBy: 'created_at', sortOrder: 'asc', provider: 'cartesia' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toMatchObject({ page: 2, limit: 50, status: 'after-hours', direction: 'all', provider: 'cartesia', dateTo: '2026-10-05', minDuration: 0, sortOrder: 'asc', routing: 'all' })
    expect(CallListQuerySchema.safeParse({ limit: '500' }).success).toBe(false)
    expect(CallListQuerySchema.safeParse({ sortBy: 'org_id' }).success).toBe(false)
    expect(CallListQuerySchema.safeParse({}).data).toMatchObject({ page: 1, limit: 25, status: 'all' })
    expect(CallListQuerySchema.safeParse({ dateFrom: '2026-10-05T10:00:00+03:00' }).success).toBe(true)
  })
})
describe('labels', () => {
  it('failover', () => {
    expect(describeFailoverReason('elevenlabs:circuit_open')).toEqual(['Primary provider degraded'])
    expect(describeFailoverReason('elevenlabs:connect_timeout')).toEqual(['Primary provider timed out'])
    expect(describeFailoverReason('elevenlabs:stream_failed_early')).toEqual(['Primary call failed to start'])
    expect(failoverReasonLabel('elevenlabs:connect_timeout,cartesia:dial_busy')).toBe('Primary provider timed out · Backup agent line busy')
    expect(describeFailoverReason('weird')).toEqual(['Voice provider issue'])
    expect(describeFailoverReason('cartesia:fallback_disabled')).toEqual(['Backup voice agent turned off'])
  })
  it('handled by', () => {
    expect(handledBy({ status: 'completed', provider: 'elevenlabs', routing_reason: 'primary' }).label).toBe('AI · ElevenLabs')
    expect(handledBy({ status: 'completed', provider: 'cartesia', routing_reason: 'provider_fallback' })).toMatchObject({ kind: 'fallback', label: 'Fallback · Cartesia' })
    expect(handledBy({ status: 'after-hours', provider: null, routing_reason: 'after_hours' }).label).toBe('After hours')
    expect(handledBy({ status: 'transferred', provider: 'elevenlabs', routing_reason: 'transferred' }).label).toBe('Transferred')
    expect(handledBy({ status: 'failed', provider: null, routing_reason: 'no_provider' }).kind).toBe('failed')
    expect(handledBy({ status: 'completed', elevenlabs_conversation_id: 'conv_1' }).label).toBe('AI · ElevenLabs')
  })
  it('misc', () => {
    expect(terminationReasonLabel('client_hangup')).toBe('The caller hung up')
    expect(terminationReasonLabel('Call ended by remote party.')).toBe('Call ended by remote party')
    expect(humanizeKey('customer_name')).toBe('Customer name')
  })
})
describe('serialize', () => {
  it('maps a fallback row', () => {
    const item = serializeListItem({ id: 'a', org_id: 'o', agent_id: null, phone_number_id: null, twilio_call_sid: null, elevenlabs_conversation_id: 'conv_1', caller_number: null, direction: 'inbound', duration_seconds: 61.4, status: 'completed', sentiment: 'positive', summary: null, started_at: null, ended_at: null, created_at: '2026-10-05T10:00:00Z', provider: 'cartesia', primary_provider: 'elevenlabs', routing_reason: 'provider_fallback', failover_reason: 'elevenlabs:stream_failed_early', provider_call_id: 'conv_1', cartesia_call_id: 'ca_1', from_number: '+40712345678', to_number: '+40312345678', outcome: 'booked', call_successful: 'success', summary_title: 'x', termination_reason: null, has_recording: true, recording_status: 'available', agents: [{ name: 'Ana' }] })
    expect(item).toMatchObject({ caller_number: '+40712345678', duration_seconds: 61, provider: 'cartesia', provider_call_id: 'ca_1', recording_url: '/api/calls/a/audio', agent_name: 'Ana', started_at: '2026-10-05T10:00:00Z' })
    expect(providerTargets({ provider: 'cartesia', provider_call_id: 'conv_1', elevenlabs_conversation_id: 'conv_1', cartesia_call_id: 'ca_1' })).toEqual([{ provider: 'elevenlabs', externalId: 'conv_1' }, { provider: 'cartesia', externalId: 'ca_1' }])
  })
})
describe('blank params', () => {
  it('defaults', () => {
    const r = CallListQuerySchema.parse({ status: '', direction: '', sentiment: '', provider: '', minDuration: '', page: '', limit: '', sortBy: '', sortOrder: '', search: '', dateFrom: '', dateTo: '' })
    expect(r).toMatchObject({ status: 'all', direction: 'all', sentiment: 'all', provider: 'all', routing: 'all', minDuration: 0, page: 1, limit: 25, sortBy: 'created_at', sortOrder: 'desc' })
    expect(r.search).toBeUndefined()
    expect(r.dateFrom).toBeUndefined()
    expect(CallListQuerySchema.safeParse({ status: 'bogus' }).success).toBe(false)
    expect(CallListQuerySchema.safeParse({ page: 'abc' }).success).toBe(false)
  })
})
