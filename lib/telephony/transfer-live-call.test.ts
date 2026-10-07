// transferLiveCall: the live call is claimed in the DB (one conditional
// UPDATE) before Twilio is asked to redirect it, so concurrent tool calls
// (parallel tool calls, an LLM retry after a timeout) redirect it once.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, filterOf, type FakeCall } from '@/tests/helpers/fake-db'

const CALL_ID = '3f2b6c1e-8a4d-4f7b-9c2e-1d5a6b7c8d9e'
const ORG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

const call: Record<string, unknown> = {}
function resetCall(over: Record<string, unknown> = {}) {
  for (const k of Object.keys(call)) delete call[k]
  Object.assign(call, {
    id: CALL_ID,
    org_id: ORG,
    phone_number_id: 'num_1',
    direction: 'inbound',
    status: 'in-progress',
    from_number: '+40712345678',
    to_number: '+40312345678',
    routing: { attempts: [] },
    outcome: null,
    twilio_call_sid: 'CA_live_1',
    ...over,
  })
}

/** Applies the claim's conditional update atomically (the fake runs each statement synchronously). */
const db = fakeDb((c: FakeCall) => {
  if (c.table !== 'calls') return { data: null, error: null }
  if (c.op === 'select') return { data: { ...call }, error: null }
  if (c.op === 'update') {
    const patch = c.payload as Record<string, unknown>
    const or = filterOf(c, '') as string | undefined
    if (or === 'outcome.is.null,outcome.neq.transferred') {
      if (call.outcome === 'transferred') return { data: [], error: null }
      Object.assign(call, patch)
      return { data: [{ id: CALL_ID }], error: null }
    }
    const outcomeFilter = c.filters.find(([op, col]) => op === 'eq' && col === 'outcome')
    if (outcomeFilter && call.outcome !== outcomeFilter[2]) return { data: null, error: null }
    Object.assign(call, patch)
    return { data: null, error: null }
  }
  return { data: null, error: null }
})
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))

const routingContext = {
  agent: { id: 'agent_1', language: 'ro', transferEnabled: true, transferNumber: '+40799000111' },
}
vi.mock('./context', () => ({
  findNumber: async () => null,
  numberById: async () => ({ id: 'num_1', org_id: ORG, number: '+40312345678' }),
  loadRoutingContext: async () => routingContext,
}))
const twilioUpdate = vi.fn()
vi.mock('@/lib/twilio/client', () => ({ getTwilioClient: () => ({ calls: () => ({ update: (...a: unknown[]) => twilioUpdate(...a) }) }) }))
vi.mock('@/lib/elevenlabs/client', () => ({ twilio: {} }))
vi.mock('@/lib/observability/telemetry', () => ({ emitProviderEvent: () => {}, deferBackground: () => {} }))
vi.mock('@/lib/voice-providers/circuit-registry', () => ({ peek: async () => ({ state: 'closed' }), reportOutcome: async () => {}, tripCircuit: async () => {} }))

import { TRANSFER_MESSAGES, transferLiveCall } from './router'

beforeEach(() => {
  vi.stubEnv('VOICE_PUBLIC_BASE_URL', 'https://voice.example.com')
  vi.stubEnv('VOICE_TOKEN_SECRET', 'voice-token-secret-0123456789abcdef-xyz')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  resetCall()
  db.calls.length = 0
  twilioUpdate.mockReset().mockImplementation(async () => {
    // Twilio answers after a while: concurrent invocations overlap here.
    await new Promise((r) => setTimeout(r, 5))
    return {}
  })
  routingContext.agent = { id: 'agent_1', language: 'ro', transferEnabled: true, transferNumber: '+40799000111' }
})

describe('transferLiveCall', () => {
  it('claims the call, redirects it to the configured destination and records the transfer', async () => {
    const res = await transferLiveCall(CALL_ID, 'Caller asked for a person')
    expect(res).toEqual({ ok: true, message: TRANSFER_MESSAGES.started })
    expect(twilioUpdate).toHaveBeenCalledTimes(1)
    const twiml = (twilioUpdate.mock.calls[0][0] as { twiml: string }).twiml
    expect(twiml).toContain('+40799000111')
    expect(call.outcome).toBe('transferred')
    expect((call.routing as { transfer: { via: string; reason: string } }).transfer).toMatchObject({ via: 'tool', reason: 'Caller asked for a person' })
    // The claim happens BEFORE Twilio is called.
    const claimIdx = db.calls.findIndex((c) => c.op === 'update' && filterOf(c, '') === 'outcome.is.null,outcome.neq.transferred')
    expect(claimIdx).toBeGreaterThan(-1)
  })

  it('concurrent invocations redirect the live call exactly once; the others answer idempotently', async () => {
    const results = await Promise.all([transferLiveCall(CALL_ID, 'a'), transferLiveCall(CALL_ID, 'b'), transferLiveCall(CALL_ID, 'c')])
    expect(twilioUpdate).toHaveBeenCalledTimes(1)
    expect(results.filter((r) => r.message === TRANSFER_MESSAGES.started)).toHaveLength(1)
    expect(results.filter((r) => r.message === TRANSFER_MESSAGES.alreadyStarted)).toHaveLength(2)
    expect(results.every((r) => r.ok)).toBe(true)
  })

  it('a call already transferred is never redirected again', async () => {
    resetCall({ outcome: 'transferred' })
    expect(await transferLiveCall(CALL_ID, 'again')).toEqual({ ok: true, message: TRANSFER_MESSAGES.alreadyStarted })
    expect(twilioUpdate).not.toHaveBeenCalled()
  })

  it('gives the claim back when Twilio refuses the redirect, so a later attempt can transfer', async () => {
    resetCall({ outcome: 'message_taken' })
    twilioUpdate.mockRejectedValueOnce(Object.assign(new Error('Call is not in-progress'), { code: 21220 }))
    await expect(transferLiveCall(CALL_ID, 'x')).rejects.toThrow('not in-progress')
    expect(call.outcome).toBe('message_taken')
    expect(await transferLiveCall(CALL_ID, 'x')).toEqual({ ok: true, message: TRANSFER_MESSAGES.started })
    expect(twilioUpdate).toHaveBeenCalledTimes(2)
  })

  it('expected failures answer ok:false with guidance and never call Twilio', async () => {
    resetCall({ status: 'completed' })
    expect(await transferLiveCall(CALL_ID, 'x')).toEqual({ ok: false, message: TRANSFER_MESSAGES.ended })
    resetCall({ twilio_call_sid: null })
    expect(await transferLiveCall(CALL_ID, 'x')).toEqual({ ok: false, message: TRANSFER_MESSAGES.notTransferable })
    resetCall()
    routingContext.agent = { ...routingContext.agent, transferNumber: null as unknown as string }
    expect(await transferLiveCall(CALL_ID, 'x')).toEqual({ ok: false, message: TRANSFER_MESSAGES.notEnabled })
    routingContext.agent = { ...routingContext.agent, transferEnabled: false, transferNumber: '+40799000111' }
    expect(await transferLiveCall(CALL_ID, 'x')).toEqual({ ok: false, message: TRANSFER_MESSAGES.notEnabled })
    expect(twilioUpdate).not.toHaveBeenCalled()
    expect(call.outcome).toBeNull()
    for (const m of [TRANSFER_MESSAGES.notTransferable, TRANSFER_MESSAGES.notEnabled]) expect(m).toContain('take a message')
  })
})
