import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown, configured: true, limited: false }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/api/auth', () => ({
  requireOrg: vi.fn(async () => ({ supabase: state.db, user: { id: 'u1' }, org: { id: 'org1', name: 'X', timezone: 'UTC', plan: 'pro' } })),
}))
vi.mock('@/lib/twilio/client', () => ({
  isTwilioConfigured: () => state.configured,
  getTwilioClient: () => ({ incomingPhoneNumbers: () => ({ fetch: async () => ({ capabilities: { sms: true } }) }) }),
}))
vi.mock('@/lib/security/rate-limit', async () => {
  const { RequestError } = await import('@/lib/api/http')
  return {
    enforceRateLimit: vi.fn(async () => {
      if (state.limited) throw new RequestError('rate_limited', 'Too many requests', 429)
    }),
  }
})

import { GET } from './route'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  state.configured = true
  state.limited = false
  state.db = memoryDb({
    phone_numbers: [
      { id: 'pn-voice', org_id: 'org1', number: '+40310000001', twilio_sid: 'PN1', is_active: true, sms_capable: false, sms_checked_at: new Date().toISOString() },
      { id: 'pn-other', org_id: 'org2', number: '+40310000009', twilio_sid: 'PN9', is_active: true, sms_capable: true, sms_checked_at: new Date().toISOString() },
    ],
  })
})

const get = () => GET(new Request('https://app.test/api/workflows/sms-capability'))

describe('GET /api/workflows/sms-capability', () => {
  it("answers from the org's own numbers only (another org's SMS number never counts)", async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ available: false, reason: 'not_capable' })
  })

  it('reports when Twilio is not configured', async () => {
    state.configured = false
    expect(await (await get()).json()).toEqual({ available: false, reason: 'not_configured' })
  })

  it('is rate limited', async () => {
    state.limited = true
    expect((await get()).status).toBe(429)
  })
})
