import { beforeEach, describe, expect, it, vi } from 'vitest'

// DELETE /api/calls/[id]: the tombstone (audit_log 'call.deleted') is written
// BEFORE the row is deleted, and a failed tombstone keeps the row. Otherwise a
// late webhook or poll arriving in between (or after a failed audit write)
// would recreate the deleted call (call-store.ts checks the tombstone only
// when no row exists).

type Op = [string, ...unknown[]]
type Result = { data: unknown; error: unknown }
const timeline: Array<{ table: string; op: string; ops: Op[] }> = []
let handler: (table: string, ops: Op[]) => Result

function fakeDb() {
  return {
    from(table: string) {
      const ops: Op[] = []
      const builder: unknown = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === 'then') {
            return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
              Promise.resolve()
                .then(() => {
                  const write = ops.find((o) => ['insert', 'delete', 'update', 'upsert'].includes(o[0]))
                  timeline.push({ table, op: write ? write[0] : 'select', ops })
                  return handler(table, ops)
                })
                .then(res, rej)
          }
          return (...args: unknown[]) => {
            ops.push([prop, ...args])
            return builder
          }
        },
      })
      return builder
    },
  }
}

const userDb = fakeDb()
const adminDb = fakeDb()
vi.mock('@/lib/api/auth', () => ({
  requireOrg: vi.fn(async () => ({ supabase: userDb, user: { id: 'u1', email: 'o@example.test' }, org: { id: 'org1', name: 'X', timezone: 'UTC', plan: 'pro' } })),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => adminDb }))
vi.mock('@/lib/security/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/security/rate-limit')>()),
  rateLimit: vi.fn(async () => ({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 })),
}))
vi.mock('@/lib/elevenlabs/client', () => ({ conversations: { delete: vi.fn(), audio: vi.fn() } }))
vi.mock('@/lib/cartesia/client', () => ({ calls: { delete: vi.fn(), audio: vi.fn() } }))

import { DELETE } from './route'
import { conversations } from '@/lib/elevenlabs/client'

const ID = '11111111-1111-4111-8111-111111111111'
const ROW = {
  id: ID, org_id: 'org1', agent_id: null, status: 'completed', started_at: '2026-10-05T08:00:00Z', created_at: '2026-10-05T08:00:00Z',
  provider: 'elevenlabs', provider_call_id: 'conv_123456', elevenlabs_conversation_id: 'conv_123456', cartesia_call_id: null,
}
const del = () =>
  DELETE(new Request('https://app.test/api/calls/x', { method: 'DELETE', headers: { origin: 'https://app.test', host: 'app.test' } }), { params: Promise.resolve({ id: ID }) })

beforeEach(() => {
  timeline.length = 0
  vi.mocked(conversations.delete).mockReset().mockResolvedValue(undefined)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('DELETE /api/calls/[id] — tombstone first', () => {
  it('writes the tombstone, then deletes the row', async () => {
    handler = (table, ops) => (table === 'calls' && !ops.some((o) => o[0] === 'delete') ? { data: ROW, error: null } : { data: null, error: null })
    const res = await del()
    expect(res.status).toBe(200)
    const writes = timeline.filter((t) => t.op !== 'select').map((t) => `${t.table}:${t.op}`)
    expect(writes).toEqual(['audit_log:insert', 'calls:delete'])
    const tombstone = timeline.find((t) => t.table === 'audit_log')?.ops[0][1] as Record<string, unknown>
    expect(tombstone).toMatchObject({ org_id: 'org1', action: 'call.deleted', target_type: 'call', target_id: ID, details: { provider_call_ids: ['conv_123456'] } })
    const rowDelete = timeline.find((t) => t.op === 'delete')
    expect(rowDelete?.ops).toEqual(expect.arrayContaining([['eq', 'id', ID], ['eq', 'org_id', 'org1']]))
  })

  it('a failed tombstone write deletes nothing and answers 5xx so the owner can retry', async () => {
    handler = (table, ops) => {
      if (table === 'audit_log') return { data: null, error: { message: 'audit_log unavailable', code: '57014' } }
      return table === 'calls' && !ops.some((o) => o[0] === 'delete') ? { data: ROW, error: null } : { data: null, error: null }
    }
    const res = await del()
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code: 'internal' })
    expect(timeline.some((t) => t.table === 'calls' && t.op === 'delete')).toBe(false)
  })

  it('a failed row delete after the tombstone is an error (the row stays; a retry writes a new tombstone)', async () => {
    handler = (table, ops) => {
      if (table === 'calls' && ops.some((o) => o[0] === 'delete')) return { data: null, error: { message: 'boom' } }
      return table === 'calls' ? { data: ROW, error: null } : { data: null, error: null }
    }
    const res = await del()
    expect(res.status).toBeGreaterThanOrEqual(500)
    expect(timeline.filter((t) => t.op !== 'select').map((t) => `${t.table}:${t.op}`)).toEqual(['audit_log:insert', 'calls:delete'])
  })
})
