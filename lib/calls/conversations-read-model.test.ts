import { describe, expect, it } from 'vitest'
import { buildTsQuery } from './search'
import {
  CallFilterSchema,
  applyCallFilters,
  elevenLabsConversationId,
  searchExpression,
  serializeCallDetail,
  serializeListItem,
  type CallRow,
} from './serialize'
import { languageLabel, toolEventLabel } from './labels'
import { collectedValues } from '@/lib/voice-providers/call-context'
import { reanalysisPatch } from '@/lib/voice-providers/call-reanalysis'
import type { NormalizedCallEvent } from '@/lib/voice-providers/types'

// Calls read model (slice D): transcript search, outcome / AI-outcome
// filters, provider details for the call view, re-analysis patch.

const ID = '11111111-1111-4111-8111-111111111111'

function row(over: Partial<CallRow> = {}): CallRow {
  return {
    id: ID, org_id: 'o', agent_id: null, phone_number_id: null, twilio_call_sid: null, elevenlabs_conversation_id: 'conv_1',
    caller_number: '+40712345678', direction: 'inbound', duration_seconds: 60, status: 'completed', sentiment: null, summary: 's',
    started_at: '2026-10-05T08:00:00Z', ended_at: null, created_at: '2026-10-05T08:00:00Z', provider: 'elevenlabs', primary_provider: 'elevenlabs',
    routing_reason: 'primary', failover_reason: null, provider_call_id: 'conv_1', cartesia_call_id: null, from_number: null, to_number: null,
    outcome: 'booked', call_successful: 'failure', summary_title: 't', termination_reason: null, has_recording: true, recording_status: 'available',
    ...over,
  }
}

describe('transcript search', () => {
  it('builds a prefix tsquery from letters and digits only (any script), or nothing', () => {
    expect(buildTsQuery('Programare  mâine!')).toBe('programare:* & mâine:*')
    expect(buildTsQuery("x'); DROP TABLE calls; --")).toBe('drop:* & table:* & calls:*')
    expect(buildTsQuery('a & b | !c')).toBeNull()
    expect(buildTsQuery('0712 345')).toBeNull() // phone-like: searched on the number columns
    expect(buildTsQuery('')).toBeNull()
    expect(buildTsQuery('one two three four five six seven eight nine ten')?.split(' & ')).toHaveLength(8)
  })

  it('ORs the transcript matches (server-made UUIDs only) with the summary match', () => {
    expect(searchExpression('programare', [ID, 'not-a-uuid'])).toBe(`summary_title.ilike."*programare*",summary.ilike."*programare*",id.in.(${ID})`)
    expect(searchExpression('programare', [])).toBe('summary_title.ilike."*programare*",summary.ilike."*programare*"')
  })
})

describe('outcome and AI-outcome filters', () => {
  it('validates and applies them', () => {
    const f = CallFilterSchema.parse({ outcome: 'voicemail', aiOutcome: 'failure' })
    const ops: unknown[][] = []
    const q = { eq: (c: string, v: string) => (ops.push(['eq', c, v]), q), gte: (c: string, v: number) => (ops.push(['gte', c, v]), q), or: (v: string) => (ops.push(['or', v]), q) }
    applyCallFilters(q, f, 'UTC')
    expect(ops).toEqual([['eq', 'outcome', 'voicemail'], ['eq', 'call_successful', 'failure']])
    expect(CallFilterSchema.safeParse({ outcome: 'happy' }).success).toBe(false)
    expect(CallFilterSchema.safeParse({ aiOutcome: 'positive' }).success).toBe(false)
  })
})

describe('call view serialization', () => {
  it('lists test calls, the owner feedback and channel; never cost', () => {
    const item = serializeListItem({ ...row(), is_test: true, channel: 'web', owner_feedback: 'like', cost_usd: 0.5 } as CallRow)
    expect(item).toMatchObject({ is_test: true, channel: 'web', owner_feedback: 'like' })
    expect(JSON.stringify(item)).not.toContain('cost')
  })

  it('exposes language, tool events and provider error for the detail view; retention disables re-analysis', () => {
    const detail = serializeCallDetail(row({
      call_metadata: { main_language: 'ro', queue_wait_secs: 2, tool_events: [{ tool: 'end_call', kind: 'end_call', ok: true, result_type: 'end_call_success', at_secs: 40 }], provider_error: { code: 1011, reason: 'x' }, version_id: 'v1' },
    }))
    expect(detail.details).toEqual({
      main_language: 'ro', queue_wait_secs: 2, tool_events: [{ tool: 'end_call', kind: 'end_call', ok: true, result_type: 'end_call_success', at_secs: 40 }],
      provider_error: { code: 1011, reason: 'x' }, warnings: [], content_purged: false, can_reanalyze: true,
    })
    expect(serializeCallDetail(row({ retention_applied_at: '2026-10-06T00:00:00Z' })).details).toMatchObject({ content_purged: true, can_reanalyze: false })
    expect(serializeCallDetail(row({ provider: 'cartesia', elevenlabs_conversation_id: null })).details?.can_reanalyze).toBe(false)
    expect(elevenLabsConversationId(row({ elevenlabs_conversation_id: null, provider_call_id: 'conv_2' }))).toBe('conv_2')
  })

  it('labels tool events and languages for people', () => {
    expect(toolEventLabel({ tool: 'transfer_to_number', kind: 'transfer', ok: true, result_type: null })).toBe('Transferred to a person')
    expect(toolEventLabel({ tool: 'check_calendar', kind: 'other', ok: false, result_type: null })).toBe('“Check calendar” failed')
    expect(languageLabel('ro')).toBe('Romanian')
    expect(languageLabel('')).toBeNull()
  })
})

describe('workflow values and re-analysis', () => {
  it('turns analysis.data into strings for templates', () => {
    expect(collectedValues({ data: { caller_name: 'Ana', party: 2, insured: true, empty: '', missing: null, 'bad key': 'x' } })).toEqual({ caller_name: 'Ana', party: '2', insured: 'yes' })
    expect(collectedValues(null)).toEqual({})
  })

  it('replaces analysis, summary, verdict and the AI outcome, but keeps platform-proven outcomes', () => {
    const event = { analysis: { evaluation: {}, data: { outcome: 'message_taken' } }, summary: 'new', summaryTitle: 'T', callSuccessful: 'success', evidenceOutcome: null, kind: 'call.completed', metadata: { call_success_score: 0.9 } } as unknown as NormalizedCallEvent
    expect(reanalysisPatch({ id: ID, org_id: 'o', outcome: 'booked', call_metadata: { main_language: 'ro' } }, event)).toEqual({
      analysis: { evaluation: {}, data: { outcome: 'message_taken' } }, summary: 'new', summary_title: 'T', call_successful: 'success', outcome: 'message_taken',
      call_metadata: { main_language: 'ro', call_success_score: 0.9 },
    })
    expect(reanalysisPatch({ id: ID, org_id: 'o', outcome: 'transferred' }, event)).not.toHaveProperty('outcome')
  })
})
