import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeDb } from '@/tests/helpers/fake-db'

// Google OAuth connect → callback: the page the owner returns to is an
// allow-listed same-origin path carried in the state cookie (default
// /integrations), never an arbitrary URL. The connect asks for the scopes of
// the chosen type only, and the token is written with the service role for
// the signed-in owner's organization, never through the owner's session.

const ORG = '11111111-1111-4111-8111-111111111111'
const state = vi.hoisted(() => ({ user: { id: 'u1' } as unknown, db: null as unknown, admin: null as unknown, getToken: null as unknown }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => (state.db as ReturnType<typeof fakeDb>).from(table),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (table: string) => (state.admin as ReturnType<typeof fakeDb>).from(table) }),
}))
const oauth = vi.hoisted(() => ({
  getGoogleOAuthUrl: vi.fn((type: string, s: string) => `https://accounts.google.com/o/oauth2/v2/auth?type=${type}&state=${encodeURIComponent(s)}`),
}))
vi.mock('@/lib/google/client', () => ({
  getGoogleOAuthUrl: oauth.getGoogleOAuthUrl,
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
  state.admin = fakeDb(() => ({ data: null, error: null }))
  resync.scheduleCalendarResync.mockReset()
  oauth.getGoogleOAuthUrl.mockClear()
})

const adminCalls = () => (state.admin as ReturnType<typeof fakeDb>).calls
const userCalls = () => (state.db as ReturnType<typeof fakeDb>).calls

describe('GET /api/integrations/google/connect', () => {
  it('stores an allow-listed return path with the CSRF nonce', async () => {
    const res = await connect(connectReq(`type=google_calendar&return_to=${encodeURIComponent('/agent?tab=call-handling')}`))
    const cookie = res.cookies.get('g_oauth_state')?.value ?? ''
    expect(cookie).toMatch(/^[0-9a-f]{32}\.agent_call_handling$/)
    const googleState = new URL(res.headers.get('location') ?? '').searchParams.get('state')
    expect(googleState).toBe(`google_calendar.${cookie.split('.')[0]}`)
  })

  it('asks Google for the chosen integration type only', async () => {
    for (const type of ['gmail', 'google_calendar', 'google_sheets', 'google_docs', 'google_drive']) {
      const res = await connect(connectReq(`type=${type}`))
      expect(new URL(res.headers.get('location') ?? '').searchParams.get('type')).toBe(type)
    }
    expect(oauth.getGoogleOAuthUrl.mock.calls.map(([type]) => type)).toEqual(['gmail', 'google_calendar', 'google_sheets', 'google_docs', 'google_drive'])
  })

  it('refuses a type that is not a Google integration', async () => {
    for (const type of ['webhook', 'google_calendar.x', 'constructor']) {
      const res = await connect(connectReq(`type=${encodeURIComponent(type)}`))
      expect(location(res)).toBe('/integrations?error=invalid_type')
    }
    expect(oauth.getGoogleOAuthUrl).not.toHaveBeenCalled()
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

  it('stores the token with the service role, scoped to the signed-in owner\'s organization', async () => {
    const res = await callback(callbackReq(`code=c1&state=gmail.${NONCE}`, NONCE))
    expect(location(res)).toBe('/integrations?connected=gmail')
    expect(userCalls().some((c) => c.table === 'integrations')).toBe(false)
    const write = adminCalls().find((c) => c.table === 'integrations')
    expect(write?.op).toBe('upsert')
    expect(write?.payload).toMatchObject({ org_id: ORG, type: 'gmail', is_active: true, google_refresh_token: 'rt' })
    expect(resync.scheduleCalendarResync).not.toHaveBeenCalled()
  })

  it('refuses a state whose type is not a Google integration', async () => {
    for (const type of ['webhook', 'unknown']) {
      const res = await callback(callbackReq(`code=c1&state=${type}.${NONCE}`, NONCE))
      expect(location(res)).toBe('/integrations?error=invalid_state')
    }
    expect(state.getToken).not.toHaveBeenCalled()
    expect(adminCalls()).toHaveLength(0)
  })

  it('never marks an integration connected without a refresh token', async () => {
    state.getToken = vi.fn(async () => ({ tokens: { access_token: 'at' } }))
    const res = await callback(callbackReq(`code=c1&state=gmail.${NONCE}`, NONCE))
    expect(location(res)).toBe('/integrations?error=token_exchange')
    expect(adminCalls().map((c) => c.op)).toEqual(['select'])
  })

  it('keeps the stored refresh token when Google sends none (update, no upsert)', async () => {
    state.getToken = vi.fn(async () => ({ tokens: { access_token: 'at' } }))
    state.admin = fakeDb((c) => (c.op === 'select' ? { data: { google_refresh_token: 'stored' }, error: null } : { data: null, error: null }))
    const res = await callback(callbackReq(`code=c1&state=google_calendar.${NONCE}`, NONCE))
    expect(location(res)).toBe('/integrations?connected=google_calendar')
    const [read, write] = adminCalls()
    expect(read.filters).toEqual(expect.arrayContaining([['eq', 'org_id', ORG], ['eq', 'type', 'google_calendar']]))
    expect(write.op).toBe('update')
    expect(write.payload).toMatchObject({ is_active: true })
    expect(write.payload).not.toHaveProperty('google_refresh_token')
    expect(write.filters).toEqual(expect.arrayContaining([['eq', 'org_id', ORG], ['eq', 'type', 'google_calendar']]))
    expect(resync.scheduleCalendarResync).toHaveBeenCalledWith(ORG, expect.anything())
  })

  it('reports a failed lookup of the stored token instead of marking it connected', async () => {
    state.getToken = vi.fn(async () => ({ tokens: { access_token: 'at' } }))
    state.admin = fakeDb(() => ({ data: null, error: { message: 'timeout', code: '57014' } }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await callback(callbackReq(`code=c1&state=google_calendar.${NONCE}`, NONCE))
    expect(location(res)).toBe('/integrations?error=token_exchange')
    expect(adminCalls().map((c) => c.op)).toEqual(['select'])
    expect(resync.scheduleCalendarResync).not.toHaveBeenCalled()
  })

  it('stores nothing when the owner unticked the scope this type needs', async () => {
    state.getToken = vi.fn(async () => ({
      tokens: { refresh_token: 'rt', scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly' },
    }))
    const res = await callback(callbackReq(`code=c1&state=gmail.${NONCE}`, `${NONCE}.agent_call_handling`))
    expect(location(res)).toBe('/agent?tab=call-handling&error=oauth_denied')
    expect(adminCalls()).toHaveLength(0)
  })

  it('accepts a token carrying earlier grants next to this type\'s scope (incremental authorization)', async () => {
    state.getToken = vi.fn(async () => ({
      tokens: { refresh_token: 'rt', scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send' },
    }))
    const res = await callback(callbackReq(`code=c1&state=gmail.${NONCE}`, NONCE))
    expect(location(res)).toBe('/integrations?connected=gmail')
    expect(adminCalls().map((c) => c.op)).toEqual(['upsert'])
  })

  it('reports a failed write without logging the token', async () => {
    state.getToken = vi.fn(async () => ({ tokens: { refresh_token: 'rt-secret-value' } }))
    state.admin = fakeDb(() => ({ data: null, error: { message: 'permission denied', code: '42501' } }))
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await callback(callbackReq(`code=c1&state=gmail.${NONCE}`, NONCE))
    expect(location(res)).toBe('/integrations?error=token_exchange')
    const logged = errors.mock.calls.flat().map(String).join('\n')
    expect(logged).toContain('integrations.google_callback.failed')
    expect(logged).not.toContain('rt-secret-value')
  })

  it('never redirects off-site, whatever the cookie says', async () => {
    const res = await callback(callbackReq(`code=c1&state=google_calendar.${NONCE}`, `${NONCE}.${encodeURIComponent('//evil.example')}`))
    expect(new URL(res.headers.get('location') ?? '').host).toBe('localhost')
    expect(location(res)).toBe('/integrations?connected=google_calendar')
  })
})
