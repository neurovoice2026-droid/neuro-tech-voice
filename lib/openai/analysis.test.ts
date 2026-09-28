import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RateLimitError } from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import type { CallAnalysis } from '@/types'

const parse = vi.fn()

vi.mock('@/lib/openai/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/openai/client')>()
  return {
    ...actual,
    getOpenAI: () => ({ responses: { parse } }),
    openAIAnalysisModel: () => 'gpt-5.6-luna',
  }
})

const {
  analyzeCall,
  buildAnalysisSchema,
  buildOutcomeEvidence,
  filterExtracted,
  formatTranscriptForAnalysis,
  mergeExtracted,
  normalizeIntent,
  resolveCallOutcome,
  toStoredAnalysis,
} = await import('./analysis')

type Evidence = Parameters<typeof resolveCallOutcome>[0]

const noEvidence: Evidence = {
  bookingCreated: false,
  rescheduled: false,
  cancelled: false,
  transferred: false,
  urgentNotification: false,
  messageTaken: false,
  callerSpoke: true,
}

function analysis(outcome: CallAnalysis['outcome'], flag_reason: string | null = null) {
  return { outcome, flag_reason }
}

describe('resolveCallOutcome (contract §7 precedence)', () => {
  it('ranks a booking above everything, including a flag', () => {
    expect(resolveCallOutcome({ ...noEvidence, bookingCreated: true, transferred: true, urgentNotification: true }, analysis('flagged', 'angry'))).toBe('booked')
  })

  it('then reschedule, then cancel', () => {
    expect(resolveCallOutcome({ ...noEvidence, rescheduled: true, cancelled: true }, null)).toBe('rescheduled')
    expect(resolveCallOutcome({ ...noEvidence, cancelled: true, transferred: true }, null)).toBe('cancelled')
  })

  it('a transfer beats flags and messages', () => {
    expect(resolveCallOutcome({ ...noEvidence, transferred: true, messageTaken: true }, analysis('flagged', 'x'))).toBe('transferred')
  })

  it('flags from an urgent notification or from the analysis beat a taken message', () => {
    expect(resolveCallOutcome({ ...noEvidence, urgentNotification: true, messageTaken: true }, null)).toBe('flagged')
    expect(resolveCallOutcome({ ...noEvidence, messageTaken: true }, analysis('answered', 'Complaint about billing'))).toBe('flagged')
    expect(resolveCallOutcome({ ...noEvidence, messageTaken: true }, analysis('flagged'))).toBe('flagged')
  })

  it('message taken before missed and the model outcome', () => {
    expect(resolveCallOutcome({ ...noEvidence, messageTaken: true, callerSpoke: false }, analysis('spam'))).toBe('message_taken')
  })

  it('no caller speech is a missed call', () => {
    expect(resolveCallOutcome({ ...noEvidence, callerSpoke: false }, analysis('answered'))).toBe('missed')
  })

  it('uses the model outcome last, and answered without analysis', () => {
    expect(resolveCallOutcome(noEvidence, analysis('spam'))).toBe('spam')
    expect(resolveCallOutcome(noEvidence, analysis('other'))).toBe('other')
    expect(resolveCallOutcome(noEvidence, null)).toBe('answered')
  })

  it('never claims a side effect the evidence does not show', () => {
    for (const claimed of ['booked', 'rescheduled', 'cancelled', 'transferred', 'message_taken'] as const) {
      expect(resolveCallOutcome(noEvidence, analysis(claimed))).toBe('answered')
    }
  })
})

describe('buildOutcomeEvidence', () => {
  const transcript = [
    { role: 'agent' as const, message: 'Hello!' },
    { role: 'user' as const, message: '  ' },
  ]

  it('treats whitespace-only caller turns as silence', () => {
    const evidence = buildOutcomeEvidence({ transcript, endReason: null, toolInvocations: [], bookings: [], messages: [] })
    expect(evidence.callerSpoke).toBe(false)
  })

  it('reads successful tools, bookings, urgent notifications and messages', () => {
    const evidence = buildOutcomeEvidence({
      transcript: [...transcript, { role: 'user', message: 'I need help', tool_calls: [{ name: 'reschedule_appointment', ok: true }] }],
      endReason: 'transferred',
      toolInvocations: [
        { tool_name: 'book_appointment', ok: false },
        { tool_name: 'notify_team', ok: true, arguments: { urgency: 'urgent', summary: 'x' } },
        { tool_name: 'take_message', ok: true },
      ],
      bookings: [],
      messages: [],
    })
    expect(evidence).toEqual({
      bookingCreated: false,
      rescheduled: true,
      cancelled: false,
      transferred: true,
      urgentNotification: true,
      messageTaken: true,
      callerSpoke: true,
    })
  })

  it('counts a live booking row linked to the call, but not a cancelled one', () => {
    const base = { transcript, endReason: null, toolInvocations: [], messages: [] }
    expect(buildOutcomeEvidence({ ...base, bookings: [{ status: 'booked' }] }).bookingCreated).toBe(true)
    expect(buildOutcomeEvidence({ ...base, bookings: [{ status: 'cancelled' }] }).bookingCreated).toBe(false)
  })

  it('a transfer nobody answered counts as a message, not a transfer', () => {
    const base = { transcript, endReason: 'transferred', toolInvocations: [], bookings: [], messages: [{ urgency: 'normal' }] }
    expect(buildOutcomeEvidence({ ...base, storedOutcome: 'message_taken' })).toMatchObject({ transferred: false, messageTaken: true })
    expect(buildOutcomeEvidence({ ...base, storedOutcome: 'transferred' }).transferred).toBe(true)
    expect(buildOutcomeEvidence({ ...base, storedOutcome: null }).transferred).toBe(true)
  })

  it('an urgent message row flags the call', () => {
    const evidence = buildOutcomeEvidence({ transcript, endReason: null, toolInvocations: [], bookings: [], messages: [{ urgency: 'urgent' }] })
    expect(evidence.urgentNotification).toBe(true)
    expect(evidence.messageTaken).toBe(true)
  })
})

