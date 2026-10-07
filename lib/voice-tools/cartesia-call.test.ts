import { describe, expect, it } from 'vitest'
import { memoryDb } from '@/tests/helpers/memory-db'
import { findLiveCartesiaCall, MATCH_WINDOW_MS } from './cartesia-call'

// The Cartesia fallback take_message tool cannot carry a signed per-call
// token: the call is resolved from the two numbers of the request, strictly.

const NOW = Date.parse('2026-10-07T07:00:00Z')
const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LINE = '+40310000001'
const CALLER = '+40712345678'
const ago = (ms: number) => new Date(NOW - ms).toISOString()

function call(id: string, over: Record<string, unknown> = {}) {
  return { id, org_id: ORG, phone_number_id: 'pn-a', direction: 'inbound', status: 'in-progress', provider: 'cartesia', from_number: CALLER, to_number: LINE, ended_at: null, created_at: ago(5 * 60_000), ...over }
}

function db(calls: Array<Record<string, unknown>>) {
  return memoryDb({ phone_numbers: [{ id: 'pn-a', org_id: ORG, number: LINE }], calls }) as never
}

const find = (d: never, calledNumber: string | null, callerNumber: string | null) => findLiveCartesiaCall(d, { calledNumber, callerNumber }, NOW)

describe('findLiveCartesiaCall', () => {
  it('matches an in-progress Cartesia call on our line when BOTH numbers match in the call direction', async () => {
    expect(await find(db([call('in-1')]), LINE, CALLER)).toBe('in-1')
    // Outbound: our line called the customer, presented to Cartesia as the SIP caller.
    expect(await find(db([call('out-1', { direction: 'outbound', from_number: LINE, to_number: CALLER })]), LINE, CALLER)).toBe('out-1')
  })

  it('refuses swapped, partial or identical numbers', async () => {
    const d = db([call('in-1')])
    expect(await find(d, CALLER, LINE)).toBeNull()
    expect(await find(d, LINE, null)).toBeNull()
    expect(await find(d, null, CALLER)).toBeNull()
    expect(await find(d, LINE, LINE)).toBeNull()
    expect(await find(d, LINE, '+40700000000')).toBeNull()
    // An outbound row only matches in its own direction.
    expect(await find(db([call('out-1', { direction: 'outbound', from_number: LINE, to_number: CALLER })]), CALLER, LINE)).toBeNull()
  })

  it('only in-progress Cartesia calls started within the last 60 minutes (a hang-up racing the tool is still served)', async () => {
    expect(await find(db([call('old', { created_at: ago(MATCH_WINDOW_MS + 60_000) })]), LINE, CALLER)).toBeNull()
    expect(await find(db([call('ringing', { status: 'ringing' })]), LINE, CALLER)).toBeNull()
    expect(await find(db([call('el', { provider: 'elevenlabs' })]), LINE, CALLER)).toBeNull()
    expect(await find(db([call('done', { status: 'completed', ended_at: ago(10 * 60_000) })]), LINE, CALLER)).toBeNull()
    expect(await find(db([call('racing', { status: 'completed', ended_at: ago(20_000) })]), LINE, CALLER)).toBe('racing')
    // Another line of the same org (or another org's line) is never matched.
    expect(await find(db([call('other-line', { phone_number_id: 'pn-z' })]), LINE, CALLER)).toBeNull()
    expect(await find(db([call('other-org', { org_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })]), LINE, CALLER)).toBeNull()
  })
})
