import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeDb } from '@/tests/helpers/fake-db'

// Google OAuth connect → callback: the page the owner returns to is an
// allow-listed same-origin path carried in the state cookie (default
// /integrations), never an arbitrary URL.

const ORG = '11111111-1111-4111-8111-111111111111'
const state = vi.hoisted(() => ({ user: { id: 'u1' } as unknown, db: null as unknown, getToken: null as unknown }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => (state.db as ReturnType<typeof fakeDb>).from(table),
  }),
}))
vi.mock('@/lib/google/client', () => ({
  getGoogleOAuthUrl: (s: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(s)}`,
  getGoogleOAuthClient: () => ({ getToken: state.getToken }),
}))
const resync = vi.hoisted(() => ({ scheduleCalendarResync: vi.fn() }))
vi.mock('@/lib/voice-tools/calendar-resync', () => resync)

import { GET as connect } from './connect/route'
import { GET as callback } from './callback/route'

const NONCE = 'f'.repeat(32)

function connectReq(query: string) {
  return new NextRequest(`http://localhost/api/integrations/google/connect?${query}`)
}
function callbackReq(query: string, cookie?: string) {
  return new NextRequest(`http://localhost/api/integrations/google/callback?${query}`, cookie ? { headers: { cookie: `g_oauth_state=${cookie}` } } : undefined)
}
const location = (res: Response) => {
  const url = new URL(res.headers.get('location') ?? '')
  return `${url.pathname}${url.search}`
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'cid')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret')
  state.user = { id: 'u1' }
  state.getToken = vi.fn(async () => ({ tokens: { refresh_token: 'rt' } }))
  state.db = fakeDb((c) => (c.table === 'organizations' ? { data: { id: ORG }, error: null } : { data: null, error: null }))
  resync.scheduleCalendarResync.mockReset()
})

describe('GET /api/integrations/google/connect', () => {
  it('stores an allow-listed return path with the CSRF nonce', async () => {
    const res = await connect(connectReq(`type=google_calendar&return_to=${encodeURIComponent('/agent?tab=call-handling')}`))
    const cookie = res.cookies.get('g_oauth_state')?.value ?? ''
    expect(cookie).toMatch(/^[0-9a-f]{32}\.agent_call_handling$/)
    const googleState = new URL(res.headers.get('location') ?? '').searchParams.get('state')
    expect(googleState).toBe(`google_calendar.${cookie.split('.')[0]}`)
  })

  it('ignores a return path that is not allow-listed', async () => {
    for (const target of ['https://evil.example/', '//evil.example', '/agent?tab=call-handling&x=1']) {
      const res = await connect(connectReq(`type=google_calendar&return_to=${encodeURIComponent(target)}`))
      expect(res.cookies.get('g_oauth_state')?.value).toMatch(/^[0-9a-f]{32}$/)
    }
  })
})

describe('GET /api/integrations/google/callback', () => {
  it('returns to the stored page after connecting', async () => {
    const res = await callback(callbackReq(`code=c1&state=google_calendar.${NONCE}`, `${NONCE}.agent_call_handling`))
    expect(location(res)).toBe('/agent?tab=call-handling&connected=google_calendar')
    expect(resync.scheduleCalendarResync).toHaveBeenCalledWith(ORG, expect.anything())
  })

  it('keeps /integrations as the default', async () => {
    const res = await callback(callbackReq(`code=c1&state=google_calendar.${NONCE}`, NONCE))
    expect(location(res)).toBe('/integrations?connected=google_calendar')
  })

  it('reports errors on the stored page too', async () => {
    expect(location(await callback(callbackReq('error=access_denied', `${NONCE}.agent_call_handling`)))).toBe('/agent?tab=call-handling&error=oauth_denied')
    expect(location(await callback(callbackReq(`code=c1&state=google_calendar.${'0'.repeat(32)}`, `${NONCE}.agent_call_handling`)))).toBe(
      '/agent?tab=call-handling&error=invalid_state',
    )
    state.getToken = vi.fn(async () => {
      throw new Error('invalid_grant')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(location(await callback(callbackReq(`code=c1&state=google_calendar.${NONCE}`, `${NONCE}.agent_call_handling`)))).toBe(
      '/agent?tab=call-handling&error=token_exchange',
    )
  })

  it('never redirects off-site, whatever the cookie says', async () => {
    const res = await callback(callbackReq(`code=c1&state=google_calendar.${NONCE}`, `${NONCE}.${encodeURIComponent('//evil.example')}`))
    expect(new URL(res.headers.get('location') ?? '').host).toBe('localhost')
    expect(location(res)).toBe('/integrations?connected=google_calendar')
  })
})
