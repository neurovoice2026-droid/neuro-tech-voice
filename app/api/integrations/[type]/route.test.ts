import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeDb } from '@/tests/helpers/fake-db'

// /api/integrations/[type]: the owner's session only reads status columns.
// Only the webhook can be connected here (a Google type becomes active only
// through OAuth, which stores the refresh token), and every write runs with
// the service role, scoped to the signed-in owner's organization.

const ORG = '11111111-1111-4111-8111-111111111111'
const state = vi.hoisted(() => ({ user: { id: 'u1' } as unknown, db: null as unknown, admin: null as unknown }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => (state.db as ReturnType<typeof fakeDb>).from(table),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (table: string) => (state.admin as ReturnType<typeof fakeDb>).from(table) }),
}))
const resync = vi.hoisted(() => ({ scheduleCalendarResync: vi.fn() }))
vi.mock('@/lib/voice-tools/calendar-resync', () => resync)

import { DELETE, GET, POST } from './route'

const params = (type: string) => ({ params: Promise.resolve({ type }) })
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/integrations/x', {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
const userCalls = () => (state.db as ReturnType<typeof fakeDb>).calls
const adminCalls = () => (state.admin as ReturnType<typeof fakeDb>).calls

beforeEach(() => {
  state.user = { id: 'u1' }
  state.db = fakeDb((c) =>
    c.table === 'organizations'
      ? { data: { id: ORG }, error: null }
      : { data: { type: 'gmail', is_active: true, config: {}, connected_at: '2026-10-01T00:00:00Z' }, error: null },
  )
  state.admin = fakeDb((c) => ({ data: { type: c.table === 'integrations' ? 'webhook' : null, is_active: true, config: { url: 'https://hooks.example/x' } }, error: null }))
  resync.scheduleCalendarResync.mockReset()
})

describe('POST /api/integrations/[type]', () => {
  it('refuses every Google type: they are connected only through OAuth', async () => {
    for (const type of ['gmail', 'google_calendar', 'google_sheets', 'google_docs', 'google_drive']) {
      const res = await POST(req('POST', { config: {} }), params(type))
      expect(res.status, type).toBe(400)
      expect((await res.json()).error).toMatch(/Google sign-in/)
    }
    expect(userCalls()).toHaveLength(0)
    expect(adminCalls()).toHaveLength(0)
  })

  it('refuses an unknown type and a webhook without a URL', async () => {
    expect((await POST(req('POST', { config: { url: 'https://x' } }), params('slack'))).status).toBe(400)
    expect((await POST(req('POST', { config: {} }), params('webhook'))).status).toBe(400)
    expect(adminCalls()).toHaveLength(0)
  })

  it('requires a signed-in owner', async () => {
    state.user = null
    expect((await POST(req('POST', { config: { url: 'https://x' } }), params('webhook'))).status).toBe(401)
    expect(adminCalls()).toHaveLength(0)
  })

  it('writes the webhook with the service role for the owner\'s organization, never a token', async () => {
    const res = await POST(req('POST', { config: { url: 'https://hooks.example/x' }, google_refresh_token: 'forged', org_id: 'other' }), params('webhook'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ connected: true })
    expect(userCalls().some((c) => c.table === 'integrations')).toBe(false)
    const [write] = adminCalls()
    expect(write).toMatchObject({ table: 'integrations', op: 'upsert' })
    expect(write.payload).toEqual({ org_id: ORG, type: 'webhook', config: { url: 'https://hooks.example/x' }, is_active: true, connected_at: expect.any(String) })
  })
})

describe('DELETE /api/integrations/[type]', () => {
  it('disconnects with the service role, scoped to the owner\'s organization and type', async () => {
    const res = await DELETE(req('DELETE'), params('google_calendar'))
    expect(await res.json()).toEqual({ connected: false })
    expect(userCalls().some((c) => c.table === 'integrations')).toBe(false)
    const [del] = adminCalls()
    expect(del.op).toBe('delete')
    expect(del.filters).toEqual([['eq', 'org_id', ORG], ['eq', 'type', 'google_calendar']])
    expect(resync.scheduleCalendarResync).toHaveBeenCalledWith(ORG, expect.anything())
  })

  it('reports a failed delete', async () => {
    state.admin = fakeDb(() => ({ data: null, error: { message: 'boom' } }))
    expect((await DELETE(req('DELETE'), params('webhook'))).status).toBe(500)
    expect(resync.scheduleCalendarResync).not.toHaveBeenCalled()
  })
})

describe('GET /api/integrations/[type]', () => {
  it('reads status columns only, through the owner\'s session', async () => {
    const res = await GET(req('GET'), params('gmail'))
    expect(await res.json()).toMatchObject({ connected: true, integration: { type: 'gmail' } })
    const read = userCalls().find((c) => c.table === 'integrations')
    expect(read?.columns).toBe('type, is_active, config, connected_at')
    expect(read?.columns).not.toContain('google_refresh_token')
    expect(adminCalls()).toHaveLength(0)
  })
})
