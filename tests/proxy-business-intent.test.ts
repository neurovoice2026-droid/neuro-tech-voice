// The proxy redirects a signed-in user away from /register before the page
// renders, so the page's own intent cookie (components/auth/BusinessIntentCookie)
// is never written for them. The proxy writes it on the redirect instead, so a
// signed-in owner who follows a store plan's "Start free" still gets "Online
// store" pre-selected in Step 0 of the onboarding.

import { describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const updateSession = vi.fn()
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: (...args: unknown[]) => updateSession(...args),
}))

import { proxy } from '@/proxy'

function signedIn() {
  updateSession.mockResolvedValue({
    supabaseResponse: NextResponse.next(),
    user: { id: 'user-1' },
    supabase: { from: vi.fn() },
  })
}

function signedOut() {
  updateSession.mockResolvedValue({ supabaseResponse: NextResponse.next(), user: null, supabase: { from: vi.fn() } })
}

const intentCookies = (response: Response) =>
  response.headers.getSetCookie().filter((cookie) => cookie.startsWith('ntv_business_intent='))

describe('the proxy keeps the store sign-up intent for a signed-in user', () => {
  it('sets the intent cookie on the redirect away from /register?intent=store', async () => {
    signedIn()
    const response = await proxy(new NextRequest('http://localhost:3000/register?intent=store'))
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location')!).pathname).toBe('/dashboard')
    expect(intentCookies(response)).toEqual(['ntv_business_intent=ecommerce; Path=/; Max-Age=2592000; SameSite=Lax'])
  })

  it('marks the cookie Secure on https, and does the same for /login', async () => {
    signedIn()
    const response = await proxy(new NextRequest('https://app.example.com/login?intent=store'))
    expect(response.status).toBe(307)
    expect(intentCookies(response)).toEqual(['ntv_business_intent=ecommerce; Path=/; Max-Age=2592000; SameSite=Lax; Secure'])
  })

  it('writes nothing without a store intent, including for an intent it does not know', async () => {
    signedIn()
    for (const path of ['/register', '/register?intent=plumbing', '/register?intent=ecommerce']) {
      const response = await proxy(new NextRequest(`http://localhost:3000${path}`))
      expect(response.status, path).toBe(307)
      expect(intentCookies(response), path).toEqual([])
    }
  })

  it('leaves a signed-out visitor on the register page, which writes the cookie itself', async () => {
    signedOut()
    const response = await proxy(new NextRequest('http://localhost:3000/register?intent=store'))
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(intentCookies(response)).toEqual([])
  })
})
