import { describe, expect, it } from 'vitest'
import {
  emailFromIdToken,
  GOOGLE_SCOPES,
  missingScopes,
  parseGrantedScopes,
  parseOAuthState,
  safeReturnPath,
  scopesForType,
  withQuery,
} from '@/lib/google/scopes'

describe('scopes per integration', () => {
  it('asks each integration only for what it uses, plus identity', () => {
    expect(scopesForType('google_calendar')).toEqual([
      'openid',
      'email',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.freebusy',
      'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    ])
    expect(scopesForType('gmail')).toEqual(['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'])
    expect(GOOGLE_SCOPES.google_drive).toEqual(['https://www.googleapis.com/auth/drive.file'])
  })

  it('detects permissions unticked on the consent screen', () => {
    const granted = parseGrantedScopes(
      'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events'
    )
    expect(missingScopes('google_calendar', granted)).toEqual([
      'https://www.googleapis.com/auth/calendar.freebusy',
      'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    ])
    expect(missingScopes('gmail', parseGrantedScopes('https://www.googleapis.com/auth/gmail.send'))).toEqual([])
  })

  it('accepts the broader calendar scope of older connections', () => {
    expect(missingScopes('google_calendar', ['https://www.googleapis.com/auth/calendar'])).toEqual([])
    expect(missingScopes('google_drive', ['https://www.googleapis.com/auth/drive'])).toEqual([])
  })
})

describe('OAuth state and return paths', () => {
  it('parses our own state only', () => {
    expect(parseOAuthState('google_calendar.abcDEF0123456789_-xyz')).toEqual({ type: 'google_calendar', nonce: 'abcDEF0123456789_-xyz' })
    expect(parseOAuthState('webhook.abcDEF0123456789')).toBeNull()
    expect(parseOAuthState('gmail.short')).toBeNull()
    expect(parseOAuthState('gmail')).toBeNull()
    expect(parseOAuthState(null)).toBeNull()
  })

  it('keeps redirects inside the app', () => {
    expect(safeReturnPath('/agent?tab=skills#booking')).toBe('/agent?tab=skills#booking')
    expect(safeReturnPath(null)).toBe('/integrations')
    expect(safeReturnPath('https://evil.example/phish')).toBe('/integrations')
    expect(safeReturnPath('//evil.example')).toBe('/integrations')
    expect(safeReturnPath('/\\evil.example')).toBe('/integrations')
    expect(safeReturnPath('/%0d%0aSet-Cookie:x')).toBe('/%0d%0aSet-Cookie:x')
    expect(safeReturnPath('/ok\nbad')).toBe('/integrations')
    expect(safeReturnPath('javascript:alert(1)')).toBe('/integrations')
    expect(safeReturnPath('/api/integrations/google/connect')).toBe('/integrations')
  })

  it('adds query parameters without losing existing ones', () => {
    expect(withQuery('/agent?tab=skills', { connected: 'google_calendar' })).toBe('/agent?tab=skills&connected=google_calendar')
    expect(withQuery('/integrations', { error: 'upgrade_required' })).toBe('/integrations?error=upgrade_required')
  })
})

describe('emailFromIdToken', () => {
  function token(claims: Record<string, unknown>): string {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    return `${encode({ alg: 'RS256' })}.${encode(claims)}.signature`
  }

  it('reads the email claim', () => {
    expect(emailFromIdToken(token({ email: 'owner@example.com', email_verified: true }))).toBe('owner@example.com')
    expect(emailFromIdToken(token({ email: 'josé@exämple.com' }))).toBe('josé@exämple.com')
  })

  it('returns null for anything else', () => {
    expect(emailFromIdToken(token({ sub: '123' }))).toBeNull()
    expect(emailFromIdToken('not-a-jwt')).toBeNull()
    expect(emailFromIdToken('a.!!!.c')).toBeNull()
    expect(emailFromIdToken(null)).toBeNull()
  })
})
