import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/observability/telemetry', () => ({
  emitProviderEvent: () => {},
  deferBackground: (work: Promise<unknown>) => void work,
}))

import { POST } from './route'

// get_call_context identifies the call from the unsigned called/caller numbers
// of the request (Cartesia system variables). after_hours/direction may come
// from a loose match, but a campaign call's script variables name a customer
// and their order, so they are only answered to that campaign's callee.

const SECRET = 'cartesia-tool-secret-0123456789abcdef'
const NOW = Date.parse('2026-10-13T08:00:00Z')
const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LINE = '+40310000001'
const CUSTOMER = '+40712345678'
const STRANGER = '+40700000000'
const RUN = '77777777-7777-4777-8777-777777777777'
const ORDER_FIELDS = ['customer_name', 'order_number', 'items_summary', 'order_total', 'delivery_city', 'store_name', 'agent_name']
const ago = (ms: number) => new Date(NOW - ms).toISOString()

const VARIABLES = {
  call_reason: 'cod_confirmation',
  store_name: 'Magazin Test',
  agent_name: 'Ana',
  order_number: 'A-1001',
  items_summary: '2 x Tricou',
  order_total: '129,90 lei',
  customer_name: 'Ion Popescu',
  delivery_city: 'Cluj-Napoca',
}

/** The row of a campaign call dispatched to CUSTOMER on our line and answered (connected to Cartesia). */
function campaignCall(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    org_id: ORG,
    phone_number_id: 'pn-a',
    direction: 'outbound',
    status: 'in-progress',
    provider: 'cartesia',
    from_number: LINE,
    to_number: CUSTOMER,
    commerce_run_id: RUN,
    routing: { attempts: [], purpose: 'commerce', after_hours: false, direction: 'outbound', commerce_variables: { ...VARIABLES, junk: 42 } },
    created_at: ago(1_000),
    ...over,
  }
}

/** The row of an inbound call to our line (the router stores Twilio's From as given, even a withheld id). */
function inboundCall(id: string, from: string, over: Record<string, unknown> = {}) {
  return {
    id,
    org_id: ORG,
    phone_number_id: 'pn-a',
    direction: 'inbound',
    status: 'in-progress',
    provider: 'cartesia',
    from_number: from,
    to_number: LINE,
    commerce_run_id: null,
    routing: { attempts: [], after_hours: false, direction: 'inbound' },
    created_at: ago(3_000),
    ...over,
  }
}

function seed(calls: Array<Record<string, unknown>>): MemoryDb {
  return memoryDb({
    phone_numbers: [{ id: 'pn-a', org_id: ORG, number: LINE, agent_id: null, is_active: true, routing_mode: 'app_routed', supports_inbound: true, supports_outbound: true, cartesia_phone_number_id: null }],
    organizations: [{ id: ORG, name: 'Magazin Test', timezone: 'Europe/Bucharest', voice_fallback_enabled: true, plan: null, minutes_used: null, minutes_limit: null }],
    calls,
  })
}

function post(body: unknown, token = SECRET): Request {
  return new Request('https://voice.example.com/api/telephony/tools/cartesia-context', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

async function context(calls: Array<Record<string, unknown>>, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  state.db = seed(calls)
  const res = await POST(post(body))
  expect(res.status).toBe(200)
  return (await res.json()) as Record<string, unknown>
}

function expectNoOrder(json: Record<string, unknown>) {
  expect(json.call_reason).toBe('inbound')
  for (const field of ORDER_FIELDS) expect(json).not.toHaveProperty(field)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('CARTESIA_TOOL_SECRET', SECRET)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('POST /api/telephony/tools/cartesia-context (fallback get_call_context)', () => {
  it('401 without the bearer secret (or with a wrong one)', async () => {
    state.db = seed([campaignCall('out-c')])
    expect((await POST(post({ called_number: LINE, caller_number: CUSTOMER }, 'wrong-secret-0123456789abcdef'))).status).toBe(401)
  })

  it('answers the script variables of a campaign call to its own callee (strings only, in the call direction)', async () => {
    const json = await context([campaignCall('out-c')], { called_number: LINE, caller_number: CUSTOMER, direction: 'outbound' })
    expect(json).toMatchObject({ after_hours: false, direction: 'outbound', business_name: 'Magazin Test', ...VARIABLES })
    expect(json).not.toHaveProperty('junk')
  })

  it('a withheld caller id never gets another customer\'s campaign variables, even when that campaign call is the newest row on the line', async () => {
    // An anonymous caller is on the fallback agent; a second later the cron
    // dispatched CUSTOMER's COD confirmation on the same line and it was
    // answered, so the newest Cartesia row is CUSTOMER's campaign call.
    const race = [campaignCall('out-c'), inboundCall('in-anon', 'anonymous')]
    for (const callerNumber of ['anonymous', 'Restricted', '', undefined]) {
      const json = await context(race, { called_number: LINE, caller_number: callerNumber, direction: 'inbound' })
      expectNoOrder(json)
      expect(json.business_name).toBe('Magazin Test')
    }
  })

  it('a known caller only gets the variables of a campaign call placed to them, not of a call they made or of someone else\'s campaign', async () => {
    // A stranger calls the store while CUSTOMER's campaign call is the newest row.
    expectNoOrder(await context([campaignCall('out-c'), inboundCall('in-s', STRANGER, { created_at: ago(500) })], { called_number: LINE, caller_number: STRANGER }))
    expectNoOrder(await context([campaignCall('out-c')], { called_number: LINE, caller_number: STRANGER }))
    // CUSTOMER calls the store after their campaign call: this call is inbound, the order is not assumed.
    const inbound = await context([campaignCall('out-c', { created_at: ago(10 * 60_000), status: 'completed' }), inboundCall('in-c', CUSTOMER, { created_at: ago(500) })], { called_number: LINE, caller_number: CUSTOMER })
    expectNoOrder(inbound)
    expect(inbound.direction).toBe('inbound')
    // A row carrying a run id but not in the campaign direction (our line → this caller) is never a match.
    expectNoOrder(await context([campaignCall('odd', { direction: 'inbound', from_number: CUSTOMER, to_number: LINE })], { called_number: LINE, caller_number: CUSTOMER }))
    expectNoOrder(await context([campaignCall('other-line', { from_number: '+40310000009' })], { called_number: LINE, caller_number: CUSTOMER }))
  })

  it('a campaign row without a run id, or an unknown line, answers no order', async () => {
    expectNoOrder(await context([campaignCall('no-run', { commerce_run_id: null })], { called_number: LINE, caller_number: CUSTOMER }))
    state.db = seed([campaignCall('out-c')])
    const res = await POST(post({ called_number: '+40319999999', caller_number: CUSTOMER }))
    expect(await res.json()).toEqual({ after_hours: false, direction: 'unknown', business_name: null, business_local_time: null })
  })
})
