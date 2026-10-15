// The production deployment's vercel.app alias served the whole site a
// second time. The proxy now sends a page read there to www for good, and
// leaves every other host alone: preview deployments live on hosts of
// their own and must keep serving, and so must the API on the alias.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site'

const updateSession = vi.fn()
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: (...args: unknown[]) => updateSession(...args),
}))

import { proxy } from '@/proxy'

const ALIAS = 'https://neuro-tech-voice.vercel.app'

beforeEach(() => {
  updateSession.mockResolvedValue({ supabaseResponse: NextResponse.next(), user: null, supabase: { from: vi.fn() } })
})

describe('the production alias redirects to www', () => {
  it('sends the homepage to the canonical origin with a permanent 308', async () => {
    const response = await proxy(new NextRequest(`${ALIAS}/`))
    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(`${SITE_URL}/`)
    expect(updateSession).not.toHaveBeenCalled()
  })

  it('keeps the path and the query string', async () => {
    for (const path of ['/industries/veterinary', '/register?intent=store', '/robots.txt', '/auth/callback?code=abc']) {
      const response = await proxy(new NextRequest(`${ALIAS}${path}`))
      expect(response.status, path).toBe(308)
      expect(response.headers.get('location'), path).toBe(`${SITE_URL}${path}`)
    }
  })

  it('reads the Host header, which is what the request was addressed to', async () => {
    // `next start` rebuilds the proxy's URL on its own hostname.
    const request = new NextRequest('http://localhost:3000/pricing', { headers: { host: 'Neuro-Tech-Voice.vercel.app:443' } })
    const response = await proxy(request)
    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(`${SITE_URL}/pricing`)
  })

  it('never leaves www, whatever the path looks like', async () => {
    // The proxy runs before Next folds repeated slashes, so these reach it
    // as `//evil.example/x`; resolved as a relative URL, that is a host.
    for (const path of ['//evil.example/x', '/\\evil.example/x', '//evil.example', '///evil.example/x?y=1']) {
      const response = await proxy(new NextRequest(`${ALIAS}${path}`))
      expect(response.status, path).toBe(308)
      const location = new URL(response.headers.get('location') ?? '')
      expect(location.origin, path).toBe(SITE_URL)
      expect(location.pathname.startsWith('//'), path).toBe(true)
    }
  })

  it('redirects a HEAD as well as a GET', async () => {
    const response = await proxy(new NextRequest(`${ALIAS}/privacy`, { method: 'HEAD' }))
    expect(response.status).toBe(308)
  })
})

describe('everything else is served where it was asked for', () => {
  it('leaves preview deployments, www, localhost and look-alike hosts alone', async () => {
    for (const origin of [
      'https://neuro-tech-voice-k3j9x2abc-neuro-tech.vercel.app',
      'https://neuro-tech-voice-git-main-neuro-tech.vercel.app',
      'https://www.neurotechvoice.com',
      'http://localhost:3000',
      'https://neuro-tech-voice.vercel.app.example.com',
    ]) {
      const response = await proxy(new NextRequest(`${origin}/privacy`))
      expect(response.status, origin).toBe(200)
      expect(response.headers.get('location'), origin).toBeNull()
    }
  })

  it('keeps the API answering on the alias: webhooks and crons do not follow redirects', async () => {
    for (const [path, method] of [
      ['/api/billing/webhook', 'POST'],
      ['/api/cron/voice-maintenance', 'GET'],
      ['/api/elevenlabs/webhook', 'POST'],
    ] as const) {
      const response = await proxy(new NextRequest(`${ALIAS}${path}`, { method }))
      expect(response.status, path).toBe(200)
      expect(response.headers.get('location'), path).toBeNull()
    }
  })

  it('does not redirect a POST to a page', async () => {
    const response = await proxy(new NextRequest(`${ALIAS}/register`, { method: 'POST' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})
