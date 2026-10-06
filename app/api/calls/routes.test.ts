import { beforeEach, describe, expect, it, vi } from 'vitest'

type Op = [string, ...unknown[]]
type Result = { data: unknown; error: unknown; count?: number | null }
let handler: (table: string, ops: Op[]) => Result
const calls: Array<{ table: string; ops: Op[] }> = []

function fakeDb() {
  return {
    from(table: string) {
      const ops: Op[] = []
      calls.push({ table, ops })
      const builder: unknown = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === 'then') return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve().then(() => handler(table, ops)).then(res, rej)
          return (...args: unknown[]) => { ops.push([prop, ...args]); return builder }
        },
      })
      return builder
    },
  }
}

const db = fakeDb()
const adminDb = fakeDb()

vi.mock('@/lib/api/auth', () => ({
  requireOrg: vi.fn(async () => ({ supabase: db, user: { id: 'u1', email: 'o@example.test' }, org: { id: 'org1', name: 'X', timezone: 'Europe/Bucharest', plan: 'pro' } })),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => adminDb }))
vi.mock('@/lib/security/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/security/rate-limit')>()),
  rateLimit: vi.fn(async () => ({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 })),
}))
vi.mock('@/lib/elevenlabs/client', () => ({ conversations: { delete: vi.fn(), audio: vi.fn() } }))
vi.mock('@/lib/cartesia/client', () => ({ calls: { delete: vi.fn(), audio: vi.fn() } }))

import { GET as listGET } from '@/app/api/calls/route'
import { GET as getOne, DELETE as delOne } from '@/app/api/calls/[id]/route'
import { GET as audioGET } from '@/app/api/calls/[id]/audio/route'
import { GET as exportGET } from '@/app/api/calls/export/route'
import { GET as metricsGET } from '@/app/api/dashboard/metrics/route'
import { GET as chartGET } from '@/app/api/dashboard/calls-chart/route'
import { POST as integrationsPOST } from '@/app/api/calls/[id]/integrations/route'
import { conversations } from '@/lib/elevenlabs/client'
import { calls as cartesiaCalls } from '@/lib/cartesia/client'
import { ProviderError } from '@/lib/voice-providers/errors'

const ROW = { id: '11111111-1111-4111-8111-111111111111', org_id: 'org1', agent_id: null, phone_number_id: null, twilio_call_sid: 'CA1', elevenlabs_conversation_id: 'conv_123456', caller_number: '+40712345678', direction: 'inbound', duration_seconds: 65, status: 'completed', sentiment: 'positive', summary: '=HYPERLINK("x")', started_at: '2026-10-05T08:00:00Z', ended_at: null, created_at: '2026-10-05T08:00:00Z', provider: 'elevenlabs', primary_provider: 'elevenlabs', routing_reason: 'primary', failover_reason: null, provider_call_id: 'conv_123456', cartesia_call_id: null, from_number: '+40712345678', to_number: '+40312345678', outcome: 'booked', call_successful: 'success', summary_title: 'Booking', termination_reason: null, has_recording: true, recording_status: 'available', transcript: [{ role: 'agent', message: 'Bună ziua', time_in_call_secs: 0 }], analysis: { evaluation: {}, data: { name: 'Ana' } }, agents: { name: 'Agent', voice_name: 'V' } }
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (url: string, init?: RequestInit) => new Request(`https://app.test${url}`, init)

