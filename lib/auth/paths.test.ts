import { describe, expect, it } from 'vitest'
import { isSupabaseAuthCookie, safeNextPath } from './paths'

describe('safeNextPath', () => {
  it('keeps same-origin app paths with their query', () => {
    expect(safeNextPath('/calls')).toBe('/calls')
    expect(safeNextPath('/calls?status=completed&page=2')).toBe('/calls?status=completed&page=2')
    expect(safeNextPath('/agent/')).toBe('/agent/')
    expect(safeNextPath('  /billing  ')).toBe('/billing')
  })

  it('drops fragments and normalises dot segments', () => {
    expect(safeNextPath('/calls#top')).toBe('/calls')
    expect(safeNextPath('/calls/../billing')).toBe('/billing')
  })

  it('rejects anything that could leave the site', () => {
    for (const value of [
      'https://evil.example',
      '//evil.example',
      '///evil.example',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      'evil.example/path',
      '/%0d%0aSet-Cookie:x=1'.replace('%0d%0a', '\r\n'),
      '/calls\u0000',
    ]) {
      expect(safeNextPath(value), JSON.stringify(value)).toBeNull()
    }
  })

  it('rejects loops back into auth pages and non-page targets', () => {
    for (const value of ['/login', '/login?next=/calls', '/register', '/api/agent', '/_next/static/x.js', '/auth/callback', '/reset-password']) {
      expect(safeNextPath(value), value).toBeNull()
    }
    // Only whole segments are blocked.
    expect(safeNextPath('/loginhelp')).toBe('/loginhelp')
    expect(safeNextPath('/apis')).toBe('/apis')
  })

  it('rejects empty, oversized and non-string input', () => {
    expect(safeNextPath('')).toBeNull()
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath(`/${'a'.repeat(600)}`)).toBeNull()
  })
})

describe('isSupabaseAuthCookie', () => {
  it('matches the session cookie, its chunks and the PKCE verifier', () => {
    for (const name of [
      'sb-abcdefghijklmnopqrst-auth-token',
      'sb-abcdefghijklmnopqrst-auth-token.0',
      'sb-abcdefghijklmnopqrst-auth-token.12',
      'sb-abcdefghijklmnopqrst-auth-token-code-verifier',
      'sb-localhost-auth-token',
    ]) {
      expect(isSupabaseAuthCookie(name), name).toBe(true)
    }
  })

  it('leaves every other cookie alone', () => {
    for (const name of ['ntv_onboarded', 'sb-auth-token', 'google_oauth_state', 'sb-x-auth-token-extra', '__Host-sb-x-auth-token']) {
      expect(isSupabaseAuthCookie(name), name).toBe(false)
    }
  })
})
