import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, requireOrg } from './auth'
import { RequestError } from './http'

type ServerClient = Awaited<ReturnType<typeof createClient>>

const TOKEN = 'admin-token-0123456789abcdef-0123456789' // ≥ 32 chars
const ADMIN_ID = '0b5c1d2e-3f40-4a51-8b62-7c83d94e0f1a'
const OTHER_ID = '9f8e7d6c-5b4a-4392-8180-7f6e5d4c3b2a'

function user(id: string): User {
  return { id, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' }
}

interface FakeOptions {
  user: User | null
  org?: { data: unknown; error: unknown }
}

/** Minimal stand-in for the user-scoped Supabase client (auth + one org query). */
function fakeClient(opts: FakeOptions) {
  const maybeSingle = vi.fn(async () => opts.org ?? { data: null, error: null })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  const getUser = vi.fn(async () => ({ data: { user: opts.user }, error: null }))
  const client = { auth: { getUser }, from }
  return { client: client as unknown as ServerClient, getUser, from, select, eq }
}

function adminRequest(authorization?: string): Request {
  return new Request('https://app.example.com/api/admin/voice/diagnostics', {
    headers: authorization ? { authorization } : {},
  })
}

async function rejection(p: Promise<unknown>): Promise<RequestError> {
  const err = await p.then(() => null, (e: unknown) => e)
  expect(err).toBeInstanceOf(RequestError)
  return err as RequestError
}

beforeEach(() => {
  vi.stubEnv('ADMIN_API_TOKEN', '')
  vi.stubEnv('PLATFORM_ADMIN_USER_IDS', '')
})

describe('requireAdmin — bearer token', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_API_TOKEN', TOKEN)
  })

  it('accepts the exact token', async () => {
    await expect(requireAdmin(adminRequest(`Bearer ${TOKEN}`))).resolves.toEqual({ kind: 'token', userId: null })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('rejects a wrong token with 403 and does not fall back to the session', async () => {
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', ADMIN_ID)
    vi.mocked(createClient).mockResolvedValue(fakeClient({ user: user(ADMIN_ID) }).client)
    for (const header of [`Bearer ${TOKEN}x`, `Bearer ${TOKEN.slice(0, -1)}`, 'Bearer x', `Bearer ${TOKEN.toUpperCase()}`]) {
      const err = await rejection(requireAdmin(adminRequest(header)))
      expect(err).toMatchObject({ status: 403, code: 'forbidden' })
    }
    expect(createClient).not.toHaveBeenCalled()
  })

  it('rejects requests without a bearer header when no admin users are configured', async () => {
    expect(await rejection(requireAdmin(adminRequest()))).toMatchObject({ status: 403 })
    expect(await rejection(requireAdmin(adminRequest(`Basic ${TOKEN}`)))).toMatchObject({ status: 403 })
  })
})

describe('requireAdmin — too-short token', () => {
  it('ignores an ADMIN_API_TOKEN shorter than 32 chars even when the bearer matches', async () => {
    vi.stubEnv('ADMIN_API_TOKEN', 'short-token')
    expect(await rejection(requireAdmin(adminRequest('Bearer short-token')))).toMatchObject({ status: 403 })
  })

  it('then still allows a listed admin user via the session', async () => {
    vi.stubEnv('ADMIN_API_TOKEN', 'short-token')
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', ADMIN_ID)
    vi.mocked(createClient).mockResolvedValue(fakeClient({ user: user(ADMIN_ID) }).client)
    await expect(requireAdmin(adminRequest('Bearer short-token'))).resolves.toEqual({ kind: 'user', userId: ADMIN_ID })
  })
})

describe('requireAdmin — PLATFORM_ADMIN_USER_IDS', () => {
  beforeEach(() => {
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', ` ${OTHER_ID.replace(/./, 'a')} , ${ADMIN_ID} ,, `)
  })

  it('accepts a signed-in user on the allow-list (whitespace-tolerant list)', async () => {
    const fake = fakeClient({ user: user(ADMIN_ID) })
    vi.mocked(createClient).mockResolvedValue(fake.client)
    await expect(requireAdmin(adminRequest())).resolves.toEqual({ kind: 'user', userId: ADMIN_ID })
    expect(fake.getUser).toHaveBeenCalledTimes(1)
  })

  it('rejects a signed-in user who is not on the list', async () => {
    vi.mocked(createClient).mockResolvedValue(fakeClient({ user: user(OTHER_ID) }).client)
    expect(await rejection(requireAdmin(adminRequest()))).toMatchObject({ status: 403 })
  })

  it('rejects when nobody is signed in', async () => {
    vi.mocked(createClient).mockResolvedValue(fakeClient({ user: null }).client)
    expect(await rejection(requireAdmin(adminRequest()))).toMatchObject({ status: 403 })
  })
})

describe('requireAdmin — nothing configured', () => {
  it('refuses every call without consulting the session', async () => {
    vi.mocked(createClient).mockResolvedValue(fakeClient({ user: user(ADMIN_ID) }).client)
    expect(await rejection(requireAdmin(adminRequest()))).toMatchObject({ status: 403, code: 'forbidden' })
    expect(await rejection(requireAdmin(adminRequest('Bearer anything-at-all-0123456789abcdef')))).toMatchObject({ status: 403 })
    expect(createClient).not.toHaveBeenCalled()
  })
})

describe('requireOrg', () => {
  it('401 without a signed-in user', async () => {
    vi.mocked(createClient).mockResolvedValue(fakeClient({ user: null }).client)
    expect(await rejection(requireOrg())).toMatchObject({ status: 401, code: 'unauthorized' })
  })

  it('404 when the user has no organization', async () => {
    vi.mocked(createClient).mockResolvedValue(fakeClient({ user: user(ADMIN_ID), org: { data: null, error: null } }).client)
    expect(await rejection(requireOrg())).toMatchObject({ status: 404, code: 'not_found' })
  })

  it('500 with a generic message when the org query fails', async () => {
    vi.mocked(createClient).mockResolvedValue(fakeClient({ user: user(ADMIN_ID), org: { data: null, error: { message: 'relation "organizations" secret' } } }).client)
    const err = await rejection(requireOrg())
    expect(err).toMatchObject({ status: 500, code: 'internal' })
    expect(err.message).not.toContain('secret')
  })

  it('returns the user-scoped client, user and org, querying by the user id', async () => {
    const org = { id: 'org_1', name: 'Smile Clinic', timezone: 'Europe/Bucharest', plan: 'pro' }
    const fake = fakeClient({ user: user(ADMIN_ID), org: { data: org, error: null } })
    vi.mocked(createClient).mockResolvedValue(fake.client)
    const ctx = await requireOrg()
    expect(ctx.org).toEqual(org)
    expect(ctx.user.id).toBe(ADMIN_ID)
    expect(ctx.supabase).toBe(fake.client)
    expect(fake.from).toHaveBeenCalledWith('organizations')
    expect(fake.select).toHaveBeenCalledWith('id, name, timezone, plan')
    expect(fake.eq).toHaveBeenCalledWith('user_id', ADMIN_ID)
  })
})