beforeEach(() => {
  calls.length = 0
  vi.mocked(conversations.delete).mockReset()
  vi.mocked(conversations.audio).mockReset()
  vi.mocked(cartesiaCalls.delete).mockReset()
  vi.mocked(cartesiaCalls.audio).mockReset()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('list', () => {
  it('filters and serializes', async () => {
    handler = () => ({ data: [ROW], error: null, count: 1 })
    const res = await listGET(req('/api/calls?page=1&limit=25&search=0712&status=completed&provider=elevenlabs&dateFrom=2026-10-01&dateTo=&sortBy=created_at&sortOrder=desc&minDuration=0'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ total: 1, page: 1, totalPages: 1, hasMore: false })
    expect(body.calls[0]).toMatchObject({ id: ROW.id, provider: 'elevenlabs', recording_url: `/api/calls/${ROW.id}/audio`, agent_name: 'Agent' })
    expect(body.calls[0].transcript).toBeUndefined()
    const ops = calls[0].ops
    expect(ops).toContainEqual(['eq', 'org_id', 'org1'])
    expect(ops).toContainEqual(['eq', 'status', 'completed'])
    expect(ops).toContainEqual(['eq', 'provider', 'elevenlabs'])
    const or = ops.find((o) => o[0] === 'or')
    expect(String(or?.[1])).toContain('caller_number.ilike."*0712*"')
    expect(String(or?.[1])).toContain('started_at.gte."2026-09-30T21:00:00.000Z"')
    expect(ops).toContainEqual(['range', 0, 24])
  })
  it('transferred status filters on the outcome', async () => {
    handler = () => ({ data: [], error: null, count: 0 })
    const res = await listGET(req('/api/calls?status=transferred'))
    expect(res.status).toBe(200)
    const ops = calls[0].ops
    expect(ops).not.toContainEqual(['eq', 'status', 'transferred'])
    expect(ops).toContainEqual(['or', 'outcome.eq.transferred,status.eq.transferred'])
  })
  it('400 on bad params', async () => {
    const res = await listGET(req('/api/calls?limit=1000'))
    expect(res.status).toBe(400)
  })
  it('page past end', async () => {
    let n = 0
    handler = () => (n++ === 0 ? { data: null, error: { code: 'PGRST103', message: 'range' } } : { data: null, error: null, count: 3 })
    const res = await listGET(req('/api/calls?page=9'))
    expect(await res.json()).toMatchObject({ calls: [], total: 3, page: 9, totalPages: 1 })
  })
})

describe('get one', () => {
  it('rejects injection ids', async () => {
    const res = await getOne(req('/api/calls/x'), params('a,id.eq.1'))
    expect(res.status).toBe(400)
  })
  it('provider id lookup', async () => {
    handler = (_t, ops) => (ops.some((o) => o[0] === 'eq' && o[1] === 'elevenlabs_conversation_id') ? { data: ROW, error: null } : { data: null, error: null })
    const res = await getOne(req('/api/calls/conv_123456'), params('conv_123456'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.transcript).toHaveLength(1)
    expect(body.analysis.data.name).toBe('Ana')
    expect(calls.map((c) => c.ops.find((o) => o[0] === 'eq' && o[1] !== 'org_id')?.[1])).toEqual(['provider_call_id', 'elevenlabs_conversation_id'])
    expect(calls.every((c) => c.ops.some((o) => o[0] === 'eq' && o[1] === 'org_id' && o[2] === 'org1'))).toBe(true)
  })
  it('404', async () => {
    handler = () => ({ data: null, error: null })
    const res = await getOne(req('/api/calls/x'), params(ROW.id))
    expect(res.status).toBe(404)
  })
})

describe('delete', () => {
  it('deletes at provider then row then audits', async () => {
    handler = (table, ops) => {
      if (table === 'calls' && ops.some((o) => o[0] === 'delete')) return { data: null, error: null }
      if (table === 'audit_log') return { data: null, error: null }
      return { data: ROW, error: null }
    }
    vi.mocked(conversations.delete).mockResolvedValue(undefined)
    const res = await delOne(req('/api/calls/x', { method: 'DELETE', headers: { origin: 'https://app.test', host: 'app.test' } }), params(ROW.id))
    expect(res.status).toBe(200)
    expect(conversations.delete).toHaveBeenCalledWith('conv_123456', expect.anything())
    expect(calls.some((c) => c.table === 'calls' && c.ops.some((o) => o[0] === 'delete'))).toBe(true)
    const audit = calls.find((c) => c.table === 'audit_log')
    expect(audit?.ops[0][0]).toBe('insert')
    expect(audit?.ops[0][1]).toMatchObject({ org_id: 'org1', action: 'call.deleted', target_id: ROW.id })
  })
  it('keeps row on provider failure', async () => {
    handler = () => ({ data: ROW, error: null })
    vi.mocked(conversations.delete).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'upstream', operation: 'conversations.delete', status: 500 }))
    const res = await delOne(req('/api/calls/x', { method: 'DELETE', headers: { origin: 'https://app.test', host: 'app.test' } }), params(ROW.id))
    expect(res.status).toBe(502)
    expect(calls.some((c) => c.ops.some((o) => o[0] === 'delete'))).toBe(false)
  })
  it('not_found at provider is fine', async () => {
    handler = (table, ops) => (ops.some((o) => o[0] === 'delete') || table === 'audit_log' ? { data: null, error: null } : { data: ROW, error: null })
    vi.mocked(conversations.delete).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'conversations.delete', status: 404 }))
    const res = await delOne(req('/api/calls/x', { method: 'DELETE', headers: { origin: 'https://app.test', host: 'app.test' } }), params(ROW.id))
    expect(res.status).toBe(200)
  })
  it('cross-site rejected', async () => {
    const res = await delOne(req('/api/calls/x', { method: 'DELETE', headers: { origin: 'https://evil.test', host: 'app.test' } }), params(ROW.id))
    expect(res.status).toBe(403)
  })
})

