import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryDb, type MemoryDb } from '@/tests/helpers/memory-db'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db }))
vi.mock('@/lib/api/auth', () => ({
  requireOrg: vi.fn(async () => ({ supabase: state.db, user: { id: 'u1' }, org: { id: 'org1', name: 'X', timezone: 'UTC', plan: 'pro' } })),
}))

import { GET } from './route'
import { PATCH } from './[id]/route'
import { GET as callBusinessGET } from '@/app/api/calls/[id]/business/route'

const M1 = '11111111-1111-4111-8111-111111111111'
const M2 = '22222222-2222-4222-8222-222222222222'
const M_OTHER = '33333333-3333-4333-8333-333333333333'
const CALL = '44444444-4444-4444-8444-444444444444'
const OTHER_CALL = '55555555-5555-4555-8555-555555555555'

let db: MemoryDb
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db = memoryDb({
    call_messages: [
      { id: M1, org_id: 'org1', call_id: CALL, caller_name: 'Ana', callback_number: '+40712345678', reason: 'Call back', urgency: 'urgent', status: 'open', created_at: '2026-10-07T08:00:00Z' },
      { id: M2, org_id: 'org1', call_id: null, caller_name: null, callback_number: null, reason: '', urgency: 'normal', status: 'done', retention_applied_at: '2026-10-07T09:00:00Z', created_at: '2026-10-06T08:00:00Z' },
      { id: M_OTHER, org_id: 'org2', call_id: OTHER_CALL, caller_name: 'Bob', reason: 'Other org', urgency: 'normal', status: 'open', created_at: '2026-10-07T09:00:00Z' },
    ],
    calls: [
      { id: CALL, org_id: 'org1' },
      { id: OTHER_CALL, org_id: 'org2' },
    ],
    bookings: [
      { id: 'b1', org_id: 'org1', call_id: CALL, caller_name: 'Ana', caller_phone: '+40712345678', starts_at: '2026-10-08T10:00:00Z', ends_at: '2026-10-08T11:00:00Z', timezone: 'Europe/Bucharest', status: 'booked' },
      { id: 'b2', org_id: 'org2', call_id: CALL, caller_name: 'Spoof', starts_at: '2026-10-08T10:00:00Z', ends_at: '2026-10-08T11:00:00Z', timezone: 'UTC', status: 'booked' },
    ],
  })
  state.db = db
})

const patch = (id: string, body: unknown, origin = 'https://app.test') =>
  PATCH(new Request(`https://app.test/api/messages/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', origin, host: 'app.test', 'x-forwarded-proto': 'https' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })

describe('GET /api/messages', () => {
  it("lists only the org's open messages by default, newest first, with the open count", async () => {
    const body = await (await GET(new Request('https://app.test/api/messages'))).json()
    expect(body.messages.map((m: { id: string }) => m.id)).toEqual([M1])
    expect(body.open_count).toBe(1)
    expect(body.messages[0]).toMatchObject({ caller_name: 'Ana', urgency: 'urgent', status: 'open', purged: false })
    const all = await (await GET(new Request('https://app.test/api/messages?status=all'))).json()
    expect(all.messages.map((m: { id: string }) => m.id)).toEqual([M1, M2])
    expect(all.messages[1].purged).toBe(true)
  })

  it('rejects invalid filters', async () => {
    expect((await GET(new Request('https://app.test/api/messages?status=everything'))).status).toBe(400)
    expect((await GET(new Request('https://app.test/api/messages?limit=1000'))).status).toBe(400)
  })
})

describe('PATCH /api/messages/[id]', () => {
  it('marks the org’s own message done (and open again)', async () => {
    const res = await patch(M1, { status: 'done' })
    expect(res.status).toBe(200)
    expect(db.tables.call_messages[0]).toMatchObject({ status: 'done', done_at: expect.any(String) })
    await patch(M1, { status: 'open' })
    expect(db.tables.call_messages[0]).toMatchObject({ status: 'open', done_at: null })
  })

  it("another org's message is not found; bad ids, bodies and cross-site requests are refused", async () => {
    expect((await patch(M_OTHER, { status: 'done' })).status).toBe(404)
    expect(db.tables.call_messages[2].status).toBe('open')
    expect((await patch('not-a-uuid', { status: 'done' })).status).toBe(400)
    expect((await patch(M1, { status: 'archived' })).status).toBe(400)
    expect((await patch(M1, { status: 'done', org_id: 'org2' })).status).toBe(400)
    expect((await patch(M1, { status: 'done' }, 'https://evil.example')).status).toBe(403)
  })
})

describe('GET /api/calls/[id]/business', () => {
  it('returns the message and bookings of the org’s own call only', async () => {
    const body = await (await callBusinessGET(new Request(`https://app.test/api/calls/${CALL}/business`), { params: Promise.resolve({ id: CALL }) })).json()
    expect(body.messages.map((m: { id: string }) => m.id)).toEqual([M1])
    expect(body.bookings).toEqual([expect.objectContaining({ id: 'b1', status: 'booked', caller_name: 'Ana' })])
    const other = await callBusinessGET(new Request(`https://app.test/api/calls/${OTHER_CALL}/business`), { params: Promise.resolve({ id: OTHER_CALL }) })
    expect(other.status).toBe(404)
  })
})