describe('analysis schema', () => {
  it('restricts extracted keys to the agent lead fields', () => {
    const schema = buildAnalysisSchema(['name', 'budget', 'budget'])
    const format = zodTextFormat(schema, 'call_analysis')
    expect(format.type).toBe('json_schema')
    expect(format.strict).toBe(true)
    const json = JSON.stringify(format.schema)
    expect(json).toContain('"enum":["name","budget"]')
    // Strict mode: every property is required.
    const root = format.schema as { required: string[]; properties: Record<string, unknown>; additionalProperties: boolean }
    expect(root.additionalProperties).toBe(false)
    expect(new Set(root.required)).toEqual(new Set(Object.keys(root.properties)))
    expect(root.required).not.toContain('model')
    expect(root.required).not.toContain('analyzed_at')
  })

  it('accepts free keys (filtered later) when no lead fields exist', () => {
    const schema = buildAnalysisSchema([])
    const parsed = schema.safeParse({
      summary: 's', sentiment: 'neutral', sentiment_reason: 'r', outcome: 'answered', intent: 'x',
      caller_name: null, follow_up_required: false, follow_up_reason: null, flag_reason: null,
      keywords: [], language: 'en', extracted: [{ key: 'anything', value: 'v' }],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects an outcome outside CallOutcome', () => {
    const schema = buildAnalysisSchema(['name'])
    const parsed = schema.safeParse({
      summary: 's', sentiment: 'neutral', sentiment_reason: 'r', outcome: 'appointment_booked', intent: 'x',
      caller_name: null, follow_up_required: false, follow_up_reason: null, flag_reason: null,
      keywords: [], language: 'en', extracted: [],
    })
    expect(parsed.success).toBe(false)
  })
})

describe('toStoredAnalysis', () => {
  const output = {
    summary: '  The caller   asked about prices.  ',
    sentiment: 'positive' as const,
    sentiment_reason: 'Thanked the agent',
    outcome: 'answered' as const,
    intent: 'Pricing Question!',
    caller_name: '  ',
    follow_up_required: false,
    follow_up_reason: '',
    flag_reason: '',
    keywords: ['Price', 'price', 'hours', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
    language: 'ro',
    extracted: [
      { key: 'budget', value: ' 500 lei ' },
      { key: 'unknown', value: 'x' },
      { key: 'name', value: '   ' },
      { key: 'budget', value: '600 lei' },
    ],
  }

  it('normalises text, clips keywords and keeps only known lead keys', () => {
    const stored = toStoredAnalysis(output, { leadKeys: ['name', 'budget'], model: 'gpt-5.6-luna', language: 'en', now: new Date('2026-09-17T10:00:00Z') })
    expect(stored.summary).toBe('The caller asked about prices.')
    expect(stored.intent).toBe('pricing_question')
    expect(stored.caller_name).toBeNull()
    expect(stored.flag_reason).toBeNull()
    expect(stored.follow_up_reason).toBeNull()
    expect(stored.keywords).toHaveLength(10)
    expect(stored.keywords.slice(0, 2)).toEqual(['price', 'hours'])
    expect(stored.extracted).toEqual([{ key: 'budget', value: '600 lei' }])
    expect(stored.model).toBe('gpt-5.6-luna')
    expect(stored.analyzed_at).toBe('2026-09-17T10:00:00.000Z')
    expect(stored.language).toBe('ro')
  })

  it('normalizeIntent handles diacritics and empties', () => {
    expect(normalizeIntent('Programare Întâlnire')).toBe('programare_intalnire')
    expect(normalizeIntent('   ')).toBe('general_inquiry')
    expect(normalizeIntent(null)).toBe('general_inquiry')
  })

  it('filterExtracted drops unknown and empty keys', () => {
    expect(filterExtracted([{ key: 'a', value: '1' }, { key: 'b', value: '' }], ['a', 'b'])).toEqual([{ key: 'a', value: '1' }])
  })
})

describe('mergeExtracted', () => {
  it('prefers values the agent saved with a tool over model extraction', () => {
    expect(
      mergeExtracted({ email: 'ana@example.com', budget: '', count: 3 }, [
        { key: 'email', value: 'wrong@example.com' },
        { key: 'timing', value: 'next week' },
      ])
    ).toEqual({ email: 'ana@example.com', timing: 'next week', count: '3' })
  })
})

describe('formatTranscriptForAnalysis', () => {
  it('labels speakers, skips empty turns and marks interruptions', () => {
    const text = formatTranscriptForAnalysis([
      { role: 'agent', message: 'Hello', time_in_call_secs: 0 },
      { role: 'user', message: '', time_in_call_secs: 1 },
      { role: 'user', message: 'Hi  there', time_in_call_secs: 65, interrupted: true },
    ])
    expect(text).toBe('[00:00] ASSISTANT: Hello\n[01:05] CALLER: Hi there [interrupted]')
  })

  it('keeps the start and the end of very long calls', () => {
    const turns = Array.from({ length: 400 }, (_, i) => ({ role: 'user' as const, message: `turn ${i} ${'x'.repeat(40)}` }))
    const text = formatTranscriptForAnalysis(turns, 2_000)
    expect(text.length).toBeLessThanOrEqual(2_000)
    expect(text).toContain('turn 0 ')
    expect(text).toContain('turn 399 ')
    expect(text).toContain('middle of the call omitted')
  })
})

describe('analyzeCall', () => {
  const input = {
    transcript: [
      { role: 'agent' as const, message: 'Hello, how can I help?' },
      { role: 'user' as const, message: 'What are your prices?' },
    ],
    language: 'en',
    leadFields: [{ key: 'budget', label: 'Budget', question: 'What is your budget?', required: false }],
    toolEvidence: [],
    orgId: '00000000-0000-4000-8000-000000000001',
  }

  const parsed = {
    summary: 'Asked for prices.',
    sentiment: 'neutral',
    sentiment_reason: 'Calm',
    outcome: 'answered',
    intent: 'pricing_question',
    caller_name: null,
    follow_up_required: false,
    follow_up_reason: null,
    flag_reason: null,
    keywords: ['prices'],
    language: 'en',
    extracted: [{ key: 'budget', value: '100 EUR' }],
  }

  function response(overrides: Record<string, unknown> = {}) {
    return {
      status: 'completed',
      incomplete_details: null,
      service_tier: 'flex',
      usage: { input_tokens: 900, output_tokens: 120, input_tokens_details: { cached_tokens: 512 } },
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }],
      output_parsed: parsed,
      ...overrides,
    }
  }

  beforeEach(() => parse.mockReset())

  it('skips calls where the caller never spoke', async () => {
    const result = await analyzeCall({ ...input, transcript: [{ role: 'agent', message: 'Hello?' }] })
    expect(result).toEqual({ status: 'skipped', reason: 'no_caller_speech' })
    expect(parse).not.toHaveBeenCalled()
  })

  it('uses the flex tier, store false, low reasoning and a hashed safety identifier', async () => {
    parse.mockResolvedValueOnce(response())
    const result = await analyzeCall(input)
    expect(result.status).toBe('ok')
    const [body, options] = parse.mock.calls[0]
    expect(body.service_tier).toBe('flex')
    expect(body.store).toBe(false)
    expect(body.reasoning).toEqual({ effort: 'low' })
    expect(body.safety_identifier).toMatch(/^[0-9a-f]{32}$/)
    expect(body.safety_identifier).not.toContain(input.orgId)
    expect(options.maxRetries).toBe(0)
    if (result.status === 'ok') {
      expect(result.analysis.extracted).toEqual([{ key: 'budget', value: '100 EUR' }])
      expect(result.usage).toEqual({ model: 'gpt-5.6-luna', input_tokens: 900, cached_input_tokens: 512, output_tokens: 120, service_tier: 'flex' })
    }
  })

  it('falls back to the default tier when flex capacity is unavailable', async () => {
    parse
      .mockRejectedValueOnce(new RateLimitError(429, { message: 'Resource Unavailable' }, 'Resource Unavailable', new Headers()))
      .mockResolvedValueOnce(response({ service_tier: 'default' }))
    const result = await analyzeCall(input)
    expect(result.status).toBe('ok')
    expect(parse).toHaveBeenCalledTimes(2)
    expect(parse.mock.calls[1][0].service_tier).toBeUndefined()
  })

  it('does not retry spend-limit errors', async () => {
    parse.mockRejectedValueOnce(
      new RateLimitError(429, { code: 'insufficient_quota', message: 'quota' }, 'quota', new Headers())
    )
    await expect(analyzeCall(input)).rejects.toBeInstanceOf(RateLimitError)
    expect(parse).toHaveBeenCalledTimes(1)
  })

  it('reports refusals and incomplete responses as values', async () => {
    parse.mockResolvedValueOnce(response({ output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }], output_parsed: null }))
    expect((await analyzeCall(input)).status).toBe('refused')

    parse.mockResolvedValueOnce(response({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_parsed: null }))
    expect(await analyzeCall(input)).toMatchObject({ status: 'incomplete', reason: 'max_output_tokens' })
  })
})
