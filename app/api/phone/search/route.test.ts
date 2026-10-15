import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// GET /api/phone/search: signed-in organizations only, a country the buy
// dialog offers, rate-limited per organization, and real Twilio numbers or an
// error, never made-up numbers (they would go to checkout and be paid for).

const auth = vi.hoisted(() => ({ signedIn: true, orgId: 'org-1' }))
vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => {
    if (!auth.signedIn) {
      const { RequestError: RE } = await import('@/lib/api/http')
      throw new RE('unauthorized', 'Unauthorized', 401)
    }
    return { supabase: null, user: { id: 'user-1' }, org: { id: auth.orgId, name: 'Acme', timezone: 'UTC', plan: 'trial' } }
  },
}))
const twilio = vi.hoisted(() => ({ configured: true, list: vi.fn(), countries: [] as string[] }))
vi.mock('@/lib/twilio/client', () => ({
  isTwilioConfigured: () => twilio.configured,
  getTwilioClient: () => ({
    availablePhoneNumbers: (country: string) => {
      twilio.countries.push(country)
      return { local: { list: (...a: unknown[]) => twilio.list(...a) } }
    },
  }),
}))

import { GET } from './route'

const search = (query = '?country=US') => GET(new Request(`http://app.test/api/phone/search${query}`))

const available = (n: number, addressRequirements = 'none') =>
  Array.from({ length: n }, (_, i) => ({
    phoneNumber: `+1415555${String(1000 + i)}`,
    friendlyName: `(415) 555-${1000 + i}`,
    locality: 'San Francisco',
    region: 'CA',
    addressRequirements,
  }))

let errorLog: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  auth.signedIn = true
  auth.orgId = `org-${Math.random().toString(36).slice(2)}`
  twilio.configured = true
  twilio.countries = []
  twilio.list.mockReset().mockResolvedValue(available(3))
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/phone/search', () => {
  it('is refused without a signed-in organization, before Twilio is asked', async () => {
    auth.signedIn = false
    const res = await search()
    expect(res.status).toBe(401)
    expect(twilio.list).not.toHaveBeenCalled()
  })

  it('answers the instantly provisionable numbers Twilio offers, at most five, never cached', async () => {
    twilio.list.mockResolvedValue([...available(2, 'local'), ...available(7)])
    const res = await search('?country=gb')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')
    const body = (await res.json()) as Array<Record<string, string>>
    expect(body).toHaveLength(5)
    expect(body[0]).toEqual({ number: '+14155551000', friendly_name: '(415) 555-1000', locality: 'San Francisco', region: 'CA' })
    expect(twilio.countries).toEqual(['GB'])
    expect(twilio.list).toHaveBeenCalledWith({ voiceEnabled: true, limit: 20 })
  })

  it.each(['XX', 'RO', 'US/../Accounts', ''])('a country the buy dialog does not offer (%j) never reaches Twilio', async (country) => {
    const res = await search(`?country=${encodeURIComponent(country)}`)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'invalid_request' })
    expect(twilio.list).not.toHaveBeenCalled()
  })

  it('a Twilio failure answers a provider error with a stable code, logs only status and code, and invents no numbers', async () => {
    twilio.list.mockRejectedValue(Object.assign(new Error('The requested resource /2010-04-01/Accounts/AC0000/AvailablePhoneNumbers/US/Local.json was not found'), { status: 404, code: 20404 }))
    const res = await search()
    expect(res.status).toBe(502)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({ code: 'provider_error' })
    expect(Array.isArray(body)).toBe(false)
    const line = JSON.parse(String(errorLog.mock.calls[0]?.[0])) as Record<string, unknown>
    expect(line).toMatchObject({ event: 'phone.search_failed', country: 'US', status: 404, code: 20404 })
    expect(JSON.stringify(line)).not.toContain('Accounts')
  })

  it('without Twilio credentials it answers not_configured instead of placeholder numbers', async () => {
    twilio.configured = false
    const res = await search()
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code: 'not_configured' })
    expect(twilio.list).not.toHaveBeenCalled()
  })

  it('is rate-limited per organization (10 a minute) with Retry-After', async () => {
    // Inside one fixed window, so the count never straddles a minute boundary.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T12:00:05Z'))
    for (let i = 0; i < 10; i++) expect((await search()).status).toBe(200)
    const limited = await search()
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBeTruthy()
    expect(twilio.list).toHaveBeenCalledTimes(10)
    // Another organization has its own window.
    auth.orgId = 'org-other'
    expect((await search()).status).toBe(200)
  })
})