describe('audio', () => {
  it('streams cartesia audio', async () => {
    handler = () => ({ data: { ...ROW, provider: 'cartesia', cartesia_call_id: 'ca_123456', provider_call_id: 'conv_123456' }, error: null })
    vi.mocked(cartesiaCalls.audio).mockResolvedValue(new Response('RIFF', { headers: { 'content-type': 'audio/wav', 'content-length': '4' } }))
    const res = await audioGET(req('/api/calls/x/audio'), params(ROW.id))
    expect(res.status).toBe(200)
    expect(cartesiaCalls.audio).toHaveBeenCalledWith('ca_123456', expect.anything())
    expect(res.headers.get('content-type')).toBe('audio/wav')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(res.headers.get('content-disposition')).toMatch(/^inline;/)
    expect(res.headers.get('accept-ranges')).toBeNull()
    expect(res.headers.get('content-length')).toBe('4')
    expect(await res.text()).toBe('RIFF')
  })
  it('ignores Range and always answers 200 with the full stream', async () => {
    handler = () => ({ data: ROW, error: null })
    vi.mocked(conversations.audio).mockImplementation(async () => new Response('0123456789', { headers: { 'content-type': 'audio/mpeg', 'content-length': '10' } }))
    for (const range of ['bytes=2-5', 'bytes=0-', 'bytes=-3', 'bytes=10-', 'bytes=0-1,4-5', 'items=0-1']) {
      const res = await audioGET(req('/a', { headers: { range } }), params(ROW.id))
      expect(res.status, range).toBe(200)
      expect(res.headers.get('content-range')).toBeNull()
      expect(res.headers.get('accept-ranges')).toBeNull()
      expect(res.headers.get('content-length')).toBe('10')
      expect(await res.text()).toBe('0123456789')
    }
    expect(conversations.audio).toHaveBeenCalledTimes(6)
  })
  it('streams long recordings without buffering them', async () => {
    handler = () => ({ data: ROW, error: null })
    const chunk = new Uint8Array(1024 * 1024)
    const total = 200 // 200 MiB declared — far past any buffer cap
    let pulled = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1
        if (pulled > total) controller.close()
        else controller.enqueue(chunk)
      },
    }, { highWaterMark: 0 })
    vi.mocked(conversations.audio).mockResolvedValue(new Response(body, { headers: { 'content-type': 'audio/mpeg', 'content-length': String(total * chunk.byteLength) } }))
    const res = await audioGET(req('/a', { headers: { range: 'bytes=0-' } }), params(ROW.id))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-length')).toBe(String(total * chunk.byteLength))
    expect(pulled).toBeLessThanOrEqual(1)
    await res.body?.cancel()
  })
  it('drops Content-Length for an encoded upstream body', async () => {
    handler = () => ({ data: ROW, error: null })
    vi.mocked(conversations.audio).mockResolvedValue(new Response('abc', { headers: { 'content-type': 'audio/mpeg', 'content-length': '2', 'content-encoding': 'gzip' } }))
    const res = await audioGET(req('/a'), params(ROW.id))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-length')).toBeNull()
  })
  it('404 when deleted / upstream missing', async () => {
    handler = () => ({ data: { ...ROW, recording_status: 'deleted' }, error: null })
    expect((await audioGET(req('/a'), params(ROW.id))).status).toBe(404)
    handler = () => ({ data: ROW, error: null })
    vi.mocked(conversations.audio).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'not_found', operation: 'conversations.audio', status: 404 }))
    expect((await audioGET(req('/a'), params(ROW.id))).status).toBe(404)
    vi.mocked(conversations.audio).mockRejectedValue(new ProviderError({ system: 'elevenlabs', code: 'timeout', operation: 'conversations.audio' }))
    expect((await audioGET(req('/a'), params(ROW.id))).status).toBe(502)
  })
})

