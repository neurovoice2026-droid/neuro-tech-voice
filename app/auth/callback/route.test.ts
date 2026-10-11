import { beforeEach, describe, expect, it, vi } from 'vitest'

// Auth callback: a password-reset link lands on /reset-password through an
// exact allow-list; any other `next` value is ignored (no open redirect).

const state = vi.hoisted(() => ({
  exchangeError: null as unknown,
  user: { id: 'u1' } as unknown,
  onboarded: true,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: async () => ({ error: state.exchangeError }),
      getUser: async () => ({ data: { user: state.user } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { onboarding_completed: state.onboarded }, error: null }) }) }),
    }),
  }),
}))

import { GET } from './route'

const location = (res: Response) => {
  const url = new URL(res.headers.get('location') ?? '')
  return `${url.origin}${url.pathname}${url.search}`
}
const req = (query: string) => new Request(`https://app.example.com/auth/callback?${query}`)

beforeEach(() => {
  state.exchangeError = null
  state.user = { id: 'u1' }
  state.onboarded = true
})

describe('GET /auth/callback', () => {
  it('opens the new-password page after a reset link', async () => {
    expect(location(await GET(req('code=abc&next=/reset-password')))).toBe('https://app.example.com/reset-password')
  })

  it('goes to the new-password page even before onboarding is finished', async () => {
    state.onboarded = false
    expect(location(await GET(req('code=abc&next=/reset-password')))).toBe('https://app.example.com/reset-password')
  })

  it.each(['https://evil.example', '//evil.example', '/dashboard/../../evil', '/reset-password/x'])(
    'ignores a next value outside the allow-list (%s)',
    async (next) => {
      expect(location(await GET(req(`code=abc&next=${encodeURIComponent(next)}`)))).toBe('https://app.example.com/dashboard')
    },
  )

  it('keeps the normal sign-in destinations', async () => {
    expect(location(await GET(req('code=abc')))).toBe('https://app.example.com/dashboard')
    state.onboarded = false
    expect(location(await GET(req('code=abc')))).toBe('https://app.example.com/onboarding')
  })

  it('offers a new link when a reset link is expired or reused', async () => {
    state.exchangeError = { message: 'invalid flow state' }
    expect(location(await GET(req('code=abc&next=/reset-password')))).toBe('https://app.example.com/forgot-password?error=link_expired')
  })

  it('sends any other failed sign-in back to the login page', async () => {
    state.exchangeError = { message: 'invalid flow state' }
    expect(location(await GET(req('code=abc')))).toBe('https://app.example.com/login?error=auth_failed')
    expect(location(await GET(req('')))).toBe('https://app.example.com/login?error=auth_failed')
  })
})
