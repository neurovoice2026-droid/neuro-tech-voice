import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AGENT_A, CALL_A, CALL_B, ORG_A, ORG_B, OWNER_A, toolDb } from '@/tests/helpers/voice-tools'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
const rateLimit = vi.fn()
vi.mock('@/lib/security/rate-limit', () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }))
const pending: Array<Promise<unknown>> = []
vi.mock('@/lib/observability/telemetry', () => ({
  emitProviderEvent: () => {},
  deferBackground: (work: Promise<unknown>) => pending.push(work),
}))
const sendEmail = vi.fn()
vi.mock('@/lib/email/client', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a), isConfigured: () => true }))

import { POST } from './route'

const SECRET = 'cartesia-tool-secret-0123456789abcdef'
const NOW = Date.parse('2026-10-07T07:00:00Z')

function post(body: unknown, token = SECRET): Request {
  return new Request('https://voice.example.com/api/telephony/tools/cartesia-message', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

let db: ReturnType<typeof toolDb>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('CARTESIA_TOOL_SECRET', SECRET)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const created = new Date(NOW - 60_000).toISOString()
  db = toolDb({
    phone_numbers: [
      { id: 'pn-a', org_id: ORG_A, number: '+40310000001', agent_id: AGENT_A, routing_mode: 'app_routed' },
      { id: 'pn-b', org_id: ORG_B, number: '+40310000002', agent_id: 'agent-b', routing_mode: 'app_routed' },
    ],
    calls: [
      { id: CALL_A, org_id: ORG_A, agent_id: AGENT_A, phone_number_id: 'pn-a', direction: 'inbound', status: 'in-progress', provider: 'cartesia', from_number: '+40712345678', to_number: '+40310000001', ended_at: null, is_test: false, created_at: created },
      { id: CALL_B, org_id: ORG_B, agent_id: 'agent-b', phone_number_id: 'pn-b', direction: 'inbound', status: 'in-progress', provider: 'cartesia', from_number: '+40712345678', to_number: '+40310000002', ended_at: null, is_test: false, created_at: created },
    ],
    organizations: [
      { id: ORG_A, name: 'Smile Clinic', timezone: 'Europe/Bucharest', user_id: OWNER_A },
      { id: ORG_B, name: 'Other', timezone: 'Europe/Bucharest', user_id: 'owner-b' },
    ],
    agents: [
      { id: AGENT_A, org_id: ORG_A, name: 'Ana', language: 'en', message_settings: { enabled: true } },
      { id: 'agent-b', org_id: ORG_B, name: 'B', language: 'en', message_settings: { enabled: true } },
    ],
  })
  state.db = db
  rateLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 5, resetAt: NOW + 600_000 })
  sendEmail.mockReset().mockResolvedValue(true)
  pending.length = 0
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('POST /api/telephony/tools/cartesia-message (fallback take_message)', () => {
  it('401 without the bearer secret (or with a wrong one)', async () => {
    expect((await POST(post({ reason: 'x', urgency: 'normal' }, 'wrong-secret-0123456789abcdef'))).status).toBe(401)
    expect(db.tables.call_messages ?? []).toEqual([])
  })

  it('finds the live call from the called number (the org) and the caller id, never from the model', async () => {
    const res = await POST(post({ called_number: '+40310000002', caller_number: '+40712345678', reason: 'Call me back', urgency: 'urgent', org_id: ORG_A }))
    expect(await res.json()).toEqual({ ok: true, message: expect.stringContaining('marked urgent') })
    await Promise.all(pending)
    expect(db.tables.call_messages).toEqual([expect.objectContaining({ org_id: ORG_B, call_id: CALL_B, provider: 'cartesia', urgency: 'urgent' })])
  })

  it('an unknown number, a caller without a live call, or an ended call saves nothing', async () => {
    const unknown = await (await POST(post({ called_number: '+40319999999', caller_number: '+40712345678', reason: 'x', urgency: 'normal' }))).json()
    expect(unknown.ok).toBe(false)
    const stranger = await (await POST(post({ called_number: '+40310000001', caller_number: '+40700000000', reason: 'x', urgency: 'normal' }))).json()
    expect(stranger.ok).toBe(false)
    db.tables.calls[0].ended_at = new Date(NOW - 10 * 60_000).toISOString()
    const ended = await (await POST(post({ called_number: '+40310000001', caller_number: '+40712345678', reason: 'x', urgency: 'normal' }))).json()
    expect(ended.ok).toBe(false)
    expect(db.tables.call_messages ?? []).toEqual([])
  })
})