describe('export', () => {
  it('csv with injection protection and labels', async () => {
    handler = (_t, ops) => {
      const range = ops.find((o) => o[0] === 'range')
      return { data: range && range[1] === 0 ? [ROW] : [], error: null }
    }
    const res = await exportGET(req('/api/calls/export?format=csv&scope=filtered&columns=caller_number,summary,provider,routing_reason,outcome,transcript,evil&status=all'))
    expect(res.status).toBe(200)
    const text = await res.text()
    const lines = text.replace(/^﻿/, '').trim().split('\r\n')
    expect(lines[0]).toBe('Phone Number,AI Summary,Voice Provider,Routing,Outcome,Transcript')
    expect(lines[1]).toBe(`'+40712345678,"'=HYPERLINK(""x"")",ElevenLabs,Answered by AI,Appointment booked,Agent: Bună ziua`)
    expect(calls[0].ops.find((o) => o[0] === 'select')?.[1]).toContain('transcript')
  })
  it('selected ids validated', async () => {
    const res = await exportGET(req('/api/calls/export?scope=selected&selectedIds=abc'))
    expect(res.status).toBe(400)
  })
})

describe('metrics & chart', () => {
  it('metrics', async () => {
    const now = new Date()
    handler = (table, ops) => {
      if (table === 'organizations') return { data: { minutes_used: 10, minutes_limit: 150 }, error: null }
      const range = ops.find((o) => o[0] === 'range')
      if (range && range[1] !== 0) return { data: [], error: null }
      return { data: [
        { status: 'completed', sentiment: 'positive', duration_seconds: 60, started_at: now.toISOString(), created_at: now.toISOString() },
        { status: 'failed', sentiment: null, duration_seconds: 0, started_at: null, created_at: now.toISOString() },
        { status: 'in-progress', sentiment: null, duration_seconds: 0, started_at: now.toISOString(), created_at: now.toISOString() },
      ], error: null, count: 3 }
    }
    const body = await (await metricsGET(req('/api/dashboard/metrics'))).json()
    expect(body).toMatchObject({ total_calls: 3, calls_today: 3, success_rate: 50, avg_duration_seconds: 60, minutes_used: 10, minutes_limit: 150, sentiment_breakdown: { positive: 1, neutral: 0, negative: 0 } })
  })
  it('chart', async () => {
    handler = () => ({ data: [{ status: 'completed', sentiment: null, duration_seconds: 120, started_at: new Date().toISOString(), created_at: new Date().toISOString() }], error: null, count: 1 })
    const body = await (await chartGET(req('/api/dashboard/calls-chart'))).json()
    expect(body).toHaveLength(7)
    expect(body[6]).toMatchObject({ calls: 1, duration: 2 })
  })
})

describe('integrations', () => {
  it('rejects bad type and injection id', async () => {
    const h = { origin: 'https://app.test', host: 'app.test', 'content-type': 'application/json' }
    expect((await integrationsPOST(req('/x', { method: 'POST', headers: h, body: JSON.stringify({ type: 'webhook' }) }), params(ROW.id))).status).toBe(400)
    expect((await integrationsPOST(req('/x', { method: 'POST', headers: h, body: JSON.stringify({ type: 'gmail' }) }), params('a),or(id.eq.1'))).status).toBe(400)
  })
})
