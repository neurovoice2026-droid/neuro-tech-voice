import { beforeEach, describe, expect, it, vi } from 'vitest'

// POST/GET /api/agent/web-session (slice G): same-origin, signed-in owner,
// strict body (the browser can only choose the mode), never cached.

const auth = vi.hoisted(() => ({ signedIn: true }))
vi.mock('@/lib/api/auth', () => ({
  requireOrg: async () => {
    if (!auth.signedIn) {
      const { RequestError: RE } = await import('@/lib/api/http')
      throw new RE('unauthorized', 'Unauthorized', 401)
    }
    return { supabase: null, user: { id: 'user-1' }, org: { id: 'org-1', name: 'Acme', timezone: 'UTC', plan: 'trial' } }
  },
}))
const lib = vi.hoisted(() => ({ start: vi.fn(), availability: vi.fn() }))
vi.mock('@/lib/voice-providers/web-test', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/voice-providers/web-test')>()),
  startWebTestSession: (...a: unknown[]) => lib.start(...a),
  webTestAvailability: (...a: unknown[]) => lib.availability(...a),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => null }))

import { GET, POST } from './route'
import { RequestError } from '@/lib/api/http'

const URL_ = 'http://app.test/api/agent/web-session'
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://app.test', host: 'app.test', ...headers }, body: JSON.stringify(body) })

beforeEach(() => {
  auth.signedIn = true
  lib.start.mockReset()
  lib.availability.mockReset()
  lib.start.mockResolvedValue({ conversation_token: 'tok', conversation_id: 'conv_1', call_id: 'c1', mode: 'voice' })
  lib.availability.mockResolvedValue({ available: true, reason: null })
})

describe('POST /api/agent/web-session', () => {
  it('starts a session for the signed-in org and is never cached', async () => {
    const res = await POST(post({ mode: 'text' }, { 'x-forwarded-for': '203.0.113.7' }))
    expect(res.status).toBe(201)
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(await res.json()).toMatchObject({ conversation_token: 'tok' })
    const [input] = lib.start.mock.calls[0] as [{ org: { id: string }; userId: string; mode: string; ipKey: string }]
    expect(input).toMatchObject({ org: { id: 'org-1' }, userId: 'user-1', mode: 'text' })
    expect(input.ipKey).toMatch(/^[0-9a-f]{32}$/)
    expect(input.ipKey).not.toContain('203.0.113.7')
  })

  it('defaults to voice; rejects any other field (no agent id, overrides or variables from the browser)', async () => {
    expect((await POST(post({}))).status).toBe(201)
    expect((lib.start.mock.calls[0] as [{ mode: string }])[0].mode).toBe('voice')
    for (const body of [{ mode: 'video' }, { mode: 'voice', agent_id: 'agent_x' }, { mode: 'voice', dynamic_variables: { a: 1 } }]) {
      expect((await POST(post(body))).status).toBe(400)
    }
    expect(lib.start).toHaveBeenCalledTimes(1)
  })

  it('rejects cross-site requests and signed-out users before anything runs', async () => {
    expect((await POST(post({}, { origin: 'https://evil.example' }))).status).toBe(403)
    auth.signedIn = false
    expect((await POST(post({}))).status).toBe(401)
    expect(lib.start).not.toHaveBeenCalled()
  })

  it('passes refusals through with their status, never cached', async () => {
    lib.start.mockRejectedValue(new RequestError('forbidden', 'You have used all 20 free browser tests.', 403, { reason: 'trial_limit' }))
    const res = await POST(post({}))
    expect(res.status).toBe(403)
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(await res.json()).toMatchObject({ code: 'forbidden', details: { reason: 'trial_limit' } })
  })
})

describe('GET /api/agent/web-session', () => {
  it('returns the availability for the signed-in org', async () => {
    const res = await GET(new Request(URL_))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(lib.availability).toHaveBeenCalledWith(expect.objectContaining({ id: 'org-1' }), expect.anything())
    auth.signedIn = false
    expect((await GET(new Request(URL_))).status).toBe(401)
  })
})
